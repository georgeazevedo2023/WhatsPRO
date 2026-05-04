---
title: Catalogo — Importacao em Massa (URL, CSV, Batch)
tags: [catalogo, importacao, scraping, csv, batch, url]
sources: [src/components/admin/ai-agent/CsvProductImport.tsx, src/components/admin/ai-agent/BatchScrapeImport.tsx, supabase/functions/scrape-product/, supabase/functions/scrape-products-batch/]
updated: 2026-05-04
---

# Catalogo — Importacao em Massa (3 Sub-Funcionalidades)

> Esta pagina cobre os tres modos de **cadastro acelerado** de produtos: importar 1 produto colando a URL, importar centenas via planilha CSV, ou varrer uma pagina de categoria inteira. Para CRUD/UI veja [[wiki/casos-de-uso/catalogo-crud-ui]]. Para busca e integracoes veja [[wiki/casos-de-uso/catalogo-busca-integracoes]].

---

## 5.3 Importacao Rapida por URL (Quick Product Import)

**O que e:** Em vez de preencher todos os campos manualmente, voce pode **colar a URL de qualquer produto de qualquer loja online** e o sistema extrai automaticamente nome, preco, descricao, fotos, categoria e SKU.

**Como funciona:**
1. No formulario de novo produto, tem uma secao "Importar de URL"
2. Cola a URL do produto (ex: `https://www.leroymerlin.com.br/tinta-coral-branco-18l_123456`)
3. Clica em "Importar"
4. O sistema acessa a pagina, le o conteudo e extrai os dados automaticamente
5. Os campos do formulario sao preenchidos — voce confere e salva

**O que o sistema extrai (em ordem de prioridade):**
1. **JSON-LD** (metadados estruturados da pagina) — mais confiavel, extrai tudo de uma vez
2. **Open Graph tags** (meta tags de compartilhamento) — titulo, descricao, imagem, preco
3. **Meta tags HTML** — preco via `data-price` ou `itemprop="price"`, SKU via `data-sku`
4. **Tag `<title>`** — ultimo recurso para o nome
5. **Tags `<img>`** — busca imagens com URLs que contem "product", "catalog", "cdn" (ate 10 fotos)

**Cenario real:** Admin quer cadastrar 20 produtos da Leroy Merlin. Abre cada produto no site, copia a URL, cola no formulario → em 5 segundos, nome, preco, descricao e 4 fotos sao preenchidos. Confere, ajusta o preco se necessario, salva. **20 produtos em 10 minutos** em vez de 2 horas.

> **Tecnico:** Edge function `supabase/functions/scrape-product/index.ts`. Verify_jwt=true. Fetch com 20s timeout. Retorna `{ product: { title, price, description, images[], category, sku, brand } }`. Parsing: regex para JSON-LD `<script type="application/ld+json">`, OG tags `og:title/description/image/price`, meta `itemprop`, preco via regex `R\$\s*[\d.,]+`, imagens filtradas por patterns product/catalog/upload/media/cdn. Dedup de imagens. URLs relativas convertidas para absolutas. Componente: secao colapsavel no CatalogProductForm (so para novos produtos).

---

## 5.4 Importacao CSV (Planilha)

**O que e:** Upload de arquivo CSV (planilha) com lista de produtos para cadastrar em massa. Funciona como um assistente de 4 passos que guia o usuario do upload ate a importacao.

**Os 4 passos:**

**Passo 1 — Upload:** Arrasta ou seleciona o arquivo CSV (ate 10MB, maximo 5.000 produtos). O sistema detecta automaticamente o separador (virgula, ponto-e-virgula ou tabulacao).

**Passo 2 — Mapeamento:** O sistema tenta identificar automaticamente qual coluna corresponde a qual campo (busca palavras como "nome", "preco", "descricao", "categoria", "sku", "imagem", "estoque"). Se nao encontrar, mostra uma tela para o usuario mapear manualmente. Mostra preview das 5 primeiras linhas.

**Passo 3 — Importacao:** Importa em lotes de 50 produtos por vez. Barra de progresso mostra quanto falta. Detecta duplicatas (mesmo nome ou mesmo SKU).

