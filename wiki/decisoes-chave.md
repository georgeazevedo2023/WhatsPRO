---
title: Decisões-Chave
tags: [decisoes, regras, padroes, seguranca, funis, automacao, polls, perfis, nps, fluxos-unificados, validator, shadow, metrics, assistant, db-retention, service-categories, service-categories-v2]
sources: [CLAUDE.md, docs/REGRAS_ASSISTENTE.md]
updated: 2026-04-27
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

## D27 — Eletropiso: estratégia handoff-first em catálogo embrionário (2026-04-29)

**Contexto:** agente Eletropiso (instância única de prod) tem catálogo com 7 produtos cadastrados, mas vai atender vários nichos (porta, fechadura, escada, cano, cabo, furadeira, churrasqueira, janela, pia, cerâmica). Não dá pra esperar catálogo crescer pra começar a usar IA — usuário quer começar agora.

**Decisão:** configurar 10 categorias novas com `exit_action: handoff` direto (pula search_products) — IA qualifica (1-3 perguntas por categoria) e passa pra vendedor humano com contexto completo. Conforme catálogo crescer, mudar `exit_action: handoff → search_products` por categoria (1 SQL update, ~30s). **Tintas e impermeabilizantes preservadas** — essas têm catálogo e mantêm `search_products` no Stage 1.

**Por que não cadastrar catálogo primeiro:** sprint do user precisa entregar valor agora; catálogo cresce em paralelo; estrutura preparada destrava migração 1-a-1.

**Por que não usar `default` (qualificação básica) pra todas:** default tem só 1 stage genérico (especificacao + marca + quantidade). Categorias específicas (`material_porta`, `tipo_fechadura`, `bitola`) capturam dado de qualidade muito superior pra vendedor.

**Convenções derivadas:**
- **Sufixo de categoria nas keys** (ex: `material_porta`, `material_pia`, `material_janela`) — evita conflito de tag entre múltiplas categorias na mesma conversa
- **Phrasing literal** sem placeholders é válido (ex: churrasqueiras: "Temos churrasqueira pré-moldada e de alumínio. Qual delas te interessa?")
- **`exit_action: handoff` não impede `search_products`** — LLM ainda chama busca quando lead menciona produto específico (regra hardcoded BUSCA OBRIGATÓRIA, `index.ts:1180`); mecanismo aditivo

**SYNC RULE auditada:**
- Item 1 (banco): UPDATE service_categories ✅
- Itens 2-7: não se aplicam (Set VALID_KEYS é interno ao edge function; tipos não expostos)
- Item 8 (docs): cumprido aqui

**Rollback:** trivial via `BACKUP.json` em `.planning/phases/eletropiso-categories-2026-04-29/` — 1 UPDATE com JSON antigo restaura estado pré-sprint.

**Cruza com R81 candidata** (VALID_KEYS whitelist é silent reject) e **R8** (NUNCA dizer "não temos" — handoff resolve com contexto pro vendedor).

## D28 — Excluded Products: lista de produtos NÃO vendidos editável pelo admin (2026-04-30)

**Contexto:** Antes desta feature, a IA só sabia distinguir 2 estados: produto VENDE (casou em service_categories → qualifica e busca) ou NÃO-CADASTRADO (cai em default → handoff genérico). Quando lead pergunta sobre produto que a tenant simplesmente não trabalha (ex: caixa de correio em home center, ar-condicionado em loja de tinta), o vendedor recebia handoffs vazios e respondia "não temos" manualmente. Desperdício de atenção humana.

**Decisão:** adicionar coluna `ai_agents.excluded_products JSONB` editável via UI no admin (subseção da tab Qualificação). Schema:

```json
[
  {
    "id": "caixa_correio",
    "keywords": ["caixa de correio", "correio"],
    "message": "Não trabalhamos com caixa de correio. Posso te ajudar com cofres ou fechaduras?",
    "suggested_categories": ["fechaduras"]
  }
]
```

**Comportamento em runtime:**
1. Lead manda mensagem → ai-agent verifica `matchExcludedProduct(text, agent.excluded_products)` ANTES de incrementar counter, ANTES de checar handoff triggers, ANTES de carregar contexto LLM
2. Se matched → envia `item.message` direto, log `event: 'excluded_product_match'`, **NÃO incrementa lead_msg_count**, **NÃO faz handoff**, early return
3. Se lead em SHADOW → skip (não responde nada)

**Por que não reaproveitar `blocked_topics`:** semanticamente diferente. blocked_topics são temas tabu (concorrentes, política) — IA nunca discute. excluded_products são produtos que simplesmente não estão no portfólio — IA discute educadamente e sugere alternativas.

**Por que não usar `service_categories` com flag `excluded: true`:** mistura listas (categorias que vende vs categorias que não vende) e o schema de service_categories tem stages+score para qualificação progressiva — não faz sentido para "não vendemos".

**Convenções:**
- Match por palavra-inteira (regex `\b...\b`) — "correio" não casa "correios"
- Case-insensitive + remove acentos via `normalize('NFD')`
- Primeiro match na ordem da lista vence
- Mensagem polida e termina sugerindo categoria alternativa quando possível

**SYNC RULE auditada:**
- Item 1 (banco): migration `ai_agents_excluded_products` ✅
- Item 2 (types.ts): patch surgical (Row+Insert+Update) ✅
- Item 3 (Admin UI): `ExcludedProductsConfig.tsx` na tab Qualificação ✅
- Item 4 (ALLOWED_FIELDS): `'excluded_products'` adicionado ✅
- Item 5 (backend): `_shared/excludedProducts.ts` + check em `index.ts` linha 504 ✅
- Itens 6+7 (prompt + system_settings): N/A (não envolve LLM nem default global)
- Item 8 (docs): D28 + R87 + log ✅

**Cruza com R85** (skip auto-handoff em shadow) e **R86** (reset counter em shadow) — feature funciona em sinergia: excluded_product responde sem incrementar counter, evitando que múltiplas perguntas sobre produtos não vendidos estourem o limit e disparem auto-handoff.

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
