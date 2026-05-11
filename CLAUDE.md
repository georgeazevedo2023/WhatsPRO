# WhatsPRO — CRM Multi-Tenant WhatsApp

> Plataforma multi-tenant de atendimento WhatsApp (helpdesk), CRM Kanban, AI Agent, Leads, Campanhas, Funis e Automação. React + Supabase + UAZAPI. Produção: `crm.wsmart.com.br`.

Este arquivo é o **orquestrador** da documentação: lista o que ler em função da tarefa em mãos. Não contém conteúdo — só ponteiros.

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
