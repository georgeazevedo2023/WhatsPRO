---
title: Erros e Lições
tags: [erros, bugs, licoes, preventivo]
sources: [CLAUDE.md, docs/REGRAS_ASSISTENTE.md]
updated: 2026-04-13
---

# Erros e Lições

> Consultado no INÍCIO de cada sessão. Verifique se o erro que você está prestes a cometer já está aqui.

---

## Regras Preventivas (resumo rápido)

| # | Regra | Origem |
|---|-------|--------|
| 1 | NUNCA reportar dados falsos — só confirmar após teste E2E completo | Regra de integridade |
| 2 | NUNCA dar nota/score parcial e depois mudar para pior | Regra de integridade |
| 3 | Token UAZAPI NUNCA no frontend — sempre via uazapi-proxy | Segurança |
| 4 | Não selecionar campo `token` da tabela `instances` no frontend | Segurança |
| 5 | types.ts só via `npx supabase gen types` — NUNCA editar manual | Padrão |
| 6 | Debounce NO RETRY on 500 — é timeout do gateway, não crash | AI Agent |
| 7 | Empty LLM response = silêncio — NUNCA enviar fallback ao lead | AI Agent |
| 8 | NUNCA dizer "não encontrei/não temos" ao lead — usar [INTERNO] | AI Agent |
| 9 | Clear context: tags = ['ia_cleared:TIMESTAMP'] — NUNCA [] (quebra handoff counter) | AI Agent |
| 10 | Shadow mode NUNCA sobrescreve full_name existente | AI Agent |
| 11 | Greeting + question: enviar greeting E continuar para LLM responder | AI Agent |
| 12 | SYNC RULE: alteração em feature do AI Agent deve sincronizar 8 locais | Consistência |
| 13 | Sequência de correção: Código → Validator → FAQ → Handoff (nunca pular) | AI Agent |
| 14 | `?? 0` ao incrementar contadores do DB — undefined/null → NaN silencioso | Forms |
| 15 | NUNCA setState fora de useEffect/handler; guards com return DEPOIS dos hooks | React |
| 16 | Getters NUNCA com side effects — separar leitura de transição de estado | Arquitetura |
| 17 | NUNCA check-then-insert em unique key — usar upsert ON CONFLICT | DB |
| 18 | NUNCA `.reverse()` / `.sort()` em arrays externos — usar `.slice().reverse()` | JS |
| 19 | NUNCA duplicar FIELD_MAP — usar `leadHelper.ts` compartilhado | Integrações |
| 20 | Bio lead captures DEVEM criar contact + lead_profile real — dados isolados são invisíveis | Bio Link |
| 21 | Todo sistema de captação DEVE setar `lead_profiles.origin` e tags `origem:X` | Atribuição |
| 22 | Edge functions admin-* DEVEM usar `getDynamicCorsHeaders(req)` e `verify_jwt=false` — gateway sem CORS headers bloqueia localhost e domínios diferentes | CORS |
| 23 | CORS estático (`browserCorsHeaders`) não funciona com múltiplas origens — usar `getDynamicCorsHeaders(req)` que checa Origin vs whitelist + localhost | CORS |
| 24 | `instances.id` é TEXT (não UUID) — FK para instances deve usar TEXT | DB |
| 25 | Endpoint UAZAPI para interativos é `/send/menu` (type=poll/list/quickreply), NÃO `/send/poll` — validar com curl antes de implementar | UAZAPI |
| 26 | `ALLOWED_ORIGIN` DEVE existir nos Secrets do Supabase em produção — sem ele, CORS usa fallback hardcoded errado e bloqueia TODAS as requisições do frontend | Deploy |
| 27 | Edge functions chamadas pelo browser DEVEM usar `getDynamicCorsHeaders(req)` — `browserCorsHeaders` é estático e falha quando o domínio real difere do fallback | CORS |
| 28 | NUNCA usar `now()` ou funções VOLATILE em predicado de índice parcial — PostgreSQL exige IMMUTABLE. Filtro temporal vai na query, não no `CREATE INDEX ... WHERE` | DB |
| 29 | SEMPRE verificar schema real do banco antes de escrever código de insert — nomes de coluna divergentes causam erro silencioso (`.maybeSingle()` retorna null) | Orchestrator |
| 30 | Supabase `flow_events.event_type` tem CHECK constraint — NUNCA inserir tipo fora da lista. Verificar migration antes de logar evento. | Orchestrator |
| 31 | `.single()` lança exceção se 0 ou >1 rows — SEMPRE usar `.maybeSingle()` em edge functions seguido de `if (error)` check explícito | DB |
| 36 | PostgREST `.upsert({ onConflict: 'col_a,col_b,col_c' })` falha — PostgREST não resolve constraint pelo nome das colunas. Usar RPC com `INSERT … ON CONFLICT (col_a, col_b, col_c) DO UPDATE` | Orchestrator |
| 37 | Não passar `step_data: {}` no insert de `flow_states` — sobrescreve o DEFAULT do banco. Omitir o campo para que `message_count: 0` e demais defaults sejam aplicados pelo PostgreSQL | Orchestrator |
| 38 | Sempre usar `?? 0` ao ler `step_data.message_count` — mesmo com DEFAULT, dados antigos podem ter o campo ausente | Orchestrator |
| 39 | `UNIQUE NULLS NOT DISTINCT` exige PostgreSQL 15+ — Supabase usa PG14. Usar dois índices parciais: `WHERE seller_id IS NULL` + `WHERE seller_id IS NOT NULL` | DB |
| 40 | `fetchWithTimeout` não é global no Deno runtime — SEMPRE importar explicitamente de `../_shared/fetchWithTimeout.ts` antes de usar | Edge Fn |
| 41 | `FORM_TEMPLATES` é `FormTemplate[]` (array) — NUNCA acessar como `Record<string, T>[key]`. Usar `.find(t => t.type === key)` | Frontend |
| 42 | `.single()` em queries de top-level (ai_agents, conversations, contacts) crasha se ID inválido — SEMPRE `.maybeSingle()` + null check nas queries principais do ai-agent | Edge Fn |
| 43 | `useEffect` dependency array DEVE incluir todos os campos usados no efeito, não só o `.id` — campos diferentes com mesmo id não disparam re-sync | React |
| 44 | `flow_followups.detection_type` tem CHECK com 7 valores de shadow mode — NUNCA inserir `'flow_followup'` ou qualquer valor fora da lista. Followups do orquestrador DEVEM usar `step_data` (followup_scheduled_at + followup_message + followup_sent) | Orchestrator |
| 45 | NUNCA buscar próximo step por `position = currentPosition + 1` — frágil se há gaps. Usar `.gt('position', current).order('position asc').limit(1)` → próximo step real | Orchestrator |
| 46 | Campos `corrected_text` calculados em check functions DEVEM ser propagados na issue — `applyCorrection` não tem acesso ao contexto, precisa do texto pré-calculado | Validator |
| 47 | Greeting subagent NUNCA usa `greeting_message` quando `lead.lead_name` é conhecido — independente de `sessionsCount`. Leads migrados do ai-agent antigo têm nome mas `sessionsCount=0`; Case C enviava template com "com quem eu falo?" para lead já identificado | Greeting |
| 48 | Após handoff, `smart_fill` completa qualificação imediatamente na próxima mensagem (respostas em `long_memory.profile`) → dispara handoff novamente → mensagem duplicada. Fix: guard no orchestrator verifica `flow_states WHERE status='handoff' AND completed_at >= now()-4h` antes de criar novo flow | Orchestrator |
| 49 | `kpiAtendidoIA` NUNCA usar tags agregadas de todas as conversas — herda `ia:shadow` de conversas antigas. SEMPRE usar `latestConv.tags` (conversa mais recente) | Frontend |
| 50 | `update_lead_profile` NÃO tem parâmetro `custom_fields` — campos customizados (ex: tipo_cliente) DEVEM usar `set_tags chave:valor`. Instrução em `additional` não basta: adicionar em `tags_labels` para garantir prioridade de execução | AI Agent |
| 51 | Filtro de tag por string completa (`t.endsWith('_interno')`) exclui tags válidas como `produto:piso_ceramica_interno` — o sufixo está no VALOR, não na chave. Filtrar o valor após split (`:`) ou remover o filtro | Frontend |
| 52 | Regras de extração em `prompt_sections.additional` são baixa prioridade — o agente as ignora quando há flow ativo. Regras de `set_tags` DEVEM estar em `tags_labels` para execução imediata | AI Agent |
| 53 | `clearContextMutation` DEVE finalizar `flow_states` ('active' e 'handoff') para o lead. Sem isso, após ia_cleared o orchestrator continua do passo anterior (skip greeting) e pode re-disparar handoff. Fix: `UPDATE flow_states SET status='abandoned' WHERE lead_id=X AND status IN ('active','handoff')` | Orchestrator |
| 54 | `clearContextMutation` DEVE resetar `lead_msg_count: 0` no update de conversations. A migration diz "Reset on ia_cleared" mas o reset nunca foi implementado. Sem isso, a primeira mensagem após clear já excede o limite → handoff dispara antes do greeting | AI Agent |
| 55 | Quando `ia_cleared` está presente, ai-agent DEVE contar mensagens desde `sessionStartDt` (`conversation_messages.direction='incoming'.gte(sessionStartDt)`) em vez do counter `lead_msg_count`. O counter pode estar desatualizado se o frontend falhou ao resetar. Abordagem self-healing | AI Agent |
| 56 | LLM faz handoff_to_human sem chamar search_products quando lead especificou marca: regra `handoff_rules "Lead confirma interesse"` dispara ao responder a última qualificação. Fix: hardcoded "BUSCA OBRIGATÓRIA ANTES DE HANDOFF" + "MARCA JÁ INFORMADA → máx 2 perguntas". Sequência correta: dados→search→handoff | AI Agent |
| 57 | `tipo_cliente` rejeitado silenciosamente pelo VALID_KEYS do set_tags se não estiver na whitelist. Campos customizados DEVEM ser adicionados ao VALID_KEYS em `index.ts` E ao prompt hardcoded antes de funcionar. Apenas adicionar ao prompt sem adicionar ao VALID_KEYS = tag rejeitada | AI Agent |
| 58 | Variáveis `const` dentro de `if` são block-scoped — referenciá-las fora causa ReferenceError silencioso em runtime (TS não compila strict no Deno Deploy). SEMPRE declarar com `let` no escopo externo se usada depois do bloco condicional | AI Agent |
| 59 | Catch block do ai-agent usava `agent_id: null` para logar erros, mas coluna é NOT NULL → INSERT falhava → erros desapareciam sem rastro. SEMPRE hoistar IDs antes do try block para acessar no catch | AI Agent |
| 60 | Regras de prompt que se contradizem anulam-se: "qualifique ambiente primeiro" vs "busca imediata com marca" = LLM segue a mais específica (qualificação). Regras de PRIORIDADE ABSOLUTA devem explicitamente anular as outras | AI Agent |
| 61 | NUNCA `localStorage.setItem()` no corpo do render React — é side effect. SEMPRE usar `useEffect`. Strict Mode executa o render 2x, causando escritas duplicadas. Leitura de localStorage no render também não é reativa: valor não atualiza sem re-mount | React |
| 62 | Comunicação entre componentes React na mesma janela NÃO funciona via `storage` event (só dispara entre abas). Usar `CustomEvent` + `dispatchEvent`/`addEventListener` para sincronizar estado entre componentes não-relacionados | React |
| 63 | `.in('role', [...]).maybeSingle()` CRASH se user tem múltiplos roles (>1 row). SEMPRE adicionar `.limit(1)` antes de `.maybeSingle()` em queries que podem retornar múltiplas linhas por design | DB |
| 64 | `data?.length` em queries PostgREST retorna no máximo 1000 (default page limit). Para contagem real, usar `{ count: 'exact', head: true }` e ler `count` do response — não transfere dados, só retorna o número | DB |
| 65 | `useState(true)` para `loading` em hooks que dependem de dados assíncronos (ex: `selectedInboxId`) deixa loading travado se a dependência não está pronta — `fetchFn` retorna early sem chamar `setLoading(false)`. SEMPRE iniciar `loading=false` e setar `true` apenas dentro da função de fetch | React |
| 66 | URLs de perfil WhatsApp (`pps.whatsapp.net`) expiram regularmente e geram 403 no console do browser. Erros de `<img>` são logados pelo browser antes de qualquer handler JS — a ÚNICA forma de evitar é não renderizar o `<img>`. Usar fallback (iniciais) na lista, carregar foto só quando necessário | Frontend |
| 67 | Múltiplos projetos Supabase no mesmo browser poluem localStorage com tokens `sb-{ref}-auth-token` stale. Limpar tokens de outros projetos no init do client para evitar confusão de sessões | Supabase |
| 68 | Supabase Free Plan — "Storage Size" na dashboard é org-wide (todos os projetos somam). Projeto antigo inativo pode ocupar o quota inteiro. Verificar TODOS os projetos da org ao investigar storage | Supabase |
| 69 | `useCallback` com dependência em objeto (ex: `[conversation]`) recria o callback a cada render porque objetos mudam de referência. Usar propriedade primitiva (`[conversation?.id]`) para estabilizar | React |
| 70 | `fetchIdRef` pattern para cancelar fetches stale pode travar `setLoading(false)` — o fetch "stale" completa mas não limpa loading. `setLoading(false)` DEVE ser incondicional no `finally`. Só `setData` precisa do guard | React |
| 71 | Supabase client (WebSocket + PostgREST) entra em estado quebrado após tab suspension do browser. Refetch seletivo (invalidateQueries, eventos) não resolve. Único fix confiável: `window.location.reload()` via `visibilitychange` — padrão de apps realtime (Slack, Discord) | Supabase |
| 72 | UAZAPI v2 (Go) NÃO tem endpoint para buscar foto de perfil sob demanda. `/contact/getProfilePic` retorna 405. `/profile/image` é para UPLOAD. Fotos chegam via webhook (`imagePreview`) e sync (`image`). NUNCA chamar endpoint inexistente — gera erro no console | UAZAPI |
| 73 | Permissões `inbox_users.can_view_unassigned` e `can_view_all_in_dept` são **SOFT** (frontend-only). Apenas `can_view_all` é enforçado pela função RLS `can_view_conversation`. Atendente avançado pode bypass via curl direto. Aceito como dívida temporária (cenário B2B com atendentes contratados). Hardening agendado: estender função RLS para enforçar as 3 colunas. | Helpdesk |
| 74 | Retention policies SEMPRE devem checar `is_table_protected(_table_name)` antes de DELETE — whitelist de 27 tabelas-núcleo (lead_profiles, contacts, ai_agents, conversations, inboxes, instances, departments, kanban_*, campaigns, forms, funnels, automation_rules, agent_profiles, flows, db_*, notifications). Tentativa de aplicar policy em tabela protegida loga erro e retorna sem deletar. Adicionar nova entidade-núcleo? Atualizar whitelist em `is_table_protected`. | Retention |
| 75 | `verifyCronOrService` falha com `token === envKey` quando JWT é rotacionado mas env vars não. Para edge functions chamadas tanto por cron quanto admin UI, usar `getJwtRole(req)` decodando payload e checar `role === 'service_role' || 'anon'`; se for user JWT, exigir `verifySuperAdmin`. Padrão usado em `db-retention-backup` e `db-cleanup-old-backups`. | Edge Fn |
| 76 | DELETE em `storage.objects` direto via SQL é bloqueado por trigger `storage.protect_delete()`. SEMPRE usar Storage API (`supabase.storage.from(bucket).remove([paths])`) ou DELETE via REST endpoint `/storage/v1/object/{bucket}/{path}`. Tentar `DELETE FROM storage.objects` retorna ERROR 42501. | Storage |
| 77 | `pg_cron` chamando edge function via `net.http_post` precisa de Bearer válido. Padrão do projeto: `SUPABASE_ANON_KEY` no `vault.decrypted_secrets`. Adicionar via `vault.create_secret(key, 'SUPABASE_ANON_KEY', desc)`. Sem isso, cron→edge dá `P0001: SUPABASE_ANON_KEY not found in vault`. | Cron |

