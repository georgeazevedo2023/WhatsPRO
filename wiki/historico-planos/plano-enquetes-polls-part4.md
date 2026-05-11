---
title: Plano Enquetes/Polls (parte 4)
type: plano-historico
description: M17 Enquetes/Polls (parte 4) — schema banco + fases e tasks
updated: 2026-05-11
---

# Plano Enquetes/Polls — parte 4/5

> Plano shipado. Read-only.

## 4. Schema do Banco

### 4.1 poll_messages

```sql
CREATE TABLE poll_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  instance_id UUID REFERENCES whatsapp_instances(id),
  message_id TEXT NOT NULL,              -- ID retornado pela UAZAPI
  question TEXT NOT NULL,
  options JSONB NOT NULL,                -- ["Pisos", "Luminarias", "Tintas"]
  selectable_count INT DEFAULT 1,        -- 1=unica | 0=multipla
  context TEXT DEFAULT 'manual',         -- 'ai_agent' | 'broadcast' | 'manual' | 'nps' | 'form' | 'funnel'
  auto_tags JSONB,                       -- {"Pisos":["interesse:pisos"], "Tintas":["interesse:tintas"]}
  image_url TEXT,                        -- URL da imagem enviada antes (workaround)
  funnel_id UUID REFERENCES funnels(id), -- se vinculado a funil
  template_id TEXT,                      -- ID do template usado (se aplicavel)
  created_by UUID REFERENCES auth.users(id),
  tenant_id UUID NOT NULL,
  total_votes INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_poll_messages_conversation ON poll_messages(conversation_id);
CREATE INDEX idx_poll_messages_message_id ON poll_messages(message_id);
CREATE INDEX idx_poll_messages_tenant ON poll_messages(tenant_id);
CREATE INDEX idx_poll_messages_context ON poll_messages(context);
```

### 4.2 poll_responses

```sql
CREATE TABLE poll_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_message_id UUID REFERENCES poll_messages(id) ON DELETE CASCADE,
  voter_jid TEXT NOT NULL,
  contact_id UUID REFERENCES contacts(id),
  selected_options JSONB NOT NULL,       -- ["Pisos e Porcelanatos"]
  previous_options JSONB,                -- opcoes anteriores (se mudou voto)
  tags_applied JSONB,                    -- tags que foram auto-aplicadas
  voted_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(poll_message_id, voter_jid)     -- upsert quando muda voto
);

CREATE INDEX idx_poll_responses_poll ON poll_responses(poll_message_id);
CREATE INDEX idx_poll_responses_voter ON poll_responses(voter_jid);
CREATE INDEX idx_poll_responses_contact ON poll_responses(contact_id);
```

### 4.3 RLS

```sql
ALTER TABLE poll_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_poll_messages" ON poll_messages
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

CREATE POLICY "tenant_poll_responses" ON poll_responses
  FOR ALL USING (
    poll_message_id IN (SELECT id FROM poll_messages WHERE tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()))
  );
```

### 4.4 automation_rules (Motor de Automação — D8)

```sql
CREATE TABLE automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id UUID NOT NULL REFERENCES funnels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                          -- "Qualificação na entrada"
  enabled BOOLEAN DEFAULT true,
  position INT DEFAULT 0,                      -- ordem de execução
  -- GATILHO (QUANDO)
  trigger_type TEXT NOT NULL,                  -- 'card_moved' | 'poll_answered' | 'form_completed' | 'lead_created' | 'conversation_resolved' | 'tag_added' | 'label_applied'
  trigger_config JSONB DEFAULT '{}',           -- {"column_id":"uuid"} | {"tag":"interesse:tintas"} | {"label":"Urgente"}
  -- CONDIÇÃO (SE)
  condition_type TEXT DEFAULT 'always',        -- 'always' | 'tag_contains' | 'funnel_is' | 'business_hours'
  condition_config JSONB DEFAULT '{}',         -- {"tag":"interesse:tintas"} | {"funnel_id":"uuid"} | {"inside":true}
  -- AÇÃO (ENTÃO)
  action_type TEXT NOT NULL,                   -- 'send_poll' | 'send_message' | 'move_card' | 'add_tag' | 'activate_ai' | 'handoff'
  action_config JSONB DEFAULT '{}',            -- {"poll_template_id":"qualificacao"} | {"message":"Bem-vindo!"} | {"column_id":"uuid"} | {"tag":"qualificado:sim"}
  -- Meta
  tenant_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_automation_rules_funnel ON automation_rules(funnel_id);
CREATE INDEX idx_automation_rules_trigger ON automation_rules(trigger_type);
CREATE INDEX idx_automation_rules_tenant ON automation_rules(tenant_id);

-- RLS
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_automation_rules" ON automation_rules
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));
```

