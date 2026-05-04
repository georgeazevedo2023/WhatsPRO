---
title: Bio Link — Captacao, Analytics e Integracoes
tags: [bio, link, captacao, leads, analytics, ia, funis, formularios, catalogo, detalhado]
sources: [src/components/bio/, src/pages/BioPage.tsx, supabase/functions/bio-public/]
updated: 2026-05-04
---

# Bio Link — Captacao e Operacao (6 Sub-Funcionalidades)

> Esta sub-wiki cobre **a parte de operacao** do Bio Link: captacao de leads, metricas, contexto injetado na IA e integracoes com funis, formularios e catalogo.
>
> Para criacao de pagina, tipos de botao, renderizacao publica e gestao de status, ver [[wiki/casos-de-uso/bio-link-configuracao]].
>
> Indice geral: [[wiki/casos-de-uso/bio-link-detalhado]].

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

## Links Relacionados

- [[wiki/casos-de-uso/bio-link-detalhado]] — Indice geral do Bio Link
- [[wiki/casos-de-uso/bio-link-configuracao]] — Criacao, botoes, renderizacao e status
- [[wiki/casos-de-uso/ai-agent-detalhado]] — IA recebe bio_context no prompt
- [[wiki/casos-de-uso/formularios-detalhado]] — Formularios embutidos no Bio Link
- [[wiki/casos-de-uso/leads-detalhado]] — Leads criados com badge "Bio" (verde)

---

*Documentado em: 2026-04-10 — Particionado em: 2026-05-04*
