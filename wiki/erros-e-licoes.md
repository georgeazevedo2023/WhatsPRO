---
title: Erros e Lições
tags: [erros, bugs, licoes, preventivo, retention, cron, storage, db-constraint, controlled-input]
sources: [CLAUDE.md, docs/REGRAS_ASSISTENTE.md]
updated: 2026-05-05
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
| 32 | `useState(() => sideEffect())` NÃO é `useEffect` — inicializador roda 1x no mount com estado inicial undefined. Para reagir a dados assíncronos usar `useEffect(() => {}, [dep])` | React |
| 33 | Ao criar rotas React Router, SEMPRE verificar App.tsx E sidebar/nav. Código de página sem rota = inacessível (bug silencioso) | Frontend |
| 34 | Antes de usar qualquer coluna no código, verificar schema real com `information_schema.columns` — `conversations` usa `contact_id`/`inbox_id`, não `lead_id`/`instance_id`; tabela `leads` não existe, é `lead_profiles`; `flow_steps` usa `subagent_type`, não `step_type` | DB |
| 35 | FKs em flow_states: `lead_id → lead_profiles.id` (não contacts.id). Para resolver lead de uma conversa: `conversations.contact_id → lead_profiles.contact_id → lead_profiles.id` | DB |
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
| 78 | Hardcoded por nicho não escala em multi-tenant — `if (interesse.includes('tinta'))` no AI Agent quebra quando plataforma serve clínica/RH/e-commerce. SEMPRE estruturar regras por nicho como JSONB editável pelo admin (ex: `service_categories`), não como código. Pergunta-chave antes de codar regra: "essa regra serve para todos os agentes ou só pro nicho que estou pensando?" | AI Agent |
| 79 | Score do lead em `service_categories` reseta apenas em `ia_cleared:` — handoff/ticket resolution preservam score acumulado para que vendedor humano veja o progresso. NUNCA expor score ao lead — é métrica interna gestor. | AI Agent |
| 80 | NUNCA acumular commits represados em local master por > 1 sprint — cria descompasso silencioso entre backend (deployado via MCP) e frontend (esperando git push). Sintoma: tab nova invisível em prod mesmo com schema novo no banco. Webhook do Portainer (`/api/webhooks/...`) força redeploy quando necessário. | Deploy |
| 81 | Quando LLM ignora schema dinâmico (`service_categories`) e segue lógica fixa, **suspeitar PRIMEIRO do `prompt_sections` do agente no banco** — não do código. Prompt do agente carrega ANTES das regras dinâmicas em runtime e tem precedência comportamental. Auditar `SELECT prompt_sections` é mais barato que ler 2700 linhas de edge function. | AI Agent |
| 82 | Schemas com keys sufixadas por categoria (ex: `material_porta`, `material_pia`) são frágeis — LLMs reformulam livremente e usam keys genéricas (`material:`). Solução: aliasing automático no handler `set_tags` que constrói mapa `primeiro_segmento → key_sufixada` baseado em `matchCategory`. Aceita ambas as formas. | AI Agent |
| 83 | Quando lead atinge `max_score` do stage com `exit_action`, **handler `set_tags` DEVE injetar instrução `[INTERNO]` explícita** no retorno (ex: "AÇÃO: chame handoff_to_human AGORA"). Sem isso, LLM fica sem direção (já fez todas perguntas, regra "1 pergunta por mensagem" + sem mais nada → resposta vazia → cliente sem resposta). | AI Agent |
| 84 | ~~Sempre que adicionar categoria nova ao `service_categories` JSONB, lembrar de expandir `VALID_KEYS` hardcoded.~~ **RESOLVIDO 2026-04-30 (D29)** — `VALID_KEYS` agora é dinâmico via `buildValidTagKeys(config)` em `_shared/serviceCategories.ts`: combina `BASE_VALID_TAG_KEYS` (sistema) com `field.key` de todas as `stages.fields[]` da config. Adicionar categoria nova com fields novos valida automaticamente sem alterar código. Sintoma original (regressão antes do fix): `tipo_tinta` cadastrado no Eletropiso era rejeitado silenciosamente — score nunca subia. | AI Agent |
| 85 | Auto-handoff por `lead_msg_count >= MAX_LEAD_MESSAGES` (linha 536) DEVE checar `conversation.status_ia !== STATUS_IA.SHADOW` — sem o guard, conversa em shadow re-dispara mensagem de handoff a cada nova mensagem do lead, gerando spam. Sintoma: lead recebe "Vou te encaminhar..." 2-3x em sequência sem pedir nada. | AI Agent |
| 86 | TODOS os paths que transitam conversa para `status_ia=SHADOW` DEVEM resetar `lead_msg_count: 0` no UPDATE — sem reset, lead que volta dias depois imediatamente estoura o limit (counter não zera com o tempo) e dispara auto-handoff antes mesmo da IA responder. Aplicar em: auto-handoff por message limit, handoff_to_human tool, handoff trigger por texto, validator BLOCK, implicit text-handoff, deferred handoff trigger. | AI Agent |
| 87 | Quando lead pergunta sobre produto que a tenant NÃO vende, IA hoje cai em default category → handoff genérico → vendedor responde "não trabalhamos" manualmente. Solução: cadastrar lista `ai_agents.excluded_products JSONB` via UI admin (D28) — match por keyword detecta cedo, IA responde polidamente sem handoff e sem incrementar counter. NUNCA reaproveitar `blocked_topics` (semanticamente diferente — tabu vs ausente). | AI Agent |
| 88 | INSERT no Supabase JS retorna `{data, error}` em vez de throw — sem check explícito do `error`, falhas viram silent. Especialmente perigoso em CHECK constraints: adicionar event type novo no código sem atualizar `chk_*_event` na migration faz o INSERT falhar sem rastro. SEMPRE: (1) conferir CHECK constraints da tabela com `\d+ tabela`, (2) atualizar whitelist via migration, (3) usar helper `insertLogSafe(supabase, logger, payload)` em `_shared/agentHelpers.ts` — wrap try/catch + check do `{error}` com warn estruturado. Detectado em D28: log `excluded_product_match` não persistia. | DB |
| 89 | UI Input com `value={array.join(', ')}` controlado + `onChange` que faz split+trim+filter quebra digitação livre — espaço final é removido a cada keystroke, impedindo digitar mais que 1 palavra. Solução: sub-componente com `useState` local pra texto raw + sincronização externa por `useEffect` em `itemId` (não em `initialValue` para evitar override do input do user). Aplicado em `ExcludedProductsConfig.KeywordsInput`. | React |
| 90 | `supabase.from('user_roles').upsert({...}, { onConflict: 'user_id' })` retornava 400 em prod — tabela tinha PK em `id` (uuid próprio) **sem UNIQUE em `user_id`**. Sintoma: "Erro ao alterar papel" no UsersTab `confirmRoleChange`. PostgREST exige a constraint EXATA referenciada em `onConflict` (R36). Fix: migration `user_roles_unique_user_id` (1) deduplica por hierarquia (super_admin > gerente > user) — havia 1 user com 2 roles do trigger `handle_new_user`, (2) `ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id)`. Sem dedupe primeiro, ALTER TABLE falha. Sempre que upsert `onConflict: X` retornar 400, conferir UNIQUE em X com `pg_constraint`. | DB |
| 91 | Round-robin de fila de atendentes precisa **`SELECT … FOR UPDATE` no cursor** (`departments.last_assignee_position`) dentro da mesma transação em que se atribui o próximo. Sem o lock, 2 chamadas concorrentes do `pick_next_assignee` (ex.: 2 handoffs simultâneos) leem o mesmo cursor, escolhem o mesmo membro e ambos avançam — quebra a justiça da rotação. Pattern aplicado em `pick_next_assignee` (D30 Sprint A, 2026-05-04). Quando todos os membros têm `queue_position = NULL`, o cursor satura no sentinela (2147483647) e a rotação para — backfill espaçado (`ROW_NUMBER() * 10`) na migration evita esse estado. | DB |
| 92 | Supabase rotacionou `SUPABASE_ANON_KEY` no env das edge functions para o novo formato `sb_publishable_*`, mas `vault.decrypted_secrets.SUPABASE_ANON_KEY` continuava com o JWT legacy. Resultado: TODOS os crons que chamam edge fns via `Bearer (vault SUPABASE_ANON_KEY)` retornavam 401 silenciosamente — `process-jobs`, `process-flow-followups`, `aggregate-metrics-*`, `e2e-scheduled`. `cron.job_run_details` mostra "succeeded" porque o SQL command (`SELECT net.http_post(...) AS request_id`) retorna 1 row; precisa olhar `net._http_response.status_code` pra ver o 401. Fix: `SELECT vault.update_secret((SELECT id FROM vault.secrets WHERE name='SUPABASE_ANON_KEY'), '<publishable>')`. Detectado no smoke do D30 Sprint C (2026-05-04). Vault refresh leva 1-2 ticks pra propagar (cache pg_net). | Cron |
| 93 | UPDATE direto via PostgREST em tabela com RLS restritiva NÃO retorna erro 4xx — retorna 200 com `data: []` (zero rows updated). UI assume sucesso. Detectado no D30 Sprint F: `QueuePauseToggle` fazia `supabase.from('department_members').update(...)` mas a RLS só permite `is_super_admin()`. Atendentes clicavam "Pausado", UI mostrava sucesso, DB nunca atualizava. **Fix em 3 frentes**: (a) RPC `set_my_queue_paused(_paused, _reason)` SECURITY DEFINER com escopo limitado; (b) frontend chama RPC e valida `result.rows_affected > 0` antes de toast verde; (c) handler do catch lê `.message` de objetos não-Error (PostgrestError do Supabase tem `.message` mas não é instância de `Error`). **Regra preventiva**: SEMPRE que escrever em tabela via PostgREST direto, ou (1) garantir que RLS do user permite, ou (2) usar RPC SECURITY DEFINER, ou (3) checar `data.length`/`count` antes de assumir sucesso. | RLS |
| 94 | `selectedConversation.assigned_to` em React state fica stale quando o cron (ex: `requeue-conversations` D30) muda `conversations.assigned_to` em background. State local é atualizado **apenas** quando o frontend chama `handleAgentAssigned`. Sintoma D30: badge "Em fila — Slone" atualiza (porque `useActiveQueueEvents` tem Realtime + tick), mas header e painel direito do helpdesk continuam mostrando o assignee anterior (Jussara). Detectado durante Teste 7 do D30 (round-robin avançou via cron, UI ficou stale). **Fix**: useEffect em `HelpDesk.tsx` que observa `queueEvents` (sinal indireto do broadcast `queue-update`) e re-fetch de `conversations.assigned_to` da `selectedConversation`, atualizando state quando difere. **Regra preventiva**: quando uma feature de backend (cron / edge fn / outra aba) pode mudar uma tabela que o frontend está exibindo, o componente precisa de Realtime subscribe OU re-fetch via signal indireto (broadcast / mudança em hook relacionado). React state local não é fonte da verdade. | React |
| 95 | `assignHandoff` (helper compartilhado D30) atualizava `conversations.assigned_to` mas NÃO `conversations.department_id`. Sintoma: depois do cron `requeue-conversations` reatribuir, o painel direito do helpdesk mostrava "Departamento: Nenhum" mesmo com membros do dept Vendas atribuídos pela fila. Detectado durante Teste 7 do D30 (super_admin viu dept Nenhum no painel direito). **Fix**: incluir `department_id` no UPDATE da `conversations` em `_shared/handoffQueue.ts` (1 linha). Re-deploy de 3 edge fns que usam o helper: `requeue-conversations`, `assign-handoff`, `ai-agent`. Backfill SQL para conversas legadas (COALESCE de queue_events recente OU inboxes.default_department_id). **Regra preventiva**: quando UPDATE atualiza um campo derivado de outro contexto, atualizar TODOS os campos correlatos. Painel direito de detalhes da conversa lê 2+ campos (assigned_to + department_id); inconsistência = bug visual. | Helper |
| 98 | Ao replicar schema entre projetos Supabase com push de migrations + skip seletivo (ex: pular Lovable migrations superseded por snapshot 2026-03-20), os `GRANT ... TO anon, authenticated` ficam ausentes nas tabelas `public`. Sintoma: PostgREST retorna 403 com body `42501 permission denied for table X` mesmo com RLS policies idênticas ao antigo e `is_super_admin()` retornando true. Postgres exige GRANT (permissão de operação) + RLS (filtro de rows) — sem GRANT, RLS nem avalia. **Fix**: `GRANT USAGE ON SCHEMA public TO anon, authenticated; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ... ON TABLES TO anon, authenticated`. **Pegadinha**: NÃO incluir `GRANT EXECUTE ON ALL FUNCTIONS` — falha em fns internas (ex: `dblink_connect_u`) e aborta a transação inteira. **Regra preventiva**: ao migrar schema via skip seletivo, sempre validar GRANTs com `\dp tabela` ou `pg_proc.proacl` em pelo menos 3 tabelas-amostra antes de declarar replay como completo. Detectado durante migração Eletropiso 2026-05-06. | Auth/PostgREST |
| 97 | Ao migrar `auth.users` via SQL direto entre projetos Supabase (sem passar pelo Admin API), o campo `instance_id` precisa estar populado com `'00000000-0000-0000-0000-000000000000'` (UUID zero, padrão GoTrue) — não pode ficar NULL. Sintoma: login retorna 400 `invalid_credentials` e Admin API retorna `user_not_found` mesmo com user em `auth.users`, hash bcrypt válido, e identities populadas. Causa: GoTrue usa `instance_id` pra rotear users; NULL = invisível ao service. **Fix**: `UPDATE auth.users SET instance_id = '00000000-0000-0000-0000-000000000000' WHERE instance_id IS NULL`. **Regra**: ao replicar auth.users entre projetos via SQL/dblink, sempre incluir `instance_id` explícito no INSERT. Detectado durante migração Eletropiso 2026-05-06. | Auth |
| 96 | Chamadores externos (n8n, IoT, browser direto) batendo no gateway `*.supabase.co/functions/v1/*` são **invisíveis ao monitoring DB** — não passam por `net._http_response` (só esquema interno do `pg_net`), então `snapshot_platform_usage()` não os enxerga. Padrão silencioso: workflow legacy chama endpoint deletado/renomeado por meses (404 a cada 10s = 8.6k invocações/dia desperdiçadas). Detectado 2026-05-05 auditando logs de Edge Functions: `event-processor` (fn nunca existiu, function_id=null) + `process-jobs` (auth quebrado pós-R92, jamais esteve em pg_cron). **Defesas**: (a) `snapshot_platform_usage()` agora registra `db_to_fn_calls_24h` + `db_to_fn_error_pct_24h`; eleva alert pra `yellow` se >50% de erro com >=10 chamadas (sintoma R92 voltando); (b) auditoria mensal manual via MCP `get_logs service=edge-function` ou dashboard Supabase, procurando 4xx/5xx repetitivos com `function_id: null` (fn fantasma) ou padrão temporal regular (cron externo); (c) sempre que rotacionar vault ou alterar workflow externo, conferir logs de Edge Functions nos próximos 10min. | Monitoring |

