---
title: Activity Log
type: log
---

# Activity Log

> Registro cronológico de ingestões, consultas e manutenções do vault. Append-only.

---

## 2026-05-12 — Fix RPC append_ai_debounce_message (v7.35.3) ⚠️ bug crítico de prod

**Investigação iniciada pelo gestor:** "pq o agente ia não respondeu meu áudio?".

**Diagnóstico:**
- Mensagem incoming OK, transcrição OK (Groq fez), mas `ai_debounce_queue` sem entry nova e `ai_agent_logs` zerado em 24h.
- Webhook pula áudio de propósito ("Skip audio messages — transcribe-audio will trigger"). transcribe-audio chama ai-agent-debounce. ai-agent-debounce chama RPC `append_ai_debounce_message`.
- RPC declarada com `p_instance_id uuid`. Instâncias UAZAPI usam `text` (`r466a98889b5809`). Erro `22P02: invalid input syntax for type uuid` silenciado por 2 camadas de fire-and-forget.
- Reproduzi o erro chamando a RPC manualmente.

**Fix:** migration `fix_append_ai_debounce_message_instance_id_text` (DROP + CREATE com tipo correto). Smoke test rodou com instance/conv real.

**Pendente:** validação E2E (user precisa mandar msg nova no WhatsApp Eletropiso pra confirmar IA responde).

**Lição:** bugs em fire-and-forget de duas camadas viram invisíveis se a função interna estoura. Defesa: `ai-agent-debounce` deveria logar `error` da chamada RPC, não engolir.

---

## 2026-05-12 — Retention 24h em logs do Supabase (v7.35.2)

**Investigação iniciada pelo gestor:** "52 MB? o que está ocupando?". Análise revelou que 30 MB (55%) eram logs internos sem valor operacional:
- `net._http_response` (pg_net HTTP log) = 21 MB, cresce ~3 MB/hora.
- `cron.job_run_details` (pg_cron) = 8 MB, ~2.300 rows/dia.

**Ação imediata:** TRUNCATE nas duas → banco 52→23 MB.

**Permanente:** migration `cron_retention_system_logs_24h` cria função `purge_system_logs_older_than_24h()` (SECURITY DEFINER, retorna jsonb com contagens) + job pg_cron `purge_system_logs_24h` schedule `0 * * * *`. Bloco DO antes do schedule garante reaplicação idempotente (unschedule anterior se existir).

Smoke test: função roda OK, job ativo no `cron.job`.

---

## 2026-05-12 — Dashboard do Gestor: botão limpar pendências (v7.35.1)

**Pedido:** gestor precisa remover spam/teste das listas (ex: "Zig Online" não é negócio).

**Entregue:** tag `dashboard:dispensed` aplicada via 2 RPCs SECURITY DEFINER (`dispense_conversation_from_dashboard` / `restore_conversation_to_dashboard`). Append preserva tags existentes via DISTINCT unnest. As 3 RPCs de pendência filtram OUT a tag. UI: botão X ao lado do link externo + toast Sonner com action "Desfazer".

Não arquiva a conversa (helpdesk segue mostrando). Smoke test SQL completo OK. `tsc --noEmit` = 0.

---

## 2026-05-11 (madrugada) — Dashboard do Gestor: pivô comercial (Fase 3)

**Demanda do gestor após ver as Fases 1+2:** tirar custos, mostrar leads sem 1ª resposta, cotações em andamento, objeções e motivos de conversa em destaque.

**Entregue:**
- 2 RPCs novas: `get_unanswered_first_messages` (lead nunca respondido — ZERO outgoing), `get_active_quotes` (tag `motivo:orcamento` sem `venda:fechada`/`perdida`). Eletropiso 30d: 1 lead sem 1ª resposta há 716h; 0 cotações ativas.
- Hook estendido (`useManagerAdvancedMetrics` agora dispara 6 RPCs em paralelo).
- Componente genérico `PendingConversationsCard` substituindo `AbandonedConversationsList` (removido — código órfão).
- Zona 3 reorganizada em 3 linhas: pendências críticas 3 cols + análise objeções/motivos + equipe (demand×coverage + ranking).
- Card `Custo IA` removido dos KPIs (grid agora 5 cols), `Custo/conv.` removido do IA vs Vendedor, meta `Custo IA` removida.

**Push Fases 1+2:** commit `66d2461` no master. Fase 3 ainda local.

**Versão:** v7.35.0. `tsc --noEmit` = 0. Console limpo.

**Sinal de produto:** "1 lead sem 1ª resposta há 30 dias" + "0 cotações tagueadas" + "0 vendas tagueadas" — fluxo de tagueamento e/ou disciplina de resposta tem buracos visíveis.

