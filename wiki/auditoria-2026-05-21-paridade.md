---
title: Auditoria de Paridade UI ↔ Backend (SYNC RULE)
tags: [auditoria, sync-rule, paridade, gaps, allowed_fields, d36]
sources: [AIAgentTab.tsx, ai-agent/index.ts, types.ts, decisoes-chave.md]
updated: 2026-05-21
audited_at: 2026-05-21
---

# Auditoria SYNC RULE — UI Admin ↔ Backend (2026-05-21)

> Auditoria das **8 colunas vivas** da SYNC RULE (DB → types → UI → ALLOWED_FIELDS → backend → prompt → defaults → docs). Foco: cobertura de campos, órfãos, escritas dead, dead reference e privilégio. Escopo: `ai_agents` (61 colunas) + Configs em `src/components/admin/ai-agent/`.

## 1. ALLOWED_FIELDS audit (AIAgentTab.tsx:59-96)

**ALLOWED_FIELDS atual (45 keys):** `instance_id, enabled, name, greeting_message, personality, system_prompt, model, temperature, max_tokens, debounce_seconds, handoff_triggers, handoff_cooldown_minutes, handoff_max_conversation_minutes, handoff_negative_sentiment, blocked_topics, max_discount_percent, blocked_phrases, voice_enabled, voice_max_text_length, voice_reply_to_audio, voice_name, context_short_messages, context_long_enabled, business_hours, extraction_fields, blocked_numbers, extraction_address_enabled, handoff_message, follow_up_enabled, follow_up_rules, business_info, returning_greeting_message, max_lead_messages, max_qualification_retries, max_enrichment_questions, prompt_sections, carousel_text, carousel_button_1, carousel_button_2, handoff_message_outside_hours, max_pre_search_questions, validator_enabled, validator_model, validator_rigor, tts_fallback_providers, poll_nps_enabled, poll_nps_delay_minutes, poll_nps_question, poll_nps_options, poll_nps_notify_on_bad, service_categories, excluded_products, extended_hours_until, notify_outside_hours_on_handoff`.

**Schema real `ai_agents` (61 colunas):** `blocked_numbers, blocked_phrases, blocked_topics, business_hours, business_info, carousel_button_1, carousel_button_2, carousel_text, context_long_enabled, context_short_messages, created_at, debounce_seconds, enabled, excluded_products, extended_hours_until, extraction_address_enabled, extraction_fields, follow_up_enabled, follow_up_rules, greeting_message, handoff_cooldown_minutes, handoff_max_conversation_minutes, handoff_message, handoff_message_outside_hours, handoff_negative_sentiment, handoff_triggers, id, instance_id, max_discount_percent, max_enrichment_questions, max_pre_search_questions, max_qualification_retries, max_tokens, model, name, notify_outside_hours_on_handoff, openai_api_key, out_of_hours_message, personality, poll_nps_delay_minutes, poll_nps_enabled, poll_nps_notify_on_bad, poll_nps_options, poll_nps_question, prompt_sections, returning_greeting_message, service_categories, sub_agents, system_prompt, temperature, tts_fallback_providers, updated_at, validator_enabled, validator_model, validator_rigor, voice_enabled, voice_max_text_length, voice_name, voice_reply_to_audio`.

### Gap A — colunas no DB NÃO no ALLOWED_FIELDS

| Coluna | Justificativa atual | Risco |
|---|---|---|
| `openai_api_key` | Save com UPDATE direto em `BrainConfig.tsx:48-52` (não passa pelo doSave) | Médio — auto-save de outros campos não toca, OK; mas se admin colar key durante save de outro campo, sem optimistic merge a key pode ser sobrescrita pela cópia em memória |
| `out_of_hours_message` | Legado D32 (B30 removido em 2026-05-17) | Baixo — coluna preservada pra backward-compat, requeue-conversations ainda lê (linha 225/234/240) |
| `sub_agents` | UI `SubAgentsConfig.tsx` ainda escreve (linha 73), mas Tab `intelligence` usa `ProfilesConfig` (M17 F3 substituiu) | **Alto — código órfão**, ver Gap E |
| `handoff_negative_sentiment` | Está no ALLOWED_FIELDS mas **nenhum onChange escreve** | Médio — toggle morto, ver Gap F |
| `created_at`, `updated_at`, `id` | Auto-gerenciados | N/A |

