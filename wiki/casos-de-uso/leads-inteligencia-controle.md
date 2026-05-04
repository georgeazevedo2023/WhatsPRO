---
title: Leads — Inteligência e Controle do Lead
tags: [leads, ia, kanban, funil, controle, detalhado]
sources: [src/components/leads/LeadFunnelCard.tsx, supabase/functions/ai-agent/index.ts, src/pages/dashboard/LeadDetail.tsx]
updated: 2026-05-04
---

# Leads — Inteligência e Controle (Sub-Funcionalidades 3.5, 3.6, 3.10, 3.12)

> Esta sub-wiki cobre os mecanismos que **controlam o comportamento da IA por lead** e a **integração com o pipeline de vendas** (funis e Kanban). É onde o gestor decide quando a IA atua, quando reseta o contexto, e como o lead se move pelo processo comercial.
>
> Ver índice: [[wiki/casos-de-uso/leads-detalhado]]

---

## 3.5 Ligar/Desligar IA por Lead (Block IA)

**O que e:** Um interruptor que permite **bloquear a IA de responder** para um lead especifico, independente da conversa. Diferente do toggle de IA no Helpdesk (que e por conversa), esse e **por contato** — se bloquear, a IA nao responde em nenhuma conversa daquele numero.

**Como funciona:**
- No perfil do lead, aparece um interruptor (switch) para cada instancia WhatsApp
- Ao ativar o bloqueio, a IA para de responder aquele numero naquela instancia
- Badge "IA Bloqueada (N)" aparece no perfil (N = numero de instancias bloqueadas)
- Na lista de leads, aparece indicador visual de que a IA esta bloqueada
- O bloqueio e **por instancia** — pode bloquear numa instancia e manter ativo em outra

**Cenario real:**
1. **Lead problematico:** Cliente reclama que a IA respondeu errado. Gerente bloqueia a IA para aquele lead → so humanos respondem a partir de agora.
2. **Cliente VIP:** Dono decide que clientes acima de R$ 10.000 em compras so sao atendidos por humanos. Bloqueia a IA para esses leads.
3. **Teste:** Atendente quer testar como a IA responde para um lead especifico → desbloqueia, manda mensagem de teste, avalia, e bloqueia de novo.

> **Tecnico:** Campo `contacts.ia_blocked_instances` (TEXT[] default '{}'). Migration: `20260322175956_ia_blocked_per_instance.sql`. Toggle: add/remove instance_id do array. Handler `handleToggleBlockInstance(instId)` em LeadDetail.tsx. Mutation `toggleIaMutation` em Leads.tsx. Check no ai-agent/index.ts: se `contact.ia_blocked_instances` contem o instance_id da request, return silencioso. Badge no LeadProfileSection: conta length do array.

---

## 3.6 Limpar Contexto (Clear Context)

**O que e:** Um botao que faz um **reset total** — o lead "vira novo" para a IA. Todos os dados extraidos, resumos, tags e historico de IA sao apagados. Na proxima mensagem, a IA trata aquele lead como se fosse o primeiro contato.

**O que acontece ao clicar "Limpar Contexto":**
1. **Perfil limpo:** Resumos de conversas, interesses, notas, motivo, ticket medio — tudo zerado
2. **Tags resetadas:** Todas as tags da conversa sao substituidas por `ia_cleared:DATA_HORA` (um marcador de que o contexto foi limpo)
3. **Resumos IA apagados:** Os resumos automaticos de todas as conversas sao removidos
4. **IA reativada:** O status da IA volta para "ligada" (se estava em shadow ou desligada)
5. **Bloqueio removido:** Se a IA estava bloqueada para aquele lead, o bloqueio e removido
6. **Logs apagados:** Registros de acoes da IA (handoffs, ferramentas usadas) sao deletados

**Regra importante sobre as tags:** O sistema NUNCA deixa as tags vazias (array vazio `[]`). Sempre coloca pelo menos `ia_cleared:2026-04-09T15:30:00`. Isso porque tags vazias quebram o contador de handoff — a IA perderia a contagem de mensagens e faria handoff na hora errada.

**Cenarios reais:**
1. **Conversa ruim ha 1 mes:** Lead teve experiencia ruim, IA ficou em shadow. Admin faz Clear Context → lead manda mensagem → IA responde como se fosse novo, sem vicio.
2. **Dados errados:** IA extraiu cidade errada e interesses errados. Em vez de corrigir campo por campo, admin limpa tudo e deixa a IA reaprender na proxima conversa.
3. **Teste de qualidade:** Admin quer testar o fluxo completo como se fosse um lead novo. Limpa contexto do seu proprio numero de teste.

