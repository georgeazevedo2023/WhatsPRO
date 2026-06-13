---
title: Changelog
type: changelog
updated: 2026-06-10
audited_at: 2026-06-05
---

# Changelog

> Releases ativas (últimos ~14 dias). Histórico completo em [[wiki/changelog/]].
>
> **Convenção:** semver. Toda feature/fix shipado vira entrada aqui (REGRA 17 do CLAUDE.md). Após release recente envelhecer >14 dias, mover pra `wiki/changelog/<ano-mes>.md`.

---

### v7.88.0 (2026-06-12) — 🧹 Onda 1 da auditoria do AI Agent: constantes únicas + hot path + observabilidade

Quick wins da auditoria de inconsistências (4 agentes + verificação manual), comportamento preservado:

- **Constantes fonte única** (`_shared/constants.ts`): modelos default (`DEFAULT_SPECIALIST_MODEL` substituiu 'gpt-4.1' inline em 5 pontos do index; validator/router idem), caps de handoff (8/40, R146) e `max_lead_interactions` (15), e os **markers de handoff** `handoff_created:true`/`human_assigned:true` (2 leitores via `hasActiveHandoffMarker` + 6 escritores em 3 arquivos com chave computada — typo aqui desligava o gate de silêncio v7.76).
- **llmProvider coerente**: `callLLM` repassa o modelo RESOLVIDO pro `callOpenAI` (antes, `req.model` vazio roteava como gpt-4.1-mini mas executava o default interno **gpt-5-mini** reasoning, 4× mais caro); defaults unificados em `DEFAULT_LLM_MODEL`.
- **Hot path**: `getLeadFullName` memoizado (full_name era re-buscado em até 5 paths de handoff/turno) + logs dos 5 detectores determinísticos viram fire-and-forget **com catch logado** (~50-100ms/turno) + índice composto `ai_agent_logs(conversation_id, agent_id, event, created_at)` pros 2 COUNTs do greeting check (migration `20260612010000`).
- **Gap do v7.85 fechado**: `executeShadowTool.update_lead_profile` gravava `full_name` SEM `sanitizeProfileName` — o shadow vendor LLM ainda podia gravar "Garagem" como nome. Agora usa a mesma fonte única.
- **Observabilidade**: 2 `catch {}` do `automationEngine` (parse do messageId do poll) agora logam. **Docs**: router documentado como gpt-4.1-mini (gpt-5-nano falhava parse JSON) em `wiki/arquitetura.md` + nota no CLAUDE.md.
- Suíte: 1207 verdes (14 fails pré-existentes idênticos no HEAD — testes Deno `https:` + asserts antigos do "anotei"; confirmado via stash). deno check 0. Deploy: ai-agent v266, whatsapp-webhook, form-bot.

---

### v7.87.0 (2026-06-12) — 🟢 Drawer "Reatribuir atendimento" não lista mais gestores

**Pedido (print):** Josafá e Michelly (gestores) apareciam como candidatos no drawer de reatribuição do dashboard de Fila — gestor não atende.

