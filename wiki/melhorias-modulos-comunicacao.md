---
title: Melhorias — Comunicação (Helpdesk, Broadcast, Forms)
tags: [melhorias, helpdesk, broadcast, forms, backlog]
sources: [auditoria 2026-04-27]
updated: 2026-04-27
---

# Melhorias — Comunicação

> 30 melhorias acionáveis em 3 módulos: Helpdesk, Broadcast e Forms WhatsApp. Auditoria 2026-04-27.

---

## Helpdesk (M2) — `src/components/helpdesk/`, `src/pages/dashboard/HelpDesk.tsx`

1. **Reconexão seletiva no tab-refocus** — substituir `window.location.reload()` (App.tsx:109) por `supabase.auth.refreshSession()` + recriar canal Realtime. Hoje perde scroll, drafts e filtros.
2. **Persistir drafts** por conversa em localStorage com debounce 500ms — qualquer reload (R71) descarta o que o atendente digitava.
3. **Hardening RLS R73 (S9 já agendado)** — extender `can_view_conversation` para enforçar `can_view_unassigned` e `can_view_all_in_dept`. Hoje atendente avançado pode bypass via curl.
4. **Atalhos de teclado** padronizados (J/K navegar, R responder, A resolver, Cmd+B etiqueta) com cheatsheet (`?`). Falta no `ChatPanel.tsx`.
5. **Notificação sonora opcional** quando chega msg em conversa não-aberta — `Notification API` + setting por usuário.
6. **Indicador de "lead online"** baseado em presence (heartbeat por contact_id no Realtime).
7. **Quick-reply com variáveis** (`{{lead.full_name}}`, `{{instance.business_name}}`) renderizadas no envio. Templates hoje são texto puro.
8. **Notas privadas com @-mention** + push em `notifications`. `NotesPanel.tsx` hoje só salva texto.
9. **Auto-resumo IA** na abertura de conversa antiga (>50 msgs ou >7 dias parada) usando `summarize-conversation` em vez de exigir clique manual.
10. **Métrica "tempo até primeira resposta humana"** salva em `conversations.first_human_reply_at` para alimentar SLAs no dashboard do gestor (M19).

---

## Broadcast (M3) — `src/components/broadcast/`, `src/pages/dashboard/Broadcaster.tsx`

1. **Pause/resume via DB** (não só client-side) — fechar a aba mata o broadcast. Persistir em `broadcast_runs.status='paused'` + worker que retoma.
2. **Preview por destinatário** com substituição de variáveis (`{{lead.first_name}}`) — ver exatamente como cada lead recebe.
3. **Detecção de número inválido pré-envio** — endpoint UAZAPI `/contact/exists` em batch antes de iniciar. Reduz queima de quota.
4. **Anti-ban inteligente** — detectar bloqueios consecutivos, pausar automaticamente e alertar super_admin via `notifications`.
5. **Carrossel pré-validado** — reusar guards do AI Agent (`carouselFallback`) para evitar carrossel inválido em broadcast manual.
6. **Importador via filtros do CRM** — "enviar para todos da coluna 'Negociação' do board X" sem CSV. Hook existe, falta UI.
7. **Templates A/B versionados** com taxa de resposta (clicaram, responderam) tracked em `broadcast_messages.replied_at`.
8. **Cap diário por instância** (anti-ban) configurável em `instances.daily_broadcast_limit`.
9. **Drill-down por mensagem** — clicar em "47 enviadas → 3 falharam" mostra quais. `BroadcastHistory.tsx` hoje só agrega.
10. **Exportar histórico** (CSV/JSON) para auditoria/LGPD.

---

## Forms WhatsApp (M12) — `src/components/admin/forms/`, `supabase/functions/form-bot/`

1. **Skip logic** ("se idade >18 pular pergunta X") — hoje fluxo linear.
2. **Validação custom regex** (CPF + custom) — hoje só built-in.
3. **Resume após abandono** — lead voltou após 24h, perguntar "quer continuar de onde parou?" Hoje começa do zero.
4. **Anexos validados** (tipo, tamanho) — hoje aceita qualquer.
5. **Ramificação por resposta** — yes/no leva para subforms diferentes. Hoje linear.
6. **Preview no admin** simulando lead real (chat fake) — hoje só vê definição.
7. **Webhook retry** com exponential backoff em `form-bot` quando webhook externo falha — hoje 1 tentativa.
8. **Export CSV de submissions** com filtros — hoje precisa SQL.
9. **Encriptação at-rest** de campos sensíveis (CPF, CEP) com `pgcrypto`. Hoje plain text em `form_submissions`.
10. **Form analytics** — taxa de conclusão por campo (onde leads abandonam) para otimizar.

---

## Links

- [[wiki/melhorias-auditoria-2026-04-27]] — Índice geral
- [[wiki/casos-de-uso/helpdesk-detalhado]]
- [[wiki/casos-de-uso/broadcast-detalhado]]
- [[wiki/casos-de-uso/formularios-detalhado]]
