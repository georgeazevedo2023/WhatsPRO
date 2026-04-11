---
title: G5 — Wireframes Admin Fluxos v3.0 (Índice)
tags: [wireframes, ux, admin, fluxos, g5]
sources: [4-agentes-paralelos-g5-2026-04-11, decisoes-chave.md]
updated: 2026-04-11
---

# G5 — Wireframes Admin Fluxos v3.0

> 5 telas principais em 4 arquivos especializados. Cada arquivo ≤200 linhas.
> Princípio: usuário médio não é dev — formulários dinâmicos, não JSON bruto.

---

## Navegação

| Arquivo | Telas |
|---------|-------|
| [[wiki/fluxos-wireframes-listagem]] | `/flows` listagem + `/flows/new` seleção de modo |
| [[wiki/fluxos-wireframes-wizard]] | `/flows/new` Formulário 4 etapas + Galeria Templates |
| [[wiki/fluxos-wireframes-guiada]] | `/flows/new` Conversa Guiada (split-screen) |
| [[wiki/fluxos-wireframes-editor]] | `/flows/:id` FlowEditor 5 tabs + `/flows/:id/metrics` |

---

## 5 Telas Principais

```
/flows                    → Listagem com filtros + 4 modo-badges
/flows/new                → Seleção de modo (3 cards)
/flows/new + formulário   → Wizard 4 etapas (Identidade→Config→Gatilhos→Publicar)
/flows/new + guiada       → Split-screen chat(48%) + preview(52%)
/flows/:id                → FlowEditor 5 tabs
/flows/:id/metrics        → Dashboard exportável
```

---

## Decisões UX Aplicadas (G5, 2026-04-11)

### Config Subagentes
- Formulário dinâmico por tipo (3-5 campos chave por subagente)
- Toggle "⚙ Avançado (JSON)" para casos custom
- 8 forms diferentes: greeting, qualification, sales, support, survey, followup, handoff, custom

### Config Serviços
- Defaults globais por instância — admin NUNCA vê "Memory Service"
- Aparecem contextualmente: Memory TTL → P1, Audio → P3, Validator → P5
- Linguagem de negócio, não técnica

### Exit Rules
- 5 presets configuráveis: max_messages | sem_resposta | intent_cancelamento | qualificacao_concluida | timeout
- "Regra personalizada (JSON)" para casos avançados
- Visual builder completo fica para S13+

### Conversa Guiada
- Split-screen: chat admin 48% / preview live 52%
- `flow_patch` incremental — IA não regenera o fluxo inteiro
- `guided_sessions` TTL 24h — admin retoma de onde parou
- Sugestões proativas: `has_catalog=true` → sugere carrossel

### Shadow Mode
- Banner persistente amarelo em toda tela quando `mode='shadow'`
- "MODO SHADOW ATIVO — A IA está observando mas NÃO está respondendo"
- Badge visual na listagem + na aba Identidade do editor

---

## Componentes Compartilhados

| Componente | Onde aparece |
|-----------|-------------|
| `FlowModeBadge` | Listagem, Editor header, Publicar tab |
| `ShadowBanner` | Qualquer tela com flow shadow ativo |
| `ExitRulePresets` | Aba Subagentes, dentro de cada step |
| `GatilhoModal` | Wizard etapa 3, Editor aba Gatilhos |
| `SubagentForm` | Editor aba Subagentes (8 variantes) |
| `MetricsCard` | Dashboard /metrics |

---

## Links

[[wiki/fluxos-visao-arquitetura]] | [[wiki/fluxos-roadmap-sprints]] | [[wiki/decisoes-chave]]