### 4.5 Campos em ai_agents

```sql
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS poll_enabled BOOLEAN DEFAULT false;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS poll_qualification_enabled BOOLEAN DEFAULT true;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS poll_nps_enabled BOOLEAN DEFAULT false;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS poll_nps_delay_minutes INT DEFAULT 5;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS poll_nps_question TEXT DEFAULT 'Como foi seu atendimento?';
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS poll_nps_options JSONB DEFAULT '["Excelente","Bom","Regular","Ruim","Pessimo"]';
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS poll_vendor_selection BOOLEAN DEFAULT false;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS poll_vendor_fallback_option TEXT DEFAULT 'O que estiver mais disponivel';
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS poll_image_before BOOLEAN DEFAULT false;
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS poll_templates JSONB DEFAULT '[]';
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS poll_auto_trigger_ai BOOLEAN DEFAULT true;
```

---

## 5. Fases e Tasks Detalhados

### Fase 1 — Motor de Automacao (a estrada)

**Objetivo:** Construir o motor Gatilho > Condicao > Acao. Ao final: admin cria regras no funil, engine executa automaticamente. Tudo que vier depois (enquetes, NPS, mensagens) e apenas um tipo de acao/gatilho.

| # | Task | Arquivo(s) | O que fazer |
|---|------|-----------|-------------|
| 1.1 | **Migration: automation_rules** | `supabase/migrations/2026XXXX_automation.sql` | Tabela automation_rules conforme schema 4.4. RLS. Indices. Campos `funnel_prompt` TEXT + `handoff_rule` TEXT na tabela `funnels`. |
| 1.2 | **Types.ts: regenerar** | `src/integrations/supabase/types.ts` | `npx supabase gen types typescript` — NUNCA editar manual. |
| 1.3 | **automationEngine.ts (backend)** | `supabase/functions/_shared/automationEngine.ts` | Funcao `executeAutomationRules(funnelId, triggerType, triggerData, supabaseClient)`. Carrega regras ativas do funil, filtra por trigger_type, avalia condicoes, executa acoes. Retorna log de execucao. |
| 1.4 | **Acoes do engine** | mesmo arquivo | Implementar 5 acoes: `send_message` (texto via proxy), `move_card` (update kanban_cards), `add_tag` (mergeTags), `activate_ai` (set status_ia + debounce), `handoff` (assign + notify). Acao `send_poll` fica como placeholder (implementada na F4). |
| 1.5 | **Condicoes do engine** | mesmo arquivo | 4 avaliadores: `always` (true), `tag_contains` (checa tags da conversa), `funnel_is` (checa funnel_id), `business_hours` (checa horario semanal do agente). |
| 1.6 | **Integrar engine nos triggers** | webhook + form-bot + kanban hooks | Ao mover card: `executeAutomationRules(funnelId, 'card_moved', {column_id})`. Ao completar form: `'form_completed'`. Ao resolver conversa: `'conversation_resolved'`. Ao adicionar tag: `'tag_added'`. Ao aplicar etiqueta: `'label_applied'`. Lead criado no funil: `'lead_created'`. |
| 1.7 | **useAutomationRules hook** | `src/hooks/useAutomationRules.ts` | CRUD React Query: list by funnel_id, create, update, delete, reorder (position). |
| 1.8 | **AutomationRulesTab component** | `src/components/funnels/AutomationRulesTab.tsx` | Tab "Automacoes" no FunnelDetail. Lista regras com cards visuais (QUANDO/SE/ENTAO). Botao "+ Nova Regra". Toggle enable/disable. Reorder via drag ou setas. |
| 1.9 | **AutomationRuleEditor component** | `src/components/funnels/AutomationRuleEditor.tsx` | Dialog para criar/editar regra. 3 selects cascateados: Gatilho (7 opcoes) → config dinamica, Condicao (4 opcoes) → config dinamica, Acao (5 opcoes) → config dinamica. Preview textual: "Quando X, se Y, entao Z". |
| 1.10 | **FunnelDetail: tab Automacoes** | `src/pages/dashboard/FunnelDetail.tsx` | Adicionar 4a tab "Automacoes" com AutomationRulesTab. |
| 1.11 | **Testes** | `src/lib/__tests__/automationEngine.test.ts` | Testes do engine: regra com cada trigger, cada condicao, cada acao. Edge cases: regra desabilitada, condicao falsa, acao falhando. |

