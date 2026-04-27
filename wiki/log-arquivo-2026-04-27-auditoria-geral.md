---
title: Log Arquivo — 2026-04-27 Auditoria Geral + 2026-04-26 Refactor Orquestrador
type: log-arquivo
period: 2026-04-26 a 2026-04-27 (manhã)
sources: [log.md]
updated: 2026-04-27
---

# Log Arquivo — 2026-04-27 Auditoria Geral + 2026-04-26 Refactor Orquestrador

> Entradas arquivadas de `log.md` para manter <200 linhas (regra 16 do CLAUDE.md).

---

## 2026-04-27 (Auditoria geral do projeto + 210 melhorias documentadas)

### Auditoria executada (somente leitura)

Cobertura: protocolo de início (5 arquivos), 4 MDs raiz, 21 wikis, 38 edge functions, estrutura `src/`, 30 migrations recentes, git status. **Nenhum arquivo de código modificado.**

### 24 inconsistências detectadas

- **10 críticas** — README template Lovable; PRD v7.11→v7.13 desatualizado; AGENTS sem OpenAI; contagens divergentes de edge functions (30/31/32 vs 38 reais); banco-de-dados.md em 66 linhas para 60+ tabelas; modulos.md sem M19
- **9 médias** — frontmatter `updated:` desatualizado em 6 wikis (visao-produto, arquitetura, ai-agent, banco-de-dados, modulos, roadmap, erros-e-licoes, decisoes-chave); index.md inconsistente em data; CLAUDE.md tabela "120 linhas" para arquivo de 125
- **5 operacionais** — `10 MODELOS DE LINK NA BIO.html` órfão; 6 arquivos em `.planning/` de sprints já shipped; helpdesk-detalhado.md em 522 linhas (viola regra 14); 5 edge functions sem wiki dedicada

### Achado estrutural — pergunta "brilho/fosco" hardcoded

Identificada em 4 locais sem possibilidade de configuração admin:
- `supabase/functions/ai-agent/index.ts:1167` — regra "QUALIFICAÇÃO DE TINTAS"
- `supabase/functions/ai-agent/index.ts:1171` — texto literal "fosco ou brilho"
- `supabase/functions/ai-agent/index.ts:1336-1368` — `buildEnrichmentInstructions()` com `if (interesse.includes('tinta'))`
- `src/data/nicheTemplates.ts:55` — template "Home Center"

