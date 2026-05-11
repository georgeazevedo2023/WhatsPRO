---
title: Roadmap — M11 E-commerce (parte 2)
type: roadmap-detail
updated: 2026-05-11
---

# M11 — E-commerce WhatsApp (parte 2: T11.6-T11.12)

> Continuação de [[wiki/roadmap/m11-ecommerce-part1]].

##### T11.6 — Fulfillment Tracking
**Descrição completa**: Acompanhamento do pedido desde a preparação até a entrega, com notificações automáticas via WhatsApp.

**Status do fulfillment**:
```
📋 Pendente → 📦 Separando → 🏷️ Embalado → 🚚 Coletado → 🛵 Em trânsito → ✅ Entregue
```

**Notificações automáticas ao contato**:

| Evento | Mensagem WhatsApp |
|--------|-------------------|
| Pedido pago | "✅ Pagamento confirmado! Pedido #1234 está sendo preparado." |
| Em preparação | "📦 Seu pedido #1234 está sendo separado!" |
| Enviado | "🚚 Pedido #1234 foi enviado! Rastreio: {{tracking_code}} — Acompanhe: {{tracking_url}}" |
| Saiu para entrega | "🛵 Pedido #1234 saiu para entrega! Previsão: hoje até as 18h" |
| Entregue | "✅ Pedido #1234 foi entregue! Esperamos que goste 😊 Qualquer dúvida, estamos aqui!" |
| Entregue +3 dias | "⭐ Como foi sua experiência com o pedido #1234? Avalie de 1 a 5" |

**Integrações de rastreio**:
- Correios (via API)
- Jadlog, Loggi, Mandaê
- Tracking code manual (agente preenche)

---

##### T11.7 — Invoices Automáticas
**Descrição completa**: Geração automática de comprovantes/recibos de pagamento enviados ao cliente.

**Conteúdo da invoice**:
```
═══════════════════════════════
     COMPROVANTE DE PAGAMENTO
═══════════════════════════════
Pedido: #1234
Data: 21/03/2026
Cliente: João Silva

Itens:
• 1x Camiseta Premium (M/Preto)    R$ 89,90
• 1x Boné Snapback                   R$ 49,90
─────────────────────────────
Subtotal:                           R$ 139,80
Frete:                              R$ 12,90
Desconto (cupom PROMO10):          -R$ 13,98
═══════════════════════════════
TOTAL PAGO:                        R$ 138,72
Método: PIX
═══════════════════════════════
```

**Formatos**:
- Mensagem formatada no WhatsApp (como acima)
- PDF gerado automaticamente (edge function `generate-invoice-pdf`)
- Enviado como documento no chat

---

##### T11.8 — Estoque e Alertas
**Descrição completa**: Controle de quantidade em estoque com alertas automáticos quando produtos estão acabando.

**Funcionalidades**:
- Estoque por variante (ex: Camiseta M/Preta: 5 unidades)
- Desconto automático ao criar pedido pago
- Incremento ao cancelar pedido
- Alerta no admin quando estoque ≤ threshold (configurável, default: 5)
- Bloquear venda quando estoque = 0 (ou permitir backorder)
- Relatório de estoque: produtos em baixa, sem estoque, reposição sugerida

**Notificações para admin**:
```
⚠️ Estoque baixo:
• Camiseta Premium M/Preto: 3 unidades restantes
• Tênis Runner 42/Cinza: 1 unidade restante

❌ Sem estoque:
• Boné Snapback Azul: 0 unidades
```

---

##### T11.9 — Relatórios de Vendas
**Descrição completa**: Dashboard analítico com métricas de vendas e performance de produtos.

**KPIs principais**:
| Métrica | Cálculo | Exemplo |
|---------|---------|---------|
| GMV (Gross Merchandise Value) | Soma total de pedidos | R$ 45.230,00 |
| Ticket médio | GMV / nº pedidos | R$ 156,00 |
| Total de pedidos | Count orders (paid+) | 290 |
| Taxa de conversão | Pedidos / contatos que viram catálogo | 12% |
| Taxa de abandono | Pedidos pendentes / pedidos criados | 34% |
| Produto mais vendido | Order items count | Camiseta Premium (89 vendas) |
| Revenue por canal | GMV agrupado por inbox | Inbox Vendas: 70%, Inbox Suporte: 30% |