---

## Histórico de Erros

> Bugs antigos arquivados:
> - 2026-04-06 a 2026-04-09 → `wiki/log-arquivo-2026-04-12-fixes-kpi-s12.md`
> - 2026-04-11 a 2026-04-13 (PostgreSQL IMMUTABLE, S2 Orchestrator 6 bugs, M19 S2 aggregate-metrics 3 bugs, S5 Orchestrator 3 bugs) → [[wiki/erros-arquivo-historico-abril]]

### D30 R91 — Round-robin de fila precisa SELECT FOR UPDATE no cursor (2026-05-04)

**O que:** Sprint A da Fila Inteligente precisava distribuir conversas em round-robin global. Versão ingênua mantinha `departments.last_assignee_position` como contador simples e fazia `UPDATE` no fim. Sob carga, **2 chamadas concorrentes** de `pick_next_assignee` (ex.: 2 handoffs simultâneos no mesmo dept) liam o mesmo cursor, escolhiam o mesmo membro, ambos avançavam — dois leads parando no mesmo atendente, próximo da fila pulado.

**Causa raiz:** sem `FOR UPDATE`, leitura concorrente é permitida e ambos enxergam o mesmo valor antes do UPDATE. Phantom da rotação justa.

**Edge case adjacente:** quando todos os membros têm `queue_position = NULL`, o cursor satura no sentinela (`2147483647`) e a rotação para silenciosamente — backfill espaçado (`ROW_NUMBER() * 10`) na migration evita esse estado.

