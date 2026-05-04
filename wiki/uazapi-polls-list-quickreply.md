---
title: UAZAPI — Mensagens Interativas (List e QuickReply)
tags: [uazapi, list, quickreply, botoes, interativo]
updated: 2026-05-04
---

# UAZAPI — List e QuickReply

> Documentação dos endpoints interativos `POST /send/quickreply` e `POST /send/list` da UAZAPI.
> Status: ambos **NÃO IMPLEMENTADOS** no WhatsPRO — endpoints documentados como referência.

Ver também: [[wiki/uazapi-polls-interativos]] (índice), [[wiki/uazapi-polls-poll]], [[wiki/uazapi-polls-casos-uso]].

---

## 1. `POST /send/quickreply` — Botões de Resposta Rápida

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
**Não implementado** — endpoint documentado, não implementado no proxy.

---

## 2. `POST /send/list` — Lista Interativa com Seções

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
**Não implementado** — endpoint documentado, não implementado no proxy.

---

## 3. Referência dos Outros Endpoints UAZAPI Relevantes

| Endpoint | Status Proxy | Uso Potencial |
|----------|-------------|---------------|
| `POST /send/menu` (type=poll) | Implementado | Enquetes, qualificação, pesquisa (ver [[wiki/uazapi-polls-poll]]) |
| `POST /send/quickreply` | Não implementado | Menu inicial, qualificação rápida |
| `POST /send/list` | Não implementado | Catálogo interativo, menu de serviços |
| `POST /send/location` | Não implementado | Localização de loja/evento |
| `POST /send/pix` | Não implementado | Pagamento via PIX no chat |
| `POST /send/text` | Implementado | Mensagem de texto |
| `POST /send/media` | Implementado | Imagem, vídeo, áudio, documento |
| `POST /send/carousel` | Implementado | Carrossel de produtos |

---

*Documentado em: 2026-04-08 — Particionado em 2026-05-04*
*Fonte: uazapi.md interno + análise de código do projeto*
