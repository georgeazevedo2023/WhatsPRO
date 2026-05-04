---
title: Enquetes e NPS — NPS Automatico, Metricas e Admin
tags: [nps, satisfacao, dashboard, metricas, notificacoes, admin, gerente, ai-agent]
sources: [src/services/automationEngine.ts, src/hooks/usePollMetrics.ts, src/components/dashboard/PollMetricsCard.tsx, src/components/admin/ai-agent/PollConfigSection.tsx]
updated: 2026-05-04
---

# Enquetes e NPS — NPS Automatico, Metricas e Admin

> O ciclo completo do NPS: como o atendente fecha um ticket e o sistema agenda a pesquisa, como notas ruins viram notificacoes para gerentes, como o dashboard apresenta os KPIs e onde o admin configura tudo.

Sub-funcionalidades cobertas: **12.7** NPS Automatico, **12.8** Notificacao de Nota Ruim, **12.9** Dashboard de Metricas, **12.10** Configuracao Admin (PollConfigSection).

Ver tambem: [[wiki/casos-de-uso/enquetes-nps-detalhado]] (indice), [[wiki/casos-de-uso/enquetes-nps-criacao-canais]] (criacao), [[wiki/casos-de-uso/enquetes-nps-respostas-tags]] (rastreio)

---

## 12.7 NPS Automatico (Pesquisa de Satisfacao)

**O que e:** Apos o atendente resolver um ticket (clicar "Finalizar"), o sistema pode enviar automaticamente uma enquete de satisfacao. Funciona como um NPS simplificado.

**Configuracao do admin (5 campos):**
1. **Habilitado** — toggle liga/desliga o NPS
2. **Delay (minutos)** — tempo de espera apos resolver (ex: 30 min). Padrao: 5 min
3. **Pergunta** — texto da enquete. Padrao: "Como voce avalia nosso atendimento?"
4. **Opcoes** — 5 opcoes editaveis. Padrao: "Excelente", "Bom", "Regular", "Ruim", "Pessimo"
5. **Notificar gerente** — se nota for Ruim/Pessimo, avisa os gerentes automaticamente

**Guard D6 (protecao):** Se a conversa teve sentimento negativo (tag `sentimento:negativo`), o NPS NAO e enviado. Nao faz sentido pedir avaliacao de alguem que ja saiu irritado.

**Fluxo:**
1. Atendente clica "Finalizar" → TicketResolutionDrawer
2. Sistema chama `triggerNpsIfEnabled(conversationId, instanceId)`
3. Verifica: NPS habilitado? Tag sentimento negativo?
4. Se OK, agenda envio para daqui a X minutos (setTimeout)
5. Apos delay, envia enquete via UAZAPI com `is_nps: true`
6. Lead recebe enquete no WhatsApp → toca na opcao
7. Webhook registra voto

**Cenario:** Atendente fecha venda → 30 min depois, lead recebe "Como foi seu atendimento?" → toca "Excelente" → nota registrada. / Outro lead: venda → 30 min → toca "Ruim" → gerente recebe notificacao automatica.

> **Tecnico:** Config: 5 campos em `ai_agents` (poll_nps_enabled BOOL, poll_nps_delay_minutes INT default 5, poll_nps_question TEXT, poll_nps_options JSONB, poll_nps_notify_on_bad BOOL). Flag `is_nps: true` em poll_messages. Funcao `triggerNpsIfEnabled()` em automationEngine.ts (linhas 565-657). Guard: `tags.some(t => t.includes('sentimento:negativo'))`. Delay: `setTimeout(async () => { sendPoll() }, delayMs)`. Chamado pelo TicketResolutionDrawer via job_queue (process-jobs worker).

---

## 12.8 Notificacao de Nota Ruim

**O que e:** Quando um lead avalia com "Ruim" ou "Pessimo" no NPS, o sistema cria uma **notificacao automatica** para todos os gerentes da inbox. Assim o gerente sabe na hora que tem um cliente insatisfeito.

**Opcoes ruins detectadas:** "Ruim", "Pessimo", "Péssimo" (case-insensitive)

**Notificacao criada:**
- Tipo: `nps_bad_note`
- Titulo: "NPS negativo recebido"
- Mensagem: "Lead avaliou atendimento como 'Ruim'"
- Dados: ID da enquete, ID da conversa, opcoes votadas

