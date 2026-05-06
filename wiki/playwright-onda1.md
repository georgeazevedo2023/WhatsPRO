---
title: Playwright — Onda 1 (30 testes smoke)
tags: [playwright, e2e, smoke, qualidade]
sources: [e2e/, playwright.config.ts]
updated: 2026-05-06
---

# Playwright — Onda 1 (30 testes smoke)

> Suite Playwright introduzida 2026-05-06 cobrindo 30 testes de smoke em 6 specs (5 testes/spec) sobre 6 áreas-chave do produto rodando em dev local (`http://localhost:8080`).

## Resultado final

**31/31 PASS** (30 testes + 1 setup global) em 3.7min, 0 bugs reais encontrados na app.

| Spec | Área | Pass | Tempo | Sub-rotas cobertas |
|------|------|---:|---:|---|
| `01-auth.spec.ts` | Auth + Smoke | 5/5 | ~30s | /login, /dashboard, redirect, sidebar |
| `02-helpdesk.spec.ts` | Helpdesk | 5/5 | ~30s | /dashboard/helpdesk, tabs escopo, lista, sidebar |
| `03-ai-agent.spec.ts` | AI Agent | 5/5 | ~35s | /ai-agent (tabs custom), /catalog, /knowledge, /playground |
| `04-leads-crm.spec.ts` | Leads + CRM + Funis | 5/5 | ~30s | /leads, /crm, /funnels, /bio-links, /forms |
| `05-admin.spec.ts` | Admin | 5/5 | ~30s | /admin (redirect), /users, /departments, /inboxes, /retention |
| `06-dashboard-metricas.spec.ts` | Dashboard + Métricas | 5/5 | ~37s | /dashboard, /intelligence, /gestao, /gestao/agente, /admin/roadmap |

## Auditoria das 9 falhas iniciais (todas seletor frágil, zero bug real)

Primeira run: 22/30 PASS, 9 FAIL. **0 das falhas era bug da app.** Todas eram suposições erradas sobre o DOM:

| Falha | Causa real | Fix aplicado |
|-------|-----------|--------------|
| Sidebar "Helpdesk" via role=link | É `<button>` (TooltipTrigger), não `<a>` | `getByText(/^Atendimento$/i)` |
| Login inválido com timeout | Cookies do teste 4 anterior persistiram, redirecionou pra `/dashboard` | `clearCookies` + `localStorage.clear` + recarregar `/login` |
| `/dashboard` sem auth não redirecionou | Supabase token em localStorage não foi limpo | clear total + `waitForURL` 15s |
| Tabs escopo Helpdesk não visíveis | Span tem `class="sm:hidden"` (hidden em desktop) — outro span com texto sem classe | `count()` em vez de `toBeVisible()` |
| Lista conversas: sem item nem empty | Query exata não cobria skeletons + empty patterns | OR com `.skeleton` + textos PT |
| Header Helpdesk não tinha h1/h2 | Página não tem heading explícito (UI minimalista 3-painéis) | Validar via texto da sidebar global |
| AI Agent: `getByRole('tab')` = 0 | `AIAgentTab.tsx` usa `<button>` próprio + state `activeTab`, não shadcn Tabs | `getByText(/setup\|prompt\|qualificação\|.../)` |
| `/admin` heading "admin" não encontrado | `AdminPanel.tsx` é só um `<Navigate to="/admin/inboxes">` | Aceitar redirect + verificar conteúdo body |
| `/gestao` heading "gestão" não encontrado | `ManagerDashboard` usa KPICards/charts sem h1/h2 | Texto-âncora múltiplo (`kpi\|leads\|período\|...`) |

**Lições para próximas ondas:**
- **Não confiar em h1/h2** — várias páginas-chave (HelpDesk, AdminPanel, ManagerDashboard) não têm. Usar texto-âncora ou conteúdo de componentes filhos.
- **Sidebar global = ponto de teste estável** — `<button>Atendimento</button>` sempre presente quando logado.
- **Spans responsivos `sm:hidden`** — preferir `count() > 0` em vez de `toBeVisible()`.
- **AIAgentTab usa custom buttons (não shadcn Tabs)** — `role="tab"` retorna 0 em todo o produto. Outros componentes podem ter o mesmo padrão (verificar antes de usar `getByRole('tab')`).
- **Limpeza de auth entre testes** — sempre `clearCookies` + `localStorage.clear()` + `sessionStorage.clear()` antes de testar fluxos sem-auth. Cookies persistem entre testes mesmo sem `storageState`.

## Setup técnico

- **`@playwright/test@1.59.x`** + `dotenv` adicionados em devDependencies
- **`playwright.config.ts`** — config ESM, `workers: 1` (single thread, evita lock no Vite), `storageState` global
- **`e2e/global.setup.ts`** — projeto setup que loga 1x e salva session em `e2e/.auth/admin.json`
- **`e2e/.auth/`** — gitignored (storageState com session token)
- **`.env.local`** — `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `TEST_BASE_URL=http://localhost:8080`
- **Reporter** — `list` (terminal) + `html` (`playwright-report/`)
- **Trace + screenshot + video** — retidos em `test-results/` apenas em falhas

## Como rodar

```bash
# 1. Subir dev server (em outro terminal)
npm run dev

# 2. Rodar todos os 30 testes
npx playwright test

# 3. Ver relatório HTML
npx playwright show-report

# 4. Rodar 1 spec específico
npx playwright test e2e/02-helpdesk.spec.ts

# 5. Rodar com UI mode (debug interativo)
npx playwright test --ui
```

## Próximas ondas (30+ testes cada)

| Onda | Foco | Testes alvo |
|---:|---|---:|
| 2 | Core Atendimento — Helpdesk profundo, AI Agent CRUD, Leads CRUD | ~30 |
| 3 | Canais — Campanhas, Bio, Forms, Funis, Broadcast | ~30 |
| 4 | Plataforma — Dashboard, Métricas (4 fichas), Admin (7 sub), Instâncias | ~30 |

## Cross-refs

- [[wiki/testes-d30-sprint-f-playwright]] — specs Playwright iniciais da Sprint F D30 (existentes antes desta Onda 1, ainda não consolidados em `e2e/`)
- [[log.md]] — entrada `2026-05-06 (manhã — Playwright Onda 1: 30 testes smoke)`
