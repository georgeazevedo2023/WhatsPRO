---
title: Guia Completo de Funcionalidades — WhatsPRO
tags: [funcionalidades, casos-de-uso, guia, integracao]
updated: 2026-04-08
---

# Guia Completo de Funcionalidades — WhatsPRO

> Documentação consolidada de todas as funcionalidades, exemplos integrados e jornadas completas de clientes.
> Gerado em sessão de análise com George Azevedo em 2026-04-08.

---

## 1. Funcionalidades Individuais

### Helpdesk (M2)
Chat em tempo real com leads via WhatsApp. Últimas 50 mensagens + "Load older". Suporta labels, atribuição a atendentes e departamentos. Quick reply via "/", bulk actions (selecionar N conversas → resolver/arquivar/ler em massa), typing indicator, date dividers com timezone-correct (BRAZIL_TZ).

**Uso:** Atendente digita `/proposta` → dropdown de templates → seleciona → envia. Gerente seleciona 20 conversas resolvidas → "Arquivar todas".

### AI Agent (M10)
Agente IA autônomo. LLM primário: OpenAI gpt-4.1-mini. Fallback: Gemini 2.5 Flash → Mistral Small → templates estáticos. 8 ferramentas nativas. Fluxo SDR: termos genéricos → qualifica; termos específicos → busca imediata.

**8 Tools:**
- `search_products` — busca fuzzy no catálogo
- `send_carousel` — carrossel até 5 fotos com copy IA
- `send_media` — imagem, vídeo, áudio, documento
- `handoff_to_human` — transfere para atendente
- `assign_label` — aplica label na conversa
- `set_tags` — tags estruturadas (motivo, interesse, produto)
- `move_kanban` — move card no CRM
- `update_lead_profile` — atualiza dados do lead

**Uso:** Lead manda "quero tinta coral branca 18L" → agente busca, envia foto + preço, responde dúvidas, faz handoff quando necessário.

### Leads Database (M4/M11)
Cards de lead com perfil completo, timeline de jornada, badge de origem (Bio=verde, Campanha=azul, Formulário=roxo, Funil=laranja). Toggle de IA por lead, clear context (reset total). Importação via CSV.

**Uso:** Lead chega pelo Bio Link → badge "Bio" aparece no card → timeline mostra Bio Click → Formulário → Conversa → Kanban.

### CRM Kanban (M5)
Boards com colunas personalizadas, campos custom por board, integração via contact_id FK com leads. TicketResolutionDrawer (4 categorias, move card, aplica tags).

**Uso:** Board "Pipeline de Vendas" com colunas Novo → Proposta → Negociação → Fechado. AI Agent move cards automaticamente.

### Broadcast (M3)
Mensagens em massa para grupos e leads: texto, mídia, carrossel. Agendamento. Copy de carrossel gerada via IA (Groq→Gemini→Mistral).

**Uso:** 300 leads com `causa:animal` recebem foto de evento + áudio motivacional agendados para sexta às 18h.

### Catálogo (M6)
Quick Product Import (URL → scrape → auto-fill). Busca fuzzy pg_trgm. Pipeline: ILIKE → word-by-word → fuzzy → post-filter AND. Corrige erros de digitação.

**Uso:** Cole URL do produto → título, preço, imagem e descrição preenchidos automaticamente. Lead digita "cooral fosco" → agente encontra "Coral Fosco".

### Campanhas UTM (M7)
Links rastreáveis + QR Code. Landing: `redirect` (countdown→WhatsApp) ou `form` (formulário antes do WhatsApp). Atribuição automática via tags. Clone, starts_at, attribution guards. Captura client-side (tela, timezone, idioma).

**Uso:** Link no Instagram → landing 3s → WhatsApp. Conversa já tagueada com `campanha:promo-agosto`. AI Agent usa contexto da campanha.

### Formulários WhatsApp (M12)
Formulários interativos no chat. Trigger: `FORM:slug`. 12 templates. Validação: CPF, email, CEP, scale, select, yes_no, signature. Até 3 retries por campo. Webhook externo ao completar. Auto-tag: `formulario:SLUG` + `origem:formulario`.

