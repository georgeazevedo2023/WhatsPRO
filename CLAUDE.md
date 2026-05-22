# WhatsPRO — CRM Multi-Tenant WhatsApp

> Plataforma multi-tenant de atendimento WhatsApp (helpdesk), CRM Kanban, AI Agent, Leads, Campanhas, Funis e Automação. React + Supabase + UAZAPI. Produção: `crm.wsmart.com.br`.

Este arquivo é o **orquestrador** da documentação: lista o que ler em função da tarefa em mãos. Não contém conteúdo — só ponteiros.

---

## 🎯 Andamento do Plano Orquestrador — **43% concluído**

> Objetivo: monolito (1 LLM mega 17 KB) → **router LLM tiny + 5-6 specialists** + camada determinística + memória longa. Atualizado a cada sprint. Detalhe completo: [[wiki/plano-orquestrador-subagentes]] · [[wiki/plano-orquestrador-subagentes-part2]].

| Sprint | Status | Peso | Acumulado |
|---|---|---|---|
| A — Auditoria + gpt-5-mini + I2/I3 + 6 P0 | ✅ Shipped (v7.39.0) | 5% | 5% |
| B1 — Extrai hardcodedRules (-89% prompt) | ✅ Shipped (v7.40.0) | 6% | 11% |
| B1.5 — R135 anti-loop qualif + R136 multi-item | ✅ Shipped (v7.40.1) | 4% | 15% |
| B2 — Strict mode 9 tool schemas | ✅ Shipped (v7.40.2) | 5% | 20% |
| B3 — Reader sub_agents → agent_profiles | ✅ Shipped (v7.40.3) | 5% | 25% |
| B5 Onda 0+1 — extrai loadContextDocuments | ✅ Shipped (v7.40.4) | 5% | 30% |
| B5 Onda 2a — extrai promptSections (puras) | ✅ Shipped (v7.40.5) | 5% | 35% |
| B5 Onda 2b — extrai buildQualificationContext | ✅ Shipped (v7.40.6) | 3% | 38% |
| B5 Onda 2c-i — extrai R136 + R129 short-circuits | ✅ Shipped (v7.40.7) | 3% | 41% |
| B5 Onda 2c-ii — autoExtract + exit_action handoff + R121 inline search | ✅ Shipped (v7.40.8) | 2% | **43%** |
| B5 Onda 3 — toolExecution split por capacidade (~1500 lin) | ⏳ **pré-req Sprint C** | 8% | — |
| B5 Onda 4 — llmCallLoop (~370 lin) | ⏳ | 4% | — |
| B5 Onda 5 — dispatchResponse (~240 lin) | ⏳ | 3% | — |
| B4 — Varredura R134 idempotência | ⏳ (hardening, não-bloqueador) | 5% | — |
| **Sprint C** — Router + product_specialist POC | ⏳ MARCO | 15% | — |
| **Sprint D** — 5 specialists + migração 100% | ⏳ | 15% | — |
| Sprint E — Memória longa + proatividade + RAG | ⏳ Inteligência avançada | 10% | — |

**Hoje (2026-05-21 → 22 madrugada):** 10 sprints + Fix #7 (v7.40.9) shipados, 11 commits, ai-agent v74→v84. **512 lin extraídas do monolito** (4544→4032). **Validação E2E em prod descobriu 7 bugs** (lista em [[log.md]]) — Bug #7 (short-circuit perde info) fixado e deployado. Próximo passo no caminho crítico: **B5 Onda 3** (toolExecution split por capacidade — pré-req real do Sprint C). Sprint C real (orquestrador + 1 specialist em prod) projetado em **~4-6 semanas** se ritmo atual mantido.

**Métricas-alvo 90 dias:** prompt <8 KB (hoje 17 KB) · incidentes/14d <3 (hoje ~10) · router + 5 specialists · debug claro ("specialist X falhou na intent Y") · memória longa por lead.

---

## 🚦 Roteamento por contexto da tarefa

