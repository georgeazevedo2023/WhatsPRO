---
title: Decisões-Chave
tags: [decisoes, regras, padroes, seguranca, funis]
sources: [CLAUDE.md, docs/REGRAS_ASSISTENTE.md]
updated: 2026-04-08
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
- Handoff priority: funil.handoff_message > agent.handoff_message — funil customiza handoff sem alterar config do agente
- Funis sao camada de orquestracao — NUNCA duplicar logica dos modulos internos (campaigns, bio, forms). Funil aponta via FK.
- `funnelTemplates.ts` define defaults por tipo — kanban columns, bio buttons, campaign UTM, form template. Centralizado.
- `funnelData` carregado early (antes dos handoff triggers) no ai-agent para estar disponivel em todos os paths de handoff

## Segurança

- Token UAZAPI NUNCA no frontend
- Auth manual em todas edge functions
- Supabase Vault para secrets
- Media URLs diretas do UAZAPI (sem re-upload)

## Arquivos HIGH RISK (nunca tocar sem aprovação)

- `supabase/functions/ai-agent/index.ts`
- `supabase/functions/ai-agent-playground/index.ts`
- `supabase/functions/e2e-test/index.ts`
- `src/integrations/supabase/types.ts`

## Links

- [[wiki/erros-e-licoes]] — Erros para não repetir
- [[wiki/ai-agent]] — Regras do agente
- [[wiki/arquitetura]] — Stack
