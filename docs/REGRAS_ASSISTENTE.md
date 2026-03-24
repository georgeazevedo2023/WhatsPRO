# Regras do Assistente Claude — WhatsPRO

> **Cópia de consulta rápida** — Fonte original: `~/.claude/projects/.../memory/`

---

## Regra 1: Sempre Atualizar PRD

Sempre que uma funcionalidade for implementada e testada, OBRIGATORIAMENTE atualizar:

1. **PRD.md** (raiz) — Incrementar versão, adicionar changelog, marcar tasks, atualizar infra
2. **RoadmapTab.tsx** — Atualizar arrays MODULES, ROADMAP_ITEMS, CHANGELOG, INFRA
3. **docs/CONTEXTO_PROJETO.md** — Atualizar resumo do projeto
4. **Memory** — Atualizar `project_whatspro.md` com novo contexto

**Motivo:** O PRD é a fonte de verdade do projeto. Sem atualização, o contexto se perde entre conversas e funcionalidades ficam não documentadas.

**Quando:** Ao final de cada sprint/bloco de implementação, ANTES de reportar ao usuário.

---

## Regra 2: Padrões de Código

- Usar `handleError()` para erros user-facing (nunca só console.error)
- Usar CSS variables para cores (nunca hardcoded HSL)
- Usar hooks reutilizáveis quando padrão se repete 2+ vezes
- Usar `edgeFunctionFetch` para chamar edge functions
- UAZAPI: sempre normalizar campos (PascalCase/camelCase)
- Timestamps: auto-detect ms vs seconds (> 9999999999)

---

## Regra 3: Segurança

- Token UAZAPI NUNCA no frontend (sempre via uazapi-proxy)
- Não selecionar campo `token` da tabela `instances` no frontend
- Auth manual em todas as edge functions
- Supabase Vault para secrets em triggers/cron

---

## Regra 4: Deploy

- Frontend: `npm run build` + deploy manual
- Edge functions: `npx supabase functions deploy <name> --project-ref euljumeflwtljegknawy`
- Migrations: via MCP `apply_migration` ou Supabase Dashboard
- Projeto ativo: `euljumeflwtljegknawy` (wspro_v2)
