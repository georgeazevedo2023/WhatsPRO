# M19-S10 v3 — Qualificacao UX Redesign

**Status:** planning (auditado 2026-04-27, GO_WITH_CAVEATS)
**Branch:** `feat/qualif-ux-redesign`
**Estimativa:** ~8-9h em 3 frentes (F1 + F2 + F3) — revisado pós-audit
**Premissas:** schema JSONB intacto (D26 v2 preservada), auto-save mantido, backward compat 100%, slugs imutáveis em items existentes

---

## Goal

Tornar a tab "Qualificacao" do AI Agent acessível para administradores **leigos** (sem background técnico). Substituir jargão (regex, slug, exit_action, score_value, priority, phrasing template) por linguagem humana, com tipografia maior e modo Iniciante/Avançado opcional.

## Why

- M19-S10 v2 atende devs/power-users mas barra adoção por admins de PME
- Pergunta-chave do usuário: "onde acho 'fosco/brilho'?" — UX atual exige conhecimento de stages, fields, slugs
- Item #10 das melhorias do AI Agent foi shipado conceitualmente (D26 v2) mas a UX não foi avaliada para usabilidade
- Cruzamento com R78 (multi-tenant): se admin não consegue editar, plataforma volta a depender de devs por nicho

## Non-goals

- ❌ Mudar schema JSONB (`service_categories`)
- ❌ Mudar lógica do helper `_shared/serviceCategories.ts`
- ❌ Mudar `ai-agent/index.ts` (HIGH RISK, intacto nessa fase)
- ❌ Tocar `ai-agent-playground/index.ts` (gap separado, fase futura)

---

## Frente 1 — Linguagem Humana

### F1.1 Renomear labels e descrições no card categoria

**Arquivo:** `src/components/admin/ai-agent/ServiceCategoriesConfig.tsx`

| Lugar (linha aprox.) | Antes | Depois |
|---|---|---|
| header categoria | "ID (slug único)" | "Identificador interno" + tooltip ℹ️ "Usado para referência técnica. Auto-gerado." |
| header categoria | "Label" | "Nome do tipo de produto" |
| header categoria | "Interesse Match (regex)" | "Como o cliente costuma chamar?" + dica abaixo: "Separe por vírgula. Ex: tinta, esmalte, verniz" |
| input regex | placeholder `tinta\|esmalte\|verniz` | placeholder `tinta, esmalte, verniz` (UI converte vírgula→pipe ao salvar; e pipe→vírgula ao mostrar) |
| stage card header | "Stage 1" `Identificação` | "Etapa 1" `Identificação` (preserva `id` e `label` no banco) |
| stage card | "Range de Score" | "Quando avançar para próxima etapa?" + tooltip explicando |
| stage card | "MIN SCORE / MAX SCORE" | "Começa em / Termina em" + sufixo "pts" |
| stage card | "Ação ao final do Stage (Exit Action)" | "O que a IA faz quando termina esta etapa?" |
| field card | "Qualification Fields" | "Perguntas desta etapa" |
| field row | "CHAVE (SLUG)" | "Identificador interno" (oculto em modo Iniciante) |
| field row | "LABEL" | "Nome da pergunta" |
| field row | "EXEMPLOS" | "Exemplos de resposta esperada" |
| field row | "SCORE (PTS)" | "Peso da pergunta" |
| field row | "PRIORITY" | (oculto em modo Iniciante; drag-and-drop substitui) |
| phrasing template | `"Para encontrar a melhor opção, qual {label}? ({examples})"` (raw) | "Texto da pergunta" + chips clicáveis: `[+ Nome da pergunta]` `[+ Exemplos]` para inserir `{label}` `{examples}` |

### F1.2 Tradução do dropdown Exit Action

