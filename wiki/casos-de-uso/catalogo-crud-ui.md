---
title: Catalogo — CRUD, UI e Geracao de Conteudo
tags: [catalogo, produtos, crud, ui, imagens, categorias, ia]
sources: [src/components/admin/ai-agent/CatalogConfig.tsx, src/components/admin/ai-agent/CatalogTable.tsx, src/components/admin/ai-agent/CatalogProductForm.tsx]
updated: 2026-05-04
---

# Catalogo — CRUD, UI e Geracao de Conteudo (5 Sub-Funcionalidades)

> Esta pagina cobre o **dia a dia de manutencao** do catalogo: como o admin ve a lista de produtos, cria/edita um produto, gerencia fotos, organiza categorias e usa IA para gerar descricoes comerciais. Para importacao em massa veja [[wiki/casos-de-uso/catalogo-importacao]]. Para busca inteligente e integracoes veja [[wiki/casos-de-uso/catalogo-busca-integracoes]].

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
- **Fotos** — zona de upload com drag & drop (ver secao 5.6)

**Geracao de descricao por IA:**
- Clica no botao de varinha magica ao lado do campo de descricao
- O sistema envia nome, categoria, subcategoria e preco para a IA (Gemini 2.5 Flash)
- A IA gera uma descricao comercial de 2-3 frases em portugues
- A descricao e inserida automaticamente no campo (pode ser editada)

**Cenario real:** Admin clica "Novo Produto" → digita "Tinta Coral Branco Fosco 18L" → preco R$ 289,90 → categoria "Tintas" → clica na varinha magica → IA gera: "Tinta acrilica premium Coral Fosco Branco 18L, ideal para paredes internas e externas. Acabamento fosco que proporciona elegancia e durabilidade. Cobertura de ate 400m² por demao." → admin ajusta se necessario → salva.

> **Tecnico:** Componente `CatalogProductForm.tsx`. Dialog modal `95vw sm:max-w-2xl`. Tabela `ai_agent_products` (title NOT NULL, category, subcategory, price DECIMAL(10,2), sku, description, in_stock BOOL, enabled BOOL, images TEXT[], position INT, metadata JSONB). AI description: chama Gemini 2.5 Flash via system_settings.GEMINI_API_KEY, temperature 0.7, max 200 tokens, prompt em portugues. UPSERT: INSERT para novo, UPDATE para editar. Delete: com AlertDialog de confirmacao.

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

## 5.10 Descricao Gerada por IA

**O que e:** Ao cadastrar um produto, o admin pode clicar num botao de **varinha magica** para gerar automaticamente uma descricao comercial do produto. A IA usa o nome, categoria, subcategoria e preco para escrever 2-3 frases persuasivas em portugues.

**Cenario:** Admin cadastra "Furadeira Bosch GSB 550 RE" categoria "Ferramentas" preco R$ 379,90 → clica varinha → IA gera: "Furadeira de impacto Bosch GSB 550 RE com 550W de potencia, ideal para trabalhos em alvenaria, madeira e metal. Mandril de 1/2' com sistema de aperto rapido. Leve e ergonomica para uso prolongado." → admin confere e salva.

> **Tecnico:** Botao `Sparkles` ao lado do textarea de descricao em `CatalogProductForm.tsx`. Chama Gemini 2.5 Flash via `system_settings.GEMINI_API_KEY` (nao Deno.env). Prompt: "Escreva uma descricao comercial de 2-3 frases em portugues para: {title}, categoria {category}, subcategoria {subcategory}, preco R$ {price}". Temperature 0.7, max_tokens 200. Resultado inserido no textarea (editavel).

---

## Links Relacionados

- [[wiki/casos-de-uso/catalogo-detalhado]] — Indice geral do catalogo
- [[wiki/casos-de-uso/catalogo-importacao]] — Importacao por URL, CSV e Batch
- [[wiki/casos-de-uso/catalogo-busca-integracoes]] — Busca fuzzy + Bio Link
- [[wiki/casos-de-uso/ai-agent-detalhado]] — Como a IA usa o catalogo

---

*Particionado em 2026-05-04 a partir de catalogo-detalhado.md*
