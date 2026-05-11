---
title: Roadmap — M11 E-commerce (parte 1)
type: roadmap-detail
updated: 2026-05-11
---

# M11 — E-commerce WhatsApp (parte 1: T11.1-T11.5)

> Continuação em [[wiki/roadmap/m11-ecommerce-part2]].

#### M11 - E-commerce WhatsApp 📋

> **Visão**: Catálogo de produtos com pedidos, pagamentos e fulfillment integrados ao WhatsApp.
> Permite que negócios vendam diretamente pelo WhatsApp sem precisar de site ou loja virtual.

| Task | Status | Descrição |
|------|--------|-----------|
| T11.1 CRUD produtos com variantes | 📋 | Produtos, variantes (tamanho, cor), preços, imagens |
| T11.2 Coleções de produtos | 📋 | Agrupar produtos por categoria |
| T11.3 Envio de catálogo via WhatsApp | 📋 | Carrossel de produtos com botão de compra |
| T11.4 Pedidos via conversa | 📋 | Criar order a partir do chat, adicionar itens |
| T11.5 Checkout com link de pagamento | 📋 | PIX, Stripe, MercadoPago — link gerado automaticamente |
| T11.6 Fulfillment tracking | 📋 | Status do pedido (preparando → enviado → entregue) via WhatsApp |
| T11.7 Invoices automáticas | 📋 | Geração e envio de comprovante ao cliente |
| T11.8 Estoque e alertas | 📋 | Controle de estoque com notificação de baixa |
| T11.9 Relatórios de vendas | 📋 | GMV, ticket médio, produtos mais vendidos, conversão |
| T11.10 Cupons de desconto | 📋 | CRUD cupons com regras (%, fixo, frete, validade, uso único) |
| T11.11 Carrinho persistente | 📋 | Contato adiciona itens ao longo da conversa, finaliza quando quiser |
| T11.12 Catálogo web público | 📋 | Página web com produtos que redireciona para WhatsApp |

##### T11.1 — CRUD Produtos com Variantes
**Descrição completa**: Gerenciamento completo de produtos com suporte a variantes (combinações de propriedades como tamanho e cor).

**Interface do admin**:
- Lista de produtos com busca, filtros (coleção, status, preço) e bulk actions
- Form de produto: nome, descrição, imagens (drag-drop, multi-upload), preço base, SKU, peso
- Tab de variantes: definir propriedades (ex: Tamanho: P/M/G, Cor: Preto/Branco) → gera combinações automáticas
- Cada variante tem: preço próprio (ou herda), SKU, estoque, imagem própria
- Status: ativo, rascunho, arquivado

**Schema da tabela `products`**:
```sql
products: id, workspace_id, name, description, slug, status (active/draft/archived),
          base_price, compare_at_price, cost_price, sku, weight_grams,
          visible_in_catalog, featured, created_at, updated_at

product_variants: id, product_id, name, sku, price, compare_at_price,
                  stock_quantity, stock_policy (track/dont_track),
                  properties (JSONB: {"Tamanho": "M", "Cor": "Preto"}),
                  image_id, position, active

product_images: id, product_id, url, alt_text, position, storage_path,
                thumbnail_url, medium_url, large_url
```

**Exemplo**:
```
Produto: Camiseta Premium
├── Variante: P/Preto  — R$ 89,90 — Estoque: 45
├── Variante: P/Branco — R$ 89,90 — Estoque: 32
├── Variante: M/Preto  — R$ 89,90 — Estoque: 67
├── Variante: M/Branco — R$ 89,90 — Estoque: 55
├── Variante: G/Preto  — R$ 99,90 — Estoque: 28
└── Variante: G/Branco — R$ 99,90 — Estoque: 41
```

---

##### T11.2 — Coleções de Produtos
**Descrição completa**: Agrupar produtos em categorias para organização e envio seletivo de catálogo.

**Tipos de coleção**:
- **Manual**: admin seleciona produtos individualmente
- **Automática** (regras): Ex: "Todos os produtos com tag 'verão' e preço < R$100"

**Exemplos de coleções**:
| Coleção | Tipo | Regra/Produtos |
|---------|------|----------------|
| Lançamentos | Manual | 5 produtos selecionados |
| Até R$50 | Automática | `price <= 50` |
| Mais Vendidos | Automática | `orders_count > 10` nos últimos 30 dias |
| Coleção Verão | Manual | 12 produtos selecionados |
| Promoções | Automática | `compare_at_price IS NOT NULL` |

---

##### T11.3 — Envio de Catálogo via WhatsApp
**Descrição completa**: Enviar produtos como carrossel interativo no WhatsApp com botões de ação.

**Formatos de envio**:

1. **Carrossel de produtos** (já suportado pelo broadcast M3):
```
[Card 1: Imagem do produto]
  Camiseta Premium - R$ 89,90
  [Botão: 🛒 Comprar] [Botão: ℹ️ Detalhes]

[Card 2: Imagem do produto]
  Calça Jeans Slim - R$ 149,90
  [Botão: 🛒 Comprar] [Botão: ℹ️ Detalhes]
```