| value (não muda) | Antes | Depois |
|---|---|---|
| search_products | "Buscar produtos" | "🔍 IA busca produto" + descrição: "Quando atingir esse score, IA chama search_products" |
| enrichment | "Enriquecer" | "➕ Continua perguntando" + descrição: "IA pergunta mais detalhes para refinar" |
| handoff | "Transferir" | "👤 Chama vendedor humano" + descrição: "IA passa a conversa para atendente" |
| continue | "Continuar" | "⏭️ Avança para próxima etapa" |

### F1.3 Tooltips contextuais (Radix Tooltip)

Adicionar `<Tooltip>` em 6 locais:
- Identificador interno (categoria) — "Auto-gerado a partir do nome. Não precisa editar."
- Como cliente costuma chamar — "Quando o cliente usar uma dessas palavras na conversa, esta categoria é ativada."
- Quando avançar — "Pontos que o lead acumula. Quando atingir o limite, dispara a ação configurada."
- O que a IA faz — "Decide se a IA continua perguntando, busca produto ou transfere."
- Peso da pergunta — "Quanto essa resposta vale na qualificação. Maior peso = mais importante."
- Texto da pergunta — "Use `{label}` para inserir o nome da pergunta. Use `{examples}` para inserir exemplos."

---

## Frente 2 — Modo Iniciante / Avançado

### F2.1 Toggle de modo

Estado novo no componente: `const [uiMode, setUiMode] = useState<'simple' | 'advanced'>('simple')`

Persistido em `localStorage.qualif-ui-mode` (não em DB — preferência por usuário).

UI: header da seção "Categorias de Atendimento" com 2 botões `<Tabs>`:
```
🌱 Iniciante  |  🔧 Avançado
```

### F2.2 Campos ocultos em modo Iniciante

| Campo | Iniciante | Avançado |
|---|---|---|
| `id` (slug) categoria | oculto (auto-gera de label) | visível |
| `id` (slug) stage | oculto | visível |
| `key` (slug) field | oculto (auto-gera de label) | visível |
| `priority` field | oculto (drag-only) | visível |
| `phrasing` template | mostra preview, botão "Customizar" abre modal | visível inline |
| `min_score`/`max_score` numeric inputs | substituído por slider visual + label "Avança quando atingir X pts" | inputs separados |
| `score_value` | substituído por radio "leve (5pts) / médio (10pts) / importante (20pts)" | input number |

### F2.3 Auto-geração de slug (com guardrail crítico)

Função `slugify` já existe (linha ~404 do componente). No modo Iniciante, ao digitar o `label`, dispara `slugify(label)` e atualiza `key`/`id` automaticamente.

**🚨 GUARDRAIL CRÍTICO (audit M1):** auto-slugify SÓ atualiza slug em items **recém-criados** (sem `key`/`id` preexistente quando o componente carregou). Items que vieram do banco (carregados no `useState` inicial) **NUNCA** têm o slug regravado, mesmo em modo Iniciante. Razão: slugs são referenciados em `qualification_data` de leads existentes e em matchers do helper `_shared/serviceCategories.ts`. Mudar slug pós-criação = quebrar histórico de leads em prod (ex: agente Eletropiso).

Implementação: rastrear via `Set<string>` os slugs presentes no carregamento inicial (`initialSlugsRef`). Antes de auto-slugify, verificar se já existe nesse set — se sim, abort. Em modo Avançado, slug é editável e independente.

**Cobertura de teste:** vitest novo `autoSlugifyGuardrail.test.tsx` validando "edit existing label preserves original slug".

### F2.4 Slider visual de score range

Novo subcomponente `<StageScoreSlider>` que renderiza um slider de 2 thumbs (Radix Slider já em uso):
```
Etapa 1: Identificação
[━━━━━━━━○━━━━━━━━━━━○━━━━━━━━━━] 0  ────  30 pts
                                   ↑           ↑
                              começa aqui   termina aqui
```

Em modo Avançado, mantém os 2 inputs number atuais.

### F2.5 Editor de Phrasing Template — modo Iniciante