**Correção:** RPC `pick_next_assignee` (migration `20260504000007`) faz `SELECT … FOR UPDATE` em `departments` no início, locando a row do cursor para a transação inteira. Smoke test 8 chamadas paralelas em prod: rotação OK + loop infinito + nenhum atendente repetido.

**Regra 91 (preventiva):** Round-robin de fila exige `SELECT … FOR UPDATE no cursor` dentro da mesma transação que atribui o próximo. Sem o lock, leituras concorrentes quebram a justiça da rotação. Backfill da coluna de posição evita estado-sentinela.

---

### D30 R92 — Vault SUPABASE_ANON_KEY desincronizado de env das edge fns (2026-05-04)

**O que:** Sprint C da Fila Inteligente fez o cron `requeue-conversations` chamar uma edge fn via `net.http_post` com `Bearer (vault SUPABASE_ANON_KEY)`. A chamada retornava **401** silenciosamente — `cron.job_run_details` mostrava `succeeded` (porque o SQL command `SELECT net.http_post(...) AS request_id` retornou 1 row), mas `net._http_response.status_code` mostrava `401`.

**Causa raiz:** Supabase rotacionou `SUPABASE_ANON_KEY` no env das edge functions para o novo formato `sb_publishable_*`, mas `vault.decrypted_secrets.SUPABASE_ANON_KEY` continuava com o JWT legacy. **TODOS os crons** que chamavam edge fns via vault key — `process-jobs`, `process-flow-followups`, `aggregate-metrics-*`, `e2e-scheduled` — estavam silenciosamente 401ando há tempo indeterminado. Detectado só no smoke do D30 Sprint C porque era a primeira coisa que dependia desse pipeline em prod imediatamente.

**Correção:** `SELECT vault.update_secret((SELECT id FROM vault.secrets WHERE name='SUPABASE_ANON_KEY'), '<publishable>')`. Vault refresh leva 1-2 ticks pra propagar (cache pg_net).

**Regra 92 (preventiva):** Quando edge fn é chamada via `net.http_post` com Bearer da vault, o `cron.job_run_details` mostra apenas se o SQL command rodou — não se o HTTP retornou 2xx. Para validar de verdade, **olhar `net._http_response.status_code`** após cada execução. Padrão para escrever cron novo: incluir `INSERT INTO log_table (..., http_status) SELECT ... FROM net._http_response WHERE id = (resultado do http_post)` ou checagem assíncrona.

---

### R96 — Chamadores externos invisíveis ao monitoring DB (2026-05-05)

