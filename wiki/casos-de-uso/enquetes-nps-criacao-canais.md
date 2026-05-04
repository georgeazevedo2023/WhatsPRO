---
title: Enquetes e NPS — Criacao e Canais de Envio
tags: [enquetes, polls, criacao, canais, uazapi, broadcast, ai-agent, formulario, automacao]
sources: [src/components/broadcast/PollEditor.tsx, supabase/functions/ai-agent/index.ts, supabase/functions/form-bot/index.ts, src/services/automationEngine.ts]
updated: 2026-05-04
---

# Enquetes e NPS — Criacao e Canais de Envio

> Como o admin monta uma enquete (PollEditor) e por quais 4 caminhos ela pode ser disparada (broadcast, IA, formulario, automacao). Inclui o contrato tecnico do endpoint UAZAPI usado em todos os canais.

Sub-funcionalidades cobertas: **12.1** Criacao de Enquete (PollEditor), **12.2** Os 4 Canais de Envio, **12.3** Endpoint UAZAPI.

Ver tambem: [[wiki/casos-de-uso/enquetes-nps-detalhado]] (indice), [[wiki/casos-de-uso/enquetes-nps-respostas-tags]] (rastreio), [[wiki/casos-de-uso/enquetes-nps-metricas-admin]] (NPS + dashboard)

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

## Links Relacionados

- [[wiki/casos-de-uso/enquetes-nps-detalhado]] — Indice das 10 sub-funcionalidades
- [[wiki/casos-de-uso/enquetes-nps-respostas-tags]] — Webhook poll_update + auto-tags + render helpdesk
- [[wiki/casos-de-uso/enquetes-nps-metricas-admin]] — NPS automatico + dashboard + config admin
- [[wiki/casos-de-uso/broadcast-detalhado]] — Enquetes no broadcast (envio em massa)
- [[wiki/casos-de-uso/ai-agent-detalhado]] — Tool send_poll (IA decide quando enviar)
- [[wiki/casos-de-uso/motor-automacao-detalhado]] — Acao send_poll + NPS via automacao
- [[wiki/casos-de-uso/formularios-detalhado]] — Campo tipo poll no formulario
- [[wiki/uazapi-polls-interativos]] — Documentacao tecnica do endpoint UAZAPI

---

*Rev 1 (2026-05-04): Sub-wiki criada a partir do particionamento de enquetes-nps-detalhado.md (regra 14).*
