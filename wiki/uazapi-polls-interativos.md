---
title: UAZAPI — Mensagens Interativas (Poll, QuickReply, List)
tags: [uazapi, poll, enquete, interativo, broadcast, ai-agent]
updated: 2026-04-09
---

# UAZAPI — Mensagens Interativas

> Documentação dos endpoints interativos da UAZAPI disponíveis para implementação no WhatsPRO.
> Status: Poll **IMPLEMENTADO** e testado ao vivo (2026-04-09). List e QuickReply documentados mas não implementados.
> Endpoint unificado: `POST /send/menu` com campo `type` determinando o tipo de interação.

---

## 1. `POST /send/menu` (type=poll) — Enquete Interativa

### Endpoint
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

### Status de Implementação no WhatsPRO
| Componente | Status |
|-----------|--------|
| uazapi-proxy action `send-poll` | ✅ Implementado (M17 F4, fix endpoint 2026-04-09) |
| Webhook handler `poll_update` | ✅ Implementado (M17 F4) |
| AI Agent tool `send_poll` | ✅ Implementado (M17 F4) |
| Broadcast com polls | ✅ Implementado (M17 F4 — PollEditor) |
| Dashboard de métricas de poll | ✅ Implementado (M17 F5 — PollMetricsCard + PollNpsChart) |
| Tabela `poll_responses` no banco | ✅ Criada (migration 20260413000001) |
| NPS automático pós-resolve | ✅ Implementado (M17 F5 — PollConfigSection) |
| form-bot campo tipo poll | ✅ Implementado (M17 F4) |
| automationEngine ação send_poll | ✅ Implementado (M17 F4) |

---

## 2. `POST /send/quickreply` — Botões de Resposta Rápida

### Endpoint
```
POST /send/quickreply
Headers: { token: "<instance_token>" }
Body: {
  "number": "5511999999999",
  "text": "Como posso te ajudar hoje?",
  "buttons": [
    { "id": "vendas", "text": "Quero comprar" },
    { "id": "suporte", "text": "Preciso de ajuda" },
    { "id": "informacoes", "text": "Só estou pesquisando" }
  ]
}
Response: { "messageId": "...", "status": "sent" }
```

### Comportamento
- WhatsApp renderiza botões clicáveis abaixo da mensagem
- Ao clicar, o lead envia o `id` do botão como mensagem (texto)
- Max 3 botões por mensagem
- Botões desaparecem após o clique

### Status no WhatsPRO
`❌ Não implementado` — endpoint documentado, não implementado no proxy.

---

## 3. `POST /send/list` — Lista Interativa com Seções

### Endpoint
```
POST /send/list
Headers: { token: "<instance_token>" }
Body: {
  "number": "5511999999999",
  "title": "Menu de Opções",
  "text": "Escolha uma opção abaixo:",
  "buttonText": "Ver opções",
  "sections": [
    {
      "title": "Produtos",
      "rows": [
        { "id": "prod_1", "title": "Tinta Coral 18L", "description": "R$ 94,90" },
        { "id": "prod_2", "title": "Verniz Iquine 18L", "description": "R$ 89,90" }
      ]
    },
    {
      "title": "Serviços",
      "rows": [
        { "id": "serv_1", "title": "Orçamento Grátis", "description": "Sem compromisso" }
      ]
    }
  ]
}
```

### Limitações
- Max 10 seções, max 10 rows por seção
- Seleção dispara mensagem com o `id` da row escolhida
- Não disponível em grupos

### Status no WhatsPRO
`❌ Não implementado` — endpoint documentado, não implementado no proxy.

---

## 4. Plano de Implementação de Polls no WhatsPRO

### Fase 1 — Infraestrutura Backend

**4.1 Migration — tabela `poll_messages`**
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

**4.2 uazapi-proxy — action `send-poll` (✅ implementada)**
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

**4.3 whatsapp-webhook — handler de `poll_update`**
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

## 5. Casos de Uso por Contexto

### AI Agent — Qualificação por Poll
Em vez de perguntas em texto livre, o agente usa poll para qualificar:
> "Qual é o seu perfil?" → opções: "Quero comprar agora", "Estou pesquisando", "Quero ser revendedor"

Baseado na opção escolhida, o agente adapta o script SDR.

### Broadcast — Pesquisa de Interesse
Enviar poll para toda a base antes de um lançamento:
> "O que você mais quer ver na nossa nova coleção?" → opções por categoria

Resultado: segmentar próximo broadcast por interesse revelado no poll.

### Formulários — Campo tipo Poll
Substituir campos `select` do form-bot por polls nativos do WhatsApp — UX muito mais fluida para o usuário.

### Funil — NPS e Satisfação
Após handoff ou resolução de ticket:
> "Como foi seu atendimento?" → opções: ⭐⭐⭐⭐⭐, ⭐⭐⭐⭐, ⭐⭐⭐, ⭐⭐, ⭐

Resultado salvo em lead_profile, KPI visível no FunnelDetail.

### Campanha Política — Pesquisa de Opinião
> "Qual causa é mais urgente em Caruaru?" → opções: Causa Animal / Saúde / Segurança / Educação

Resultado: segmenta eleitores por causa de interesse → broadcast personalizado.

---

## 6. Referência dos Outros Endpoints UAZAPI Relevantes

| Endpoint | Status Proxy | Uso Potencial |
|----------|-------------|---------------|
| `POST /send/menu` (type=poll) | ✅ | Enquetes, qualificação, pesquisa |
| `POST /send/quickreply` | ❌ | Menu inicial, qualificação rápida |
| `POST /send/list` | ❌ | Catálogo interativo, menu de serviços |
| `POST /send/location` | ❌ | Localização de loja/evento |
| `POST /send/pix` | ❌ | Pagamento via PIX no chat |
| `POST /send/text` | ✅ | Mensagem de texto |
| `POST /send/media` | ✅ | Imagem, vídeo, áudio, documento |
| `POST /send/carousel` | ✅ | Carrossel de produtos |

---

*Documentado em: 2026-04-08*
*Fonte: uazapi.md interno + análise de código do projeto*
*Status: Planejamento — nenhum endpoint interativo implementado ainda*
