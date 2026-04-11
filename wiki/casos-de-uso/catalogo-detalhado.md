---
title: Catalogo de Produtos — Documentacao Detalhada de Todas as Sub-Funcionalidades
tags: [catalogo, produtos, scraping, csv, busca, fuzzy, ia, detalhado]
sources: [src/components/admin/ai-agent/CatalogConfig.tsx, supabase/functions/scrape-product/]
updated: 2026-04-09
---

# Catalogo de Produtos — Estoque Digital do Agente IA (10 Sub-Funcionalidades)

> O Catalogo e o **estoque digital** que o agente IA consulta quando um lead pergunta sobre produtos. Pense nele como a **vitrine interna** da loja — o agente so consegue vender o que esta cadastrado aqui. Se um produto nao esta no catalogo, o agente nao sabe que ele existe.
>
> O grande diferencial e que o cadastro e **rapido e inteligente**: em vez de digitar produto por produto, voce pode **colar a URL** de um produto de qualquer site e o sistema preenche tudo automaticamente (nome, preco, descricao, fotos). Ou importar uma **planilha CSV** com centenas de produtos de uma vez. Ou ate colar a URL de uma **pagina de categoria** e o sistema varre todos os produtos daquela pagina.
>
> Sem catalogo, o agente IA nao tem o que vender — responde "nao sei" para qualquer pergunta sobre produtos. Com catalogo preenchido, ele busca, mostra fotos, cita precos e monta carrosseis automaticamente.
>
> Ver tambem: [[wiki/casos-de-uso/ai-agent-detalhado]] (como a IA usa o catalogo: tools search_products, send_carousel, send_media), [[wiki/modulos]]

---

## 5.1 Tabela de Produtos — Listagem Visual

**O que e:** A tela principal do catalogo mostra todos os produtos cadastrados em formato de **grade de cards** (como uma loja online). Cada card mostra a foto do produto, nome, preco, categoria e status de estoque.

**O que cada card de produto mostra:**
- **Foto principal** com placeholder se nao tiver imagem
- **Badge de quantidade de fotos** (ex: "3" se tem 3 fotos)
- **Badge "Sem estoque"** vermelho quando esgotado
- **Nome do produto** (truncado se muito longo)
- **Categoria > Subcategoria** (ex: "Tintas > Coral")
- **Preco** formatado (ex: "R$ 289,90") ou "Sob consulta" se preco = 0
- **SKU** em badge pequeno (ex: "SKU: TIN-COR-18L")
- **Checkbox** para selecao em massa

**Filtros disponiveis:**
- **Busca por nome ou SKU** — campo de texto
- **Categoria** — dropdown dinamico (mostra so categorias que existem)
- **Status de estoque** — Todos / Em estoque / Sem estoque / Desativado
- **Ordenacao** — Por posicao / Nome A-Z / Maior preco / Mais recente
- **Limpar filtros** — botao que reseta tudo

**Acoes em massa:**
- Selecionar varios produtos com checkbox
- **Ativar** — torna visiveis para a IA
- **Desativar** — esconde da IA (nao deleta)
- **Excluir** — remove permanentemente (com confirmacao)

**Cenarios reais:**
1. **Loja com 200 produtos:** Gerente filtra "Tintas" + "Em estoque" → ve os 45 produtos de tinta disponiveis. Percebe que "Coral Branco 3.6L" esta sem estoque → desativa.
2. **Atualizacao de precos:** Ordena por "Maior preco" → encontra os 10 mais caros → clica em cada um para atualizar.
3. **Limpeza de catalogo:** Filtra "Desativado" → seleciona todos → exclui em massa.

> **Tecnico:** Componente `CatalogTable.tsx`. Grid responsivo: 1 col (sm), 2 (md), 3 (lg), 4 (xl). Busca: `supabase.from('ai_agent_products').select('*').eq('agent_id', X).ilike('title', '%query%')`. Filtros: category via `.eq('category', X)`, stock via `.eq('in_stock', true/false)`, enabled via `.eq('enabled', X)`. Ordenacao: `.order('position')` / `.order('title')` / `.order('price', { ascending: false })` / `.order('created_at', { ascending: false })`. Bulk: `Set<string>` selectedIds, batch UPDATE/DELETE. Card: hover mostra botoes Edit + Delete.

---

## 5.2 Formulario de Produto — Criar e Editar

**O que e:** Ao clicar em "Novo Produto" ou editar um existente, abre uma **janela modal** com todos os campos do produto.