**O que:** Auditoria pós-D30 descobriu 2 edge fns sendo bombardeadas a cada 10s e 60s sem nenhum cron interno responsável: `event-processor` 404 (fn nunca existiu, `function_id: null` na log) e `process-jobs` 401 (fn existe v4, auth quebrado padrão R92, mas jamais esteve em `cron.job`). Total: ~10.080 invocações/dia desperdiçadas = ~302k/mês = **~60% do limite Free Tier** queimadas em ruído puro.

**Causa raiz:** Workflows legacy no n8n da WSMARTvps batendo direto no gateway Supabase. Não passam por `net.http_post` (origem DB), então `net._http_response` não vê — todo o monitoring de saúde construído em cima dessa tabela (`snapshot_platform_usage`, alertas R92) era cego pra esse tráfego. Edge fn `event-processor` provavelmente foi deletada/renomeada e o n8n nunca foi atualizado; `process-jobs` perdeu auth quando vault rotacionou (2026-05-04) e tabela `job_queue` está vazia há ≥30d então ninguém percebeu o downtime efetivo.

**Correção parcial (em código):** Migration `20260505000002_platform_usage_db_to_fn_metrics`: estende `snapshot_platform_usage()` com `db_to_fn_calls_24h` + `db_to_fn_error_pct_24h`. Eleva `alert_level` pra `yellow` se DB→fn tem >=10 chamadas E >=50% retornaram 4xx/5xx (sintoma forte de R92 voltando). Notificação dedicada `db_to_fn_health_alert` separada do alerta principal.

**Correção operacional (n8n, fora do repo, pendente):** desabilitar/deletar workflow `event-processor` (endpoint nunca existiu); decidir entre deletar workflow `process-jobs` (job_queue vazio há 30d) ou atualizar `Authorization: Bearer` pro novo `SUPABASE_ANON_KEY` publishable.

**Regra 96 (preventiva):** Edge fns chamadas por sistemas externos (n8n, IoT, browser direto) precisam **auditoria periódica de logs do dashboard de Edge Functions** — `net._http_response` só vê tráfego DB→fn. Sintomas: 4xx/5xx repetitivos com `function_id: null` (fn fantasma) ou padrão temporal cron-like (10s, 60s, 5min). SOP no [[wiki/free-forever-playbook]] seção "Auditoria de tráfego órfão". Sempre que rotacionar vault ou alterar workflow externo, conferir logs nos próximos 10min.

---

### R100 — `<SelectItem value="">` quebra a página inteira (Radix Select) (2026-05-06)

**O que:** Playwright Onda 2 detectou ErrorBoundary `"Erro em Nova Campanha"` em `/dashboard/campaigns/new`. Mensagem: `A <Select.Item /> must have a value prop that is not an empty string.` Toda a página de criação de campanha estava inacessível desde algum ponto não rastreado.

**Causa raiz:** `src/components/campaigns/CampaignForm.tsx:309` tinha `<SelectItem value="">Nenhum</SelectItem>` no Select de "Funil CRM (opcional)". Radix Select reserva `value=""` para "limpar seleção" (volta pro placeholder). Quando você passa `value=""` em `<SelectItem>`, ele lança erro síncrono ao montar — derruba o componente inteiro via ErrorBoundary, pessoa nem consegue criar campanha.

**Por que escapou de prod:** o erro só aparece quando o componente monta. Provavelmente foi introduzido após um upgrade do Radix/shadcn que adicionou essa validação, ou nunca foi testado E2E. Não tinha cobertura Playwright até hoje.

**Correção:** sentinel `__none__` com mapeamento bidirecional:
```tsx
<Select
  value={kanbanBoardId || '__none__'}
  onValueChange={(v) => setKanbanBoardId(v === '__none__' ? '' : v)}
>
  <SelectTrigger>...</SelectTrigger>
  <SelectContent>
    <SelectItem value="__none__">Nenhum</SelectItem>
    {boards.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
  </SelectContent>
</Select>
```

Estado interno e payload do INSERT permanecem `""` (semântica "sem funil"). Sentinel só vive dentro do Select.

**Regra 100 (preventiva):** **NUNCA** usar `<SelectItem value="">` em Radix/shadcn Select. Para representar "Nenhum"/"Vazio" use sentinel (`'__none__'`, `'NONE'`, etc) e converta `<-> ''` no `onValueChange`/`value`. Adicionar grep no checklist de PR: `grep -rn 'SelectItem value=""' src/` deve retornar 0 ocorrências sempre. Considerar lint custom ou hook de pre-commit. Detectado por Playwright (`wiki/playwright-onda2.md`) — tipo de bug que só E2E acha.

---

### R101 — GRANTs faltando para `service_role` quebram TODAS as edge fns silenciosamente (2026-05-06)

**O que:** Smoke E2E pós-cutover Eletropiso retornou `whatsapp-webhook` 404 "Instance not found" mesmo com instância existente no DB (`name=Eletropiso`, `owner_jid=558181696546`). Atendentes não recebiam mensagens novas no helpdesk.

**Cadeia de descoberta:**
1. Usuária mandou WhatsApp pro número Eletropiso → UAZAPI disparou webhook → n8n encaminhou pro `whatsapp-webhook` → 404.
2. Verifiquei no DB: `SELECT * FROM instances WHERE name='Eletropiso'` retorna 1 row OK.
3. Reproduzi via curl direto na edge fn → 404 confirmado.
4. Testei a query OR exata via PostgREST com publishable key → `[]` (esperado, RLS).
5. Verifiquei policies RLS de `instances` → 4 policies normais (`is_super_admin OR user_instance_access`).
6. Verifiquei GRANTs → `anon`, `authenticated`, `postgres` tinham SELECT. **`service_role` NÃO tinha GRANT em nenhuma das 91 tabelas public.**

**Causa raiz:** No projeto novo (`prfcbfumyrrycsrcrvms`), GRANTs do schema `public` foram aplicados apenas para `anon` e `authenticated` (R98 hotfix). `service_role` ficou de fora. Como service_role normalmente bypassa RLS *após* ter o privilégio básico, sem GRANT ele recebe `[]` silenciosamente em SELECTs (sem erro de "permission denied" — simplesmente zero rows visíveis).

**Impacto:** TODAS as 41 edge fns que usam `createServiceClient()` estavam quebradas:
- `whatsapp-webhook` — não achava instância → 404
- `ai-agent` — não achava agente, mensagens, leads
- `ai-agent-debounce`, `requeue-conversations`, `assign-handoff` — todas com queries vazias
- crons HTTP que dependem de service_role internamente

**Por que escapou:** R98 corrigiu GRANTs para `anon`/`authenticated` (camada do frontend). Service_role não foi testado porque (a) não passa pelo PostgREST com headers do user, (b) bypass de RLS mascarava qualquer expectativa de erro, (c) zero invocações pós-cutover até a primeira msg WhatsApp real disparar o caminho.

