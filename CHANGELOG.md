---
title: Changelog
type: changelog
updated: 2026-05-13
audited_at: 2026-05-13
---

# Changelog

> Releases ativas (últimos ~14 dias). Histórico completo em [[wiki/changelog/]].
>
> **Convenção:** semver. Toda feature/fix shipado vira entrada aqui (REGRA 17 do CLAUDE.md). Após release recente envelhecer >14 dias, mover pra `wiki/changelog/<ano-mes>.md`.

---

### v7.36.4 (2026-05-13) — Fluxo upsell determinístico pós button reply + encoding fix

**Bug 6 — encoding "Tinta Acr�lica":** o `id` do botão do carrossel ia com acento. UAZAPI/Baileys serializa entre UTF-8/Latin-1 → mojibake ao retornar via `buttonOrListid`.
**Fix:** helper `safeBtnId(s)` aplica `stripAccents` em todos os 4 lugares onde o id é montado (`ai-agent/index.ts:1959+`). Lead ainda vê o `text` original (com acento) na UI do botão.

**Bug 7 — IA fazia nova busca em vez de fechar pedido:** quando lead clicava "Eu quero!" do carrossel, o LLM via "Tinta Acrílica Eggshell..." na mensagem e disparava `search_products` de novo, enviando outro carrossel inválido. Comportamento esperado: confirmar item, perguntar upsell, fazer handoff quando lead fechasse.
**Fix:** handler determinístico em `ai-agent/index.ts:269+` ANTES da chamada LLM:
- Detecta padrão `(Eu quero!|Mais informações) (Produto X)` com `matchAll` (suporta múltiplos cliques em 1 turno)
- Acumula `produto_escolhido:X` em `conversation.tags`
- Envia mensagem de upsell formal+simpática com lista de produtos
- Quando lead responde com closing (`obrigado/é só isso/finalizar/nada mais/...`), faz handoff direto com mensagem formal listando produtos
- Quando lead responde com novo item (descrição livre), limpa tag `aguardando_upsell:true` e deixa LLM rodar normalmente

**Defaults Eletropiso atualizados** (SQL):
- `handoff_message`: *"Perfeito! Vou conectar você com nosso consultor de vendas para finalizar seu pedido. Em instantes você terá retorno. Foi um prazer atender! 😊"*
- `handoff_message_outside_hours`: *"Perfeito! Anotei seu pedido. Nosso consultor de vendas dará prosseguimento ao seu atendimento assim que estivermos disponíveis. Foi um prazer atender! 😊"*

**Validação E2E:** simulação via POST direto no webhook com 2 cliques + closing ("obrigado, é só isso"). IA respondeu corretamente em todos os 3 turnos. Dados de teste limpos do DB após validação.

**Logs novos em `ai_agent_logs`:** `upsell_prompt_sent`, `upsell_closed_handoff` (com metadata.produtos[]).

**Arquivos:**
- `supabase/functions/ai-agent/index.ts` — helper `safeBtnId` + handler upsell determinístico
- DB — UPDATE de `handoff_message` e `handoff_message_outside_hours` da Eletropiso

**Deploy:** `ai-agent` v32 via MCP.

---

### v7.36.3 (2026-05-13) — Button reply capturado via campo canônico UAZAPI

**Fix definitivo do Bug 3** descoberto pelo gestor durante teste sandbox: as 8 variantes Baileys/legacy adicionadas em v7.36.1 não capturavam button reply de carrossel porque UAZAPI v2 **normaliza tudo para um único campo**: `message.buttonOrListid`.

**Descoberta:** OpenAPI spec da UAZAPI v2 (`docs.uazapi.com/openapi-bundled.json`, schema `Message`):
> `buttonOrListid`: "ID do botão ou item de lista selecionado"
> `convertOptions`: "Conversão de opções da mensagem, lista, enquete e botões"

UAZAPI já desfaz o aninhamento do Baileys e devolve um campo flat. As variantes Baileys (`buttonsResponseMessage`, `templateButtonReplyMessage`, `interactiveResponseMessage`) que adicionei antes eram irrelevantes — UAZAPI nunca manda nesse formato. Mantidas como fallback defensivo.

