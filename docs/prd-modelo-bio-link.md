# PRD — Bio Link (página pública estilo Linktree) — MODELO REUTILIZÁVEL

> Documento-modelo extraído da implementação real do WhatsPRO (módulos M14→M16). Use como base para recriar a feature em outro projeto. Stack de origem: React + Vite + TanStack Query + Tailwind/shadcn no frontend; Supabase (Postgres + RLS + RPC) + Edge Functions (Deno) no backend. Adapte os nomes ao seu projeto.

---

## 1. Visão geral

Páginas públicas tipo "link na bio" (Linktree/Beacons): cada conta/tenant cria páginas com avatar, capa, título, descrição e uma lista de **botões rastreáveis** (link, WhatsApp, formulário, rede social, produto de catálogo). A página pública vive em `/bio/:slug`, conta **views e cliques**, e pode **capturar leads** (nome/telefone/email) vinculando o visitante ao CRM e a um funil.

**Proposta de valor:** transformar tráfego de redes sociais em leads rastreáveis, sem ferramenta externa, com analytics e integração nativa ao CRM/IA.

## 2. Personas e casos de uso

- **Dono/gestor (admin):** cria/edita páginas no painel, escolhe template/cores, adiciona botões, vê analytics.
- **Visitante (público, sem login):** abre `/bio/:slug`, clica num botão, opcionalmente deixa os dados.
- **Vendedor/IA (downstream):** recebe o lead capturado já vinculado a contato + tag de origem (`bio:{slug}`) + funil.

Casos: (1) loja põe o link no Instagram → cliente clica em "Falar no WhatsApp" com mensagem pré-pronta; (2) campanha com captura de lead antes do clique; (3) catálogo de produtos como botões; (4) página de rede social (ícones).

## 3. Escopo

**Inclui:** editor admin (aparência + botões + preview), 3 templates, página pública renderizada, tracking de view/click, captura de lead, analytics (views/clicks/CTR/leads), integração com contatos/funil/IA, agendamento de botões.
**Não inclui (out):** editor de domínio próprio, A/B testing, pixel de terceiros, pagamentos.

---

## 4. Modelo de dados (3 tabelas)

### `bio_pages` (a página)
```
id uuid PK · instance_id text (tenant) · created_by uuid · slug text · title text · description text
avatar_url text · cover_url text                          -- imagens (avatar 400×400, capa 1200×400 3:1)
bg_color text · bg_type ('solid'|'gradient') · bg_gradient_to text   -- fundo
button_style ('filled'|'outline'|'soft') · button_radius ('full'|'lg'|'md') · button_color text · text_color text
font_family ('default'|'serif'|'mono') · button_spacing ('compact'|'normal'|'loose')
template ('simples'|'shopping'|'negocio')
capture_enabled bool · capture_fields jsonb (['name','phone','email']) · capture_title text · capture_button_label text
ai_context_enabled bool · ai_context_template text         -- vars {page_title} {button_label}
view_count int default 0 · status ('active'|'draft'|'archived') · created_at · updated_at
UNIQUE (instance_id, slug)   -- índices: (instance_id), (slug)
```

### `bio_buttons` (botões da página, 1:N)
```
id uuid PK · bio_page_id uuid FK ON DELETE CASCADE · position int · label text
type ('url'|'whatsapp'|'form'|'social'|'catalog')
url text · form_slug text                                  -- url / form
phone text · pre_message text · whatsapp_tag text          -- whatsapp
social_platform text (instagram|tiktok|facebook|youtube|linkedin|whatsapp|twitter|pinterest|telegram)
catalog_product_id uuid                                    -- produto do catálogo
layout ('stack'|'featured'|'social_icon') · thumbnail_url text · featured_image_url text
starts_at timestamptz · ends_at timestamptz                -- agendamento (mostra só na janela)
click_count int default 0 · created_at
índice: (bio_page_id, position)
```

### `bio_lead_captures` (leads capturados)
```
id uuid PK · bio_page_id uuid FK CASCADE · bio_button_id uuid FK SET NULL · contact_id uuid FK SET NULL
name text · phone text · email text · extra_data jsonb · created_at
índices: (bio_page_id), (contact_id)
```

