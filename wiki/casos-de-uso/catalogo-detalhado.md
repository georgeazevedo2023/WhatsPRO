---
title: Catalogo de Produtos — Documentacao Detalhada (Indice)
tags: [catalogo, produtos, scraping, csv, busca, fuzzy, ia, detalhado, indice]
sources: [src/components/admin/ai-agent/CatalogConfig.tsx, supabase/functions/scrape-product/]
updated: 2026-05-04
---

# Catalogo de Produtos — Estoque Digital do Agente IA (Indice das 10 Sub-Funcionalidades)

> O Catalogo e o **estoque digital** que o agente IA consulta quando um lead pergunta sobre produtos. Pense nele como a **vitrine interna** da loja — o agente so consegue vender o que esta cadastrado aqui. Se um produto nao esta no catalogo, o agente nao sabe que ele existe.
>
> O grande diferencial e que o cadastro e **rapido e inteligente**: em vez de digitar produto por produto, voce pode **colar a URL** de um produto de qualquer site e o sistema preenche tudo automaticamente (nome, preco, descricao, fotos). Ou importar uma **planilha CSV** com centenas de produtos de uma vez. Ou ate colar a URL de uma **pagina de categoria** e o sistema varre todos os produtos daquela pagina.
>
> Sem catalogo, o agente IA nao tem o que vender — responde "nao sei" para qualquer pergunta sobre produtos. Com catalogo preenchido, ele busca, mostra fotos, cita precos e monta carrosseis automaticamente.
>
> Ver tambem: [[wiki/casos-de-uso/ai-agent-detalhado]] (como a IA usa o catalogo: tools search_products, send_carousel, send_media), [[wiki/modulos]]

---

## Sub-paginas (organizadas por area)

A documentacao das 10 sub-funcionalidades foi particionada em 3 wikis tematicas (cada uma sob 200 linhas, regra 14 do CLAUDE.md). Use o indice abaixo para navegar:

| Sub-pagina | Sub-funcionalidades cobertas |
|------------|------------------------------|
| [[wiki/casos-de-uso/catalogo-crud-ui]] | **5.1** Tabela de Produtos (listagem visual), **5.2** Formulario de Produto (criar/editar), **5.6** Gestao de Imagens, **5.8** Categorias e Subcategorias, **5.10** Descricao Gerada por IA |
| [[wiki/casos-de-uso/catalogo-importacao]] | **5.3** Importacao Rapida por URL (Quick Scrape), **5.4** Importacao CSV (planilha, wizard 4 passos), **5.5** Importacao em Lote por URL (Batch Scrape) |
| [[wiki/casos-de-uso/catalogo-busca-integracoes]] | **5.7** Busca Inteligente (4 camadas + fuzzy pg_trgm), **5.9** Integracao com Bio Link (botoes tipo catalog) |

---

## Como navegar pelo catalogo-detalhado

- Mantendo o catalogo no dia a dia (cadastrar, editar, fotos, categorias)? → `catalogo-crud-ui`
- Cadastrando muitos produtos de uma vez (URL, CSV, pagina de categoria)? → `catalogo-importacao`
- Entendendo como a IA encontra produtos ou ligando produtos ao Bio Link? → `catalogo-busca-integracoes`

---

## Arvore de Componentes (visao geral)

```
AIAgentCatalog.tsx (pagina — /dashboard/ai-agent/catalog)
+-- Seletor de agente (dropdown)
+-- CatalogConfig.tsx (orquestrador principal)
    +-- CatalogTable.tsx          → catalogo-crud-ui (5.1)
    +-- CatalogProductForm.tsx    → catalogo-crud-ui (5.2, 5.6, 5.10)
    +-- CsvProductImport.tsx      → catalogo-importacao (5.4)
    +-- BatchScrapeImport.tsx     → catalogo-importacao (5.5)
```

---

## Tabelas do Banco

| Tabela | O que guarda |
|--------|--------------|
| `ai_agent_products` | Produtos (title, price, description, images[], category, subcategory, sku, in_stock, enabled) |
| `scrape_jobs` | Jobs de scraping em lote (status, progress, total, imported, errors, found_links) |

---

## Links Relacionados

- [[wiki/casos-de-uso/ai-agent-detalhado]] — Como a IA usa o catalogo (tools search_products, send_carousel, send_media)
- [[wiki/casos-de-uso/helpdesk-detalhado]] — Onde as conversas acontecem (carrosseis aparecem aqui)
- [[wiki/modulos]] — Todos os 17 modulos
- [[wiki/banco-de-dados]] — Esquema completo do banco

---

*Documentado em: 2026-04-10 — Sessao de documentacao detalhada com George Azevedo*
*Padrao dual: didatico (leigos) + tecnico (devs) em cada secao*
*Rev 2 (2026-05-04): Particionado em 3 sub-wikis tematicas para respeitar regra 14 (max 200 linhas/MD). Este arquivo virou indice.*
