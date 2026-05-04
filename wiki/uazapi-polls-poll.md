---
title: UAZAPI — Mensagens Interativas (Poll / Enquete)
tags: [uazapi, poll, enquete, interativo, broadcast, ai-agent]
updated: 2026-05-04
---

# UAZAPI — Poll (Enquete Interativa)

> Documentação do endpoint `POST /send/menu` (type=poll) e do plano de implementação no WhatsPRO.
> Status: Poll **IMPLEMENTADO** e testado ao vivo (2026-04-09).

Ver também: [[wiki/uazapi-polls-interativos]] (índice), [[wiki/uazapi-polls-list-quickreply]], [[wiki/uazapi-polls-casos-uso]].

---

## 1. Endpoint `POST /send/menu` (type=poll)

```
POST /send/menu
Headers: { token: "<instance_token>" }
Body: {
  "number": "5511999999999",          // JID ou telefone do destinatário
  "type": "poll",                     // Tipo de mensagem interativa
  "text": "Qual tema prefere?",       // Pergunta da enquete (max 255 chars)
  "choices": [                         // Opções de resposta
    "Causa Animal",
    "Saúde Pública",
    "Educação",
    "Segurança"
  ],
  "selectableCount": 1                 // 1 = escolha única | 0 = múltipla escolha
}
```

### Comportamento
- O WhatsApp renderiza a mensagem como enquete nativa (UI dedicada)
- O destinatário toca nas opções para votar — não precisa digitar nada
- **Resposta de voto**: chega via webhook como evento do tipo `poll_update`
- O voto inclui o ID da mensagem original e as opções selecionadas

### Webhook de Resposta de Voto
```json
{
  "event": "poll_update",
  "data": {
    "messageId": "3EB0ABC123...",       // ID da mensagem original do poll
    "voter": "5511999999999@s.whatsapp.net",
    "selectedOptions": ["Causa Animal"],
    "pollQuestion": "Qual tema prefere?"
  }
}
```

### Limitações Conhecidas
- Disponível apenas no WhatsApp pessoal (não WhatsApp Business API oficial)
- Funciona via Baileys/uazapiGO (não-oficial)
- Máximo de opções: 12 por enquete
- Enquetes em grupos: votos aparecem para todos os participantes
- Enquetes em chats individuais: voto privado

---

## 2. Status de Implementação no WhatsPRO

| Componente | Status |
|-----------|--------|
| uazapi-proxy action `send-poll` | Implementado (M17 F4, fix endpoint 2026-04-09) |
| Webhook handler `poll_update` | Implementado (M17 F4) |
| AI Agent tool `send_poll` | Implementado (M17 F4) |
| Broadcast com polls | Implementado (M17 F4 — PollEditor) |
| Dashboard de métricas de poll | Implementado (M17 F5 — PollMetricsCard + PollNpsChart) |
| Tabela `poll_responses` no banco | Criada (migration 20260413000001) |
| NPS automático pós-resolve | Implementado (M17 F5 — PollConfigSection) |
| form-bot campo tipo poll | Implementado (M17 F4) |
| automationEngine ação send_poll | Implementado (M17 F4) |

---

## 3. Plano de Implementação (Histórico)

### Fase 1 — Infraestrutura Backend

**3.1 Migration — tabela `poll_messages` e `poll_responses`**
```sql
CREATE TABLE poll_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id),
  instance_id UUID REFERENCES whatsapp_instances(id),
  message_id TEXT NOT NULL,           -- ID da mensagem UAZAPI
  question TEXT NOT NULL,
  options JSONB NOT NULL,             -- ["opção A", "opção B", ...]
  selectable_count INT DEFAULT 1,
  context TEXT,                       -- 'ai_agent' | 'broadcast' | 'manual'
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE poll_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_message_id UUID REFERENCES poll_messages(id),
  voter_jid TEXT NOT NULL,
  selected_options JSONB NOT NULL,    -- ["opção A"]
  voted_at TIMESTAMPTZ DEFAULT now()
);
```

**3.2 uazapi-proxy — action `send-poll`**
```typescript
case 'send-poll': {
  // Endpoint correto: /send/menu com type='poll'
  const pollBody = {
    number: groupjid,
    type: 'poll',
    text: String(body.question).trim(),
    choices: body.options.map((o: string) => String(o).trim()),
    selectableCount: body.selectableCount ?? 1,
  }, instanceToken)
}
```

**3.3 whatsapp-webhook — handler de `poll_update`**
```typescript
if (eventType === 'poll_update') {
  const { messageId, voter, selectedOptions } = data
  // 1. Buscar poll_message pelo messageId
  // 2. INSERT em poll_responses
  // 3. Atualizar tags do lead (ex: causa:X baseado na opção votada)
  // 4. Disparar AI Agent se configurado
}
```

### Fase 2 — AI Agent Tool `send_poll`

Adicionar 9ª tool ao AI Agent para qualificação interativa:
```typescript
{
  name: 'send_poll',
  description: 'Envia enquete interativa ao lead para qualificação ou coleta de preferência',
  parameters: {
    question: { type: 'string', description: 'Pergunta da enquete' },
    options: { type: 'array', items: { type: 'string' }, description: 'Opções de resposta' },
    context: { type: 'string', description: 'Contexto: qualificacao | preferencia | satisfacao' }
  }
}
```

### Fase 3 — Broadcast com Poll

Adicionar tipo `poll` no broadcast:
```
BroadcastForm → tipo "Enquete" → campo question + opções → agendar → enviar
```

### Fase 4 — Dashboard de Métricas

Componente `PollMetricsChart` no Dashboard:
- Distribuição de votos por opção (gráfico de pizza/barra)
- Taxa de resposta (votaram / receberam)
- Filtro por campanha/funil/data
- Exportar para CSV

---

*Documentado em: 2026-04-08 — Particionado em 2026-05-04*
*Fonte: uazapi.md interno + análise de código do projeto*
