/**
 * Sprint B5 Onda 3d — Tools set_tags + handoff_to_human (HIGH RISK).
 *
 * Estes 2 handlers viram, no Sprint C:
 *   - set_tags        → qualif_specialist (boundary: qualificação/tagueamento do lead)
 *   - handoff_to_human → handoff_specialist (boundary: transbordo + queue assignment)
 *
 * Pipeline preservado linha-a-linha do monolito. Sem mudança de comportamento.
 *
 * Mutações de estado externo (controladas via refs no ctx):
 *   - pendingState.exitActionHandoff     (set quando stage=handoff)
 *   - pendingState.exitActionSearch      (set quando stage=search_products)
 *   - pendingState.forcedNextQuestion    (set quando R130 dispara)
 *   - conversation.tags / .status_ia     (set pela tool de handoff inline + handoff normal)
 *   - toolCallsLog.push(...)             (pseudo-tool-calls pra hadExplicitHandoffInLoop detectar)
 */

import { STATUS_IA } from '../../constants.ts'
import { mergeTags } from '../../agentHelpers.ts'
import { isOutsideBusinessHours, personalizeHandoffMessage, buildDeliveryLine } from '../../businessHours.ts'
import { normalizeCart, formatCartOneLine, formatCartSummary } from '../cart.ts'
import { buildPremiumHandoffSummary } from '../handoffSummary.ts'
import { evaluateProductQualificationFlow } from '../productQualificationFlow.ts'
import { validateSetTagsInput, validateInteresseCategory } from '../../setTagsValidator.ts'
import {
  getCategoriesOrDefault,
  matchCategory,
  matchCategoryBySearchText,
  extractInteresseFromTags,
  getCurrentStage,
  getScoreFromTags,
  getNextField,
  calculateScoreDelta,
  buildValidTagKeys,
  formatPhrasing,
} from '../../serviceCategories.ts'
import {
  shouldBlockHandoffForPayment,
} from '../../handoffGuard.ts'
import type { Logger } from '../context.ts'
import type { AssignHandoffResult } from '../../handoffQueue.ts'

// =============================================================================
// Tipos públicos
// =============================================================================

export interface PendingExitActionHandoff {
  reason: string
  queueMotivo: string
}
export interface PendingExitActionSearch {
  query: string
  category: string
}
export interface PendingForcedNextQuestion {
  text: string
  category: string
  fieldKey: string
}

export interface PendingStateRefs {
  exitActionHandoff: PendingExitActionHandoff | null
  exitActionSearch: PendingExitActionSearch | null
  forcedNextQuestion: PendingForcedNextQuestion | null
}

export type SendTextMsgFn = (text: string) => Promise<void | boolean>
export type BroadcastEventFn = (evt: Record<string, any>) => void
export type PickHandoffMessageFn = (opts: {
  agent: any
  profileData: any
  funnelData: any
  outsideHours: boolean
}) => string
export type RunQueueAssignmentFn = (
  handoffMessageTemplate: string,
) => Promise<{ result: AssignHandoffResult; finalMessage: string }>
export type ExecuteToolSafeFn = (name: string, args: Record<string, any>) => Promise<string>
export type BuildQualificationChainFn = (
  tags: string[],
  pendingTags: Record<string, string>,
  name: string | null,
) => string

export interface ToolCallLogEntry {
  name: string
  args?: any
  result?: string
}

export interface SetTagsAndHandoffCtx {
  supabase: any
  agent: Record<string, any>
  agent_id: string
  conversation: {
    tags?: string[] | null
    status_ia?: string | null
    inbox_id?: string | null
  } & Record<string, any>
  conversation_id: string
  contact: { id: string; name?: string | null } & Record<string, any>
  incomingText: string
  leadName: string | null
  contextMessages: Array<{ direction?: string; content?: string }> | null
  availableLabels: Array<{ id: string; name: string }> | null
  profileData: { handoff_department_id?: string | null } | null
  funnelData: { handoff_department_id?: string | null } | null
  leadProfile: { id?: string | null } | null
  /** Mutable refs — function mutates these */
  pendingState: PendingStateRefs
  toolCallsLog: ToolCallLogEntry[]
  startTime: number
  /** Callbacks */
  sendTextMsg: SendTextMsgFn
  broadcastEvent: BroadcastEventFn
  pickHandoffMessage: PickHandoffMessageFn
  runQueueAssignment: RunQueueAssignmentFn
  executeToolSafe: ExecuteToolSafeFn
  buildQualificationChain: BuildQualificationChainFn
}

// =============================================================================
// set_tags
// =============================================================================