Solução proposta: tabela `ai_agent_enrichment_rules` JSONB editável via UI admin (item #10 incluído em [[wiki/melhorias-modulos-inteligencia]]). **Em execução em M19-S10 (ver entrada principal do log).**

### 210 melhorias documentadas (10 por módulo × 21 módulos)

Particionadas em 5 wikis temáticas (cada uma sob 200 linhas):

- [[wiki/melhorias-auditoria-2026-04-27]] — Índice + bugs + sumário (~120 linhas)
- [[wiki/melhorias-modulos-comunicacao]] — Helpdesk, Broadcast, Forms (30 itens)
- [[wiki/melhorias-modulos-inteligencia]] — AI Agent, Profiles, Motor, Enquetes/NPS, Fluxos (50 itens)
- [[wiki/melhorias-modulos-leads-crm]] — Leads, Kanban, Catálogo (30 itens)
- [[wiki/melhorias-modulos-canais]] — Campanhas, Bio, Funis (30 itens)
- [[wiki/melhorias-modulos-plataforma]] — Dashboard, Gestor, Assistente, Instâncias, Admin, Doc (70 itens)

### Notas finais

- (a) Conteúdo: 9/10 (auditoria abrangente, gaps mapeados com paths/linhas)
- (b) Orquestração: 9/10 (5 wikis novas referenciadas + index a atualizar)
- (c) Vault: 9/10 (todos os novos MDs sob 200 linhas, frontmatter completo)

### Correções aplicadas após auditoria (mesma sessão 2026-04-27)

**3 reescritas completas (Write):**
- `README.md` (73 → 102 linhas) — Removido template Lovable. Adicionado overview real, stack, roles, quickstart, deploy, links para vault
- `AGENTS.md` (95 → ~140 linhas) — Stack completo com OpenAI primário, 9 tools (`send_poll` incluída), 38 edge functions, M1-M19 listados, 17 shared modules
- `wiki/banco-de-dados.md` (66 → ~125 linhas) — Schema completo cobrindo M16-M19: funnels, automation_rules, agent_profiles, poll_*, flow_*, lead_*_memory, notifications, db_*, instance_goals, lead_score_history, conversion_funnel_events. Lista RPCs e cron jobs.

**Edits pontuais:**
- `PRD.md:3` — Header v7.11 → v7.13.0 (2026-04-25), 32 → 38 edge fns, 57 → 60+ tabelas, M18 + M19 S5/S8/S8.1 mencionados
- `ARCHITECTURE.md` — 31 → 38 edge fns, 17 → 19 módulos, "17 Wikis" → "21 Wikis"
- `index.md` — Tabela com contagens reais (CLAUDE 125, RULES 172, ARCH 99, PATTERNS 150, +AGENTS 140 +PRD 3200)
- `wiki/visao-produto.md` — Frontmatter `updated`, "17 Modulos" → 19, versão 7.9.0 → 7.13.0, tabela "Numeros do Projeto" toda atualizada
- `wiki/visao-geral-completa.md` — Frontmatter + "17 Modulos" → 19
- `wiki/arquitetura.md` — Frontmatter + 31 → 38 edge fns
- `wiki/ai-agent.md` — Frontmatter `updated: 2026-04-27`
- `wiki/roadmap.md` — Frontmatter `updated: 2026-04-27`
- `wiki/decisoes-chave.md` — Frontmatter `updated: 2026-04-27` + tag `db-retention`
- `wiki/modulos.md` — Frontmatter + **M19 inteiro adicionado** (S1-S5, S8, S8.1 detalhadas + S6/S7/S9 pendentes)
- `wiki/erros-e-licoes.md` — Frontmatter + R32-R35 adicionadas na tabela superior (estavam só no histórico abaixo)

**Notas finais (após correções):**
- (a) Conteúdo: 10/10 (todas as inconsistências críticas + médias resolvidas)
- (b) Orquestração: 10/10 (todos os arquivos referenciados, contagens consistentes)
- (c) Vault: 10/10 (todos sob 200 linhas, frontmatter completo, datas sincronizadas)

**Pendente (operacional, não-crítico):**
- ~~Arquivar `.planning/m19-s4-*`, `m19-s5-*`, `m19-s8-PLAN.md` (sprints shipped)~~ ✅ resolvido (ver abaixo)
- ~~Decidir sobre `10 MODELOS DE LINK NA BIO.html` na raiz~~ ✅ resolvido (ver abaixo)
- ~~Particionar `helpdesk-detalhado.md` (522 linhas, viola regra 14)~~ ✅ resolvido (ver abaixo)
- ~~Discussão "brilho/fosco" — solução estrutural a definir com usuário~~ ✅ em execução em M19-S10

### Limpeza pós-correção: helpdesk-detalhado.md particionado em 5 sub-wikis

- **Arquivo origem:** `wiki/casos-de-uso/helpdesk-detalhado.md` (522 linhas — violava regra 14 do CLAUDE.md, max 200)
- **Estratégia:** Particionar por **área conceitual** (organização/IA/comunicação/UX/permissões), mantendo o arquivo principal como **índice** (preserva os 8+ wikilinks existentes em outros docs).
- **5 sub-wikis criadas:**
  - `helpdesk-organizacao.md` (186 linhas) — 1.2 Etiquetas, 1.3 Tags, 1.4 Notas Privadas, 1.6 Status, 1.7 Prioridade, 1.8 Atribuição, 1.9 Departamentos, 1.10 Bulk Actions
  - `helpdesk-ia.md` (114 linhas) — 1.5 Toggle IA, 1.13 Transcrição, 1.14 Resumo IA, 1.18 Finalização (TicketResolution), 1.20 Contexto do Lead
  - `helpdesk-comunicacao.md` (92 linhas) — 1.11 Templates `/`, 1.12 Mídia (10 tipos), 1.17 Rascunhos, 1.24 Emoji, 1.25 Reply
  - `helpdesk-ux.md` (109 linhas) — 1.1 Layout 3 paineis, 1.15 Typing, 1.16 Tempo de Espera, 1.19 Histórico, 1.21 Busca Global, 1.22 Filtros, 1.23 Realtime + som
  - `helpdesk-permissoes.md` (97 linhas) — 1.26 Permissões Granulares (D21) + Árvore de Componentes (apêndice)
- **Índice principal** (`helpdesk-detalhado.md`) reduzido de 522 → **56 linhas** com tabela de sub-páginas, guia "como navegar" e Links Relacionados.
- **Conteúdo preservado integralmente** — copiado textualmente das seções 1.X originais; nada foi reescrito ou perdido. Numeração 1.X mantida em todos os sub-wikis para preservar referências externas.
- **`index.md` atualizado** — tabela "Documentacao Detalhada por Funcionalidade" agora mostra o índice + 5 sub-wikis indentadas com `↳`.

**Resultado:** 1 arquivo de 522 linhas → 6 arquivos sob 200 linhas (média ~109). Todos os 8+ wikilinks existentes para `helpdesk-detalhado` continuam funcionando (caem no índice). Atendente que quer "como atribuir agente" abre direto `helpdesk-organizacao` em vez de rolar 522 linhas.

### Limpeza pós-correção: arquivos órfãos de sprints shipped → .planning/phases/

Seguiu a convenção existente em `.planning/phases/` (M2-F1-persistent-history etc.). 6 arquivos órfãos da raiz de `.planning/` movidos para 3 pastas de fase:

| De | Para |
|----|------|
| `.planning/m19-s4-PLAN.md` | `.planning/phases/M19-S4-fichas-individuais/PLAN.md` |
| `.planning/m19-s4-RESEARCH.md` | `.planning/phases/M19-S4-fichas-individuais/RESEARCH.md` |
| `.planning/m19-s4-p2-SUMMARY.md` | `.planning/phases/M19-S4-fichas-individuais/p2-SUMMARY.md` |
| `.planning/m19-s5-PLAN.md` | `.planning/phases/M19-S5-ia-conversacional/PLAN.md` |
| `.planning/m19-s5-RESEARCH.md` | `.planning/phases/M19-S5-ia-conversacional/RESEARCH.md` |
| `.planning/m19-s8-PLAN.md` | `.planning/phases/M19-S8-db-monitoring/PLAN.md` |

`.planning/` raiz agora tem apenas os arquivos canônicos (config.json, MILESTONES.md, PROJECT.md, RETROSPECTIVE.md, ROADMAP.md, STATE.md) e as pastas estruturadas (codebase, milestones, phases, prereqs, research). Sprints M19-S4/S5/S8 ficam descobríveis pelo padrão consistente com as outras 11 fases já presentes em `phases/`.

### Limpeza pós-correção: galeria Bio Link movida para docs/referencia/

- **Arquivo:** `10 MODELOS DE LINK NA BIO.html` (144KB, untracked, raiz do projeto, espaços + maiúsculas)
- **Ação:** `mv` para `docs/referencia/bio-link-galeria-10-modelos.html` (nome limpo)
- **Por quê:** Asset de design (10 templates HTML inline para nichos: corretor, advocacia, personal trainer, etc.) gerado em 2026-04-08 como referência para futuros templates do M14 Bio Link. Não é código nem doc canônica, mas vale guardar como inspiração.
- **Documentação:** Referência adicionada em [[wiki/casos-de-uso/bio-link-detalhado]] na seção introdutória, ligando à melhoria #1 do Bio Link (templates customizáveis por nicho — ver [[wiki/melhorias-modulos-canais]]).
- **Resultado:** Raiz do projeto sem arquivos órfãos. Galeria preservada e descobrível para evolução futura do Bio Link.

---

## 2026-04-26 (Auditoria CLAUDE.md + Refactor do Orquestrador)

### Auditoria solicitada pelo usuário

Auditoria honesta do CLAUDE.md como orquestrador identificou 7 gaps:
1. Numeração de Regras de Ouro quebrada (1-9, 13-16, 10-12)
2. AGENTS.md (95 linhas) existia na raiz mas não documentado em "Arquivos de Suporte"
3. Contagem desatualizada ("17 wikis/187 sub-funcs" vs 19 detalhadas reais)
4. RULES.md em 202 linhas violava própria regra de 200 max
5. PRD.md como recurso ausente da tabela de Arquivos de Suporte
6. deploy-checklist.md não referenciado
7. Data exemplo desatualizada (2026-04-05)

### Refactor executado

**CLAUDE.md (118→125 linhas):**
- Tabela "Arquivos de Suporte" expandida: AGENTS.md, PRD.md, protocolo-subagentes, deploy-checklist
- Regras de Ouro renumeradas 1-17 em ordem lógica (Mentalidade → Proteção → Qualidade → Técnico → Doc/Orquestração)
- Nova Regra 17: "Após FEATURE atualizar PRD.md changelog"
- Protocolo fim de sessão expandido para 7 passos (incluindo PRD + index)
- Comando "documentou?" agora dispara auditoria + correção
- Vault root + filtros .obsidian explicitamente declarados

**RULES.md (202→172 linhas):**
- Protocolo de Subagentes (33 linhas) extraído para wiki

**wiki/protocolo-subagentes.md (61 linhas, NOVO):**
- 4 passos (analisar, propor, conflitos, reportar)
- Tabela "quando usar" com 6 cenários práticos

### Notas finais
- (a) Conteúdo: 9/10 (faltava só atualizar tudo)
- (b) Orquestração: 10/10 (todos arquivos referenciados)
- (c) Vault: 10/10 (todos sob 200, particionamento aplicado)

### Estado do vault
- ~71 MDs total (raiz: 9, wiki: 31, casos-de-uso: 21, históricos: 11)
- Obsidian ativo (`.obsidian/` com filtros para src/supabase/planning/claude)
- Todos arquivos da raiz sob 200 linhas (CLAUDE 125, RULES 172, ARCH 99, PATTERNS 150, AGENTS 95, README 73)

### Pendente para próxima sessão
- 3 untracked sem decisão: `.planning/m19-s4-PLAN.md`, `.planning/m19-s4-RESEARCH.md`, `10 MODELOS DE LINK NA BIO.html`
- `helpdesk-detalhado.md` em 522 linhas (pré-existente, particionar quando viável)
- M19 S6 NPS Automático ou S7 Alertas Proativos
- E2E manual das features de ontem (inbox permissions, DbSizeCard, AdminRetention)
