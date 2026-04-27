---
title: Bio Link — Documentacao Detalhada de Todas as Sub-Funcionalidades
tags: [bio, link, linktree, captacao, leads, analytics, detalhado]
sources: [src/components/bio/, src/pages/BioPage.tsx, supabase/functions/bio-public/]
updated: 2026-04-27
---

# Bio Link — Pagina de Links Estilo Linktree (10 Sub-Funcionalidades)

> O Bio Link e uma **pagina publica de links** — como o Linktree, mas integrada ao CRM. Voce cria uma pagina bonita com logo, descricao e botoes que direcionam para WhatsApp, formularios, redes sociais, produtos do catalogo ou qualquer URL. O lead acessa, clica num botao, e o sistema registra tudo: de onde veio, o que clicou, e cria o lead automaticamente.
>
> Pense no link que voce coloca na bio do Instagram: "linktr.ee/suaempresa". Aqui, em vez de usar Linktree (que so tem links), voce tem uma pagina que **captura leads**, **injeta contexto na IA**, e **rastreia cliques** — tudo integrado ao seu CRM.
>
> Ver tambem: [[wiki/casos-de-uso/campanhas-detalhado]] (campanhas ligadas ao bio), [[wiki/casos-de-uso/formularios-detalhado]] (formularios no bio), [[wiki/casos-de-uso/leads-detalhado]] (leads criados pelo bio)
>
> **Galeria de referencia (design):** `docs/referencia/bio-link-galeria-10-modelos.html` — 10 modelos profissionais (Corretor de Imoveis, Advocacia, Personal Trainer, etc.) gerados como inspiracao para futuros templates por nicho. Abrir no navegador para ver. Pode servir de ponto de partida para implementar a melhoria #1 do Bio Link (templates customizaveis por nicho).

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

## 9.4 Captacao de Leads (Formulario Inline)

**O que e:** A pagina pode ter um **mini-formulario embutido** que aparece antes do lead clicar em qualquer botao. Campos configuraveis: nome, telefone, email. Ao preencher, o lead e criado automaticamente no CRM.

**Configuracao (pelo admin):**
- Ativar/desativar captacao
- Escolher quais campos mostrar (nome, telefone, email)
- Titulo do formulario (ex: "Cadastre-se para ofertas exclusivas")
- Texto do botao (ex: "Enviar")

**O que acontece ao preencher:**
1. Dados enviados para edge function bio-public (action=capture)
2. Contato criado (upsert por telefone)
3. Perfil de lead criado com origin='bio'
4. Registro salvo em bio_lead_captures
5. Se a pagina pertence a um funil, conversa tagueada com `funil:SLUG`

> **Tecnico:** Campos `bio_pages.capture_enabled` (bool), `capture_fields` (text[] — quais campos), `capture_title`, `capture_button_label`. Componente `BioLeadCaptureModal.tsx` (dialog com inputs). POST bio-public action='capture' → `upsertContactFromPhone()` + `upsertLeadFromFormData()` via leadHelper.ts. Tabela `bio_lead_captures` (bio_page_id, bio_button_id, contact_id FK, name, phone, email, extra_data JSONB). Se funnel linked: tag `funil:SLUG` na conversa mais recente.

---

## 9.5 Analytics (Visualizacoes, Cliques, Leads)

**O que e:** Painel de metricas no dashboard mostrando desempenho de cada pagina Bio Link.

**KPIs:**
- **Visualizacoes** — quantas vezes a pagina foi acessada
- **Cliques** — total de cliques em botoes
- **Leads** — quantos preencheram o formulario de captacao
- **CTR** — taxa de cliques (cliques ÷ visualizacoes %)

**Tabela por pagina:** Cada pagina mostra seus numeros individuais. CTR com cor: verde (≥20%), amarelo (≥10%), cinza (<10%).

> **Tecnico:** Hook `useBioAnalytics(instanceId)` em useBioPages.ts. Agrega: view_count (bio_pages), click_count (sum bio_buttons), leads (count bio_lead_captures). CTR: clicks/views*100. UI: BioLinksPage tab Analytics com 3 KPI cards + tabela.

---

## 9.6 Contexto IA (Bio Context)

**O que e:** Quando o lead clica num botao WhatsApp do Bio Link, a IA recebe automaticamente o contexto de **qual pagina** e **qual botao** o lead clicou.

**Como funciona:**
- Mensagem pre-escrita inclui tag invisivel: `[bio:minha-loja|Orcamento]`
- Webhook detecta a tag e aplica tags: `origem:bio` + `bio_page:minha-loja`
- AI Agent carrega dados da bio page e injeta no prompt como `<bio_context>`
- Se `ai_context_enabled`, template customizado e interpolado: `{page_title}`, `{button_label}`

**Cenario:** Lead clica "Solicitar Orcamento" no Bio Link → WhatsApp abre com "Oi! Quero um orcamento [bio:loja|Orcamento]" → IA recebe contexto: "Este lead veio da pagina Bio 'Loja Eletropiso', botao 'Solicitar Orcamento'" → responde: "Ola! Vi que voce quer um orcamento. Pode me dizer qual servico precisa?"

