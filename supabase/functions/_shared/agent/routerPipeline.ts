/**
 * Onda 2 item 5 (2026-06-12) — router pipeline EXTRAÍDO de ai-agent/index.ts.
 *
 * Pipeline: hop guard → classifyIntent (hop 0) → tabela de dispatch
 * intent→specialist → no-result loop determinístico → qualificationGate
 * (buscar vs qualificar) → override pós-nome → override exit_action=handoff
 * (item 4) → pré-busca do product → runSpecialist.
 *
 * Contrato: devolve { response, pendingHandoffTrigger, pendingHandoffTriggerMsg }.
 *   - response != null  → turno respondido pelo specialist (caller retorna direto).
 *   - response == null  → falha interna (hop guard, intent sem specialist, erro
 *     catastrófico do specialist, exceção). D6 (2026-07-25): o monolito foi
 *     APOSENTADO — o index.ts responde a null com FALLBACK GRACIOSO (transbordo
 *     pro humano com a msg de handoff configurada), nunca mais com o LLM antigo.
 *   - pendingHandoffTrigger/Msg ecoam de volta possivelmente ATUALIZADOS.
 */

import { classifyIntent, logRouterRun, type Intent } from './router.ts'
import { checkHopLimit, generateTurnId } from './hopGuard.ts'
import { runSpecialist, type SpecialistCtx, type SpecialistDef } from './specialistBase.ts'
import { buildGreetingSpecialistDef } from './greetingSpecialist.ts'
import { buildQualificationSpecialistDef } from './qualificationSpecialist.ts'
import { buildProductSpecialistDef, deriveProductSearchParams } from './productSpecialist.ts'
import { buildObjectionSpecialistDef } from './objectionSpecialist.ts'
import { buildHandoffSpecialistDef } from './handoffSpecialist.ts'
import { evaluateQualificationGate } from './qualificationGate.ts'
import { evaluateProductQualificationFlow, evaluateQualifyReaskGuard, detectSpecificItemRequest, getReaskState } from './productQualificationFlow.ts'
import { inferProductQualificationAnswerTag, readProductQualificationState } from './productQualificationState.ts'
import { runInlineSearchProducts } from './exitActionDispatcher.ts'
import { mergeCartItems, normalizeCart } from './cart.ts'
import { getCategoriesOrDefault } from '../serviceCategories.ts'
import { isOutsideBusinessHours } from '../businessHours.ts'
import { mergeTags } from '../agentHelpers.ts'
import { STATUS_IA, DEFAULT_SPECIALIST_MODEL, hasActiveHandoffMarker } from '../constants.ts'
import type { PendingExitActionHandoff } from './preLLMAutoExtract.ts'
import type { SendTextMsgFn, SendTtsFn, BroadcastEventFn, PickHandoffMessageFn, RunQueueAssignmentFn } from './dispatchResponse.ts'
import type { SendPresenceFn, ExecuteToolSafeFn } from './llmCallLoop.ts'
import type { Logger } from './context.ts'

export interface RouterPipelineCtx {
  agent: Record<string, any>
  agent_id: string
  conversation: Record<string, any>
  conversation_id: string
  contact: any
  supabase: any
  log: Logger
  corsHeaders: Record<string, string>
  startTime: number
  incomingText: string
  geminiContents: any[]
  toolCallsLog: any[]
  queuedMessages: any[]
  incomingHasAudio: boolean
  leadName: string | null
  capturedLeadName: string | null
  leadProfile: any
  profileData: any
  funnelData: any
  hasInteracted: boolean
  hasEverInteracted: boolean
  /** greeting determinístico foi enviado NESTE turno (anti double-ask) */
  greetingBlockEntered: boolean
  /** busca decidida pré-LLM (R121/R137/C2) pro product specialist consumir */
  routerProductPreSearch: { query: string; category: string } | null
  /** exit_action=handoff do motor determinístico (item 4) */
  routerExitActionHandoff: PendingExitActionHandoff | null
  pendingHandoffTrigger: string | null
  pendingHandoffTriggerMsg: string
  executeToolSafe: ExecuteToolSafeFn
  sendTextMsg: SendTextMsgFn
  sendTts: SendTtsFn
  sendPresence: SendPresenceFn
  broadcastEvent: BroadcastEventFn
  pickHandoffMessage: PickHandoffMessageFn
  runQueueAssignment: RunQueueAssignmentFn
  /** closure do index.ts (cadeia rica de qualificação pro resumo do vendedor) */
  buildQualificationChain: (tags: string[], pendingTags: Record<string, string>, name: string | null) => string
}

export interface RouterPipelineResult {
  /** Response final do turno; null = falha interna → index faz transbordo gracioso (D6) */
  response: Response | null
  pendingHandoffTrigger: string | null
  pendingHandoffTriggerMsg: string
}

