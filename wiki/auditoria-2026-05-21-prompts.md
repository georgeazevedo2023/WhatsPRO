---
title: Auditoria de Prompts e Regras Determinísticas
tags: [auditoria, prompts, regras, hardcoded, guards, ai-agent]
sources: [supabase/functions/ai-agent/index.ts, supabase/functions/_shared/*, src/components/admin/ai-agent/PromptStudio.tsx, system_settings.default_prompt_sections]
updated: 2026-05-21
audited_at: 2026-05-21
---

# Auditoria 2026-05-21 — Prompts, Regras Hardcoded e Configuráveis

Escopo: `ai-agent/index.ts` (4407 lin), 32 arquivos `_shared/*.ts`, `PromptStudio.tsx`, seed `default_prompt_sections`. Foco: o que injeta texto no `systemPrompt`, o que bloqueia/valida no código, e o que o admin pode realmente mudar.

## 1) Inventário de prompts dinâmicos (montam o systemPrompt)

Ordem real de concatenação em `index.ts:2016-2040` (15 blocos `filter(Boolean).join('\n\n')` + recency hint final):

| # | Bloco | Origem | Linhas tipicas | Variavel input | Sempre injeta? |
|---|---|---|---|---|---|
| 1 | `identitySection` | `ps.identity` + fallback hard | 3-6 | agent.name, personality | Sim |
| 2 | `businessSection` | gerado de `agent.business_info` | 5-15 | bi.hours/address/payment/delivery | Sim |
| 3 | `leadContextBlock` | hardcoded inline `index.ts:1606` | 1-2 | isReturningLead, leadName | Sim |
| 4 | `sdrSection` | `ps.sdr_flow` (Prompt Studio) | 3-10 | livre | Se preenchido |
| 5 | `productSection` | `ps.product_rules` | 3-10 | livre | Se preenchido |
| 6 | `handoffSection` | `ps.handoff_rules` | 3-10 | livre | Se preenchido |
| 7 | `tagsSection` | `ps.tags_labels` | 3-10 | livre | Se preenchido |
| 8 | `absoluteSection` | `ps.absolute_rules` | 5-12 | livre | Se preenchido |
| 9 | `hardcodedRules` | **inline `index.ts:1644-1668`** | **~25 lin em 1 string gigante** | nenhuma | **Sempre** |
| 10 | `objectionsSection` | `ps.objections` | 3-10 | livre | Se preenchido |
| 11 | `extractionInstruction` | gerado de `extraction_fields` | N+1 | extractionFields | Se houver |
| 12 | `knowledgeInstruction` | FAQ + docs do `agent_knowledge_items` | N×2 + headers | knowledgeItems | Se houver |
| 13 | `subAgentInstruction` | `agent.sub_agents` (DEPRECATED M17 F3) | varia | motivo tag | Se profileData=null |
| 14 | `dynamicContext` | `leadContext + campaignContext + tags humanizadas + blocked` | 5-15 | conversation.tags, leadMsgCount | Sim |
| 15 | `additionalSection` | `ps.additional` | livre | - | Se preenchido |
| 16 | `outsideHoursContext` | hardcoded inline `index.ts:2013` | 1 | isOutsideBusinessHours | Se OOH+toggle |
| 17 | `qualificationContext` | `buildQualificationContext` (1675-1745) | 6-25 lin | tags + service_categories | Se categoria detectada |
| Suffix | `REGRA FINAL: Chame o lead de "X"` | hardcoded inline `index.ts:2037` | 1 | leadName | Se leadName!=null |
| Suffix | `funnelInstructionsSection` | profile/funnel data | varia | M17 F2 | Se profile/funnel ativo |

Helpers chave que produzem texto:
- `buildQualificationContext(tags, agent)` — `index.ts:1675-1745`. Computa stage, score, próxima pergunta via `service_categories`. **2 modos:** multi-interesse (R129) e single (R103). Saída em portugues com emojis (🎯🗣️⚠️🚫).
- `buildEnrichmentInstructions(tags, step, max, brandNotFound, agent, search)` — `index.ts:2180-2253`. Saída tipo `AÇÃO: faça UMA pergunta...`. Chama `formatPhrasing` 1x.
- `buildQualificationChain(tags, pendingTags, name)` — `index.ts:2255-2274`. Constroi string `NOME > interesse > produto > aplicacao > acabamento > marca > qtd > area`. Usada em handoff motivo.
- `formatPhrasing(template, field, answeredCountInStage)` — `_shared/serviceCategories.ts:566-581`. Substitui `{label}`/`{examples}`. **R131:** a partir da 2ª pergunta do stage, sobrescreve template inteiro por `"Qual {label}? ({examples})"` (template do admin ignorado).
- `pickHandoffMessage` — `index.ts:74-110`. Cascata profile→funnel→agent + outside_hours.

prompt_sections no DB (`system_settings.default_prompt_sections`, seed `20260401000000_phase1_validator_prompt_studio_foundation.sql:161-173`):
- 7 keys editáveis: `identity, sdr_flow, product_rules, handoff_rules, tags_labels, absolute_rules, objections, additional` (`business_context` é auto-gerado read-only). Cada tenant pode sobrescrever via `ai_agents.prompt_sections jsonb`. Defaults são fonte de fallback quando string vazia.
- Maior default: `sdr_flow` ~270 chars; menor: `additional` 0.

## 2) Inventário de regras hardcoded no código (texto direto OU lógica)

| # | Regra / Texto | Local | Configurável UI? | Risco |
|---|---|---|---|---|
| R1 | Bloco `REGRAS INVIOLÁVEIS (hardcoded)` ~25 linhas | `index.ts:1644-1668` | ❌ não | Alto — tech debt |
| R2 | `HANDOFF_PATTERNS` (5 regex de detecção handoff) | `index.ts:54-60` | ❌ não | Médio |
| R3 | Greeting tokens normalizer (`['oi','olá',...,'noite']`) + dedup letras repetidas | `index.ts:1465-1471` | ❌ não | Médio — pt-BR-only |
| R4 | `leadContextBlock` (novo vs returning) | `index.ts:1606-1608` | ❌ não | Baixo |
| R5 | `outsideHoursContext` hint | `index.ts:2013` | ❌ não | Baixo |
| R6 | `REGRA FINAL: Chame o lead de "X"` (recency suffix) | `index.ts:2037` | ❌ não | Baixo |
| R7 | `phrasingDiscipline` (variante mais branda R-B11) | `index.ts:2248-2250` | ❌ não | Médio |
| R8 | `formatPhrasing` R131 — sobrescreve template do stage a partir da 2ª pergunta | `_shared/serviceCategories.ts:574-576` | ❌ não | Médio — admin perde controle |
| R9 | `HANDCODED GUARD: max 1 question per message` | `index.ts:4070-4082` | ❌ não | Baixo |
| R10 | `evaluateHandoffGuard` — exige search antes de handoff_to_human | `_shared/handoffGuard.ts` | ❌ não | Baixo |
| R11 | `evaluateSearchGuard` — bloqueia query genérica sem categoria + offline | `_shared/searchGuard.ts` | ❌ keywords genéricas fixas | Médio |
| R12 | `validateSetTagsInput` — rejeita 2+ values mesma key | `_shared/setTagsValidator.ts` | ❌ não | Baixo |
| R13 | Anti-hallucination `interesse:` (regex match obrigatório) | `index.ts:3203-3248` (Bug 19/25) | ❌ não | Baixo |
| R14 | `PROTECTED_DETERMINISTIC_KEYS` — set_tags bloqueia LLM sobrescrever | `index.ts:3197-3202` | ❌ não | Médio |
| R15 | `autoExtractFields` + `NUMERIC_KEYS` set | `_shared/fieldAutoExtractor.ts` | ❌ não | Médio — lista hardcoded |
| R16 | `SALE_CLOSED_PATTERNS` — regex pix/comprovante/fechado | `_shared/saleClosedDetection.ts` | ❌ não | Baixo — R128 reduziu false positives |
| R17 | `detectObjection`, `detectBrand`, `detectClientType`, `detectPayment` — todos regex hardcoded | `_shared/*Detection.ts` | ❌ não | Médio |
| R18 | Validator system prompt (~70 linhas) | `_shared/validatorAgent.ts:53-114` | parcial (`validator_enabled/model/rigor` UI) | Médio |
| R19 | Tool descriptions (`search_products`, `set_tags`, etc.) | `index.ts:2096-2176` | ❌ não | Médio — copy crítica |
| R20 | `TAG_TO_MODE` mapeamento sub-agents | `index.ts:1536-1541` | ❌ deprecated | Baixo (legado) |
| R21 | `META_KEYS_FACTS` + `META_KEYS_R121` — keys ocultadas/preservadas | `index.ts:1623,1846,1910` | ❌ duplicado | Médio — drift |
| R22 | `HANDOFF_GUARD_BLOCKED_MSG` literal string | `_shared/handoffGuard.ts:42` | ❌ não | Baixo |
| R23 | R129 frase direta `"Posso te ajudar com X e Y. Por qual prefere começar?"` | `index.ts:1805` + `1694` (qualificationContext) | ❌ não | Médio — duplicada |
| R24 | `enrichOutsideHoursMessage` prefix automático | `_shared/businessHours.ts` (B31) | parcial (admin override por texto) | Baixo |

## 3) Inventário das regras configuráveis (prompt_sections)

NÃO foi possível executar `mcp__supabase__execute_sql` nesta sessão (MCP indisponível). Inferência via seed + UI:
- **7 keys editáveis por tenant** via Prompt Studio: identity, sdr_flow, product_rules, handoff_rules, tags_labels, absolute_rules, objections, additional. `business_context` é auto-gerado read-only.
- Coluna usada: `ai_agents.prompt_sections jsonb`. Defaults vêm de `system_settings.default_prompt_sections`.
- Estimativa do default: ~1900 chars total (8 sections), maior `sdr_flow` (~270 chars).
- Templates suportados: `{agent_name}, {personality}, {max_pre_search_questions}, {max_qualification_retries}, {max_enrichment_questions}, {max_discount_percent}`.

## 4) Análise de qualidade dos prompts

**Repetições / conflitos:**
- `"NUNCA dizer não temos/não encontrei/em falta"` aparece em: `hardcodedRules` (R1), `absolute_rules` (default seed), `validatorAgent.ts:79`, mensagens das exceptions de `searchGuard` e `excludedProducts` (comentário). 3-4 superfícies.
- `"max 1 pergunta por mensagem"` em: `absolute_rules` (default), `hardcodedRules` (R1), `validatorAgent.ts:87`, hard guard `index.ts:4070`. 4 superfícies determinísticas/textuais.
- Frase R129 `"Posso te ajudar com X e Y. Por qual prefere começar?"` gerada em 2 lugares: `index.ts:1805` (curto-circuito) e `index.ts:1694` (`buildQualificationContext` multi). Drift latente.
- `META_KEYS` (ignored tags) duplicadas em 3 sets diferentes: `META_KEYS_FACTS`, `META_KEYS_R121`, e META set inline em search exit_action.

**Prompts longos que deveriam ser estruturados:**
- `hardcodedRules` é uma string única ~3000 chars com 16 regras unidas por `-`. Difícil ler, impossível desligar 1 regra sem recompilar.
- `qualificationContext` mistura imperativos, exemplos errados/certos e regex de exclusão (R127). Candidato a JSON estruturado.
- Validator system prompt (~70 lin) injeta `config.systemPrompt.substring(0, 500)` — truncamento silencioso de instruções do admin.

**Regras em linguagem natural que poderiam ser determinísticas:**
- "NUNCA ECOAR/CONFIRMAR" + lista de 17 prefixos proibidos. Hoje só prompt. Poderia ser regex pós-LLM (já existe a infra do guard "max 1 question").
- "NUNCA RECUMPRIMENTAR" (Bug 17). Mesma situação. Validator detecta? parcialmente.
- "PROFISSÃO DO LEAD" set_tags. Hoje só prompt. `clientTypeDetection.ts` existe mas não é chamado pré-LLM pra forçar tag.

**Few-shot examples:**
- Existem ~6 exemplos literais embutidos: `"George" → "porta"` (Bug 19), `"Tem tinta acrílica fosco?"` (R6 hardcoded), `"Para qual ambiente? Interno ou externo?"` (validator), `"Para confirmar mesa de plástico"` (R121), `"Tem tinta da Coral?"` (marca → search). Sem estrutura few-shot real (`<example>`/JSON). Misturam ERRADO/CERTO inline.

## 5) Paridade — Admin UI vs Hardcoded

| # | Comportamento crítico | Status |
|---|---|---|
| C1 | Greeting (initial / returning) | ✅ UI (`greeting_message`, `returning_greeting_message`) |
| C2 | Handoff message regular/OOH | ✅ UI |
| C3 | Categorias de qualif (service_categories) | ✅ UI (ServiceCategoriesConfig) |
| C4 | Excluded products | ✅ UI (ExcludedProductsConfig) |
| C5 | Modelo LLM + temperature + maxTokens | ✅ UI |
| C6 | Validator on/off + rigor + model | ✅ UI |
| C7 | Personalidade / business_info | ✅ UI |
| C8 | TTS providers + voice_name | ✅ UI |
| C9 | Horário comercial + extended_hours | ✅ UI |
| C10 | 8 prompt_sections | ✅ UI (Prompt Studio) |
| C11 | Detectores `saleClosed/payment/brand/objection/clientType` (regex) | ❌ HARDCODED |
| C12 | Greeting tokens normalizer (`['oi','olá',...]`) | ❌ HARDCODED — pt-BR only |
| C13 | `hardcodedRules` bloco (~25 lin de proibições) | ❌ HARDCODED |
| C14 | `formatPhrasing` R131 (template curto a partir da 2ª pergunta) | ❌ HARDCODED |
| C15 | `phrasingDiscipline` reforço de fidelidade | ❌ HARDCODED |
| C16 | Generic query tokens (`material/produto/preco`) | ❌ HARDCODED em searchGuard |
| C17 | Tool descriptions (`search_products`, etc.) | ❌ HARDCODED |
| C18 | Max 1 question hard guard | ❌ HARDCODED (regex pós-LLM) |
| C19 | Outside-hours hint | ❌ HARDCODED (texto fixo) |
| C20 | `enrichOutsideHoursMessage` prefix auto | ⚠️ semi (admin override por texto) |
| C21 | Validator scoring system prompt | ⚠️ parcial (rigor sim, regras dentro do prompt não) |

❌ = candidato a virar prompt_section editável ou tabela de config.

## 6) Prompts "sujos" — detecção

- **P1: `phrasingDiscipline` exemplo literal cross-domain** — `index.ts:2249`. Diz `"se a sugestão acima diz 'marca (Lorenzetti, Hydra)'..."`. Lorenzetti/Hydra são marcas de chuveiro. Em prompt de tinta vai vazar exemplo errado se LLM for displicente. **Fix:** substituir por placeholder abstrato `<exemplos_categoria>`.
- **P2: Bug 17 ERRADO/CERTO** — `index.ts:1652`. `"Olá, Maria! A tinta Acrílica..."` exemplo literal de tinta dentro de regra genérica. Cross-categoria pra ferramenta/porta etc.
- **P3: Bug 19 ERRADO/CERTO** — `index.ts:1653`. `"George" → "porta"`. Mesmo problema.
- **P4: Bug 24 motivo formatado** — `"${interesse} > ${qualSummary}"` em `index.ts:1897`. Sem fallback se `interesseValue` for null.
- **P5: leadName interpolation** — `\nLIMITE DE MENSAGENS:` linha `index.ts:1613` interpola `${leadMsgCount || 0}` mas leadName fallback é `(desconhecido)` no Validator, vazio no prompt — inconsistente.
- **P6: Acentuação inconsistente** — `index.ts:2013` usa "FORA DO HORÁRIO COMERCIAL" (acento), `_shared/searchGuard.ts` mensagens sem acento ("revestimento, porta"), `R129` (`começar` correto). Histórico de encoding misto.
- **P7: Tag interpolada sem escape** — `index.ts:1634` `facts.push(`${labelKey} = ${v}`)`. Se valor contém ` = ` ou newline, layout quebra. Casos reais raros mas existem.
- **P8: Templating `{nome}` x `{agent_name}`** — `index.ts:1399` usa `{nome}` (returning_greeting), Prompt Studio usa `{agent_name}/{personality}/...`. Convenção dupla. Risco: admin escreve `{nome}` em `identity` e não interpola.
- **P9: Emoji excessivo no qualificationContext** — `index.ts:1727-1741` usa 🎯🗣️⚠️🚫. Conflita com regra "emoji 1-2 por msg" do prompt — só vale pra texto final, não system, mas confunde o LLM.
- **P10: `subAgentInstruction` sopa quando profile=null** — `index.ts:1548-1553` injeta TODOS os sub-agents como "Modos disponíveis" mesmo sem motivo tag. Polui contexto.

## Notas 0-10

| Critério | Nota | Justificativa |
|---|---|---|
| N1 Modularidade | **6** | 15 seções concatenadas, mas `hardcodedRules` é monolito de 25 linhas misturando 16 regras heterogêneas |
| N2 Configurabilidade | **5** | 7 prompt_sections editáveis cobrem ~40% do comportamento; 16+ regras críticas hardcoded |
| N3 Conflitos / repetições | **5** | "NUNCA dizer não temos" e "max 1 pergunta" cada uma em 3-4 surfaces; META_KEYS duplicado 3x |
| N4 Few-shot | **3** | Exemplos literais inline e cross-domain (P1-P3). Nenhum few-shot estruturado real |
| N5 Prompts vs determinístico | **7** | Defesa em camadas decente (auto-extract, guards, validator). Mas detectores (objection/sale/brand) sem UI vira lock-in |

## Veredito

Sistema tem **maturidade alta em proteção (guards/detectores)** e **maturidade média em UX de configuração (Prompt Studio cobre só camada de texto)**. O risco principal é **drift entre 3-4 cópias da mesma regra** e **hardcoded text dentro do código de produção** — qualquer cliente novo herda regras desenhadas pra Eletropiso (tintas/chuveiros), com exemplos vazando entre categorias.

## Top-5 melhorias propostas

1. **Extrair `hardcodedRules` (R1) pra nova prompt_section `inviolable_rules`** com flag por agente. Cada item vira linha numerada num array; admin pode desligar individualmente (ou só editar texto). Quebra o monolito de 25 linhas.
2. **Substituir exemplos literais cross-domain (P1, P2, P3) por placeholders interpolados** — `{category_label}`, `{stage_examples}` — montados em runtime a partir da categoria detectada.
3. **Unificar `META_KEYS` num único `const META_TAG_KEYS` em `_shared/tagSemantics.ts`** + helper `humanizeTags(tags): Fact[]` reusado em qualificationContext, R121, search exit. Mata drift.
4. **Tabela `system_settings.detector_patterns` ou `ai_agents.detectors` JSONB** pros regex de saleClosed/objection/brand/payment/clientType. Hoje editar regex exige deploy edge. Risco real — R128 prova.
5. **Few-shot estruturado** em `prompt_sections.examples` (nova key) como JSON `[{lead, expected_response, reason}, ...]`. LLM aprende padrão sem cross-pollution. Bonus: torna A/B test de prompt viável.

---

*Auditoria completa: 2026-05-21*