**Validação:** POST simulado direto no webhook com payload UAZAPI v2 (`buttonOrListid` + `convertOptions`) gravou `content = "Eu quero! (Tinta Acrílica Eggshell Premium 18L Branco Neve Sol E Chuva - Coral)"` na primeira tentativa.

**Arquivos:**
- `supabase/functions/whatsapp-webhook/index.ts` — variante V0 prioritária `buttonOrListid` + parse de `convertOptions` (JSON-serializado) pra `displayText`. Debug log temporário removido.

**Deploy:** `whatsapp-webhook` v7 via MCP.

**Lição:** [[wiki/erros-e-licoes]] — atualizada com "UAZAPI normaliza Baileys → buttonOrListid" como causa raiz real.

---

### v7.36.2 (2026-05-13) — Auto-extração de fields + carrossel bonito

**Bug 4 (qualificação):** IA repetia perguntas que o lead já havia respondido na 1ª mensagem.
- Lead: *"Tem tinta acrílica fosco?"* (trazia `tipo_tinta=acrílica` + `acabamento=fosco`)
- IA depois perguntou *"qual tipo de tinta? (acrílica, esmalte, epóxi)"* — violação direta de regra hardcoded `1339`.
- **Causa:** LLM nunca chamava `set_tags` na 1ª resposta — o `qualificationContext` computava "próxima pergunta = X" antes do LLM extrair os fields. Problema de **timing**, não de prompt.
- **Fix (defesa em camada):**
  - **Código:** novo `_shared/fieldAutoExtractor.ts` scaneia `incomingText` cruzando com `examples` dos fields da categoria detectada. Word boundary + normalização de acento + detecção de negação ("não", "sem", "exceto" + até 4 palavras). Pré-popula `conversation.tags` ANTES de `buildQualificationContext`.
  - **Prompt:** reforço em `hardcodedRules` com exemplo concreto da falha do George.
- **Defesa em profundidade:** mesmo se LLM ignorar a regra, o código já preencheu. 20 testes vitest cobrem positivos, negação, word boundary, falso positivo, fields numéricos pulados.

**Bug 5 (UI):** carrossel do helpdesk com botões "Eu quero!" / "Mais informações" exibidos como texto cinza minúsculo.
- **Fix:** botões agora têm fundo colorido por tipo — verde (REPLY), azul (URL), âmbar (CALL) — com ícone CornerDownLeft. Card maior (w-52), shadow leve, layout flex pra botões ficarem sempre no rodapé.

**Arquivos:**
- `supabase/functions/_shared/fieldAutoExtractor.ts` (novo)
- `supabase/functions/_shared/__tests__/fieldAutoExtractor.test.ts` (novo, 20 testes)
- `supabase/functions/ai-agent/index.ts` — import + bloco auto-extract antes de qualificationContext + reforço hardcodedRules
- `src/components/helpdesk/MessageBubble.tsx` — estilo carrossel + CornerDownLeft

**Deploys:** `ai-agent` v30 via MCP. Frontend: refresh.

**Logging:** novo evento `auto_field_extracted` em `ai_agent_logs` com payload do que foi extraído — debugável via SQL.

**Limites do MVP:**
- Fields numéricos (quantidade, voltagem, bitola, etc.) **não** são auto-extraídos — requerem regex específica que entenda unidades.
- Detecção de interesse (criação da tag `interesse:tinta`) continua dependendo do LLM/search_products — auto-extract só roda quando categoria já está identificada.

**Validação E2E:** pendente — gestor refazendo teste de tinta.

---

### v7.36.1 (2026-05-13) — Carrossel: botões + button-reply + anti-eco

**3 fixes E2E descobertos no teste sandbox de tinta:**

