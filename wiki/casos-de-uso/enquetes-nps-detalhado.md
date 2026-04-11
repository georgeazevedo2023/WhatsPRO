---
title: Enquetes e NPS — Documentacao Detalhada de Todas as Sub-Funcionalidades
tags: [enquetes, polls, nps, satisfacao, votacao, whatsapp, detalhado]
sources: [src/components/broadcast/PollEditor.tsx, supabase/functions/whatsapp-webhook/, src/hooks/usePollMetrics.ts]
updated: 2026-04-10
---

# Enquetes e NPS — Votacoes Nativas do WhatsApp (10 Sub-Funcionalidades)

> Enquetes (polls) sao **votacoes nativas do WhatsApp** — aquelas com botoes clicaveis que o lead toca para escolher uma opcao. Nao sao mensagens de texto com "1, 2, 3" — sao botoes reais renderizados pelo proprio WhatsApp, com visual bonito e interacao simples.
>
> O NPS (Net Promoter Score) e um tipo especial de enquete: uma **pesquisa de satisfacao automatica** enviada apos o atendente resolver um ticket. "Como foi seu atendimento?" → Excelente / Bom / Regular / Ruim / Pessimo. Se a nota for ruim, o gerente recebe notificacao automatica.
>
> As enquetes podem ser enviadas de **4 formas** diferentes: no broadcast (para centenas de leads), pela IA (durante a conversa), no formulario WhatsApp (como campo clicavel), ou por automacao (regra do motor). Respostas sao rastreadas e podem gerar tags automaticas.
>
> Ver tambem: [[wiki/casos-de-uso/broadcast-detalhado]] (envio em massa), [[wiki/casos-de-uso/ai-agent-detalhado]] (tool send_poll), [[wiki/casos-de-uso/motor-automacao-detalhado]] (acao send_poll + NPS)

---

## 12.1 Criacao de Enquete (PollEditor)

**O que e:** Editor visual para montar a enquete. Funciona na tab "Enquete" do broadcast e dentro de automacoes.

**Campos:**
- **Pergunta** — ate 255 caracteres. Ex: "Qual horario voce prefere para entrega?"
- **Opcoes** — de 2 a 12 opcoes, cada uma ate 100 caracteres. Ex: "Manha (8h-12h)", "Tarde (13h-17h)"
- **Selecao unica ou multipla** — toggle. Unica = lead escolhe 1 opcao. Multipla = pode escolher varias.
- **Imagem antes da enquete (D1)** — toggle opcional. Se ativado, envia uma imagem (foto do produto, banner) ANTES da enquete.

**Regra D7:** NUNCA enviar opcoes numeradas ("1-Casa, 2-Apto"). Sempre nomes limpos ("Casa", "Apartamento"). O WhatsApp ja numera automaticamente na interface.

**Cenario:** Loja quer saber qual produto os clientes mais querem. Cria enquete: "Qual produto voce mais procura?" → "Tintas", "Ferramentas", "Eletrica", "Hidraulica", "Outros". Envia por broadcast para 300 leads.

> **Tecnico:** Componente `PollEditor.tsx`. Interface `PollData` com question, options[], selectableCount (0=multi, 1=single), imageBeforePoll bool, imageUrl/imageFile. Factory `createEmptyPoll()` retorna defaults. Min 2 opcoes, max 12. Options: array dinamico com add/remove. D1: upload file, preview h-20. D7: options enviadas como plain strings, sem "1.", "2." — WhatsApp client renderiza numeracao.

---

## 12.2 Os 4 Canais de Envio

**O que e:** Enquetes podem ser enviadas de 4 formas diferentes, cada uma para um caso de uso.

### Canal 1: Broadcast (Envio em Massa)
Na tab "Enquete" do broadcast, montar a enquete e enviar para grupos ou lista de leads.
**Uso:** Pesquisas, votacoes, levantamento de interesse em massa.

### Canal 2: AI Agent (Tool send_poll)
A IA decide sozinha quando faz sentido enviar uma enquete durante a conversa. Registrada como tool #9 do agente.
**Uso:** Qualificacao interativa. "Para qual ambiente e a tinta?" → botoes clicaveis.

### Canal 3: Formulario WhatsApp (Campo tipo poll)
Dentro de um formulario (form-bot), um campo pode ser do tipo "poll" — em vez de texto, o bot envia enquete nativa.
**Uso:** Campos de escolha no formulario com UX superior a texto.