export async function runRouterPipeline(ctx: RouterPipelineCtx): Promise<RouterPipelineResult> {
  const {
    agent, agent_id, conversation, conversation_id, contact,
    supabase, log, corsHeaders, startTime,
    incomingText, geminiContents, toolCallsLog, queuedMessages, incomingHasAudio,
    leadName, capturedLeadName, leadProfile, profileData, funnelData,
    hasInteracted, hasEverInteracted, greetingBlockEntered,
    routerExitActionHandoff,
    executeToolSafe, sendTextMsg, sendTts, sendPresence, broadcastEvent,
    pickHandoffMessage, runQueueAssignment,
    buildQualificationChain,
  } = ctx
  // Mutáveis: o corpo (verbatim do index.ts) reatribui estes três.
  let routerProductPreSearch = ctx.routerProductPreSearch
  let pendingHandoffTrigger = ctx.pendingHandoffTrigger
  let pendingHandoffTriggerMsg = ctx.pendingHandoffTriggerMsg

  const run = async (): Promise<Response | null> => {
    // D6 (2026-07-25): gate de routing_mode removido — router é o único cérebro.
    // Bloco preservado pra manter a indentação/diff mínimos na aposentadoria.
    {
      const turn_id = generateTurnId()
      log.info('Router pipeline START', { turn_id, conversation_id })

      try {
        const hopCheck = await checkHopLimit({
          supabase, turn_id, agent_id, conversation_id, log,
        })
        if (!hopCheck.allow) {
          log.warn('Router: hop guard tripped — null → transbordo gracioso (D6)', hopCheck)
        } else {
          // Hop 0: classifyIntent
          const shortHistory = (geminiContents as any[])
            .slice(-5)
            .map((c) => ({
              role: c.role === 'model' ? ('assistant' as const) : ('user' as const),
              content: (c.parts?.[0]?.text || '').substring(0, 200),
            }))
          const routerResult = await classifyIntent({
            lastIncoming: incomingText,
            conversationTags: conversation.tags || [],
            shortHistory,
            log,
          })
          await logRouterRun(supabase, {
            conversation_id, agent_id, turn_id,
            result: routerResult,
            promptChars: 936, // ROUTER_SYSTEM_PROMPT.length, hardcoded pra evitar import extra
            log,
          })
          log.info('Router result', { intent: routerResult.intent, confidence: routerResult.confidence, fallback: routerResult.fallback })

          // Tabela de dispatch intent→specialist (Sprint D). Whitelist declarada
          // (best practice: handoff targets declarados + enforçados). Cada def é
          // { name, intent, model, buildPrompt, toolDefs } — pipeline em runSpecialist.
          const catConfig = getCategoriesOrDefault(agent)
          const serviceCategories = (catConfig?.categories as any[]) || []
          // v7.91.0: modelo dos specialists consultivos, configurável por agente (decisão #4).
          // greeting fica de propósito no default barato (gpt-4.1-mini, definido no próprio
          // builder) — saudação é tarefa trivial e não vale o modelo premium. Hoje todos os
          // defaults dos demais = 'gpt-4.1' = DEFAULT_SPECIALIST_MODEL, então threadar é
          // behavior-preserving; só diverge quando o dono troca o modelo na UI.
          const specialistModel = agent.specialist_model || DEFAULT_SPECIALIST_MODEL
          const DISPATCH: Record<Intent, SpecialistDef> = {
            saudacao: buildGreetingSpecialistDef(),
            fora_escopo: buildGreetingSpecialistDef(), // redireciona educadamente
            qualificacao: buildQualificationSpecialistDef(specialistModel),
            produto: buildProductSpecialistDef(specialistModel),
            objecao: buildObjectionSpecialistDef(specialistModel),
            pagamento: buildObjectionSpecialistDef(specialistModel), // objection carrega business_info
            handoff: buildHandoffSpecialistDef(specialistModel),
          }
          let def = DISPATCH[routerResult.intent]

          // ── Catálogo-ausente → QUALIFICAÇÃO PROFUNDA antes do handoff (v7.58) ──
          // Quando uma busca volta 0 (catálogo digital sem o item OU categoria offline),
          // NÃO transbordamos na hora. O handleZeroResults marca `enriching` e o sistema
          // coleta um PERFIL RICO (até max_enrichment_questions perguntas de stage) — o
          // lead NUNCA percebe que faltou no catálogo. AQUI conduzimos o loop de forma
          // DETERMINÍSTICA: o router sozinho fragmentava entre specialists e nunca voltava
          // a buscar (o bloqueio `produto:` em deriveProductSearchParams matava a re-busca).
          //   - enrich_count < max → força product_specialist + injeta routerProductPreSearch
          //     (bypassa o bloqueio → handleZeroResults reentra, faz a PRÓXIMA pergunta e
          //     incrementa enrich_count).
          //   - enrich_count >= max (ou tag legada seller_handoff_pending) → força handoff
          //     specialist com a cadeia coletada; dispatchResponse step 22 executa o handoff
          //     real (fila + shadow + msg personalizada) mesmo que o LLM só verbalize.
          const enrichingNow = (conversation.tags || []).some(
            (t: string) => typeof t === 'string' && t.startsWith('enriching:'),
          )
          const legacySellerPending = (conversation.tags || []).some(
            (t: string) => typeof t === 'string' && t.startsWith('seller_handoff_pending:'),
          )
          let premiumLoopState = readProductQualificationState(conversation.tags || [])
          let enrichCountNow = premiumLoopState.questionsAfterEmpty
          const rawMaxEnrich = Number(agent.max_enrichment_questions ?? 2)
          const configuredMaxEnrich = Number.isFinite(rawMaxEnrich) ? rawMaxEnrich : 2
          const maxEnrichNow = Math.min(Math.max(configuredMaxEnrich, 1), 6)
          const premiumSearchFailNow = (conversation.tags || []).some(
            (t: string) => typeof t === 'string' && /^search_fail:[1-9]/.test(t),
          ) && (conversation.tags || []).some(
            (t: string) =>
              typeof t === 'string' &&
              /^interesse:(revestimentos|porcelanatos_revestimentos|torneiras|tintas)\b/.test(t),
          )
          // (2026-06-09) Defesa em profundidade: o loop sem-resultado NÃO pode
          // reentrar se já existe handoff durável ativo (handoff_created/human_assigned).
          // O gate de silêncio (após :219) já coage status_ia→shadow nesse caso — mas se
          // qualquer caminho fizer status_ia driftar, esta checagem de tag DURÁVEL impede
          // o re-disparo do MESMO transbordo (feedback_guard_must_check_durable_tags).
          const handoffAlreadyCreated = hasActiveHandoffMarker(conversation.tags)
          const inNoResultLoop =
            (enrichingNow || legacySellerPending || premiumSearchFailNow)
            && conversation.status_ia !== STATUS_IA.SHADOW
            && !handoffAlreadyCreated
          if (inNoResultLoop) {
            // Captura da resposta do lead DESACOPLADA do cap (2026-05-30, fix 21.36
            // defeito área): com maxQuestionsAfterEmpty=maxEnrichNow, no turno em que o
            // cap é atingido o verdict retorna readyToHandoff=true e nextRequiredField=null
            // — então a ÚLTIMA resposta (ex.: "Uns 90 metros" → area) era descartada e
            // sumia do resumo do vendedor. A DECISÃO de transbordar continua usando o
            // verdict capado (premiumHandoffVerdict abaixo); aqui usamos um teto alto só
            // pra SEMPRE inferir/salvar o atributo que o lead acabou de informar.
            const beforeAnswerVerdict = evaluateProductQualificationFlow({
              tags: conversation.tags || [],
              agent,
              incomingText,
              catalogResult: 'empty',
              maxQuestionsAfterEmpty: 99,
            })
            const inferredAnswer = inferProductQualificationAnswerTag(
              beforeAnswerVerdict.nextRequiredField?.key,
              incomingText,
            )
            if (inferredAnswer && Object.keys(inferredAnswer).length > 0) {
              const inferredWithScoreTags = mergeTags(conversation.tags || [], inferredAnswer)
              const inferredVerdict = evaluateProductQualificationFlow({
                tags: inferredWithScoreTags,
                agent,
                incomingText,
                catalogResult: 'empty',
                maxQuestionsAfterEmpty: maxEnrichNow,
              })
              const nextTags = mergeTags(inferredWithScoreTags, {
                lead_score: String(inferredVerdict.qualificationScore),
              })
              conversation.tags = nextTags
              await supabase.from('conversations').update({ tags: nextTags }).eq('id', conversation_id)
              premiumLoopState = readProductQualificationState(nextTags)
              enrichCountNow = premiumLoopState.questionsAfterEmpty
              log.info('premium no-result loop: inferred current answer tag', {
                field: Object.keys(inferredAnswer)[0],
                value: Object.values(inferredAnswer)[0],
                score: inferredVerdict.qualificationScore,
              })
            }
          }
          const premiumHandoffVerdict = inNoResultLoop
            ? evaluateProductQualificationFlow({
              tags: conversation.tags || [],
              agent,
              incomingText,
              catalogResult: 'empty',
              maxQuestionsAfterEmpty: maxEnrichNow,
            })
            : null
          const premiumNeedsMoreFields = Boolean(
            premiumHandoffVerdict?.categoryId &&
            !premiumHandoffVerdict.readyToHandoff &&
            premiumHandoffVerdict.nextRequiredField,
          )
          // Bug 1 (2026-06-01): se o lead pede "o da foto" / item específico durante a
          // qualificação offline, a IA não consegue mapear isso a um atributo — em vez de
          // continuar perguntando ambiente/cor (que o lead não vai responder pq ele já
          // disse "quero ESSE"), transborda já: o vendedor vê a foto e fecha. Caso Dauana.
          const specificItemAsked = inNoResultLoop && detectSpecificItemRequest(incomingText)
          const noResultReadyForHandoff = Boolean(
            specificItemAsked ||
            premiumHandoffVerdict?.readyToHandoff ||
            (legacySellerPending && !premiumNeedsMoreFields) ||
            (enrichCountNow >= maxEnrichNow && !premiumNeedsMoreFields),
          )

          const buildNoResultReason = (): string => {
            // Resumo RICO pro vendedor: cadeia completa de qualificação coletada no loop
            // (nome > categoria > produto > ambiente > cor > acabamento > área...). O item
            // provavelmente está só no estoque físico — o vendedor confere e fecha.
            const chain = buildQualificationChain(conversation.tags || [], {}, leadName || null)
            if (chain && chain.trim()) return chain.trim()
            const legacyT = (conversation.tags || []).find(
              (t: string) => typeof t === 'string' && t.startsWith('seller_handoff_pending:'),
            )
            return (
              (legacyT ? legacyT.slice('seller_handoff_pending:'.length).replace(/_/g, ' ').trim() : '') ||
              'consulta de produto'
            )
          }

          const buildLeadSafeNoResultReason = (): string => {
            const tags = Array.isArray(conversation.tags) ? conversation.tags : []
            const getTag = (key: string): string | null => {
              let value: string | null = null
              for (const tag of tags) {
                if (typeof tag === 'string' && tag.startsWith(`${key}:`)) {
                  value = tag.slice(key.length + 1).replace(/_/g, ' ').trim()
                }
              }
              return value
            }
            const interesse = (getTag('interesse') || 'produto').replace(/^torneiras$/i, 'torneira gourmet')
            const parts = [
              interesse,
              getTag('ambiente_torneira') ? `para ${getTag('ambiente_torneira')}` : null,
              getTag('tipo_torneira') ? `de ${getTag('tipo_torneira')}` : null,
              getTag('modelo_torneira') ? `com ${getTag('modelo_torneira')}` : null,
              getTag('acabamento_torneira') ? `acabamento ${getTag('acabamento_torneira')}` : null,
            ].filter(Boolean)
            return parts.join(', ')
          }

          // Diretiva por-turno pro qualification_specialist no loop sem-resultado: injetada
          // via preSearchContext (specialistBase concatena no system prompt). Sem ela o
          // specialist REPETE a mesma pergunta e às vezes afirma "temos sim". Aqui damos
          // (1) regra de neutralidade (nunca confirmar/negar estoque), (2) a cadeia já
          // coletada, (3) a ordem de atributos a perguntar e (4) UMA pergunta por turno.
          let noResultDirective: string | null = null
          const buildEnrichDirective = (): string => {
            const chain = buildQualificationChain(conversation.tags || [], {}, leadName || null)
            const premiumVerdict = evaluateProductQualificationFlow({
              tags: conversation.tags || [],
              agent,
              incomingText,
              catalogResult: 'empty',
              maxQuestionsAfterEmpty: maxEnrichNow,
            })
            const nextRequired = premiumVerdict.nextRequiredField
              ? `${premiumVerdict.nextRequiredField.key} (${premiumVerdict.nextRequiredField.label})`
              : 'nenhum'
            return [
              `[INTERNO] Proximo campo obrigatorio: ${nextRequired}.`,
              '[INTERNO — NÃO mostre nada disto ao lead] Você está QUALIFICANDO um produto que',
              'provavelmente está no estoque FÍSICO da loja (não no catálogo digital).',
              'REGRAS OBRIGATÓRIAS:',
              '1) NUNCA diga "temos", "temos sim", "não temos", "está disponível", "anotado", "anotei"',
              'nem confirme/negue estoque ou disponibilidade. Seja NEUTRO e consultivo ("Claro!",',
              '"Perfeito,", "Entendi,"). Proibido clichês de IA ("Pra encontrar a melhor opção").',
              '2) Produza NO MÁXIMO UMA mensagem de texto neste turno (1 frase, 1 pergunta). Ao chamar',
              'set_tags pra salvar a resposta do lead, a pergunta vai JUNTO no mesmo texto — NÃO escreva',
              'texto adicional depois da tool. NUNCA mande duas mensagens nem duas perguntas.',
              '3) A pergunta deve ser sobre um atributo DIFERENTE que ainda falta. PROIBIDO repetir a',
              'pergunta da sua mensagem anterior: se o lead trouxe OUTRA informação, ACEITE-a e pergunte',
              'um atributo NOVO — não insista no mesmo.',
              '4) Atributos úteis (pergunte os que faltam, em qualquer ordem natural): ambiente',
              '(interno/externo), formato/medida, acabamento (brilhante/acetinado/fosco), cor,',
              'metragem aproximada (m²).',
              `Já coletado: ${chain && chain.trim() ? chain : '(só o pedido inicial)'}.`,
              'Olhe sua ÚLTIMA mensagem no histórico e pergunte algo DIFERENTE dela.',
            ].join(' ')
          }

          // v7.66.0: FORA do horário + flag continue_outside_hours_until_done, em vez de
          // transbordar por-produto ao bater o cap de enriquecimento, ACUMULA o item no
          // pedido (cart_items) e pergunta se o lead quer mais — só transborda no FIM
          // (closer "é só isso" / cap-15 / silêncio). Mantém status_ia=ligada (o lead
          // segue atendido). specificItem ("o da foto") continua transbordando na hora
          // (a IA não resolve → vendedor vê a foto). Dentro do horário ou flag OFF: nada
          // muda (byte-a-byte o caminho atual).
          const continueOutsideFlag = agent.continue_outside_hours_until_done === true
          const deferOfflineNow = inNoResultLoop && continueOutsideFlag &&
            isOutsideBusinessHours(agent.business_hours, agent.extended_hours_until)

          if (inNoResultLoop && noResultReadyForHandoff && deferOfflineNow && !specificItemAsked) {
            const buildOfflineItemName = (): string => {
              const tags = conversation.tags || []
              const lastVal = (prefix: string): string => {
                let v = ''
                for (const t of tags) {
                  if (typeof t === 'string' && t.startsWith(prefix)) v = t.slice(prefix.length).replace(/_/g, ' ').trim()
                }
                return v
              }
              const parts = [
                lastVal('interesse:') || 'produto',
                lastVal('tipo_cano:'), lastVal('tipo_torneira:'), lastVal('tipo_cuba:'),
                lastVal('ambiente_torneira:'), lastVal('modelo_torneira:'),
                lastVal('acabamento_torneira:') || lastVal('acabamento:'),
                lastVal('cor:'),
                lastVal('marca_preferida:') || lastVal('marca_citada:'),
              ].filter(Boolean)
              return (parts.join(' ').slice(0, 80) || 'produto')
            }
            const offlineItemName = buildOfflineItemName()
            const existingCartOffline = normalizeCart((conversation as any).cart_items)
            // Dedup determinístico: no fluxo offline o lead não informou quantidade, então o
            // item entra UMA vez (qty=1). Evita double-count se o turno reprocessar (retry do
            // debounce) — padrão do incidente v7.53.0. Já existe → mantém o cart.
            const alreadyInCart = existingCartOffline.some(
              (i) => (i.name || '').trim().toLowerCase() === offlineItemName.trim().toLowerCase(),
            )
            const nextCartOffline = alreadyInCart
              ? existingCartOffline
              : mergeCartItems(existingCartOffline, [{ name: offlineItemName, qty: 1, unit_price: null }])
            // Reset POR-ITEM via PRESERVE-LIST (não denylist): limpa TODO atributo de
            // qualificação de QUALQUER categoria (config-driven) + lead_score + contadores do
            // loop, mantendo só os tags DURÁVEIS de conversa. (Denylist hardcoded vazava
            // ambiente/aplicacao/formato/quantidade/... + score pro próximo item — review v7.66.0.)
            const PRESERVE_TAG_KEYS = new Set([
              'ia', 'ia_cleared', 'venda', 'intencao', 'handoff_created', 'agent_status',
              'human_assigned', 'seller_notified', 'followups_paused', 'cidade', 'client_type',
              'bairro', 'entrega_modo', 'offline_order', 'offline_await_more',
              'aguardando_upsell', 'aguardando_entrega', 'aguardando_bairro', 'aguardando_mais_itens',
              'selected_product', 'produto_escolhido', 'complementares',
            ])
            const clearedItemTags = (conversation.tags || []).filter(
              (t: string) => typeof t === 'string' && PRESERVE_TAG_KEYS.has(t.split(':')[0]),
            )
            // offline_order = marcador DURÁVEL do pedido offline em aberto (sobrevive a itens
            // não-categorizados); offline_await_more = "acabei de perguntar se quer mais".
            const offlineNextTags = mergeTags(clearedItemTags, { offline_order: '1', offline_await_more: '1' })
            conversation.tags = offlineNextTags
            ;(conversation as any).cart_items = nextCartOffline
            await supabase.from('conversations')
              .update({ tags: offlineNextTags, cart_items: nextCartOffline })
              .eq('id', conversation_id)
            const askMoreMsg = 'Quer mais alguma coisa ou é só isso?'
            await sendTextMsg(askMoreMsg)
            await supabase.from('conversation_messages').insert({
              conversation_id, direction: 'outgoing', content: askMoreMsg, media_type: 'text',
            })
            broadcastEvent({ conversation_id, inbox_id: conversation.inbox_id, direction: 'outgoing', content: askMoreMsg, media_type: 'text' })
            await supabase.from('ai_agent_logs').insert({
              agent_id, conversation_id, event: 'response_sent',
              model: 'deterministic-offline-accumulate',
              latency_ms: Date.now() - startTime,
              metadata: { source: 'offline_accumulate_ask_more', item: offlineItemName, cart_size: nextCartOffline.length },
            })
            log.info('no-result loop: FORA-horário → item acumulado, perguntando se quer mais', {
              item: offlineItemName, cart_size: nextCartOffline.length, enrichCount: enrichCountNow, max: maxEnrichNow,
            })
            return new Response(JSON.stringify({ ok: true, response: askMoreMsg, reason: 'offline_accumulate_ask_more' }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          }

          if (inNoResultLoop && noResultReadyForHandoff) {
            const forcedReason = buildNoResultReason()
            const leadSafeReason = buildLeadSafeNoResultReason()
            log.info('no-result loop: perfil completo → handoff forçado', {
              router_intent: routerResult.intent, enrichCount: enrichCountNow, max: maxEnrichNow,
              reason: forcedReason,
            })
            const forcedHandoffResult = await executeToolSafe('handoff_to_human', {
              reason: leadSafeReason || forcedReason,
              source: 'premium_no_catalog_ready',
            })
            return new Response(JSON.stringify({
              ok: true,
              handoff: true,
              reason: 'premium_no_catalog_ready',
              result: String(forcedHandoffResult).slice(0, 200),
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          } else if (inNoResultLoop) {
            // Ainda coletando perfil → qualification_specialist faz a PRÓXIMA pergunta de
            // atributo (cor, acabamento, área...). NÃO força pré-busca: offline é bloqueado
            // pelo searchGuard (e o product specialist errava ao processar esse contexto);
            // digital já buscou e deu 0 — re-buscar é desperdício. O contador enrich_count é
            // incrementado DETERMINISTICAMENTE aqui; ao atingir o cap (acima) transbordamos.
            const nextCount = enrichCountNow + 1
            const loopTags = mergeTags(conversation.tags || [], {
              enrich_count: String(nextCount),
              questions_after_empty: String(nextCount),
              catalog_result: 'empty',
              physical_stock_required: 'true',
              flow_mode: 'qualify_then_handoff',
            })
            conversation.tags = loopTags
            await supabase.from('conversations').update({ tags: loopTags }).eq('id', conversation_id)
            // A ESCOLHA da próxima pergunta usa teto ALTO (uncapped). O cap (maxEnrichNow)
            // só governa QUANDO transbordar (premiumHandoffVerdict acima); aqui já decidimos
            // que vamos perguntar, então a pergunta deve ser o PRÓXIMO campo realmente
            // faltante. Com maxEnrichNow, o incremento de questions_after_empty logo acima
            // empurrava o verdict ao cap → nextRequiredField=null → pergunta genérica ("me
            // passa mais uma especificação") no exato turno em que faltava só a ÁREA — que
            // então nunca era perguntada nem capturada (fix 21.36 área, 2026-05-30).
            const nextVerdict = evaluateProductQualificationFlow({
              tags: conversation.tags || [],
              agent,
              incomingText,
              catalogResult: 'empty',
              maxQuestionsAfterEmpty: 99,
            })
            const questionByField: Record<string, string> = {
              acabamento: 'Você prefere acabamento brilhante, acetinado ou fosco?',
              cor: 'Qual tonalidade você imagina: bege claro, cinza, branco ou outro tom?',
              local_aplicacao: 'Vai utilizar em qual ambiente: sala, cozinha, quarto ou área integrada?',
              area: 'Aproximadamente quantos metros quadrados você pretende revestir?',
              acabamento_torneira: 'Qual acabamento você prefere: cromado, preto fosco, dourado ou escovado?',
              tipo_cuba: 'Sua cuba é simples ou dupla?',
              perfil: 'Você procura algo mais sofisticado ou uma opção com melhor custo-benefício?',
            }
            const nextFieldKey = nextVerdict.nextRequiredField?.key || ''
            const qualifMsg = questionByField[nextFieldKey] ||
              (nextVerdict.nextRequiredField?.examples
                ? `Qual ${nextVerdict.nextRequiredField.label}? ${nextVerdict.nextRequiredField.examples}.`
                : 'Me passa mais uma especificação para eu direcionar melhor seu atendimento?')
            await sendTextMsg(qualifMsg)
            await supabase.from('conversation_messages').insert({
              conversation_id,
              direction: 'outgoing',
              content: qualifMsg,
              media_type: 'text',
            })
            broadcastEvent({ conversation_id, inbox_id: conversation.inbox_id, direction: 'outgoing', content: qualifMsg, media_type: 'text' })
            await supabase.from('ai_agent_logs').insert({
              agent_id,
              conversation_id,
              event: 'response_sent',
              model: 'deterministic-premium-flow',
              latency_ms: Date.now() - startTime,
              metadata: {
                source: 'premium_no_result_next_question',
                next_field: nextFieldKey,
                response_text: qualifMsg,
              },
            })
            log.info('no-result loop: qualificando fundo via qualification_specialist', {
              router_intent: routerResult.intent, enrichCount: nextCount, max: maxEnrichNow, nextField: nextFieldKey,
            })
            return new Response(JSON.stringify({
              ok: true,
              response: qualifMsg,
              reason: 'premium_no_result_next_question',
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
          }

          // ── qualificationGate (2026-05-24): FONTE ÚNICA buscar-vs-qualificar ──
          // O router classifica produto/qualificacao por heurística de mensagem; o
          // gate é a AUTORIDADE determinística sobre "buscar ou qualificar primeiro",
          // lendo o MESMO stage engine que governa o score (exit_action por stage).
          // Honra o fluxo consultivo (qualifica → ENTÃO busca) sem 5º decisor/gambiarra:
          //   - mode='qualify' (digital, score < limiar de busca): qualification_specialist
          //     (pergunta o próximo campo, acumula score). Suprime pré-busca.
          //   - mode='search' (digital, score >= limiar): FORÇA product_specialist —
          //     mesmo que o router tenha dito 'qualificacao' ao ver uma resposta curta
          //     (ex.: "branco"). É o que honra exit_action=search_products do stage.
          //   - mode='qualify_then_handoff' (offline): product_specialist qualifica
          //     brevemente + handoff (qualification_specialist não tem essa tool).
          //   - mode='no_category': respeita a escolha do router (sem categoria a gatear).
          // Onda 2 item 4: com exit_action=handoff pendente (qualif COMPLETA), o gate
          // "buscar vs qualificar" é irrelevante — pular evita que ele devolva mais
          // uma pergunta determinística e atropele o transbordo (override abaixo).
          if (!inNoResultLoop && !routerExitActionHandoff && (routerResult.intent === 'produto' || routerResult.intent === 'qualificacao')) {
            const currentPremiumVerdict = evaluateProductQualificationFlow({
              tags: conversation.tags || [],
              agent,
              incomingText,
            })
            const currentAnsweredRuntimeKeys = new Set(
              (conversation.tags || [])
                .filter((t: string): t is string => typeof t === 'string' && t.includes(':'))
                .map((t: string) => t.slice(0, t.indexOf(':'))),
            )
            const currentInteresseTag = (conversation.tags || []).find(
              (t: string) => typeof t === 'string' && t.startsWith('interesse:'),
            )
            const currentTintasRuntimeField = currentInteresseTag === 'interesse:tintas'
              ? ['objetivo', 'ambiente', 'aplicacao', 'tipo_tinta', 'cor', 'perfil']
                .find((key) => !currentAnsweredRuntimeKeys.has(key))
              : ''
            const inferredCurrentAnswer = inferProductQualificationAnswerTag(
              currentTintasRuntimeField || currentPremiumVerdict.nextRequiredField?.key,
              incomingText,
            )
            if (inferredCurrentAnswer && Object.keys(inferredCurrentAnswer).length > 0) {
              const inferredWithScoreTags = mergeTags(conversation.tags || [], inferredCurrentAnswer)
              const inferredVerdict = evaluateProductQualificationFlow({
                tags: inferredWithScoreTags,
                agent,
                incomingText,
              })
              const nextTags = mergeTags(inferredWithScoreTags, {
                lead_score: String(inferredVerdict.qualificationScore),
              })
              conversation.tags = nextTags
              await supabase.from('conversations').update({ tags: nextTags }).eq('id', conversation_id)
              log.info('premium qualification: inferred current answer tag before gate', {
                field: Object.keys(inferredCurrentAnswer)[0],
                value: Object.values(inferredCurrentAnswer)[0],
                score: inferredVerdict.qualificationScore,
              })
            }
            const deterministicPremiumVerdict = evaluateProductQualificationFlow({
              tags: conversation.tags || [],
              agent,
              incomingText,
            })
            const gate = evaluateQualificationGate({
              tags: conversation.tags || [],
              agent,
              incomingText,
            })
            if (gate.categoryId) {
              const answeredRuntimeKeys = new Set(
                (conversation.tags || [])
                  .filter((t: string): t is string => typeof t === 'string' && t.includes(':'))
                  .map((t: string) => t.slice(0, t.indexOf(':'))),
              )
              const tintasRuntimeField = gate.categoryId === 'tintas'
                ? ['objetivo', 'ambiente', 'aplicacao', 'tipo_tinta', 'cor', 'perfil']
                  .find((key) => !answeredRuntimeKeys.has(key))
                : ''
              if ((gate.readyToSearch && gate.mode === 'search' && !tintasRuntimeField) || (gate.categoryId === 'tintas' && !tintasRuntimeField)) {
                def = DISPATCH['produto']
                if (gate.categoryId === 'tintas') {
                  routerProductPreSearch = {
                    category: 'tintas',
                    query: 'tinta',
                  }
                }
                log.info('qualificationGate: score atingiu limiar → product_specialist (busca)', {
                  router_intent: routerResult.intent, category: gate.categoryId,
                  score: gate.score, search_ready_score: gate.searchReadyScore,
                })
              } else if (gate.mode === 'qualify' || tintasRuntimeField) {
                const premiumQualifyQuestions: Record<string, string> = {
                  objetivo: 'Essa tinta é para obra nova ou reforma?',
                  ambiente: 'O ambiente é interno ou externo?',
                  aplicacao: 'Você vai pintar paredes, teto, portas ou móveis?',
                  tipo_tinta: 'Você já sabe se prefere tinta acrílica, esmalte ou epóxi?',
                  cor: 'Qual cor você está procurando?',
                  perfil: 'Você prefere uma linha econômica, intermediária ou premium?',
                  aplicacao_revestimento: 'Me confirma só se é para piso ou parede?',
                  ambiente_revestimento: 'Vai ser para um ambiente residencial ou comercial?',
                  formato: 'Qual formato você prefere: 60x60, 90x90 ou 120x120?',
                  ambiente_torneira: 'Essa torneira gourmet vai ser para cozinha ou área gourmet?',
                  tipo_torneira: 'A instalação vai ser na bancada ou na parede?',
                  modelo_torneira: 'Você prefere o modelo com ducha flexível ou bica alta?',
                }
                const premiumQualifyField = tintasRuntimeField || deterministicPremiumVerdict.nextRequiredField?.key || ''
                const wantsPaintExplanation = premiumQualifyField === 'tipo_tinta' &&
                  /\bexplica|explicar|diferen[çc]a\b/i.test(incomingText)
                const premiumQualifyMsg = wantsPaintExplanation
                  ? 'Claro. Para paredes internas, a tinta acrílica costuma ser a mais indicada: cobre bem, seca rápido e tem baixo odor. Esmalte é mais usado em portas, grades e móveis, e epóxi é para áreas que precisam de muita resistência. Para o seu caso, eu seguiria com acrílica. Pode ser?'
                  : premiumQualifyQuestions[premiumQualifyField]
                if (
                  premiumQualifyMsg &&
                  gate.categoryId &&
                  ['tintas', 'revestimentos', 'porcelanatos_revestimentos', 'torneiras'].includes(gate.categoryId)
                ) {
                  // Bug 1 (loop-breaker, 2026-06-01): antes de RE-enviar a mesma pergunta
                  // determinística, checar se estamos presos. Se o lead pediu "o da foto" /
                  // item específico, ou se já re-perguntamos o MESMO campo >= max_qualification_retries
                  // sem resposta mapeável, transbordar em vez de repetir pra sempre.
                  const reaskState = getReaskState(conversation.tags || [])
                  const reaskGuard = evaluateQualifyReaskGuard({
                    lastAskedField: reaskState.field,
                    currentField: premiumQualifyField,
                    answerWasInferred: !!(inferredCurrentAnswer && Object.keys(inferredCurrentAnswer).length > 0),
                    specificItemRequested: detectSpecificItemRequest(incomingText),
                    reaskCount: reaskState.count,
                    maxRetries: agent.max_qualification_retries ?? 2,
                  })
                  if (reaskGuard.action === 'handoff') {
                    log.info('qualify loop-breaker → handoff forçado', {
                      category: gate.categoryId, field: premiumQualifyField,
                      reaskCount: reaskGuard.nextReaskCount, reason: reaskGuard.reason,
                    })
                    // limpa a tag de re-pergunta antes de transbordar (sessão encerra aqui)
                    const clearedReaskTags = (conversation.tags || []).filter(
                      (t: string) => !(typeof t === 'string' && t.startsWith('qualify_reask:')),
                    )
                    conversation.tags = clearedReaskTags
                    await supabase.from('conversations').update({ tags: clearedReaskTags }).eq('id', conversation_id)
                    const loopHandoffResult = await executeToolSafe('handoff_to_human', {
                      reason: reaskGuard.reason,
                      source: 'qualify_loop_breaker',
                    })
                    return new Response(JSON.stringify({
                      ok: true, handoff: true, reason: 'qualify_loop_breaker',
                      result: String(loopHandoffResult).slice(0, 200),
                    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
                  }
                  // ask: persiste o contador de re-pergunta DESTE campo
                  const reaskTags = mergeTags(
                    (conversation.tags || []).filter(
                      (t: string) => !(typeof t === 'string' && t.startsWith('qualify_reask:')),
                    ),
                    { [`qualify_reask:${premiumQualifyField}`]: String(reaskGuard.nextReaskCount) },
                  )
                  conversation.tags = reaskTags
                  await supabase.from('conversations').update({ tags: reaskTags }).eq('id', conversation_id)
                  await sendTextMsg(premiumQualifyMsg)
                  await supabase.from('conversation_messages').insert({
                    conversation_id,
                    direction: 'outgoing',
                    content: premiumQualifyMsg,
                    media_type: 'text',
                  })
                  broadcastEvent({ conversation_id, inbox_id: conversation.inbox_id, direction: 'outgoing', content: premiumQualifyMsg, media_type: 'text' })
                  await supabase.from('ai_agent_logs').insert({
                    agent_id,
                    conversation_id,
                    event: 'response_sent',
                    model: 'deterministic-premium-flow',
                    latency_ms: Date.now() - startTime,
                    metadata: {
                      source: 'premium_pre_search_next_question',
                      next_field: premiumQualifyField,
                      reask_count: reaskGuard.nextReaskCount,
                      response_text: premiumQualifyMsg,
                    },
                  })
                  return new Response(JSON.stringify({
                    ok: true,
                    response: premiumQualifyMsg,
                    reason: 'premium_pre_search_next_question',
                  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
                }
                def = buildQualificationSpecialistDef(agent.specialist_model || DEFAULT_SPECIALIST_MODEL)
                routerProductPreSearch = null
                log.info('qualificationGate: qualify-first → qualification_specialist', {
                  router_intent: routerResult.intent, category: gate.categoryId,
                  score: gate.score, search_ready_score: gate.searchReadyScore, reason: gate.reason,
                })
              } else if (gate.mode === 'qualify_then_handoff') {
                // v7.58: offline ("vendemos, mas não está no catálogo digital") → QUALIFICAÇÃO
                // PROFUNDA via qualification_specialist (NÃO product+pré-busca: o searchGuard
                // bloqueia offline e o product specialist lançava erro nesse contexto → lead
                // ficava mudo). Marca enriching + enrich_count:1; o pré-router conduz o loop de
                // perguntas e transborda ao atingir max_enrichment_questions, com resumo rico.
                // Substitui o atalho v7.55 (1 pergunta + handoff) que o dono reprovou — agora é
                // idêntico ao 21.36: o lead NUNCA percebe a ausência e é qualificado a fundo.
                def = buildQualificationSpecialistDef(agent.specialist_model || DEFAULT_SPECIALIST_MODEL)
                routerProductPreSearch = null
                noResultDirective = buildEnrichDirective()
                if (!(conversation.tags || []).some(
                  (t: string) => typeof t === 'string' && t.startsWith('enriching:'),
                )) {
                  const offlineTags = mergeTags(conversation.tags || [], {
                    enriching: '1',
                    enrich_count: '1',
                    questions_after_empty: '1',
                    catalog_result: 'empty',
                    physical_stock_required: 'true',
                    flow_mode: 'qualify_then_handoff',
                  })
                  conversation.tags = offlineTags
                  await supabase.from('conversations').update({ tags: offlineTags }).eq('id', conversation_id)
                }
                log.info('qualificationGate: offline → qualificação profunda (qualification_specialist)', {
                  router_intent: routerResult.intent, category: gate.categoryId, catalog_status: gate.catalogStatus,
                })
              }
            }
          }

          // ── Pós-nome com interesse premium semeado (fix 21.36 defeito turno-2) ──
          // Quando o 1º contato já trouxe um PRODUTO ("porcelanato marmorizado") e a IA
          // pediu o nome, o interesse foi semeado deterministicamente na saudação. No
          // turno seguinte (o nome) o router classifica 'saudacao' → greeting specialist,
          // que devolvia um "o que você procura?" GENÉRICO — como se não tivesse ouvido o
          // produto. Aqui, quando há interesse premium semeado, funil pré-busca ainda
          // intocado (nenhum campo respondido) e o nome já é conhecido, retomamos direto o
          // qualification_specialist (que cumprimenta pelo nome e JÁ faz a 1ª pergunta do
          // funil). Guard estreito: não dispara em saudação pura sem interesse premium.
          if (routerResult.intent === 'saudacao' && (leadName || capturedLeadName)) {
            const seedVerdict = evaluateProductQualificationFlow({
              tags: conversation.tags || [], agent, incomingText,
            })
            // Qualquer categoria RESOLVIDA com o funil ainda intocado (nenhum campo
            // respondido) — robusto pra qualquer id (revestimentos/porcelanatos_revestimentos/
            // torneiras/torneiras_metais/tintas/...), não uma lista hardcoded que divergia
            // entre a config do agent e o DEFAULT (caso torneiras vs torneiras_metais).
            if (seedVerdict.categoryId && seedVerdict.nextRequiredField && seedVerdict.answeredFieldKeys.length === 0) {
              def = buildQualificationSpecialistDef(agent.specialist_model || DEFAULT_SPECIALIST_MODEL)
              log.info('saudacao + interesse premium semeado → qualification_specialist (retoma funil pós-nome)', {
                category: seedVerdict.categoryId, nextField: seedVerdict.nextRequiredField.key,
              })
            }
          }

          // ── Onda 2 item 4 (2026-06-12): exit_action=handoff é AUTORIDADE ──────
          // O motor determinístico concluiu a qualificação (auto-extract atingiu o
          // max_score de um stage com exit_action=handoff). Antes esse sinal era
          // descartado sob router; agora vence QUALQUER classificação do router/gate:
          // força o handoff_specialist com diretiva explícita no prompt. Defesa em
          // camadas: (a) o specialist chama handoff_to_human com resumo rico; (b) se
          // o LLM só verbalizar, pendingHandoffTrigger faz o step 22 do dispatch
          // EXECUTAR o transbordo real (fila + shadow + msg). Guard de tag DURÁVEL
          // (handoffAlreadyCreated) impede re-transbordo (feedback_guard_must_check_durable_tags).
          // Roda DEPOIS do no-result loop (que sempre retorna Response) e dos overrides
          // do gate — qualificação completa fecha o ciclo, não reabre pergunta.
          let exitActionDirective: string | null = null
          if (routerExitActionHandoff && !handoffAlreadyCreated) {
            def = buildHandoffSpecialistDef()
            exitActionDirective = [
              '[QUALIFICAÇÃO COMPLETA — AÇÃO OBRIGATÓRIA NESTE TURNO]',
              `O sistema determinístico concluiu a qualificação desta categoria (pedido: ${routerExitActionHandoff.reason}).`,
              'Confirme ao lead, em 1 frase calorosa, que o vendedor vai assumir agora e chame handoff_to_human com o resumo completo (itens + qualificações coletadas + nome/cidade se souber).',
              'NÃO faça mais perguntas de qualificação e NÃO busque produto.',
            ].join('\n')
            if (!pendingHandoffTrigger) {
              pendingHandoffTrigger = 'exit_action_qualificacao_completa'
              pendingHandoffTriggerMsg = incomingText
            }
            log.info('exit-action handoff honrado sob router → handoff_specialist forçado', {
              router_intent: routerResult.intent, reason: routerExitActionHandoff.reason,
            })
          }

          // D6 (2026-07-25): routing_mode='shadow' aposentado junto com o monolito
          // (o modo só existia pra medir o router ANTES da migração, com o monolito
          // respondendo — sem monolito não há o que sombrear).
          if (def) {
            let dispatchDef = def
            log.info(`Dispatching to ${dispatchDef.name}_specialist (hop 1)`, { intent: routerResult.intent })

            // ── Latência (2026-05-24): pré-busca determinística do product specialist ──
            // Turnos de produto com search gastavam 2 rounds de LLM (decidir buscar →
            // compor). Aqui buscamos ANTES do specialist (mesma máquina R121 do monolith)
            // e injetamos o resultado como preSearchContext → o specialist responde em
            // 1 round (~8-10s → ~4-5s). Carrossel é enviado UMA vez pela pré-busca; se o
            // LLM tentar search_products de novo, carouselSentInThisCall retorna "JÁ
            // ENVIADO" (idempotente). Só roda pro product specialist, fora de SHADOW, e
            // quando o lead ainda não recebeu produtos (deriveProductSearchParams decide).
            let preSearchContext = ''
            if (dispatchDef.name === 'product' && conversation.status_ia !== STATUS_IA.SHADOW) {
              const searchParams = deriveProductSearchParams({
                incomingText,
                tags: conversation.tags || [],
                agent,
                pendingSearch: routerProductPreSearch,
              })
              if (searchParams) {
                try {
                  const inlineSearch = await runInlineSearchProducts({
                    supabase, conversation, conversation_id, agent_id, executeToolSafe,
                  }, searchParams, log)
                  preSearchContext = inlineSearch.inlineSearchContext
                  if (inlineSearch.toolCall) toolCallsLog.push(inlineSearch.toolCall)
                  if (/sem resultados/i.test(preSearchContext)) {
                    const currentEmptyState = readProductQualificationState(conversation.tags || [])
                    const nextEmptyCount = (currentEmptyState.questionsAfterEmpty || 0) + 1
                    conversation.tags = mergeTags(conversation.tags || [], {
                      enrich_count: String(nextEmptyCount),
                      questions_after_empty: String(nextEmptyCount),
                      search_fail: '1',
                      enriching: '1',
                      catalog_result: 'empty',
                      physical_stock_required: 'true',
                      flow_mode: 'qualify_then_handoff',
                    })
                    const premiumAfterEmpty = evaluateProductQualificationFlow({
                      tags: conversation.tags || [],
                      agent,
                      incomingText,
                      catalogResult: 'empty',
                      maxQuestionsAfterEmpty: maxEnrichNow,
                    })
                    const nextRequired = premiumAfterEmpty.nextRequiredField
                      ? `${premiumAfterEmpty.nextRequiredField.key} (${premiumAfterEmpty.nextRequiredField.label}; exemplos: ${premiumAfterEmpty.nextRequiredField.examples || 'sem exemplos'})`
                      : 'nenhum'
                    preSearchContext = [
                      preSearchContext,
                      '[INTERNO] A busca do catalogo digital retornou 0 resultados. Isto e interno e nunca deve ser dito ao lead.',
                      `[INTERNO] Proximo campo obrigatorio: ${nextRequired}.`,
                      '[INTERNO] Neste turno, NAO mostre produtos, NAO diga que vai verificar com consultor e NAO faca handoff.',
                      '[INTERNO] Faca somente uma pergunta curta sobre o proximo campo obrigatorio.',
                    ].join('\n')
                    dispatchDef = buildQualificationSpecialistDef(agent.specialist_model || DEFAULT_SPECIALIST_MODEL)
                  }
                  log.info('Product pre-search done (1-round path)', {
                    query: searchParams.query, category: searchParams.category,
                    has_context: !!preSearchContext,
                    redirected_to: dispatchDef.name,
                  })
                } catch (err) {
                  // Não-fatal: sem pré-busca, o specialist cai no caminho de 2 rounds.
                  log.warn?.('Product pre-search failed (non-fatal, specialist will search)', {
                    error: (err as Error).message,
                  })
                }
              }
            }

            const specialistCtx: SpecialistCtx = {
              turn_id,
              agent, agent_id, conversation, conversation_id, contact,
              serviceCategories,
              geminiContents,
              incomingText,
              toolCallsLog,
              executeToolSafe,
              profileData, funnelData,
              leadProfile: leadProfile || (capturedLeadName ? { full_name: capturedLeadName } : null),
              incomingHasAudio,
              queuedMessages: queuedMessages || [],
              pendingHandoffTrigger,
              pendingHandoffTriggerMsg,
              sendTextMsg, sendTts, sendPresence, broadcastEvent,
              pickHandoffMessage, runQueueAssignment,
              hasInteracted,
              hasEverInteracted,
              // Double-ask guard (2026-05-26): greeting determinístico já enviou
              // boas-vindas + pedido de nome NESTE turno (chegamos aqui só quando NÃO
              // era saudação pura — isJustGreeting retorna antes). Specialist não repete.
              greetingSentThisTurn: greetingBlockEntered,
              startTime,
              supabase, log, corsHeaders,
              preSearchContext: (preSearchContext || noResultDirective) || undefined,
              exitActionDirective: exitActionDirective || undefined,
            }
            const specialistResult = await runSpecialist(specialistCtx, dispatchDef)

            // Bug 4 fix (v7.43.2): falha catastrófica do LLM → return null
            // (não retorna 502 ao webhook; D6: index faz transbordo gracioso).
            if (specialistResult.errorResponse) {
              log.error?.('Specialist failed catastrophically — null → transbordo gracioso (D6)', {
                specialist: dispatchDef.name, error: specialistResult.errorMessage || 'unknown',
              })
            } else {
              log.info(`Router pipeline END (${dispatchDef.name}_specialist)`, {
                intent: routerResult.intent,
                input_tokens: specialistResult.inputTokens,
                output_tokens: specialistResult.outputTokens,
                prompt_chars: specialistResult.promptChars,
              })
              return specialistResult.response as Response
            }
          } else {
            log.warn('Router: intent sem specialist mapeado — null → transbordo gracioso (D6)', { intent: routerResult.intent })
          }
        }
      } catch (err) {
        log.error?.('Router pipeline error — null → transbordo gracioso (D6)', { error: (err as Error).message })
      }
    }
    return null // D6: index responde a null com transbordo gracioso (sem monolito)
  }

  const response = await run()
  return { response, pendingHandoffTrigger, pendingHandoffTriggerMsg }
}
