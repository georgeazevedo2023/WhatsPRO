---
title: Playwright — Onda 3 (30 testes profundos, 0 bugs)
tags: [playwright, e2e, onda3, qualidade]
sources: [e2e/13..18]
updated: 2026-05-06
---

# Playwright — Onda 3 (30 testes profundos)

> Suite Playwright Onda 3 introduzida 2026-05-06 cobrindo 30 testes em 6 áreas: Métricas profundas, Admin profundo, Catálogo, Knowledge, Forms editor, Bio Page editor.

## Resultado final

**31/31 PASS** (30 testes Onda 3 + 1 setup) em 3.9min. **Zero falhas na primeira run** — lições da Onda 1+2 aplicadas desde o começo (seletores tolerantes, count em vez de visible, texto-âncora múltiplo).

| Spec | Área | Pass | Tempo |
|------|------|---:|---:|
| `13-metricas-deep.spec.ts` | /gestao/transbordo, /gestao/origem, KPIs, filtros, /assistant input | 5/5 | ~52s |
| `14-admin-deep.spec.ts` | /admin/secrets, /docs, /backup, users new btn, inboxes Eletropiso | 5/5 | ~34s |
| `15-catalog-deep.spec.ts` | Lista produtos, btn add, busca, sem 401/403, conteúdo migrado | 5/5 | ~30s |
| `16-knowledge-deep.spec.ts` | Header, btn novo FAQ, lista, sem 401/403, sem white screen | 5/5 | ~30s |
| `17-forms-deep.spec.ts` | Página, btn novo, lista (6 forms), sem 401/403, sidebar | 5/5 | ~32s |
| `18-bio-deep.spec.ts` | Página, btn criar, lista, sem 401/403, sem white screen | 5/5 | ~34s |

## Bugs encontrados

**Zero.** Toda a app está renderizando corretamente nas áreas testadas:
- Sem ErrorBoundary disparando
- Sem 401/403 em RLS críticas (`ai_agent_products`, `ai_agent_knowledge`, `forms`, `bio_pages`)
- Sem white screen
- Páginas migradas exibem conteúdo (Eletropiso `/admin/inboxes` mostra inbox)

Isso confirma que:
- **R98 (GRANTs)** está corrigido em todas as tabelas testadas
- **R99 (27 colunas)** está corrigido — páginas que dependem dessas colunas renderizam
- **R100 (SelectItem)** foi a única bomba relógio do projeto (grep confirma 0 ocorrências restantes)

## Padrões consolidados (3 ondas)

Após 90 testes Playwright, os padrões que funcionam:

1. **Smoke pattern (URL + sem ErrorBoundary + body content)** — base de qualquer teste
2. **Texto-âncora múltiplo** (`getByText(/a|b|c/i)`) — não confiar em uma palavra só
3. **count() em vez de toBeVisible()** — para spans `sm:hidden` ou itens dentro de Collapsibles
4. **OR locator** (`a.or(b).or(c)`) — para empty state vs item list vs skeleton
5. **Sanity body length** — `bodyText.length > 100` confirma render real, não tela branca
6. **Não usar h1/h2** — várias páginas-chave não têm. Usar componentes filhos ou texto contextual.
7. **Aceitar redirect implícito** — AdminPanel é `<Navigate>`, várias áreas redirecionam
8. **`getByRole('tab')` só em shadcn `Tabs`** — AIAgentTab e outros componentes usam buttons custom
9. **Limpeza total de auth** — `clearCookies` + `localStorage.clear()` + `sessionStorage.clear()` antes de testar fluxos sem-auth
10. **`getByText(/^Atendimento$/i)` = ponto estável** — sidebar global presente em todo /dashboard/*

## Cobertura acumulada

| Onda | Testes | Pass | Bugs reais corrigidos | Tempo |
|------|---:|---:|---:|---:|
| 1 (smoke) | 30 | 30/30 | 0 | 3.7min |
| 2 (deep) | 30 | 30/30 | 1 (R100) | 6.1min |
| 3 (deep+) | 30 | 30/30 | 0 | 3.9min |
| **Total** | **90** | **90/90** | **1** | **~14min suite completa** |

## Áreas ainda não cobertas (próximas ondas)

- **Onda 4 candidates (~30 testes, 6h):**
  - Helpdesk: abrir conversa real → ChatPanel → ContactInfoPanel → reply input
  - AI Agent: editar campo + Salvar (CRUD full)
  - Kanban: arrastar card entre colunas (drag-drop)
  - Funnels Wizard: 4 passos completos
  - Flows Wizard: 4 etapas + preview
  - NPS/Polls editor
  - Realtime: receber broadcast de outra session

## Cross-refs

- [[wiki/playwright-onda1]] — Onda 1 (30 smoke)
- [[wiki/playwright-onda2]] — Onda 2 (30 deep + R100)
- [[log.md]] — entrada `2026-05-06 (manhã — Playwright Onda 3)`