**Uso:** Atendente manda `FORM:orcamento` → bot coleta dados no chat → cria lead no CRM automaticamente.

### Bio Link (M14)
Página Linktree-style pública. 3 templates (simples/shopping/negocio). 5 tipos de botão: url, whatsapp, form, social, catalog. Agendamento por botão (starts_at/ends_at). Captação de leads real (contact + lead_profile). Analytics por página e botão.

**Uso:** Bio page com 4 botões. Clique em "Solicitar Orçamento" → formulário → WhatsApp → lead criado com origin='bio'.

### Funis (M16)
Orquestração completa: Campanha + Bio Link + Formulário + Kanban. Wizard 4 passos auto-cria tudo. 7 tipos: sorteio, captacao, venda, vaga, lancamento, evento, atendimento. AI Agent recebe `<funnel_context>`. Handoff: funil > agente. FunnelDetail com KPIs.

**Uso:** Funil "Vaga Motorista" → wizard cria formulário, bio page, campanha, kanban em 1 clique. Candidato clica link → preenche formulário → WhatsApp → agente usa script de RH.

### Agendamentos (M9)
Mensagens agendadas e recorrentes. Templates reutilizáveis. Útil para follow-ups, lembretes, dia de votação.

**Uso:** "Todo domingo às 18h, enviar 'Bom domingo!' para grupo VIP."

### Dashboard de Inteligência (M8)
KPIs, ranking de atendentes (resolution rate, response time), FunnelConversionChart, filtro por funil.

**Uso:** Gerente abre dashboard → vê 5,1% conversion rate do Funil Agosto → identifica melhor atendente da semana.

### Agent QA Framework (M2/v2.0)
Testes E2E automatizados do AI Agent. Batch history, score composto (verde≥80%, amarelo≥60%, vermelho<60%). ApprovalQueue para admin revisar resultados. Ciclo automatizado com detecção de regressão.

**Uso:** Testes automáticos toda segunda. Detecta queda no score de "resposta sobre frete" → badge vermelho → admin corrige no Prompt Studio.

---

## 2. Exemplos de Uso Integrado (10 cenários)

### 1. Campanha UTM + AI Agent + Kanban
Instagram → link rastreável → WhatsApp com tag `campanha:X` → AI Agent usa contexto da campanha → qualifica lead → `move_kanban("Qualificados")` automático.

### 2. Formulário WhatsApp + Lead Profile + CRM
`FORM:orcamento` no chat → bot coleta nome/CPF/CEP/detalhes → lead criado automaticamente → card kanban movido → LeadDetail mostra formulário respondido.

### 3. Bio Link + Formulário Inline + Shadow Mode
Bio page → botão "Orçamento" (tipo form) → formulário preenchido antes do WhatsApp → AI Agent em shadow extrai dados sem perguntar o que já foi coletado.

### 4. Broadcast Carrossel + AI Agent
Gerente cria broadcast 5 produtos → copy gerada por IA por card → enviado para 300 leads → respostas caem no helpdesk com AI Agent ativo.

### 5. AI Agent + Validator + Prompt Studio
Admin edita `product_rules` no Prompt Studio → Validator com rigor "rigoroso" bloqueia respostas que citam concorrentes → ValidatorMetrics mostra histórico.

### 6. Funil + Kanban + Timeline
Funil tipo "Captação" auto-cria tudo → lead entra com tag `funil:captacao-agosto` → FunnelDetail: 80 visitas→42 capturas→28 leads→9 conversões → timeline mostra jornada completa.

### 7. Agendamento + Quick Reply + Bulk Actions
Mensagem recorrente domingo → 40 respostas segunda → bulk actions "marcar lidos" → quick reply `/proposta` para respostas individuais.

### 8. Quick Product Import + Catálogo + AI Agent
20 URLs coladas → 20 produtos criados em 60s → AI Agent usa catálogo → lead que pede "verniz 18L" recebe carrossel automático.

### 9. Health Check + CI/CD
Cada deploy → edge function health-check valida DB + MV + env → se 503, deploy bloqueado automaticamente.

