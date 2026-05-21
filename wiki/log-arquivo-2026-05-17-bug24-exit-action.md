---
title: Log arquivo — Bug 24 fix exit_action auto-extract (2026-05-17 noite)
type: log-archive
updated: 2026-05-20
description: Arquivado de log.md em 2026-05-20 para respeitar hard limit 300 linhas. Bug 24 v7.37.7 — auto-extract bypassava exit_action enforcement.
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
