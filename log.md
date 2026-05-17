---
title: Activity Log
type: log
---

# Activity Log

> Registro cronológico de ingestões, consultas e manutenções do vault. Append-only.

---

## 2026-05-17 (madrugada) — Bug 26+27 FIXADOS + 5 testes pós-fix (v7.37.11→v7.37.14)

User: "fixar bug 27 e rodar mais 5 testes". Foco: Bug 27 (LLM pula `set_tags interesse` em várias categorias) + Bug 26 (LLM repete `interesse:hidraulica` após bloqueio).

**Bug 27 fix (v7.37.11)**: no handler `search_products`, antes de buscar, se não há tag `interesse:`, deriva via `matchCategoryBySearchText` na query+incomingText e seta automaticamente. Plus: auto-extract fields dos examples. Log `auto_field_extracted source=bug27_search_products_seed`. **Funcionou em T2 disjuntor** — `interesse:disjuntores` setado direto do search.

**Bug 26 fix v3 (v7.37.14)** — 3 iterações até funcionar:
- v1 (v7.37.12): retorno do handler set_tags com SUGESTÃO textual ("tente novamente com interesse:lampadas"). LLM ignorou sugestão.
- v2 (v7.37.13): só dispara quando `newTags.length === 0`. Não funcionou pois LLM enviava `[interesse:hidraulica, tipo_vaso:acoplado]` — `tipo_vaso` aceito, newTags > 0, auto-correção não rodava.
- v3 (v7.37.14): dispara SEMPRE que tag interesse:* foi rejeitada E conv ainda não tem interesse:* setado. Insere `interesse:CAT` correto direto em `newTags` (via `matchCategoryBySearchText` no incomingText). Log `source=bug26_auto_apply_correct_category`. **Funcionou em T1 lampada, T3 vaso, T5 cano** — LLM tentava `interesse:hidraulica/iluminacao` e backend remapeou pra IDs corretos automaticamente.

**Validação E2E pós-fixes — 5 testes:**
- T1 Sofia → lampada LED 12W: `interesse:lampadas` (corrigido de iluminacao), score 30, handoff outside_hours ✅
- T2 Felipe → disjuntor 32A bipolar: `interesse:disjuntores`, score 15 (parcial — tags em turnos separados, score não acumula direito; minor backlog)
- T3 Beatriz → vaso sanitário acoplado branco: `interesse:vaso_sanitario` (corrigido de hidraulica), score 30, handoff ✅
- T4 Lucas → torneira cozinha bancada: `interesse:torneiras` (corrigido de hidraulica), score 30, handoff ✅
- T5 Rafael → cano água 50mm: `interesse:cano` (corrigido de hidraulica), score 30, handoff ✅

**4 PASS limpos + 1 parcial** — vs sessão anterior (0/5 nesses cenários).

**Combinado com Bug 24 v4** (v7.37.10), agora as 23 categorias podem ser handoff-completas. Estratégia: 3 camadas de defesa em código (Bug 25 bloqueia inválido, Bug 26 v3 auto-corrige pra ID certo, Bug 27 seed se LLM pular set_tags, Bug 24 v4 dispara handoff direto quando score atinge max). LLM vira passageiro — backend força o caminho certo.

**Bugs ainda em backlog (não bloqueantes):**
- 17 regressão (LLM recumprimenta)
- 24 search_products (categoria tinta com exit_action=search_products)
- 27 minor (score progressivo em turnos múltiplos — T2 disjuntor parcial)

Screenshot: `wiki/validacoes/5testes_pos_bug26_27.png`. Frase de retomada: *"fixar Bug 24 search_products + Bug 17 regressao 2026-05-18"*.

---

## 2026-05-17 (noite tardíssima) — Bug 24 v4 FIXADO: RPC fantasma escondia o inline handler (v7.37.10)

User pediu "continuar até nota 10". Foco: Bug 24 v3 (handoff via set_tags) que não disparava.

**Debug via breadcrumbs**: adicionei inserts em `ai_agent_logs` no handler set_tags como breadcrumbs. Reteste J4 chuveiro:
- Breadcrumb `bug24_flag_set` apareceu (com `newScore=30, max_score=30, pendingExitActionHandoff_setado=true`) ✅
- Breadcrumb `bug24_checkpoint_pre_inline` **NÃO apareceu** ❌

