---
title: Changelog
type: changelog
updated: 2026-07-26
audited_at: 2026-07-26
---

# Changelog

> Releases ativas (últimos ~14 dias). Histórico completo em [[wiki/changelog/]].
>
> **Convenção:** semver. Toda feature/fix shipado vira entrada aqui (REGRA 17 do CLAUDE.md). Após release recente envelhecer >14 dias, mover pra `wiki/changelog/<ano-mes>-part<N>.md` (último particionamento: 2026-07-26 → [[wiki/changelog/2026-07-part1]] + [[wiki/changelog/2026-06-part6]]).

---

### v7.110.0 (2026-07-26) — 📚 FAQ religada nos specialists (R150 FECHADA) + falha transitória de LLM não sela mais shadow (R152 FECHADA)

Fecha os 2 débitos prioritários que o D6 deixou. **(1) R150 — FAQ/knowledge RELIGADA:** o load de `ai_agent_knowledge` volta ao `index.ts` (mesmo padrão v7.103: cache 48h por-isolate + sonda `count`+`updated_at` de ~100 bytes/turno — edição de FAQ propaga no turno seguinte) e o bloco `<knowledge_base>` (via `buildKnowledgeInstruction`, sanitizado) é injetado no prompt dos **5 specialists** via `specialistBase` (novo campo `knowledgeInstruction` em `SpecialistCtx`/`RouterPipelineCtx`, posicionado após as Informações da Empresa). As **26 FAQs reais** (Eletropiso 13 + EletropisoV2 13) voltam a valer depois de ~2 meses mortas. Teste novo `specialistBase.test.ts` asserta o **CONTEÚDO do prompt final** — exatamente o buraco que deixou a regressão invisível. **(2) R152 — classificação transitório×permanente no fallback do D6:** novo módulo puro `_shared/agent/llmErrorClassifier.ts` (`isTransientLlmError`: 408/429/5xx/timeout/breaker = transitório; demais 4xx/lógica = permanente); `llmCallLoop` propaga a msg CRUA do provedor (`errorMessage`), `routerPipeline` devolve `failure{transient,reason}`. No `index.ts`: falha transitória **1º strike = silêncio ao lead + tag `router_transient_fail:1`** (a próxima msg reprocessa; NÃO transborda, NÃO sela shadow — incidente de minutos da OpenAI não converte mais leads em massa pra humano); **2º strike consecutivo = transbordo gracioso** (lead esperou 2 turnos, humano assume); falha permanente (modelo inválido/hop guard/exceção) transborda direto como antes. Strike limpa no 1º turno OK; tag em `INTERNAL_TAG_KEYS`. Telemetria: `metadata.transient/second_strike/failure_reason` no `implicit_handoff` + evento `error` com `reason=router_fallback_transient_skip` no strike-1. **E2E real pós-deploy (ai-agent v278):** FAQ de teste com fato inconfundível ("parcelamos em até **7x sem juros**") cadastrada no Sandbox → pergunta injetada direto no `whatsapp-webhook` (runbook D6; nunca via WhatsApp real) → router `pagamento` (hop 0, conf ok) → **objection specialist respondeu "em até 7x sem juros"** (prompt 6.001 chars com o bloco; memória longa reconheceu o lead de teste). Cenário 100% limpo depois (FAQ deletada, conversa restaurada). tsc 0 · deno ai-agent 0 · vitest **2012/0** (+17: 12 classifier + 5 specialistBase). Commit `ad77ab9`.

---

### v7.109.0 (2026-07-25) — 🏁 D6: monolito do AI Agent APOSENTADO — router+specialists é o ÚNICO cérebro (plano orquestrador 100%)