**Campos do formulario:**
- **Nome** (obrigatorio) — ex: "Tinta Coral Branco Fosco 18L"
- **Categoria** — ex: "Tintas" (texto livre)
- **Subcategoria** — ex: "Coral" (texto livre)
- **Preco (R$)** — ex: 289.90 (campo numerico)
- **SKU** — codigo interno do produto, ex: "TIN-COR-18L"
- **Descricao** — texto detalhado sobre o produto, com botao de **gerar descricao por IA** (icone de varinha magica)
- **Em estoque** — toggle liga/desliga
- **Ativado** — toggle liga/desliga (se desativado, IA nao encontra)
- **Fotos** — zona de upload com drag & drop (ver secao 5.5)

**Geracao de descricao por IA:**
- Clica no botao de varinha magica ao lado do campo de descricao
- O sistema envia nome, categoria, subcategoria e preco para a IA (Gemini 2.5 Flash)
- A IA gera uma descricao comercial de 2-3 frases em portugues
- A descricao e inserida automaticamente no campo (pode ser editada)

**Cenario real:** Admin clica "Novo Produto" → digita "Tinta Coral Branco Fosco 18L" → preco R$ 289,90 → categoria "Tintas" → clica na varinha magica → IA gera: "Tinta acrilica premium Coral Fosco Branco 18L, ideal para paredes internas e externas. Acabamento fosco que proporciona elegancia e durabilidade. Cobertura de ate 400m² por demao." → admin ajusta se necessario → salva.

> **Tecnico:** Componente `CatalogProductForm.tsx`. Dialog modal `95vw sm:max-w-2xl`. Tabela `ai_agent_products` (title NOT NULL, category, subcategory, price DECIMAL(10,2), sku, description, in_stock BOOL, enabled BOOL, images TEXT[], position INT, metadata JSONB). AI description: chama Gemini 2.5 Flash via system_settings.GEMINI_API_KEY, temperature 0.7, max 200 tokens, prompt em portugues. UPSERT: INSERT para novo, UPDATE para editar. Delete: com AlertDialog de confirmacao.

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

## 5.6 Gestao de Imagens do Produto

**O que e:** Cada produto pode ter **varias fotos**. A primeira foto e a "foto principal" (destaque) que aparece no card, no carrossel do WhatsApp e na busca.

**Como funciona:**
- **Zona de upload** com arrastar e soltar (drag & drop) — destaque visual ao passar o arquivo
- **Clique para selecionar** — abre seletor de arquivos do computador
- **Formatos aceitos:** WebP, PNG, JPG, JPEG
- **Tamanho maximo:** 5MB por imagem
- **Upload multiplo:** pode arrastar varias fotos de uma vez
- **Grade de fotos** — mostra todas as fotos do produto em grid
- **Foto principal** — a primeira foto tem um badge de estrela (featured). Clique para mudar qual e a principal.
- **Excluir foto** — botao de lixeira ao passar o mouse sobre a foto

**Cenarios:**
1. **Upload manual:** Admin arrasta 4 fotos da tinta → primeira vira destaque → ordena as outras
2. **Upload por URL:** Ao importar por URL, as fotos do site ja vem automaticamente
3. **Troca de destaque:** Admin decide que a 3a foto e melhor → clica na estrela → ela vira a primeira

> **Tecnico:** Storage: Supabase Storage bucket `helpdesk-media`, path `catalog/{agent_id}/{timestamp}_{random}.{ext}`. Upload via `supabase.storage.from('helpdesk-media').upload(path, file)`. URL publica gerada automaticamente. Armazenado como `TEXT[]` no campo `ai_agent_products.images`. Aceita: `image/webp, image/png, image/jpeg`. Max 5MB. Featured = primeiro item do array (reorder para promover). Grid: 4-5 colunas responsivo, aspect-ratio quadrado.

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

## 5.8 Categorias e Subcategorias

**O que e:** Cada produto tem uma **categoria** (agrupamento principal) e uma **subcategoria** (agrupamento secundario). Nao sao pre-definidas — o admin digita livremente e o sistema agrupa automaticamente.

**Exemplos:**
- Categoria "Tintas" → Subcategoria "Coral", "Suvinil", "Iquine"
- Categoria "Ferramentas" → Subcategoria "Furadeiras", "Parafusadeiras"
- Categoria "Eletrica" → Subcategoria "Fios", "Disjuntores"

**Uso pratico:**
- Filtro de categoria na tabela de produtos
- A IA usa categorias para aplicar tags automaticamente (`interesse:tintas`)
- Busca inclui categoria e subcategoria (lead que pede "coral" encontra produtos com subcategoria "Coral")

> **Tecnico:** Campos `category` TEXT e `subcategory` TEXT na tabela `ai_agent_products`. Sem tabela de categorias separada — texto livre. Filtro dinamico: frontend extrai categorias unicas dos produtos e popula dropdown. Indice: `idx_ai_products_category` (category, subcategory). Tag auto: AI Agent extrai categoria do primeiro resultado → tag `interesse:{category}`.

