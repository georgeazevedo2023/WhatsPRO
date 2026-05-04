---
title: Activity Log
type: log
---

# Activity Log

> Registro cronológico de ingestões, consultas e manutenções do vault. Append-only.

## 2026-05-03 (Helpdesk — Top tabs viram ESCOPO)

### Goal & contexto

Sessão começou com leitura do vault (índice + roadmap + erros + log + decisões). User logado como atendente reportou: "Atendendo 13 / Aguardando / Resolvidas / Todas 13" com lista vazia ("Nenhuma conversa atribuída a você"). Bug visual — counts de status ignoravam o filtro de atribuição (default `minhas` para atendente).

User propôs trocar tabs por: Minhas / Não atribuídas / Todas. Mesma discussão apareceu em 2026-05-02 (decidimos manter por ortogonalidade), mas o bug visual de hoje justifica revisitar.

### Discussão de design (formato canônico — feedback rule)

Apresentadas 3 opções:
- **A** — substituir tabs por escopo, status vira filtro
- **B** — duas linhas (escopo em cima, status embaixo)
- **C** — manter status + dropdown de escopo ao lado

Recomendação A (padrão Intercom/Front/Zendesk). User confirmou A.

### Implementação (2 arquivos)

- `src/pages/dashboard/HelpDesk.tsx`:
  - `statusTabs` → `assignmentTabs` (Minhas/Não atribuídas/Todas com ícones User/UserMinus/Users)
  - Counts: `tabBase = conversations.filter(by department)` → minhas/nao-atribuidas/todas
  - `statusOptions` definido aqui e passado via listProps para ConversationList
  - Permissões: `canSeeUnassigned` / `canSeeAll` ocultam tabs proibidas (atendente sem `canViewAll` só vê "Minhas")
- `src/components/helpdesk/ConversationList.tsx`:
  - Removido pill de Atribuição do grupo expansível (virou tab)
  - Novo pill de Status com Select + ícones coloridos por opção
  - `hasActiveFilters` agora usa `statusFilter !== 'aberta'` no lugar do assignment
  - "Limpar filtros" reseta para `aberta`
  - Empty state ganhou variante para `nao-atribuidas` ("Tudo já foi atribuído")

### Defaults preservados

- Status = `aberta` (Atendendo) — comportamento de hoje
- Escopo = `minhas` (atendente) / `todas` (super_admin) — via `defaultAssignmentFilter` em useHelpdeskFilters

### Auditoria

- `npx tsc --noEmit` = 0 erros
- Sem testes específicos do componente (não criados)
- Validação visual: dev server localhost:8081 confirmado pelo user

### PRD

- v7.20.0 adicionada com contexto, mudanças, arquivos, auditoria

### Próximo

- Push dos commits acumulados (2 da sessão anterior + este)
- Backlog do helpdesk continua intacto: #5 consolidar canais broadcast, #4 useUpdateConversation, #19 notificações, #20 split ContactInfoPanel

### Sprint 2 — Mobile-first do header (PRD v7.20.1, commit 7bcb751)

User reportou que ainda "ficava muito espaço em cima". Auditoria do plano original revelou 7 problemas (touch targets <44pt, labels escondidos no mobile, "Não atribuídas" estoura tab de 88px, etc).

Refactor mobile-first do `unifiedHeader`:
- Drop título "Atendimento" (redundante com breadcrumb + sidebar)
- Inbox vira pill `bg-secondary/60 h-10 sm:h-9` (tappable)
- Tabs `py-2.5 sm:py-1.5` (44px mobile / 32px desktop, HIG compliant)
- Labels SEMPRE visíveis: `Minhas/Livres/Todas` mobile, `Minhas/Não atribuídas/Todas` ≥sm via responsive spans
- Counts com `tabular-nums` + cap `99+`
- Mesmo código serve mobile e desktop (sem caminhos duplicados)

### Sprint 3 — Gerenciar departamentos do membro inline (PRD v7.20.2)

User reportou: "não consigo editar departamentos ou remover o departamento de um membro ou adicionar outro etc".

Diagnóstico: seção "DEPARTAMENTOS" no `UsersTab.tsx` era read-only e ficava ESCONDIDA quando membro tinha 0 deptos (`{u.departments.length > 0 && (...)}`) — sem affordance.

