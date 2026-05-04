---
title: Catalogo — Busca Inteligente e Integracoes
tags: [catalogo, busca, fuzzy, pg_trgm, bio-link, ia, integracoes]
sources: [supabase/functions/ai-agent/index.ts, src/hooks/useCatalogProductsForBio.ts]
updated: 2026-05-04
---

# Catalogo — Busca Inteligente e Integracoes (2 Sub-Funcionalidades)

> Esta pagina cobre o **motor de busca interno** que a IA usa para encontrar produtos durante uma conversa, e a integracao do catalogo com a pagina Bio Link (Linktree-style). Para CRUD/UI veja [[wiki/casos-de-uso/catalogo-crud-ui]]. Para importacao em massa veja [[wiki/casos-de-uso/catalogo-importacao]].

---

## 5.7 Busca Inteligente — Como a IA Encontra Produtos

**O que e:** Quando o lead pergunta sobre um produto no WhatsApp, a IA usa um sistema de busca em 4 camadas que corrige erros de digitacao e filtra por marca. Isso nao e algo que o admin configura — e o motor de busca interno que funciona automaticamente.

**As 4 camadas da busca (em ordem):**

**Camada 1 — Busca exata:** Procura a frase inteira no titulo, descricao, categoria e subcategoria. Ex: "tinta coral branca 18L" → procura essa frase exata.

**Camada 2 — Busca palavra por palavra:** Se a frase exata nao achou nada, quebra em palavras e busca cada uma. Ex: "tinta" E "coral" E "branca" E "18L" — todas precisam estar presentes.

**Camada 3 — Busca por semelhanca (fuzzy):** Se ainda nao achou, usa inteligencia de semelhanca de palavras. "cooral" e comparada letra por letra com "coral" e retorna 78% de semelhanca — acima de 30% ja e considerado match. Funciona para erros de digitacao comuns.

**Camada 4 — Filtro rigoroso:** Apos encontrar resultados, aplica um filtro extra que mantem **so os produtos que contem TODAS as palavras da busca**. Se o lead pediu "tinta Suvinil branca", nao vai aparecer "tinta Coral branca" (mesmo que "tinta" e "branca" batam — "Suvinil" nao bate com "Coral").

**Apos a busca, a IA decide:**
- 1 produto com 1 foto → envia foto individual (send_media)
- 1 produto com 2+ fotos → envia carrossel de 1 produto
- 2+ produtos → envia carrossel com ate 5 produtos

**Cenarios:**
1. Lead: "cooral fosco brnco" (erros) → Camada 3 encontra "Coral Fosco Branco" (78% semelhanca) ✅
2. Lead: "tinta iquine branco" → Camadas 1-3 encontram varios → Camada 4 filtra: so Iquine ✅
3. Lead: "verniz para madeira" → Camada 2 encontra na categoria "seladores e vernizes" ✅

> **Tecnico:** Tool `search_products` no ai-agent/index.ts. Pipeline: (1) ILIKE `'%query%'` em title/description/category/subcategory, (2) word-by-word AND com ILIKE por palavra, (3) RPC `search_products_fuzzy()` com pg_trgm (threshold 0.3, word-level similarity), (4) post-filter AND em ALL results. Indices GIN: `idx_ai_agent_products_title_trgm`, `_description_trgm`, `_category_trgm`. Auto-tag: primeiro resultado → `interesse:{category}`, query → `produto:{query}`. Marca nao encontrada → `marca_indisponivel:{brand}`. Auto-interesse para 0 resultados: keywords mapping (tinta→tintas, verniz→seladores_e_vernizes, manta→impermeabilizantes).

---

## 5.9 Integracao com Bio Link

**O que e:** Os botoes do Bio Link (pagina de links estilo Linktree) podem apontar para produtos do catalogo. Quando o admin cria um botao do tipo "Catalogo", ele seleciona um produto da lista e o botao mostra foto + nome + preco.

**Cenario:** Bio Link da loja tem botao "Produto Destaque" que mostra "Tinta Coral Branco 18L — R$ 289,90" com a foto do produto. Lead clica → abre WhatsApp com mensagem pre-escrita sobre aquele produto.

> **Tecnico:** Hook `useCatalogProductsForBio()` carrega produtos do agente. Campo `bio_buttons.catalog_product_id` UUID FK → `ai_agent_products.id`. Botao tipo 'catalog' renderiza: title, price (formatted), currency, image_url (primeiro do array images). Pre-message inclui `[catalog:{product_title}]` para contexto do AI Agent.

---

## Indices Especiais para Busca Fuzzy

| Indice | Coluna | Tipo |
|--------|--------|------|
| `idx_ai_agent_products_title_trgm` | title | GIN pg_trgm |
| `idx_ai_agent_products_description_trgm` | description | GIN pg_trgm |
| `idx_ai_agent_products_category_trgm` | category | GIN pg_trgm |

---

## Links Relacionados

- [[wiki/casos-de-uso/catalogo-detalhado]] — Indice geral do catalogo
- [[wiki/casos-de-uso/catalogo-crud-ui]] — Tabela, formulario, imagens, categorias, descricao IA
- [[wiki/casos-de-uso/catalogo-importacao]] — Importacao por URL, CSV e Batch
- [[wiki/casos-de-uso/ai-agent-detalhado]] — Como a IA usa o catalogo (tools search_products, send_carousel, send_media)
- [[wiki/casos-de-uso/m14-bio-link-detalhado]] — Bio Link em profundidade

---

*Particionado em 2026-05-04 a partir de catalogo-detalhado.md*