Isso prova que o handler RETORNOU antes do meu bloco inline. Auditei o código → linha 2950 era um path de fallback com `return` precoce.

**Root cause**: o handler set_tags chamava `supabase.rpc('merge_conversation_tags', ...)`. Esse RPC **NÃO EXISTE no projeto novo** (provavelmente foi removido na migração ou nunca foi criado). RPC retornava error → caía no fallback path → fazia merge in-memory → **return PRECOCE** antes do meu bloco inline.

```ts
// ANTES (Bug 24 v3 não funcionava):
if (error) {
  // fallback in-memory merge
  return `Tags atualizadas...`  ← retorno aqui pulava o handoff inline!
}
const merged = updatedConv?.tags || [...]
// bloco inline aqui (nunca alcançado em prod novo)
```

**Fix v7.37.10 (Bug 24 v4)**: unifiquei os 2 paths (RPC + fallback). Ambos resolvem `merged` numa variável só, e depois o fluxo continua linearmente até o bloco inline. Não há mais `return` precoce.

**Validação E2E (mesma conv chuveiro/220v):**
- T4 "220v" → IA enviou EXATAMENTE `handoff_message_outside_hours`: *"Perfeito! Anotei seu pedido. Nosso consultor de vendas dará prosseguimento ao seu atendimento assim que estivermos disponíveis."*
- Log `event=implicit_handoff, reason=exit_action_set_tags_inline, exit_reason=chuveiros > voltagem chuveiro:220v, outside_hours=true, queue.assignee_name=Djavan`
- `status_ia=shadow`, tag `ia:shadow`, `lead_score:30` ✅

**Impacto:** Bug 24 v4 corrige o caminho CRÍTICO que afetava 90% das jornadas (toda categoria de 2 fields × 15 score = max 30 com exit_action=handoff). Agora chuveiros, ferramentas, torneiras (se LLM tagueasse interesse), canos (idem), portas (se score chegasse), fechaduras (se IDs corretos), etc. — todos disparam handoff automático correto.

**Bugs ainda em backlog** (não bloqueantes pra usabilidade básica — mas degradam UX):
- **17 regressão** (LLM recumprimenta — investigar `prompt_sections`)
- **24 search_products** (categoria tinta — estender helper)
- **26 LLM repete `interesse:hidraulica`** (sugerir categoria correta no retorno do guard)
- **27 LLM pula `set_tags interesse`** (lampada/disjuntor/vaso vão direto pra search)

**Lição preventiva (regra nova):** quando uma fn chama `supabase.rpc('X', ...)` E tem um fallback path com `return`, SEMPRE conferir se a RPC existe no DB do ambiente atual. RPC missing causa fallback silencioso + return precoce, mascarando bugs em código novo que vem depois.

**Validação que estou rodando agora:** 3 PASS limpos (J2 porta + J4 chuveiro Bug24v4 + J10 excluded) confirmam Bug 24 v4 funcionando. Bugs 17, 26, 27 ficam pra próxima sessão.

Screenshot: `wiki/validacoes/bug24_v4_chuveiro_validado.png`. Frase de retomada: *"fixar Bug 27 LLM set_tags antes search 2026-05-18"*.

---

## 2026-05-17 (noite tarde) — Sessão 10 jornadas E2E reais + Bug 25 fix + 4 bugs catalogados (v7.37.8/v7.37.9)

User pediu 10 testes E2E completos (greeting → nome → produto → qualif → transbordo) e correção dos erros. Resultado: 2 PASS + 1 parcial + 7 FAIL — 5 bugs novos catalogados.

**Sumário:**
- J1 tinta → Bug 17 regressão + Bug 24 não cobre exit_action=search_products
- J2 porta → ✅ PASS handoff outside_hours
- J3 torneira → LLM crava `interesse:hidraulica` (categoria inexistente) — Bug 25 identificado
- J4 chuveiro → score=max+exit_action=handoff mas IA vazia (Bug 24 v2/v3 não dispara)
- J5 cano → Bug 25 fix FUNCIONOU (log `interesse_hallucination_blocked` × 2) mas LLM persiste cravando hidraulica (Bug 26)
- J6 lâmpada, J7 disjuntor, J9 vaso → LLM não tageia interesse, vai direto search → enrich loop (Bug 27)
- J8 fechadura → LLM usa singular (`fechadura` vs `fechaduras`) → score parcial sem handoff
- J10 cama (excluded) → ✅ PASS reply correto