**Criterio de aceite F1:** Admin cria regras no funil (ex: "Quando card mover para Qualificado, se tag contem interesse:tintas, entao enviar mensagem 'Otimo!'"). Engine executa automaticamente ao evento ocorrer. 4 das 5 acoes funcionais (send_poll = placeholder).

---

### Fase 2 — Funis Agenticos (o GPS)

**Objetivo:** Cada funil ganha seu proprio "roteiro" que a IA segue obrigatoriamente. A IA se comporta diferente em cada funil.

| # | Task | Arquivo(s) | O que fazer |
|---|------|-----------|-------------|
| 2.1 | **FunnelDetail: UI de roteiro** | `src/pages/dashboard/FunnelDetail.tsx` | Tab Config: textarea "Roteiro da IA" (funnel_prompt). Placeholder com exemplo. Textarea "Regra de transbordo" (handoff_rule) com select: so_se_pedir / apos_n_msgs / nunca + campo departamento. |
| 2.2 | **AI Agent: injetar funnel_instructions** | `supabase/functions/ai-agent/index.ts` | Quando tag `funil:SLUG` detectada: carregar funnels WHERE slug=SLUG. Se `funnel_prompt` preenchido → injetar `<funnel_instructions>` no system prompt com PRIORIDADE sobre prompt_sections do agente. Se `handoff_rule` → sobrescrever regra de handoff do agente. |
| 2.3 | **AI Agent: handoff por funil** | mesmo arquivo | `handoff_rule = 'apos_n_msgs'` → usar `max_messages_before_handoff` do funil (nao do agente). `handoff_rule = 'nunca'` → desativar handoff automatico. `handoff_department` → transbordo pro dept especifico. |
| 2.4 | **useFunnelConfig hook** | `src/hooks/useFunnelConfig.ts` | Hook para ler/salvar funnel_prompt + handoff_rule + handoff_department. |
| 2.5 | **Templates de roteiro por tipo** | `src/lib/funnelPromptTemplates.ts` | 7 templates default: venda ("qualifique interesse, apresente produtos, feche venda"), vaga ("pergunte area, disponibilidade, encaminhe RH"), captacao, evento, sorteio, lancamento, atendimento. Admin pode editar. |
| 2.6 | **Wizard: pre-preencher roteiro** | `src/components/funnels/FunnelWizard.tsx` | Passo do wizard oferece template de roteiro baseado no tipo de funil escolhido. Admin pode aceitar ou customizar. |
| 2.7 | **Testes** | `src/lib/__tests__/funnelPrompt.test.ts` | Teste de injecao de funnel_instructions. Teste de prioridade funil > agente. Teste de handoff_rule override. |

**Criterio de aceite F2:** Admin escreve roteiro no funil "Venda Tintas": "1) Pergunte o que o lead busca. 2) Se tinta, pergunte cor e ambiente. 3) Apresente opcoes. 4) Tente fechar." IA segue esse roteiro quando lead entra nesse funil — mesmo que o prompt geral do agente diga outra coisa.

---

### Fase 3 — Tags & Integracao (as placas)

**Objetivo:** Tags e etiquetas viram linguagem universal entre modulos. activateFunnel() centralizado. ActionSelector reutilizavel.