---

## Histórico de Erros

> Bugs antigos (2026-04-06 a 2026-04-09) arquivados em: `wiki/log-arquivo-2026-04-12-fixes-kpi-s12.md`

### PostgreSQL IMMUTABLE em índice parcial — `now()` proibido (2026-04-11)

**O que:** Migration `20260415000001` falharia em produção com `ERROR: functions in index predicate must be marked IMMUTABLE`. O índice `idx_lead_memory_lookup` usava `WHERE expires_at IS NULL OR expires_at > now()`.
**Causa:** PostgreSQL exige que funções em predicados de índice parcial sejam IMMUTABLE. `now()` é VOLATILE — muda a cada chamada. O predicado de índice é avaliado na criação, não na query.
**Correção:** Predicado simplificado para `WHERE expires_at IS NULL` (IMMUTABLE). Filtro dinâmico `expires_at > now()` movido para as queries que consultam o índice.
**Regra 28:** NUNCA usar `now()`, `CURRENT_TIMESTAMP` ou qualquer função VOLATILE em predicados de índice parcial (`WHERE` do `CREATE INDEX`). O filtro temporal vai na query, não no índice.

### S2 Orchestrator — 6 bugs críticos encontrados na auditoria (2026-04-11)

**O que:** Após commit 367b4b0 (S2 Orchestrator skeleton), auditoria encontrou 6 bugs que impediriam qualquer insert no banco.