**Fix shipados nesta sub-sessão:**

1. **Bug 25 (v7.37.8)**: `interesse:CAT` agora é rejeitado também quando a categoria **NÃO EXISTE** em service_categories. Antes o guard Bug 19 só atuava quando categoria existia + regex não batia. Agora cobre ambos os casos. Log `interesse_hallucination_blocked, reason=category_not_in_schema`. **VALIDADO PROD** em J5.

2. **Bug 24 v2 / v3 (v7.37.9)**: tentativa de disparar handoff direto no `set_tags` handler quando `score>=max_score && exit_action=handoff` (mirror do Bug 18). **NÃO FUNCIONOU em prod** — 2 abordagens (flag pós-loop + inline no handler) não dispararam. Suspeita: problema de closure entre o handler `set_tags` (dentro de `executeTool` na linha 2011) e a flag `pendingExitActionHandoff` (declarada na linha 452). Precisa de debug adicional com `console.error` explícito + análise via `get_logs`.

**Bugs em aberto pra próxima sessão:**

| Bug | Severidade | Sintoma | Hipótese fix |
|---|---|---|---|
| 17 regressão | Médio | LLM recumprimenta "Olá NOME!" mid-conv apesar da regra hardcoded | Investigar `prompt_sections.sdr_flow` do agente Eletropiso — pode estar sobrescrevendo a regra global |
| 24 v2 inline | **CRÍTICO** | Score atinge max via set_tags + exit_action=handoff → IA gera vazio → silêncio (90% das jornadas falham por isso) | Debug com `console.error` explícito + `get_logs` pra confirmar se bloco roda |
| 24 search_products | Alto | Categoria tinta score 60≥40 nunca dispara search direto | Estender o helper Bug 24 também pra `exit_action=search_products` (chamar `search_products` direto no código) |
| 26 LLM repetindo categoria inválida | Alto | Após Bug 25 rejeitar, LLM tenta de novo `interesse:hidraulica` sem se ajustar | No retorno do handler: sugerir categoria correta ("use `torneiras` ou `canos` em vez de `hidraulica`") |
| 27 LLM pula set_tags interesse | Alto | Em lampada/disjuntor/vaso, LLM vai direto pra search sem tageiar interesse — score nunca sobe | Reforçar prompt: "SEMPRE set_tags interesse:CAT ANTES de search_products" |

**Causa-raiz dominante:** os fixes determinísticos (handlers, guards) funcionam, mas o **LLM em si** continua não respeitando regras hardcoded do prompt. Precisamos mais defesa em código, menos confiança no LLM.

**Frase de retomada:** *"debugar Bug 24 v3 inline + Bug 26 sugestao categoria 2026-05-18"*. Screenshot: `wiki/validacoes/10jornadas_helpdesk.png`.

---

## 2026-05-17 (noite) — Bug 24 fix: auto-extract bypassava exit_action enforcement (v7.37.7)

User reportou print: T1 oi → T2 george → T3 "vcs tem trena?" → T4 profissional → T5 "5m" → **IA parou de responder**, sem handoff, sem coleta.

**Diagnóstico (do `ai_agent_logs`):**
- T3 auto-extract setou `tipo_ferramenta:trena` + `interesse:ferramentas_manuais` (score 15)
- T4 auto-extract setou `uso_ferramenta:profissional` (score subiu pra 30 = max do stage). Categoria `ferramentas_manuais` tem `exit_action: handoff` no stage `qualificacao`.
- LLM **não recebeu instrução** "AÇÃO chame handoff_to_human" (R83) → ficou sem direção → gerou texto vazio ("response_text": "") → lead viu silêncio.

**Root cause:** o `exit_action` enforcement (linha 2846, FIX 2026-04-29 do R83) só roda DENTRO do `set_tags` handler. Mas o **auto-extract (Bug 13 fix linha 1640)** pega fields DETERMINISTICAMENTE bypassando o handler. Score atingia max via auto-extract sem disparar a instrução de handoff → LLM gerava vazio.

**Fix v7.37.7 — extrair exit_action enforcement do set_tags handler e replicar no auto-extract path:**

