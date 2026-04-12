---
title: Activity Log
type: log
---

# Activity Log

> Registro cronológico de ingestões, consultas e manutenções do vault. Append-only.

## 2026-04-12

### fix(ai-agent): ia_cleared usa contagem de msgs desde sessionStartDt — self-healing

**Problema:** mesmo com `lead_msg_count: 0` no frontend, o counter podia estar desatualizado (race condition, cache, código antigo). A primeira mensagem após ia_cleared disparava handoff imediato.

**Fix server-side (deploy):** quando `clearedTags.length > 0`, o ai-agent agora conta mensagens incoming desde `sessionStartDt` em vez do counter acumulado. Isso é auto-corretivo: funciona mesmo que o frontend não tenha resetado o counter. Counter ainda é incrementado (fire-and-forget) para manter rastreamento. R55 documentada.

### fix(leads): clear context não resetava lead_msg_count → handoff imediato na 1ª msg

**Causa raiz real:** `conversations.lead_msg_count` não era resetado pelo clear context. A migration tem comentário "Reset on ia_cleared" mas o reset nunca foi implementado. A primeira mensagem após ia_cleared incrementava o counter que já estava no limite → `increment_lead_msg_count` RPC retornava valor ≥ MAX_LEAD_MESSAGES → handoff disparava antes mesmo do greeting.

**Correção:** adicionado `lead_msg_count: 0` no `conversations.update()` em Leads.tsx e LeadDetail.tsx. R54 documentada.

### fix(leads): clear context não limpava flow_states → greeting skip + handoff duplicado

**Bugs reportados:** após ia_cleared, agente não enviava saudação e disparava handoff duplicado.

**Causa raiz:** `clearContextMutation` não finalizava `flow_states`. Se o lead tinha um estado ativo no orchestrator, a próxima mensagem continuava do passo anterior (já após o greeting), e poderia re-disparar o handoff.

**Correção:** adicionado `UPDATE flow_states SET status='abandoned' WHERE lead_id=X AND status IN ('active','handoff')` em dois locais:
- `src/pages/dashboard/Leads.tsx` (clearContextMutation)
- `src/pages/dashboard/LeadDetail.tsx` (handleClearContext)

Bonus: `Leads.tsx` também não incluía `custom_fields: {}` no upsert do lead_profile (agora incluído, alinhando com LeadDetail.tsx).

**R53 criada:** `clearContextMutation` DEVE finalizar flow_states ao limpar contexto.

### Auditoria do vault + feat inbox_id no FlowWizard

**Auditoria (commits ef466b9 + 64bcfef):**

Gaps detectados e corrigidos:
- `index.md` footer: dizia "S1-S9, próximo S10" → corrigido para "M18 completo 12/12"
- `index.md` seção Fluxos: "design em andamento" → "✅ Shipped 2026-04-12"
- `wiki/modulos.md`: faltavam M14 (Bio Link) e M18 (Fluxos v3.0) — ambos adicionados completos
- `wiki/roadmap.md`: "17 módulos" → "18 módulos"
- `wiki/casos-de-uso/fluxos-detalhado.md`: criado do zero — 18 sub-funcionalidades, fluxo técnico, 12 tabelas, links
- `wiki/fluxos-visao-arquitetura.md`: updated date corrigido para 2026-04-12
- Nota vault antes: 7.7/10 → depois: 9.0/10

**feat: inbox_id no FlowWizard (commit 0a824ba):**

- Migration `20260416000003_add_inbox_id_to_flows.sql`: `ALTER TABLE flows ADD COLUMN inbox_id UUID REFERENCES inboxes(id) ON DELETE SET NULL`
- `types.ts`: Row/Insert/Update + FK relationship adicionados manualmente
- `FlowWizard.tsx` etapa 1 (Identidade): Select "Caixa de entrada" filtrado pela instância selecionada
  - Desabilitado se nenhuma instância selecionada
  - Limpa automaticamente ao trocar instância
  - Placeholder contextual por estado
  - Padrão = "Todas as caixas" (salva null)
- `handleCreate`: passa `inbox_id` (null se "all" ou vazio)
- Resumo etapa 4: exibe inbox selecionada
- `tsc --noEmit = 0 erros ✅`

**Artefatos pendentes comitados (commit ef466b9):**
- `supabase/migrations/20260415000004_s10_register_flow_followups_cron.sql`
- `supabase/functions/test_e2e_agent.sh`
- `.planning/` (codebase, phases M2, prereqs, research)
- `.claude/skills/ui-ux-pro-max/`
- `wiki/erros-e-licoes.md` R45+R46

---

### fix(leads): kpiAtendidoIA usa tags da conversa atual (commit 306b5c7)

`kpiAtendidoIA` usava `tags` agregadas de TODAS as conversas → `ia:shadow` de conversa antiga contaminava novas. Corrigido: usa `latestConv.tags` apenas.