export async function setTags(
  args: Record<string, any>,
  ctx: SetTagsAndHandoffCtx,
  log: Logger,
): Promise<string> {
  const {
    supabase,
    agent,
    agent_id,
    conversation,
    conversation_id,
    contextMessages,
    incomingText,
    leadProfile,
    pendingState,
    toolCallsLog,
    startTime,
    sendTextMsg,
    broadcastEvent,
    pickHandoffMessage,
    runQueueAssignment,
    executeToolSafe,
  } = ctx
  const { profileData, funnelData } = ctx

  const rawTags: string[] = args.tags || []
  if (rawTags.length === 0) return 'Nenhuma tag informada.'

  // R127 (2026-05-20): guard determinístico ANTES do processing.
  const dupValidation = validateSetTagsInput(rawTags)
  if (dupValidation.hasDuplicateKeys) {
    await supabase.from('ai_agent_logs').insert({
      agent_id,
      conversation_id,
      event: 'set_tags_duplicate_keys_rejected',
      metadata: {
        raw_tags: rawTags,
        duplicates: dupValidation.duplicates,
        cleaned_tags: dupValidation.cleanedTags,
      },
    })
    log.info('R127: set_tags duplicate keys rejected', {
      raw_tags: rawTags,
      duplicates: dupValidation.duplicates,
    })
    if (dupValidation.cleanedTags.length === 0) {
      return dupValidation.message
    }
    args.tags = dupValidation.cleanedTags
  }
  // eslint-disable-next-line prefer-const — pode ser reassign pelo R144 auto-correct
  let sanitizedRawTags: string[] = args.tags || rawTags

  // FIX (2026-04-29): aliasing automático de keys genéricas pra sufixadas da categoria.
  const aliasInteresse = extractInteresseFromTags(conversation.tags || [])
  const aliasConfig = getCategoriesOrDefault(agent)
  const aliasCategory = matchCategory(aliasInteresse, aliasConfig)

  // Sprint A I2 (2026-05-21, Bug 12 fix): valida interesse:VALUE ∈ category.id.
  // R144 (2026-05-22): auto-correct singular/plural/regex/levenshtein-1 antes
  // de bloquear. Caso Jessica — LLM tentava interesse:porta 4× eternamente.
  {
    const categoriesArr = Array.isArray((aliasConfig as any)?.categories)
      ? (aliasConfig as any).categories
      : []
    const validCategoryIds = categoriesArr
      .map((c: any) => String(c?.id || '').trim().toLowerCase())
      .filter(Boolean)
    const interesseValidation = validateInteresseCategory(
      sanitizedRawTags,
      validCategoryIds,
      categoriesArr,
    )
    if (!interesseValidation.ok) {
      await supabase.from('ai_agent_logs').insert({
        agent_id,
        conversation_id,
        event: 'interesse_hallucination_blocked',
        metadata: {
          invalid_tag: interesseValidation.invalidTag,
          valid_category_ids: validCategoryIds,
          raw_tags: sanitizedRawTags,
          source: 'i2_category_id_check',
        },
      })
      log.info('I2: interesse value not in agent categories', {
        invalid: interesseValidation.invalidTag,
        valid_ids: validCategoryIds,
      })
      return interesseValidation.message
    }
    // R144: aplica auto-correct quando ok=true mas tags foram substituídas
    if (interesseValidation.autoCorrected && interesseValidation.correctedTags) {
      sanitizedRawTags = interesseValidation.correctedTags
      await supabase.from('ai_agent_logs').insert({
        agent_id,
        conversation_id,
        event: 'auto_field_extracted',
        metadata: {
          source: 'R144_interesse_auto_correct',
          corrections: interesseValidation.autoCorrected,
          valid_category_ids: validCategoryIds,
        },
      })
      log.info('R144: interesse auto-corrected', {
        corrections: interesseValidation.autoCorrected,
      })
    }
  }

  // #25 + R84 (2026-04-30): Enforcement de keys/motivo/objecao.
  const VALID_KEYS = buildValidTagKeys(aliasConfig)
  const VALID_MOTIVOS = new Set([
    'saudacao', 'compra', 'troca', 'orcamento', 'duvida_tecnica', 'suporte',
    'financeiro', 'emprego', 'fornecedor', 'informacao', 'fora_escopo',
  ])
  const VALID_OBJECOES = new Set([
    'preco', 'concorrencia', 'concorrente', 'prazo', 'indecisao', 'qualidade',
    'confianca', 'necessidade', 'outro', 'frete', 'comparando', 'sem_urgencia',
  ])
  const aliasMap = new Map<string, string>()
  if (aliasCategory) {
    for (const stage of aliasCategory.stages) {
      for (const field of stage.fields) {
        const parts = field.key.split('_')
        if (parts.length >= 2 && !aliasMap.has(parts[0])) {
          aliasMap.set(parts[0], field.key)
        }
        aliasMap.set(field.key, field.key)
      }
    }
  }

  const newTags: string[] = []
  const rejected: string[] = []
  for (const rawTag of sanitizedRawTags) {
    const [rawKey, ...rest] = rawTag.split(':')
    const value = rest.join(':')
    if (!rawKey || !value) {
      rejected.push(rawTag)
      continue
    }

    const resolvedKey = aliasMap.get(rawKey) || rawKey
    const tag = `${resolvedKey}:${value}`
    const key = resolvedKey

    if (!VALID_KEYS.has(key)) {
      rejected.push(rawTag)
      log.warn('Tag rejected: invalid key', { rawTag, resolvedKey })
      continue
    }
    if (key === 'motivo' && !VALID_MOTIVOS.has(value)) {
      rejected.push(rawTag)
      log.warn('Tag rejected: invalid motivo', { tag })
      continue
    }
    if (key === 'objecao' && !VALID_OBJECOES.has(value)) {
      rejected.push(rawTag)
      log.warn('Tag rejected: invalid objecao', { tag })
      continue
    }
    // R114 v2 + R115: regex determinístico já tagged essas keys pra essa msg.
    const PROTECTED_DETERMINISTIC_KEYS = ['objecao', 'pagamento', 'marca_citada', 'tipo_cliente']
    if (
      PROTECTED_DETERMINISTIC_KEYS.includes(key) &&
      (conversation.tags || []).some((t: string) => t.startsWith(`${key}:`))
    ) {
      rejected.push(rawTag)
      log.info('Tag rejected: deterministic key already set', { rawTag, key })
      continue
    }
    // Bug 19 (2026-05-17): Anti-hallucination guard para interesse:CAT.
    let interesseCanonicalSlug: string | null = null
    if (key === 'interesse') {
      const targetCat = matchCategory(value, aliasConfig)
      if (targetCat) interesseCanonicalSlug = targetCat.id
      // Bug 25 (2026-05-17): categoria INEXISTENTE no schema.
      if (!targetCat) {
        rejected.push(rawTag)
        log.warn('Tag rejected: interesse references nonexistent category', { rawTag, value })
        const { error: logErr25 } = await supabase.from('ai_agent_logs').insert({
          agent_id,
          conversation_id,
          event: 'interesse_hallucination_blocked',
          metadata: {
            tag: rawTag,
            category_id: value,
            reason: 'category_not_in_schema',
            lead_msg_count: ((conversation as any)?.lead_msg_count ?? 0),
          },
        })
        if (logErr25) log.warn('Bug 25 log insert failed (non-fatal)', { error: logErr25.message })
        continue
      }
      if (targetCat.interesse_match) {
        try {
          const reCheck = new RegExp(targetCat.interesse_match, 'i')
          const allIncoming = (contextMessages || [])
            .filter((m: any) => m && m.direction === 'incoming')
            .map((m: any) => String(m.content || ''))
            .join(' ')
          const corpus = `${allIncoming} ${incomingText || ''}`.toLowerCase()
          if (!reCheck.test(corpus)) {
            rejected.push(rawTag)
            log.warn('Tag rejected: interesse hallucinated (no keyword match in lead history)', {
              rawTag,
              regex: targetCat.interesse_match,
            })
            const { error: logErr } = await supabase.from('ai_agent_logs').insert({
              agent_id,
              conversation_id,
              event: 'interesse_hallucination_blocked',
              metadata: {
                tag: rawTag,
                category_id: value,
                regex: targetCat.interesse_match,
                reason: 'regex_no_match',
                lead_msg_count: ((conversation as any)?.lead_msg_count ?? 0),
                corpus_preview: corpus.substring(0, 200),
              },
            })
            if (logErr) log.warn('Bug 19 log insert failed (non-fatal)', { error: logErr.message })
            continue
          }
        } catch (regexErr) {
          log.warn('Bug 19 interesse regex test failed (non-fatal)', {
            error: (regexErr as Error).message,
          })
        }
      }
    }
    // R117 (2026-05-19): normaliza `interesse:<singular|sinônimo>` para o slug canônico
    let finalTag = tag
    if (key === 'interesse' && interesseCanonicalSlug && interesseCanonicalSlug !== value) {
      finalTag = `interesse:${interesseCanonicalSlug}`
      log.info('Tag normalized: interesse value -> canonical slug', { from: tag, to: finalTag })
    }
    // R118 (2026-05-19): guard `marca_preferida:X` — value DEVE aparecer em alguma incoming
    if (key === 'marca_preferida') {
      const allIncoming = (contextMessages || [])
        .filter((m: any) => m && m.direction === 'incoming')
        .map((m: any) => String(m.content || ''))
        .join(' ')
      const corpus = `${allIncoming} ${incomingText || ''}`.toLowerCase()
      const valueNorm = String(value).toLowerCase().trim()
      if (valueNorm && !corpus.includes(valueNorm)) {
        rejected.push(rawTag)
        log.warn('Tag rejected: marca_preferida hallucinated (not in lead history)', {
          rawTag,
          value,
        })
        await supabase
          .from('ai_agent_logs')
          .insert({
            agent_id,
            conversation_id,
            event: 'marca_preferida_hallucination_blocked',
            metadata: {
              tag: rawTag,
              value,
              reason: 'value_not_in_lead_history',
              corpus_preview: corpus.substring(0, 200),
            },
          })
          .then((r: { error?: { message?: string } }) => {
            if (r.error) log.warn('R118 log insert failed (non-fatal)', { error: r.error.message })
          })
        continue
      }
    }
    if (rawKey !== resolvedKey) log.info('Tag aliased', { from: rawTag, to: finalTag })
    newTags.push(finalTag)
  }

  // Bug 26 v3 (2026-05-17): auto-apply categoria correta após rejeição interesse.
  const rejInteresse = rejected.find((r: string) => r.startsWith('interesse:'))
  const jaTemInteresse = (conversation.tags || []).some((t: string) => t.startsWith('interesse:'))
  if (rejInteresse && !jaTemInteresse) {
    try {
      const cfg26 = getCategoriesOrDefault(agent)
      const corpus26 = `${incomingText || ''}`.toLowerCase()
      const matched26 = matchCategoryBySearchText(corpus26, cfg26)
      if (matched26) {
        const autoTag26 = `interesse:${matched26.id}`
        newTags.unshift(autoTag26)
        await supabase.from('ai_agent_logs').insert({
          agent_id,
          conversation_id,
          event: 'auto_field_extracted',
          metadata: {
            source: 'bug26_auto_apply_correct_category',
            new_tags: [autoTag26],
            category_id: matched26.id,
            rejected_tag: rejInteresse,
          },
        })
        log.info('Bug 26 v3: auto-apply categoria correta apos rejeicao', { rejInteresse, autoTag26 })
      }
    } catch {
      /* non-fatal */
    }
  }

  if (newTags.length === 0) {
    return `Nenhuma tag válida. Rejeitadas: ${rejected.join(', ')}. IDs válidos: ${getCategoriesOrDefault(agent)
      .categories.slice(0, 10)
      .map((c: any) => c.id)
      .join(', ')}.`
  }

  // M19-S10 v2: score progressivo
  let exitInstruction = ''
  try {
    const interesse = extractInteresseFromTags(conversation.tags || [])
    const v2Config = getCategoriesOrDefault(agent)
    const v2Category = matchCategory(interesse, v2Config)
    const scoreDelta = calculateScoreDelta(newTags, v2Category, v2Config.default)

    if (scoreDelta > 0) {
      const currentScore = getScoreFromTags(conversation.tags || [])
      const newScore = Math.min(100, currentScore + scoreDelta)
      newTags.push(`lead_score:${newScore}`)

      // Persiste em lead_score_history (fire-and-forget) se temos lead_profile
      if (leadProfile?.id) {
        const stage = getCurrentStage(newScore, v2Category, v2Config.default)
        const matchedField = stage.fields.find((f: any) => newTags.some((t) => t.startsWith(`${f.key}:`)))
        supabase
          .rpc('add_lead_score_event', {
            _lead_id: leadProfile.id,
            _agent_id: agent_id,
            _conversation_id: conversation_id,
            _score_delta: scoreDelta,
            _category_id: v2Category?.id || 'default',
            _stage_id: stage.id,
            _field_key: matchedField?.key || null,
          })
          .then(({ error: e }: { error: any }) => {
            if (e) log.warn('add_lead_score_event failed', { error: e.message })
          })
      }

      // FIX (2026-04-29): se score atingiu max_score do stage, instruir LLM a executar exit_action.
      const currentStage = getCurrentStage(newScore, v2Category, v2Config.default)
      if (newScore >= currentStage.max_score) {
        const qualSummary = newTags
          .filter((t) => !t.startsWith('lead_score:') && !t.startsWith('motivo:') && !t.startsWith('interesse:'))
          .map((t) => t.replace(/_/g, ' '))
          .join(', ')
        if (currentStage.exit_action === 'handoff') {
          exitInstruction = ` [INTERNO — NÃO mostre isso ao lead] Stage "${currentStage.label}" COMPLETO (score ${newScore}/${currentStage.max_score}). AÇÃO: chame handoff_to_human AGORA com motivo="${interesse || 'qualificacao'} ${qualSummary}". Diga algo como "Vou te conectar com nosso consultor de vendas!" PROIBIDO: dizer "não temos", "não trabalhamos", "não encontrei". PROIBIDO fazer mais perguntas — handoff é obrigatório.`
          // Bug 24 v2 (2026-05-17): tambem dispara flag pra handoff direto no codigo apos a tool.
          if (conversation.status_ia !== STATUS_IA.SHADOW) {
            pendingState.exitActionHandoff = {
              reason: `${interesse || currentStage.label} > ${qualSummary}`,
              queueMotivo: `${v2Category?.label || currentStage.label} — ${qualSummary}`,
            }
          }
        } else if (currentStage.exit_action === 'search_products') {
          exitInstruction = ` [INTERNO — NÃO mostre isso ao lead] Stage "${currentStage.label}" COMPLETO (score ${newScore}/${currentStage.max_score}). AÇÃO: chame search_products AGORA com a query construída a partir das tags coletadas. NÃO faça mais perguntas antes de buscar.`
          if (conversation.status_ia !== STATUS_IA.SHADOW && !pendingState.exitActionSearch) {
            const META_KEYS = new Set([
              'motivo', 'interesse', 'lead_score', 'ia', 'ia_cleared', 'enrich_count',
              'search_fail', 'produto', 'aguardando_upsell', 'venda', 'tipo_cliente',
              'marca_citada', 'objecao', 'pagamento',
            ])
            const queryParts: string[] = []
            if (interesse) queryParts.push(interesse)
            for (const t of [...(conversation.tags || []), ...newTags]) {
              if (typeof t !== 'string') continue
              const idx = t.indexOf(':')
              if (idx < 0) continue
              const k = t.slice(0, idx)
              const v = t.slice(idx + 1)
              if (META_KEYS.has(k)) continue
              if (v && !queryParts.some((p) => p.toLowerCase().includes(v.toLowerCase())))
                queryParts.push(v)
            }
            pendingState.exitActionSearch = {
              query: queryParts.join(' ').trim(),
              category: interesse || v2Category?.id || '',
            }
          }
        } else if (currentStage.exit_action === 'enrichment') {
          exitInstruction = ` [INTERNO — NÃO mostre isso ao lead] Stage "${currentStage.label}" COMPLETO. AÇÃO: continue perguntando para enriquecer dados (próximo stage do funil).`
        }
        log.info('Stage exit triggered', {
          stage: currentStage.label,
          score: newScore,
          max: currentStage.max_score,
          exit_action: currentStage.exit_action,
          pendingExitActionHandoff: !!pendingState.exitActionHandoff,
        })
      }
    }
  } catch (scoreErr) {
    log.warn('score progression hook failed', { error: (scoreErr as Error).message })
  }

  // Atomic merge via RPC + fallback
  const { data: updatedConv, error: rpcError } = await supabase.rpc('merge_conversation_tags', {
    p_conversation_id: conversation_id,
    p_new_tags: newTags,
  })
  let merged: string[]
  if (rpcError) {
    log.warn('merge_conversation_tags RPC failed, using in-memory fallback', {
      error: rpcError.message,
    })
    const existing: string[] = conversation.tags || []
    const tagMap = new Map<string, string>()
    for (const t of existing) tagMap.set(t.split(':')[0], t)
    for (const t of newTags) tagMap.set(t.split(':')[0], t)
    merged = Array.from(tagMap.values())
    await supabase.from('conversations').update({ tags: merged }).eq('id', conversation_id)
  } else {
    merged = updatedConv?.tags || [...(conversation.tags || []), ...newTags]
  }
  conversation.tags = merged

  // R129 (2026-05-21): remove multi_interesse_pending: após lead escolher interesse.
  if (
    newTags.some((t) => t.startsWith('interesse:')) &&
    merged.some((t) => t.startsWith('multi_interesse_pending:'))
  ) {
    const cleaned = merged.filter((t) => !t.startsWith('multi_interesse_pending:'))
    await supabase.from('conversations').update({ tags: cleaned }).eq('id', conversation_id)
    conversation.tags = cleaned
    merged = cleaned
    log.info('R129: multi_interesse_pending removed after lead choice', {
      chosen_interesse: newTags.find((t) => t.startsWith('interesse:')),
    })
  }

  // R130 (2026-05-21): pendingForcedNextQuestion após interesse novo
  const newInteresseTag = newTags.find((t) => t.startsWith('interesse:'))
  if (newInteresseTag) {
    try {
      const newInteresseValue = newInteresseTag.slice('interesse:'.length)
      const cfgNext = getCategoriesOrDefault(agent)
      const catNext = matchCategory(newInteresseValue, cfgNext)
      if (catNext) {
        const scoreNext = getScoreFromTags(merged)
        const stageNext = getCurrentStage(scoreNext, catNext, cfgNext.default)
        const nextFieldNext = getNextField(stageNext, merged)
        if (nextFieldNext) {
          const answeredKeysInStageNext = new Set(
            merged
              .filter((t): t is string => typeof t === 'string' && t.includes(':'))
              .map((t) => t.slice(0, t.indexOf(':'))),
          )
          const answeredCountInStageNext = stageNext.fields.filter((f: any) =>
            answeredKeysInStageNext.has(f.key),
          ).length
          const phrasingNext = formatPhrasing(
            stageNext.phrasing,
            nextFieldNext,
            answeredCountInStageNext,
          )
          exitInstruction =
            (exitInstruction || '') +
            ` [INTERNO — REGRA ABSOLUTA] Categoria atual: "${catNext.id}". ` +
            `Próximo field: "${nextFieldNext.label}" (key: ${nextFieldNext.key}). ` +
            `FRASE EXATA pra usar: "${phrasingNext}". ` +
            `NÃO invente outras perguntas. NÃO use send_poll. ` +
            `Os ÚNICOS fields válidos de "${catNext.id}" são: ${stageNext.fields.map((f: any) => f.key).join(', ')}.`
          pendingState.forcedNextQuestion = {
            text: phrasingNext,
            category: catNext.id,
            fieldKey: nextFieldNext.key,
          }
          log.info('R130: pendingForcedNextQuestion setada', {
            categoria: catNext.id,
            next_field: nextFieldNext.key,
            phrasing: phrasingNext,
          })
        }
      }
    } catch (r130err) {
      log.warn('R130: failed to set forcedNextQuestion', { error: (r130err as Error).message })
    }
  }

  // Bug 24 v3+v4: handoff inline quando exitActionHandoff setado
  if (pendingState.exitActionHandoff && conversation.status_ia !== STATUS_IA.SHADOW) {
    log.info('Bug 24 v4: exit_action=handoff via set_tags — disparando INLINE', pendingState.exitActionHandoff)
    const notifyOutsideE3 = agent.notify_outside_hours_on_handoff !== false
    const outsideHoursE3 =
      notifyOutsideE3 && isOutsideBusinessHours(agent.business_hours, agent.extended_hours_until)
    // Premium #2: pedido estruturado (se houver) é a fonte de verdade pro item citado ao lead.
    const cartItemsE3 = normalizeCart((conversation as Record<string, unknown>).cart_items)
    const cartOneLineE3 = formatCartOneLine(cartItemsE3)
    const handoffMsgE3 = personalizeHandoffMessage(
      pickHandoffMessage({
        agent,
        profileData,
        funnelData,
        outsideHours: outsideHoursE3,
      }),
      {
        leadName: (leadProfile as { full_name?: string | null } | null)?.full_name || null,
        itemSummary: cartOneLineE3 || String(pendingState.exitActionHandoff?.reason || ''),
      },
    )
    const { result: queueResE3, finalMessage: finalMsgE3 } = await runQueueAssignment(handoffMsgE3)
    await sendTextMsg(finalMsgE3)
    await supabase.from('conversation_messages').insert({
      conversation_id,
      direction: 'outgoing',
      content: finalMsgE3,
      media_type: 'text',
    })
    const e3Updates: Record<string, unknown> = {
      status_ia: STATUS_IA.SHADOW,
      tags: mergeTags(merged, { ia: STATUS_IA.SHADOW }),
      lead_msg_count: 0,
    }
    if (profileData?.handoff_department_id) e3Updates.department_id = profileData.handoff_department_id
    else if (funnelData?.handoff_department_id) e3Updates.department_id = funnelData.handoff_department_id
    await supabase.from('conversations').update(e3Updates).eq('id', conversation_id)
    await supabase.from('ai_agent_logs').insert({
      agent_id,
      conversation_id,
      event: 'implicit_handoff',
      latency_ms: Date.now() - startTime,
      metadata: {
        reason: 'exit_action_set_tags_inline',
        exit_reason: pendingState.exitActionHandoff.reason,
        outside_hours: outsideHoursE3,
        queue: queueResE3,
      },
    })
    broadcastEvent({
      conversation_id,
      inbox_id: conversation.inbox_id,
      direction: 'outgoing',
      content: finalMsgE3,
      media_type: 'text',
    })
    conversation.status_ia = STATUS_IA.SHADOW
    toolCallsLog.push({ name: 'handoff_to_human', args: { source: 'set_tags_inline_bug24' } })
    return `Handoff automático disparado (stage completo). Sem necessidade de mais ações.`
  }

  // Bug 24 v5 search_products inline
  if (pendingState.exitActionSearch && conversation.status_ia !== STATUS_IA.SHADOW) {
    log.info('Bug 24 v5 search_products: disparando search INLINE', pendingState.exitActionSearch)
    const searchRes = await executeToolSafe('search_products', {
      query: pendingState.exitActionSearch.query,
      category: pendingState.exitActionSearch.category,
    })
    await supabase.from('ai_agent_logs').insert({
      agent_id,
      conversation_id,
      event: 'tool_called',
      metadata: {
        tool: 'search_products',
        source: 'bug24v5_set_tags_inline',
        query: pendingState.exitActionSearch.query,
        category: pendingState.exitActionSearch.category,
        result_preview: String(searchRes).substring(0, 200),
      },
    })
    toolCallsLog.push({
      name: 'search_products',
      args: pendingState.exitActionSearch,
      result: String(searchRes).substring(0, 200),
    })
    return `Tags atualizadas: ${merged.join(', ')}.${exitInstruction}\n\n[INTERNO] search_products ja foi chamado automaticamente pelo backend (flag pendingExitActionSearch). Resultado:\n${searchRes}\n\nResponda ao lead usando esse resultado.`
  }

  return `Tags atualizadas: ${merged.join(', ')}.${exitInstruction}`
}