> **Tecnico:** Handler `handleClearContext(lead)` em Leads.tsx e LeadDetail.tsx. Mutation `clearContextMutation`. Operacoes: (1) `lead_profiles` upsert com nulls (conversation_summaries=[], interests=null, notes=null, reason=null, full_name=null, average_ticket=null), (2) conversations update: `tags=['ia_cleared:TIMESTAMP']`, `ai_summary=null`, `status_ia='ligada'`, (3) DELETE `ai_agent_logs` WHERE conversation_id IN (contact convs), (4) contacts update: `ia_blocked_instances=[]`. NUNCA tags=[] — tag ia_cleared:TIMESTAMP obrigatorio. Invalida queries React Query apos sucesso.

---

## 3.10 Card do Funil Ativo (LeadFunnelCard)

**O que e:** Um card no perfil do lead que mostra **em qual funil** o lead esta, **em qual etapa** do Kanban, e **ha quantos dias** esta naquela etapa. Funciona como um GPS do lead dentro do processo de vendas.

**O que mostra:**
- Nome do funil (ex: "Captacao Agosto")
- Tipo do funil (ex: "captacao", "venda", "vaga")
- Icone do tipo
- Estagio atual no Kanban (ex: "Proposta Enviada")
- Dias na etapa atual (ex: "3 dias")
- Link para a pagina detalhada do funil

**Cenario real:** Gerente abre perfil do lead e ve: "Funil: Venda Tintas | Etapa: Negociacao | 5 dias". Percebe que o lead esta parado na negociacao ha 5 dias — hora de ligar e fechar.

> **Tecnico:** Componente `src/components/leads/LeadFunnelCard.tsx`. Deteccao: busca tag `funil:SLUG` na conversa mais recente. Query: `supabase.from('funnels').select('*').eq('slug', X)`. Kanban stage: query `kanban_cards` WHERE contact_id AND board_id = funnel.kanban_board_id, JOIN kanban_columns. Dias: `Math.floor((Date.now() - new Date(card.updated_at)) / 86400000)`. Styling: borda laranja, icone Target.

---

## 3.12 Integracao com CRM Kanban

**O que e:** Cada lead pode estar vinculado a um **card no quadro Kanban** (painel visual de vendas com colunas tipo "Novo → Proposta → Negociacao → Fechado"). Essa vinculacao acontece automaticamente ou manualmente.

**Como funciona:**
- Quando um lead e qualificado (pela IA ou pelo atendente), um card e criado no Kanban
- O card esta vinculado ao lead pelo telefone/contato (nao e uma copia — e o mesmo registro)
- A IA pode mover o card entre colunas (ferramenta `move_kanban`)
- O atendente pode mover ao finalizar atendimento (TicketResolutionDrawer)
- No perfil do lead, aparece a **etapa atual** do Kanban com a cor da coluna
- Na lista de leads, a coluna do Kanban aparece como filtro e como badge

**O que aparece no perfil do lead:**
- Nome do board (ex: "Pipeline Vendas")
- Coluna atual com cor (ex: bolinha verde + "Proposta Enviada")
- Link para abrir o board completo

**Cenarios:**
1. **IA qualifica automaticamente:** Lead respondeu 3 perguntas, mostrou interesse real → IA chama `move_kanban("Qualificado")` → card move da coluna "Novo" para "Qualificado" → gerente ve no perfil do lead e no board.
2. **Atendente finaliza venda:** Clica "Finalizar" → seleciona "Venda Fechada" → card move para "Fechado Ganho" automaticamente.
3. **Filtro no dashboard:** Gerente filtra leads com kanban_stage = "Negociacao" → ve os 12 leads que estao em negociacao → liga para cada um.

> **Tecnico:** FK: `kanban_cards.contact_id` (UUID → contacts.id). Migration: `20260322140251_s5_4_kanban_contact_id.sql`. LeadData type inclui `kanban_stage` (column name), `kanban_color` (column color), `kanban_board_id`. Query: JOIN kanban_cards → kanban_columns → kanban_boards. IA: tool `move_kanban` busca card pelo contact_id e move para coluna destino. TicketResolutionDrawer: `KANBAN_COLUMN_MAP` (VENDA→'Fechado Ganho', PERDIDO→'Perdido'). LeadDetail: secao CRM no sidebar direito. Leads.tsx: filtro por kanban stage, KPI "No CRM" = count leads with kanban_stage.

---

## Links Relacionados

- [[wiki/casos-de-uso/leads-detalhado]] — Índice das 12 sub-funcionalidades
- [[wiki/casos-de-uso/leads-visao-perfil]] — Página geral, perfil, badge de origem, timeline
- [[wiki/casos-de-uso/leads-captura-historico]] — Importação CSV, auto-criação, formulários, modal
- [[wiki/casos-de-uso/ai-agent-detalhado]] — 9 tools do agente (incluindo `move_kanban`)
- [[wiki/integracao-funis]] — Como Campanhas + Bio + Forms se conectam aos Leads
