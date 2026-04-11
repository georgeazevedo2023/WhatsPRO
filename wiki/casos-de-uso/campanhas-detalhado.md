---
title: Campanhas UTM — Documentacao Detalhada de Todas as Sub-Funcionalidades
tags: [campanhas, utm, tracking, landing, qrcode, atribuicao, detalhado]
sources: [src/components/campaigns/, src/pages/dashboard/Campaigns.tsx, supabase/functions/go/]
updated: 2026-04-10
---

# Campanhas UTM — Rastreamento de Links e Landing Pages (12 Sub-Funcionalidades)

> As Campanhas UTM sao **links rastreaveis** que voce compartilha no Instagram, Google, panfletos ou qualquer lugar. Quando alguem clica, o sistema registra de onde veio, mostra uma **landing page** com countdown (ou formulario), e redireciona para o WhatsApp. A conversa ja chega **tagueada** com o nome da campanha, e a IA sabe de qual promocao o lead veio.
>
> Pense numa campanha assim: voce posta no Instagram "Clique no link da bio!". O link leva para uma pagina bonita com logo e countdown 3 segundos, e depois abre o WhatsApp com mensagem pre-escrita. No CRM, voce sabe exatamente quantas pessoas clicaram, quantas mandaram mensagem, e quantas compraram — tudo separado por campanha.
>
> Sem campanhas UTM, todos os leads parecem iguais — voce nao sabe se vieram do Instagram, do Google, do panfleto ou de indicacao. Com campanhas, **cada canal tem seu proprio link** e voce mede o retorno de cada um.
>
> Ver tambem: [[wiki/casos-de-uso/helpdesk-detalhado]] (conversas tagueadas), [[wiki/casos-de-uso/ai-agent-detalhado]] (contexto campanha no prompt), [[wiki/casos-de-uso/formularios-detalhado]] (formularios na landing)

---

## 7.1 Criacao de Campanha

**O que e:** O admin cria uma campanha preenchendo um formulario com nome, tipo, destino WhatsApp, mensagem de boas-vindas, instrucoes para IA, e configuracoes de landing page.

**Campos do formulario:**
- **Nome** — ex: "Promo Dia das Maes 2026"
- **Slug** — identificador na URL, gerado automaticamente (ex: `promo-dia-maes-2026`)
- **Instancia WhatsApp** — qual numero vai receber as conversas
- **Telefone destino** — preenchido automaticamente da instancia
- **Mensagem de boas-vindas** — texto pre-escrito que aparece no WhatsApp (ex: "Oi! Vi a promo do Dia das Maes")
- **Tipo de campanha** — Venda, Suporte, Promocao, Evento, Reativacao, Fidelizacao
- **Instrucao para IA** — template carregado automaticamente do tipo + texto customizado
- **Modo landing** — Redirect (countdown 3s) ou Formulario (coleta dados antes)
- **Formulario** — se modo=formulario, escolhe qual formulario usar
- **Board Kanban** — opcionalmente, criar card automatico quando lead converte
- **Data inicio** — campanha so ativa a partir dessa data
- **Data expiracao** — campanha desativa automaticamente apos essa data
- **Status** — Ativa (verde), Pausada (amarelo), Arquivada

**Cenario real:** Gerente de marketing cria campanha "Promo Agosto" tipo "Promocao" → seleciona instancia "Vendas" → escreve mensagem "Oi! Quero aproveitar a promo de agosto!" → define inicio 01/08 e expiracao 31/08 → salva → recebe link e QR code prontos para compartilhar.

> **Tecnico:** Componente `CampaignForm.tsx`. Tabela `utm_campaigns` (name, slug UNIQUE, instance_id TEXT FK, status, utm_source/medium/campaign/term/content, destination_phone, welcome_message, campaign_type, ai_template, ai_custom_text, landing_mode, form_slug, kanban_board_id UUID FK, starts_at, expires_at). Templates em `src/data/campaignTemplates.ts` (6 tipos com template auto-populado). Slug: lowercase + NFD normalize + regex non-alnum → dash + max 40 chars.

---

## 7.2 Link Rastreavel e QR Code

**O que e:** Cada campanha gera automaticamente um **link unico** e um **QR Code** que voce compartilha. Quando alguem clica ou scaneia, o sistema registra a visita.

**Link gerado:** `https://[SUPABASE_URL]/functions/v1/go?c=promo-agosto`

**QR Code:**
- Gerado automaticamente como imagem PNG
- Botao de download para salvar como arquivo
- Pode ser impresso em panfletos, cartoes, banners
- Tamanho configuravel (padrao 256px)

**Cenario real:** Loja imprime QR code no balcao: "Escaneie e ganhe 10% de desconto!" → cliente scaneia → abre landing page → WhatsApp → conversa ja tagueada com `campanha:promo-balcao`.