### Canal 4: Automacao (Acao send_poll)
No motor de automacao, a acao "Enviar enquete" dispara uma enquete quando o gatilho acontece.
**Uso:** NPS automatico, pesquisas pos-evento, feedback programado.

> **Tecnico:** Canal 1: `useBroadcastSend.sendPoll()` em Broadcaster.tsx. Canal 2: tool `send_poll` no ai-agent/index.ts (9a, sideEffectTools). Canal 3: field_type 'poll' no form-bot/index.ts (linhas 268-290), envia via `/send/menu`, fallback texto se falhar. Canal 4: action 'send_poll' no automationEngine.ts (linhas 472-553), inclui imagem + delay 1500ms + salva poll_messages + conversation_messages.

---

## 12.3 Endpoint UAZAPI (Como a Enquete e Enviada)

**O que e:** A enquete nativa do WhatsApp e enviada via endpoint `/send/menu` da API UAZAPI com tipo "poll".

**Payload enviado:**
```json
{
  "number": "5581999887766@s.whatsapp.net",
  "type": "poll",
  "text": "Qual horario voce prefere?",
  "choices": ["Manha", "Tarde", "Noite"],
  "selectableCount": 1
}
```

- `type: "poll"` — indica que e enquete (nao lista ou quickreply)
- `text` — a pergunta (max 255 chars)
- `choices` — array de opcoes (2-12, max 100 chars cada)
- `selectableCount` — 1 = escolha unica, 0 = multipla

**Resposta:** `{ "messageId": "3EB0ABC..." }` — ID da mensagem para rastrear votos.

**D1 — Imagem antes:** Se configurada, envia primeiro via `/send/media` (type=image) com delay de 1.5 segundos, depois envia a enquete.

> **Tecnico:** URL: `${UAZAPI_SERVER_URL}/send/menu` (default `https://wsmart.uazapi.com`). Headers: `{ 'Content-Type': 'application/json', 'token': instanceToken }`. Imagem: POST `/send/media` com `{ number, type: 'image', file: imageUrl, text: '', delay: 1500 }` + await 1500ms antes do poll. MessageId: parse de `j.messageId || j.MessageId || null` (UAZAPI inconsistente). Endpoint NUNCA e `/send/poll` (nao existe) — ver wiki/erros-e-licoes.md regra 25.

---

## 12.4 Rastreamento de Respostas (Webhook poll_update)

**O que e:** Quando o lead vota na enquete, o WhatsApp envia um evento `poll_update` para o webhook. O sistema registra o voto e executa acoes automaticas.

**O que acontece quando o lead vota:**
1. UAZAPI envia evento `poll_update` com: messageId, voter (JID), selectedOptions[]
2. Webhook busca a enquete original por messageId na tabela `poll_messages`
3. Upsert do voto em `poll_responses` (se ja votou, atualiza opcoes)
4. Se a enquete tem **auto-tags (D2)**, aplica tags na conversa baseado na opcao escolhida
5. Se a enquete pertence a um funil, dispara **motor de automacao** (trigger poll_answered)
6. Se a IA esta ativa na conversa, dispara **debounce do AI Agent** para a IA reagir ao voto
7. Insere mensagem no helpdesk para historico ("Lead votou: Manha")

**Cenario completo:** Enquete "Qual horario prefere?" enviada. Lead toca "Manha". Webhook recebe → salva voto → aplica tag `horario:manha` (auto-tag) → dispara automacao "quando poll respondida → mover card para Agendamento" → IA ve o voto e diz "Otimo! Anotei que voce prefere manha. Vamos confirmar o dia?"

> **Tecnico:** Webhook event `poll_update` em whatsapp-webhook/index.ts (linhas 256-429). Parse: `eventType === 'poll_update'`, extract messageId/voter/selectedOptions. Lookup: `poll_messages WHERE message_id = X`. Upsert: `poll_responses` com `onConflict: 'poll_message_id,voter_jid'`. Auto-tags D2: `poll_messages.auto_tags` JSONB map (option→tag), replace same-key via Map. Automacao: `executeAutomationRules(funnel_id, 'poll_answered', {poll_id, options})`. AI debounce: se status_ia ligada/shadow, POST para ai-agent-debounce fire-and-forget. Helpdesk msg: INSERT conversation_messages direction='incoming' content=options.join(', ').

---

## 12.5 Auto-Tags por Opcao (D2)

**O que e:** Ao criar a enquete, o admin pode configurar: "se o lead escolher opcao X, aplicar tag Y automaticamente". Isso permite segmentacao automatica baseada nas respostas.