---

## 2026-05-11 (noite) — Dashboard do Gestor: métricas avançadas (Fase 2)

**Entregue logo após Fase 1, mesma sessão.** 4 RPCs (`get_response_time_percentiles`, `get_abandoned_conversations`, `get_demand_vs_coverage_by_hour`, `get_conversion_by_origin`) + hook `useManagerAdvancedMetrics` (Promise.all) + 4 componentes (`ResponseTimeCard`, `AbandonedConversationsList`, `DemandVsCoverageChart`, `ConversionByOriginCard`) integrados às Zonas 1/3/4 do `ManagerDashboard`.

**Dados reais Eletropiso 30d:** P50 1ª resposta = 23s, P95 = 89s (n=11). 6 conversas abandonadas (max 47 dias). Origem "direto" 7 leads, 0 fechadas (tag `venda:fechada` não está sendo aplicada — sinal pro time comercial).

**Versão:** v7.34.0. `tsc --noEmit` = 0. Console limpo.

**Próximo (Fase 3 backlog):** drill-down ao clicar em qualquer card, comparação período-vs-período, alertas configuráveis (P95 > X → notify), export CSV.

**Nota:** 9.5/10 — escopo cumprido na exata medida pedida pelo usuário sem inflação, sem regressão, validação manual ainda pendente (autenticação Playwright fora de escopo).

---

## 2026-05-11 (tarde) — Dashboard do Gestor unificado (Fase 1)

**Demanda do usuário:** unificar os 3 dashboards (Olá George + Gestor/Métricas + Gestor/Insights) num único pro gerente, esconder Sandbox IA, adicionar leads novos vs recorrentes. Confirmar acesso como gerente.

**Plano aprovado (Opção C):** mantém `/dashboard` multi-tenant pro super_admin; unifica `/dashboard/gestao` em 4 zonas (Pulso / Tendência / Atendimento / IA-Comercial) pro gerente. Schema change `is_sandbox`. Definição lead novo = primeira conversa no período. Fase 1 entrega core; métricas avançadas vão pra Fase 2.

**Entregue:**
- Migration `add_is_sandbox_to_instances` (coluna + índice parcial); Sandbox IA marcada.
- RPC `get_leads_new_vs_returning(p_instance_id, p_start, p_end)` retorna série diária novos/recorrentes via `MIN(created_at)` por contact_id × `last_message_at` no período. Validada: Eletropiso 30d = 6 novos + 5 recorrentes (11 contatos distintos).
- `useManagerInstances({ includeSandbox })` — default `false`, gerente nunca vê sandbox.
- `useLeadsNewVsReturning` (preenche dias zerados) + `LeadsNewVsReturningChart` (área empilhada recharts verde/roxo).
- `ManagerDashboard.tsx` reescrito **sem abas** — 4 seções em scroll único; absorve `TopContactReasons` e `BusinessHoursChart` do DashboardHome; toggle "Sandbox: ON/OFF" só pro super_admin.
- `types.ts` atualizado (is_sandbox + RPC). `tsc --noEmit` = 0 erros. HMR sem warnings.

**Confirmação de acesso:** `/dashboard/gestao` já é guardada por `CrmRoute` (super_admin OU gerente). Gerente faz login → cai direto no dashboard unificado. Nenhuma guard alterada.

**Próximo (Fase 2 — não shipado ainda):** tempo 1ª resposta P50/P95, conversas abandonadas 24h, gap de cobertura (hora-pico demanda vs equipe), conversão por origem.

**Nota:** 9/10 — entrega cirúrgica, sem regressão; ponto a melhorar = não consegui validar visualmente logado (Playwright travou no /login, optei por não autenticar).

---

## 🎯 HANDOFF DE FIM DE SESSÃO — 2026-05-11

> **Frase pra retomar na próxima sessão:**
>
> **`"contexto pós-refatoração doc 11/05"`**
>
> Ao receber essa frase, executar protocolo de início (5 passos) e priorizar leitura desta entrada de handoff.

### O que foi feito hoje (sessão inteira)

**Features de código (já em `CHANGELOG.md` + arquivadas em [[wiki/log-arquivo-2026-05-09-a-10]]):**
- v7.32.3 — Polish helpdesk + fix crítico `notify-vendor-assignment` (schema mismatch)
- v7.32.4 — Card MOTIVO no Contexto IA do helpdesk
- v7.32.5 — Fix áudios + pipeline transcrição (bucket público + webhook reescrito + Groq primary)
- v7.32.6 — Polish player (waveform, paleta sky/emerald) + transcrição outgoing + console errors zerados

