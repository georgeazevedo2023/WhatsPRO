---
title: Decisões Arquivadas — D21 a D26 + Auditoria Helpdesk 2026-04-14
tags: [decisoes, archive, d21, d22, d23, d24, d25, d26, helpdesk, db-monitoring, service-categories, auditoria-2026-04-14]
sources: [wiki/decisoes-chave.md]
updated: 2026-05-04
---

# Decisões Arquivadas — D21 a D26 (+ Auditoria Helpdesk 2026-04-14)

> Movido de `wiki/decisoes-chave.md` em 2026-05-04 (regra 14 — particionamento). Decisões ativas (D27, D28, D29) permanecem em `decisoes-chave.md`. Regras de integridade, SYNC RULE, padrões e segurança continuam lá.

---

## Auditoria Helpdesk (2026-04-14)

### Tab-refocus: reload completo (3s threshold)

Supabase client quebra após tab suspension. Tentativas anteriores (invalidateQueries, custom events, refetch seletivo) falharam porque o problema é no client HTTP/WebSocket, não no estado React. Solução: `window.location.reload()` após 3s de inatividade — mesmo padrão que Slack e Discord usam.

### fetchMessages: sem fetchIdRef, com AbortController

`fetchIdRef` pattern causava skeleton permanente: fetch stale completava sem `setLoading(false)`. Substituído por:
- Dependência em `conversationId` (primitiva) em vez de `conversation` (objeto)
- `AbortController` com 10s timeout + retry
- `setLoading(false)` incondicional no `finally`

### Profile pics: sem chamada de rede

UAZAPI v2 não tem endpoint para buscar foto. Hook `useContactProfilePic` retorna URL válida ou null (iniciais). Fotos atualizam automaticamente via webhook quando o contato manda mensagem.

> Nota 2026-04-30: superseded por v7.18.0 — fotos agora são baixadas + armazenadas em Supabase Storage (bucket `contact-avatars`), via helper `_shared/avatarStorage.ts` + edge function `refresh-avatar`. Resolve 403 do CDN do WhatsApp permanentemente.

### Playwright para E2E visual

Playwright v1.59.1 disponível no projeto para testes headless e headed. Login automatizado, screenshot por cenário.

---

## D21 — Helpdesk: Permissões de Inbox (2026-04-25, hardening agendado em S9)

### Negar por padrão (least privilege)

Atendente sem nenhum vínculo em `inbox_users` **não vê nada** no Helpdesk — empty state amigável pede para solicitar acesso ao administrador. Super admin sempre vê tudo (gate em `useHelpdeskInboxes`).

**Por quê:** Privacidade entre departamentos da mesma instância. Empresas grandes têm múltiplas inboxes (Vendas, Suporte, Financeiro) e nem todo atendente deve ver tudo. Princípio igual ao RLS: explicit-allow, default-deny.

**Granularidade da permissão:** A trava é por **inbox** (não por departamento). Departamento continua sendo organização interna da inbox. Colunas `inbox_users.can_view_all`, `can_view_unassigned`, `can_view_all_in_dept` controlam o que o atendente vê **dentro** de uma inbox autorizada.

**Como aplicar:**
- Frontend: `useHelpdeskInboxes` filtra por `inbox_users.user_id = auth.uid()` para não-super-admin
- Backend: função `can_view_conversation(user_id, inbox_id, department_id)` exige `EXISTS inbox_users` como gate obrigatório antes de qualquer outra checagem
- UI: `HelpDesk.tsx` renderiza `EmptyState` quando `inboxes.length === 0` após load, **antes** do layout normal

**Não aplicar:** super admin (`isSuperAdmin === true`) bypassa todo o gate por design.

> R73 (erros-e-licoes): can_view_unassigned/can_view_all_in_dept são SOFT (frontend-only). Hardening RLS agendado em M19 S9.

---

## D22-D25 — DB Monitoring & Auto-Cleanup (2026-04-25)

**D22 — Hard limit 300 MB** (não 500 do Free Plan). Margem de 200 MB para imprevistos. Thresholds: green <50%, yellow 50-75%, red 75-90%, critical ≥90%. Função `get_db_size_summary` SECURITY DEFINER super_admin-only.