// =============================================================================
// handoff_to_human
// =============================================================================

function shouldBlockPrematurePremiumHandoff(input: {
  agent: any
  conversation: { tags?: string[] | null; cart_items?: unknown } & Record<string, any>
  incomingText: string
  args: Record<string, any>
}): { field: string; message: string } | null {
  if (input.args?.source === 'premium_no_catalog_ready') return null
  const tags = Array.isArray(input.conversation.tags) ? input.conversation.tags : []
  const hasSelectedProduct = tags.some((tag) =>
    typeof tag === 'string' && (tag.startsWith('selected_product:') || tag.startsWith('produto_escolhido:'))
  )
  const cartItems = normalizeCart((input.conversation as Record<string, unknown>).cart_items)
  if (hasSelectedProduct || cartItems.length > 0) return null

  const interesse = extractInteresseFromTags(tags).toLowerCase()
  const isRevestimentoFlow = /porcelanato|revestimento|piso/.test(interesse)
  if (!isRevestimentoFlow) return null
  if (/\b(vendedor|atendente|humano|consultor)\b/i.test(input.incomingText || '')) return null

  const verdict = evaluateProductQualificationFlow({
    tags,
    agent: input.agent,
    incomingText: input.incomingText,
    catalogResult: 'empty',
    maxQuestionsAfterEmpty: 6,
  })
  if (verdict.readyToHandoff || !verdict.nextRequiredField) return null

  return {
    field: verdict.nextRequiredField.key,
    message: `[INTERNO] Handoff bloqueado: qualificação premium incompleta. Faça só esta pergunta ao lead agora: ${premiumQuestionForField(verdict.nextRequiredField.key)}`,
  }
}

