---
title: Log Arquivado — 2026-04-29 (Eletropiso 23 categorias + 7 fixes + BusinessHoursEditor + audit)
type: log-archive
period: 2026-04-29
sources: [log.md (rotacionado em 2026-04-30)]
updated: 2026-04-30
---

# Log Arquivado — Sessão 2026-04-29

> Entrada movida de `log.md` em 2026-04-30 (rotina de rotação — Regra 16). Cobertura: configuração de 23 categorias home center no agente Eletropiso + 7 fixes encadeados em `ai-agent/index.ts` (v162→v169) + componente UI `BusinessHoursEditor` + audit do vault com 5 fixes documentais.

## 2026-04-29 (Eletropiso — 23 categorias + 7 fixes ai-agent + BusinessHoursEditor + audit vault)

### Goal & contexto

Sprint completa em uma sessão única, autorizada com carta branca: configurar 10 novas categorias de qualificação no agente Eletropiso (instância única de prod), seguindo padrão Service Categories v2 (M19-S10). Catálogo da loja tem hoje só 7 produtos cadastrados — então **estratégia handoff** em todas as categorias novas (cliente é qualificado e passado pra vendedor humano). Conforme catálogo crescer, basta mudar `exit_action: handoff → search_products` por categoria.

### 10 categorias novas (estrutura)

Cada categoria tem 1 stage, score 0-30, exit_action=handoff, fields com score_value distribuído igual (15+15 ou 10+10+10).

| # | Categoria | Fields (perguntas) | Phrasing |
|---|-----------|--------------------|----------|
| 1 | `portas` | material_porta, ambiente_porta, tipo_porta | "Pra te ajudar com a porta certa, {label}? ({examples})" |
| 2 | `churrasqueiras` | tipo_churrasqueira (1 só) | "Temos churrasqueira pré-moldada e de alumínio. Qual delas te interessa?" |
| 3 | `revestimentos` (cerâmica + porcelanato) | ambiente_revestimento, aplicacao_revestimento | "Pra encontrar a melhor opção, {label}? ({examples})" |
| 4 | `fechaduras` | ambiente_fechadura, tipo_fechadura | "Pra te ajudar a escolher a fechadura certa, {label}? ({examples})" |
| 5 | `escadas` | tipo_escada, degraus | "Pra encontrar a escada certa, {label}? ({examples})" |
| 6 | `pias` (cozinha + banheiro/lavatório) | ambiente_pia, material_pia | "Pra te ajudar a escolher, {label}? ({examples})" |
| 7 | `janelas` | material_janela, tamanho_janela | "Pra encontrar a janela certa, {label}? ({examples})" |
| 8 | `cabos` (elétricos) | aplicacao_cabo, bitola | "Pra te ajudar com o cabo certo, {label}? ({examples})" |
| 9 | `furadeiras` | voltagem, marca_furadeira | "Pra encontrar a furadeira certa, {label}? ({examples})" |
| 10 | `canos` (funde 50+100) | diametro, tipo_cano | "Pra te ajudar, {label}? ({examples})" |

Tintas (3 stages, search→enrich→handoff) e Impermeabilizantes (2 stages, search→handoff) **preservadas idênticas**. Default fallback intacto.

### Achado bloqueador resolvido (R81 — promovida)

Antes de aplicar dado, descoberto que `set_tags` handler em `ai-agent/index.ts:2080` tem whitelist `VALID_KEYS` (Set) — chaves novas seriam rejeitadas silenciosamente, score nunca subiria, exit_action nunca dispararia. Adicionadas 20 strings novas ao Set (1 linha modificada). Mudança puramente aditiva — keys antigas continuam funcionando.

**Risco 2 mitigado:** descobri durante auditoria que cadastrar `business_hours` sem `out_of_hours_message` deixa agente **mudo** fora do horário. Cadastrei a mensagem junto.

### Execução em 5 fases