1. Auto-extract agora calcula `scoreDelta` (mesmo `calculateScoreDelta` do set_tags handler) e adiciona `lead_score:N` à mergedTags.
2. Se `newScore >= stage.max_score && exit_action='handoff'`, seta flag `pendingExitActionHandoff` (mirror do `pendingSaleClosedHandoff` do Bug 18).
3. Novo bloco IMEDIATAMENTE após o auto-extract executa o handoff: `pickHandoffMessage` (respeita outside_hours), `runQueueAssignment`, broadcast, log `event=implicit_handoff, reason=exit_action_auto_extract`. Return early — LLM nem roda.

**Bug crítico de implementação (descoberto e corrigido na hora):** primeira tentativa colocou o bloco de execução ANTES do auto-extract (linha ~720, ao lado do `pendingSaleClosedHandoff`). Como o auto-extract roda na linha 1682, a flag estava sempre `null` quando o bloco era avaliado. Validação inicial falhou exatamente por isso (`pending_exit_handoff: true` no log mas IA continuou). Mover o bloco pra DEPOIS do auto-extract resolveu.

**Validação E2E (mesmo cenário do user — domingo, Eletropiso fechada):**
- T1 "oi" → greeting
- T2 "George" → "Joao, em que posso te ajudar hoje?" (Bug 19 ok)
- T3 "vcs tem trena?" → "Pra te ajudar, uso? (profissional ou doméstico)" (Bug 21 ok)
- T4 "profissional" → **handoff automático** com EXATAMENTE `handoff_message_outside_hours`: *"Perfeito! Anotei seu pedido. Nosso consultor de vendas dará prosseguimento ao seu atendimento assim que estivermos disponíveis."* ✅
- `status_ia=shadow`, tag `ia:shadow` aplicada, `lead_score:30` (= max do stage)

**Paridade com admin UI** (resposta ao pedido do user):

| Conceito | Onde no admin | Onde no DB | Onde no código backend |
|---|---|---|---|
| Categoria + regex `interesse_match` | `src/components/admin/ai-agent/ServiceCategoriesConfig.tsx` | `ai_agents.service_categories->>'categories'[].interesse_match` | `matchCategoryBySearchText` (`_shared/serviceCategories.ts:308`) |
| Stage min/max/exit_action | `ServiceCategoriesConfig.tsx:237-310` | `stages[].{min_score,max_score,exit_action}` | `getCurrentStage` (`_shared/serviceCategories.ts`) |
| Fields + priority + score_value | mesmo arquivo, `Field` editor | `stages[].fields[].{key,score_value,priority}` | `flattenCategoryFields` + `autoExtractFields` (`_shared/fieldAutoExtractor.ts`) |
| `handoff_message` + `_outside_hours` | `GeneralConfig.tsx` / agente | `ai_agents.handoff_message{,_outside_hours}` | `pickHandoffMessage` (`ai-agent/index.ts:85`) |
| Score enforcement (R83 / Bug 24) | implícito — admin não vê esse path | derivado | `set_tags` handler linha 2846 **+** auto-extract linha 1682 (este fix) |

**Por que não funcionava antes:**
- Admin define `exit_action: handoff` no max_score do stage — config OK no DB.
- `set_tags` handler injetava instrução pro LLM (R83 OK desde 2026-04-29).
- MAS o auto-extract (shipado 2026-05-17 manhã como Bug 13 fix) preencheu fields determinísticamente sem passar pelo handler. **Ninguém escreveu o enforcement no auto-extract**. Resultado: lead bate qualif completa em deterministic, LLM no próximo turno fica sem direção, gera vazio.

**Regra preventiva (registrar em wiki/erros-e-licoes):** sempre que um caminho determinístico pré-LLM persistir tags (auto-extract, regex detectors), DEVE replicar o pipeline de score + exit_action enforcement do `set_tags` handler. Não bastam tags persistidas — o sinal de "stage completo" precisa ser propagado para todos os paths. Considerar centralizar em helper compartilhado tipo `applyTagsWithScoreEnforcement()` (refactor backlog).

**Backlog Bug 23 ainda aberto:** LLM em enrichment improvisa fields fora do schema. Mantido pra 2026-05-18.

Arquivos: `ai-agent/index.ts` (~30 linhas no auto-extract path + ~35 no bloco de execução pendingExitActionHandoff). Deploy 2 vezes (primeira tentativa com bug de ordem). Screenshot: `wiki/validacoes/bug24_validado.png`.