**D23 — Notificações apenas super_admin.** Atendentes/gerentes não recebem alertas de DB. NotificationBell mínimo (Popover, poll 60s) em DashboardLayout + MobileHeader, condicional em `isSuperAdmin`. Dedup por `last_threshold_status` em `db_alert_state` singleton — sino só tocar quando piorar, nunca em melhora.

**D24 — Backup JSONL seletivo.** Apenas `conversation_messages` faz backup antes de DELETE (valor jurídico/LGPD). Demais policies (logs, métricas, fila) deletam direto. Backups gzipados em bucket privado `db-backups/YYYY/MM/{table}_{ts}.jsonl.gz` com retenção de 1 ano. Edge function `db-retention-backup` chamada por cron via `net.http_post` com Bearer ANON_KEY do vault.

**D25 — Default OFF + dry_run=true em todas as policies.** Admin liga uma a uma após validar dry-run. Whitelist de 27 tabelas-núcleo (`is_table_protected`) bloqueia delete em entidades primárias (`lead_profiles`, `contacts`, `ai_agents`, `conversations`, `inboxes`, `instances`, etc). Audit trail completo em `db_cleanup_log`.

---

## D26 v2 — Service Categories: Funil de Qualificação com Stages + Score (M19-S10 v2, 2026-04-27)

**Contexto:** AI Agent tinha 4 hardcodes de qualificação ("QUALIFICAÇÃO DE TINTAS", "fosco ou brilho", `if (interesse.includes('tinta'))` em `buildEnrichmentInstructions`, system_prompt do template Home Center). v1 (mesma sessão) resolveu hardcodes via schema plano com `qualification_fields[]` + boolean `ask_pre_search`. v2 evolui para **stages com score progressivo** que conecta com `lead_score_history` (M19 S2) em tempo real e dá ao admin um funil visual editável. Tab dedicada "Qualificação" (9ª tab no admin do agente). Substitui D26 v1 (mesma data, antes da UI integrar).

**7 sub-decisões:**

| # | Sub-decisão | Justificativa |
|---|-------------|---------------|
| D26.1 | Score persistente por lead, salvo em tag `lead_score:N` + `lead_score_history` | Conecta com M19 S2/S3 sem retrabalho |
| D26.2 | Score reseta apenas em `ia_cleared:` (mesma regra do clear context) | Comportamento consistente com clear context existente |
| D26.3 | 1 categoria primária por conversa, definida pela tag `interesse:` | Evita múltiplos funis competindo |
| D26.4 | Score NUNCA visível ao lead | É métrica interna gestor |
| D26.5 | Nova tab dedicada "Qualificação" (9ª) | Stages são complexos suficiente para justificar; mantém tab "Inteligência" enxuta |
| D26.6 | `exit_action` por stage: `search_products` \| `enrichment` \| `handoff` \| `continue` | Stage decide que comportamento dispara quando atinge `max_score` |
| D26.7 | `score_value` por field, total possível por categoria 100 | Alinhado com NPS-like scoring |

**Backward compat:** migration v2 detecta agentes com schema plano (v1) e remapeia automaticamente para 3 stages padrão (Identificação → Detalhamento → Fechamento). `getCategoriesOrDefault(null|undefined|v1)` retorna seed v2 que reproduz comportamento equivalente.

**Hierarquia:** AI Agent (camada 1) lê service_categories. Agent Profiles (M17 F3) continua sobrescrevendo handoff por contexto. Funnels (M16) acima. **Cruza com R78** (regra geral: hardcoded por nicho não escala em multi-tenant) e **R79** (regra de score: reseta apenas em `ia_cleared`, nunca visível ao lead).

**Não unifica:** `extraction_fields` (campos do perfil do lead — outro conceito), `prompt_sections` (texto livre).

---

## Links

[[wiki/decisoes-chave]] (decisões ativas) | [[wiki/erros-e-licoes]] | [[wiki/ai-agent]] | [[wiki/arquitetura]]