### RLS (Postgres Row Level Security)
- `bio_pages`: admin lê/escreve só as suas (por `instance_id` + papel). Página PÚBLICA NÃO é lida via RLS do cliente — é servida pela edge function (service role).
- `bio_buttons`/`bio_lead_captures`: herdam acesso via `bio_page_id`.

### RPCs (contadores atômicos, SECURITY DEFINER + REVOKE FROM PUBLIC)
- `increment_bio_view(p_bio_page_id uuid)` → `UPDATE bio_pages SET view_count = view_count + 1`.
- `increment_bio_click(p_button_id uuid)` → `UPDATE bio_buttons SET click_count = click_count + 1`.
> Por que RPC: o público não tem permissão de UPDATE direto; a RPC encapsula o incremento e é chamada pela edge fn.

---

## 5. Arquitetura

### 5.1 Painel admin (autenticado)
- **Página de listagem** (`/dashboard/bio-links`): seletor de tenant, abas **Páginas** + **Analytics**, busca, grid de cards. Empty state com CTA "Criar primeira página".
- **Card** por página: avatar, título, `/bio/{slug}`, badges (status + template), `view_count`, ações (Editar / Copiar link / Abrir / menu Arquivar-Excluir).
- **Editor (modal, 3 abas):**
  - **Aparência:** título, slug (auto-slugify), descrição, avatar (upload → bucket `bio-images`, `{userId}/{file}`), **template** (aplica defaults de cor/estilo), cores (fundo/texto/botão/gradiente), capa, fonte, espaçamento, captura de lead (toggle + campos + textos), contexto IA (toggle + template).
  - **Botões:** lista ordenável (↑↓ + drag), editor inline por botão (tipo → campos condicionais), layout (stack/featured/social_icon), agendamento.
  - **Preview:** renderiza a página em tempo real a partir do estado do editor.

### 5.2 Edge function pública `bio-public` (sem JWT)
Um único endpoint que serve a página e recebe eventos:
- **GET `?slug=`** → busca página ativa + botões (ordenados, filtrados por janela de agendamento) + resolve produtos de catálogo; **incrementa view** (fire-and-forget); retorna `{ page, buttons }` JSON.
- **POST `{ button_id }`** → `increment_bio_click`.
- **POST `{ action:'capture', bio_page_id, ... }`** → upsert contato (por telefone) + cria lead (origin `bio`) + insere `bio_lead_captures` + se houver funil vinculado, tagueia a conversa (`funil:{slug}`) → retorna `{ ok, contact_id, funnel_slug }`.

### 5.3 Página pública (`/bio/:slug`)
- Componente que faz `GET` na edge fn e renderiza 1 dos 3 templates.
- **Tracking de clique:** ao clicar, POST `{button_id}` (não bloqueia a navegação) e então executa a ação (abre WhatsApp/URL/form).
- **Captura:** se `capture_enabled`, intercepta o clique (exceto ícones sociais), abre modal de captura, faz POST `capture`, depois executa a ação original.
- **Contexto IA:** se ligado, injeta `{page_title}`/`{button_label}` na `pre_message` do WhatsApp e anexa marcador de origem (`[bio:{slug}|{label}]`).

---

## 6. Funcionalidades detalhadas