1. **🐛 IA parava após clique em botão REPLY do carrossel** (crítico — perda de venda).
   - Webhook gravava `content=""` porque só extraía `selectedButtonId` (formato legacy UAZAPI).
   - Ai-agent fazia early-return em `index.ts:253` por `no_text`.
   - **Fix:** webhook agora tenta 8 variantes UAZAPI/Baileys: `selectedButtonId`, `buttonsResponseMessage`, `templateButtonReplyMessage`, `interactiveResponseMessage.nativeFlowResponseMessage`, `buttonReply`, `selectedId/selectedDisplayText`, `listResponseMessage`, `listResponse`. Grava como `"${displayText} (${id})"` pra LLM saber QUAL produto o lead escolheu.

2. **🎨 Helpdesk não mostrava botões do carrossel** (UX admin).
   - `MessageBubble.tsx:396` lia `btn.label`, mas ai-agent salva `btn.text`.
   - **Fix:** `btn.label || btn.text` + tipo TS atualizado.

3. **💬 IA ecoava resposta do lead antes de perguntar** ("Anotado, ambiente interno para o quarto da sua filha. Você tem preferência por marca?").
   - Sem regra explícita anti-eco no `hardcodedRules`.
   - **Fix:** nova regra absoluta proíbe "Anotado/Entendi/Perfeito/Certo/Ok/Show/Beleza" + parafrasear. Confirmação só em fechamento de pedido.

**Arquivos:**
- `supabase/functions/whatsapp-webhook/index.ts` — 8 variantes de button reply
- `supabase/functions/ai-agent/index.ts:1339` — regra anti-eco em `hardcodedRules`
- `src/components/helpdesk/MessageBubble.tsx:396` — `btn.label || btn.text`

**Deploys:** `whatsapp-webhook` (versão 6) + `ai-agent` (versão 29). Frontend: refresh.

**Validação E2E:** pendente — gestor testando agora no sandbox.

---

### v7.36.0 (2026-05-13) — AI Agent atende 24/7 + toggle "Avisar fora do horário"

**Mudança de comportamento:** AI Agent **deixa de silenciar fora do horário comercial**. O agente qualifica leads em qualquer dia/hora; o horário só decide a mensagem usada no momento do transbordo.

**Novo toggle por agente** (`ai_agents.notify_outside_hours_on_handoff`, default `true`):
- **ON (default)** — atendentes só dentro do horário. Transbordo fora do horário envia `handoff_message_outside_hours` ("estamos fora do horário, consultor dará continuidade quando voltar").
- **OFF** — atendentes 24/7. Transbordo sempre usa `handoff_message` normal, sem aviso de horário.

**Migração silenciosa:** todos os tenants sobem com toggle ON (comportamento novo = desejável na maioria dos casos). Quem tinha atendentes 24/7 só precisa desligar o toggle uma vez no admin (`/dashboard/ai-agent → Segurança → Horário Comercial`).

**Texto default atualizado** para `handoff_message_outside_hours`: *"No momento estamos fora do horário de atendimento, mas assim que disponível nosso consultor de vendas vai dar prosseguimento ao seu atendimento. Deseja algo mais? 😊"* (aplicado só em configs novas).

**Campos**:
- ➕ `ai_agents.notify_outside_hours_on_handoff` (boolean, NOT NULL, default true)
- 🔇 `ai_agents.out_of_hours_message` — coluna preservada, deixou de ser lida pelo backend e removida do admin UI.

**Modo Estendido (D30 Sprint E)** inalterado — funciona como antes, com a nova lógica respeitando `extended_hours_until`.

**Hint LLM:** quando lead chega fora do horário com toggle ON, system prompt injeta contexto pra IA não prometer retorno imediato ("te ligo em 5min").

**Arquivos:**
- DB migration `add_notify_outside_hours_on_handoff`
- `src/integrations/supabase/types.ts`
- `src/components/admin/ai-agent/BusinessHoursEditor.tsx` — Switch + tooltip
- `src/components/admin/ai-agent/RulesConfig.tsx` — props novas
- `src/components/admin/AIAgentTab.tsx` — ALLOWED_FIELDS
- `supabase/functions/ai-agent/index.ts` — bloco skip removido + handoff respeita toggle + hint contextual
- Testes: 4 novos em `BusinessHoursEditor.test.tsx` (13/13 ✓)