> **Tecnico:** Tag: `[bio:slug|label]` appended ao pre_message em BioPage.tsx. Deteccao: webhook parse do tag pattern. Tags: `origem:bio`, `bio_page:SLUG`. AI Agent: detecta tag `bio_page:X` → query bio_pages → injeta `<bio_context>`. Campos: ai_context_enabled, ai_context_template com vars `{page_title}`, `{button_label}`.

---

## 9.7 Integracao com Funis

**O que e:** Cada Bio Link pode fazer parte de um **funil** (M16). Quando o lead interage com um Bio Link vinculado a um funil, ele entra automaticamente no funil.

**O que acontece:**
- Lead capturado pelo Bio Link
- Conversa tagueada com `funil:SLUG` automaticamente
- IA recebe contexto do funil (funnel_prompt)
- Card criado no Kanban do funil
- Metricas do Bio Link aparecem na tab "Canais" do FunnelDetail

> **Tecnico:** FK `funnels.bio_page_id` → bio_pages.id. bio-public: se bio_page pertence a funnel ativo, tag `funil:SLUG` na conversa. FunnelDetail tab Canais: exibe bio views/clicks/leads/CTR. Wizard auto-cria bio page com defaults do tipo de funil.

---

## 9.8 Integracao com Formularios

**O que e:** Botoes do tipo "Formulario" redirecionam o lead para preencher um formulario (da landing page) antes de abrir o WhatsApp.

**Fluxo:** Clica no botao → landing page com formulario → preenche → WhatsApp abre → IA ja sabe os dados.

**Atribuicao:** A URL passa `bio_page=SLUG&bio_btn=ID` para o form-public, que seta `origin='bio'` + tags no lead.

> **Tecnico:** Botao type='form' com form_slug. Redirect para `/r?mode=form&fs=SLUG&bio_page=SLUG&bio_btn=ID`. form-public detecta bio_page param e seta origin='bio' + tags `origem:bio` + `bio_page:SLUG`. Componente: BioButtonEditor com select de forms disponiveis.

---

## 9.9 Integracao com Catalogo

**O que e:** Botoes do tipo "Catalogo" mostram um produto da loja com foto, nome e preco. Ao clicar, abre o WhatsApp com mensagem sobre aquele produto.

**Cenario:** Botao "Produto Destaque" mostra foto da "Tinta Coral 18L — R$ 289,90". Lead clica → WhatsApp abre com "Oi! Quero saber mais sobre a Tinta Coral 18L" → IA ja sabe qual produto.

> **Tecnico:** Campo `bio_buttons.catalog_product_id` UUID FK → ai_agent_products. Hook `useCatalogProductsForBio()` carrega produtos. Resolve: title, price, currency, images[0]. Pre-message: `[catalog:{product_title}]`. BioButtonEditor: select dropdown de produtos.

---

## 9.10 Gestao e Status

**O que e:** Cada pagina Bio Link tem status e acoes de gestao.

- **Ativa** — pagina acessivel publicamente
- **Rascunho** — em edicao, nao acessivel
- **Arquivada** — escondida do dashboard

**Acoes:** Copiar link, editar, excluir, ver analytics.

> **Tecnico:** Campo `bio_pages.status` (active/draft/archived). BioLinkCard: copy link (clipboard), edit (abre BioLinkEditor), delete (confirmacao). Lista: BioLinksPage com search por titulo/slug + filtro por instancia.

---

## Arvore de Componentes

```
BioLinksPage.tsx (admin — /dashboard/bio)
+-- Tab Paginas: lista + search + novo
|   +-- BioLinkCard.tsx (cada pagina)
|   +-- BioLinkEditor.tsx (Sheet — criacao/edicao)
|       +-- TemplateSelector.tsx (3 templates)
|       +-- BioButtonEditor.tsx (modal por botao)
|       +-- Captacao config (campos, titulo, botao)
|       +-- AI Context config (toggle + template)
|       +-- BioLinkPreview.tsx (preview live)
+-- Tab Analytics: KPIs + tabela por pagina

BioPage.tsx (publica — /bio/:slug)
+-- Capa + avatar + titulo + descricao
+-- Icones sociais (topo)
+-- Botoes (stack/featured/social_icon)
+-- BioLeadCaptureModal.tsx (formulario inline)
```

---

## Tabelas do Banco

| Tabela | O que guarda |
|--------|--------------|
| `bio_pages` | Paginas (slug, titulo, template, cores, captacao, ai_context, view_count) |
| `bio_buttons` | Botoes (tipo, label, url/phone/form_slug/catalog, scheduling, click_count) |
| `bio_lead_captures` | Leads captados (contact_id, name, phone, email, extra_data) |

---

## Links Relacionados

- [[wiki/casos-de-uso/campanhas-detalhado]] — Campanhas que usam Bio Link
- [[wiki/casos-de-uso/formularios-detalhado]] — Formularios embutidos no Bio Link
- [[wiki/casos-de-uso/leads-detalhado]] — Leads criados com badge "Bio" (verde)
- [[wiki/casos-de-uso/ai-agent-detalhado]] — IA recebe bio_context no prompt
- [[wiki/modulos]] — Todos os 17 modulos

---

*Documentado em: 2026-04-10 — Padrao dual (didatico + tecnico)*