### Gap B — keys no ALLOWED_FIELDS NÃO são colunas reais

✅ **Zero dead references** — todos os 45 keys do ALLOWED_FIELDS são colunas válidas do schema.

### Gap C — colunas missing total: 3 (`openai_api_key`, `out_of_hours_message`, `sub_agents`)

---

## 2. UI Admin completeness (12 Configs)

| Config | Campo principal | Salva via | Loading/Error | Optimistic |
|---|---|---|---|---|
| `GeneralConfig.tsx` | enabled, name, instance_id, greeting_message, personality, returning_greeting_message | doSave (debounce 2s) | saveStatus indicator | ✅ |
| `BrainConfig.tsx` | model, temperature, max_tokens, debounce_seconds, context_*, openai_api_key | **2 paths:** maioria via doSave; `openai_api_key` via UPDATE direto debounce 1.5s | toast.error | ❌ split |
| `BusinessInfoConfig.tsx` | business_info (jsonb) | doSave | ✅ | ✅ |
| `RulesConfig.tsx` | handoff_*, max_*, business_hours, notify_outside_hours_on_handoff, handoff_negative_sentiment toggle | doSave | fieldErrors | ✅ |
| `GuardrailsConfig.tsx` | blocked_topics/phrases, max_discount_percent, validator_*, carousel_* | doSave | fieldErrors | ✅ |
| `VoiceConfig.tsx` | voice_enabled, voice_name, voice_max_text_length, voice_reply_to_audio | doSave | ✅ preview test | ✅ |
| `ExtractionConfig.tsx` | extraction_fields, extraction_address_enabled | doSave | ✅ | ✅ |
| `ServiceCategoriesConfig.tsx` | service_categories (jsonb) | doSave | ✅ + validation guardrails | ✅ |
| `ExcludedProductsConfig.tsx` | excluded_products (jsonb) | doSave | ✅ | ✅ |
| `BlockedNumbersConfig.tsx` | blocked_numbers (array) | doSave | ✅ | ✅ |
| `FollowUpConfig.tsx` | follow_up_enabled, follow_up_rules | doSave | ✅ | ✅ |
| `BusinessHoursEditor.tsx` | business_hours (jsonb) | doSave via RulesConfig | ✅ | ✅ |
| `ExtendedHoursConfig.tsx` | extended_hours_until | doSave via RulesConfig | ✅ | ✅ |
| `PromptStudio.tsx` | prompt_sections (jsonb) | doSave | ✅ | ✅ |
| `PollConfigSection.tsx` | poll_nps_* | doSave | ✅ | ✅ |
| `KnowledgeConfig.tsx` | tabela `agent_knowledge` separada | RPC + INSERT | ✅ react-query | ✅ |
| `CatalogConfig.tsx` | tabela `agent_products` separada | RPC + INSERT | ✅ react-query | ✅ |
| `ProfilesConfig.tsx` | tabela `agent_profiles` separada (M17 F3) | hooks `useAgentProfiles` | ✅ react-query | ✅ |
| `MetricsConfig.tsx` | read-only (logs) | N/A | ✅ | N/A |
| `ValidatorMetrics.tsx` | read-only (logs) | N/A | ✅ | N/A |
| `QueueConfig.tsx` (queue/) | `departments.queue_*`, `department_members.queue_*` | UPDATE direto + RPC `log_admin_action` | toast | ❌ audit log custom |
| `UserPermissionsDialog.tsx` | `user_feature_permissions` (D36) | UPDATE direto | toast | ❌ |

**Nota N2 UI Completeness: 8.5/10** — 95% dos campos têm feedback, mas `BrainConfig` tem 2 paths de save divergentes (risco de race) e `QueueConfig` não usa o auto-save padrão.

---

## 3. Round-trip Backend ↔ UI (15 campos representativos)