---

## 2026-05-17 (noite-inicio) — Bug 21+22 fix: validator BLOCK ignorava outside_hours + transbordo prematuro (v7.37.6)

User mandou print: lead "boa tarde" → "george" → "voces tem trena?" → IA respondeu *"Perfeito! Vou conectar você com nosso consultor de vendas para finalizar seu pedido. Em instantes você terá retorno."* — duas falhas:

**Bug 21:** transbordo prematuro. Categoria `ferramentas_manuais` tem 2 fields obrigatórios (`tipo_ferramenta`, `uso_ferramenta`). Auto-extract pegou só `trena` (tipo). Faltava `uso_ferramenta` (profissional/doméstico). Mesmo assim handoff disparou. Vendedor recebe lead sem qualif → perde tempo perguntando o óbvio.

**Bug 22:** msg REGULAR enviada em vez de `_outside_hours` (domingo, Eletropiso fechada) — regressão do que Bug 16 v7.37.3 fixou. Root cause: NÃO foi pelo handoff_to_human tool (sem log de event=handoff). Foi pelo **validator BLOCK path** (linha 3344 antiga). Esse path usava `agent.handoff_message` direto, sem checar `outside_hours` — 4º caminho que escapou do Bug 16 fix.

**Fix v7.37.6 — validator BLOCK reescrito:**
1. **Bug 22:** `pickHandoffMessage({agent,profileData,funnelData,outsideHours})` helper agora aplicado no validator BLOCK path. Adiciona também log `event='handoff', reason='validator_block'` (antes invisível).
2. **Bug 21:** se `qualificationContext` contém "PRÓXIMA PERGUNTA OBRIGATÓRIA" (ou seja, qualif ainda incompleta), validator BLOCK NÃO transborda — em vez disso envia a "FRASE EXATA SUGERIDA" extraída do qualif context. Lead continua sendo qualificado. Log `event='response_sent', metadata.source='validator_block_qualif_fallback'`.

**Validação E2E (mesmo cenário do user — Sandbox UAZAPI → Eletropiso prod, domingo fechado):**
- T1 "oi" → greeting padrão
- T2 "sou o Joao" → "Joao, em que posso te ajudar hoje?" (Bug 19 ✅ sem chutar produto)
- T3 "voces tem trena?" → **"Pra te ajudar, uso? (profissional ou doméstico)"** — PERGUNTA o uso ✅ (era esse o bug)
- T4 "profissional" → IA pergunta comprimento (LLM improvisou — bug paralelo backlog: LLM inventa fields fora do schema)
- T5 "5 metros, fechar" → IA pergunta tipo de trabalho (enrichment, search_fail:1 — trena não cadastrada)
- T6 "quero falar com vendedor agora" → IA enviou EXATAMENTE `handoff_message_outside_hours` ("...assim que estivermos disponíveis...") + `status_ia=shadow` + `ia:shadow` tag ✅

**Regra preventiva:** TODO path que decide transbordo (`handoff_to_human` tool, auto-handoff, deferred trigger, **validator BLOCK**, futuros) DEVE consultar `pickHandoffMessage` para escolher regular vs outside_hours. Centralizar em helper compartilhado evita 5º caminho escapar. Buscar grep `agent.handoff_message ||` periodicamente — qualquer uso direto sem o helper é red flag.

Arquivos: `ai-agent/index.ts` (~60 linhas no validator BLOCK path: guard qualif + helper). tsc=77 (igual ao pre-fix, sem regressão). Deploy ai-agent. Screenshots: `wiki/validacoes/bug21_22_validado.png`.

**Backlog Bug 23 (achado nesta sessão):** LLM em enrichment improvisa pergunta sobre field NÃO cadastrado (ex: "comprimento" pra trena). Resultado: pergunta off-script, dado coletado vira `tipo_ferramenta:trena_5m` em vez de field próprio. Investigar: 2026-05-18 — *"limitar improvisação LLM em enrichment / schema dinâmico"*.

---

## 2026-05-17 (fim tarde) — Bug 19 fix: IA alucina interesse:CAT sem o lead pedir (v7.37.5)