---

## 5.9 Integracao com Bio Link

**O que e:** Os botoes do Bio Link (pagina de links estilo Linktree) podem apontar para produtos do catalogo. Quando o admin cria um botao do tipo "Catalogo", ele seleciona um produto da lista e o botao mostra foto + nome + preco.

**Cenario:** Bio Link da loja tem botao "Produto Destaque" que mostra "Tinta Coral Branco 18L — R$ 289,90" com a foto do produto. Lead clica → abre WhatsApp com mensagem pre-escrita sobre aquele produto.

> **Tecnico:** Hook `useCatalogProductsForBio()` carrega produtos do agente. Campo `bio_buttons.catalog_product_id` UUID FK → `ai_agent_products.id`. Botao tipo 'catalog' renderiza: title, price (formatted), currency, image_url (primeiro do array images). Pre-message inclui `[catalog:{product_title}]` para contexto do AI Agent.

---

## 5.10 Descricao Gerada por IA

**O que e:** Ao cadastrar um produto, o admin pode clicar num botao de **varinha magica** para gerar automaticamente uma descricao comercial do produto. A IA usa o nome, categoria, subcategoria e preco para escrever 2-3 frases persuasivas em portugues.

**Cenario:** Admin cadastra "Furadeira Bosch GSB 550 RE" categoria "Ferramentas" preco R$ 379,90 → clica varinha → IA gera: "Furadeira de impacto Bosch GSB 550 RE com 550W de potencia, ideal para trabalhos em alvenaria, madeira e metal. Mandril de 1/2' com sistema de aperto rapido. Leve e ergonomica para uso prolongado." → admin confere e salva.

> **Tecnico:** Botao `Sparkles` ao lado do textarea de descricao em `CatalogProductForm.tsx`. Chama Gemini 2.5 Flash via `system_settings.GEMINI_API_KEY` (nao Deno.env). Prompt: "Escreva uma descricao comercial de 2-3 frases em portugues para: {title}, categoria {category}, subcategoria {subcategory}, preco R$ {price}". Temperature 0.7, max_tokens 200. Resultado inserido no textarea (editavel).

---

## Arvore de Componentes

```
AIAgentCatalog.tsx (pagina — /dashboard/ai-agent/catalog)
+-- Seletor de agente (dropdown)
+-- CatalogConfig.tsx (orquestrador principal)
    +-- Toolbar: busca + filtros + novo produto + CSV + batch
    +-- CatalogTable.tsx (grade de cards)
    |   +-- Card de produto (foto, nome, preco, badges)
    |   +-- Checkbox selecao
    |   +-- Hover: Edit + Delete
    |   +-- Bulk actions bar (ativar/desativar/excluir)
    +-- CatalogProductForm.tsx (dialog modal)
    |   +-- Campos: nome, categoria, subcategoria, preco, SKU, descricao
    |   +-- Botao IA descricao (varinha magica)
    |   +-- Zona de upload de imagens (drag & drop)
    |   +-- Grade de fotos (featured, excluir)
    |   +-- Secao "Importar de URL" (colapsavel, so para novos)
    |   +-- Toggles: em estoque, ativado
    +-- CsvProductImport.tsx (wizard 4 passos)
    |   +-- Upload → Mapeamento → Importando → Resultado
    +-- BatchScrapeImport.tsx (scraping em lote)
        +-- Input URL → Scanning → Processing → Resultado
```

---

## Tabelas do Banco

| Tabela | O que guarda |
|--------|--------------|
| `ai_agent_products` | Produtos (title, price, description, images[], category, subcategory, sku, in_stock, enabled) |
| `scrape_jobs` | Jobs de scraping em lote (status, progress, total, imported, errors, found_links) |

**Indices especiais para busca fuzzy:**
- `idx_ai_agent_products_title_trgm` (GIN pg_trgm no titulo)
- `idx_ai_agent_products_description_trgm` (GIN pg_trgm na descricao)
- `idx_ai_agent_products_category_trgm` (GIN pg_trgm na categoria)

---

## Links Relacionados

- [[wiki/casos-de-uso/ai-agent-detalhado]] — Como a IA usa o catalogo (tools search_products, send_carousel, send_media)
- [[wiki/casos-de-uso/helpdesk-detalhado]] — Onde as conversas acontecem (carrosseis aparecem aqui)
- [[wiki/modulos]] — Todos os 17 modulos
- [[wiki/banco-de-dados]] — Esquema completo do banco

---

*Documentado em: 2026-04-10 — Sessao de documentacao detalhada com George Azevedo*
*Padrao dual: didatico (leigos) + tecnico (devs) em cada secao*