**Bugs encontrados:**
1. `current_step_id` em vez de `flow_step_id` (4 arquivos) — campo não existe na tabela
2. `.single()` em `updateFlowState` → crash se state não encontrado
3. `.single()` em `createFlowState` → pode crashar em race condition
4. `instance_id` NOT NULL ausente no insert de `flow_states`
5. `flow_id` + `instance_id` NOT NULL ausentes no insert de `flow_events`
6. `event_type: 'subagent_called'` violaria CHECK constraint — tipo inválido (correto: `tool_called`)
7. Coluna `event_data` não existe em `flow_events` — campo correto é `input` JSONB

**Causa raiz:** Tipos definidos sem validar contra schema real do banco. Nomes de colunas inventados (`current_step_id`, `event_data`) sem conferir migration. CHECK constraint não consultada.
**Correção:** Commit 7bb2f8e — `flow_step_id` em todos os arquivos, `.maybeSingle()` + error check, campos NOT NULL incluídos, `tool_called` como event_type, `input` JSONB em vez de `event_data`.
**Regras:**
- R29: SEMPRE ler o schema real (migration) antes de escrever código de insert
- R30: CHECK constraints em `event_type` devem ser consultadas antes de logar evento
- R31: `.single()` lança exceção → sempre `.maybeSingle()` em edge functions
- R34: Antes de usar qualquer coluna no código, verificar schema real com `information_schema.columns` — `conversations` usa `contact_id`/`inbox_id`, não `lead_id`/`instance_id`; tabela `leads` não existe, é `lead_profiles`; `flow_steps` usa `subagent_type`, não `step_type`
- R35: FKs em flow_states: `lead_id → lead_profiles.id` (não contacts.id). Para resolver lead de uma conversa: `conversations.contact_id → lead_profiles.contact_id → lead_profiles.id`
- R32: `useState(() => sideEffect())` NÃO é `useEffect` — inicializador roda 1x no mount com estado inicial undefined. Para reagir a dados assíncronos usar `useEffect(() => {}, [dep])`
- R33: Ao criar rotas React Router, SEMPRE verificar App.tsx E sidebar/nav. Código de página sem rota = inacessível (bug silencioso)