Fecha o plano orquestrador iniciado em maio (monolito 17 KB → router + 5 specialists). **Evidência pré-remoção** (não só teoria): 3 agentes em `routing_mode='router'`, **1.796 runs em 30d 100% router+specialists, 0 execuções monolith, 0 eventos de fallback**. **Mapa cirúrgico** por agente Explore (file:line) separou monolith-only × compartilhado × router-only antes de cortar. **Removido:** branch do monolito no `index.ts` (**3.440→2.964 linhas, −476**) — system prompt gigante (17 seções), `toolDefs` strict (93 lin), `runLlmCallLoop` do caminho antigo, sanitizer backstop, R130, Bug 24 v2, `dispatchResponse` do monolito, curto-circuitos R129/R136 (`runPreLLMShortCircuits` sem caller), `dispatchExitActionHandoff`, R121 inline, `buildContextDocuments` (**arquivo deletado** + teste, 100% órfão), string `leadContext` e **load do knowledge/FAQ + sonda kb** (−1 query/turno). `routerPipeline.ts`: gate de `routing_mode` e branch `shadow` removidos (aposentados juntos — sem monolito não há o que sombrear). **Fallback GRACIOSO substitui o fallthrough**: pipeline sem Response (exceção/hop guard/falha catastrófica) → msg de handoff configurada + fila + shadow + nota interna + log `implicit_handoff reason=router_fallback` — lead nunca vê erro nem cai no comportamento antigo. UI: seletor de Modo de Roteamento removido da BrainConfig; dashboard Roteamento "fallback monolith"→"transbordo de segurança"; migration `d6_routing_mode_default_router` (coluna fica INERTE, default `router`). **E2E real pós-deploy (ai-agent v277):** (a) fluxo feliz EletropisoV2 — router `produto` 0.95 → qualification specialist qualify-first, saudação determinística, ~6-10s, dedup `external_id` segurou entrega dupla do n8n; (b) **fallback forçado** no Sandbox (specialist_model inválido) → lead recebeu transbordo digno, nota interna, fila atribuiu, log `router_fallback` — restaurado depois. tsc 0 · deno ai-agent 0 · vitest **1995/0** (−22 = testes do contextDocuments deletado). **Achados documentados:** FAQ/knowledge só alimentava o monolito — specialists NUNCA receberam (religar = follow-up prioritário); n8n com lag ~minutos na ingestão; número do Sandbox hospeda outro bot ("Tamandaré") → E2E futuro deve injetar direto no webhook; deno debt pré-existente em playground/debounce (TS2589, provado no HEAD); órfãos parciais em `_shared` pra varredura posterior.

**Errata (2026-07-26):** a 1ª redação desta entrada (e a mensagem do commit `5245eab`, imutável) publicou `3.440→2.781 (−659)`, misturando total de linhas do arquivo ANTIGO com linhas NÃO-BRANCAS do novo — o `−659` não corresponde a nenhuma medida. Medição correta: **3.440→2.964 linhas totais (−476)** ou 3.236→2.781 não-brancas (−455); `numstat` do commit = **+93/−569**.

---

### v7.108.0 (2026-07-25) — 📊 Resumo do dia RICO vira o padrão + cron agendado (dono aprovou)

Dono recebeu o resumo semanal rico (one-off) e decidiu: *"esse será o padrão relatório diário e deverá ser enviado para meu número"*. Implementado end-to-end na mesma sessão: **(1) RPC v4** (`daily_report_rich_v4`, DROP+CREATE de novo pelo overload) — jsonb ganha `prev` (mesmas métricas do **MESMO dia da semana anterior** — varejo tem sazonalidade de dia-da-semana, sáb compara com sáb), `category_mentions` (varredura das msgs `content`+`transcription` contra `p_categories` jsonb — "o que procuraram" por nº de conversas, a métrica mais fiel da auditoria de marcas), `human_panel_msgs/convs` (respostas pelo painel vs celular) e `nps_sent` (enquetes disparadas no dia). **(2) Formatter rico** (`dailyReport.ts`): deltas ▲/▼% vs dia anterior equivalente (base <10 mostra só o valor, sem % ruído), sub-linhas ↳ (novos/recorrentes, no horário/fora), linha NPS "X enquetes · Y votos", seção "🛒 O que procuraram" por categoria (substitui top buscas quando presente), `fmtMinutes` (232→"3h52") e **⚠️ Pontos de atenção automáticos** (5 regras determinísticas: mediana >60min; transbordos sem resposta; respostas só pelo celular → sem medição por atendente; NPS travado — 0 enquetes ou enquetes sem voto; ≥5 msgs fora do horário). Campos novos são OPCIONAIS → sem eles o layout legado é preservado (compat provada nos testes). `REPORT_CATEGORIES` exportado do formatter = fonte única (edge fn passa pra RPC, como DEFAULT_BRANDS). **(3) Edge fn**: param `to_phone` (destinatário fixo — pedido do dono; `test_phone` vira alias) + passa `p_categories`. **(4) Cron agendado** (`daily_report_cron`, upsert por jobname): `daily-manager-report-eletropisov2` dom-sex **18h30 SP** (fechamento 18h +30min) e `-sab` **12h30 SP** (fecha 12h), body `{instance_id, to_phone: 5581993856099}` — mesmo padrão vault/`net.http_post` dos outros crons. **E2E real:** disparo idêntico ao do cron → 200 `sent:1`, relatório de HOJE no WhatsApp do dono com deltas reais ("24 ▲20% (sáb ant.: 20)", categorias, marcas, atenção). tsc 0 · deno 0 · vitest **2017/0** (+4) · types regen. **Pendências:** gestores sem `personal_whatsapp` (quando cadastrarem, remover `to_phone` do cron pra voltar à lista); config/UI toggle+horário por agente (follow-up); semanal como feature (dono aprovou o rico como DIÁRIO; semanal segue manual).

