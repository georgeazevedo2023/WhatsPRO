---
title: M19-S10 — Service Categories v2 (Stages + Score)
phase: M19-S10
status: in_progress_v2
created: 2026-04-27
updated: 2026-04-27
v1_shipped_at: 2026-04-27 (boolean ask_pre_search — superseded antes de UI integrada)
v2_started_at: 2026-04-27 (stages + score)
---

# M19-S10 v2 — Service Categories com Stages + Score Progressivo

## Histórico

- **v1 (shipped 2026-04-27):** schema plano com `qualification_fields[]` + flag `ask_pre_search` boolean. Resolveu hardcode "fosco/brilho" mas UI binária era ruim para admin não-técnico, e não capitalizava em `lead_score_history` (M19 S2). UI nunca chegou ao admin (F2 ficou como TODO).
- **v2 (esta fase):** evolução para `stages[]` com score progressivo. Aba dedicada "Qualificação" (9ª tab no admin do agente).

## Objetivo

Substituir 4 hardcodes do AI Agent (já feito em v1) **e** dar ao admin um sistema de **funil de qualificação por categoria com etapas nomeadas e score numérico** que alimenta o Dashboard do Gestor (M19) em tempo real.

## Decisões de design (D26 v2)

| # | Decisão | Justificativa |
|---|---------|---------------|
| D26.1 | Score persistente por lead, salvo em tag `lead_score:N` + `lead_score_history` | Conecta com M19 S2/S3 sem retrabalho |
| D26.2 | Score reseta apenas em `ia_cleared:` (mesma regra do clear context) | Comportamento consistente com clear context existente |
| D26.3 | 1 categoria primária por conversa, definida pela tag `interesse:` | Evita múltiplos funis competindo |
| D26.4 | Score NUNCA visível ao lead | É métrica interna gestor |
| D26.5 | Nova tab dedicada "Qualificação" (9ª) | Stages são complexos suficiente para justificar; mantém tab "Inteligência" enxuta |
| D26.6 | `exit_action` por stage: `search_products` \| `enrichment` \| `handoff` \| `continue` | Stage decide que comportamento dispara quando atinge `max_score` |
| D26.7 | `score_value` por field default 10; total possível por categoria 100 | Alinhado com NPS-like scoring |

## Schema v2

```jsonc
{
  "categories": [
    {
      "id": "tintas",
      "label": "Tintas e Vernizes",
      "interesse_match": "tinta|esmalte|verniz|impermeabilizante",
      "stages": [
        {
          "id": "identificacao",
          "label": "Identificação",
          "min_score": 0,
          "max_score": 30,
          "exit_action": "search_products",
          "fields": [
            { "key": "ambiente", "label": "ambiente", "examples": "interno ou externo", "score_value": 15, "priority": 1 },
            { "key": "cor",      "label": "cor",      "examples": "branco, cinza",      "score_value": 15, "priority": 2 }
          ],
          "phrasing": "Para encontrar a melhor opção, qual {label}? ({examples})"
        },
        {
          "id": "detalhamento",
          "label": "Detalhamento",
          "min_score": 30,
          "max_score": 70,
          "exit_action": "enrichment",
          "fields": [
            { "key": "acabamento",      "label": "acabamento", "examples": "fosco, acetinado, brilho", "score_value": 20, "priority": 1 },
            { "key": "marca_preferida", "label": "marca",      "examples": "Coral, Suvinil",           "score_value": 20, "priority": 2 }
          ],
          "phrasing": "Certo! E sobre {label}, prefere {examples}?"
        },
        {
          "id": "fechamento",
          "label": "Pronto para Handoff",
          "min_score": 70,
          "max_score": 100,
          "exit_action": "handoff",
          "fields": [
            { "key": "quantidade", "label": "quantidade", "examples": "litros ou galões", "score_value": 15, "priority": 1 },
            { "key": "area",       "label": "metragem",   "examples": "em m²",            "score_value": 15, "priority": 2 }
          ],
          "phrasing": "Antes de te conectar com o vendedor, {label}?"
        }
      ]
    },
    {
      "id": "impermeabilizantes",
      "label": "Impermeabilizantes e Mantas",
      "interesse_match": "impermeabilizante|manta",
      "stages": [/* 2 stages: triagem (área+aplicação) → handoff */]
    }
  ],
  "default": {
    "stages": [
      {
        "id": "qualificacao_basica",
        "label": "Qualificação básica",
        "min_score": 0,
        "max_score": 100,
        "exit_action": "handoff",
        "fields": [
          { "key": "especificacao",   "label": "detalhes",  "examples": "qualquer informação relevante", "score_value": 25, "priority": 1 },
          { "key": "marca_preferida", "label": "marca",     "examples": "",                              "score_value": 25, "priority": 2 },
          { "key": "quantidade",      "label": "quantidade","examples": "",                              "score_value": 25, "priority": 3 }
        ],
        "phrasing": "Para te ajudar melhor, me conta {label}?"
      }
    ]
  }
}
```

## 5 Fases (1 a mais que v1)