---

### v7.35.3 (2026-05-12) — Fix: RPC `append_ai_debounce_message` quebrada por tipo errado

RPC declarava `p_instance_id uuid`, mas `instances.id` é `text` (IDs UAZAPI tipo `r466a98889b5809` não são UUID). Toda chamada explodia com `22P02 invalid input syntax for type uuid`. Erro silenciado em 3 camadas de fire-and-forget. Migration `fix_append_ai_debounce_message_instance_id_text` faz DROP + recria com tipo correto. Smoke test OK; pipeline destravado. Lição em [[wiki/erros-e-licoes]].

---

### v7.35.2 (2026-05-12) — Retention 24h dos logs do Supabase (-30 MB)

**Problema:** banco em 52 MB no DbSizeCard, mas só 5 MB era produto. 30 MB (55%) eram **logs internos do Supabase** que crescem sem cleanup automático:
- `net._http_response`: 21 MB (~3 MB/hora — toda chamada HTTP feita por `pg_net`).
- `cron.job_run_details`: 8 MB (~2.300 registros/dia — toda execução de pg_cron).

**Limpeza imediata:** `TRUNCATE` nas duas tabelas → banco 52→23 MB.

**Migration `cron_retention_system_logs_24h`:**
- Função `public.purge_system_logs_older_than_24h()` `SECURITY DEFINER` — apaga registros com timestamp <24h em ambas tabelas e retorna `jsonb` com contagens.
- Job `pg_cron` `purge_system_logs_24h` schedule `0 * * * *` (top of every hour).
- Bloco `DO` antes do schedule remove versão antiga se existir (reaplicação idempotente).

**Resultado:** banco fica estável em ~23 MB. Nenhum impacto operacional — esses logs não são usados pelo produto.

---

### v7.35.1 (2026-05-12) — Dashboard do Gestor: botão limpar pendências

**Demanda:** gestor precisa tirar itens irrelevantes (spam tipo "Zig Online", testes) das listas de pendência sem mexer no helpdesk em si.

**DB:**
- Migration `rpc_dispense_dashboard_conversation` cria 2 RPCs `SECURITY DEFINER`:
  - `dispense_conversation_from_dashboard(conversation_id)` — append tag `dashboard:dispensed` (preserva resto do array via `DISTINCT unnest`, segue regra `NEVER empty tags`).
  - `restore_conversation_to_dashboard(conversation_id)` — `array_remove` da mesma tag.
- As 3 RPCs de pendência (`get_unanswered_first_messages`, `get_abandoned_conversations`, `get_active_quotes`) ganham `AND NOT ('dashboard:dispensed' = ANY(c.tags))`.

**Frontend:**
- `PendingConversationsCard` ganha botão **X** ao lado do link externo em cada item — tooltip "Remover da lista (spam, teste, já resolvida)".
- Toast com botão **"Desfazer"** (Sonner action) chama `restore_conversation_to_dashboard` e re-invalida queries.
- Toast verde no sucesso, vermelho em erro. Estados isolados por item.
- `useQueryClient().invalidateQueries({ queryKey: ['manager-advanced'] })` força re-fetch das 3 RPCs após dispense/undo.

**Não afeta:** helpdesk segue mostrando a conversa normalmente. Conversa não é arquivada nem alterada operacionalmente — só ganha tag de UI.

**Verificação:** smoke test SQL completo (dispense → tag aparece → query filtra → restore → tag removida). `tsc --noEmit` = 0. Console limpo.

---

### v7.35.0 (2026-05-11) — Dashboard do Gestor: pivô comercial (Fase 3)

**Contexto:** gestor pediu para ver foco comercial em vez de custo IA. Demandas: tirar custos, adicionar lista de leads sem 1ª resposta, cotações em andamento, top objeções e motivos de conversa em destaque.

**Removido:**
- Card `Custo IA` dos KPIs (ManagerKPICards) — grid agora 5 colunas.
- Linha `Custo/conv.` do `IAvsVendorComparison`.
- Barra de meta `Custo IA` no painel de goals.