---

### v7.107.0 (2026-07-25) — 🏷️ Marcas citadas de verdade no resumo do gestor (varre mensagens, não tags do LLM)

Dono recebeu o resumo semanal (one-off 20–25/07 via RPC 6× + agregação) e questionou *"por que só 1 marca citada?"* → **auditoria profunda** achou 3 camadas: **(1) medição** — o `top_brands` da RPC contava SÓ tags `marca%:%` gravadas pelo LLM via tool `set_tags` em `ai_agent_runs.tools_called` → capturou **1 de ~27 menções reais** na semana (4%); o detector determinístico R115 (`detectBrand`) grava `marca_citada:` direto em `conversations.tags` — lugar que a RPC nem lia (e tag durável não tem timestamp por dia); **(2) pipeline** — 104 das 956 msgs da semana (11%) têm o texto em `conversation_messages.transcription` (53 áudios transcritos + 51 fotos descritas), invisível pra qualquer scan de `content`; a FOTO é a fonte mais rica de marca (describe-image lê a embalagem: "marca Lorenzetti visível", "caixa d'água Fortlev") — 1/3 das menções reais; **(3) dicionário** — `DEFAULT_BRANDS` (44) não tinha NENHUMA cerâmica (core do negócio!) nem HDL/Lorenzetti/Taschibra/Sil/Incenor/Eliane/Biancogres, todas citadas por leads reais. E a causa de FUNDO é comportamental (medição perfeita não muda): só ~10% das conversas citam marca, estável 4 semanas (21-34 menções, 13-15 marcas distintas/sem) — o cliente compra por categoria+cor+medida+preço (*"pode ser qualquer marca com melhor preço"*), a IA JÁ pergunta preferência (19 outgoing/sem). **Fix:** migration `daily_report_brands_scan_messages` — `get_daily_manager_report` ganha `p_brands text[]` (DROP+CREATE pra evitar overload ambíguo no PostgREST) e o `top_brands` varre `content`+`transcription` das msgs incoming do dia com fronteira de palavra (política do `detectBrand`: "coralina"≠"coral"; 1 linha por msg×marca; limit 5→10); `p_brands` null → fallback legado set_tags (chamador antigo não quebra — smoke provou identidade). Edge fn passa `DEFAULT_BRANDS` (fonte única TS); lista ampliada +25 (cerâmicas Eliane/Incenor/Biancogres/Incefra/Portobello/Cecrisa/Formigres; Lorenzetti+grafia "lorenzeti"; HDL/Taschibra/Ourolux/Steck/Margirius/Sil/WEG…; SEM Elizabeth/Karina — colidem com nome de pessoa e o detectBrand taguearia apresentação de lead); formatter: `brandDisplay` (slug→"La Fonte"/"HDL"; sigla só em palavra única ≤3) + top 3→5 na linha. **Smoke prod 6 dias:** 27 menções na semana (era 1); 23/07 = Brasilit 2 · Incenor 2 · Biancogres · Celite · Eliane · Lorenzetti. **E2E real:** relatório de 23/07 reenviado ao dono via caminho do cron (`net.http_post`+vault) — 200, `sent:1`, linha de marcas presente. tsc 0 · deno 0 · vitest **2013/0** (+3) · types.ts regen. Deploy: migration aplicada + edge fn `daily-manager-report` (CLI scoop). **Backlog mantido (não implementado):** brand-filter na qualificação (lead responde marca → busca filtra; v7.55.0).

---

### v7.106.0 (2026-07-25) — 📊 Resumo do dia pros gestores por WhatsApp (daily-manager-report)

