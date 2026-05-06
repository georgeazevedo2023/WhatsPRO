---
title: Playwright — Onda 4 (30 testes interativos)
tags: [playwright, e2e, onda4, qualidade]
sources: [e2e/19..24]
updated: 2026-05-06
---

# Playwright — Onda 4 (30 testes interativos / CRUD light)

> Suite Playwright Onda 4 introduzida 2026-05-06 cobrindo 30 testes com **interações leves** (clicks, fill+restore, navegação entre tabs/passos) em 6 áreas: Helpdesk conversation, AI Agent tabs, Kanban Board detail, Funnels Wizard, Flows Wizard, Lead detail.

## Resultado final

**30/30 PASS.** 1 fail inicial (Funnels Wizard #4), corrigido após inspeção do DOM real.

| Spec | Área | Pass | Tempo |
|------|------|---:|---:|
| `19-helpdesk-conversation.spec.ts` | Lista lateral, click conversa, URL, header inbox, console errors | 5/5 | ~50s |
| `20-ai-agent-tabs.spec.ts` | Setup default, navegar Prompt/Qualificação/Inteligência, fill+restore input | 5/5 | ~45s |
| `21-kanban-detail.spec.ts` | /crm lista, click board, /crm/:id, sidebar, sem 401/403 | 5/5 | ~40s |
| `22-funnels-wizard.spec.ts` | Wizard renderiza, etapas, 7 tipos, cards interativos, conteúdo | 5/5 | ~75s |
| `23-flows-wizard.spec.ts` | /flows/new/wizard, /templates galeria, /new modes, /flows lista, RLS | 5/5 | ~60s |
| `24-lead-detail.spec.ts` | Lista leads, click → /leads/:id, sem ErrorBoundary, RLS, sidebar | 5/5 | ~100s |

## Bugs encontrados

**Zero bugs reais.** App responde bem a interações de navegação:
- Click em conversa do Helpdesk não crasha
- Mudança de tab no AIAgentTab funciona
- Click em board do Kanban navega ou exibe empty state corretamente
- Funnels Wizard passo 1 renderiza 7 tipos (cards clicáveis)
- Flows Wizard + Templates galeria abrem
- Click em lead navega para /leads/:contactId

## Padrão "fill + restore" (CRUD read-only)

Para testar inputs sem destruir dados de prod, padrão adotado:

```ts
const original = await input.inputValue();
await input.fill('teste_playwright_e2e');
expect(await input.inputValue()).toBe('teste_playwright_e2e');
// RESTAURA — NUNCA submeter
await input.fill(original);
```

Usado em `20-ai-agent-tabs.spec.ts:5`. Valida que o input é editável sem persistir mudança.

## Ajuste em teste (Funnels Wizard #4)

**Causa:** wizard passo 1 é "Qual o objetivo do seu funil?" — 7 cards clicáveis (`<button>` ou `<Card role="button">`), **sem inputs**. Inputs aparecem só nos passos 2-4 (configuração de cada tipo).

**Fix:** validar elementos interativos (`button:not([aria-label*="Recolher"]):not([aria-label*="Notif"]), [role="button"], a[href*="/funnels/"]`) em vez de inputs/textareas. Filtros excluem botões de UI global.

## Cobertura acumulada (4 ondas)

| Onda | Testes | Pass | Bugs reais | Tempo |
|------|---:|---:|---:|---:|
| 1 (smoke) | 30 | 30/30 | 0 | 3.7min |
| 2 (deep) | 30 | 30/30 | **1 (R100)** | 6.1min |
| 3 (deep+) | 30 | 30/30 | 0 | 3.9min |
| 4 (interativo) | 30 | 30/30 | 0 | ~6min |
| **Total** | **120** | **120/120 ✅** | **1** | **~20min suite full** |

## Áreas ainda não cobertas

- **Drag-drop** (Kanban cards entre colunas) — notoriamente flaky no Playwright, requer setup custom
- **Realtime broadcast** (multi-session) — requer 2 contexts + sincronização
- **CRUD destrutivo** (create + delete) — requer DB de teste isolado, prod é Eletropiso real
- **Form submission completo** (criar campanha, criar lead) — mesma limitação acima
- **Upload de arquivo** (avatar, mídia) — requer fixtures
- **Edge cases**: session expira, network slow, error boundary recovery, 4xx/5xx do backend

## Cross-refs

- [[wiki/playwright-onda1]] — Onda 1 smoke
- [[wiki/playwright-onda2]] — Onda 2 deep + R100
- [[wiki/playwright-onda3]] — Onda 3 deep+
- [[log.md]] — entrada `2026-05-06 (manhã — Playwright Onda 4)`