---

### fix(leads): KPI datas/duração + tipo_cliente tag-based (commit 4848d53)

- `latestConv` agora ordena por `created_at DESC` (conversa mais recente criada, não mais recente por mensagem)
- Duração >24h: formato `Xd Yh` em vez de `Xh` (evita "523h")
- Novo card violeta "Tipo de Cliente" no KPI grid — lê `tipo_cliente:X` de tags ou `extractedData`
- **BUG**: `update_lead_profile` não tem parâmetro `custom_fields` — instrução corrigida no DB para usar `set_tags tipo_cliente:X`
- DB: `prompt_sections.additional` + `tags_labels` atualizados (R50 em erros-e-licoes)

---

### fix(leads): KPI Produto exibia '—' — filtro _interno (commit 6af187f)

Filtro `!t.endsWith('_interno')` comparava a string completa da tag (ex: `produto:piso_ceramica_interno`) que terminava com `_interno` e excluía. Removido (R51 em erros-e-licoes).

---

### Agente IA: Tipo de Cliente configurado no DB (sem commit — config via SQL)

**Agente:** Eletropiso (`174af654`)

**Campo `tipo_cliente` já existia** em `extraction_fields` (section: custom, enabled: true).

**`prompt_sections.additional` atualizado** com instrução completa de inferência:
Tipos: Lead Novo, Cliente Final, Pintor, Vidraceiro, Serralheiro, Pedreiro, Eletricista, Encanador, Arquiteto/Designer, Loja/Revendedor, Construtora/Empreiteira, Fornecedor.
Regra: inferir pelas palavras — NUNCA perguntar diretamente.

O campo aparece em **Campos Adicionais** na página do lead quando o agente extrair.

---

### Página do Lead: KPI Atendimento + Score + Embellezamento (commit c58507a)

**`src/pages/dashboard/LeadDetail.tsx`** + **`src/components/leads/LeadProfileSection.tsx`**

Card "Resumo do Atendimento" na coluna direita — grid 2-col, 6 KPIs:
- **Produto** (verde) — tags `produto:` + `interesse:`
- **Em falta** (vermelho) — tag `marca_indisponivel:`
- **Início** (cinza) — `conversation.created_at` dd/mm hh:mm
- **Fim** (cinza) — `conversation.last_message_at` dd/mm hh:mm
- **Duração** (âmbar) — diferença min/h
- **Atendido por IA** (azul/amarelo) — Sim / Shadow / Não

**Score de engajamento 0-100** (computado sem DB change): nome+10, email+10, motivo+10, produto/interesse+15, conversas (5×, max 20), interações (max 15), cidade+10, kanban+10. Badge circular Frio/Morno/Quente no header do perfil.

**Embellezamento:** faixa gradiente `from-primary/80` no topo do card perfil.

---

### Helpdesk: KPI grid no Contexto IA (commits 6b542b1 + c432fd0)

**`src/components/helpdesk/ContactInfoPanel.tsx`**

Grid 2 colunas acima das tags no bloco "Contexto IA":
- **Produto** (roxo) — tags `produto:` + `interesse:`
- **Em falta** (vermelho) — tag `marca_indisponivel:`
- **Início** (cinza) — `conversation.created_at` dd/mm hh:mm
- **Fim** (cinza) — `conversation.last_message_at` dd/mm hh:mm
- **Duração** (âmbar) — diferença início→fim em min/h
- **Atendido por IA** (azul/amarelo) — Sim / Shadow / Não derivado das tags

tsc = 0 erros ✅

---

### fix(orchestrator): post-handoff guard (commit 64b91a8) + deploy

**Causa:** após handoff, lead enviava "Ok" → novo flow criado → `smart_fill` encontrava respostas antigas em `long_memory.profile` → qualificação completava imediatamente → segundo handoff disparado → mensagem duplicada "Vou te encaminhar...".

**Fix:** antes de `createFlowState`, checa `flow_states WHERE status='handoff' AND completed_at >= now()-4h`. Se encontrado, retorna `{ skipped: 'post_handoff' }` sem criar novo flow nem enviar mensagem. Lead permanece com atendente humano.

**Deploy:** orchestrator ✅ (R48 em erros-e-licoes)

---

### fix(greeting): saudação dupla para leads migrados do ai-agent antigo (commit 460ddd5) + deploy

**Causa:** leads do ai-agent antigo tinham `lead_profiles.full_name` mas `long_memory.sessions_count=0`. Case C disparava `greeting_message` (template com "com quem eu falo?") mesmo com nome conhecido.

**Fix:** Cases B+C unificados — se `lead.lead_name` existe, sempre usa `known_lead_message`. Deploy: orchestrator ✅ (R47 em erros-e-licoes)

---

### S12 COMPLETO — Métricas + Migração por Instância + Rollback (commit b7017e8)

**M18 Fluxos v3.0 COMPLETO — 12/12 sprints shipped.**

