---
title: Decisões-Chave
tags: [decisoes, regras, padroes, seguranca, funis, automacao, polls, perfis, nps, fluxos-unificados, validator, shadow, metrics]
sources: [CLAUDE.md, docs/REGRAS_ASSISTENTE.md]
updated: 2026-04-12
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

## M19 — Métricas & Shadow (S1+S2, 2026-04-13)

### NUNCA mock data — sempre dados reais do DB

UI, dashboards e gráficos DEVEM consumir dados reais do banco. NUNCA usar mock data, placeholder arrays ou dados fictícios — nem em dev, nem em produção.
- **Empty state** com mensagem clara ("Nenhum dado ainda") é aceitável
- Se dados ainda não existem: implementar PRIMEIRO a lógica que os popula, DEPOIS criar a UI que os consome
- **Por quê:** Mock mascara bugs de integração, dá falsa sensação de funcionamento e impede validação real

### Lead Score por Tags Shadow

Score inicial: 50 (0–100). Calculado a cada `aggregateDaily` por instância com base em tags extraídas do shadow:
- `intencao:alta` = +15 | `intencao:media` = +8 | `intencao:baixa` = +2
- `conversao:comprou` = +30 | `conversao:converteu` = +25 | `conversao:*` = +10
- `objecao:*` = −5 | `motivo_perda:*` = −20 | `concorrente:*` = −5
- Persiste em `lead_profiles.current_score` + histórico em `lead_score_history`

### Etapas do Funil de Conversão (conversion_funnel_events)

Detectadas por tags shadow, inseridas sem duplicatas (chave: `conversation_id + stage`):
- `qualification` — qualquer `intencao:*` ou `dado_pessoal:*`
- `intention` — `intencao:alta` ou `intencao:media`
- `conversion` — qualquer `conversao:*`
- `contact` (trivial) — não registrado

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

## Links

[[wiki/erros-e-licoes]] | [[wiki/ai-agent]] | [[wiki/arquitetura]] | [[wiki/arquitetura-docs]] | [[wiki/fluxos-banco-dados]] | [[wiki/fluxos-wireframes-admin]]