**Fix por PAPEL (não por nome):** RPC `get_queue_attendant_stats` ganha coluna `is_manager` (EXISTS em `user_roles` com role `gerente`/`super_admin` — cobre multi-role; DROP+CREATE porque RETURNS TABLE não aceita coluna nova, GRANT reaplicado). O `ReassignDrawer` filtra `!is_manager`; os **cards de stats da aba Atendentes continuam mostrando todos** (o RPC inclui gestor de propósito ali). Migration `20260612000000_queue_attendant_stats_is_manager`. Validado no DB real: Josafá/Michelly/George/**Televendas** vêm `is_manager=true` — ⚠️ Televendas tem role `gerente` no sistema e também saiu da lista; se ele deve ser reatribuível, trocar a role pra `user`.

**Fila automática ("mesma coisa para a fila"):** auditoria mostrou que o rodízio JÁ filtra gestor por design — `pick_next_assignee` (D30, Q6) pula role `gerente` sem `gestor_in_queue=true`, e os 3 gestores estão com `gestor_in_queue=false`. **Buraco real achado e fechado:** o reuso D-β (`isPreviousAssigneeEligible` em `handoffQueue.ts`) só checava `queue_paused` — selecionava `gestor_in_queue` mas NUNCA usava → gestor que pegou uma conversa manualmente UMA vez podia receber o re-handoff da mesma conversa pra sempre. Agora espelha a regra Q6 (lookup `user_roles` role=gerente + `gestor_in_queue`). 2 testes novos (23 verdes), deno 0. Deploy das 4 fns que bundlam handoffQueue: ai-agent v265, requeue-conversations, assign-handoff, handoff-abandoned-leads.

---

### v7.86.0 (2026-06-12) — 🟢 Vaga de emprego: resposta determinística pedindo currículo + classificação (pedido do dono) + docs de providers corrigidas

**Pedido:** lead que chega por vaga de emprego → classificar como vaga de emprego, pedir currículo pro `dppeletropiso@hotmail.com` e perguntar se pode ajudar em algo mais.

**Design (mode-agnostic + config-driven):** novo `_shared/agent/jobVacancy.ts` — `detectJobVacancy` (sinais fortes: currículo/emprego/contratando/processo seletivo/trabalhar com vocês; sinal fraco "vaga(s)" bloqueado por contexto físico garagem/estacionamento/demarcação) + `tryJobVacancyShortCircuit` wireado no index.ts **ANTES do gate `routing_mode='router'`** que pula R129/R136 (nenhum specialist trata RH → sem caminho paralelo; os 3 agentes rodam router). Só ativa com `business_info.jobs_email` preenchido (multi-tenant: sem e-mail, inerte). Ao detectar: tag durável `motivo:vaga_emprego` (guard anti-loop — "vou mandar o currículo" não re-dispara) + resposta com o e-mail + "Posso te ajudar em algo mais?". Send falhou → tag persiste e o LLM assume (o e-mail entrou no `buildBusinessSection`, que os specialists herdam via R148). Summarizer já tinha categoria `vaga_emprego` (v7.82) → dashboard Motivos classifica ao resolver.

**Config/UI:** campo "E-mail para Currículos (vagas)" no `BusinessInfoConfig` (JSONB `business_info.jobs_email`, já coberto por ALLOWED_FIELDS — sem migration). E-mail aplicado nos 3 agentes (Eletropiso/EletropisoV2/Sandbox). 11 testes novos (detector + reply + short-circuit com mocks), 57 verdes no total, deno 0. Deploy ai-agent **v264**.

**Docs (auditoria itens 1-2):** `wiki/infraestrutura.md:45` (Cérebro IA dizia "Gemini" → OpenAI gpt-4.1-mini, fallback Gemini) + summarizer Groq→OpenAI/callLLM em `wiki/arquitetura.md`, `AGENTS.md`, `README.md` (separando carousel copy, que segue Groq→Gemini→Mistral).

---

### v7.85.0 (2026-06-12) — 🟢 Telefone do lead na lista do Helpdesk + IA não grava mais INTERESSE como NOME ("Garagem")

**Contexto (2 prints do dono):** (1) lista de conversas não mostrava o número do WhatsApp do lead; (2) lead aparecia como **"Garagem"** — a IA pegou o interesse ("produtos para garagem") e gravou como `full_name` via `update_lead_profile`. Auditoria no DB: **5 leads** afetados ("Garagem", "Chuveiro" ×2, "Material", "Cozinha"); o caso Garagem tinha pushname real "Juliana Wanderley 👫" sendo escondido pelo nome errado (display name prioriza `lead_profiles.full_name`, v7.78.0).

**Fix UI:** `ConversationItem.tsx` mostra o telefone formatado (`formatPhone` de `phoneUtils`) sob o nome; omitido quando o display name JÁ é o telefone (sem duplicar).

**Fix de raiz (nome):** `sanitizeProfileName` em `_shared/agent/nameCapture.ts` (fonte única) — estrutura (só letras, 1-5 palavras, sem dígito/?/@), léxico (`NON_NAME_WORDS` ampliada: ambientes/cômodos, papéis, materiais — com e sem acento) e **contexto** (candidato contido nos interesses do lead = interesse, não nome; trade-off "lead Rosa × tinta rosa" documentado). Aplicado no `updateLeadProfile` (crmTools): nome rejeitado NÃO grava + feedback explícito pro LLM ("NUNCA chame o lead de X; pergunte o nome"). O dedup de doubling ("PedroPedro") migrou pra dentro do sanitize. Os caminhos determinísticos (`extractLeadName`, 2 usos no index.ts) herdam a blocklist ampliada sem mudança.

**Dados:** `full_name` dos 5 leads anulado (exibição volta pro pushname sincronizado pelo webhook). 47 testes verdes (14 nameCapture + 33 crmTools, casos novos p/ Garagem/Suvinil-em-interesse/Michelly legítimo), deno check 0. Deploy: ai-agent **v263**.

---

### v7.84.0 (2026-06-11) — 🟢 Venda detectada na fase do VENDEDOR (melhoria #1) + fix falso-positivo "Tá certo" (97/99 das vendas IA eram fantasma)

**Contexto:** funil v7.83 tinha venda só por regex lead-side (`detectSaleClosed`) + drawer (7 usos/30d). 587 handoffs/30d → só 89 com venda marcada; o fechamento que acontece COM O VENDEDOR não virava tag. Dono aprovou opção C (defesa em profundidade, 2 camadas).

**Camada A — tempo real (takeover celular):**
- `detectVendorSaleClosed` em `_shared/saleClosedDetection.ts`: padrões do lado VENDEDOR ("segue a chave pix", "comprovante recebido", "pedido faturado", "entrega agendada", "obrigado pela compra") com fallback pros padrões lead. Wire no bloco `sale_closed_detected` do ai-agent quando `shadow_only` (antes a msg do vendedor era varrida só com padrões de lead) + `metadata.source` (`vendor_message`/`lead_message`).
- Shadow vendor LLM: enum `venda_status` ganha **`fechada`** (só negociando/fechando/perdida/pausada existiam — o sinal não tinha onde ser registrado) + regra anti-intenção. `executeShadowTool` promove deterministicamente `venda_status:fechada` → `venda:fechada` (`shouldPromoteVendorStatusToSale`), com guard: veredito existente (`venda:*` da IA ou `resultado:*` do humano, ex. `resultado:perdido`) NUNCA é sobrescrito por LLM.

**Camada B — rede de segurança no summarizer (cobre vendedor pelo Helpdesk app, invisível pro shadow):**
- `SUMMARY_SYSTEM_PROMPT` ganha chave `sale_closed` (regras estritas: pagamento/pix/comprovante/pedido faturado = sim; INTENÇÃO não é venda; na dúvida false) + `normalizeSaleClosed` (boolean coerce, default false).
- `auto-summarize`/`summarize-conversation`: `sale_closed=true` sem veredito prévio → merge `venda:fechada`. Custo extra ZERO (mesma chamada).
- Migration `find_summarize_candidates_resummary`: conversa com atividade nova pós-resumo (last_message_at > generated_at, fallback expires-60d) volta a ser candidata — sem isso, venda que fecha DEPOIS do resumo escaparia pra sempre. Auto-throttle (re-resumo atualiza generated_at). Re-burn imediato: 31 convs.

**🚨 Achado de auditoria no E2E — funil INFLADO, não subnotificado:** medindo `sale_closed_detected` (30d), **97/99 tinham casado só a palavra "certo"** ("Tá certo", "Certo, obrigada!") — o grupo `(\s+pra\s+(mim|n(ó|o)s))?` do padrão `fechado` era OPCIONAL e `\bcerto\b` casava sozinho. Inflava o funil E disparava handoff prematuro (path Bug 18) em modo normal. **Fix:** "certo"/"finalizado" agora exigem o complemento "pra mim/nós"; venda verbalizada de forma vaga fica pro shadow LLM/summarizer (com guard). **Decisão do dono: histórico intocado** — as 99 tags antigas ficam (limitação documentada); só dados novos são confiáveis.

**E2E real (sandbox, pipeline vivo):** (1) summarizer sobre conversa com fechamento → `sale_closed=true` + tag ✓; (2) `vendor_message` "Segue a chave pix" → `pix_enviado`/`source:vendor_message` + tag ✓; (3) msg vaga sem regex → LLM tagueou `venda_status:fechada` → promoção gravou `venda:fechada` (`source:shadow_vendor_llm`) ✓; (4) "Tá certo, obrigado!" → ZERO detecção determinística ✓. Cleanup completo (msgs de teste deletadas, tags restauradas). 17+3 testes deno + 10 vitest, deno check 0. Deploy: ai-agent v262, auto-summarize v7, summarize-conversation v6.

---

### v7.83.0 (2026-06-11) — 🟢 Funil de Conversão REAL (5 etapas por tags duráveis) + lead score religado + família de venda unificada + resolved_at honesto

**Decisão do dono (opção C):** funil contato → qualificação → intenção → **repasse ao vendedor** → **venda marcada** (híbrida: IA `venda:fechada` via saleClosedDetection + humano `resultado:venda` via Finalizar Atendimento — que JÁ EXISTIA completo no `TicketResolutionDrawer`).

**Causa raiz do funil 2 meses zerado:** contrato produtor↔consumidor quebrado — `aggregate-metrics` esperava `extracted_data.tags[]` com vocabulário `intencao:alta`/`conversao:*`, mas o tool `extract_shadow_data` emite objeto LIVRE sem `tags` → etapa null e score delta 0 SEMPRE (653 leads parados no default 50). **Fix na fonte:** etapas derivadas DETERMINISTICAMENTE das tags duráveis de `conversations.tags` (`_shared/funnelStages.ts` puro, 10 testes) + lead score lido de `lead_score:NN` (determinístico, preLLMAutoExtract). Migration: etapa `handoff` no CHECK; TRUNCATE+re-derivação 30d.

**Família de venda unificada** (KPI dizia 97, funil 19): TODOS os contadores agora contam `venda:fechada` OU `resultado:venda` — `dash_kpis_resumo`, `dash_vendas_por_vendedor`, `dash_cotacoes`, `dash_conversao_orcamento_venda`, `get_conversion_by_origin` (que ainda buscava a tag fantasma `venda:fechada` em `lead_profiles.tags` → 0 eterno; agora lê eventos reais do funil + **SECURITY DEFINER** — sem ele, RLS de `conversion_funnel_events` exige inbox_users membership e o gestor via 0). `venda_status:fechando` = em-fechamento → intenção, não conversão.

**resolved_at honesto:** `v_vendor_activity`/`v_handoff_details`/`aggregate-metrics` usam `resolved_at` real (drawer) com fallback `updated_at` + backfill 2 faltantes — tempo médio do Lucas caiu de "192h52min" (proxy updated_at) pra **2h50min**.

**E2E real (Playwright + DB):** funil ao vivo 591→412→380→480→**99** · Conversão por origem 99/16,8% · KPI 100 · score médio 41 (302 leads com score real, 42 quentes ≥70, antes ZERO) · varredura card a card do /dashboard/gestao. 10/10 testes funnelStages, deno 0, tsc 0 novos.

---

### v7.82.0 (2026-06-11) — 🟢 Motivos de contato com TAXONOMIA de negócio ("info sobre telha de PVC" = Interesse de compra) + subinteresses no tooltip

**Pedido do dono (print do card):** motivos saíam como frases soltas ("Solicitação De Informações Sobre Telha De Pvc" 1x cada) — *"se o lead manda informações sobre telha de pvc e não é uma dúvida técnica isso é interesse de compra, reclassifique todos ou crie um subinteresse"*.

**Fix na fonte (taxonomia no resumo, não pós-processamento):**
- `_shared/summaryPrompt.ts` NOVO — fonte única do prompt de resumo + taxonomia fixa de 8 categorias (`interesse_compra`, `duvida_tecnica`, `troca_devolucao`, `status_entrega`, `reclamacao`, `vaga_emprego`, `fornecedor`, `outro`) com a REGRA do dono: *pedido de informação/preço/disponibilidade/modelos de PRODUTO = interesse_compra; dúvida técnica é SÓ uso/instalação/aplicação; na dúvida, interesse_compra*. `normalizeSummaryCategory()` coage resposta inválida do LLM pra `outro`.
- `auto-summarize` + `summarize-conversation` usam o prompt compartilhado e gravam `ai_summary.category` validado (antes cada um tinha cópia do prompt sem categoria).
- **`TopContactReasons` reescrito:** agrupa por categoria DETERMINISTICAMENTE (sem LLM em tempo de view — aposenta a chamada `group-reasons` do card, que ainda caía em CORS no localhost); barra por categoria + **subinteresses no tooltip** ("telha de PVC (3x)…"); badge "Classificado por IA". De quebra zera os 4 erros tsc pré-existentes do arquivo.
- `AiSummary.category?` no types.
- **Reclassificação total:** 121 resumos da era sem-categoria anulados → o cron backfill (v7.81.0) regenera tudo com categoria; restantes ~600 já nascem categorizados.
- **Bug pego no E2E da reclassificação — cota do Groq free:** após o wipe, os ticks do cron retornavam 200 em ~17s gravando ZERO (~350ms/conversa = todas as chamadas Groq falhando rápido; o teto DIÁRIO de tokens do free tier esgotou com os ~120 resumos + recompute — falha progressiva silenciosa que começou ANTES da taxonomia). **Fix de raiz:** summarizers migrados do fetch Groq cru pro **`callLLM` do `_shared/llmProvider.ts`** (stack padrão do projeto: OpenAI `gpt-4.1-mini` primário + fallback Gemini + circuit breaker). Custo do backfill completo ~US$0,70. Sonda pós-deploy: `interesse_compra` / "Interesse em telha Imbralit… tamanhos e preços" ✓.

**Validação:** deno check 0 (2 fns), tsc 0 erros novos, E2E real (sonda single-conv + categorias coerentes no DB + card agrupado por categoria).

---

### v7.81.0 (2026-06-11) — 🟢 Dashboard Gestor: "Motivos de conversa" religado (pipeline ai_summary NUNCA tinha rodado) + Ranking Vendedores contava 0 resolvidas (views com status em INGLÊS)

**Pedido do dono:** "audite e veja pq nao tem motivos de conversa no dashboard". **Achado 1 — o card nunca teve dado:** das 805 conversas (30d), **ZERO com `ai_summary`** (zero all-time). O único produtor automático era o trigger `auto_summarize_on_resolve`, **morto em 4 camadas**: (a) lia GUC `app.settings.anon_key` que é sempre NULL (Supabase não seta — só emitia WARNING e pulava o HTTP call); (b) URL de fallback hardcoded do projeto MORTO `crzcpnczpuzwieyzbqev` (herança Lovable, 2 migrações atrás); (c) `extensions.net.http_post` = schema inexistente; (d) mesmo se chamasse, `verify_jwt=true` + anon key → 401. E os modos `backfill`/`inactive` da fn nunca tiveram cron (só existia o cron que APAGA summaries expirados).

**Fix (padrão estabelecido, zero gambiarra):**
- Trigger morto DROPado; cron `auto-summarize-backfill` (vault `CRON_AUTH_KEY`, mesmo padrão do jobid 38) chama `mode=backfill`.
- RPC `find_summarize_candidates`: filtro de ≥3 mensagens vai pro SQL — antes, conversas curtas ("oi" e sumiu) ficavam PERMANENTEMENTE no topo da janela de candidatos, estrangulando as elegíveis mais antigas. + piso 60d alinhado ao expiry (sem ele, summaries expirados re-entravam em churn infinito). `REVOKE FROM PUBLIC/anon/authenticated`.
- `verify_jwt=false` no config.toml (regra: fn chamada por pg_cron) + deploy CLI scoop (v3).
- `TopContactReasons`: filtro de instância passa pro servidor (`inboxes!inner`) — client-side após `limit(500)` deixava outras instâncias consumirem o limite.

**Achado 2 — família de bugs EN×PT em `conversations.status`** (valores reais: `aberta`/`pendente`/`resolvida`): 3 views comparavam `'resolved'`/`'pending'` → `v_vendor_activity` (Ranking Vendedores "0 resolv./0%" pra todos + `v_ia_vs_vendor.vendor_resolved` herdado), `v_handoff_details` (**`converteu` sempre false**), `v_lead_metrics` (resolved_count 0). + `aggregate-metrics:149` (`'resolved'` → shadow_metrics histórico zerado), `assistantQueries.pending_conversations` (`'pending'` → assistente sempre respondia 0), `useVendorDetail.ts` front (`'open'/'pending'`). **Tudo corrigido** (migration `fix_view_status_literals_pt` + 2 fns redeployadas + front) e shadow_metrics dos últimos 30 dias **recomputado** (fn aceita `date`). Bônus: 3 erros deno pré-existentes zerados (aggregate-metrics tipo do consolidated; assistant-chat `.catch` em PromiseLike).

**Validação E2E real (Playwright, localhost + DB prod):** backfill ao vivo populando (89+ resumos na 1ª hora, motivos coerentes: "telha de PVC", "chuveiro Lorenzetti", "caixa d'água 2000L"); card "Principais Motivos de Contato" RENDERIZANDO com agrupamento IA; Ranking Vendedores ao vivo: Lucas 110 conv/28 resolv./26%, Rafaella 64% (antes: tudo 0). deno check 0 nas 3 fns; tsc sem erro novo (5 pré-existentes provados via stash). Backfill completo ~750 conversas conclui via cron.

---

### v7.80.0 (2026-06-11) — 🟢 Cutucada e transbordo por inatividade citam o PEDIDO do lead ("Vi que você procurava porcelanato 60 por 60!")

**Pedido do dono (caso real Van/porcelanato):** a cutucada de abandono saía genérica ("Ainda tá por aí? 😊…") mesmo com o pedido seedado nas tags (`pedido_original:porcelanato 60 por 60`) — contexto que recupera o interesse do lead estava jogado fora.

**Fix (determinístico, zero LLM):**
- `parsePedidoOriginal(tags)` — extrai `pedido_original:` (fallback `interesse:`), cap 60 chars em fronteira de palavra.
- `personalizeNudge(msg, nome, pedido)` — tece o pedido: placeholder `{pedido}` na mensagem configurada OU prefixo neutro "Vi que você procurava {pedido}! "; compõe com o nome ("Eduarda, vi que você procurava…"). Sem pedido → comportamento de sempre.
- **Transbordo (estágio 2)** também cita: `itemSummary` recebe o pedido no fluxo inatividade-sem-carrinho → *"Seu pedido de porcelanato 60 por 60. Já passei tudo pro nosso vendedor…"*.
- **Nota interna rica**: `🔎 Lead buscava: {pedido}` — vendedor não precisa rolar a conversa (fecha achado (b) da auditoria de áudio 2026-06-11).
- Trigger do log de handoff também ganha o pedido (`Lead buscava: …`).

**Validação NOTA 10:** 45/45 testes (10 novos: pedido+nome, placeholder, strip gracioso, cap, retrocompat) · deno check 0 · **E2E real sandbox via CRON DE PRODUÇÃO** (invokes manuais deram scanned:0; o tick real de 1min executou os 2 estágios na função deployada, WhatsApp entregue no número do operador): estágio 1 *"Vi que você procurava porcelanato 60 por 60! Ainda tá por aí? 😊…"* → estágio 2 transbordo citando o pedido + nota interna 🔎 + `status_ia=shadow` + tags limpas. Flags do sandbox restauradas; zero efeito colateral (só a conversa de teste tocada).

---

### v7.79.0 (2026-06-11) — 🟢 Helpdesk: busca acha QUALQUER conversa da caixa (server-side) + deep-link abre conversa fora do filtro

**Bug do dono:** buscou `558196970061` (até com filtro "Todas") e não achou a conversa — ela era "resolvida" e fora das 50 carregadas. **Causa:** a busca era 100% client-side sobre a página carregada (status filtrado no servidor + paginação 50); o `?conv=` da URL também só selecionava conversa presente na lista carregada (deep-link da busca global pra conversa resolvida falhava silencioso).

**Fix:**
- **Busca server-side (3+ chars):** consulta `contacts` (telefone só-dígitos + pushname) e `lead_profiles.full_name` (nome extraído), busca as conversas da caixa em QUALQUER status e injeta na lista (dedup por id, mesmo shape via `CONVERSATION_LIST_SELECT`/`mapConversationRows` compartilhados). Helpers puros em `src/lib/helpdeskServerSearch.ts` (10 testes). Telefone formatado funciona ("+55 81 9697-0061").
- **Deep-link `?conv=`:** fallback fetch-by-id quando a conversa não está na página carregada (guard: só abre se for da caixa atual).

**Causa-raiz lateral descoberta no E2E:** o arquivo da página estava como `Helpdesk.tsx` no disco Windows mas `HelpDesk.tsx` no git/imports → Vite (case-sensitive no module graph) servia versão STALE da página em dev; edits não chegavam no browser. Disco renomeado pro casing do git.

**E2E real Playwright 3/3 PASS:** busca pelo número acha a "Van" (resolvida, fora da página) · clique abre · deep-link abre direto. tsc 0, 138 testes lib verdes.

---

### v7.78.1 (2026-06-10) — 🟢 Helpdesk: preview da lista congelava na última msg da IA (725 conversas corrigidas)

**Bug do dono (print):** na conversa a última mensagem era "ta certo" (17:17), mas a lista mostrava "Vai ser para uso em área interna ou externa?" — com a hora certa. **Causa raiz:** `conversations.last_message` (texto do preview) só era escrito pela IA; webhook (mensagens do lead + takeover pelo celular) e app confiavam num trigger que só atualizava o TIMESTAMP. O comentário do webhook (linha 1101) prometia "last_message_at + last_message + is_read atualizados pelo trigger" citando um trigger (`update_conversation_on_message_insert`) que **nunca existiu**. Enquanto a aba está aberta o realtime mascara (patch em memória); ao recarregar volta o valor stale do DB.

**Fix de raiz (fonte única):** trigger `update_conversation_last_message_at` agora grava os 3 campos em TODOS os caminhos de escrita — `last_message_at`, `last_message` (content ou preview de mídia 📷/🎥/🎵/📎/🌟/🎠/📊/👤, espelhando `mediaPreview()` do front; `private_note` não altera preview) e `is_read=false` em incoming (antes NENHUM caminho backend resetava unread em conversa existente — badge dependia do realtime). Migration `last_message_preview_trigger` + **backfill: 725 conversas** com preview congelado recalculadas. Comentário do webhook corrigido (sem redeploy — só comentário).

**Validação E2E real:** caso do print conferido no DB ("Vai ser para uso…" → "ta certo") + INSERT de teste em transação com rollback automático (trigger atualizou preview/is_read/timestamp; dado de teste comprovadamente não persistiu).

---

### v7.78.0 (2026-06-10) — 🟢 Helpdesk: nome extraído pela IA vence o pushname na exibição (caso "oi" → Jessica)

**Bug do dono:** lead com pushname do WhatsApp literalmente "oi" se apresentou como "Jessica"; a IA gravou certinho em `lead_profiles.full_name` (via `update_lead_profile`), mas header/lista do Helpdesk continuavam mostrando "oi". **Não era falha de extração — é a arquitetura de DOIS nomes:** `contacts.name` preserva o pushname (re-sincronizado a cada mensagem pelo `whatsapp-webhook`; sobrescrever = o webhook reverte na próxima msg) e o nome informado na conversa vive em `lead_profiles`. A UI só olhava `contacts.name`.

**Fix (camada de exibição, zero mudança no backend/webhook):**
- `src/lib/contactDisplayName.ts` — lógica PURA (8 testes): prioridade `lead_profiles.full_name` → pushname → telefone.
- Lista (`ConversationItem`), header do chat (`ChatPanel`), painel lateral (`ContactInfoPanel`) e aria-labels (`ConversationList`) usam o helper.
- Busca local também encontra pelo nome extraído (`useHelpdeskFilters`) — quem vê "Jessica" acha digitando "Jessica".
- Select da lista embeda `lead_profiles(full_name)` aninhado (1:1, `contact_id` UNIQUE).

**Validação:** tsc 0 · 22/22 testes das áreas tocadas · 19 fails da suite provados pré-existentes (re-rodados com `src/` stashado) · **E2E real Playwright** no app local (login admin → deep-link da conversa): header "oi"→"Jessica" + busca "Jessica" acha a conversa (screenshot conferido).

**Limitação anotada:** `GlobalSearchDialog` (busca global, server-side) ainda não busca por full_name extraído — backlog.

### v7.77.0 (2026-06-09) — 🟢 Helpdesk: vendedores Android sem enviar foto — aba velha pós-deploy era a causa; auto-recuperação de versão + upload anti-zumbi + telemetria

**Bug do dono:** "alguns vendedores/atendentes não conseguem enviar fotos pros leads pelo Helpdesk; acho que usam Android". **Ground truth chocante:** em 7 dias, **ZERO uploads de Android** no `helpdesk-media`; em 14 dias só 9 imagens humanas no total; vendedores já usavam **workaround pelo celular** (7/8 imagens de hoje foram fromMe). RLS descartada (policy pública p/ authenticated).

**Causas-raiz (auditoria multi-agente 5 traces + verificação adversarial):** (1) **CONFIRMADO** — o fix HEIC da v7.75.0 só ficou vivo HOJE (08:04 UTC; deploy anterior era de 06-05) e celular mantém a aba viva por DIAS sem recarregar + `index.html` sem `Cache-Control` (cache heurístico) → vendedores rodavam código **pré-fix**, onde foto de câmera Android (HEIC) toma 500 do UAZAPI. (2) **CONFIRMADO** — cada redeploy **apaga os chunks do build anterior** (flagrado ao vivo: 404 + Bad Gateway); aba antiga que lazy-loada o chunk do heic2any (1,35MB, só baixa no 1º envio de HEIC) toma 404, o Chromium **cacheia a falha do módulo** e todo retry falha até F5 — bolha genérica. (3) **PARCIAL** — upload ao Storage era o único passo de rede sem proteção anti-sessão-zumbi (spinner infinito). (4) **PARCIAL** — heic2any 0.0.4: worker sem error-handler (OOM = promise eterna), asm.js 16MB, zero cap de dimensão; erros reais (`ERR_LIBHEIF`, `Cannot enlarge memory`) não casavam o `humanizeSendError`. (5) Bugs menores: `userId:''` → UAZAPI entrega + INSERT falha + retry **duplica a foto no lead**; cap 20MB pré-conversão; foto cloud-only (0 bytes) sem mensagem.

**Fix de raiz (8 frentes):**
- `nginx.conf`: `Cache-Control: no-cache` no index.html + version.json (assets seguem immutable).
- `main.tsx`: listener global `vite:preloadError` → **reload automático 1x** (guarda anti-loop) — chunk 404 pós-deploy se auto-recupera.
- `vite.config.ts`: `__APP_BUILD__` + `version.json` por build; `useTabFocusRefresh` checa no tab-resume e mostra **toast "Nova versão — Recarregar"** (passivo, lição v7.61.0: nunca reload forçado).
- `normalizeOutboundImage.ts`: HEIC blindado — retry do import + erro tipado `CHUNK_LOAD_FAILED`, **teto 60s** na conversão (worker morto não pendura mais), normaliza rejeições-objeto do heic2any, fallback canvas (Safari decodifica HEIC nativo), **cap 4096px** no canvas (anti-OOM).
- `sendErrors.ts`: mapeia ChunkLoadError→"recarregue a página", ERR_LIBHEIF/memória→dica de print, sessão expirada, "mídia" com acento, arquivo 0 bytes→dica Google Fotos.
- `useSendFile`/`uploadOutboundMedia`: upload com **teto 120s + recoverStuckSession** (fim do spinner infinito); cap 20MB movido pra DEPOIS da conversão; teto duro 50MB pré; `uazapiClient` AbortController 90s.
- `ChatInput`: guard `!user` ANTES de enviar (mata a foto duplicada no lead).
- **Telemetria** (`media_send_telemetry` + edge fn `log-send-failure` verify_jwt=false + `sendTelemetry.ts` fire-and-forget text/plain keepalive): toda falha grava estágio/erro/build/UA — falha client-side deixou de ser invisível. Smoke E2E ok.
- `deploy.yml`: **CI chama o webhook do Portainer** (secret `PORTAINER_WEBHOOK_URL`) — mata o deploy-fantasma de vez (2 ocorrências registradas; a de hoje detectada e corrigida nesta sessão).

**Verificação:** 32/32 testes novos+existentes dos módulos; suite 545✓ (5 fails pré-existentes forms); tsc/deno 0 novos; build emite version.json com id idêntico ao bundle; telemetria smoke E2E (beacon→DB). Detalhe: [[project_vendor_photo_send_audit_v777]].

---

### v7.76.0 (2026-06-09) — 🔴→🟢 AI Agent: handoff repetia + IA falava depois do transbordo — gate de silêncio durável + handoff idempotente

**Bug do dono** (print MARMOBOX ALMOXARIFADO / lead Guedes — na verdade **EletropisoV2**, "MARMOBOX" é só o nome de perfil do contato): após o transbordo a IA **reenviou a MESMA mensagem de handoff** ("Guedes, seu pedido de cabos. Já passei tudo pro nosso vendedor…") a cada nova mensagem do lead. No DB de prod: **3 transbordos idênticos** (11:00/14:58/15:04) + filas/notas/vendedores novos a cada um. Regra violada: **depois do handoff a IA deve ficar MUDA pro lead até o atendente Finalizar ou clicar "Ativar IA"**.

**Causa-raiz (auditoria multi-agente 6 traces + verificação adversarial, ancorada no DB real):** dois defeitos compostos. **(1) não-silenciado:** "humano no controle" estava codificado SÓ em `status_ia` (volátil) — o gate de entrada só barra `desligada`, `assigned_to` nunca era lido, e `dispatchResponse:417`/`webhook:1124`/reabertura regravavam `ligada` por cima do `shadow` do handoff. **(2) repetição:** o handoff não era idempotente — `handoffToHuman` gravava `handoff_created:true` mas **nunca o lia**, o `handoff_cooldown_minutes=30` **só era logado** (nunca enforçado), e as **tags do loop sem-resultado** (`enriching/enrich_count/catalog_result/flow_mode`) **nunca eram limpas** → assim que `status_ia` voltava a ≠shadow, o loop re-detectava "pronto pra handoff" e re-disparava o MESMO transbordo.

**Fix de raiz (zero gambiarra, 7 arquivos):**
- **Gate de silêncio durável** (`ai-agent/index.ts` após :219): se `handoff_created`/`human_assigned` presente e `status_ia≠shadow` → coage `status_ia→shadow` (+self-heal no DB). Cai no SHADOW MODE → **detecção interna viva, zero texto pro lead** (decisão do dono). Neutraliza TODOS os resets de uma vez.
- **Handoff idempotente** (`setTagsAndHandoff.ts`): suprime reenvio se `handoff_created`/`handoff_at:<ms>` dentro do cooldown; grava `handoff_at` (cooldown agora REAL); **remove as tags de loop** no transbordo.
- **Defesa em profundidade** (loop guard :3093): checa a tag durável `handoff_created` ([[feedback_guard_must_check_durable_tags]]).
- **Religar de fato** (`ChatPanel` "Ativar IA" + `conversationReopen`): limpam `handoff_created/human_assigned/handoff_at` + tags de loop (decisão: *Ativar IA OU Finalizar/reabrir* religam).
- **Webhook** (`whatsapp-webhook:1124`): não deixa o payload do n8n rebaixar `shadow→ligada` com handoff ativo.

**Verificação:** `deno check` 0 · `tsc` (ChatPanel) 0 · **+4 testes novos** (idempotência ×3 + reopen-strip), suíte 0 regressão (14 fails pré-existentes não-relacionados). **Deploy PROD** (ai-agent v260, whatsapp-webhook v15). **Cleanup:** UPDATE limpou as tags de loop de **128 conversas órfãs** (preservou handoff markers + tags de negócio). Detalhe: [[project_handoff_repeat_silence_v776]].

---

### v7.75.0 (2026-06-09) — 🟢 Helpdesk: foto de iPhone/Android (HEIC) finalmente envia — conversão p/ JPEG + UX de erro

**Reclamação do dono:** atendentes não conseguem enviar FOTO ao cliente; suspeita em "arquivos grandes".

**Diagnóstico (auditoria multi-agente + teste empírico ao vivo no proxy DEPLOYADO, instância Sandbox):** "arquivos grandes" é **falso culpado** — JPEG/PNG/WEBP de até **17,6MB** enviam e são entregues (200+messageid, ~5s, sem timeout; o limite de 10MB da doc UAZAPI NÃO é imposto via URL). A causa real é **FORMATO**: esta instância UAZAPI transcodifica toda imagem p/ JPEG e **não decodifica HEIC/HEIF** (padrão de foto do iPhone e do Android em "alta eficiência"/HEIF) → HTTP 500 `unsupported image format` (mesmo erro do base64 da v7.71.4). Pós-v7.71.4 esse 500 virou toast → atendente vê falhar.

**Fix de raiz (frontend, helper único compartilhado):**
- `normalizeOutboundImage.ts` (novo): detecta formato por **magic bytes** (não confia em `file.type`, vazio no mobile); JPEG/PNG/WEBP/GIF passam direto; **HEIC/HEIF → JPEG** via `heic2any` (import dinâmico, chunk lazy — wasm só baixa quando há HEIC); desconhecido decodificável → canvas→JPEG; senão erro amigável. Também conserta o caso "foto vira documento" quando `file.type` vem vazio.
- `useSendFile` + `uploadOutboundMedia` chamam a normalização (Helpdesk, Grupo, Lead). `ChatInput` `accept="image/*,.heic,.heif"`.
- **UX de erro** (`sendErrors.ts` `humanizeSendError`): traduz o erro cru ("unsupported image format", "timed out after 30000ms") em PT acionável; rótulo imagem/documento correto. **Bolha de "Falha ao enviar" persistente** no `ChatPanel` (vermelha, com "Tentar de novo"/"Dispensar") — fim do toast efêmero.
- **Disparador/Carrossel base64→URL** (mesma raiz): `BroadcastMessageForm`, `sendCarouselToNumber` (carrossel/lead) e imagem da enquete agora sobem ao Storage e mandam **URL** (não base64).
- **Edge `uazapi-proxy`**: `send-media` timeout **30s→60s** + erro de timeout em PT (504).

**Verificação:** E2E real no navegador (Chromium) — `sample.heic` 718KB → módulo do app + heic2any → **JPEG válido** (`FF D8 FF`, 465KB). 23 unit tests novos. tsc 0 · deno check 0 · ESLint 0 (arquivos novos) · suíte 1696✓ (19 fails pré-existentes, 0 regressão). Dep nova: `heic2any` (lazy). Detalhe: memória `project_heic_photo_send_v775`.

---

### v7.74.x → v7.73.0 (2026-06-04/05)

Fila: quem enviou cada msg + "{Nome} (responsável)" + busca + rede-segurança Disparador. Arquivado: [[wiki/changelog/2026-06-part3]].

### v7.72.0 → v7.68.0 (2026-06-03/04)

Movidas p/ [[wiki/changelog/2026-06-part2]] (reatribuição notifica atendente, mídia base64→URL, cadastro de membro atômico, import em massa, auto-enroll do Disparador, módulo de bases + hardening, avatar de instância no Storage).

### v7.67.0 → v7.63.1 (2026-06-01 a 06-02)

Movidas p/ [[wiki/changelog/2026-06-part1]] (paridade Agente↔admin, fora-horário acumula pedido, inatividade 2 estágios, 5 bugs determinísticos, fila sem-atendimento).

### v7.63.0 → v7.61.0 (2026-05-31)

Movidas p/ [[wiki/changelog/2026-05-part13]] (Dashboard gestor + fetch_messages_timeout + reload de aba).

### v7.60.0 (2026-05-31) e anteriores

v7.60.0 → v7.56.1 → ver [[wiki/changelog/2026-05-part12]]. Anteriores → [[wiki/changelog/2026-05-part11]].