---

### M19 S2 aggregate-metrics — 3 bugs críticos (2026-04-13)

**B#1 — PostgREST `.eq()` com tabela relacionada não faz JOIN:**
`eq('inboxes.instance_id', instanceId)` não é uma sintaxe PostgREST válida para filtrar em FK. Retorna array vazio silenciosamente — conversas nunca eram agregadas, métricas zeravam.
**Correção:** 2 passos: buscar `inboxes.id WHERE instance_id=X`, depois `conversations.in('inbox_id', ids)`.
**Regra:** Ao precisar filtrar conversas por instância, SEMPRE usar join explícito em 2 etapas. PostgREST suporta embedded filters apenas com select `!inner()` e alias, não com `.eq('fk_table.column')`.

**B#2 — `conversations.resolved_at` não existe:**
Coluna selecionada e usada para calcular `avg_resolution_minutes`, mas o campo não existe na tabela (não foi incluído no schema). Causava erros silenciosos (`undefined`).
**Correção:** Usar `updated_at` como proxy para conversas com `status='resolved'`.
**Regra (reforço R29):** SEMPRE verificar schema real da tabela antes de selecionar colunas. `conversations` não tem `resolved_at` — usar `updated_at WHERE status='resolved'`.

**B#3 — Schema criado mas populate não implementado (T7/T8):**
`lead_score_history` e `conversion_funnel_events` foram criadas nas migrations com RLS e índices corretos, mas nenhuma edge function inseria dados nelas. Auditoria encontrou 0 referências em código.
**Correção:** Adicionadas `updateLeadScores()` e `recordFunnelEvents()` em `aggregate-metrics`, chamadas dentro de `aggregateDaily()` com try/catch isolado.
**Regra:** Após criar uma tabela nova, verificar SEMPRE se existe código que a popula. Schema sem populate = tabela fantasma. A auditoria pós-entrega é obrigatória antes de declarar sprint como concluído.