**DB — 2 RPCs novas (migrations `rpc_unanswered_first_messages` + `rpc_active_quotes`):**
- `get_unanswered_first_messages(instance, days_lookback)` — conversas com ≥1 incoming e ZERO outgoing. Diferente de `get_abandoned_conversations` (que olha última msg). Validada Eletropiso: 1 lead esperando há 716h.
- `get_active_quotes(instance)` — conversas com tag `motivo:orcamento` sem `venda:fechada` nem `venda:perdida`. Retorna contato + horas desde última msg. Validada: 0 ativas (consistente com 0 cotações no período).

**Frontend:**
- `useManagerAdvancedMetrics` agora retorna `unanswered` e `activeQuotes` (Promise.all com 6 RPCs).
- Novo componente genérico `PendingConversationsCard` (substitui `AbandonedConversationsList`, que foi removido) — reutilizável para 3 widgets de pendência com badges de severidade.
- Reorganização da **Zona 3 Atendimento** em 3 linhas:
  1. Pendências críticas (grid 3 cols): Sem 1ª resposta · Sem resposta +24h · Cotações em andamento.
  2. Análise (grid 2 cols): Top objeções (promovido do InsightsTab) + Motivos de conversa (`TopContactReasons` com agrupamento por AI).
  3. Equipe (grid 2 cols): Demanda vs Cobertura + Ranking de vendedores.
- `useDashboardInsights` adicionado ao `ManagerDashboard` (deduplica com `InsightsTab` via React Query).

**Verificação:** `tsc --noEmit` = 0 erros, HMR sem warnings, console limpo no redirect `/login`. Commit anterior (Fases 1+2) deployado em `66d2461`.

---

### v7.34.0 (2026-05-11) — Dashboard do Gestor: métricas avançadas (Fase 2)

**Contexto:** Fase 1 (v7.33.0) unificou as superfícies. Fase 2 adiciona as 4 métricas que o gestor precisa pra agir, não só ver: quanto a equipe demora, quem ficou pendurado, em que horário a casa some, qual canal converte.

**DB — 4 RPCs novas (migration `rpc_manager_phase2_advanced_metrics`):**

- `get_response_time_percentiles(instance, start, end)` — P50/P95 em segundos do tempo entre a 1ª msg incoming e a 1ª outgoing de cada conversa no período. Validada Eletropiso 30d: P50 = 23s, P95 = 89s, n = 11.
- `get_abandoned_conversations(instance, hours_threshold default 24)` — última msg da conversa é incoming + mais antiga que threshold. Retorna contato + horas esperando. Validada: 6 conversas abandonadas, max 1132h (~47 dias).
- `get_demand_vs_coverage_by_hour(instance, start, end)` — buckets 0-23 (TZ `America/Sao_Paulo`) com `demand` (incoming) e `coverage` (outgoing). Identifica gap de cobertura.
- `get_conversion_by_origin(instance, start, end)` — por `v_lead_metrics.origin`, total de leads × leads com tag `venda:fechada` × taxa %. Tags em jsonb, suporta `?` operator E array contains.

Todas `STABLE SECURITY INVOKER`, grant `authenticated`, search_path locked. types.ts atualizado com as 4 assinaturas.

**Frontend:**

- `useManagerAdvancedMetrics(instanceId, periodDays, abandonedHoursThreshold)` — `Promise.all` das 4 RPCs, retorna `{responseTime, abandoned, hours, conversionByOrigin}` com normalização Number().
- `ResponseTimeCard` — 2 colunas (P50 + P95) com `fmt()` adaptativo (s/m/h) e `tone()` por faixa (verde <1min, âmbar <30min, vermelho ≥30min).
- `AbandonedConversationsList` — lista top 8 com link direto pra conversa no helpdesk, badge de severidade por tempo (<48h amber, <168h orange, >7d red). Empty state celebra equipe em dia.
- `DemandVsCoverageChart` — ComposedChart recharts: barras rosé pra demanda (lead) + linha sky pra cobertura (casa) + badges destacando hora-pico de cada série.
- `ConversionByOriginCard` — tabela compacta `Origem | Leads | Fechadas | Conv.%` com `tone()` por taxa.
- `ManagerDashboard.tsx` integra os 4 componentes nas zonas:
  - **Zona 1** (Pulso) ganha `ResponseTimeCard` abaixo dos KPIs.
  - **Zona 3** (Atendimento) ganha grid 2×1 com `AbandonedConversationsList` + `DemandVsCoverageChart` no topo.
  - **Zona 4** (IA & Comercial) substitui o lado direito do funil por `ConversionByOriginCard`; `IAvsVendorComparison` ganha linha própria abaixo.