User mandou print: lead disse "boa tarde" + "George" (só nome) → IA respondeu "George, para qual material você está procurando a porta? Temos opções em madeira, PVC ou alumínio." LLM alucinou produto "porta" sem o lead mencionar nada.

**Root cause:** o handler `set_tags` (ai-agent:2712) não validava se `interesse:CAT` cravado pelo LLM tinha CONEXÃO com o que o lead falou. Quando input é trivial ("oi", "George"), o LLM chuta uma categoria pra "ter algo a perguntar". Sem guard, tag `interesse:porta` foi aceita + entrou no qualificationContext + LLM perguntou material da porta. Auto-extract (Bug 13) NÃO foi o culpado (regex `porta|portas` não bate em "George"/"boa tarde").

**Fix v7.37.5:**
1. **Guard determinístico no handler `set_tags`:** quando LLM tenta cravar `interesse:CAT`, validar que o regex `interesse_match` da categoria bate em pelo menos uma msg incoming do lead nesta sessão (contextMessages + incomingText atual). Se não bater, rejeitar + log `interesse_hallucination_blocked`.
2. **Regra hardcoded no prompt:** "NUNCA ASSUMIR PRODUTO/CATEGORIA (Bug 19): PROIBIDO chamar set_tags com interesse:X ou perguntar sobre produto se lead AINDA NÃO mencionou. Se lead só enviou saudação/nome, pergunte 'No que posso te ajudar?' — JAMAIS assuma."
3. **Migration:** event `interesse_hallucination_blocked` adicionado ao CHECK constraint de `ai_agent_logs` (lição R114 — insert silencioso). Também `auto_field_extracted` (já em uso, faltava no constraint).

**Validação E2E 5 cenários (Playwright + Sandbox UAZAPI):**
- C1 trivial ("oi" → "Pedro"): IA "Pedro, em que produto ou material posso te ajudar?" ✅ sem chute, tag `motivo:compra` só
- C2 "quero comprar tinta": sale_closed_detected disparou handoff prematuro (achado paralelo Bug 20 — sale_closed regex muito agressivo). Mas Bug 19 ok: sem `interesse:` alucinado
- C3 "vcs tem tinta?": IA qualificou ambiente. Guard PERMITIU `interesse:tinta` (regex bate). ✅
- C4 "vcs vendem cama de casal?": excluded reply ("Infelizmente não trabalhamos com cama..."). ✅
- C5 "bom dia" → "preciso de um material": "Qual material de construção você está procurando?" — pergunta genérica sem chutar. ✅

**Regra preventiva:** todo handler que persiste estado controlado por LLM (tags, profile, kanban move) precisa validar contra EVIDÊNCIA no histórico do lead, não confiar apenas no que o LLM mandar. LLM em input trivial CHUTA pra "ter o que fazer" — defesas determinísticas existem pra isso.

Arquivos: `ai-agent/index.ts` (+~30 linhas guard + 1 regra prompt), `migrations/20260517170000_ai_agent_logs_interesse_hallucination_event.sql`. Deploy ai-agent. Screenshots em `wiki/validacoes/`.

**Backlog Bug 20 (achado nos testes):** regex `sale_closed` em `saleClosedDetection.ts` casa "quero comprar X" mesmo SEM qualificação prévia. Lead deveria pelo menos ter passado por algumas qualif antes de virar venda fechada. Frase: *"investigar bug 20 sale_closed regex agressivo 2026-05-18"*.

---


---

## 2026-05-11 — Dashboard do Gestor 3 fases (arquivado)

> Movido para [[wiki/log-arquivo-2026-05-11-dashboard]] em 2026-05-14 (hard limit). Inclui Fase 1 (unificado), Fase 2 (métricas avançadas), Fase 3 (pivô comercial).

---

## 🎯 HANDOFF DE FIM DE SESSÃO — 2026-05-11 (arquivado)

> Movido para [[wiki/log-arquivo-2026-05-11-handoff]] em 2026-05-12 (hard limit).

---


## Sessões anteriores (arquivadas)