### F1.5 — Backend Isolado v2 (paralelo, zero risco) — Agente A

**Arquivos modificados/novos:**
- `supabase/migrations/20260427000002_ai_agent_service_categories_v2_stages.sql` (NOVA)
- `supabase/functions/_shared/serviceCategories.ts` (REESCRITA — nova interface `Stage`, funções `getCurrentStage`, `getNextField`, `getScoreFromTags`, `getExitAction`, `addScoreFromTagSet`, `STAGE_LABELS`)
- `supabase/functions/_shared/serviceCategories.test.ts` (REESCRITA — 40+ testes cobrindo stages, score, exit_action, fallback)

### F2 v2 — Admin UI v2 (paralelo, baixo risco) — Agente B

**Arquivos modificados/novos:**
- `src/types/serviceCategories.ts` (REESCRITA — espelhar tipos v2)
- `src/components/admin/ai-agent/ServiceCategoriesConfig.tsx` (REESCRITA — UI 3 níveis: Categoria → Stage → Field, drag-drop em stages e fields, preview de score acumulado, validação de sobreposição min_score/max_score)

### F3 v2 — Substituição em ai-agent/index.ts (HIGH RISK, sequencial — manual com aprovação)

**Arquivos:**
- `supabase/functions/ai-agent/index.ts` — adaptar `buildEnrichmentInstructions` para usar `getCurrentStage(score, category)` em vez de `getQualificationFields(category, fallback, ask_pre_search)`. Adicionar hook em `set_tags` handler para somar `score_value` no `lead_score`. Persistir `lead_score_history` em tempo real via RPC.

### F4 v2 — Doc + Seed (paralelo, baixo risco) — Agente C

**Arquivos modificados:**
- `src/data/nicheTemplates.ts` (atualizar templates para schema v2 com stages)
- `wiki/ai-agent.md`, `wiki/casos-de-uso/ai-agent-detalhado.md` (atualizar seção Service Categories)
- `wiki/decisoes-chave.md` — D26 v2 (substituir/expandir)
- `wiki/erros-e-licoes.md` — R78 mantida + R79 (sobre score reset em ia_cleared)
- `wiki/melhorias-modulos-inteligencia.md` — atualizar item #10 com versão v2
- `PRD.md` — entrada v7.15.0 substituindo v7.14.0 OU complementando-a (decidir conforme estado)
- `log.md` — entrada v2 da fase

### F5 — Integração da nova tab "Qualificação" (sequencial, baixo risco — manual)

**Arquivos modificados:**
- `src/components/admin/AIAgentTab.tsx` — adicionar 9ª tab "Qualificação" no array de tabs + renderização condicional `{activeTab === 'qualification' && <ServiceCategoriesConfig ... />}`
- Remover TODO comentado das linhas 670-678

## SYNC RULE 8 itens (atualizado para v2)

| # | Item | Cobertura v2 |
|---|------|--------------|
| 1 | Banco | F1.5 (migration v2) |
| 2 | types.ts | Pós-F1.5 — `mcp__supabase__generate_typescript_types` |
| 3 | Admin UI | F2 v2 + F5 (nova tab) |
| 4 | ALLOWED_FIELDS | Já cobertos (v1) |
| 5 | Backend | F3 v2 |
| 6 | Prompt | F3 v2 |
| 7 | system_settings defaults | F1.5 |
| 8 | Documentação | F4 v2 |

## Riscos & Mitigações

- **v1 já em produção (1 agente com seed plano):** migration v2 contém UPDATE remapeando dados de v1 → v2 antes de mudar o DEFAULT
- **F3 v2 mexe ai-agent/index.ts pela 2ª vez:** apresentar diff completo + rodar Agent QA Framework batch threshold ≥80%
- **Score em tempo real adiciona writes em `lead_score_history` por mensagem:** já é tabela existente; impacto desprezível
- **Admin com regex inválido:** validação client-side + try/catch backend (igual v1)
- **Categorias sem stages:** fallback para default genérico via `getCategoriesOrDefault`

## Validação Final

- [ ] `npx tsc --noEmit` 0 erros
- [ ] `npx vitest run` testes do helper passam (40+ casos v2)
- [ ] Migration v2 aplicada sem perda de dados de v1
- [ ] Agente existente com seed plano migrado automaticamente para stages padrão
- [ ] UI nova tab "Qualificação" renderiza, edita, salva
- [ ] Smoke E2E: lead "tinta" → Stage Identificação → responde 2 fields → score 30 → search_products
- [ ] Score persistido em `lead_score:N` tag + `lead_score_history` row
- [ ] 0 regressões na suite vitest (mesmas 5 falhas pré-existentes M12)

## Estimativa

- F1.5: ~1h30 (1 agente paralelo)
- F2 v2: ~3h (1 agente paralelo, refatoração maior)
- F3 v2: ~1h30 (manual + aprovação)
- F4 v2: ~1h (1 agente paralelo)
- F5: ~30min (manual)
- Auditoria + testes + apply migration: ~45min
- **Total v2:** ~7-8h