Dono trouxe um modelo de relatório diário (17h30) pros gestores; critiquei o mockup (números que não fechavam entre si: 34≠18+17, gráfico somava 58; corte 17h fixo perde o fim do expediente; produtos sem contagem) e implementei a versão com **contrato de consistência**: *atendimento* = conversa com ≥1 msg incoming no dia (SP); *novo* = contact criado no dia (novos+recorrentes = total por construção); histograma = hora da 1ª msg do dia por conversa (soma = total); *transbordo* = **conversa distinta** com `handoff_queue_events` no dia (rotações/requeues NÃO inflam); *1ª resposta humana* = min(outgoing com `sender_id`, `human_handling_at` — vendedor pelo CELULAR tem `sender_id` NULL, lição v7.94) após o 1º evento, com **mediana + ⚠️ pendentes**; vendas = `conversion_funnel_events` stage `conversion`; NPS por bucket (Bom/Regular/Ruim); top produtos = queries reais do `search_products` em `ai_agent_runs.tools_called` (com contagem); horas fora do expediente marcadas via `business_hours` do dia da semana (sábado usa a janela do sábado). **3 peças novas:** RPC **`get_daily_manager_report`** (jsonb, 1 chamada server-side — egress mínimo; REVOKE anon/authenticated, só service_role; migrations `daily_manager_report_rpc`+`_v2`), formatter puro **`_shared/dailyReport.ts`** (+15 testes vitest) e edge fn **`daily-manager-report`** (verifyCronOrService; `test_phone` pra teste ou gestores via `personal_whatsapp` com opt-out/pausa — mesmo critério do notify-manager-nps; reusa `sendUazapiText`). O teste do RPC contra os dados de ONTEM pegou 2 defeitos de definição antes do envio (36 eventos→9 conversas; mediana vazia porque celular não tem `sender_id`) — corrigidos na fonte. **E2E real:** 2 relatórios enviados ao dono (5581993856099) com dados reais EletropisoV2 — hoje parcial ("até 09:31") e sexta completa (35 atendimentos = 20+15, 161 msgs 156/5, 9 transbordos mediana 29min ⚠️ 1 sem resposta, 2 vendas, histograma fecha em 35). tsc 0 · deno 0 · vitest **2010/0**. **Pendências:** dono aprovar formato → agendar cron no fechamento do expediente (+30min) por instância; gestores ainda sem `personal_whatsapp` (envio real usa test_phone até cadastrarem); config/UI por agente (toggle+horário) fica pra depois da validação.

---

### v7.105.0 → v7.101.1 (2026-07-02 a 07-09)

Movidas p/ [[wiki/changelog/2026-07-part1]] (foto de torneira virava "cano" — multi-categoria travada sob router; resiliência de rede da Fila + a11y de dialogs; cache 48h com sonda + faxineiro 48h; dieta de egress; outage de egress + upgrade Pro + fix `escalate-stale-handoffs`).

---

### v7.101.0 → v7.85.0 (2026-06-12 a 06-28)

Movidas p/ [[wiki/changelog/2026-06-part6]] (cards "Atendimento" do Dashboard do Gestor: teto de 7 dias, msg do lead + atendente + modal, SLA em modal, Gestão em destaque + filtro 24h; contato compartilhado vCard → transbordo; NPS ao finalizar + alerta ao gestor; hardening do sanitizer; `except_keywords`; trava de atendimento humano; gestor pausa atendentes; auditoria 2026-06-14 e os 3 riscos críticos; `specialist_model` configurável; descomissionamento do Fluxos v3.0; Ondas 1 e 2 da auditoria do AI Agent; reatribuir sem gestores; vaga de emprego; telefone na lista + nome "Garagem").

---

### v7.84.0 → v7.80.0 (2026-06-11)

Movidas p/ [[wiki/changelog/2026-06-part5]] (venda detectada na fase do vendedor + fix "Tá certo"; funil de conversão real 5 etapas + lead score; taxonomia de motivos de contato; "Motivos de conversa" religado + ranking vendedores EN×PT; cutucada/transbordo por inatividade citam o pedido).

---

### v7.79.0 → v7.77.0 (2026-06-09/11)

Movidas p/ [[wiki/changelog/2026-06-part4]] (busca server-side acha conversa fora do filtro + deep-link; preview da lista congelava na última msg da IA — trigger fonte única + backfill 725; nome extraído pela IA vence o pushname na exibição — caso "oi"→Jessica; vendedores Android sem enviar foto — aba velha pós-deploy + auto-recuperação de versão + upload anti-zumbi + telemetria).

---

### v7.76.0 → v7.75.0 (2026-06-09)

AI Agent: handoff repetia + IA falava após transbordo — gate de silêncio durável (`status_ia→shadow` por `handoff_created`/`human_assigned`), handoff idempotente, webhook não rebaixa `shadow→ligada` (ai-agent v260/webhook v15). Helpdesk: foto HEIC envia (`normalizeOutboundImage` magic bytes + `heic2any`→JPEG). Detalhe: memórias `project_handoff_repeat_silence_v776` · `project_heic_photo_send_v775`.

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