**Gráficos**:
- Vendas ao longo do tempo (diário/semanal/mensal)
- Top 10 produtos mais vendidos (barras)
- Revenue por coleção (pizza)
- Ticket médio ao longo do tempo (linha)
- Funil de conversão: visualizou → adicionou → pagou (funil)
- Mapa de calor: horários com mais vendas

---

##### T11.10 — Cupons de Desconto
**Descrição completa**: Sistema de cupons promocionais com regras flexíveis.

**Tipos de cupom**:
| Tipo | Exemplo | Descrição |
|------|---------|-----------|
| Percentual | PROMO10 → 10% OFF | Desconto percentual sobre subtotal |
| Valor fixo | VALE50 → R$50 OFF | Desconto fixo |
| Frete grátis | FRETEGRATIS | Zera custo de frete |
| Compre X ganhe Y | LEVE3PAGUE2 | 3 itens, cobra 2 |

**Regras configuráveis**:
- Validade (data início/fim)
- Uso máximo total (ex: 100 usos)
- Uso máximo por contato (ex: 1 vez)
- Valor mínimo do pedido (ex: acima de R$100)
- Produtos/coleções específicas
- Primeira compra apenas
- Combinável com outros cupons (sim/não)

**Exemplo no WhatsApp**:
```
Contato: "Tenho um cupom"
Bot: "Qual o código do seu cupom?"
Contato: "PROMO10"
Bot: "✅ Cupom PROMO10 aplicado! Você ganhou 10% de desconto.
      Subtotal: R$ 139,80
      Desconto: -R$ 13,98
      Novo total: R$ 125,82"
```

---

##### T11.11 — Carrinho Persistente
**Descrição completa**: Contato pode adicionar produtos ao longo da conversa e finalizar quando quiser.

**Fluxo de exemplo**:
```
Contato: "Quero ver as camisetas"
Bot: [Carrossel de camisetas]
Contato: [Clica "Comprar" na Camiseta Premium]
Bot: "Qual tamanho? 1) P  2) M  3) G"
Contato: "2"
Bot: "✅ Adicionado ao carrinho: 1x Camiseta Premium M/Preto — R$ 89,90
      🛒 Carrinho (1 item): R$ 89,90
      Quer continuar comprando ou finalizar?"
Contato: "Quero ver os bonés também"
Bot: [Carrossel de bonés]
Contato: [Clica "Comprar" no Boné Snapback]
Bot: "✅ Adicionado: 1x Boné Snapback — R$ 49,90
      🛒 Carrinho (2 itens): R$ 139,80
      Quer continuar comprando ou finalizar?"
Contato: "Finalizar"
Bot: "🛒 Resumo do pedido:
      • 1x Camiseta Premium M/Preto — R$ 89,90
      • 1x Boné Snapback — R$ 49,90
      📦 Frete: R$ 12,90
      💰 Total: R$ 152,70
      Tem cupom de desconto? Responda o código ou 'NÃO'"
```

**Persistência**: carrinho salvo em `carts` (contact_id, items JSONB, expires_at). Expira em 72h de inatividade.

---

##### T11.12 — Catálogo Web Público
**Descrição completa**: Página web acessível por link com catálogo de produtos que redireciona para WhatsApp.

**Funcionalidades da página**:
- URL: `https://catalogo.whatspro.com/{workspace_slug}`
- Grid de produtos com imagens, preços, filtros por coleção
- Página de produto com galeria, variantes, descrição
- Botão "Comprar pelo WhatsApp" → abre WhatsApp com mensagem pre-preenchida:
  `Olá! Gostaria de comprar: Camiseta Premium (M/Preto) — R$ 89,90`
- SEO básico (meta tags, Open Graph)
- Tema/cores personalizáveis pelo admin

**Tabelas planejadas**: `products`, `product_variants`, `product_prices`, `product_images`, `product_collections`, `product_collection_items`, `orders`, `order_items`, `invoices`, `fulfillments`, `fulfillment_locations`, `carts`, `cart_items`, `coupons`, `coupon_usages`

**Edge Functions planejadas**: `generate-checkout-link`, `payment-webhook`, `generate-invoice-pdf`, `stock-alert`, `fulfillment-notify`, `catalog-api`

**Componentes planejados**: `ProductList`, `ProductForm`, `VariantEditor`, `ImageUploader`, `CollectionManager`, `OrderList`, `OrderDetail`, `OrderTimeline`, `CheckoutConfig`, `CouponManager`, `StockDashboard`, `SalesReports`, `CatalogPreview`, `CartPanel`

---