**Verificação:** `tsc --noEmit` = 0 erros. HMR sem warnings. Console limpo no redirect `/login`. RPCs validadas com dados reais Eletropiso.

---

### v7.33.0 (2026-05-11) — Dashboard do Gestor unificado (Fase 1)

**Contexto:** gestor tinha 3 superfícies separadas (`/dashboard` "Olá George" + `/dashboard/gestao` Métricas + Insights) e Sandbox IA poluía métricas de produção (11.955 participantes da sandbox somavam com Eletropiso). Faltava segmentação leads novos vs recorrentes.

**DB:**
- Migration `add_is_sandbox_to_instances`: coluna `is_sandbox boolean NOT NULL DEFAULT false` em `instances` + índice parcial. Sandbox IA (`rb84e079eeab167`) marcada.
- RPC `get_leads_new_vs_returning(p_instance_id, p_start, p_end)`: série diária. Novo = primeira conversa do contato (`MIN(conversations.created_at)` por inbox da instância) caiu no período. Recorrente = contato existia antes do período e voltou. `SECURITY INVOKER`, grant para `authenticated`.

**Frontend:**
- `useManagerInstances({ includeSandbox })` (default `false`) — exclui sandbox do dropdown.
- `useLeadsNewVsReturning` — chama RPC, preenche dias zerados, retorna `{series, totals}`.
- `LeadsNewVsReturningChart` — área empilhada (recharts) verde/roxo + badges com totais no header.
- `ManagerDashboard.tsx` **reescrito sem abas**, 4 zonas em scroll único:
  1. **Pulso do período** — KPIs (6 cards) + barras de meta opcionais.
  2. **Tendência & volume** — Novos/Recorrentes + Tendência + Origem + Horário das Conversas (absorvido do DashboardHome).
  3. **Atendimento** — Principais motivos de contato (absorvido) + Ranking vendedores.
  4. **IA & comercial** — Funil + IA vs Vendedor + InsightsTab inteiro (13 widgets de vendas/produtos/marcas/objeções).
- Toggle **"Sandbox: ON/OFF"** no header — só pro super_admin; gerente nunca vê.
- `types.ts` ganha `is_sandbox` em `instances.Row/Insert/Update` + assinatura da RPC.

**Acesso:** rota `/dashboard/gestao` já guardada por `CrmRoute` (super_admin OU gerente). Gerente loga → cai direto no unificado. Nenhuma guard alterada.

**Não inclui (Fase 2):** tempo 1ª resposta P50/P95, conversas abandonadas 24h, gap cobertura, conversão por origem.

**Verificação:** `tsc --noEmit` = 0 erros, HMR sem warnings, console limpo no `/login` (redirect). RPC validada: Eletropiso 30d retornou 6 novos + 5 recorrentes (bate com 11 contatos distintos da query de sanidade).

---

## Releases anteriores

- [[wiki/changelog/2026-05-part3]] — v7.32.0 a v7.32.6 (Notif handoff WhatsApp + helpdesk polish + áudios)
- [[wiki/changelog/2026-05-part2b]] — v7.21.0 a v7.24.0 (D30 Sprints A+B+C+D)
- [[wiki/changelog/2026-05-part2a]] e [[wiki/changelog/2026-05-part1]] — outras entradas de maio
- [[wiki/changelog/2026-04-part2b]] e anteriores — abril 2026
- [[wiki/changelog/2026-pre-04-part3b]] e anteriores — pré-abril
