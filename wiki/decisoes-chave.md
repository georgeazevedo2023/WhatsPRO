---
title: Decisões-Chave
tags: [decisoes, regras, padroes, seguranca, funis, automacao, polls, perfis, nps, fluxos-unificados, validator, shadow, metrics, assistant]
sources: [CLAUDE.md, docs/REGRAS_ASSISTENTE.md]
updated: 2026-04-13
---

# Decisões-Chave

## Regras de Integridade

- NUNCA reportar dados falsos ou inconsistentes
- NUNCA dar nota/score parcial e depois mudar para pior
- NUNCA dizer que algo funciona baseado em teste parcial
- NUNCA quebrar código em produção
- Se resultado contradiz anterior → explicar POR QUE mudou

## Protocolo de Entrega (6 passos — NUNCA pular)

1. **Implementar** — código funcional, sem `as any`, sem magic strings
2. **TypeScript** — `npx tsc --noEmit` = 0 erros
3. **Testes** — `npx vitest run` = 100%
4. **Auditoria** — arquivos proibidos, dados legados, RLS
5. **Commit** — mensagem descritiva (feat/fix/chore + módulo)
6. **Documentar** — CLAUDE.md + PRD.md + vault

## SYNC RULE (8 locais)

Ao alterar feature do AI Agent, sincronizar:
1. Banco (coluna + migration)
2. Types.ts (gen types)
3. Admin UI (campo editável)
4. ALLOWED_FIELDS (AIAgentTab.tsx)
5. Backend (ai-agent/index.ts)
6. Prompt (prompt_sections)
7. system_settings defaults
8. Documentação (CLAUDE.md + PRD.md)

## Padrões de Código

- `handleError()` para erros user-facing (nunca só console.error)
- CSS variables para cores (nunca hardcoded HSL)
- Hooks reutilizáveis quando padrão repete 2+ vezes
- `edgeFunctionFetch` para chamar edge functions
- STATUS_IA constantes — NUNCA magic strings
- `leadHelper.ts` para criar leads — NUNCA duplicar FIELD_MAP ou upsert de lead_profiles
- Tags de origem: sempre `origem:X` (campanha/formulario/bio) — padronizado em todos os sistemas
- `lead_profiles.origin` deve ser setado na criação do lead (bio/campanha/formulario/funil)
- Tag `funil:SLUG` — setada automaticamente por form-public, bio-public, whatsapp-webhook quando recurso pertence a um funil
- Handoff priority: profile > funnel > agent (D10) — profileData.handoff_message > funnelData.handoff_message > agent.handoff_message
- Funis sao camada de orquestracao — NUNCA duplicar logica dos modulos internos (campaigns, bio, forms). Funil aponta via FK.
- `funnelTemplates.ts` define defaults por tipo — kanban columns, bio buttons, campaign UTM, form template. Centralizado.
- `funnelData` carregado early (antes dos handoff triggers) no ai-agent para estar disponivel em todos os paths de handoff
- Variáveis usadas em `response_sent` log (ex: `activeSub`) DEVEM ser `let` no escopo da função, NUNCA `const` dentro de blocos condicionais (D20 — ReferenceError silencioso em prod)
- Catch blocks DEVEM ter acesso a agent_id/conversation_id — hoistar antes do try. Sem isso, erros são invisíveis (NOT NULL violation no INSERT do log)
- Regras de prompt com prioridade: usar "PRIORIDADE ABSOLUTA" + "esta regra ANULA" para evitar que regras genéricas sobreponham regras específicas
- Guard programático `handoff_to_human`: quando tags `produto:/interesse:/marca_preferida:` existem, exigir `search_products` antes. LLM não é confiável para seguir regras de sequência sozinho

## Segurança

- Token UAZAPI NUNCA no frontend
- Auth manual em todas edge functions
- Supabase Vault para secrets
- Media URLs diretas do UAZAPI (sem re-upload)

## CORS — Edge Functions (2026-04-08)

- **`getDynamicCorsHeaders(req)`** — CORS dinâmico que checa Origin vs whitelist + aceita `localhost:*` automaticamente
- **`browserCorsHeaders`** — CORS estático (backward-compatible), usa primeiro origin do `ALLOWED_ORIGIN`
- **`webhookCorsHeaders`** — wildcard `*` para webhooks (UAZAPI, n8n)
- Edge functions admin-* DEVEM usar `getDynamicCorsHeaders(req)` e `verify_jwt=false`
- `ALLOWED_ORIGIN` suporta comma-separated: `https://crm.wsmart.com.br,https://app.whatspro.com.br`

## Formato de Discussão (2026-04-08): Contexto → Problema → Solução → 4 casos → Opções+recomendação → Documentar no vault

> Decisões D7-D20 (Fluxos v3.0, Orquestrador, Shadow, Validator) arquivadas em: [[wiki/decisoes-arquivo-fluxos-v3]]