2. **Lista de produtos** (mensagem formatada):
```
📦 *Catálogo MinhaLoja*

1️⃣ *Camiseta Premium* — R$ 89,90
   Cores: Preto, Branco | Tam: P, M, G

2️⃣ *Calça Jeans Slim* — R$ 149,90
   Cores: Azul, Preto | Tam: 38-46

3️⃣ *Tênis Runner* — R$ 199,90
   Cores: Preto, Cinza | Tam: 38-44

👉 Responda com o número do produto para mais detalhes!
```

3. **Produto individual** (imagem + detalhes):
```
[📸 Foto do produto]
*Camiseta Premium*
💰 De ~R$ 129,90~ por *R$ 89,90*
📏 Tamanhos: P, M, G
🎨 Cores: Preto, Branco
📦 Frete: Grátis acima de R$150

Responda "COMPRAR" ou escolha:
1) Tamanho P  2) Tamanho M  3) Tamanho G
```

**Integração com funis (M10)**: O catálogo pode ser um step do funil → contato escolhe → cria pedido → checkout.

---

##### T11.4 — Pedidos via Conversa
**Descrição completa**: Criar e gerenciar pedidos diretamente a partir do chat do helpdesk.

**Fluxo do agente (via painel)**:
1. No painel do contato (M2), clicar "➕ Novo Pedido"
2. Buscar e adicionar produtos (com variante e quantidade)
3. Aplicar cupom de desconto (se houver)
4. Selecionar forma de envio
5. Gerar link de pagamento ou marcar como "pago offline"
6. Enviar resumo ao contato pelo chat

**Fluxo automático (via funil M10)**:
```
Contato: "Quero a camiseta preta M"
Bot: [⚡ Criar pedido: Camiseta Premium, Preto, M, 1x]
Bot: "Perfeito! Seu pedido ficou assim:
      🛒 1x Camiseta Premium (M/Preto) — R$ 89,90
      📦 Frete: R$ 12,90
      💰 Total: R$ 102,80
      Confirma? Responda SIM para receber o link de pagamento."
Contato: "sim"
Bot: "Aqui está seu link de pagamento: https://pay.whatspro.com/ord_abc123
      Assim que o pagamento for confirmado, te aviso! ✅"
```

**Schema da tabela `orders`**:
```sql
orders: id, workspace_id, contact_id, conversation_id, order_number (auto),
        status (pending/paid/preparing/shipped/delivered/cancelled/refunded),
        subtotal, discount_amount, shipping_amount, total,
        coupon_id, shipping_address (JSONB), notes,
        paid_at, shipped_at, delivered_at, cancelled_at,
        payment_method, payment_provider, payment_id,
        created_by (user_id), created_at, updated_at

order_items: id, order_id, product_id, variant_id, product_name, variant_name,
             quantity, unit_price, total_price, sku
```

**Status do pedido com timeline**:
```
📋 Pendente → 💳 Pago → 📦 Preparando → 🚚 Enviado → ✅ Entregue
                                                    └→ ↩️ Devolvido
              └→ ❌ Cancelado
```

---

##### T11.5 — Checkout com Link de Pagamento
**Descrição completa**: Gerar links de pagamento integrados com provedores brasileiros e internacionais.

**Provedores suportados**:

| Provedor | Métodos | Fee | Prazo |
|----------|---------|-----|-------|
| PIX (via MercadoPago) | PIX QR Code + copia-cola | 0.99% | Instantâneo |
| MercadoPago | Cartão, boleto, PIX | 4.98% + R$0.40 | 1-3 dias |
| Stripe | Cartão, Apple Pay, Google Pay | 3.99% + R$0.39 | 2 dias |
| PagSeguro | Cartão, boleto, PIX | 4.99% + R$0.40 | 1-14 dias |
| Asaas | Boleto, PIX, cartão | 2.99% | 1-3 dias |
| Manual | Transferência, dinheiro | 0% | Manual |

**Fluxo de pagamento**:
1. Pedido criado → edge function `generate-checkout-link`
2. Link gerado com dados do pedido (valor, itens, expiração)
3. Link enviado ao contato via WhatsApp
4. Contato paga → webhook do provedor → `payment-webhook`
5. Status atualizado para "paid" → notifica contato no WhatsApp:
   ```
   ✅ Pagamento confirmado!
   Pedido #1234 — R$ 102,80
   Estamos preparando seu pedido. Acompanhe por aqui! 📦
   ```
6. Se PIX: gerar QR code e enviar como imagem + código copia-cola

**Página de checkout** (mini-página web):
- Resumo do pedido com itens e valores
- Seleção de forma de pagamento
- Formulário de endereço (se envio físico)
- Botão "Pagar" → redireciona para provedor
- Webhook de retorno atualiza pedido e notifica via WhatsApp

---