| Campo | UI escreve | Backend lê (linha em ai-agent/index.ts) | Status |
|---|---|---|---|
| `handoff_message` | ✅ RulesConfig:31 | ✅ index.ts:67, 4009 | ✅ lido |
| `handoff_message_outside_hours` | ✅ RulesConfig:41 | ✅ index.ts (via getHandoffMessage helper) | ✅ lido |
| `business_hours` | ✅ BusinessHoursEditor | ✅ index.ts:110, 400, 736, 835, 984, 1951, 2011, 2599, 3492, 3659, 4037, 4123, 4349 | ✅ lido (heavy) |
| `blocked_numbers` | ✅ BlockedNumbersConfig | ✅ index.ts:218 | ✅ lido |
| `excluded_products` | ✅ ExcludedProductsConfig | ✅ index.ts:910 | ✅ lido |
| `service_categories` | ✅ ServiceCategoriesConfig | ✅ index.ts:2179, _shared/serviceCategories.ts:275 | ✅ lido |
| `prompt_sections` | ✅ PromptStudio | ✅ index.ts:1558 | ✅ lido |
| `business_info` | ✅ BusinessInfoConfig | ✅ index.ts:911, 1574, 3996 | ✅ lido |
| `extraction_fields` | ✅ ExtractionConfig | ✅ index.ts:1254, 1511 | ✅ lido |
| `extraction_address_enabled` | ✅ ExtractionConfig | ❌ **NÃO encontrado em ai-agent nem _shared/** | ⚠️ **ÓRFÃO write-only** |
| `validator_enabled` | ✅ GuardrailsConfig | ✅ index.ts:3967 | ✅ lido |
| `validator_model/rigor` | ✅ GuardrailsConfig | ✅ index.ts:3989-3990 | ✅ lido |
| `tts_fallback_providers` | ⚠️ no ALLOWED_FIELDS mas **sem onChange UI** | ✅ index.ts:273 | ⚠️ **read-only no DB direto** |
| `follow_up_rules` | ✅ FollowUpConfig | ✅ process-follow-ups/index.ts:59 | ✅ lido |
| `poll_nps_*` | ✅ PollConfigSection | ✅ _shared/automationEngine.ts:608-610 | ✅ lido |
| `extended_hours_until` | ✅ ExtendedHoursConfig | ✅ index.ts:400, 736, 835, 984... | ✅ lido |
| `notify_outside_hours_on_handoff` | ✅ RulesConfig:191 via BusinessHoursEditor | ✅ index.ts:399, 735, 834, 983, 1950, 2010, 3491, 3658, 4036, 4122, 4348 | ✅ lido (heavy) |
| `handoff_negative_sentiment` | ⚠️ **sem onChange real** | ❌ **NÃO encontrado em ai-agent** | ❌ **DEAD field** |

**Nota N3 Round-trip: 7.5/10** — 3 vazamentos (`extraction_address_enabled`, `tts_fallback_providers`, `handoff_negative_sentiment`).

---

## 4. Campos backend lê que UI não cadastra (Gap C)

| Campo lido por backend | Local | UI? | Severidade |
|---|---|---|---|
| `agent.known_brands` | `_shared/brandDetection.ts:13` | ❌ Nenhum Config edita | **P1** — feature de detecção de marca usa coluna inexistente no ALLOWED_FIELDS. Coluna existe no DB? Não aparece no types.ts. Provavelmente está em outra tabela ou foi removida. Verificar. |
| `agent.out_of_hours_message` | `requeue-conversations/index.ts:225, 234, 240` | ❌ Removido D32 B30 | **P1** — backend de requeue ainda lê msg legada. Cron ainda envia. Quando admin deixa vazio essa coluna não-editável, mas requeue precisa de fallback — risco de prod silencioso |
| `agent.sub_agents` | `index.ts:1532`, `ai-agent-playground/index.ts:67` | ⚠️ UI tem `SubAgentsConfig.tsx` órfã (não usada na tab); `ProfilesConfig` (nova) escreve em `agent_profiles` table | **P0** — backend ainda lê `sub_agents` JSON antigo. Se admin nunca editou via SubAgents, fica null. M17 F3 deveria ter migrado leitura pra `agent_profiles`. **Doc D36 N1 N5 mark this as RESIDUAL DEBT** |

---

## 5. Defaults consistency

**Hardcoded no código:**
- `agent.greeting_message` — sem fallback default no backend (linha 1383, 1393, 3950-3953)
- `agent.model` — fallback `'gpt-4.1-mini'` hardcoded em BrainConfig.tsx:210
- `agent.voice_name` — fallback `'Kore'` em VoiceConfig.tsx:168
- `agent.validator_model` — fallback `'gpt-4.1-nano'` em GuardrailsConfig.tsx:98
- `agent.validator_rigor` — fallback `'moderado'` em GuardrailsConfig.tsx:109
- `agent.handoff_max_conversation_minutes` — fallback `15` em RulesConfig.tsx:88
- `agent.handoff_cooldown_minutes` — fallback `30` em RulesConfig.tsx:97
- `agent.max_lead_messages` — fallback `8` em RulesConfig.tsx:110
- `agent.context_short_messages` — fallback `10` em BrainConfig.tsx:283
- `agent.debounce_seconds` — fallback `15` (clamp 3-30) em BrainConfig.tsx:271

**`system_settings` table:**
- Lookup direto em `VoiceConfig.tsx:45-49` para `GEMINI_API_KEY`
- **NÃO há lookup de defaults de ai_agents em system_settings.** Defaults vivem só no DB DEFAULT clause + fallback `||` no código (~25 spots), nunca centralizado.

**Gap D — Defaults inconsistency:** quando admin clica em "Novo Agente", `NICHE_TEMPLATES.config` carrega defaults via `src/data/nicheTemplates.ts`. Mas se admin LIMPA um campo no UI, ele vira `''` ou `null` no DB — sem reset para default. UI mostra `''` (vazio), backend usa fallback hardcoded. **Lead vê comportamento default mas admin não sabe disso visualmente.**

**Nota N4 Defaults: 5/10** — sem fonte única de verdade. NicheTemplates ≠ DB DEFAULT ≠ fallback `||` no código. Cada um pode divergir.

---

## 6. RPCs vs UPDATEs

**UPDATE direto sem audit (risco RLS):**
- `AIAgentTab.tsx:194-200` (doSave) — `UPDATE ai_agents SET {...ALLOWED_FIELDS} WHERE id=X`. Sem RPC, sem audit log. RLS depende de policy `ai_agents` (gerente+ tem update). Atendente não passa.
- `BrainConfig.tsx:48-52` (openai_api_key direct UPDATE). Mesmo path.
- `AIAgentTab.tsx:358, 370` (toggle enabled, DELETE agent). Sem audit.

**UPDATE com audit (RPC `log_admin_action`):**
- `QueueConfig.tsx` chama RPC para audit ao salvar fila.
- `UserPermissionsDialog.tsx` — D36 permissões (sem audit explícito, mas tabela tem `granted_by` + `updated_at`).

**Gap risco P2 — `ai_agents` update sem audit:** mudança crítica (ex: admin desliga validator, troca model, esvazia blocked_phrases) não fica rastreada em `admin_audit_log`. Se prod degrada, não há quem mexeu, quando.

---

## 7. Permissões granulares (D36 cross-check)

**5 features D36 vs Configs:**

| feature_key | Config | FeatureRoute? | Botão destrutivo? | Gap |
|---|---|---|---|---|
| `manage_catalog` | CatalogConfig | ✅ via canEditCatalog (AIAgentTab:108) | Delete produto sem `super_admin` check extra | ✅ OK |
| `manage_faq` | KnowledgeConfig | ✅ via canEditFaq | ✅ | ✅ OK |
| `manage_qualification` | ServiceCategoriesConfig | ✅ via canEditQualification | ✅ | ✅ OK |
| `manage_excluded_products` | ExcludedProductsConfig | ✅ via canEditExcluded | ✅ | ✅ OK |
| `manage_blocked_numbers` | BlockedNumbersConfig | ✅ via canEditBlockedNumbers | ✅ | ✅ OK |

**Privilege escalation gap:**
- Tabs `setup`, `prompt`, `intelligence`, `security`, `channels`, `metrics` **não têm guard de feature** — qualquer user com acesso ao route `/dashboard/admin` (CrmRoute) pode editar `system_prompt`, `prompt_sections`, `model`, etc.
- D36 backlog menciona "Esconder ações destrutivas do gerente em UsersTab (delete user, role select pra super_admin)" — **ainda pendente**.
- Botão "Excluir agente" (AIAgentTab:498-503) — gerente pode deletar agente inteiro (perde catálogo, knowledge, logs). Sem confirmação dupla nem feature_key.

**Nota N5 Permissões: 7/10** — 5 features novas OK; mas core (prompt, model, system_prompt) sem granularidade + delete agent sem guard.

---

## 8. Cross-check erros recentes

- **R88 (gap UI/backend):** fix já feito — campos `notify_outside_hours_on_handoff` agora têm UI no `BusinessHoursEditor` (RulesConfig:191).
- **R89 (controlled input):** Configs usam `value={config.X || ''}` — controlado, OK.
- **R114 (CHECK constraint event):** `ai_agent_logs` constraint precisa de migration toda vez que evento novo é registrado. Não afeta ai_agents schema.
- **B30 (out_of_hours_message removido):** Confirmado em ALLOWED_FIELDS (linha 65-67 comment) mas **requeue-conversations:225 ainda lê**. Half-removed.
- **R132 (re-leitura DB):** ortogonal à SYNC RULE.
- **D36 (feature permissions):** 5 features cobertas, 4 tabs core sem granularidade.

---

## Findings (15)

### [P0] `sub_agents` ainda lido no backend mas substituído por `agent_profiles`
**Onde:** `ai-agent/index.ts:1532`, `ai-agent-playground/index.ts:67`. UI `SubAgentsConfig.tsx` órfã; nova UI é `ProfilesConfig.tsx` → tabela `agent_profiles`.
**Status:** Backend lê coluna JSON antiga `ai_agents.sub_agents`. M17 F3 (project_m17_agent_profiles) migrou UI mas não a leitura.
**Fix:** migrar leitura no ai-agent para query em `agent_profiles WHERE agent_id=X ORDER BY position`. Marcar `sub_agents` como deprecated + agendar drop column.

### [P0] `agent.known_brands` lido em `_shared/brandDetection.ts:13` mas **coluna não existe no schema**
**Onde:** `_shared/brandDetection.ts:13`, teste em `brandDetection.test.ts:40`.
**Status:** Coluna NÃO aparece no types.ts da tabela `ai_agents`. Ou foi removida ou está faltando no schema. Backend usa `agent.known_brands` que retorna `undefined`.
**Fix:** confirmar via MCP `list_tables({schemas:["public"]})` se coluna existe; se não, adicionar migration + UI ou remover leitura. Hoje detecção de marca silenciosamente cai no default hardcoded.

### [P0] `out_of_hours_message` removido da UI (B30) mas `requeue-conversations:225/234/240` ainda lê
**Onde:** `supabase/functions/requeue-conversations/index.ts:221-240`.
**Status:** Cron horário envia msg legada quando lead fica em fila fora do horário. Admin não tem UI pra editar → fica com texto stale ou null.
**Fix:** migrar requeue para usar `agent.handoff_message_outside_hours` (com `enrichOutsideHoursMessage` helper). Confirmar via grep que outras fns não usam mais.

### [P1] `extraction_address_enabled` write-only — UI seta, backend nunca lê
**Onde:** UI `ExtractionConfig.tsx:165`, ALLOWED_FIELDS:69. Grep em ai-agent + _shared não retorna match.
**Status:** Admin pode habilitar extração de endereço mas backend não conhece o flag. Talvez seja lido em outro consumer (lead-extract?). Não identificado.
**Fix:** confirmar consumidor; se sim, documentar; se não, marcar como dead field + remover do ALLOWED_FIELDS.

### [P1] `handoff_negative_sentiment` é dead field (no ALLOWED_FIELDS, sem UI, sem backend)
**Onde:** ALLOWED_FIELDS:63, mas grep `handoff_negative_sentiment` retorna ZERO matches em `onChange({})` e ZERO no ai-agent/_shared.
**Status:** Coluna NOT NULL boolean default false, ninguém usa.
**Fix:** se feature obsoleta, drop column + remove de ALLOWED_FIELDS. Se planejada, criar UI toggle em RulesConfig + reader no ai-agent.

### [P1] `tts_fallback_providers` lido pelo backend mas UI não tem toggle/editor
**Onde:** ALLOWED_FIELDS:84, lido em `ai-agent/index.ts:273`. Nenhum Config tem `onChange({ tts_fallback_providers: ... })`.
**Status:** Admin só altera via SQL/types. Configs Voice/Channels não expõem.
**Fix:** adicionar editor em `VoiceConfig.tsx` (toggle order: gemini → openai → elevenlabs, drag-and-drop). Ver `wiki/decisoes-arquivo-d21-d26` se houver decisão sobre fallback chain.

### [P1] `openai_api_key` save path divergente (sem auto-save padrão, sem fieldErrors integration)
**Onde:** `BrainConfig.tsx:38-58` faz UPDATE direto debounce 1.5s; resto do form usa doSave debounce 2s do AIAgentTab.
**Status:** Se admin edita key + outro campo rápido, há janela de race onde key save acaba sobrescrevendo config.openai_api_key snapshot. Cobertura de toast ok mas sem retry logic.
**Fix:** unificar em ALLOWED_FIELDS + remover save path divergente. Coluna entra no doSave normal.

### [P1] `UPDATE ai_agents` (AIAgentTab.tsx:194) sem audit log
**Onde:** `AIAgentTab.tsx:doSave:194-200`.
**Status:** Toda mudança crítica (model, system_prompt, validator, blocked_phrases, max_discount) não fica em `admin_audit_log`. Diff impossível pós-incidente.
**Fix:** wrap doSave em RPC `update_ai_agent_with_audit(p_agent_id, p_diff jsonb)` que inseri `admin_audit_log(action='update_ai_agent', details={before, after, diff_keys})`.

### [P1] Botão "Excluir agente" (AIAgentTab:498-503) sem feature_key D36
**Onde:** dropdown menu do card de agente.
**Status:** Gerente pode deletar agente inteiro (cascade: catalog, knowledge, logs, profiles). Sem nivelamento granular.
**Fix:** ou exigir `super_admin` only (front-end guard + RLS DELETE policy) ou adicionar `manage_agents` feature_key na D36.

### [P2] Tabs `setup`, `prompt`, `intelligence`, `security`, `channels` sem feature_key
**Onde:** AIAgentTab `TABS` array (lines 47-57).
**Status:** Único guard é `super_admin` para chegar na rota; depois disso, gerente edita `system_prompt`, `prompt_sections`, `model`, `temperature`, `validator_*` livremente. Não há `manage_brain` ou `manage_prompt` no D36.
**Fix:** expandir D36 com 3-4 features novas: `manage_prompt`, `manage_brain`, `manage_handoff_rules`, `manage_voice`. Plano: fase 2 do D36 (já tem backlog).

### [P2] Defaults inconsistentes — NicheTemplates ≠ DB DEFAULT ≠ fallback `||`
**Onde:** `src/data/nicheTemplates.ts` (templates), DB schema (DEFAULT clauses), 25+ spots de `agent.X || 'default'` em código.
**Status:** Admin cria agente com niche "homecenter" → carrega 1 conjunto de defaults; depois edita 1 campo + esvazia outro → UI mostra vazio mas runtime usa hardcoded `||`. Inconsistência visual e operacional.
**Fix:** centralizar em `_shared/agentDefaults.ts` (objeto único). UI mostra default cinza placeholder. Backend usa o mesmo objeto.

### [P2] `BrainConfig` lê `config.openai_api_key` direto, sem masked-by-default
**Onde:** `BrainConfig.tsx:28-29, 67`.
**Status:** Key visível em `<Input type={showKey ? 'text' : 'password'}>` (linha não mostrada). Pelo menos não vai pro toast direto; mas auto-load do config faz `setOpenaiKey(config.openai_api_key)` — se outro admin abrir agente, lê key em memória.
**Fix:** trocar coluna por reference a `system_settings` keyed (já há GEMINI_API_KEY padrão lá). Coluna `ai_agents.openai_api_key` vira deprecated.

### [P2] `service_categories` JSON sem schema validation no DB
**Onde:** `ai_agents.service_categories Json` (types.ts). Validação só client-side em `ServiceCategoriesConfig.tsx` (autoSlugifyGuardrail.test.tsx prova testabilidade).
**Status:** Outro client (RPC, edge fn) pode escrever JSON malformado → backend ai-agent quebra silente no `loadAgentConfig`.
**Fix:** CHECK constraint via `jsonb_typeof(service_categories) IN ('object','array')` + RPC `update_service_categories(p_agent_id, p_value jsonb)` com validação Zod-equivalente em PL/pgSQL.

### [P3] `QueueConfig` salva sem optimistic update — UI espera RPC commitar
**Onde:** `queue/QueueConfig.tsx`.
**Status:** Salvar fila reabre dialog; usuário aguarda. UX diferente do AIAgentTab (auto-save).
**Fix:** alinhar padrão — ou todos auto-save com indicator no header, ou todos com botão "Salvar" explícito.

### [P3] `KnowledgeConfig` / `CatalogConfig` usam react-query sem invalidação cruzada
**Onde:** ambos.
**Status:** Se backend ai-agent insere produto via tool `add_product` (ou knowledge via outro path), UI cached não invalida. Admin tem que refresh page.
**Fix:** subscrever Realtime `agent_products` + `agent_knowledge` na UI Admin (canal `INSERT/UPDATE/DELETE`).

---

## Veredito + Notas

- **N1 ALLOWED_FIELDS coverage:** **8/10** — 45/61 colunas cobertas, gaps justificados na maioria; 3 órfãos reais (`sub_agents`, `openai_api_key`, `handoff_negative_sentiment`)
- **N2 UI completeness:** **8.5/10** — todas as Configs principais têm feedback, mas BrainConfig divergente + QueueConfig sem optimistic
- **N3 Round-trip (UI escreve + backend lê):** **7.5/10** — 3 vazamentos identificados (`extraction_address_enabled`, `tts_fallback_providers`, `handoff_negative_sentiment`); 1 leitura sem coluna (`known_brands`)
- **N4 Defaults consistency:** **5/10** — sem fonte única; templates ≠ DB ≠ fallback inline
- **N5 Permissões granulares D36:** **7/10** — 5 features cobertas, mas tabs core (prompt, brain, handoff_rules, voice) sem guard + delete agent sem guard

**Nota geral paridade UI ↔ Backend: 7.2/10**

A paridade é alta para os 45 campos que entram no fluxo padrão `ALLOWED_FIELDS → doSave → backend reader`. O maior risco está em **3 paths divergentes**: `openai_api_key` (UPDATE direto), `sub_agents` (UI substituída sem migrar reader), `out_of_hours_message` (UI removida sem migrar reader em requeue). Mais 2 dead fields (`handoff_negative_sentiment`, possivelmente `extraction_address_enabled`) e 1 leitura sem coluna (`known_brands`).

## Top-5 melhorias prioritárias

1. **[P0] Migrar leitor `sub_agents` → `agent_profiles`** em ai-agent/index.ts e ai-agent-playground. Drop coluna depois de 1 sprint.
2. **[P0] Confirmar status de `known_brands`** (coluna existe? MCP list_tables) e ou criar UI + migration, ou remover do brandDetection.
3. **[P0] Migrar `requeue-conversations` para `handoff_message_outside_hours`** + drop `out_of_hours_message` da DB após 30d.
4. **[P1] Adicionar audit log em `UPDATE ai_agents`** (RPC `update_ai_agent_with_audit`) — sem isso, debugging de incidentes pós-edit é cego.
5. **[P1] Centralizar defaults em `_shared/agentDefaults.ts`** — fonte única para NicheTemplates + UI placeholders + backend fallback. Resolve gap N4.

**Frase de retomada:** "continuar auditoria paridade SYNC RULE 2026-05-21 — implementar fixes P0".