function premiumQuestionForField(fieldKey: string): string {
  switch (fieldKey) {
    case 'formato':
      return 'Você já tem alguma medida em mente, como 60x60, 90x90 ou 120x120?'
    case 'acabamento':
      return 'Você prefere acabamento brilhante, acetinado ou fosco?'
    case 'cor':
      return 'Qual tonalidade você imagina: bege claro, cinza, branco ou outro tom?'
    case 'local_aplicacao':
      return 'Vai utilizar em qual ambiente: sala, quarto, cozinha ou área integrada?'
    case 'area':
      return 'Aproximadamente quantos metros quadrados você pretende revestir?'
    case 'ambiente_revestimento':
      return 'É para sua casa ou para algum ambiente comercial?'
    case 'aplicacao_revestimento':
      return 'Esse porcelanato será para piso ou parede?'
    default:
      return 'Me passa mais uma especificação do produto para eu direcionar melhor seu atendimento?'
  }
}

export async function handoffToHuman(
  args: Record<string, any>,
  ctx: SetTagsAndHandoffCtx,
  log: Logger,
): Promise<string> {
  const {
    supabase,
    agent,
    agent_id,
    conversation,
    conversation_id,
    contact,
    incomingText,
    leadName,
    availableLabels,
    profileData,
    funnelData,
    toolCallsLog,
    sendTextMsg,
    broadcastEvent,
    pickHandoffMessage,
    runQueueAssignment,
    buildQualificationChain,
  } = ctx

  // Sprint B1 (2026-05-21): guard determinístico — bloqueia handoff quando lead pergunta sobre pagamento
  const prematurePremiumBlock = shouldBlockPrematurePremiumHandoff({
    agent,
    conversation,
    incomingText,
    args,
  })
  if (prematurePremiumBlock) {
    log.info('Handoff blocked: premium product qualification incomplete', {
      field: prematurePremiumBlock.field,
    })
    return prematurePremiumBlock.message
  }

  const paymentBlock = shouldBlockHandoffForPayment({
    handoffReason: String(args.reason || ''),
    leadText: incomingText,
  })
  if (paymentBlock.block) {
    log.info('Handoff blocked: payment topic', { matchedTerms: paymentBlock.matchedTerms })
    toolCallsLog.push({ name: 'handoff_to_human', args, result: 'blocked_payment_topic' })
    return paymentBlock.message
  }

  const cooldown = agent.handoff_cooldown_minutes || 30
  // #11: All handoffs → SHADOW
  const newStatus = STATUS_IA.SHADOW

  // #22 + Bug 16b: pickHandoffMessage helper
  const notifyOutside = agent.notify_outside_hours_on_handoff !== false
  const outsideHours =
    notifyOutside && isOutsideBusinessHours(agent.business_hours, agent.extended_hours_until)
  // #4 (2026-05-24): personaliza citando nome + item do pedido (args.reason é o
  // resumo rico que o specialist montou — ex.: "Pedido de 50 telhas Brasilit").
  // Vale dentro E fora do horário; no-op se não houver nome/item legível.
  // Premium #2 (2026-05-25): se houver pedido estruturado (cart_items), ele é a
  // fonte de verdade — usa a linha compacta pro texto ao lead e anexa o itemizado
  // completo (com total) ao reason que o vendedor recebe.
  let freshConversationForHandoff: any = null
  try {
    const { data } = await supabase
      .from('conversations')
      .select('tags, cart_items')
      .eq('id', conversation_id)
      .maybeSingle()
    freshConversationForHandoff = data
  } catch {
    freshConversationForHandoff = null
  }
  const handoffTags = ((freshConversationForHandoff as any)?.tags || conversation.tags || []) as string[]
  const cartItems = normalizeCart((freshConversationForHandoff as any)?.cart_items || (conversation as Record<string, unknown>).cart_items)
  const cartOneLine = formatCartOneLine(cartItems)
  const cartFull = formatCartSummary(cartItems)
  // v7.58: linha de entrega (retirada na loja vs receber em casa + bairro) coletada
  // pelo product specialist antes do handoff. Vai no resumo interno pro vendedor.
  const deliveryLine = buildDeliveryLine(handoffTags)
  const reasonWithCart = cartFull
    ? `${String(args.reason || '').trim()}${args.reason ? '\n\n' : ''}🛒 ${cartFull}`.trim()
    : String(args.reason || '')
  const effectiveReason = deliveryLine
    ? `${reasonWithCart}${reasonWithCart ? '\n' : ''}${deliveryLine}`.trim()
    : reasonWithCart
  const handoffMsg = personalizeHandoffMessage(
    pickHandoffMessage({ agent, profileData, funnelData, outsideHours }),
    { leadName, itemSummary: cartOneLine || String(args.reason || '') },
  )

  // Empathy message if reason indicates negative sentiment
  const negativeReasons = [
    'frustração', 'frustracao', 'irritação', 'irritacao', 'reclamação',
    'reclamacao', 'insatisfação', 'insatisfacao', 'negativo', 'absurdo',
  ]
  const isNegative =
    args.reason && negativeReasons.some((r: string) => args.reason.toLowerCase().includes(r))
  if (isNegative) {
    const empathyName = leadName ? `, ${leadName}` : ''
    const empathyMsg = `Peço desculpas pela experiência${empathyName}. Entendo sua frustração e vou resolver isso agora.`
    await sendTextMsg(empathyMsg)
    await supabase.from('conversation_messages').insert({
      conversation_id,
      direction: 'outgoing',
      content: empathyMsg,
      media_type: 'text',
    })
    broadcastEvent({
      conversation_id,
      inbox_id: conversation.inbox_id,
      direction: 'outgoing',
      content: empathyMsg,
      media_type: 'text',
    })
  }

  // D30: atribui via fila
  const { result: queueRes, finalMessage: handoffMsgFinal } = await runQueueAssignment(handoffMsg)
  await sendTextMsg(handoffMsgFinal)
  await supabase.from('conversation_messages').insert({
    conversation_id,
    direction: 'outgoing',
    content: handoffMsgFinal,
    media_type: 'text',
  })

  // Nota interna (2026-05-26): resumo estruturado pro VENDEDOR, fixado no fio da
  // conversa (além do painel "Transbordo"). private_note NUNCA vai pro WhatsApp do
  // lead (só insert + broadcast pro helpdesk). É AQUI que mora o texto rico em 3ª
  // pessoa ("Lead quer…", pedido itemizado) — a mensagem ao lead fica só na ponte
  // humanizada. Resolve o feedback do dono (não expor IA + resumo pro vendedor).
  let premiumSummary = buildPremiumHandoffSummary({
    tags: handoffTags,
    leadName: leadName || contact?.name || null,
    fallbackReason: effectiveReason,
    messages: ctx.contextMessages,
  })
  if (cartFull && !/Pedido \(/i.test(premiumSummary)) {
    premiumSummary = `${premiumSummary}\n${cartFull}`.trim()
  }
  const sellerNote = (premiumSummary || effectiveReason || '').trim()
  if (sellerNote) {
    const noteContent = `📋 Resumo do pedido (interno):\n${sellerNote}`
    await supabase.from('conversation_messages').insert({
      conversation_id,
      direction: 'private_note',
      content: noteContent,
      media_type: 'text',
    })
    broadcastEvent({
      conversation_id,
      inbox_id: conversation.inbox_id,
      direction: 'private_note',
      content: noteContent,
      media_type: 'text',
    })
  }

  // Set IA to SHADOW + tag + reset lead_msg_count (R86)
  await supabase
    .from('conversations')
    .update({
      status_ia: newStatus,
      tags: mergeTags(handoffTags, {
        ia: STATUS_IA.SHADOW,
        handoff_created: 'true',
        agent_status: 'inactive',
        human_assigned: 'true',
        seller_notified: 'true',
        followups_paused: 'true',
      }),
      lead_msg_count: 0,
    })
    .eq('id', conversation_id)

  // Auto-assign "Atendimento Humano" label if available
  const handoffLabel = (availableLabels || []).find(
    (l: any) =>
      l.name.toLowerCase().includes('atendimento') || l.name.toLowerCase().includes('humano'),
  )
  if (handoffLabel) {
    await supabase.from('conversation_labels').delete().eq('conversation_id', conversation_id)
    await supabase
      .from('conversation_labels')
      .insert({ conversation_id, label_id: handoffLabel.id })
  }

  // Build qualification chain
  const qualChain = buildQualificationChain(
    conversation.tags || [],
    {},
    leadName || contact?.name || null,
  )

  // Log + broadcast
  await supabase.from('ai_agent_logs').insert({
    agent_id,
    conversation_id,
    event: 'handoff',
    metadata: {
      reason: effectiveReason,
      cart_items: cartItems,
      qualification_chain: qualChain,
      cooldown_minutes: cooldown,
      new_status: newStatus,
      queue: queueRes,
    },
  })
  broadcastEvent({
    conversation_id,
    inbox_id: conversation.inbox_id,
    direction: 'outgoing',
    content: handoffMsgFinal,
    media_type: 'text',
  })

  // Persist qualification chain to lead_profiles.notes
  if (qualChain && qualChain.includes('>')) {
    supabase
      .from('lead_profiles')
      .upsert(
        {
          contact_id: contact.id,
          notes: `Qualificação: ${qualChain}`,
          last_contact_at: new Date().toISOString(),
        },
        { onConflict: 'contact_id' },
      )
      .then(({ error: e }: { error: any }) => {
        if (e) log.warn('Failed to persist qualification chain to lead_profiles', { error: e.message })
      })
  }

  return `Conversa transferida para atendente humano. Motivo: ${args.reason}. IA em modo shadow (observando).`
}

// =============================================================================
// API pública — dispatcher
// =============================================================================

/**
 * Despacha 'set_tags' | 'handoff_to_human'. Retorna null pra outros nomes.
 */
export async function dispatchSetTagsHandoffTool(
  name: string,
  args: Record<string, any>,
  ctx: SetTagsAndHandoffCtx,
  log: Logger,
): Promise<string | null> {
  switch (name) {
    case 'set_tags':
      return setTags(args, ctx, log)
    case 'handoff_to_human':
      return handoffToHuman(args, ctx, log)
    default:
      return null
  }
}