**Correção:** Migration `20260506232300_r101_grant_service_role_public.sql`:
```sql
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO service_role;
```

Validação: `service_role_has_grants 0 → 91`. Curl no `whatsapp-webhook` voltou a retornar 200 OK + conversation_id.

**Regra 101 (preventiva):** Ao replicar projeto Supabase via push de migrations, conferir GRANTs em **três roles** (`anon`, `authenticated`, `service_role`), não dois. Sintoma característico de service_role sem GRANT: edge fn retorna 4xx/zeros silenciosamente em queries de tabelas que existem no DB. Verificação rápida: `SELECT COUNT(*) FROM information_schema.role_table_grants WHERE table_schema='public' AND grantee='service_role'` deve ser ≥ N tabelas. Se for 0, é R101. Detectado pelo smoke E2E real (não testes Playwright que rodam só no client) — confirma que **smoke contra UAZAPI/webhook é o único teste que pega esse padrão**.

---

### R102 — `whatsapp-webhook` cria conversa nova sem `department_id` (helpdesk mostra "Nenhum") (2026-05-06)

**O que:** Smoke E2E pós-R101: usuária mandou WhatsApp, IA respondeu corretamente, mas painel direito do helpdesk mostrava "Departamento: Nenhum" pra conversa nova do George. R95 (2026-05-05) corrigiu isso pro caminho do `assign-handoff`, mas conversas atendidas pela IA (que NUNCA passam por handoff) continuavam sem dept.

**Causa raiz:** `supabase/functions/whatsapp-webhook/index.ts:789-801` — INSERT de nova conversa setava apenas `inbox_id`, `contact_id`, `status`, `priority`, `is_read`, `last_message_at`. **Não populava `department_id`** mesmo quando `inboxes.default_department_id` estava configurado. Decisão histórica: dept era setado só no momento do handoff. Mas com IA resolvendo a maioria dos atendimentos, o gap se tornou crônico.

**Impacto:** 16 conversas no projeto novo Eletropiso com `department_id=NULL` apesar da inbox ter `default_department_id=Vendas`. Painel direito do helpdesk + filtros por departamento não funcionavam direito. R95 fechou um buraco; R102 fecha o segundo.

**Correção:**
1. **Backfill SQL (1x):**
   ```sql
   UPDATE conversations c SET department_id = i.default_department_id
   FROM inboxes i
   WHERE c.inbox_id = i.id AND c.department_id IS NULL AND i.default_department_id IS NOT NULL;
   ```
2. **Fix código (`whatsapp-webhook/index.ts`):** SELECT de inbox passa a incluir `default_department_id`; INSERT de conversa nova popula `department_id: inbox.default_department_id ?? null`.

**Regra 102 (preventiva):** Ao criar registro novo em tabela com FK opcional para configuração default em outra tabela parent (ex: `conversations.department_id` ↔ `inboxes.default_department_id`), **popular desde a criação**. Não confiar que outro fluxo (handoff, atribuição, etc) vai setar depois — pode nunca acontecer (ex: IA resolve e fecha). Padrão: SELECT do parent já traz a config default + INSERT do filho usa. Cross-ref com R95 (mesmo padrão pro caminho de handoff).

---

### R103 — LLM pula fields prioritários da stage de qualificação (2026-05-06)

**O que:** Conversa real do George testando a IA pós-migração: ele perguntou "voces tem tinta?", IA perguntou ambiente, George respondeu "quarto da minha filha" → IA combinou duas perguntas: "Tem preferência por alguma marca ou cor?" — pulou o campo **tipo_tinta** (priority 2) que estava entre ambiente (priority 1) e cor (priority 3) na stage de Identificação. Vendedor humano recebeu o lead sem saber se a tinta é acrílica/esmalte/verniz, info crítica para recomendar produto.

**Causa raiz:** o helper `getNextField()` em `_shared/serviceCategories.ts` foi escrito e testado, mas **nunca foi invocado em produção** — apenas nos próprios testes unitários. O ai-agent passava o sdr_flow + system prompt instruindo o LLM a "perguntar na ordem de priority", mas sem injeção concreta de qual é a próxima pergunta. O LLM interpretava livremente, combinando fields ou pulando.

**Correção (R103):** introduzida função `buildQualificationContext()` em `ai-agent/index.ts` que executa a cada turno:
1. Detecta categoria pelas tags (`extractInteresseFromTags`)
2. Calcula stage atual (`getCurrentStage`)
3. Acha próximo field via **`getNextField`** (helper que estava órfão)
4. Formata phrasing pronto via `formatPhrasing(stage.phrasing, nextField)`
5. Injeta no system prompt um bloco `[QUALIFICAÇÃO ATUAL]` com regras explícitas: "PRÓXIMA PERGUNTA OBRIGATÓRIA: {label}", "FRASE EXATA SUGERIDA: ...", "NUNCA combine com outro field".

Resultado: LLM passa a transcrever a pergunta computada em vez de inferir. Bloco aparece a cada turno enquanto houver categoria detectada + stage incompleto.

**Regra 103 (preventiva):** quando lógica de qualificação envolve ordem rigorosa de campos, **não confiar só em texto no system prompt** ("pergunte na ordem"). Pré-computar a próxima pergunta concreta no backend e injetar no prompt do LLM como diretiva — pré-compute > pós-instrução. Helpers como `getNextField` que só rodam em testes são **dívida silenciosa** — se o helper existe e cobre uma regra de negócio, deve ter caller real em produção. Auditar: `grep -rn 'export function NOME' src/ | wc -l` vs callers; se zero callers em código non-test, é red flag.

---

### R104 — `brandNotFound` falso positivo com catálogos rasos (2026-05-06)

**O que:** Mesma conversa do George — após search_products falhar 2x, a IA salvou tag `marca_indisponivel:rosa,_parede,_interna` no contexto da conversa. Mas "rosa" é cor, "parede" e "interna" são ambiente. A tag tagou a query inteira como se fosse marca.

**Causa raiz:** em `ai-agent/index.ts` (lógica pós-search AND filter), quando a busca em catálogo retorna zero produtos, o código identifica termos da query que não aparecem em NENHUM produto e marca como `brandNotFound`. Isso era seguro quando o catálogo é grande e completo (faltar 1 termo = provável marca). Mas o catálogo do Eletropiso tem só 7 produtos migrados — quase qualquer query tem 3+ termos faltando, todos viram "brandNotFound" mesmo sendo cor/ambiente/etc.