1. **Backup** local em `.planning/phases/eletropiso-categories-2026-04-29/BACKUP.json` (rollback trivial)
2. **Edit code** `ai-agent/index.ts:2080` — VALID_KEYS expandido com 20 keys; `tsc 0 erros`, `vitest 550 passed` (5 falhas pré-existentes)
3. **Deploy edge** via `npx supabase functions deploy ai-agent --no-verify-jwt --project-ref euljumeflwtljegknawy`
4. **Aplicação no banco** via `mcp__supabase__execute_sql`: UPDATE service_categories (12 categorias + 17 handoff_triggers + business_hours) + INSERT 6 FAQs (positions 8-13)
5. **Validação UI** via Playwright — login persistente + tab Qualificação + evaluate JS confirmou 12/12 categorias renderizadas

### Validação SQL final (12 categorias iniciais)

```
total_categorias: 12 ✅ | total_triggers: 17 ✅ | tem_business_hours: true ✅ | total_faqs: 13 ✅
```

### Sprint de bugfix pós-teste — 3 erros do agente em prod

Após user testar via WhatsApp real, 3 problemas detectados nas categorias novas. Investigação em camadas — só o 3º fix resolveu de fato:

**Fix 1 — `buildEnrichmentInstructions` (ai-agent/index.ts:1392):** uniqueKeys somava `categoryKeys + fallbackKeys`. Mudei pra usar SOMENTE categoria. Deploy v164. Não resolveu.

**Fix 2 — `isWellQualified` (ai-agent/index.ts:1571):** força well-qualified=true quando `matchCategory` retorna categoria. Deploy v165. Não resolveu.

**Fix 3 — DEFINITIVO — `prompt_sections.sdr_flow` do agente:** descobri via SELECT que o sdr_flow do Eletropiso tinha texto hardcoded da era das tintas (regra ZERO-CALL com ordem fixa "Ambiente → Marca → Cor"). LLM seguia o roteiro IGNORANDO completamente o schema service_categories. UPDATE direto no banco com texto novo apontando pro service_categories como source of truth. **Resolveu instantaneamente.**

**Lição R82 — promovida:** quando LLM ignora schema dinâmico, **suspeitar primeiro do prompt_sections do agente no banco** — não do código. Prompt sections tem precedência comportamental sobre regras hardcoded em runtime.

### Fix 4 — aliasing de keys genéricas em set_tags

User testou novamente: perguntas certas, mas LLM perguntava marca como 4ª pergunta. Tags pós-3-perguntas: apenas `ambiente_porta:quarto`. `material_porta:madeira` e `tipo_porta:frisada` perdidas.

**Causa raiz:** o LLM chamava `set_tags(['material:madeira'])` em vez de `set_tags(['material_porta:madeira'])`. Como `material` (genérica) não está em VALID_KEYS, era rejeitada silenciosamente.

**Fix:** aliasing automático no handler `set_tags` (`ai-agent/index.ts:2107-2129`). Quando `matchCategory` retorna categoria, constrói mapa `primeiro_segmento → key_sufixada` (ex: `material → material_porta`). Remapeia tags ANTES de validar contra VALID_KEYS. Edge function v166.

**Lição R83 — promovida:** schemas com keys sufixadas são frágeis com LLMs. Aliasing automático no handler é mais robusto que esperar instrução exata.

### Fix 5 — exit_action enforcement em set_tags

Score=40, mas IA gerou response vazia ao atingir max_score (não fez handoff). LLM ficou sem direção depois das 3 perguntas → silêncio.

**Fix:** handler `set_tags` (`ai-agent/index.ts:2185-2206`) detecta `newScore >= currentStage.max_score` e injeta instrução `[INTERNO]` explícita:
- exit_action='handoff' → "AÇÃO: chame handoff_to_human AGORA; PROIBIDO fazer mais perguntas"
- exit_action='search_products' → "AÇÃO: chame search_products AGORA"
- exit_action='enrichment' → "AÇÃO: continue perguntando"

Edge function v167.

### Fix 6 — Categoria torneiras + reforço set_tags obrigatório