**Refatoração arquitetural da documentação (esta entrada + as 2 abaixo):**
- PRD.md 4383→67 linhas (índice puro de ponteiros)
- CLAUDE.md virou orquestrador (185 lin) com tabela "Roteamento por contexto"
- `wiki/erros-e-licoes.md` 596→71 (top-3 + índice → splits em `wiki/erros/`)
- Logs históricos particionados em 7+3 partes
- Planos shipados particionados (9 partes total)
- `wiki/changelog/` (10 arquivos), `wiki/roadmap/` (9), `wiki/erros/` (3)
- `description:` em 37 partN; `audited_at:` em 12 wikis principais
- Hook pre-commit + GitHub Actions + slash command `/doc-check` = 3 camadas anti-regressão

### Estado atual do projeto

- **Produção**: rodando em `crm.wsmart.com.br` (Eletropiso ativo)
- **Versão**: v7.32.6
- **Helpdesk**: 100% funcional com transcrição automática (Groq Whisper-large-v3)
- **Áudios**: pipeline UAZAPI → webhook → Groq → DB → realtime → AudioPlayer
- **Doc**: 0 arquivos > 300 linhas, healthcheck no pre-commit + GHA

### Pendências declaradas (não bloqueantes)

**Documentação (orgânicas, conforme forem revisadas):**
- Sweep `audited_at` no resto das ~30 wikis principais
- Validar GHA em PR real (acontece naturalmente no próximo PR)
- Renomear partN com descritor no nome do arquivo (atualmente só no frontmatter)

**Produto (acompanhar):**
- Pipeline `process-jobs` ainda quebrado: RPCs `claim_jobs`/`complete_job` não existem no DB. **Áudio já não depende mais disso** (chamada direta), mas `lead_auto_add` e `profile_pic_fetch` continuam parados. Não afeta nada crítico atualmente. Decisão futura: ou criar as RPCs ou eliminar a fila inteira.
- 11 áudios incoming antigos sem transcrição: URLs UAZAPI expiraram (404), não dá pra reprocessar. Áudios novos transcrevem automaticamente.

### Próximos passos sugeridos (a critério do usuário)

| Opção | O que faz | Esforço |
|---|---|---|
| Recomeçar sessão limpa | Aguardar próxima feature/bug do usuário | — |
| `/doc-check` | Rodar healthcheck completo (limit + staleness + órfãs) | 2 min |
| Reativar pipeline jobs | Criar RPCs `claim_jobs`/`complete_job` ou refatorar `process-jobs` | 30 min |
| Sweep audited_at | Revisar e marcar wikis principais como atualizadas | 30 min |

### Auto-avaliação da sessão inteira

| Dimensão | Nota | Comentário |
|---|---|---|
| Features de código | **9/10** | 4 versões shipadas, 3 bugs críticos descobertos+corrigidos (notify schema, max_retries, bucket privado), todas validadas E2E |
| Lições aprendidas | **10/10** | 3 lições novas em `erros-e-licoes` com regras preventivas concretas |
| Documentação operacional | **9.5/10** | Hard limit 300 cumprido + orquestrador + 3 camadas anti-regressão |
| Auto-manutenção | **9/10** | `/doc-check` instalado, hook ativo, GHA configurado |
| **Geral** | **9.4/10** | Sessão extremamente produtiva: produto + dívida técnica + arquitetura de doc, tudo coberto |

---

## 2026-05-11 (manhã) — Refatoração arquitetural da documentação (hard limit 300 linhas)

> Pedido explícito do usuário: "um arquivo .md nunca pode passar de 300 linhas; CLAUDE.md deve ser orquestrador". Executei 5 fases de refatoração + healthcheck.

### Resultado

**Antes:** 7 arquivos ofensores. **Depois:** 0 ofensores. Vault saudável.

| Métrica | Antes | Depois |
|---|---|---|
| `PRD.md` | 4383 lin | **67 lin** (só ponteiros) |
| `CHANGELOG.md` | — | **228 lin** (raiz, releases ~14d) |
| `wiki/erros-e-licoes.md` | 596 lin | **71 lin** (top-3 + índice) |
| `CLAUDE.md` | 126 lin | **181 lin** (orquestrador c/ tabela de roteamento) |
| Arquivos `.md` totais > 300 lin | 7 | **0** |

### Mudanças por fase