Modal acionado pelo botão "Customizar texto":
```
┌─ Customizar texto da pergunta ──────────────┐
│                                              │
│ ┌─────────────────────────────────────────┐ │
│ │ Para encontrar a melhor opção,          │ │
│ │ qual [Nome da pergunta]?                │ │
│ │ ([Exemplos])                            │ │
│ └─────────────────────────────────────────┘ │
│                                              │
│ Inserir tag: [Nome da pergunta] [Exemplos]  │
│                                              │
│ Preview ao vivo:                            │
│ "Para encontrar a melhor opção, qual        │
│  ambiente? (interno ou externo)"            │
│                                              │
│ [Cancelar]               [Salvar]           │
└──────────────────────────────────────────────┘
```

Por baixo continua salvando como `{label}`/`{examples}` no banco. UI só apresenta como chips/tags.

---

## Frente 3 — Tipografia + Espaçamento

### F3.1 Aumentar fontes

Tailwind classes a alterar no `ServiceCategoriesConfig.tsx`:

| Classe atual | Classe nova |
|---|---|
| `text-xs` (labels superiores tipo "CHAVE", "LABEL") | `text-sm` |
| `text-sm` (inputs e descrições) | `text-base` |
| `text-base` (headings stage) | `text-lg` |
| `text-lg` (heading categoria) | `text-xl` |
| `font-mono text-xs` (regex input) | `font-mono text-sm` |

### F3.2 Espaçamento

| Classe atual | Classe nova |
|---|---|
| `gap-3` entre fields | `gap-5` |
| `gap-2` entre stages | `gap-4` |
| `p-4` cards | `p-6` |
| `space-y-2` (label + input) | `space-y-2.5` |

### F3.3 Ícones contextuais

Lucide-react icons a adicionar:
- 🎯 `Target` ao lado de "Nome do tipo de produto"
- 💬 `MessageSquare` ao lado de "Como o cliente costuma chamar?"
- 📊 `Activity` ao lado de "Quando avançar"
- 🚪 `LogOut` ao lado de "O que a IA faz"
- ✏️ `Pencil` ao lado de "Texto da pergunta"
- 🎚️ `Sliders` ao lado de "Peso da pergunta"

### F3.4 Removendo ruído visual

- Esconder o label "FUNIL DE SCORE" (a barra colorida abaixo já é auto-explicativa)
- Substituir o display "id: tintas · match: tinta\|esmalte..." na header colapsada por um chip mais amigável: `🎯 Tintas e Vernizes · 3 etapas · ativa quando o cliente diz "tinta", "esmalte", "verniz"...`

---

## Tarefas em ordem (24 tasks)

### Setup (2)
1. ✅ Branch `feat/qualif-ux-redesign` criado
2. Criar pasta `src/components/admin/ai-agent/service-categories/` (nova) — extraídos vão aqui:
   - `service-categories/PhrasingEditorModal.tsx`
   - `service-categories/StageScoreSlider.tsx`
   - `service-categories/useUiMode.ts` (hook localStorage)
   - `service-categories/regexCsvConvert.ts` (helpers F1.1.d)

   Manter `ServiceCategoriesConfig.tsx` no path atual + re-export para preservar import em `AIAgentTab.tsx:26`.

### Frente 3 — Tipografia + chip header (5) — faz primeiro (rápido, baixo risco)
3. F3.1 — Aumentar fontes (~15 substituições)
4. F3.2 — Aumentar espaçamento (~10 substituições)
5. F3.3 — Adicionar 6 ícones contextuais nos labels
6. F3.4.a — Esconder label "FUNIL DE SCORE" (barra colorida basta)
7. F3.4.b — Header colapsada da categoria com chip amigável

### Frente 1 — Linguagem humana (6)
8. F1.1.a — Renomear labels da categoria (ID, Label, Interesse Match)
9. F1.1.b — Renomear labels do stage (Range, MIN, MAX, Exit Action)
10. F1.1.c — Renomear labels dos fields (CHAVE, LABEL, EXEMPLOS, SCORE, PRIORITY)
11. F1.2 — Traduzir dropdown Exit Action (4 opções com emoji + descrição)
12. F1.3 — Adicionar 6 tooltips Radix
13. F1.1.d — Conversão regex↔csv no input "Como cliente costuma chamar?" (com warning para regex complexa)