**Correção (R104):** guard de tamanho — só setar `brandNotFound = missingTerms.join(', ')` se `missingTerms.length <= 2`. Com ≥3 termos faltando, o sintoma é catálogo raso (não falta de marca específica) — ignorar e deixar `brandNotFound = null`. Aplicado em ambos os caminhos: AND filter result e wordByWordBroad detection.

**Regra 104 (preventiva):** detecção heurística de "termo X é marca" baseada em ausência no catálogo é frágil quando o catálogo é raso. Aplicar guard de tamanho (1-2 termos faltando = provável marca; 3+ = ruído). Idealmente, manter lista de marcas conhecidas por agente (`ai_agents.known_brands`) e só tagar `brandNotFound` quando termo faltante está na lista. Mas até lá, o guard de tamanho cobre os falsos positivos catastróficos.

---

### R105 — `business_hours` órfão pós-migração (2026-05-06)

**O que:** Smoke E2E pós-cutover Eletropiso: usuária mandou WhatsApp 20:51 BRT (terça, fora do horário comercial 08-18h cadastrado). IA respondeu normalmente sem mandar a `out_of_hours_message`. Esperado: "Estamos fora do nosso horário de atendimento agora..." em vez de greeting + qualificação.

**Causa raiz:** durante a migração de dados (Onda 2 via dblink), a coluna `ai_agents.business_hours` (jsonb) ficou NULL no projeto novo apesar de estar populada no antigo. O código do ai-agent só faz checagem de horário se `bh && typeof bh === 'object'` — com NULL, pula a checagem inteira. A `out_of_hours_message` estava cadastrada certinho, mas nunca acionada.

R99 cobriu 27 colunas faltando em 7 tabelas, mas `business_hours` não estava na lista (a coluna existia, faltou só o dado). É a 2ª variante do problema R99 — schema OK mas dados não vieram.

**Correção:** UPDATE direto via MCP populando o formato weekly esperado pelo código:
```json
{"sun":{"open":false},"mon":{"open":true,"start":"08:00","end":"18:00"},...,"sat":{"open":true,"start":"08:00","end":"12:00"}}
```

**Regra 105 (preventiva):** ao migrar JSONB ou colunas opcionais entre projetos via dblink, fazer **diff explícito** após o transplante: `WHERE coluna IS NULL` no novo + comparar com count no antigo (enquanto antigo ainda está disponível). Para configs operacionais (business_hours, system_settings, prompts customizados), criar smoke test pós-migração: simular cenário "fora de horário"/"feriado"/"sentinela" e confirmar comportamento esperado. Apenas validar schema (R99) não basta — dados ausentes são bug silencioso até alguém tropeçar em produção.

---

### R106 — Mensagem fora de horário repete a cada msg do lead (sem cooldown, ignora shadow) (2026-05-06)

**O que:** após R105 fix popular `business_hours`, lead George mandou "Ok" 21:34 → IA respondeu out_of_hours ✅. Mas em seguida George mandou "obrigado" 21:42 → IA respondeu out_of_hours **DE NOVO**. E a conversa do George estava em `status_ia='shadow'` (handoff já feito) — IA deveria ficar passiva, mas ainda assim disparou out_of_hours.

**Causa raiz:** o branch `if (isOutsideHours)` em `ai-agent/index.ts` envia a `out_of_hours_message` cega: sem checar histórico recente, sem checar `status_ia`. Lead manda 5 msgs fora de horário → recebe 5 mensagens automáticas idênticas. Pós-handoff, IA continua "ajudando" mesmo em shadow.

**Correção (R106):** dois guards adicionados antes do envio:

1. **Skip shadow:** se `conversation.status_ia === STATUS_IA.SHADOW`, retornar 200 sem enviar nada. Após handoff, IA fica 100% passiva — atendente humano que decide responder.
2. **Cooldown 60min:** SELECT em `conversation_messages` procurando msg outgoing com mesmo conteúdo da `out_of_hours_message` nos últimos 60min. Se existe, retornar sem enviar (lead já foi avisado). Janela de 60min é UX razoável: uma vez por hora basta.

**Regra 106 (preventiva):** auto-respostas (out_of_hours, fora-do-escopo, fallback do excluded_products, etc) precisam SEMPRE de:
- (a) **Cooldown** — não repetir a mesma mensagem em curto intervalo. Lead manda "oi", "alguém aí?", "responde por favor" → recebe 1 resposta, não 3.
- (b) **Skip se conversa não-ativa** — shadow, resolved, archived: IA fica passiva. Auto-resposta fora desses estados é spam pro humano que pegou o handoff.

Pattern: sempre que adicionar nova auto-resposta no ai-agent, aplicar essas 2 verificações antes do envio.

---

### R107 — `extended_hours_until` ignorado pelo ai-agent (lógica inline divergente do helper) (2026-05-07)

**O que:** durante teste E2E (cenário A1 do plano sandbox), setei `ai_agents.extended_hours_until = NOW() + 3 hours` no agente Eletropiso real e enviei `oi` via UAZAPI fora do horário comercial (~23h BRT). Esperava resposta de greeting normal (modo estendido ATIVO). Recebi `out_of_hours_message`. Override foi ignorado.

**Causa raiz:** `_shared/businessHours.ts` (criado na Sprint D30) tem `isOutsideBusinessHours(business_hours, extended_hours_until)` que respeita o override. Mas `ai-agent/index.ts` linhas 232-269 tinha **cópia inline** da lógica que **só lia `agent.business_hours`** — sem checar `extended_hours_until`. Comentário no topo do helper avisava: *"Replica a lógica inline do ai-agent — quando refatorar a checagem do ai-agent (Sprint H), trocar lá pra usar este helper."* Sprint H nunca aconteceu.

Outro local com mesmo problema: linha ~2517 (handoff message picker baseado em business_hours).

**Correção (R107):** `import { isOutsideBusinessHours } from '../_shared/businessHours.ts'` no ai-agent + substituição dos 2 blocos de lógica inline por chamadas ao helper. O helper já estava testado (`_shared/__tests__/businessHours.test.ts` cobre extended_hours_until override).