Refactor:
- Seção sempre visível
- Agrupada por caixa do membro (cada caixa mostra seus deptos)
- Cada depto = chip com checkbox (toggle insert/delete em `department_members`)
- Empty state "Vincule a uma caixa primeiro" se 0 inboxes
- Empty state "Nenhum depto. Criar →" se caixa sem deptos
- Footer link "Gerenciar departamentos →" para CRUD em `/admin/departments`
- Handler `handleToggleDepartmentMembership` + state `savingDeptMembership`

Arquivo: `src/components/admin/UsersTab.tsx` (+73/-13).

---

## 2026-05-02 (Auditoria Profunda — Helpdesk)

### Goal & contexto
Usuário pediu auditoria profunda e completa do módulo helpdesk + banco. Mapeamento completo: 21 arquivos frontend (5.697 linhas), 9 tabelas, RLS de todas, advisors security/performance.

### Findings principais
- **Nota global: 7.4/10**. Sem bugs críticos; sem dados órfãos; RLS coerente.
- 5 funções `SECURITY DEFINER` sem `SET search_path` (alto risco)
- 6 RPCs `SECURITY DEFINER` chamáveis por `anon`/`authenticated` via `/rest/v1/rpc/*` — incluindo `is_super_admin` (alto)
- 28 policies reavaliando `auth.uid()` por linha (perf)
- 144 violações `multiple_permissive_policies`
- 5 FKs sem índice de cobertura (`conversations.contact_id`, `departments.inbox_id`, `inboxes.instance_id`, `labels.inbox_id`, `conversation_labels.label_id`)
- Atualização de `last_message_at` espalhada em 4 lugares — recomenda trigger AFTER INSERT centralizado
- Sem testes para hooks/componentes do helpdesk

### Documentado
- `wiki/auditoria-helpdesk-2026-05-02.md` (relatório completo com plano de ação em 6 sprints)
- `wiki/melhorias-helpdesk-2026-05-02.md` (20 melhorias detalhadas — duplicações, inconsistências, UI)

### Quick wins shipados (Onda 1 — 5)
- #1 `mediaPreview()` extraído para `src/lib/messagePreview.ts` (remove duplicação em 4 arquivos frontend)
- #11 typo "Nao lidas" → "Não lidas" em ConversationList
- #16 drafts movidos para Set no hook (remove localStorage I/O por render)
- #18 placeholder com hint `(digite / para templates)`
- #B1 badge "Limpar filtros" sem variant destructive

### Quick wins shipados (Onda 2 — 4)
- #1 (extra) `_shared/messagePreview.ts` para edge functions — sync-conversations e whatsapp-webhook agora usam o helper. Zero hardcode de preview restante em frontend ou backend
- #10 ChatInput delega mudança de status — eliminou duplo UPDATE no banco e fix do broadcast `status-changed` perdido
- #14 typing receiver 4s → 6s (margem contra latência)
- #B4 spring-cleaning de drafts órfãos no localStorage (1x por sessão via sessionStorage flag)

### Onda 5 — Refactor + UX
- #3 assignAgent unificado: ContactInfoPanel passa a usar helpdeskBroadcast.assignAgent (que agora throws on error). Caminho único de atribuição
- #6 JID brasileiro 9º dígito: saveToHelpdesk usa getAlternateBrazilianJid + normalizePhoneForMatch de phoneUtils (já existentes). Removeu 16 linhas de manipulação inline
- #17 row height fixa 88px (antes alternava 64/90 com flicker no react-window ao mudar metadata)

### Onda 4 — UX + descoberta
- #15 botão "Selecionar" explícito + state bulkActive em ConversationList (entra em modo seleção sem auto-selecionar nada)
- #B3 **already-fixed**: dedup de auto-summarize já existe (janela de 5 min em auto-summarize + cache check em summarize-conversation)