| # | Task | Arquivo(s) | O que fazer |
|---|------|-----------|-------------|
| 3.1 | **activateFunnel() centralizado** | `supabase/functions/_shared/funnelActivator.ts` | Funcao unica: mergeTags(`funil:SLUG`), criar kanban card na primeira coluna, disparar `executeAutomationRules(funnelId, 'lead_created')`. Chamada por form-public, bio-public, webhook (utm match), ai-agent. Substitui logica duplicada. |
| 3.2 | **Integrar activateFunnel nos modulos** | form-public, bio-public, whatsapp-webhook | Substituir logica manual de tag funil:SLUG + kanban card por chamada a activateFunnel(). Garante consistencia: todo lead que entra em funil passa pelo mesmo caminho. |
| 3.3 | **Tag trigger no engine** | `_shared/automationEngine.ts` + webhook/ai-agent | Quando mergeTags() e chamado em qualquer lugar: detectar se algum funil tem regra com trigger 'tag_added' para aquela tag. Se sim, executar. Idem para 'label_applied'. |
| 3.4 | **Auto-tag function** | `supabase/functions/_shared/autoTag.ts` | `generateAutoTag(text)`: normaliza texto → tag. "Pisos e Porcelanatos" → `interesse:pisos`. Usado por enquetes (D2), broadcasts, forms. |
| 3.5 | **ActionSelector component** | `src/components/shared/ActionSelector.tsx` | Componente reutilizavel: select com 5 acoes (IA/funil/form/handoff/nada) + config por acao. Plugavel em enquete, broadcast, bio link, campanha. |
| 3.6 | **Integrar ActionSelector** | BroadcastMessageForm, PollEditor, BioLinkEditor | Cada modulo que dispara acao ganha ActionSelector para definir o que acontece apos interacao do lead. Unifica UX. |
| 3.7 | **Testes** | `src/lib/__tests__/funnelActivator.test.ts` | Testes de activateFunnel, auto-tag, tag trigger no engine. |

**Criterio de aceite F3:** Lead submete formulario → activateFunnel() cria card + taga + dispara automacoes do funil. Admin configura no broadcast: "apos responder, ativar funil X" via ActionSelector. Auto-tags funcionam em todos os modulos.

---

### Fase 4 — Enquetes / Polls (um veiculo na estrada)

**Prerequisito OBRIGATORIO:** Task 4.1 (teste ao vivo do endpoint UAZAPI).

**Objetivo:** Enquetes nativas do WhatsApp. Ao final: admin envia polls pelo broadcast, IA usa polls para qualificar/transbordar, form-bot usa campo poll, helpdesk renderiza. Tudo plugado no motor de automacao (F1).

| # | Task | Arquivo(s) | O que fazer |
|---|------|-----------|-------------|
| 4.1 | **Teste ao vivo: confirmar endpoint** | manual | Enviar POST /send/poll via curl pra UAZAPI. Confirmar que funciona. Ter alguem votar e capturar payload do webhook. Confirmar nome do evento (poll_update vs poll.vote). |
| 4.2 | **Migration: poll_messages + poll_responses + campos ai_agents** | `supabase/migrations/2026XXXX_polls.sql` | Tabelas conforme schema 4.1, 4.2, 4.3. ALTER TABLE ai_agents conforme 4.5. 11 campos poll_* novos. |
| 4.3 | **Types.ts: regenerar** | types.ts | Regenerar com novas tabelas + campos. |
| 4.4 | **uazapi-proxy: send-poll + send-poll-with-image** | `supabase/functions/uazapi-proxy/index.ts` | 2 novos cases. Validar: 2-12 opcoes, question, selectableCount. send-poll-with-image: send/media → 1.5s → send/poll. Salvar em poll_messages. |
| 4.5 | **webhook: handler poll_update** | `supabase/functions/whatsapp-webhook/index.ts` | Detectar poll_update/poll.vote. UPSERT poll_response. Aplicar auto_tags. broadcastEvent. Chamar `executeAutomationRules(funnelId, 'poll_answered', {poll_id, options})`. Se poll_auto_trigger_ai → ai-agent-debounce. |
| 4.6 | **Engine: acao send_poll** | `_shared/automationEngine.ts` | Implementar acao 'send_poll' (placeholder da F1). Envia poll via proxy usando poll_template_id da action_config. |
| 4.7 | **AI Agent: tool send_poll** | `supabase/functions/ai-agent/index.ts` | 9a tool. Def + exec. POST /send/poll. Salvar em conversation_messages + poll_messages. broadcastEvent. sideEffectTools. |
| 4.8 | **AI Agent: transbordo com poll** | mesmo arquivo | poll_vendor_selection=true + 2+ atendentes → poll com nomes do dept. Resposta → handoff com assigned_to. Se 1 atendente → handoff direto texto. |
| 4.9 | **AI Agent: prompt poll_rules** | mesmo arquivo | Instrucoes: "Usar enquete para qualificacao, opcoes claras. NAO usar para perguntas abertas." |
| 4.10 | **Broadcast: aba Enquete** | BroadcastMessageForm + LeadMessageForm | 4a aba. PollEditor + PollTemplateSelector + ActionSelector. |
| 4.11 | **PollEditor component** | `src/components/broadcast/PollEditor.tsx` | Pergunta + opcoes (add/remove, 2-12) + unica/multipla + auto-tags editaveis + checkbox imagem + preview. |
| 4.12 | **form-bot: field_type poll** | `supabase/functions/form-bot/index.ts` | Quando field_type='poll': send/poll, aguardar poll_update, mapear voto ao campo. NUNCA opcoes numeradas. |
| 4.13 | **MessageBubble: render poll** | `src/components/helpdesk/MessageBubble.tsx` | media_type='poll' → card com pergunta, opcoes, checkmarks. media_type='poll_response' → "Lead votou: X". |
| 4.14 | **Hooks + Types frontend** | `src/hooks/usePolls.ts`, `src/types/polls.ts` | React Query hooks + interfaces TS. broadcastSender: sendPollToNumber(). |
| 4.15 | **Testes** | `src/lib/__tests__/polls.test.ts` | Validacao opcoes, AI Agent tool, broadcast, render, form-bot. |