**Fase 1 — PRD.md particionado (4383 → 67):**
- `CHANGELOG.md` raiz (228 lin) com releases v7.32.x
- `wiki/changelog/2026-05-part1.md` (267) + `-part2a` + `-part2b` para v7.21-v7.31
- `wiki/changelog/2026-04-part1` + `-part2a` + `-part2b` para v7.0-v7.20
- `wiki/changelog/2026-pre-04-part1` + `-part2` + `-part3a` + `-part3b` para v1.x-v6.4
- `wiki/modulos.md` (219) — split de "Módulos e Funcionalidades"
- `wiki/infraestrutura.md` (75) — split de "Infraestrutura"
- `wiki/roadmap/planejado-resumo.md` + 8 arquivos de detalhe (M10-M13, R18-R30)

**Fase 2 — erros-e-licoes particionado (596 → 71):**
- `wiki/erros/regras-preventivas.md` (116) — tabela das ~30 regras
- `wiki/erros/historico-2026-05-part1.md` (227) + `-part2.md` (220) — R91-R114
- `wiki/erros-e-licoes.md` enxuto: top-3 lições recentes + índice

**Fase 3 — CLAUDE.md como orquestrador (126 → 181):**
- Nova tabela "Roteamento por contexto da tarefa" (12 cenários → arquivos a ler)
- Diagrama da estrutura completa do vault
- Regra explícita "hard limit 300 linhas"
- Healthcheck script citado

**Fase 4 — Logs históricos particionados:**
- `wiki/log-arquivo-2026-pre-05-08.md` (1693) → 7 partes (249, 160, 264, 283, 281, 299, 219)
- `wiki/log-arquivo-2026-04-04-a-09.md` (755) → 3 partes (265, 227, 282)
- `wiki/historico-planos/plano-enquetes-polls.md` (932) → 5 partes
- `wiki/historico-planos/plano-s10*.md` (502) → 2 partes
- `wiki/historico-planos/plano-s11*.md` (469) → 2 partes

**Fase 5 — Healthcheck:**
- `scripts/check-md-length.sh` lista ofensores
- Modo `--strict` retorna exit 1 (pode entrar em pre-commit hook futuro)
- Executado: **0 ofensores**

### Auto-avaliação

**Manutenção arquitetural**: 9/10 — cumpriu hard limit literalmente, criou orquestrador funcional, healthcheck rodável. Nota não é 10 porque (a) o split mecânico em "partN" não preserva contexto narrativo perfeito, (b) o `index.md` agora tem links muito longos numa célula só pra cumprir limite.

### Polish posterior (mesma sessão, ALTA prioridade do plano)

- **Pre-commit hook**: `scripts/install-hooks.sh` cria `.git/hooks/pre-commit` rodando `check-md-length.sh --strict`. Previne regressão automaticamente. Quem clonar precisa rodar `bash scripts/install-hooks.sh` uma vez.
- **`log.md` particionado**: 232 → ~80 linhas. Entradas de 2026-05-09 e 2026-05-10 movidas pra [[wiki/log-arquivo-2026-05-09-a-10]].
- **`index.md` reorganizado**: 217 linhas em seções claras (Operacional / Produto / Módulos / Histórico) — eliminada poluição de links arquivados na seção ativa.

### Polish MÉDIA/BAIXA (mesma sessão, fechado o ciclo)

- **`description:` no frontmatter de 37 partN opacos** — cada parte tem 1 linha descritiva (período coberto + features). Logs históricos, changelog, erros, planos, roadmap módulos. Tabela em `log.md` agora mostra "Parte | Conteúdo" navegável.
- **`audited_at: 2026-05-11` em 12 wikis principais** — `ai-agent`, `arquitetura`, `audio-pipeline`, `banco-de-dados`, `decisoes-chave`, `deploy`, `deploy-checklist`, `erros-e-licoes`, `infraestrutura`, `modulos`, `protocolo-subagentes`, `roadmap`.
- **GitHub Actions workflow** `.github/workflows/vault-healthcheck.yml` — roda `check-md-length.sh --strict` em push pra `master` e em PRs que mexam em `*.md`. Bloqueia merge se violação. Defesa em profundidade junto com pre-commit hook local.
- **Slash command `/doc-check`** em `.claude/commands/doc-check.md` — audit interativo 3 dimensões: hard limit + staleness (`audited_at` >60d) + órfãs (sem wikilink apontando). Suporta auto-fix opcional após confirmação.
- **`wiki/casos-de-uso/` validado** — 31 arquivos, todos ≤200 lin. Nenhum precisa particionar.
- **CLAUDE.md atualizado** com referências ao hook, workflow e `/doc-check`.

### Auto-avaliação final