| Tarefa | Leia ANTES de codar |
|---|---|
| **Qualquer tarefa** (início de sessão) | `index.md` → [[wiki/roadmap]] → [[wiki/erros-e-licoes]] → `log.md` (últimas 5 entradas) → [[wiki/decisoes-chave]] |
| **Bug fix qualquer área** | [[wiki/erros-e-licoes]] PRIMEIRO + [[wiki/erros/regras-preventivas]] |
| **Nova feature do Helpdesk** | [[wiki/modulos]] (seção M2) + [[wiki/audio-pipeline]] + `PATTERNS.md` |
| **Nova feature do AI Agent** | `RULES.md` (sequência correção 4 níveis + SYNC RULE 8 locais) + [[wiki/modulos]] (M10/AI) + [[wiki/decisoes-chave]] |
| **Nova feature do CRM Kanban** | [[wiki/modulos]] (M4) + `PATTERNS.md` |
| **Nova feature de Leads/Campanhas/Funis** | [[wiki/modulos]] (M3, M11-M16) + `PATTERNS.md` |
| **Mexer em Fluxos v3.0 (M18)** | [[wiki/fluxos-visao-arquitetura]] + params (atendimento/inteligência/entrada/biolink) |
| **Edge function nova ou alteração de schema** | `ARCHITECTURE.md` + [[wiki/infraestrutura]] + [[wiki/erros-e-licoes]] (lições de schema mismatch) |
| **Alterar banco (migration)** | [[wiki/banco-de-dados]] + `RULES.md` (regras de migration) |
| **DEPLOY** | [[wiki/deploy-checklist]] OBRIGATÓRIO (pré-deploy 100% antes) |
| **Tarefa grande/não-trivial** | [[wiki/protocolo-subagentes]] (ondas paralelas, regras de conflito) |
| **Consultar release recente** | `CHANGELOG.md` (raiz, últimos ~14 dias) |
| **Consultar release histórico** | [[wiki/changelog/]] (particionado por mês) |
| **Ver roadmap** | [[wiki/roadmap]] (milestones) ou [[wiki/roadmap/planejado-resumo]] (planejado) |

---

## 📁 Estrutura da documentação

```
Raiz (ativo, ≤ 300 lin cada):
  CLAUDE.md         — este orquestrador
  CHANGELOG.md      — releases ~14 dias
  PRD.md            — índice (ponteiros)
  ARCHITECTURE.md   — stack, edge fns
  PATTERNS.md       — padrões de código
  RULES.md          — regras obrigatórias
  AGENTS.md         — onboarding agente externo
  log.md            — sessões da semana (max 200)
  index.md          — mapa do vault

wiki/ (ativo + arquivo):
  modulos.md            — tasks por módulo (M1-M9)
  infraestrutura.md     — snapshot stack
  audio-pipeline.md     — fluxo end-to-end áudio
  erros-e-licoes.md     — top-3 + índice
  roadmap.md            — milestones
  decisoes-chave.md     — regras/padrões vigentes
  fluxos-*.md           — Fluxos v3.0 (M18)

wiki/erros/
  regras-preventivas.md — tabela das ~30 regras
  historico-*.md        — incidentes detalhados

wiki/changelog/
  2026-{mês}-part{N}.md — releases arquivadas

wiki/roadmap/
  planejado-resumo.md     — lista resumida
  m{N}-{area}-part{N}.md  — detalhe por módulo

wiki/casos-de-uso/
  *-detalhado.md        — 31 wikis dual didático/técnico
```

---

## 📐 Hard limit 300 linhas

**Todo arquivo .md neste vault tem hard limit de 300 linhas.** Particionar imediatamente ao chegar perto. Convenções:

- **Ativos** (log.md, CHANGELOG.md, erros-e-licoes.md): chegar a 200 → planejar split
- **Arquivos** (`wiki/changelog/*`, `wiki/erros/historico-*`): split por período (quinzena/mês) com ponteiros entre `partN`
- **Detalhes longos** (roadmap módulo, plano shipado): split por sub-tema

Skills/comandos em `.claude/commands/*.md` estão **isentos** (são consumidos via slash command).

---

## 🧠 Vault Obsidian — Cérebro Persistente

### REGRA ZERO

> **NUNCA** terminar uma tarefa sem documentar no vault. Código sem documentação é trabalho incompleto.

### Protocolo de início de sessão (obrigatório)

1. Ler `index.md`
2. Ler [[wiki/roadmap]]
3. Ler [[wiki/erros-e-licoes]]
4. Ler `log.md` (últimas 5 entradas)
5. Ler [[wiki/decisoes-chave]]

Se pular, PARE e volte ao passo 1.

### Protocolo de fim de sessão (obrigatório)

1. Atualizar `log.md` — resumo de TUDO
2. Atualizar wikis afetadas
3. Atualizar [[wiki/roadmap]] se progresso mudou
4. Atualizar [[wiki/erros-e-licoes]] se encontrou/corrigiu bug
5. Atualizar `CHANGELOG.md` se shipou feature (semver)
6. Atualizar `index.md` se criou wiki nova
7. Informar usuário + nota 0-10

