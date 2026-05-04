---
title: Campanhas — Criacao & Configuracao
tags: [campanhas, utm, criacao, landing, qrcode, templates, detalhado]
sources: [src/components/campaigns/, src/pages/dashboard/Campaigns.tsx, supabase/functions/go/]
updated: 2026-05-04
---

# Campanhas — Criacao & Configuracao

> Esta sub-wiki cobre tudo que envolve **montar uma campanha**: o formulario inicial, o link rastreavel, o QR Code, a landing page intermediaria, o fluxo tecnico de redirect e os 6 templates de tipo que pre-preenchem instrucoes para a IA.
>
> Ver tambem: [[wiki/casos-de-uso/campanhas-detalhado]] (indice), [[wiki/casos-de-uso/campanhas-tracking]], [[wiki/casos-de-uso/campanhas-operacao]]

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

## Links Relacionados

- [[wiki/casos-de-uso/campanhas-detalhado]] — Indice geral
- [[wiki/casos-de-uso/campanhas-tracking]] — Atribuicao, contexto IA, visitas
- [[wiki/casos-de-uso/campanhas-operacao]] — Metricas, clone, leads, status
- [[wiki/casos-de-uso/formularios-detalhado]] — Formularios usados na landing page