### 10. Agent QA + Ciclo Automatizado
Batch toda segunda-feira → 25 cenários testados → regressão detectada → badge vermelho → admin corrige no Prompt Studio → re-testa → volta ao verde.

---

## 3. Jornadas Completas do Cliente (10 cenários)

### J1 — Lead Frio via Instagram até Venda
Instagram Reels → link UTM → landing countdown → WhatsApp → AI Agent detecta campanha → qualifica → carrossel de produtos → responde preço/parcela → handoff → atendente fecha venda → TicketResolutionDrawer.

### J2 — Bio Link até Qualificação por Formulário
Bio page → botão "Agendar" (form) → formulário com CPF/plano/tratamento → lead criado → WhatsApp → AI Agent usa `<bio_context>` + `<form_data>` → responde sem repetir perguntas → `assign_label("Agendado")`.

### J3 — Candidato via Funil de Vaga
Funil "Vaga" → wizard auto-cria tudo → link no LinkedIn → formulário de candidatura → WhatsApp → AI Agent com script de RH → qualifica → `move_kanban("Triagem")` → handoff para recrutador.

### J4 — Lead Recorrente com Memória
Lead retorna 2 meses depois → AI Agent detecta histórico (context_long_enabled) → já sabe nome, cidade, último produto → conversa fluida sem repetição de dados.

### J5 — Lead Frustrado com Handoff Inteligente
Frustração + trigger handoff no mesmo batch → handoff direto (sem tentar responder empatia + produto) → mensagem de empatia → handoff → Shadow Mode extrai dados da reclamação.

### J6 — Sorteio para Captação Massiva
Funil "Sorteio" → QR code em panfletos → formulário → WhatsApp → AI Agent confirma participação → pergunta interesse → tags aplicadas → 800 leads em 1 semana → broadcast segmentado pós-sorteio.

### J7 — Produto Específico com Busca Fuzzy
Lead digita "cooral fosco brnco 18l" → ILIKE falha → word-by-word falha → fuzzy pg_trgm encontra "Coral Fosco Branco 18L" (0.78 similarity) → post-filter valida → `send_media` (1 produto = foto, não carrossel).

### J8 — Evento com Landing e Formulário
Funil "Evento" com starts_at → link ativo só na data → formulário na landing → WhatsApp → AI Agent confirma inscrição → `move_kanban("Inscritos")` → mensagem agendada 24h antes do evento.

### J9 — Atendimento Fora do Horário
Lead às 23h → AI Agent verifica business_hours → fora do horário → envia handoff_message_outside_hours → Shadow extrai motivo → manhã seguinte atendente vê lead com tag `motivo:orcamento` já aplicada.

### J10 — Onboarding Completo de Nova Instância
super_admin cria instância → gerente configura AI Agent → importa 150 produtos → cria Funil → configura broadcast semanal → testa no Playground (82% score) → configura ciclo automatizado → lança campanha → 2ª semana: detecta regressão → corrige → 91%.

---

## 4. Caso de Uso Específico — Campanha Política

Ver: [[wiki/casos-de-uso/campanha-deputado-anderson]]

### Resumo das Funcionalidades para Campanha Política

**Essenciais:**
- Campanhas UTM (links por post do Instagram)
- Bio Link (hub na bio com múltiplos destinos)
- Formulários (captação estruturada de dados)
- AI Agent (boas-vindas + TTS/áudio + send_media/vídeo/folder)
- Broadcast segmentado (por cidade, bairro, causa)
- Leads Database com tags (cidade:X, bairro:X, causa:X, perfil:voluntario)
- CRM Kanban (gestão de voluntários por etapa)

**Complementares:**
- Funis tipo Sorteio/Captação (ampliar base além de seguidores)
- Agendamentos (dia de evento, véspera de votação, dia de eleição)
- Knowledge Base do agente (todas as propostas do candidato)
- Quick reply templates (respostas padronizadas para equipe)

**Não necessárias:**
- Catálogo de produtos, Fuzzy search, Agent QA Framework

---

*Documentado em: 2026-04-08 — Sessão com George Azevedo*