> **Tecnico:** Link: `buildTrackingUrl(slug)` em `useCampaigns.ts`. QR: componente `CampaignQrCode.tsx` usa biblioteca `qrcode` (npm), export como PNG. Preview do link: `CampaignLinkPreview.tsx` com copy-to-clipboard.

---

## 7.3 Landing Page (Countdown ou Formulario)

**O que e:** Quando o lead clica no link, chega numa **pagina intermediaria** antes do WhatsApp. Essa pagina pode ser de 2 tipos:

### Modo Redirect (Countdown)
- Tela escura com logo do WhatsApp
- Nome da campanha
- Contador 3... 2... 1... ✓
- Spinner animado
- Apos 3 segundos, redireciona automaticamente para WhatsApp
- Botao manual "Abrir WhatsApp" se quiser pular
- Captura dados do dispositivo em background (tela, idioma, timezone)

### Modo Formulario
- Mesma tela, mas com um **formulario** antes do WhatsApp
- Lead preenche nome, telefone, e campos customizados
- Validacao em tempo real (CPF, email, CEP, telefone)
- Ao enviar, cria lead + submission + card no Kanban automaticamente
- Redireciona para WhatsApp 1.5 segundos apos sucesso
- Rastreia abandono de formulario (se comecou mas nao terminou)

**Cenario real (redirect):** Post no Instagram → lead clica → ve countdown 3s → WhatsApp abre com mensagem "Oi! Quero a promo de agosto!" → conversa tagueada.

**Cenario real (formulario):** Anuncio no Google → lead clica → preenche nome, email, interesse → clica enviar → lead criado no CRM → WhatsApp abre → IA ja sabe nome e interesse.

> **Tecnico:** Pagina `CampaignRedirect.tsx`, rota `/r` (publica, sem auth). Params: `n` (name), `wa` (WhatsApp URL), `ref` (ref_code), `p` (POST URL), `mode` (redirect|form), `fs` (form_slug). Redirect: countdown 3s com setInterval, auto-redirect via window.location. Form: carrega definicao via `form-public?slug=X`, renderiza `LandingForm.tsx` (validacao CPF checksum, email regex, phone 10+ digits, CEP 8 digits). Captura client-side: screen_width, screen_height, language, timezone via POST async ao `go`. Abandono: flag `form_started` no metadata ao interagir com primeiro campo.

---

## 7.4 Fluxo de Redirect Completo

**O que e:** A sequencia tecnica completa desde o clique ate o WhatsApp:

```
1. Lead clica no link (Instagram, Google, QR Code)
   ↓
2. Edge function "go" recebe a requisicao
   ↓
3. Valida: campanha ativa? Dentro do periodo? Nao expirou?
   ↓
4. Gera ref_code unico (8 caracteres) e registra visita
   ↓
5. Redireciona (302) para pagina landing /r com parametros
   ↓
6. Landing page:
   - Modo redirect → countdown 3s → redireciona para wa.me
   - Modo formulario → formulario → submit → redireciona para wa.me
   ↓
7. WhatsApp abre com mensagem pre-escrita + ref_code
   ↓
8. Lead envia mensagem → webhook detecta ref_code → vincula visita ao contato
   ↓
9. Conversa tagueada com campanha:NOME → IA recebe contexto da campanha
```

> **Tecnico:** Edge function `supabase/functions/go/index.ts`. GET com `?c=SLUG`. Validacao: status='active' + starts_at <= now + expires_at >= now. Se falhar: retorna 410 (Gone). ref_code: 8 chars alfanumericos (A-Z, a-z, 2-9, sem ambiguos 0/O/1/l/I). INSERT em `utm_visits` (campaign_id, ref_code, visitor_ip, user_agent, referrer, status='visited'). Redirect 302 para `crm.wsmart.com.br/r?n=X&wa=X&ref=X&p=X&mode=X&fs=X`. WhatsApp URL: `wa.me/{phone}?text={welcome_message} ref_{refCode}`.

---

## 7.5 Metricas e Analytics

**O que e:** Cada campanha tem um painel de metricas mostrando desempenho em tempo real.

**KPIs (cartoes no topo):**
- **Visitas totais** — quantas vezes o link foi clicado
- **Conversoes** — quantos leads mandaram mensagem (status='matched')
- **Taxa de conversao** — visitas ÷ conversoes (%)
- **Expirados** — visitas que nao converteram

**Metricas de formulario (se landing_mode=form):**
- **Iniciaram formulario** — quantos comecaram a preencher
- **Completaram** — quantos enviaram
- **Abandonaram** — comecaram mas nao terminaram
- **Taxa de completacao** — completaram ÷ iniciaram (%)

