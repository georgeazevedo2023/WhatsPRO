---
title: UAZAPI — Mensagens Interativas (Casos de Uso)
tags: [uazapi, poll, casos-de-uso, ai-agent, broadcast, funil, campanha]
updated: 2026-05-04
---

# UAZAPI — Casos de Uso de Mensagens Interativas

> Cenários reais de uso de polls (e potencialmente list/quickreply) no WhatsPRO, organizados por contexto.

Ver também: [[wiki/uazapi-polls-interativos]] (índice), [[wiki/uazapi-polls-poll]], [[wiki/uazapi-polls-list-quickreply]].

---

## 1. AI Agent — Qualificação por Poll

Em vez de perguntas em texto livre, o agente usa poll para qualificar:

> "Qual é o seu perfil?" → opções: "Quero comprar agora", "Estou pesquisando", "Quero ser revendedor"

Baseado na opção escolhida, o agente adapta o script SDR.

**Vantagens:**
- Resposta estruturada (sem ambiguidade)
- Lead não precisa digitar
- Resultado já cai em campo qualificado para tagging/automação

---

## 2. Broadcast — Pesquisa de Interesse

Enviar poll para toda a base antes de um lançamento:

> "O que você mais quer ver na nossa nova coleção?" → opções por categoria

**Resultado:** segmentar próximo broadcast por interesse revelado no poll.

**Pipeline típico:**
1. BroadcastForm tipo "Enquete" → criar poll
2. Enviar para audiência segmentada
3. Aguardar `poll_update` chegar via webhook
4. `poll_responses` insere votos
5. Dashboard agrega resultado por opção
6. Próximo broadcast usa segmentação baseada no voto

---

## 3. Formulários — Campo tipo Poll

Substituir campos `select` do form-bot por polls nativos do WhatsApp — UX muito mais fluida para o usuário.

**Antes (text-based):**
```
Bot: Qual seu interesse?
1 - Comprar
2 - Pesquisar
3 - Revender

Lead: digita "1" (ou erro de digitação...)
```

**Depois (poll nativo):**
```
Bot: [Enquete WhatsApp]
  ⚪ Comprar
  ⚪ Pesquisar
  ⚪ Revender

Lead: toca na opção (zero erro)
```

---

## 4. Funil — NPS e Satisfação

Após handoff ou resolução de ticket:

> "Como foi seu atendimento?" → opções: 5 estrelas, 4, 3, 2, 1

Resultado salvo em `lead_profile`, KPI visível no FunnelDetail.

**Implementação:** M17 F5 — `PollConfigSection` permite configurar pergunta+opções de NPS automaticamente disparado ao resolver ticket no `TicketResolutionDrawer`.

---

## 5. Campanha Política — Pesquisa de Opinião

> "Qual causa é mais urgente em Caruaru?" → opções: Causa Animal / Saúde / Segurança / Educação

**Resultado:** segmenta eleitores por causa de interesse → broadcast personalizado por causa.

**Vantagens deste caso de uso:**
- Engaja base passiva (votar é menos esforço que responder)
- Gera tag automática (`causa:saude`)
- Dado quantitativo agregável para tomada de decisão de campanha

---

## Troubleshooting Comum

| Sintoma | Causa Provável | Correção |
|---------|---------------|----------|
| Poll não chega ao destinatário | Endpoint errado (`/send/poll` em vez de `/send/menu` type=poll) | Usar `/send/menu` com `type: 'poll'` (fix de 2026-04-09) |
| `poll_update` não dispara handler | Webhook handler não registra evento `poll_update` | Adicionar branch específica em `whatsapp-webhook` |
| Voto registrado mas não aparece no dashboard | INSERT em `poll_responses` falha por FK | Garantir que `poll_messages.message_id` foi salvo no INSERT inicial |
| Lead vota mas tag não atualiza | Lógica de tagging não disparada no handler | Mapear `selectedOptions[0]` → tag no handler `poll_update` |
| Múltipla escolha não funciona | `selectableCount: 1` enviado | Enviar `selectableCount: 0` para múltipla escolha |

---

*Documentado em: 2026-04-08 — Particionado em 2026-05-04*
*Fonte: uazapi.md interno + análise de código do projeto*