### Frente 2 — Modo Iniciante/Avançado (8)
14. F2.1 — Criar `useUiMode` hook (localStorage + state)
15. F2.1 — Tabs toggle no header da seção
16. F2.2.a — Conditional render: ocultar `id`/`key` (slug) em Iniciante
17. F2.2.b — Conditional render: ocultar `priority` em Iniciante
18. F2.3 — Auto-slugify com **guardrail** (`initialSlugsRef` Set, slugs existentes imutáveis)
19. F2.4 — Subcomponente `<StageScoreSlider>` (Radix Slider 2-thumbs)
20. F2.2.c — Substituir `score_value` input number por `<RadioGroup>` leve/médio/importante em Iniciante
21. F2.5 — Subcomponente `<PhrasingEditorModal>` + botão "Customizar texto"

### Testes (3)
22. `npx tsc --noEmit` (0 erros)
23. `npx vitest run` — 4 testes novos:
    - `useUiMode.test.ts` — localStorage persist
    - `regexCsvConvert.test.ts` — round-trip
    - `autoSlugifyGuardrail.test.tsx` — slugs existentes preservados (M1 fix)
    - `ServiceCategoriesConfigBackwardCompat.test.tsx` — render com fixture do Eletropiso real (audit m5)
24. Smoke test Playwright: login → tab Qualificacao → toggle Iniciante/Avançado → editar field existente → confirmar slug INALTERADO no banco; criar field novo → confirmar slug auto-gerado

---

## Critérios de aceitação

| # | Critério | Como verificar |
|---|---|---|
| C1 | Modo Iniciante esconde slug, priority, phrasing inline | Visual + DOM check |
| C2 | Modo Avançado mostra todos os campos atuais | Visual + DOM check |
| C3 | Toggle persiste em localStorage entre reloads | F12 → Application → localStorage |
| C4 | Auto-slugify funciona ao digitar label em modo Iniciante | Digite "Cor preferida" → slug deve virar "cor_preferida" |
| C5 | Conversão regex↔csv funciona | Input "tinta, esmalte" deve gravar `tinta\|esmalte` no DB |
| C6 | Dropdown Exit Action tem emoji + descrição | Visual |
| C7 | 6 tooltips aparecem ao hover | Hover ℹ️ ícones |
| C8 | Modal Phrasing edita corretamente e salva | Editar template, fechar, reabrir, valor preservado |
| C9 | Slider de score funciona e atualiza min/max | Drag thumbs, validar valores |
| C10 | Auto-save continua funcionando | Editar, esperar 2s, recarregar, mudança persiste |
| C11 | tsc 0 erros | `npx tsc --noEmit` |
| C12 | Sem regressões — agentes existentes carregam normalmente | Abrir Eletropiso após deploy |
| C13 | Zero migrations adicionadas | `git diff master --stat -- supabase/migrations/` retorna vazio |
| C14 | HIGH RISK files intactos | `git diff master --stat` não menciona `ai-agent/index.ts`, `ai-agent-playground/index.ts`, `e2e-test/index.ts`, `types.ts` |
| C15 | Slug de items existentes preservado em modo Iniciante | Vitest `autoSlugifyGuardrail.test.tsx` + smoke Playwright |

---

## Riscos & Mitigações