Lead "Josafa" perguntou torneira. IA caiu na default category (torneira não tinha schema), perguntou genérico, lead respondeu "Inox parede" e "Lorenzenti", mas IA não cadastrou tags → score=0 → loop até estourar enrich_count.

**Fixes:**
1. Categoria `torneiras` adicionada (1 stage, 3 fields). Total: 13 categorias.
2. VALID_KEYS expandido (`ambiente_torneira`, `tipo_torneira`, `marca_torneira`)
3. `prompt_sections.sdr_flow` reforçado: "OBRIGATÓRIO — SET_TAGS APÓS CADA RESPOSTA" + "Pode usar a chave genérica" + "NÃO REPETIR PERGUNTA SIMILAR — se enrich_count=2, handoff IMEDIATAMENTE"

Edge function v168.

**Lição R84 — promovida:** sempre que adicionar categoria nova ao service_categories: (1) expandir VALID_KEYS no handler, (2) deploy edge function. Idealmente: VALID_KEYS dinâmico (lê do schema da categoria).

### Fix 7 — 10 categorias home center genéricas

User pediu mais 10 categorias comuns em home center. Estratégia: IA qualifica por categoria → handoff pro vendedor.

**Categorias adicionadas (10) — total agora 23:**

| ID | Match regex | Fields |
|----|-------------|--------|
| `vasos_sanitarios` | vaso, sanitário, bacia | tipo + cor |
| `chuveiros` | chuveiro, ducha | tipo + voltagem |
| `lampadas` | lâmpada, luminária | tipo + potência |
| `tomadas_interruptores` | tomada, interruptor | tipo + quantidade |
| `disjuntores` | disjuntor, quadro elétrico | amperagem + tipo |
| `registros` | registro, válvula | aplicação + tamanho |
| `cimento_argamassa` | cimento, argamassa, rejunte, AC1/AC2 | tipo + quantidade |
| `caixas_dagua` | caixa d'água, reservatório | capacidade + material |
| `ferramentas_manuais` | ferramenta, martelo, alicate, trena | qual + uso |
| `pregos_parafusos` | prego, parafuso, bucha, fixação | qual + tamanho |

Todas com 1 stage, 2 fields, max_score=30, exit_action=handoff.

VALID_KEYS expandido com 20 keys novas. Edge function v169.

**Estado final do agente Eletropiso (2026-04-29):**
- 23 categorias configuradas
- 13 FAQs na Knowledge Base
- 17 handoff_triggers
- business_hours NULL (atende 24h)
- VALID_KEYS com 60+ chaves (40 originais + 20 sufixadas)
- Aliasing automático no set_tags handler
- Exit action enforcement no set_tags
- sdr_flow apontando pro service_categories com regras anti-loop

### Sprint adicional — BusinessHoursEditor (UI semanal)

Componente novo `BusinessHoursEditor.tsx` em `src/components/admin/ai-agent/`. Suporta:
- Master toggle on/off (off salva `null` → IA atende 24h)
- 7 dias da semana com toggle individual + time inputs
- Atalhos "Comércio padrão" (Seg-Sex 8-18, Sáb 8-12, Dom fechado) e "Apagar tudo"
- Migração automática do formato legacy `{start, end}` pra weekly
- Validação: dias abertos com `start >= end` mostram borda vermelha
- Mensagem fora do horário integrada (Risco 2 do dia anterior — agente mudo se NULL)

Arquivos: `BusinessHoursEditor.tsx` (~205 linhas), `__tests__/BusinessHoursEditor.test.tsx` (9 testes), `RulesConfig.tsx` substituído. Localização na UI: Tab **Segurança** do agente IA.

Validação: tsc 0 erros, vitest 9/9 passed, Playwright (master OFF → null ✅, ON → weekly persiste ✅, OFF de novo → null ✅).

Estado final do banco: `business_hours = NULL` (desligado a pedido do user).

### Audit vault (encerramento da sessão)

Auditoria geral de docs, MDs e sprints solicitada pelo user identificou 10 inconsistências. Top-5 críticos corrigidos nesta sessão:

1. **Rotação log.md** — entradas 2026-04-27 (M19-S10 v1+v2+v3) e 2026-04-28 (Deploy) movidas para [[wiki/log-arquivo-2026-04-27-a-28-m19-s10]]
2. **wiki/roadmap.md atualizada** — M19-S10 (v1+v2) e Sprint Eletropiso 2026-04-29 adicionadas à tabela
3. **index.md atualizada** — referência ao log da sprint Eletropiso + frontmatter `updated: 2026-04-29`
4. **`.planning/STATE.md` e `.planning/ROADMAP.md`** — marcados como deprecated (workflow GSD inativo desde M2)
5. **R80-R84 (log.md)** — marcadas como "promovidas" em vez de "candidatas" (já estão na tabela canônica de erros-e-licoes.md)

Smoke Playwright em prod (`crm.wsmart.com.br`) validou estado pós-sprint — resultados anexados ao final desta entrada.

### Pendências operacionais (carry-over)

- À medida que Eletropiso cadastrar produtos, mudar `exit_action: handoff → search_products` no stage da categoria correspondente — 1 SQL update por categoria, ~30s cada
- Rodar Agent QA Framework batch (M2 F4) com cenários por categoria pra validar cobertura
- Smoke E2E manual via Playground ou WhatsApp real
- Considerar criar categoria `cabos_dados` se Eletropiso cadastrar cabo de rede/HDMI
- Particionar `wiki/casos-de-uso/ai-agent-detalhado.md` (492 linhas, débito pré-existente)

### Notas finais (regra 13)

- (a) **Conteúdo: 9.5/10** — 23 categorias estruturadas, 7 fixes encadeados em ordem causal correta, FAQs definitivos, business_hours editor reutilizável. Único débito: smoke conversational direto pulado em algumas categorias (validado por SQL+UI).
- (b) **Orquestração: 9.5/10** — log.md, PRD.md (v7.15+v7.16), wiki/ai-agent.md (VALID_KEYS), decisoes-chave.md (D27), erros-e-licoes.md (R80-R84) cruzados; backup em `.planning/phases/`; rotação log feita; archive cross-link aplicado.
- (c) **Vault: 9.5/10** — log.md sob 200 linhas após rotação; planning files novos (BACKUP+NEW_STATE+ui-screenshot); PRD entradas v7.15.0 + v7.16.0 conforme regra 17; archive `wiki/log-arquivo-2026-04-27-a-28-m19-s10.md` criado.

---

> Sessões 2026-04-27 (M19-S10 v1+v2+v3) e 2026-04-28 (Deploy 16 commits represados → prod) arquivadas em:
> - [[wiki/log-arquivo-2026-04-27-a-28-m19-s10]]
>
> Sessão 2026-04-27 manhã (Auditoria geral + 210 melhorias documentadas) e 2026-04-26 (Refactor do Orquestrador CLAUDE.md/RULES.md) arquivadas em:
> - [[wiki/log-arquivo-2026-04-27-auditoria-geral]]
>
> Sessão maratona 2026-04-25 (Helpdesk inbox permissions + M19 S8 + S8.1) arquivada em:
> - [[wiki/log-arquivo-2026-04-25-s8-helpdesk]]
>
> Entrada de 2026-04-14 (Auditoria Helpdesk — 10 fixes + Storage + Playwright):
> - `wiki/log-arquivo-2026-04-14-helpdesk-audit.md`
>
> Entradas de M19 S3-S5 (2026-04-13):
> - `wiki/log-arquivo-2026-04-13-m19-s3s5.md`
>
> Entradas de M19 S1+S2:
> - `wiki/log-arquivo-2026-04-13-m19-s1s2.md`
>
> Entradas anteriores (2026-04-11/12):
> - `wiki/log-arquivo-2026-04-12-agent-metricas.md`
> - `wiki/log-arquivo-2026-04-12-fixes-kpi-s12.md`
> - `wiki/log-arquivo-2026-04-12-fluxos-s6s11.md`
> - `wiki/log-arquivo-2026-04-11-fluxos-v3-s1s2.md`