---

### S5 Orchestrator — 3 bugs em Memory Service + Greeting (2026-04-12)

**B#1 — `getStepType` lia campo inexistente:** `context.step_config.step_type` (undefined) → sempre despachava para stub 'custom'. Corrigido: `contextBuilder` injeta `subagent_type` no `step_config`; `getStepType` lê `subagent_type`.

**B#2 — PostgREST `.upsert({ onConflict: 'col,col,col' })` falha:** `"there is no unique or exclusion constraint matching"`. PostgREST não resolve constraint por lista de colunas. Solução: criar RPC `upsert_lead_long_memory` com `INSERT … ON CONFLICT (lead_id, memory_type, scope)` — idêntica à `upsert_lead_short_memory` mas sem TTL. R36 preventivo.

**B#3 — `step_data: {}` no insert sobrescreve DEFAULT:** `createFlowState` passava `step_data: {}`, sobrescrevendo o DEFAULT do banco `{message_count: 0, ...}`. Resultado: `message_count = undefined`. Check `isFirstMessage = (message_count === 0)` → false → `upsertLongMemory` nunca chamada. Correção dupla: (1) remover `step_data` do insert; (2) `?? 0` no check. R37+R38 preventivos.

**E2E validado (commit 935fb3f):** Case B (sessions_count++), Case C (greeting+UAZAPI), Case D (pede nome→continue), Case A (extrai nome ASCII→advance, salva full_name + long_memory).