**Grafico diario:** Grafico de area com visitas e conversoes por dia (ultimos 30 dias).

**Cenario:** Gerente abre campanha "Promo Agosto" → ve: 450 visitas, 120 conversoes (26.7%), grafico mostra pico no dia 15 (post viral). Campanha com formulario: 200 iniciaram, 150 completaram (75%), 50 abandonaram.

> **Tecnico:** Componente `CampaignMetrics.tsx`. Hook `useCampaignMetrics`. KPIs: count por status (visited, matched, expired). Abandono: `metadata.form_started === true AND status !== 'matched'`. Grafico: Recharts AreaChart, grouped by day, 30 dias. Calculo client-side a partir do array de visitas.

---

## 7.6 Atribuicao Automatica (Tags)

**O que e:** Quando um lead converte (manda mensagem apos clicar no link), a conversa recebe automaticamente tags que identificam de qual campanha veio.

**Tags aplicadas:**
- `campanha:promo-agosto` — nome da campanha
- `formulario:orcamento` — se veio pelo formulario
- `origem:campanha` — canal de origem
- `funil:venda-agosto` — se a campanha faz parte de um funil

**Guards de atribuicao (protecoes):**
- So atribui se campanha esta `active` (pausadas/arquivadas nao tagueiam)
- So atribui se `expires_at` nao passou (expiradas nao tagueiam)
- Previne atribuicao retroativa a campanhas inativas

> **Tecnico:** Tags aplicadas em form-public (POST submission) e whatsapp-webhook (match ref_code). Guards no webhook: `campaign.status === 'active' AND (!expires_at OR expires_at > now())`. Tags via `mergeTags()` em agentHelpers.ts.

---

## 7.7 Contexto IA da Campanha

**O que e:** Quando o lead chega pela campanha, o agente IA recebe automaticamente o **contexto daquela campanha** no seu prompt. Assim, a IA sabe qual promocao mencionar, qual codigo de desconto usar, e qual tom adotar.

**O que a IA recebe:**
```
<campaign_context>
Este lead chegou pela campanha "Promo Dia Pais" (tipo: promocao).
Origem: instagram / social
Instrucao: Destaque a oferta, crie urgencia, apresente o combo especial.
Detalhes: Combo Dia dos Pais 20% OFF. Codigo PAIS20. Valido ate 15/08.
Adapte seu atendimento ao contexto desta campanha.
</campaign_context>
```

**Cenario:** Lead clica no link da campanha "Dia dos Pais" → manda "oi" → IA responde: "Ola! Vi que voce se interessou pela nossa promocao do Dia dos Pais! Temos um combo especial com 20% de desconto usando o codigo PAIS20. Quer ver os produtos?"

> **Tecnico:** AI Agent detecta tag `campanha:NAME` → query `utm_campaigns` por name + instance_id → monta bloco `<campaign_context>` com campaign_type, utm_source, utm_medium, ai_template, ai_custom_text → injeta no system prompt. Componente admin: `CampaignAiTemplate.tsx` com template auto-load por tipo + textarea custom.

---

## 7.8 Clone de Campanha

**O que e:** Botao "Clonar" que cria uma copia da campanha com todos os campos preenchidos, pronta para ajustar e ativar.

**O que a copia recebe:**
- Nome: "Promo Agosto (copia)"
- Slug: novo (gerado automaticamente)
- Status: Pausada (nao ativa imediatamente)
- Datas: limpas (sem inicio nem expiracao)
- Todos os outros campos identicos ao original

**Cenario:** Campanha de agosto deu certo. Gerente clona → muda nome para "Promo Setembro" → ajusta datas → ativa. Em 2 minutos, nova campanha pronta.

> **Tecnico:** Handler em `CampaignTable.tsx`. Copia todos os campos exceto id, created_at, updated_at. Nome: `${original.name} (copia)`. Slug: auto-gerado. Status: 'paused'. starts_at/expires_at: null. Navega para edit da copia.

---

## 7.9 Visitas com Paginacao e Metadados

**O que e:** Lista detalhada de todas as visitas da campanha, com dados do dispositivo do lead.

**Dados de cada visita:**
- Data e hora da visita
- Status: Visitou / Converteu / Expirou
- IP do visitante
- Navegador e sistema operacional (User-Agent)
- De onde veio (Referrer — Instagram, Google, etc.)
- **Metadados do dispositivo:** largura e altura da tela, idioma, timezone

**Paginacao:** 50 visitas por pagina com botoes anterior/proximo.