**Regra 107 (preventiva):**
- (a) **Comentário "TODO refatorar pra usar helper" é dívida silenciosa.** Quando alguém escreve helper A e mantém cópia inline B "por enquanto", a divergência é inevitável — features novas (como extended_hours_until) entram em A e ficam fora de B. Nunca aceitar essa dívida sem ticket explícito.
- (b) **Quando criar helper compartilhado, MIGRAR todos callers no mesmo PR.** Não deixar "callers antigos" pra Sprint X. Se o tamanho do PR fica desconfortável, dividir em PRs sequenciais com plano explícito (Sprint H aqui).
- (c) **Smoke E2E em cenários com override** (extended_hours, feature flags, bypasses) deve ser obrigatório quando o override é introduzido. R107 esperou ~6 meses pra ser pego porque ninguém testou extended_hours_until na prática até este sandbox.

---

### R108 — Search ignora acentos (unicode normalization) (2026-05-07)

**O que:** lead simulado mandou "preciso de tinta acrilica branca" (sem acento). Catálogo Eletropiso tem "Tinta Acrílica Fosco Standard 16L Branco - Coral". Search retornou ZERO produtos.

**Causa raiz:** Postgres `ILIKE %acrilica%` NÃO casa com "Acrílica" (combining diacritical mark `U+0301` no caractere `í`). Igualmente, no JS `String.includes("acrilica")` não casa "acrílica". Em catálogos com nomes ricos em acentuação (português), qualquer query ASCII falha.

**Correção (R108):** função `stripAccents(s)` aplicando `s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()` em todas comparações JS do `search_products` (linhas 1598, 1607, 1631, 1641, 1662). O ILIKE primário ainda é frouxo, mas o broad fallback retorna candidatos com pelo menos uma palavra match, e o post-filter normalizado refina pra AND completo.

**Regra 108 (preventiva):**
- (a) **Em produtos com texto em português, comparações case-sensitive ou diacritic-sensitive são bug latente.** Sempre normalizar `NFD + strip combining marks + toLowerCase` antes de comparar strings em pt-BR.
- (b) **Postgres tem `unaccent` extension** que faz isso no SQL. Pode ser uma alternativa mais elegante que aplicar JS post-filter — investigar em sessão dedicada.
- (c) **Este bug NÃO é coberto por testes unit.** Adicionar caso de teste em `search_products` com query sem acento + produto com acento.

---

### R110 — Stop-words de qualificação viravam falsos `marca_indisponivel:*` (2026-05-07)

**O que:** durante teste F1 sessão 1, lead simulado mandou "sou pintor profissional, preciso de tinta acrilica branca pra parede interna". Search retornou vazio + tag `marca_indisponivel:parede,_interna` foi adicionada. "parede" e "interna" são palavras de **ambiente** (qualification field), não marcas — falso positivo gerou ruído no painel do helpdesk.

**Causa raiz:** após search retornar 0, código detecta "termos que não aparecem em nenhum produto do catálogo" e infere que são **marcas não-vendidas**. Heurística válida pra catálogos com poucos produtos (`Suvinil` ou `Sherwin Williams` faltando = lead quer marca específica não-vendida). Mas guard era `missingTerms.length <= 2` — 2 palavras genéricas (parede + interna) também passavam. R104 já tentou mitigar com guard, mas guard sozinho não distingue palavras-de-marca de palavras-de-qualificação.

**Correção (R110):** novo arquivo `_shared/qualificationStopWords.ts` exportando `QUALIFICATION_STOP_WORDS` (Set<string>) e helper `filterNonBrandTerms(words)`. Lista contém ambientes (parede/sala/teto/...), cores (branco/preto/...), acabamentos (fosco/brilho/...), tipos (acrilica/esmalte/...) e unidades (m²/litros/...). No `search_products` (Case A linha 1651, Case B linha 1672), aplica `filterNonBrandTerms` ANTES do guard `<=2`. Marcas reais (1-2 palavras desconhecidas) ainda viram `marca_indisponivel`; palavras de qualificação não.

**Validação:** mesma query "sou pintor, preciso tinta acrilica branca pra parede interna" → search retornou 5 produtos + 0 tags falsas. R110 deployed em 2026-05-07.

**Regra 110 (preventiva):**
- (a) **Heurísticas baseadas em "termo ausente do catálogo"** precisam de **pré-filtro** com lista de palavras inequivocamente não-marca. Sem isso, geram falsos positivos toda vez que cliente escreve frase natural ("vermelha pra cozinha externa").
- (b) **Stop-words list deve viver fora do código** se possível. Se ficar muito longa (>50 termos por categoria), considerar **lista positiva de marcas** (cadastrar marcas conhecidas no catálogo + comparar com query) — mais escalável, menos manutenção.
- (c) **Smoke E2E com query natural** após qualquer ajuste em search/qualification. Sessão 1 só passou nesta detecção porque rodou cenário F1 com query rica ("pra parede interna pra obra de 200 metros") — testes unit com query "tinta acrilica" (curta) nunca pegariam o bug.

---

### R111 — Fuzzy fallback ignora filtros de price/category (2026-05-07)

**O que:** lead simulado mandou "quero tinta acrílica branca pra parede interna até 500 reais". LLM passou `max_price: 500` corretamente. Mas search retornou Tinta Eggshell R$ 792 + Cuba + Manta — produtos fora do filtro do cliente.

**Causa raiz:** quando primary search e word-by-word fallback retornam 0, código chama `search_products_fuzzy` RPC (pg_trgm word-level). RPC só recebe `agent_id`, `query`, `threshold`, `limit` — **NÃO recebe min_price / max_price / category**. Resultado fuzzy era atribuído direto a `products` sem nenhum post-filter.

**Correção (R111):** após `fuzzyProducts` retornar com resultados, aplicar JS post-filter respeitando `args.min_price`, `args.max_price` e `args.category` (este último com `stripAccents` no haystack). Se filter zera resultados, log info mas não erro (lead pode receber 0 produtos = enrichment ou handoff).

**Validação:** mesma query "tinta acrilica branca pra parede interna até 500" → carrossel com 2 produtos, ambos R$ ≤ 500 (Coral Standard R$ 427 + Esmalte Dialine R$ 51). Eggshell R$ 792 NÃO entrou.

**Regra 111 (preventiva):**
- (a) **Toda fallback chain de search precisa propagar TODOS os filtros do tool args.** RPCs no Postgres não devem ser tratadas como atalhos — se o filtro é importante (preço, categoria), aplicar JS antes de retornar.
- (b) **Auditar fallbacks após adicionar novo arg em ferramenta.** Quando `min_price` foi adicionado em `search_products`, primary e broad respeitaram, mas fuzzy ficou esquecido. Pattern: search test com filter de preço como smoke obrigatório após qualquer mudança em search.
- (c) **Falha silenciosa pior que erro.** Aqui não dava erro — só retornava produtos errados. Lead achava que loja vende produto fora do orçamento dele. Logs precisam destacar quando fuzzy é usado pra detectar este tipo de regressão.