### Comandos do usuário

| Diz | Faz |
|---|---|
| "leia o vault" / "contexto" | Protocolo de início → resumo |
| "roadmap" / "status" | [[wiki/roadmap]] + `log.md` → fases/bloqueios |
| "o que falta?" | [[wiki/roadmap/planejado-resumo]] → pendente por área |
| "documentou?" | Auditar vault (300 linhas, refs cruzadas) + corrigir |
| "fim de sessão" | Protocolo de fim (7 passos + nota) |
| "fluxos" / "design" | [[wiki/fluxos-visao-arquitetura]] + params relevantes |

### Quando atualizar

- **Após COMMIT:** `log.md` + [[wiki/roadmap]]
- **Após FEATURE:** wiki relevante + `index.md` + `log.md` + `CHANGELOG.md`
- **Após BUG:** [[wiki/erros-e-licoes]] (causa + correção + regra) + `log.md`
- **Após DECISÃO:** [[wiki/decisoes-chave]] + `log.md`
- **Antes de DEPLOY:** [[wiki/deploy-checklist]] → registrar em `log.md`

### Convenções

- Wikilinks: `[[wiki/pagina]]`
- Frontmatter YAML: `title`, `tags`, `sources`, `updated`, `audited_at` (data da última revisão real)
- `log.md` é append-only. Fontes brutas (`PRD.md`, `docs/`) são read-only
- Datas absolutas: `2026-05-11` (YYYY-MM-DD). Português (Brasil)

### Formato pra discussão de decisões

1. **Contexto** — o que é e por que importa (didático)
2. **Problema** — o que precisa ser decidido
3. **Solução** — como funciona com exemplo concreto
4. **Casos de uso** — 4 exemplos reais
5. **Opções** — alternativas com pros/contras + recomendação destacada
6. **Documentação** — resposta do usuário registrada imediatamente

---

## 📏 Regras de Ouro (resumo — detalhes em `RULES.md`)

### Mentalidade
1. **SEMPRE ser crítico** — questionar premissas, verificar dados
2. **SEMPRE planejar antes de executar** — avaliar paralelização ([[wiki/protocolo-subagentes]])
3. **SEMPRE auto-avaliar** — nota honesta, identificar gaps
4. **SEMPRE didático** — exemplo concreto de caso de uso (Eletropiso/WhatsPRO real)

### Proteção
5. **NUNCA quebrar prod** — testar localmente antes de deploy
6. **NUNCA reportar dados falsos** — só após teste E2E completo
7. **HIGH RISK** — `ai-agent/index.ts`, `types.ts`, `e2e-test/`, `ai-agent-playground/` só com aprovação explícita

### Qualidade
8. **NUNCA pular etapas de entrega** — Implementar → TS (0 erros) → Testes (100%) → Auditoria → Commit → Documentar → Deploy
9. **SYNC RULE AI Agent** — toda alteração sincroniza 8 locais (ver `RULES.md`)

### Técnico
10. **CORS** — `getDynamicCorsHeaders(req)`, `ALLOWED_ORIGIN` obrigatório
11. **Tags** — NUNCA `[]` vazio, NUNCA magic strings, NUNCA opções numeradas
12. **300 linhas hard limit** — particionar imediatamente ao chegar perto

### Documentação
13. **SEMPRE nota 0-10** após documentar (conteúdo + orquestração + estado)
14. **SEMPRE refs cruzadas atualizadas** — `index.md`, `log.md`, `decisoes-chave.md`
15. **Após FEATURE: `CHANGELOG.md`** (novo entry semver) + `wiki/modulos.md` (se tasks novas)

---

## 🔍 Healthcheck

- `bash scripts/check-md-length.sh` — lista `.md` > 300 linhas
- Pre-commit hook bloqueia commit que viole o limite (instalar 1x via `bash scripts/install-hooks.sh`)
- GitHub Actions roda o mesmo check em PRs (`.github/workflows/vault-healthcheck.yml`)
- `/doc-check` — slash command com audit completo (limite + staleness + órfãs)

## Skills/Commands

- `/prd` → `PRD.md` (índice)
- `/uazapi` → `.claude/commands/uazapi.md` (referência API)
- `/doc-check` → `.claude/commands/doc-check.md` (vault healthcheck)