**T1 — Migration (`20260416000002_s12_orchestrator_migration.sql`):**
- `instances.use_orchestrator BOOL DEFAULT false` — flag per-instance
- `flow_report_shares` table — token hex(16), expires_at 30 dias, RLS leitura pública
- RPC `create_flow_report_share(p_flow_id)` SECURITY DEFINER — retorna token

**T2 — Webhook per-instance (`whatsapp-webhook/index.ts`):**
- `getOrchestratorFlag(instanceId?)` — checa `instances.use_orchestrator` primeiro, fallback global `USE_ORCHESTRATOR`
- 2 call sites atualizados: poll_response (conv.instance_id) + handler principal (instance.id)

**T3 — Rollback automático (`orchestrator/index.ts`):**
- `input` declarado fora do try (acessível no catch)
- `handleOrchestratorFailure(instanceId)` — 3 falhas em 5min → `use_orchestrator=false` automático
- Contador em `system_settings` com key `orch_fail_{instanceId}`, janela 5min com reset

**T4 — FlowMetricsPanel (`src/components/flows/FlowMetricsPanel.tsx`):**
- KPI cards: sessões iniciadas, taxa conclusão, taxa handoff, custo USD
- Funil de conversão: BarChart horizontal (active/completed/handoff/abandoned)
- Timing médio: PieChart (intent/resolve/context/subagent/validator/send ms)
- Top 10 intents com progress bars CSS
- Botão "Compartilhar" → RPC → copia URL `{origin}/flows/report/{token}` — 30 dias

**T5 — FlowDetail + useFlows:**
- Nova tab "Métricas" (6ª tab) com `FlowMetricsPanel`
- Tab "Publicar" aprimorada: checklist de migração (publicado/triggers/shadow) + `OrchestratorToggle`
- `OrchestratorToggle`: Switch + Dialog confirmação GitHub-style (digitar nome do fluxo)
- 2 novos hooks: `useToggleOrchestrator` + `useCreateFlowShare`

**T6 — E2E (`supabase/functions/orchestrator/tests/e2e_orchestrator.sh`):**
- 5 cenários: novo_lead_saudacao / coleta_nome / intent_produto / shadow_sem_envio / followup_agendado
- Score: 20pts por cenário = 100 max. Threshold produção: ≥80
- Guard: verifica E2E_INSTANCE_ID configurado (NUNCA instância real)

**tsc --noEmit = EXIT:0 ✅ | 7 arquivos (3 novos + 4 editados) | 864 linhas**

---

## 2026-04-12

### fix(ai-agent): carrossel não enviado após marca mencionada + tipo_cliente não salvo (commit 9806cde)

**Problema 1 — Carrossel:** lead disse "Tem acrílica da coral?" (marca específica) + respondeu 4 qualificações (ambiente, cor, quantidade, aplicação). Agente fez handoff_to_human **sem chamar search_products**.

**Causa raiz dupla:**
- Regra de qualificação de tintas ("qualifique ambiente → cor → marca") sobrepõe a regra "COM MARCA → busca imediata" — LLM segue o fluxo completo de 4 perguntas mesmo com marca já dada
- handoff_rules default "Lead confirma interesse → handoff" dispara quando lead responde a última pergunta de qualificação, antes da busca

**Fix:** 3 regras hardcoded adicionadas (`index.ts:1054-1056`):
- MARCA JÁ INFORMADA → BUSCA RÁPIDA: máx 2 perguntas → `search_products` imediato
- BUSCA OBRIGATÓRIA ANTES DE HANDOFF: dados suficientes → `search_products` obrigatório antes de handoff
- PROFISSÃO DO LEAD: profissão mencionada → `set_tags(['tipo_cliente:PROFISSAO'])` imediatamente

**Problema 2 — tipo_cliente:** `tipo_cliente` não estava em `VALID_KEYS` do `set_tags` handler → tag rejeitada silenciosamente mesmo que o LLM tentasse salvá-la.

**Fix:** `tipo_cliente` adicionado ao `VALID_KEYS` (`index.ts:1936`). Instrução no prompt garante que a extração ocorra.

**R55+R56 documentadas em erros-e-licoes.md. tsc 0 erros ✅ | 427 testes passando ✅**

---

> Entradas de sprints S6-S11 (fix greeting, BUG-1/3/5, auditoria S9-S11) arquivadas em:
> - `wiki/log-arquivo-2026-04-12-fluxos-s6s11.md`


---

---
---

> Entradas S1-S5 + notas arquivadas em:
> - `wiki/log-arquivo-2026-04-12-fluxos-s4s5.md` (S4/S5/notas)
> - `wiki/log-arquivo-2026-04-11-fluxos-v3-s1s2.md` (S1/S2/S3/G1-G5/DTs)
> - `wiki/log-arquivo-2026-04-11-fluxos-design-b.md` (design anterior)