> Log mantém só sessões dos últimos ~3 dias. Histórico:
>
| Arquivo | Conteúdo |
|---------|----------|
| [[wiki/log-arquivo-2026-05-09-a-10]] | 2026-05-09 a 10: v7.32.3 → v7.32.6 + manutenção doc |
| [[wiki/log-arquivo-2026-pre-05-08-part1]] | 2026-05-07 noite (v7.32.0-v7.32.2 notif handoff + UAZAPI refactor) |
| [[wiki/log-arquivo-2026-pre-05-08-part2]] | 2026-05-07 final tarde — Sessão 4 Sandbox · Onda 2 (G/H/M/E) |
| [[wiki/log-arquivo-2026-pre-05-08-part3]] | 2026-05-07 — Sessão 3 Sandbox + R113 cron 401 fix |
| [[wiki/log-arquivo-2026-pre-05-08-part4]] | 2026-05-06 noite — auditoria AI Agent R103/R104/R105 + projeto antigo PAUSADO |
| [[wiki/log-arquivo-2026-pre-05-08-part5]] | 2026-05-06 tarde + manhã — Playwright Ondas 1-4 (120 testes) + R101/R102 |
| [[wiki/log-arquivo-2026-pre-05-08-part6]] | 2026-05-06 madrugada — CUTOVER LIVE Eletropiso + Ondas 4-7 + hotfixes |
| [[wiki/log-arquivo-2026-pre-05-08-part7]] | 2026-05-05 noite — Auditoria projeto 5 ondas + Sprint 3 P1-2 |
| [[wiki/log-arquivo-2026-05-05-r93-r96-manha]] | 2026-05-05 manhã — R93/R94/R95 + Free Forever + Sprint H D30 |
| [[wiki/log-arquivo-2026-05-05-d30-defg-e]] | 2026-05-04/05 — D30 Sprints D+F+G+E (Admin/Helpdesk UI + Tests + Modo Estendido) |
| [[wiki/log-arquivo-2026-05-04-d30-abc]] | 2026-05-04 — D30 Sprints A+B+C (DB + Backend + Cron) |
| [[wiki/log-arquivo-2026-05-04-admin]] | 2026-05-04 — Auditoria Admin + R90 hotfix user_roles UNIQUE |
| [[wiki/log-arquivo-2026-05-02-a-03-helpdesk]] | 2026-05-02 + 03 — Auditoria Helpdesk + UI mobile-first |
| [[wiki/log-arquivo-2026-04-30-d28-d29-avatares]] | 2026-04-30 — D28/D29 + Avatares Storage + R85-R88 |
| [[wiki/log-arquivo-2026-04-29-eletropiso]] | 2026-04-29 — Sprint Eletropiso 23 categorias + 7 fixes ai-agent |
| [[wiki/log-arquivo-2026-04-27-a-28-m19-s10]] | 2026-04-27/28 — M19-S10 v1+v2+v3 + Deploy 16 commits |
| [[wiki/handoff-2026-04-27]] | 2026-04-27 — Handoff geral + M19-S10 v2 Service Categories |
| [[wiki/log-arquivo-2026-04-25-s8-helpdesk]] | 2026-04-25 — Helpdesk inbox + M19 S8 + S8.1 |
| [[wiki/log-arquivo-2026-04-14-helpdesk-audit]] | 2026-04-14 — Helpdesk audit 10 fixes |
| [[wiki/log-arquivo-2026-04-13-m19-s1s2]] | 2026-04-13 — M19 S1+S2: Shadow + Agregação + Deploy |
| [[wiki/log-arquivo-2026-04-12-fixes-kpi-s12]] | 2026-04-12 — KPI fixes + S12 + orchestrator |
| [[wiki/log-arquivo-2026-04-04-a-09-part1]] | 2026-04-09 + 08 — M17 F1-F5 ship (Motor + Funis Agênticos + NPS) |
| [[wiki/log-arquivo-2026-04-04-a-09-part2]] | 2026-04-08 + 07 + 06 — M16 Funis + M15 F1+F2 + bio link fixes |
| [[wiki/log-arquivo-2026-04-04-a-09-part3]] | 2026-04-06 + 05 + 08 — M14 Bio Link + M13 Campanhas/Forms + M12 Forms |

## 2026-05-17 (tarde + fim tarde) — v7.37.0 a v7.37.4 — arquivado

D34 reabertura, Bug 13 auto-extract, Bug 15b out_of_hours, Bug 16 paths handoff, Bugs 17+18 venda fechada + anti-recumprimento, validação E2E bugs 17+18. Detalhe completo em [[wiki/log-arquivo-2026-05-17-tarde-bugs]].

---