**Criterio de aceite F4:** Admin envia enquete pelo broadcast. IA usa poll para qualificar e transbordar. Form-bot envia enquete nativa. Helpdesk mostra polls. Votos disparam automacoes do motor (F1). NUNCA opcoes numeradas.

---

### Fase 5 — NPS + Metricas + Polish (painel de controle)

**Objetivo:** NPS automatico, dashboard de metricas, config admin, templates, CSV. Camada de inteligencia sobre tudo que foi construido.

| # | Task | Arquivo(s) | O que fazer |
|---|------|-----------|-------------|
| 5.1 | **NPS automatico via motor** | Regra default no motor | Ao resolver ticket: engine executa regra `'conversation_resolved' → send_poll(nps_template)`. Delay via job_queue (poll_nps_delay_minutes). Guard: nao enviar se tags contem sentimento:negativo. |
| 5.2 | **NPS nota ruim → notifica gerente** | webhook + notifications | Poll response com nota <=2: insert notificacao para gerentes da inbox. Toast/alerta no painel. |
| 5.3 | **PollConfigSection** | `src/components/admin/PollConfigSection.tsx` | Toggle geral + qualificacao + transbordo + NPS (pergunta, opcoes, delay). Conforme wireframe secao 3.3. |
| 5.4 | **PollTemplateEditor** | `src/components/admin/PollTemplateEditor.tsx` | Editor modal: nome, pergunta, opcoes, auto-tags, auto-kanban, context. Salva em poll_templates JSONB. |
| 5.5 | **AIAgentTab: ALLOWED_FIELDS + integrar** | `src/components/admin/AIAgentTab.tsx` | 11 campos poll_* no ALLOWED_FIELDS. PollConfigSection na aba Inteligencia. |
| 5.6 | **PollMetricsCard** | `src/components/dashboard/PollMetricsCard.tsx` | Total polls, total votos, taxa de resposta, top opcao. |
| 5.7 | **PollNpsChart** | `src/components/dashboard/PollNpsChart.tsx` | NPS medio, distribuicao, ranking por atendente. |
| 5.8 | **Dashboard: integrar** | DashboardHome ou Intelligence | PollMetricsCard + PollNpsChart. |
| 5.9 | **usePollMetrics hook** | `src/hooks/usePollMetrics.ts` | React Query: metricas agregadas de polls. |
| 5.10 | **Exportar CSV** | PollDetailChart | Botao CSV: pergunta, opcoes, votos, %, tags. |
| 5.11 | **Testes finais** | `src/lib/__tests__/` | NPS flow, metricas, config admin, CSV. |
| 5.12 | **Documentacao final** | CLAUDE.md, PRD.md, vault | Atualizar tudo com padroes de poll, automation engine, funis agenticos. |

**Criterio de aceite F5:** NPS envia automaticamente apos resolver ticket (via motor). Nota ruim notifica gerente. Dashboard mostra metricas de polls e NPS. Admin configura tudo no painel. CSV exportavel.

---