### Onda 3 — Trigger DB para last_message_at (#2)
- Migration `conversations_auto_update_last_message` criada via apply_migration: trigger AFTER INSERT em conversation_messages atualiza last_message_at, last_message, is_read centralmente
- Função SECURITY DEFINER com search_path fixo + REVOKE EXECUTE de anon/authenticated/PUBLIC
- Idempotente: NEW.created_at >= last_message_at (safe para sync-conversations inserindo fora de ordem)
- Pula direction='private_note'
- Smoke test passou: novo / antigo (idempotência) / private_note (skip)
- 5 UPDATEs manuais removidos (ChatInput.handleSend, handleSendAudio, useSendFile, saveToHelpdesk, whatsapp-webhook, sync-conversations)
- AI Agent + process-follow-ups ainda fazem UPDATE redundante (HIGH RISK, não tocados; trigger absorve)

### Discussão de design
- Filtro status (tabs topo) vs atribuição (Todas/Minhas/Não atribuídas) — usuário propôs unificar; decidimos manter pois são eixos ortogonais. Sugerido melhorar default text para evitar três "Todas" em série.

### Encerramento da sessão (2026-05-02)
- 2 commits criados (não pushados): `5088783 feat(helpdesk)` + `9d58d09 docs(helpdesk)`. Working tree limpo. 2 ahead de origin/master.
- Migration `conversations_auto_update_last_message` aplicada em prod via apply_migration; trigger ativa, função protegida (REVOKE de anon/auth/PUBLIC).
- Dev server iniciado para validação visual e parado ao final.
- PRD.md atualizado com entrada v7.19.0 no changelog.
- TypeScript: 0 erros. Testes: 644 passam (5 falhas pré-existentes em Forms, sem regressão).

### Próxima sessão — pontos de retomada
1. **Push** dos 2 commits para origin/master (após validação visual)
2. **Backlog priorizado**: #5 (consolidar canais broadcast), #4 (hook useUpdateConversation), #12+#13 (decidir arquivada + filtro), #19 (notificações), #20 (split ContactInfoPanel)
3. **Backlog DB** (auditoria): A1 fix search_path em 5 funções, A2 REVOKE EXECUTE em 6 RPCs, A3+A4 reescrever 28 policies com `(SELECT auth.uid())` e consolidar permissivas, M1 adicionar 5 índices de FK
4. **Validação visual pendente**: 10 fluxos documentados em `wiki/melhorias-helpdesk-2026-05-02.md`

> Sessão 2026-04-30 (D28 Excluded Products + D29 VALID_KEYS dinâmico + Avatares em Storage + R85/R86/R87/R88) arquivada em:
> - [[wiki/log-arquivo-2026-04-30-d28-d29-avatares]]

## 2026-04-30 (resumo — entrada completa arquivada)

Sessão começou com auditoria do vault (5 fixes documentais — log rotation, roadmap, index, planning files), evoluiu pra investigação dos 3 handoffs duplicados na conversa Josafa (R85+R86), e terminou shipando feature D28 completa (Excluded Products) — UI editável pelo admin pra cadastrar produtos que a tenant não vende. Validada em prod com lead George ("tem caixa de correio?" → fallback automático sem transbordo).

**Resumo do que foi shipado:**
- **R85+R86** — fix 3 handoffs duplicados Josafa (guard SHADOW + reset counter em 5 paths)
- **D28 Excluded Products** (edge fn v171→v172) — schema JSONB editável + helper word-boundary + UI tab Qualificação + fallback automático + validado em prod com lead George
- **R88** — CHECK constraint silent fail descoberto via teste real (`excluded_product_match` whitelist)
- **R89** — UI controlled input com `.trim()` em onChange quebra digitação livre (KeywordsInput sub-componente)
- **D29 VALID_KEYS dinâmico** (edge fn v173) — `buildValidTagKeys()` em `_shared/serviceCategories.ts`, R84 RESOLVIDO em prod (Eletropiso `tipo_tinta`)
- **v7.18.0 Avatares em Storage** — bucket público + helper `avatarStorage.ts` + edge fn `refresh-avatar` + migration `20260430000002`. Pendência: deploy 3 fns + frontend.
- **47 testes (D28) + 9 (D29)** = 100% passam. Bundle prod `index-CFmkOcne.js`.

---

> Sessão 2026-04-29 (Eletropiso — 23 categorias + 7 fixes ai-agent v162→v169 + BusinessHoursEditor + audit) arquivada em:
> - [[wiki/log-arquivo-2026-04-29-eletropiso]]
>
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