**Exemplo de configuracao:**
```
Opcao "Excelente" → tag "sentimento:positivo"
Opcao "Ruim" → tag "sentimento:negativo"
Opcao "Causa Animal" → tag "tema:animal"
```

**Como funciona:** Quando o voto chega, o webhook verifica se a enquete tem auto_tags. Se tiver, busca a tag correspondente a opcao votada e aplica na conversa (substituindo tags com mesma chave).

> **Tecnico:** Campo `poll_messages.auto_tags` JSONB (map: string→string). No webhook poll_update: `const autoTags = pollMsg.auto_tags || {}`. Para cada opcao votada, busca tag no map. Aplica via tag Map dedup (replace same key prefix). UPDATE conversations.tags.

---

## 12.6 Exibicao no Helpdesk (Renderizacao)

**O que e:** Quando uma enquete e enviada ou votada, ela aparece no chat do helpdesk com visual proprio — nao como texto, mas com icone de grafico + pergunta + opcoes em cards.

**Visual:**
- Icone de grafico de barras (BarChart3) ao lado da pergunta
- Pergunta em negrito
- Opcoes como cards individuais com borda e fundo sutil
- Indicador: circulo vazio (○) para escolha unica, quadrado vazio (☐) para multipla
- Texto "Selecao multipla" abaixo das opcoes quando aplicavel

> **Tecnico:** MessageBubble.tsx: `media_type === 'poll'` → parse `media_url` como JSON (question, options, selectable_count). Render: BarChart3 icon 3.5x3.5, options em div bg-muted/30 border, selectable_count===0 → '☐', else → '○'. Memo: `useMemo` para parse do JSON.

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

## Arvore de Componentes

```
Broadcast → Tab "Enquete"
+-- PollEditor.tsx (pergunta + opcoes + toggle multipla + imagem D1)

AI Agent → Tool send_poll (automatico, decidido pela IA)

Form-Bot → field_type='poll' (enquete como campo de formulario)

Motor Automacao → action='send_poll' (regra gatilho→condicao→enquete)

Webhook → event='poll_update'
+-- poll_responses upsert
+-- Auto-tags D2
+-- Automacao poll_answered
+-- AI debounce (se IA ativa)

Helpdesk → MessageBubble → media_type='poll'
+-- Renderizacao visual (BarChart3 + opcoes + indicadores)

Dashboard
+-- PollMetricsCard.tsx (4 KPIs)
+-- PollNpsChart.tsx (distribuicao horizontal)

Admin → AI Agent → Tab Metricas
+-- PollConfigSection.tsx (NPS config — 5 campos)
```

---

## Tabelas do Banco

| Tabela | O que guarda |
|--------|--------------|
| `poll_messages` | Enquetes enviadas (question, options[], selectable_count, auto_tags, image_url, is_nps, funnel_id) |
| `poll_responses` | Votos (poll_message_id FK, voter_jid, contact_id, selected_options[], voted_at — unique per voter) |
| `notifications` | Alertas NPS ruim para gerentes (type, title, message, metadata, read) |

---

## Decisoes Documentadas

| # | Decisao | Detalhe |
|---|---------|---------|
| D1 | Imagem antes da enquete | Toggle no PollEditor. Envia via /send/media + 1500ms delay antes do poll |
| D2 | Auto-tags por opcao | Map opcao→tag em poll_messages.auto_tags JSONB. Aplicado no webhook |
| D6 | Guard sentimento negativo | NPS nao envia se conversa tem tag sentimento:negativo |
| D7 | Nunca opcoes numeradas | Opcoes enviadas como plain strings. WhatsApp renderiza numeracao |

---

## Links Relacionados

- [[wiki/casos-de-uso/broadcast-detalhado]] — Enquetes no broadcast (envio em massa)
- [[wiki/casos-de-uso/ai-agent-detalhado]] — Tool send_poll (IA decide quando enviar)
- [[wiki/casos-de-uso/motor-automacao-detalhado]] — Acao send_poll + NPS via automacao
- [[wiki/casos-de-uso/formularios-detalhado]] — Campo tipo poll no formulario
- [[wiki/casos-de-uso/helpdesk-detalhado]] — Renderizacao no chat + TicketResolutionDrawer agenda NPS
- [[wiki/modulos]] — Todos os 17 modulos
- [[wiki/uazapi-polls-interativos]] — Documentacao tecnica do endpoint UAZAPI

---

*Documentado em: 2026-04-10 — Padrao dual (didatico + tecnico). Doc dedicado com 4 canais de envio + NPS completo*