**Passo 4 — Resultado:** Mostra contagem final: X importados, Y duplicatas ignoradas, Z erros. Lista de erros com numero da linha e mensagem.

**Tratamento especial:**
- Preco "R$ 1.234,56" → converte para 1234.56 automaticamente (remove R$, troca pontos e virgulas)
- Imagens "url1;url2;url3" → separa por ponto-e-virgula ou virgula
- Estoque "nao", "false", "0", "esgotado" → marca como sem estoque

**Cenario real:** Distribuidora tem planilha Excel com 500 produtos (nome, preco, categoria, SKU). Exporta como CSV → arrasta para o WhatsPRO → sistema detecta colunas → importa 490 produtos, 8 duplicatas, 2 erros (linhas sem nome). Em 2 minutos, catalogo completo.

> **Tecnico:** Componente `CsvProductImport.tsx`. Wizard 4 steps com estado local. Auto-detect delimiter: testa `;`, `,`, `\t`. Column detection: arrays de keywords por campo (titulo: ['título','titulo','nome','produto','name','title','product'], preco: ['preço','preco','valor','price','vlr'], etc.). Parse preco: strip R$, remove dots, comma→dot. Parse images: split por `;` ou `,`, filter `startsWith('http')`. Parse stock: NOT in ['0','não','nao','false','no','indisponível','esgotado']. Batch insert: chunks de 50 via `supabase.from('ai_agent_products').insert(batch)`. Dedup: check existing por title (case-insensitive) e SKU. Max: 10MB file, 5000 rows.

---

## 5.5 Importacao em Lote por URL (Batch Scrape)

**O que e:** Em vez de colar uma URL de cada vez, voce pode colar a URL de uma **pagina de categoria** (ex: "todas as tintas") e o sistema **varre automaticamente** todos os produtos daquela pagina.

**Como funciona:**
1. Cola a URL da pagina de categoria (ex: `https://www.leroymerlin.com.br/tintas`)
2. O sistema varre a pagina e encontra todos os links de produtos (ate 100)
3. Para cada link encontrado, faz o scraping individual (mesmo processo da secao 5.3)
4. Mostra progresso em tempo real: "Processando 15 de 47..."
5. Resultado final: X importados, Y duplicatas, Z erros

**Como detecta links de produtos:** Procura tags `<a href="">` com URLs que contem patterns como `/produto/`, `/product/`, `/item/`, `/p/`, `.html` — e que estao no mesmo dominio.

**Cenario real:** Admin cola URL da categoria "Tintas" da Leroy Merlin → sistema encontra 47 links de produtos → varre cada um → importa 42 produtos com nome, preco, descricao e fotos → 5 duplicatas ignoradas. **47 produtos em 5 minutos**, sem digitar nada.

> **Tecnico:** Componente `BatchScrapeImport.tsx`. Edge function `supabase/functions/scrape-products-batch/index.ts`. Link detection: regex patterns `/produto/`, `/product/`, `/item/`, `/p/`, `-p-\d+`, `/dp/`, `.html$`. Filtro: mesmo dominio, max 100 links, dedup por URL. Processamento assincrono: tabela `scrape_jobs` (id, agent_id, url, status ENUM 'scanning'|'processing'|'completed'|'failed', progress, total, imported, duplicates, errors, found_links JSONB, error_message). Client faz polling GET a cada 3 segundos para status. Dedup por title ao inserir.

---

## Tabelas de Apoio

| Tabela | O que guarda |
|--------|--------------|
| `ai_agent_products` | Produtos importados (destino final) |
| `scrape_jobs` | Jobs de batch scraping (status, progress, total, imported, errors, found_links) |

---

## Links Relacionados

- [[wiki/casos-de-uso/catalogo-detalhado]] — Indice geral do catalogo
- [[wiki/casos-de-uso/catalogo-crud-ui]] — Tabela, formulario, imagens, categorias, descricao IA
- [[wiki/casos-de-uso/catalogo-busca-integracoes]] — Busca fuzzy + Bio Link
- [[wiki/casos-de-uso/ai-agent-detalhado]] — Como a IA usa o catalogo

---

*Particionado em 2026-05-04 a partir de catalogo-detalhado.md*
