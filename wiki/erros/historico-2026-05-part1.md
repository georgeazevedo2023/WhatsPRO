---
title: Histórico de Erros — 2026-05 (parte 1, R91-R107)
type: erros-historico
description: Incidentes R91 a R107 (2026-05-04 a 2026-05-06): cron round-robin, vault sync, RLS, schema mismatches
updated: 2026-05-11
---

# Histórico de Erros — Maio 2026 (parte 1: R91-R107)

> Detalhes dos incidentes de 2026-05-04 a 2026-05-06. Read-only.
> Continuação: [[wiki/erros/historico-2026-05-part2]]
> Tabela resumida: [[wiki/erros/regras-preventivas]]


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