| Risco | Severidade | Mitigação |
|---|---|---|
| Componente já tem 1518 linhas; F2 pode inchar para 2000+ | Médio | Extrair `<PhrasingEditorModal>` e `<StageScoreSlider>` para arquivos próprios |
| Radix Slider 2-thumbs pode dar bug visual com valores próximos | Baixo | Usar `Slider` com `min={0}` `max={100}` `step={5}` e validação de min<max |
| Auto-slugify pode bagunçar dados de agentes existentes | Médio | Só dispara quando user EDITA o label em modo Iniciante. Modo Avançado preserva slug independente |
| Conversão regex↔csv pode quebrar com regex complexa (ex: `tinta(s)?`) | Médio | Em modo Iniciante, se regex tem chars especiais (`()[]\|?+*`), mostra warning e força modo Avançado para edição |
| Tooltips podem quebrar acessibilidade | Baixo | Usar Radix Tooltip (já a11y-compliant) |
| F2 toggle pode confundir mais do que ajudar | Médio | Iniciante é default; admin pode ir para Avançado se precisar |

---

## Auditoria do plano — feita 2026-04-27 (gsd-plan-checker)

**Verdict:** GO_WITH_CAVEATS

| # | Categoria | Item | Endereço |
|---|---|---|---|
| M1 | MAJOR | Auto-slugify pode quebrar slugs existentes (qualification_data + matchers) | ✅ Adicionado guardrail em F2.3 + teste vitest C15 |
| M2 | MAJOR | Conflito com `tipo_tinta` recém-adicionado em prod | ⏳ Documentar snapshot DB Eletropiso em log.md antes de iniciar |
| m1 | MINOR | Tasks F3.4 estavam em F2 | ✅ Movidas para F3 (tasks 6-7) |
| m2 | MINOR | Path dos componentes extraídos não definido | ✅ Definido em Setup (`service-categories/` subdir) |
| m3 | MINOR | Estimativa otimista | ✅ Atualizada para 8-9h |
| m4 | MINOR | C7 (tooltip hover) frágil em Playwright | ✅ Movido para vitest com @testing-library |
| m5 | MINOR | Testes vitest insuficientes | ✅ +2 testes: autoSlugifyGuardrail + BackwardCompat fixture |
| n1 | NIT | Gitignore `.playwright-mcp/` mistura cleanup | ✅ Removido das tasks (commit separado de housekeeping) |
| n2 | NIT | C13 não-verificável | ✅ Reescrito como "zero migrations adicionadas" |
| n3 | NIT | Falta C14 HIGH RISK diff check | ✅ Adicionado |

---

## Plano de teste (após executar)

### Smoke E2E Playwright (cobre C1-C7, C12)
1. Login como super_admin
2. Abrir `/dashboard/ai-agent` → Eletropiso → tab Qualificacao
3. Validar modo Iniciante é default
4. Toggle para Avançado, ver campos extras aparecerem
5. Reload page, validar modo persiste (Avançado)
6. Toggle para Iniciante de novo
7. Expandir "Tintas e Vernizes"
8. Validar:
   - Não vê "ID (slug único)"
   - Não vê "PRIORITY"
   - Vê chip amigável no header colapsado
   - Vê "🔍 IA busca produto" no exit_action
9. Editar label de um field para "Cor preferida"
10. Validar key auto-virou "cor_preferida"
11. Editar slider de score range
12. Aguardar 5s, query banco para validar persistência

### Manual checks (cobre C8-C11)
- Hover nos 6 ícones ℹ️ → tooltips aparecem
- Click em "Customizar texto" → modal abre, editar phrasing, salvar, reabrir, valor preservado
- `npx tsc --noEmit` no final

### Testes vitest (a criar)
- `ServiceCategoriesConfig.test.tsx` — render Iniciante vs Avançado
- `useUiMode.test.ts` — localStorage persist
- `regexCsvConvert.test.ts` — round-trip conversion

---

## Checklist final antes do PR

- [ ] tsc 0 erros
- [ ] vitest 100%
- [ ] Smoke Playwright OK
- [ ] HIGH RISK files intactos (git diff)
- [ ] Schema DB unchanged (sem migration)
- [ ] log.md atualizado
- [ ] PRD.md changelog atualizado (v7.14.1)
- [ ] wiki/decisoes-chave.md — D27 (UX Redesign Qualif)
- [ ] wiki/casos-de-uso/ai-agent-detalhado.md — seção Service Categories atualizada com modo Iniciante/Avançado