> **Tecnico:** Hook `useCampaignVisits` com paginacao por range query (page * 50, from + 50). Tabela `utm_visits` (campaign_id, ref_code UNIQUE, visitor_ip, user_agent, referrer, contact_id FK, conversation_id FK, matched_at, status, visited_at, metadata JSONB). Metadata: screen_width, screen_height, language, timezone, form_started, form_started_at.

---

## 7.10 Leads da Campanha

**O que e:** Secao no detalhe da campanha mostrando todos os leads que converteram (mandaram mensagem), com nome, telefone, email e data de conversao.

**Exibe ate 20 leads recentes** com:
- Avatar + nome + telefone (do contato)
- Nome completo (do lead_profiles)
- Email (do lead_profiles)
- Data/hora da conversao

> **Tecnico:** Secao `CampaignLeadsSection` em `CampaignDetail.tsx`. Query: `utm_visits` WHERE status='matched' AND contact_id NOT NULL, JOIN contacts + lead_profiles. Order by matched_at DESC, limit 20.

---

## 7.11 6 Tipos de Campanha (Templates)

**O que e:** Ao criar, o admin escolhe o tipo e o sistema pre-preenche as instrucoes para a IA.

| Tipo | Foco | O que a IA faz |
|------|------|---------------|
| **Venda** | Conversao | Apresenta produto, qualifica, fecha venda |
| **Suporte** | Resolver problema | Identifica problema, empatia, encaminha |
| **Promocao** | Destacar oferta | Menciona desconto, cria urgencia, converte |
| **Evento** | Confirmar participacao | Detalhes do evento, confirma inscricao |
| **Reativacao** | Trazer de volta | Saudacao calorosa, incentivo, reconquistar |
| **Fidelizacao** | Manter cliente | Beneficios exclusivos, agradecer, relacionamento |

> **Tecnico:** Templates em `src/data/campaignTemplates.ts`. Cada tipo tem `description` e `template` (texto longo com instrucoes para IA). Auto-loaded em `CampaignAiTemplate.tsx` quando tipo selecionado. Campo `ai_custom_text` para detalhes adicionais.

---

## 7.12 Gestao de Status

**O que e:** Cada campanha tem um status que controla se ela esta operacional.

- **Ativa** (verde) — Link funciona, visitas sao registradas, conversas sao tagueadas
- **Pausada** (amarelo) — Link retorna erro 410 (campanha inativa), nenhuma visita registrada
- **Arquivada** — Escondida da lista, dados preservados

**Toggle rapido:** Na tabela de campanhas, menu com opcao "Pausar" / "Ativar" para alternar rapidamente.

> **Tecnico:** Campo `utm_campaigns.status` (active|paused|archived). Toggle: mutation `useUpdateCampaign({ id, status })`. Guard no `go`: `if (campaign.status !== 'active') return 410`. Badge de cor no `CampaignTable.tsx`.

---

## Arvore de Componentes

```
Campaigns.tsx (lista — /dashboard/campaigns)
+-- CampaignTable.tsx (tabela com metricas, acoes)
    +-- Clone, toggle status, delete, edit

CampaignCreate.tsx (criar/editar — /dashboard/campaigns/new)
+-- CampaignForm.tsx (formulario completo)
    +-- CampaignAiTemplate.tsx (tipo + instrucoes IA)

CampaignDetail.tsx (detalhe — /dashboard/campaigns/:id)
+-- CampaignMetrics.tsx (KPIs + grafico diario)
+-- CampaignQrCode.tsx (QR code + download)
+-- CampaignLinkPreview.tsx (link + copy)
+-- Tabela de visitas (paginada, 50/pagina)
+-- CampaignLeadsSection (leads convertidos)

CampaignRedirect.tsx (landing page — /r publica)
+-- RedirectView (countdown 3s → WhatsApp)
+-- FormView (LandingForm → submit → WhatsApp)
    +-- LandingForm.tsx (campos dinamicos + validacao)
```

---

## Tabelas do Banco

| Tabela | O que guarda |
|--------|--------------|
| `utm_campaigns` | Campanhas (name, slug, type, status, landing_mode, ai_template, starts_at, expires_at) |
| `utm_visits` | Visitas (ref_code, visitor_ip, user_agent, contact_id, status, metadata JSONB) |

---

## Links Relacionados

- [[wiki/casos-de-uso/formularios-detalhado]] — Formularios usados na landing page
- [[wiki/casos-de-uso/ai-agent-detalhado]] — Contexto campanha injetado no prompt
- [[wiki/casos-de-uso/leads-detalhado]] — Leads criados automaticamente
- [[wiki/casos-de-uso/helpdesk-detalhado]] — Conversas tagueadas no helpdesk
- [[wiki/modulos]] — Todos os 17 modulos

---

*Documentado em: 2026-04-10 — Padrao dual (didatico + tecnico)*