> Decisões M19 S3+S5 (2026-04-13) arquivadas em [[wiki/decisoes-arquivo-m19-s3-s5]]

## Arquivos HIGH RISK (nunca tocar sem aprovação)

- `supabase/functions/ai-agent/index.ts`
- `supabase/functions/ai-agent-playground/index.ts`
- `supabase/functions/e2e-test/index.ts`
- `src/integrations/supabase/types.ts`

## Reorganizacao Documentacao (2026-04-10)

CLAUDE.md 373→96 linhas. Conteúdo migrado: [[RULES.md]] (regras) | [[ARCHITECTURE.md]] (stack) | [[PATTERNS.md]] (padrões).
**Regra:** NUNCA inflar CLAUDE.md — orquestrador, não enciclopédia. Detalhes: [[wiki/arquitetura-docs]].

## G5 — UX Admin Fluxos v3.0 (2026-04-11)

- Config subagentes: form dinâmico + toggle JSON avançado. Exit rules: 5 presets. Conversa Guiada: split-screen chat+preview. 5 telas.
- **Wiki:** [[wiki/fluxos-wireframes-admin]]

## DT1 — custom_fields Location (2026-04-11)

- `lead_profiles.custom_fields JSONB` (coluna já existe). Dado de negócio, não memória IA. Sobrevive reset de contexto.

## DB Monitoring & Auto-Cleanup (D22-D25, 2026-04-25)

**D22 — Hard limit 300 MB** (não 500 do Free Plan). Margem de 200 MB para imprevistos. Thresholds: green <50%, yellow 50-75%, red 75-90%, critical ≥90%. Função `get_db_size_summary` SECURITY DEFINER super_admin-only.

**D23 — Notificações apenas super_admin.** Atendentes/gerentes não recebem alertas de DB. NotificationBell mínimo (Popover, poll 60s) em DashboardLayout + MobileHeader, condicional em `isSuperAdmin`. Dedup por `last_threshold_status` em `db_alert_state` singleton — sino só tocar quando piorar, nunca em melhora.

**D24 — Backup JSONL seletivo.** Apenas `conversation_messages` faz backup antes de DELETE (valor jurídico/LGPD). Demais policies (logs, métricas, fila) deletam direto. Backups gzipados em bucket privado `db-backups/YYYY/MM/{table}_{ts}.jsonl.gz` com retenção de 1 ano. Edge function `db-retention-backup` chamada por cron via `net.http_post` com Bearer ANON_KEY do vault.

**D25 — Default OFF + dry_run=true em todas as policies.** Admin liga uma a uma após validar dry-run. Whitelist de 27 tabelas-núcleo (`is_table_protected`) bloqueia delete em entidades primárias (`lead_profiles`, `contacts`, `ai_agents`, `conversations`, `inboxes`, `instances`, etc). Audit trail completo em `db_cleanup_log`.

## Helpdesk — Permissões de Inbox (D21, 2026-04-25, hardening agendado em S9)

### Negar por padrão (least privilege)

Atendente sem nenhum vínculo em `inbox_users` **não vê nada** no Helpdesk — empty state amigável pede para solicitar acesso ao administrador. Super admin sempre vê tudo (gate em `useHelpdeskInboxes`).

**Por quê:** Privacidade entre departamentos da mesma instância. Empresas grandes têm múltiplas inboxes (Vendas, Suporte, Financeiro) e nem todo atendente deve ver tudo. Princípio igual ao RLS: explicit-allow, default-deny.

**Granularidade da permissão:** A trava é por **inbox** (não por departamento). Departamento continua sendo organização interna da inbox. Colunas `inbox_users.can_view_all`, `can_view_unassigned`, `can_view_all_in_dept` controlam o que o atendente vê **dentro** de uma inbox autorizada.

**Como aplicar:**
- Frontend: `useHelpdeskInboxes` filtra por `inbox_users.user_id = auth.uid()` para não-super-admin
- Backend: função `can_view_conversation(user_id, inbox_id, department_id)` exige `EXISTS inbox_users` como gate obrigatório antes de qualquer outra checagem
- UI: `HelpDesk.tsx` renderiza `EmptyState` quando `inboxes.length === 0` após load, **antes** do layout normal

**Não aplicar:** super admin (`isSuperAdmin === true`) bypassa todo o gate por design.

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

### Playwright para E2E visual

Playwright v1.59.1 disponível no projeto para testes headless e headed. Login automatizado, screenshot por cenário.

## Links

[[wiki/erros-e-licoes]] | [[wiki/ai-agent]] | [[wiki/arquitetura]] | [[wiki/arquitetura-docs]] | [[wiki/fluxos-banco-dados]] | [[wiki/fluxos-wireframes-admin]]