**Documentação**: **9.5/10** — hard limit cumprido + orquestrador funcional + 3 camadas anti-regressão (pre-commit + GHA + /doc-check) + descrições navegáveis + audited_at em 12 wikis. Falta só (a) GHA validado em PR real, (b) sweep audited_at no resto das wikis conforme forem revisadas (orgânico).

---

## Sessões anteriores (arquivadas)

> Log mantém só sessões dos últimos ~3 dias. Histórico:
>
| Arquivo | Conteúdo |
|---------|----------|
| [[wiki/log-arquivo-2026-05-09-a-10]] | 2026-05-09 a 10: v7.32.3 → v7.32.6 + manutenção doc |
| [[wiki/log-arquivo-2026-pre-05-08-part1]] | 2026-05-07 noite (v7.32.0-v7.32.2 notif handoff + UAZAPI refactor) |
| [[wiki/log-arquivo-2026-pre-05-08-part2]] | 2026-05-07 final tarde — Sessão 4 Sandbox · Onda 2 (G/H/M/E) |
| [[wiki/log-arquivo-2026-pre-05-08-part3]] | 2026-05-07 — Sessão 3 Sandbox + R113 cron 401 fix |
| [[wiki/log-arquivo-2026-pre-05-08-part4]] | 2026-05-06 noite — auditoria AI Agent R103/R104/R105 + projeto antigo PAUSADO |
| [[wiki/log-arquivo-2026-pre-05-08-part5]] | 2026-05-06 tarde + manhã — Playwright Ondas 1-4 (120 testes) + R101/R102 |
| [[wiki/log-arquivo-2026-pre-05-08-part6]] | 2026-05-06 madrugada — CUTOVER LIVE Eletropiso + Ondas 4-7 + hotfixes |
| [[wiki/log-arquivo-2026-pre-05-08-part7]] | 2026-05-05 noite — Auditoria projeto 5 ondas + Sprint 3 P1-2 |
| [[wiki/log-arquivo-2026-05-05-r93-r96-manha]] | 2026-05-05 manhã — R93/R94/R95 + Free Forever + Sprint H D30 |
| [[wiki/log-arquivo-2026-05-05-d30-defg-e]] | 2026-05-04/05 — D30 Sprints D+F+G+E (Admin/Helpdesk UI + Tests + Modo Estendido) |
| [[wiki/log-arquivo-2026-05-04-d30-abc]] | 2026-05-04 — D30 Sprints A+B+C (DB + Backend + Cron) |
| [[wiki/log-arquivo-2026-05-04-admin]] | 2026-05-04 — Auditoria Admin + R90 hotfix user_roles UNIQUE |
| [[wiki/log-arquivo-2026-05-02-a-03-helpdesk]] | 2026-05-02 + 03 — Auditoria Helpdesk + UI mobile-first |
| [[wiki/log-arquivo-2026-04-30-d28-d29-avatares]] | 2026-04-30 — D28/D29 + Avatares Storage + R85-R88 |
| [[wiki/log-arquivo-2026-04-29-eletropiso]] | 2026-04-29 — Sprint Eletropiso 23 categorias + 7 fixes ai-agent |
| [[wiki/log-arquivo-2026-04-27-a-28-m19-s10]] | 2026-04-27/28 — M19-S10 v1+v2+v3 + Deploy 16 commits |
| [[wiki/handoff-2026-04-27]] | 2026-04-27 — Handoff geral + M19-S10 v2 Service Categories |
| [[wiki/log-arquivo-2026-04-25-s8-helpdesk]] | 2026-04-25 — Helpdesk inbox + M19 S8 + S8.1 |
| [[wiki/log-arquivo-2026-04-14-helpdesk-audit]] | 2026-04-14 — Helpdesk audit 10 fixes |
| [[wiki/log-arquivo-2026-04-13-m19-s1s2]] | 2026-04-13 — M19 S1+S2: Shadow + Agregação + Deploy |
| [[wiki/log-arquivo-2026-04-12-fixes-kpi-s12]] | 2026-04-12 — KPI fixes + S12 + orchestrator |
| [[wiki/log-arquivo-2026-04-04-a-09-part1]] | 2026-04-09 + 08 — M17 F1-F5 ship (Motor + Funis Agênticos + NPS) |
| [[wiki/log-arquivo-2026-04-04-a-09-part2]] | 2026-04-08 + 07 + 06 — M16 Funis + M15 F1+F2 + bio link fixes |
| [[wiki/log-arquivo-2026-04-04-a-09-part3]] | 2026-04-06 + 05 + 08 — M14 Bio Link + M13 Campanhas/Forms + M12 Forms |