**Quem recebe:** Todos os usuarios com role `gerente` nas inboxes vinculadas a instancia.

> **Tecnico:** Webhook poll_update: checa `BAD_OPTIONS = ['Ruim','Pessimo','Péssimo']` + `pollMsg.is_nps === true` + `agentConf.poll_nps_notify_on_bad !== false`. Query gerentes: `inbox_users WHERE inboxes.instance_id = X AND role = 'gerente'`. INSERT em `notifications` table (user_id, type, title, message, metadata JSONB, read=false). Tabela `notifications` com index `(user_id, read)`.

---

## 12.9 Dashboard — Metricas de Enquetes

**O que e:** No painel Dashboard, cards e graficos mostrando desempenho das enquetes e NPS.

**PollMetricsCard (4 KPIs):**
- **Enquetes** — total de enquetes enviadas (icone Vote)
- **Votos** — total de votos recebidos (icone BarChart3)
- **Taxa** — taxa de resposta: votos ÷ enquetes % (icone Percent)
- **NPS** — media ponderada do NPS (icone Star). Cor: verde ≥4, amarelo ≥3, vermelho <3

**PollNpsChart (Distribuicao NPS):**
Grafico horizontal com 5 barras (uma por opcao NPS):
- Excelente — barra verde escuro
- Bom — barra verde claro
- Regular — barra amarela
- Ruim — barra laranja
- Pessimo — barra vermelha

Cada barra mostra contagem + porcentagem.

**Calculo do NPS medio:**
- Excelente = 5 pontos, Bom = 4, Regular = 3, Ruim = 2, Pessimo = 1
- Media ponderada: soma(pontos × votos) ÷ total de votos

> **Tecnico:** Hook `usePollMetrics.ts`. Retorna: `PollMetrics { totalPolls, totalVotes, responseRate, npsAvg, npsDistribution, topOptions }`. Query: count poll_messages + count poll_responses WHERE created_at >= 30 dias. NPS: filtra polls com is_nps=true, calcula media ponderada com `NPS_SCORES = {Excelente:5, Bom:4, Regular:3, Ruim:2, Pessimo:1}`. Cache: staleTime 60s. Componentes: `PollMetricsCard.tsx` (4 cards grid) + `PollNpsChart.tsx` (barras horizontais com cores NPS_COLORS).

---

## 12.10 Configuracao Admin (PollConfigSection)

**O que e:** Secao na tela de configuracao do AI Agent (tab Metricas) onde o admin configura o NPS automatico.

**UI:**
- Titulo "NPS Automatico" com icone BarChart3
- Toggle principal: habilitar/desabilitar
- Quando habilitado, mostra 4 campos:
  1. **Delay** — input numerico (1-60 minutos)
  2. **Pergunta** — textarea (max 255 chars)
  3. **Opcoes** — 5 inputs (um por opcao, cada max 100 chars)
  4. **Notificacao** — toggle "Notificar gerente quando nota for Ruim ou Pessimo"
- Texto de ajuda: "D6: NAO envia se conversa teve transbordo por frustracao"

> **Tecnico:** Componente `PollConfigSection.tsx` em `src/components/admin/ai-agent/`. Props: agentId. Campos mapeados para 5 colunas de ai_agents. Save via auto-save (ALLOWED_FIELDS no AIAgentTab). Toggle principal: poll_nps_enabled. Opcoes renderizadas como 5 inputs fixos (array JSONB).

---

## Links Relacionados

- [[wiki/casos-de-uso/enquetes-nps-detalhado]] — Indice das 10 sub-funcionalidades
- [[wiki/casos-de-uso/enquetes-nps-criacao-canais]] — PollEditor + 4 canais + endpoint UAZAPI
- [[wiki/casos-de-uso/enquetes-nps-respostas-tags]] — Webhook poll_update + auto-tags + render
- [[wiki/casos-de-uso/helpdesk-detalhado]] — TicketResolutionDrawer agenda NPS
- [[wiki/casos-de-uso/ai-agent-detalhado]] — Config NPS na tab Metricas

---

*Rev 1 (2026-05-04): Sub-wiki criada a partir do particionamento de enquetes-nps-detalhado.md (regra 14).*
