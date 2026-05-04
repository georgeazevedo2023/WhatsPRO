---
title: Bio Link — Configuracao e Construtor
tags: [bio, link, linktree, templates, botoes, paginas, detalhado]
sources: [src/components/bio/, src/pages/BioPage.tsx, supabase/functions/bio-public/]
updated: 2026-05-04
---

# Bio Link — Configuracao e Construtor (4 Sub-Funcionalidades)

> Esta sub-wiki cobre **a parte de construcao** do Bio Link: como o admin cria a pagina, configura os botoes, como a pagina e renderizada para o lead e como gerenciar status/ciclo de vida.
>
> Para captacao de leads, analytics, contexto IA e integracoes, ver [[wiki/casos-de-uso/bio-link-operacao]].
>
> Indice geral: [[wiki/casos-de-uso/bio-link-detalhado]].

---

## 9.1 Criacao e Edicao de Pagina

**O que e:** O admin cria uma pagina com titulo, descricao, avatar (logo) e escolhe um dos 3 templates visuais. A pagina fica acessivel numa URL publica (ex: `crm.wsmart.com.br/bio/minha-loja`).

**3 templates visuais:**
- **Simples** — fundo escuro (#0f0f0f), botoes verdes preenchidos. Limpo e direto.
- **Shopping** — fundo vermelho escuro (#780016), botoes com contorno. Ideal para lojas.
- **Negocio** — fundo degradê escuro (#1a1a2e→#16213e), botoes suaves. Profissional.

**Personalizacao visual (Phase 2):**
- Cor de fundo (solido ou degradê)
- Cor dos botoes e do texto
- Estilo dos botoes: preenchido, contorno ou suave
- Borda dos botoes: arredondado total (pill), medio ou leve
- Imagem de capa (banner 3:1 acima do avatar)
- Fonte: padrao (sans-serif), serif ou mono
- Espacamento entre botoes: compacto, normal ou largo

**Cenario real:** Loja de materiais cria Bio Link com template "Shopping": logo no topo, descricao "Materiais de construcao com os melhores precos", 5 botoes (WhatsApp, Orcamento, Instagram, Catalogo, Localizacao). Cola o link na bio do Instagram.

> **Tecnico:** Componentes: `BioLinkEditor.tsx` (Sheet form completo), `BioLinkCard.tsx` (card no dashboard), `TemplateSelector.tsx` (3 opcoes), `BioLinkPreview.tsx` (preview live). Tabela `bio_pages` (slug UNIQUE, title, description, avatar_url, template, bg_color, bg_type, bg_gradient_to, button_style, button_radius, button_color, text_color, cover_url, font_family, button_spacing, status, view_count). Templates defaults em `src/types/bio.ts` (linhas 173-199). Pagina admin: `BioLinksPage.tsx`.

---

## 9.2 Os 5 Tipos de Botao

**O que e:** Cada pagina tem botoes que o lead pode clicar. Existem 5 tipos, cada um com comportamento diferente:

| Tipo | O que faz | Exemplo |
|------|-----------|---------|
| **URL** | Abre qualquer link externo | "Nosso Site" → abre empresa.com.br |
| **WhatsApp** | Abre conversa no WhatsApp com mensagem pre-escrita | "Falar com Vendedor" → abre wa.me com "Oi! Vi seu Bio Link" |
| **Formulario** | Abre formulario de coleta de dados | "Solicitar Orcamento" → abre formulario antes do WhatsApp |
| **Social** | Icone de rede social (pequeno, no topo) | Icones de Instagram, TikTok, YouTube, LinkedIn, etc. |
| **Catalogo** | Mostra produto do catalogo com foto e preco | "Tinta Coral 18L — R$ 289,90" com foto do produto |

**Agendamento de botoes (Phase 2):** Cada botao pode ter data/hora de inicio e fim. Botao "Promo Black Friday" so aparece de 25/11 a 30/11. Fora do periodo, fica invisivel automaticamente.

**Layouts de botao:**
- **Stack** — botao horizontal padrao com texto (o mais comum)
- **Featured** — imagem grande 16:9 + barra de titulo (destaque visual)
- **Social Icon** — icone pequeno no topo da pagina (Instagram, TikTok, etc.)

**Cenario:** Pagina com 6 botoes: Instagram (social icon, topo) + TikTok (social icon) + "Falar com Vendedor" (WhatsApp) + "Solicitar Orcamento" (formulario) + "Produto Destaque" (catalogo, featured com foto grande) + "Nosso Site" (URL).

> **Tecnico:** Tabela `bio_buttons` (bio_page_id FK, position INT, label, type ENUM, url, phone, pre_message, whatsapp_tag, form_slug, social_platform ENUM 9 opcoes, catalog_product_id UUID FK, layout ENUM stack/featured/social_icon, thumbnail_url, featured_image_url, starts_at, ends_at, click_count). Componente `BioButtonEditor.tsx` (modal por tipo). WhatsApp tag: `[bio:slug|label]` appended invisivel ao pre_message. Catalog: resolve titulo+preco+imagem do `ai_agent_products`. Scheduling: filtro `starts_at <= now AND ends_at >= now` no `BioPage.tsx`.

---

## 9.3 Pagina Publica (Renderizacao)

**O que e:** A pagina que o lead ve ao acessar o link. URL publica sem login: `crm.wsmart.com.br/bio/minha-loja`.

**O que aparece:**
- Imagem de capa (se configurada)
- Avatar (logo) centralizado
- Titulo e descricao
- Icones de redes sociais (topo)
- Botoes em sequencia vertical (com fotos se featured)
- Formulario de captacao inline (se ativado)

**O que acontece nos bastidores:**
- Incrementa contador de visualizacoes da pagina (view_count)
- Cada clique em botao incrementa contador de cliques (click_count)
- Botoes fora do periodo de agendamento ficam invisiveis

> **Tecnico:** Pagina `src/pages/BioPage.tsx`, rota `/bio/:slug`. Edge function `bio-public/index.ts` (GET `?slug=X` → retorna page + buttons com scheduling filter + catalog products resolvidos, POST action=click → increment click_count). View count: RPC `increment_bio_view()` fire-and-forget. Estilizacao: CSS inline via bg_color, button_color, text_color, font_family, button_spacing.

---

## 9.10 Gestao e Status

**O que e:** Cada pagina Bio Link tem status e acoes de gestao.

- **Ativa** — pagina acessivel publicamente
- **Rascunho** — em edicao, nao acessivel
- **Arquivada** — escondida do dashboard

**Acoes:** Copiar link, editar, excluir, ver analytics.

> **Tecnico:** Campo `bio_pages.status` (active/draft/archived). BioLinkCard: copy link (clipboard), edit (abre BioLinkEditor), delete (confirmacao). Lista: BioLinksPage com search por titulo/slug + filtro por instancia.

---

## Links Relacionados

- [[wiki/casos-de-uso/bio-link-detalhado]] — Indice geral do Bio Link
- [[wiki/casos-de-uso/bio-link-operacao]] — Captacao, analytics, IA e integracoes
- [[wiki/casos-de-uso/campanhas-detalhado]] — Campanhas que usam Bio Link
- [[wiki/casos-de-uso/leads-detalhado]] — Leads criados pelo Bio Link

---

*Documentado em: 2026-04-10 — Particionado em: 2026-05-04*