### Templates (presets de aparência)
| Template | Fundo | Botões | Avatar |
|---|---|---|---|
| **Simples** | escuro sólido (#0f0f0f) | filled, verde, radius full | redondo |
| **Shopping** | colorido sólido (#780016) | outline, featured link | redondo |
| **Negócio** | gradiente (#1a1a2e→#16213e) | soft, radius lg | quadrado (rounded-xl) |
> Selecionar um template aplica um conjunto de defaults (`TEMPLATE_DEFAULTS`); o usuário pode sobrescrever cor a cor depois.

### Tipos de botão (campos condicionais por tipo)
- **url:** `url`.
- **whatsapp:** `phone` + `pre_message` + `whatsapp_tag` (abre `wa.me` com texto pronto).
- **form:** `form_slug` (redireciona pro formulário interno).
- **social:** `social_platform` (+ `url`) → vira ícone na linha de sociais.
- **catalog:** `catalog_product_id` (puxa imagem/título/preço do catálogo) + fallback url/phone.

### Layouts de botão
- **stack:** pill horizontal (texto + thumbnail 32px opcional).
- **featured:** imagem 16:9 + texto embaixo (destaque).
- **social_icon:** só ícone, na linha de ícones acima dos botões.

### Captura de lead
Toggle por página. Campos configuráveis (`name`/`phone`/`email`), título e label do botão customizáveis. No submit: cria/atualiza contato, registra captura, opcionalmente entra no funil. Depois executa a ação do botão clicado.

### Analytics
KPIs agregados (Total Views, Total Clicks, Total Leads) + tabela por página com **CTR = clicks/views × 100** (cores por faixa: ≥20% verde, ≥10% amarelo, <10% cinza). Calculado client-side a partir de `view_count`, soma de `click_count` e contagem de `bio_lead_captures`.

### Agendamento de botão
`starts_at`/`ends_at` (datetime). Filtragem **na edge fn** (server) E no client — botão só aparece dentro da janela.

---

## 7. Fluxos principais

1. **Criar página:** admin → "Nova página" → preenche aparência → adiciona botões → salva (INSERT `bio_pages` + N `bio_buttons`).
2. **Visita pública:** GET edge fn → render template → view++ → clique → click++ → (captura opcional) → ação (WhatsApp/url/form).
3. **Lead → CRM:** captura → upsert `contacts` + `lead_profiles(origin='bio')` + `bio_lead_captures` + tag de funil na conversa.
4. **Analytics:** agrega views/clicks/leads por página, calcula CTR.

---

## 8. Sequência de build recomendada (faseada)

- **Fase 1 (M14 — núcleo):** tabelas `bio_pages` + `bio_buttons`, RLS, RPCs de contador, editor admin (aparência + botões + preview), página pública, tracking view/click, 3 templates. → feature já útil.
- **Fase 2 (refino visual):** `cover_url`, `font_family`, `button_spacing`, layouts `featured`/`social_icon`, botão `catalog`, agendamento (`starts_at`/`ends_at`).
- **Fase 3 (M15 — leads):** `bio_lead_captures`, captura inline (modal), upsert contato/lead, contexto IA (`ai_context_*`).
- **Fase 4 (M16 — funil):** vínculo `funnels.bio_page_id`, tagueamento automático de conversa na captura.

---

## 9. Decisões de design e lições (do projeto original)

- **Slug único por tenant** (`UNIQUE(instance_id, slug)`) — permite mesmo slug em contas diferentes.
- **Contador via RPC, não UPDATE direto** — o público não tem GRANT de escrita; RPC `SECURITY DEFINER` + `REVOKE EXECUTE FROM PUBLIC` (só a edge fn chama).
- **Página pública por edge function (service role), não RLS de anon** — evita expor a tabela inteira via REST; a fn devolve só o necessário.
- **Tracking de clique não-bloqueante** — dispara o POST e segue pra ação; nunca atrasar a navegação do visitante.
- **Template = preset, não trava** — aplica defaults mas deixa sobrescrever; evita engessar.
- **Filtragem de agendamento nos DOIS lados** (server + client) — server é a verdade; client evita flicker.
- ⚠️ **Rules-of-Hooks:** o guard de permissão (`if (!isSuperAdmin) return <Navigate/>`) tem que vir DEPOIS de todos os hooks do componente — senão crasha ("rendered fewer hooks"). (Bug real corrigido aqui — não repita no projeto novo.)
- **Upload de imagem em bucket dedicado** (`bio-images`, path `{userId}/{file}`, cache 3600s).

## 10. Checklist de implementação (para reuso)

- [ ] Migrations: `bio_pages`, `bio_buttons`, `bio_lead_captures` + índices + RLS + RPCs `increment_bio_view`/`increment_bio_click`.
- [ ] Bucket de imagens (`bio-images`) + helper de upload.
- [ ] Tipos/enums compartilhados (template, button type/style/radius/layout, font, spacing, social platform) + `TEMPLATE_DEFAULTS`.
- [ ] Hooks de dados (list/getWithButtons/create/update/delete page; create/update/delete/reorder button; analytics).
- [ ] Editor admin (3 abas) + card de listagem + seletor de template + preview.
- [ ] Edge fn pública `bio-public` (GET render + POST click + POST capture) sem JWT.
- [ ] Página pública `/bio/:slug` (3 templates) + modal de captura + tracking.
- [ ] Analytics (KPIs + tabela + CTR).
- [ ] (Opcional) vínculo com funil + contexto IA.