---

### R112 — `excluded_products` com `message: ''` viola regra de ouro (2026-05-07, ✅ FIX shipado)

**O que:** lead simulado mandou "vocês têm caixa de correio?" (item em `excluded_products[caixa_correio].keywords`). IA respondeu: "**Não trabalhamos com** caixa de correio, posso te ajudar com outro produto?" — violação direta da regra de ouro do AI Agent (linha 1269 do system prompt: NUNCA dizer "não trabalhamos com").

**Causa raiz REAL (mais grave que pareceu inicialmente):** Não era LLM "caindo em comportamento default" — era CÓDIGO gerando a string proibida diretamente. Função `buildFallbackMessage(matchedKeyword)` em `_shared/excludedProducts.ts:36-38` retornava literal `\`Não trabalhamos com ${matchedKeyword}, posso te ajudar com outro produto?\``. Quando admin deixa `message: ''`, o helper substitui com fallback hardcoded — que era exatamente o texto proibido.

**Bug duplo:** o frontend `ExcludedProductsConfig.tsx` propagava o problema — UI mostrava o fallback como "preview" do que IA falaria quando message vazia, ensinando o admin que "está OK deixar vazio porque tem fallback automático". Comentário do tipo `message?: string  // se vazio, IA usa fallback "Não trabalhamos com..."`. Educava o admin a violar a regra.

**Correção (R112) backend (`_shared/excludedProducts.ts`):**
- (a) Reescrever `buildFallbackMessage(_kw, businessName?)` retornando texto que respeita regra de ouro: `"Esse não é nosso foco principal! Aqui [na {businessName}] a gente trabalha com materiais de construção (tintas, fechaduras, telhas, elétrica, hidráulica, impermeabilizantes). Posso te ajudar com algo dessa área? 😊"`
- (b) `matchExcludedProduct` agora aceita 3º arg `businessName` propagado de `agent.business_info.name`
- (c) Caller em `ai-agent/index.ts:550` passa `businessName` extraído de `agent.business_info`

**Correção (R112) frontend (`ExcludedProductsConfig.tsx`):**
- (a) `message` virou obrigatório (`message: string` em vez de `message?`) com validação `noMessage = !item.message?.trim()` que destaca campo em vermelho com erro inline
- (b) Botão "Usar mensagem padrão" gera template via `buildDefaultMessage(businessName)` — admin pode clicar pra preencher e depois personalizar
- (c) `addItem()` pré-preenche message com template default (admin já começa válido)
- (d) Removidas todas menções textuais a "não trabalhamos com" na UI (CardDescription, hint inline, lista de bullets)

**Validação:** após deploy, query "vocês têm geladeira?" → IA respondeu "*Esse não é nosso foco principal! Aqui a gente trabalha com materiais de construção (tintas, fechaduras, telhas, elétrica, hidráulica, impermeabilizantes). Posso te ajudar com algo dessa área? 😊*". Sem "não trabalhamos com". Evento `excluded_product_match` registrado com metadata.

**Regra 112 (preventiva):**
- (a) **Função fallback NUNCA pode hardcodar texto que viola regra de negócio.** Antes de escrever fallback, listar todas as regras absolutas do prompt e garantir que o fallback respeita TODAS. R112 mostra que o helper foi escrito por alguém que não conhecia a regra de ouro — gap de comunicação entre quem define prompt e quem implementa código.
- (b) **Validação no frontend > config opcional silenciosa.** Se um campo pode causar comportamento errado quando vazio, OU torná-lo obrigatório (com botão pra preencher template) OU garantir fallback de código que NÃO viola nada. Nunca os dois opcionais juntos.
- (c) **Auditoria do prompt vs código:** sempre que system prompt tem "NUNCA diga X", buscar no código todas as ocorrências de X e validar que nenhuma string fixa contém X. R112 só foi pego porque rodou cenário M7 — outras frases proibidas podem estar hardcoded em outros helpers.
- (d) **UI que ensina o admin precisa estar correta.** "Em branco, IA responde: 'Não trabalhamos com X'" era a UI didática que justamente CRIOU o problema (admins viam "tudo bem deixar vazio") e propagou pra prod. Toda informação na UI deve refletir comportamento desejado, não comportamento atual buggado.

---

### R109 — qualificationContext sobrescrito por outras seções (R103 parcial) (2026-05-07)

**O que:** após R103 fix (commit 5fc1038), LLM ainda misturava perguntas em alguns turnos. Cenário B1.2: tags = `[ambiente:interno, lead_score:15, ...]`, próximo field deveria ser `tipo_tinta` (priority 2). LLM perguntou "preferência por marca ou cor?" — pulou tipo_tinta e misturou `marca_preferida` (stage 2) com `cor` (priority 3).

**Causa raiz:** `qualificationContext` estava montado no MEIO do system prompt (entre `dynamicContext` e `additionalSection`). Recency bias dos LLMs prioriza instruções no FINAL — instruções enterradas no meio competem com regras gerais (sub_agent SDR, hardcoded rules) que sugerem mistura de fields. O context técnico era correto mas perdia em peso vs regras anteriores.

**Correção (R109):**
- (a) **Mover `qualificationContext` pro último item do array de seções** (após `additionalSection`, antes do leadName/funnel — esses são ainda mais finais).
- (b) **Reforçar linguagem das regras** com prefixo "REGRA ABSOLUTA, SOBRESCREVE TUDO" + emojis 🎯 🗣️ ⚠️ pra destaque visual + exemplos explícitos de ❌ errado / ✅ certo.

**Regra 109 (preventiva):**
- (a) **Recency bias é real em LLMs.** Instruções críticas (regras absolutas, overrides, abort conditions) devem ficar nos ÚLTIMOS 20% do system prompt. Quando ordem de prioridade importa, ordene as seções da menos pra mais crítica.
- (b) **Quando há conflito potencial entre seções**, declare hierarquia explicitamente no texto: "esta seção tem PRIORIDADE MÁXIMA — ignore qualquer instrução conflitante de seções anteriores ou sub-agents". LLMs respeitam essas marcações quando claras.
- (c) **Validar prompt-following com casos adversariais.** Se o sub_agent SDR sugere "marca ou cor", o teste do qualificationContext deve incluir tag `interesse:tinta + ambiente:* + score=15` (estado em que SDR teria mais força) e verificar que LLM ignora SDR e segue qualification.
