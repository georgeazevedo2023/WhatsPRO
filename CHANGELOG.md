---
title: Changelog
type: changelog
updated: 2026-06-17
audited_at: 2026-06-17
---

# Changelog

> Releases ativas (últimos ~14 dias). Histórico completo em [[wiki/changelog/]].
>
> **Convenção:** semver. Toda feature/fix shipado vira entrada aqui (REGRA 17 do CLAUDE.md). Após release recente envelhecer >14 dias, mover pra `wiki/changelog/<ano-mes>.md`.

---

### v7.98.0 (2026-06-26) — 📇 Contato compartilhado (vCard) → saudação + transbordo (não vende mais o nome do contato)

Queixa do dono (print da Fila): lead **compartilhou um CONTATO** no WhatsApp ("Fernando Amaral Caprice") e a IA respondeu *"Esse não é o nosso forte aqui, mas trabalhamos com outros materiais relacionados…"* — tratou o **nome do contato** como consulta de produto. **Causa-raiz:** o `whatsapp-webhook` salva a mensagem de contato como `media_type='contact'` usando o **displayName como `content`**; o `ai-agent` consumia esse nome como `incomingText` e o LLM o processava como pergunta. O agente **não tinha nenhum tratamento de vCard**. **Fix (decisões do dono: GLOBAL, todos os agentes + SEMPRE que houver contato, mesmo com texto junto):** short-circuit determinístico pré-LLM — se alguma mensagem recebida no turno tem `media_type='contact'`, a IA não responde/vende: envia **saudação por horário (Bom dia/Boa tarde/Boa noite, fuso `America/Sao_Paulo`) + "Obrigado pelo contato 😊 Só um instante que estou te encaminhando para um de nossos atendentes."** e **transborda** reusando o MESMO caminho do `sale_closed` (`runQueueAssignment` → fila/atribuição + `notify-vendor-assignment` + `status_ia=SHADOW` + tags de handoff + nota interna *"📇 O lead compartilhou um contato"*). Roda ANTES de greeting/produto/excluídos pra o contato nunca ser maltratado; pula em shadow (humano já atendendo, trava v7.94.0) e no path shadow do vendedor. Módulo puro novo `_shared/agent/contactShareHandoff.ts` (detecção + saudação + mensagem) com **+11 testes**. tsc 0 · deno check ai-agent 0 · vitest **1976/0**. Deploy: ai-agent **v272** (global). **⚠️ Validar E2E:** dono enviar um contato no WhatsApp pra confirmar. Detalhe: [[project_contact_share_handoff_v798]].

---

### v7.97.0 (2026-06-25) — 📊 NPS ao finalizar: enquete 0-10 + alerta ao gestor em nota baixa

Pedido do dono: ao **Finalizar** uma conversa, enviar NPS ao lead; nota **<5** → alertar o gestor com nome/número do cliente + atendente + resumo. **Achado:** a infra de NPS existia mas estava **MORTA** — o Finalizar inseria em `job_queue` (sem worker) e `triggerNpsIfEnabled` (setTimeout não-confiável) não tinha caller. Reconstruída de raiz reusando `poll_messages`/`poll_responses`/webhook/dashboard. **Formato (workflow 9 agentes):** enquete nativa UAZAPI **0-10** (11 botões, cabe no limite 12) + 2ª enquete opcional "Encontrou o produto?" (Sim/Não). **Novas edge fns:** `send-nps-poll` (chamada no Finalizar; attendant=JWT; idempotência por `conversations.nps_sent_at`; envio imediato) e `notify-manager-nps` (resumo via ai_summary/callLLM + cliente/atendente → WhatsApp aos gestores + painel; idempotência por `bad_alert_sent_at`). **Webhook poll_update:** parseia `numeric_score`, **não acorda a IA** no voto (skip is_nps/resolvida — preserva trava v7.94.0), dispara o alerta em nota baixa. **Dashboard:** NPS 0-10 + **breakdown por atendente** (RPC `get_nps_by_attendant`) no painel do gestor e do admin. Migration `20260625130000` (numeric_score, attendant_id, nps_scale, bad_alert_sent_at, nps_sent_at, 4 cols ai_agents, RPC) — defaults behavior-preserving, sem regen de types. +17 testes; tsc 0 · vitest **1963/0** · deno 3 fns 0. Deploy: send-nps-poll v1 + notify-manager-nps v1 + whatsapp-webhook v19 + frontend; ligado em **EletropisoV2 + Sandbox** (0-10, found-product, alerta WhatsApp, threshold 5). **⚠️ Pendência:** nenhum gestor tem `personal_whatsapp` setado → alerta WhatsApp cai só no painel até configurar. **v7.97.1 (mesmo dia):** teste real no WhatsApp do dono validou o envio E pegou 2 bugs (conversations sem `instance_id` → via inbox; UAZAPI devolve `messageid` curto, não `id` composto) — corrigidos. Dono achou a 0-10 longa (11 botões) → trocada por **3 opções curtas** ("1 - Bom"/"2 - Regular"/"3 - Ruim"); categórico agora **pontuado por palavra-chave em 0-10** (`nps.ts`: Bom→8/Regular→5/Ruim→2, tolera prefixo "N - "), `isLowScore` unificado (<threshold; só "Ruim" alerta), `numeric_score` gravado em qualquer escala → dashboard+RPC contam o categórico. Config EletropisoV2+Sandbox atualizada; +2 testes, vitest **1965/0**, 3 fns + RPC redeployados. Detalhe: [[project_nps_on_finalize_v797]].

---

### v7.96.1 (2026-06-25) — 🛡️ Sanitizer: 2 folgas de negação fechadas (texto curto + lista finita)

Hardening das 2 folgas pré-existentes que a auditoria do `except_keywords` (v7.96.0) apontou no `responseSanitizer`/`responseValidator` (hot path de TODA resposta da IA): **(1) texto <15 chars pulava TODA validação** (`sanitizeAgentResponse` early-return na linha 173) → um *"Não temos."* de 10 chars escapava do gate de segurança. Fix: roda o validador SEMPRE; só pula a lógica COSMÉTICA/premium quando o texto é curto **E** sem violação NOCIVA (SAFE_TEXT). Acks legítimos (*"Ok"*, *"Sim"*, *"Show! 😊"*) seguem passando intactos; *"Tem sim!"* curto agora também é barrado. **(2) `NEGATIVE_PHRASES` era lista literal de 9 frases** (`.includes`) → negações novas escapavam. Fix: camada `NEGATIVE_REGEXES` conservadora (não vendemos/comercializamos/oferecemos/possuimos/disponibilizamos, não faz parte, fora do portfólio/catálogo/mix, não consta, não temos/fazemos/trabalhamos-com esse, esgotado) — **sem falso-positivo** em *"não tem problema"*. +7 testes. tsc 0 · vitest **1946/0** · deno check ai-agent 0. Deploy: ai-agent **v271**. Behavior-preserving exceto as negações agora capturadas.

---

### v7.96.0 (2026-06-25) — 🔧 `except_keywords`: "máquina de lavar" não recusa mais a MANGUEIRA (acessório que vendemos)

Queixa do dono (print da Fila): lead pediu *"mangueira de saída de água da máquina de lavar"* (peça hidráulica que a loja VENDE) e a IA recusou com *"Esse não é o nosso forte aqui…"*. **Causa-raiz (workflow 10 agentes, verificada em prod):** o matcher de `excluded_products` (`_shared/excludedProducts.ts`) roda **PRÉ-LLM / PRÉ-router** (`index.ts:1497`) e a keyword `máquina de lavar` do item `eletrodomesticos` casa (whole-word) DENTRO da frase da mangueira → short-circuit direto pra recusa via `sendTextMsg`, sem passar por router/qualificação/transbordo (todos verificados SÃOS — só pulados). Catálogo é minoria (7-8 itens, 0 hidráulica), então o caminho certo seria 0-resultado → qualificar → transbordar. **Fix (sem gambiarra):** campo opcional `except_keywords[]` no schema do `excluded_products` — se o texto do lead contém uma "palavra que libera" (`mangueira, engate, cano, registro, válvula, torneira, sifão, adaptador, abraçadeira, niple, ralo, "saída de água", "saída da água"`), a exclusão daquele item é **SUPRIMIDA** e a mensagem segue o fluxo normal (qualificar→transbordar, NUNCA recusa). Aparelho cru (*"quero uma máquina de lavar"*) **continua** recusando. Matcher reusa o MESMO whole-word/accent-insensitive (`containsWholeWord` extraído). **Sem migration** (JSONB livre) **nem regen de types**; config aplicada nos 3 agentes (Eletropiso/V2/Sandbox). Editor self-service novo no admin (`ExcludedProductsConfig` → "Exceções"). **+13 testes** (cobre o typo real "MAGUEIRA" liberado via "saída da água"). tsc 0 · vitest **1939/0** · deno check ai-agent 0. Deploy: ai-agent **v270** + UPDATE config 3 agentes + frontend push→CI. Smoke real (matcher deployado × config viva): **7/7** casos. Detalhe: [[project_except_keywords_v796]].

---

### v7.95.0 (2026-06-17) — 🧹 Hardening + limpeza (auditoria de pendências)

Achados SEGUROS da [[wiki/auditoria-pendencias-2026-06-17]] (varredura doc+código+backlog pós-v7.94.0): (1) **bug Rules-of-Hooks `BioLinksPage`** (return antes de 14 hooks → crash p/ não-superadmin) → early-returns após os hooks (eslint 12→0); (2) **RLS `USING(true) TO public`** → `service_role` em `ai_debounce_queue`+`scrape_jobs` (não lidas pelo front) + `search_path` em `get_previous_e2e_batch` (migration `20260617140000`); (3) **edge fns mortas `process-jobs`+`group-reasons`** deletadas (prod+source+config+UI); (4) **S9 requalificado** — backend JÁ enforça via `can_view_conversation` (não era vetor multi-tenant); (5) doc-sync (CLAUDE.md/roadmap ~98%, RULES.md→responseSanitizer, migrations registradas, MEMORY.md sob limite). tsc 0 · vitest 1926/0. Sem mudança de comportamento.

---

### v7.94.0 (2026-06-17) — 🔒 Trava de atendimento humano: fila não rotaciona + IA muda até "Finalizar"

Auditoria (workflow 10 agentes, verificação adversarial contra a prod) de 2 queixas do dono: lead atendido pela Jussara foi pra Djavan (e por 8 atendentes), e a IA continuava respondendo durante atendimento humano. **3 causas-raiz confirmadas:**
- **Rotação cega à resposta no celular** — `requeue-conversations` Case C (`detectResponded`) só conta resposta com `sender_id` (Helpdesk). Vendedor responde pelo CELULAR (`sender_id` NULL) → invisível → rotaciona a cada 10min pela lista toda até o teto 22 (filtro do R116). Caso real Laryssa: `Thiago→Lucas→Jussara→Djavan→Alvaro→Alberto→…` apesar do vendedor ter respondido.
- **Sem estado "em atendimento / finalizar"** — `assigned_to`/`status_ia`/tags são voláteis (reabertura e handoff de fila/abandono regravam 'ligada' e apagam marcadores). Nada prende o lead a quem assumiu.
- **IA re-arma sozinha** — ~150 msgs `ai_agent` + ~65 `ai_greeting` em 3d saíram com humano atribuído e IA em shadow (reabertura stripa `handoff_created`/`human_assigned` + religa 'ligada').

**Solução (decisão do dono): 1 fonte de verdade durável `conversations.human_handling_at`** — setada no **1º reply do vendedor** (celular via webhook `fromMe && !wasSentByApi`; Helpdesk já põe `desligada`). Enquanto NOT NULL: **RULE 1** a fila não rotaciona (sela o evento); **RULE 2** a IA fica em shadow (gate novo no `ai-agent`, antes do tag-gate). **Só "Finalizar"/"Ativar IA"/limpar-contexto** limpam o lock (congela indefinidamente, sem rede de segurança — decisão explícita). Não usa trigger por `external_id` (eco de API UAZAPI também é hex → falso-positivo); usa o sinal confiável `wasSentByApi`. Reabertura intocada (só age em `resolvida`; lock já limpo no Finalizar → retorno genuíno religa a IA, preserva janela 60d). Manager reassign manual (`manager_reassign_conversation` RPC) **bypassa** o lock (override deliberado).

- **Arquivos:** migration `20260617120000` (coluna + índice parcial + belt na RPC `find_abandoned_handoff_candidates`); `_shared/handoffQueue.ts` (early-return `human_handling`); `requeue-conversations` (sela+pula travada); `escalate-stale-handoffs` (pula travada); `whatsapp-webhook` (lock + sela evento no takeover, `shouldLockHumanHandling`); `ai-agent/index.ts` (gate durável); `TicketResolutionDrawer`/`ChatPanel`/`Leads`/`LeadDetail` (limpam o lock); `types.ts` (SYNC).
- **Verificação:** tsc 0 · vitest **1926/0** (+6) · `deno check` 6 fns 0. Backfill prod: 11 leads em rotação travados + eventos selados (0 ativos depois). Caso Laryssa fechado.

Deploy: migration aplicada (`prfcbfumyrrycsrcrvms`) · 6 edge fns scoop (`ai-agent` v269, `whatsapp-webhook` v18, `requeue-conversations` v11, `assign-handoff` v8, `escalate-stale-handoffs` v4, `handoff-abandoned-leads` v7) · frontend → CI → Portainer.

---

### v7.93.0 (2026-06-17) — 🎚️ Gestor pausa/despausa atendentes + esconde gestores da lista (aba "Atendentes")

Pedido do dono na aba **Atendentes** do `/dashboard/fila`: pausar/despausar cada atendente E tirar os gestores da lista ("são gestores, não atendentes").

- **Pausar/Reativar por atendente** (`AttendantPauseButton`, estado otimista) via RPC nova `set_queue_paused_for_user` — role-gated (`super_admin||gerente`) e **ESCOPADA POR INSTÂNCIA** (`p_instance_id` + `UPDATE` só nas departments daquele tenant; um gestor não mexe na fila de outra instância). Espelha `set_my_queue_paused`.
- **Gestores somem** dos cards, totais, contagens do header e da reatribuição. `is_manager` refinado: gestor que **não atende** a fila (`gestor_in_queue=false`) é gestor; quem tem `gestor_in_queue=true` (atende de fato) continua aparecendo. Hoje some **Josafá, Michelly e Televendas** (3 gerentes). Fonte única no front: `visibleAttendants()`.
- **Migration `20260617000000`** (3 fns: `set_queue_paused_for_user` nova + `get_queue_attendant_stats`/`get_queue_live_status` passam a respeitar `gestor_in_queue`); behavior-preserving pros dados atuais.
- **Revisão adversarial** (workflow 5 dimensões, 33 findings→12 confirmados) pegou um **🔴 blocker multi-tenant** (RPC sem `p_instance_id` pausava cross-tenant) — fechado mirando `manager_reassign_conversation`. **E2E real prod** (rolled back, JWT do Josafá): pausa atendente da instância→`rows_affected:1`; instância errada→`not_a_queue_member:0` ✅. tsc 0 · vitest **1920/0** (+15 testes).

Deploy: migration aplicada (`prfcbfumyrrycsrcrvms`) · frontend `87f0c67` → CI (gate) → Portainer.

---

### v7.92.0 (2026-06-14) — 🔒 Auditoria 2026-06-14: fecha os 3 riscos críticos (CI gate · escalate auth · SECURITY DEFINER anon)

Resolve os 3 maiores riscos da auditoria de estruturação ([[wiki/auditoria-estrutura-2026-06-14]]), cada um verificado end-to-end:

- **#1 Gate de qualidade no CI** — `deploy.yml` só fazia docker build + Portainer (zero tsc/lint/test; o `vite build` não typecheck). Novo job `quality-gate` com `needs:` no build: **tsc + vitest DUROS** (barra do RULES.md "0 erros TS + 100% testes"), lint informativo (`continue-on-error` — 218 erros src/ pré-existentes = dívida separada). Corrigidos **5 testes stale** (useForms sem mock de `auth.getSession`; FormBuilder `getByText('Campos')` ambíguo pós-refactor pill) → suíte 1905✓/0. `eslint` passa a ignorar `supabase/functions` (Deno≠browser). 2 envs `VITE_*` públicas injetadas no job. **Verificado:** run verde→build roda; runs com falha→build **skipped** (bloqueio provado).
- **#2 `escalate-stale-handoffs` sem auth** — `verify_jwt=false` + zero verificação → endpoint público disparava WhatsApp a vendedores/gerentes. Add `verifyCronOrService` (padrão do `handoff-abandoned-leads`). **Verificado em prod (v3):** cron autorizado→200, call bogus→401.
- **#3 65 SECURITY DEFINER executáveis por anon** — RPCs `dash_*` vazavam métricas com a anon key (pública). Migration cirúrgica `REVOKE EXECUTE FROM PUBLIC` (DO-block, `regprocedure`): grupo A (40 dash/fila/dashboard/agente, mantém auth+service) + grupo B (9 cron/backup, só service); **intocados** helpers de RLS, triggers, `increment_bio_*`. **Verificado:** advisor anon **65→16** (restantes = KEEP legítimo) + `has_function_privilege` (anon→dash FALSE, auth/service→TRUE, bio/RLS→TRUE). Achado: `apply_retention_policy` é chamada pela UI → ficou no grupo A.

Deploy: ai-agent `escalate` v3 (scoop) · migration aplicada · frontend `9ff922b`→`266310b` → CI (gate verde) → Portainer.

---

### v7.91.0 (2026-06-13) — 🎛️ `specialist_model` configurável por agente (decisão de config #4 do dono)

Fecha a decisão #4 do dono. O backend (`routerPipeline`) lia `agent.specialist_model || DEFAULT_SPECIALIST_MODEL` ('gpt-4.1') em **só 1 ponto** (product specialist), mas a **coluna nunca existiu no DB** — `select('*')` nunca a trazia, todo agente caía no default fixo. O handoff anterior dizia "backend já lê, só falta a UI"; na real faltava a coluna inteira + a fiação dos demais specialists.

- **DB:** migration `20260613010000` cria `ai_agents.specialist_model text NOT NULL DEFAULT 'gpt-4.1'` (= fallback atual → **zero mudança de comportamento**; os 3 agentes em prod ficaram `gpt-4.1`).
- **Fiação completa (`routerPipeline` DISPATCH):** `const specialistModel = agent.specialist_model || DEFAULT_SPECIALIST_MODEL` agora alimenta **qualificação, produto, objeção, handoff**. `greeting` fica de propósito no default barato (`gpt-4.1-mini`). Antes só `produto` recebia o config — objeção/handoff/qualif usavam o hardcoded. Todos os defaults = `'gpt-4.1'` = `DEFAULT_SPECIALIST_MODEL`, então threadar é behavior-preserving; só diverge quando o dono troca o modelo na UI.
- **UI:** seletor "Modelo dos Specialists (router)" na `BrainConfig` (6 modelos; default gpt-4.1) + `specialist_model` no `ALLOWED_FIELDS` + 3 blocos do `types.ts`.
- **Verificação:** deno check 0 · `tsc` 0 · 1900 testes (5 fails pré-existentes FormBuilder/useForms, 0 novos) · DB round-trip de save OK · **E2E real prod** (ai-agent **v268**): qualification specialist rodou pós-deploy com qualify-first coerente, `model=gpt-4.1`, zero erro. Deploy: migration aplicada + `ai-agent` v267→**v268** (binário scoop). Frontend push→CI→Portainer.

---

### v7.90.0 (2026-06-13) — 🗑️ Descomissionamento do Fluxos v3.0 (orchestrator): runtime morto removido (−10,4k lin)

O runtime "Fluxos v3.0" (M18) foi **descomissionado por completo**. Era feature construída mas **nunca ativada em prod** (`use_orchestrator=false` nas 3 instâncias + global; **0 `flow_states` históricos** — a engine nunca processou 1 mensagem) e **superada pelo router do `ai-agent`** (a arquitetura de produção real). Decisão de produto do dono; auditada por **workflow adversarial (21 agentes, 5 dimensões, 0 blockers)** antes do deploy.

- **Backend removido:** edge fn `orchestrator/` inteira (19 arq, ~5,3k lin: config/services/subagents/templates) + `getOrchestratorFlag()` e os 2 caminhos de roteamento condicional do `whatsapp-webhook` (poll-vote + trigger principal) → todo lead vai sempre pro `ai-agent-debounce`. Comportamento em prod **idêntico** (o flag era sempre false).
- **Irmãos do M18 (pegos no audit, não na minha 1ª varredura):** `process-flow-followups` (fn + **cron horário jobid 32** disparando 24×/dia sobre `flow_states` vazio = no-op perpétuo) e `guided-flow-builder` (fn órfã, caller deletado) também removidos. Migration `20260613000000` desagenda o cron.
- **Frontend removido:** UI dos Fluxos (`src/components/flows/`, 5 páginas `Flow*`, hooks `useFlows`/`useFlowSteps`/`useFlowTriggers`/`useInstallTemplate`, `flowTemplates`, `types/flows`), 5 rotas `/flows`, seção "Fluxos" da Sidebar, bloco `flow_states` do clear-context em Leads/LeadDetail.
- **Deixado inerte (follow-up opcional):** schema do DB (coluna `instances.use_orchestrator` + tabelas `flows`/`flow_states`/`flow_steps`/`flow_triggers`, com 1 flow de teste leftover) — drop exige regen do `types.ts` (HIGH RISK); RPC `install_flow_template` órfã; docs do M18 no vault (a marcar descontinuadas).
- **Total: −10,4k linhas** em 3 commits atômicos (`6fd1d7d` backend · `e44069e` frontend · `06ded1a` leftovers). Verificação: tsc 0, deno check (webhook) 0, vite build ✓ (sem chunks Flow), vitest 19 fails (todos pré-existentes, 0 novos). **Bônus do audit:** mediu o carrossel em prod (ai_agent_runs 30d) e derrubou a premissa de backlog "~4s serial" — é **1 chamada HTTP**; o delta de ~2,5s/turno é o round do LLM, não o envio → item de latência arquivado como misdiagnose.
- Deploy: migration de unschedule aplicada, webhook **v17**, 3 edge fns órfãs deletadas de prod, frontend push→CI→Portainer.

---

### v7.89.0 (2026-06-12) — 🧠 Onda 2 da auditoria do AI Agent: validação unificada + exit_action honrado + router pipeline extraído

Fecha o backlog Onda 2 da auditoria 2026-06-12 (5 itens, commits atômicos `f58297e`→`7beedda`):

- **Validação unificada monolith×router (crítico #1):** lógica de enforcement extraída do `specialistBase` pra **`_shared/agent/responseSanitizer.ts`** (contrato neutro `SanitizerCtx`, 14 testes novos); o monolith fallback adota o MESMO sanitizer determinístico e o **validator LLM (`validatorAgent`) foi aposentado do hot path** — o verdict BLOCK→handoff antigo sai (texto nocivo vira ponte propositiva, comportamento do router/prod desde v7.55.0). ⚠️ Decisão pendente do dono: `validator_enabled`/`validator_model`/`validator_rigor` ficaram sem leitor (remover da UI ou reaproveitar); `ai_agent_validations` para de receber rows (telemetria agora = event `response_sanitized`).
- **exit_action=handoff honrado sob router:** o sinal do motor determinístico (auto-extract atingiu max_score de stage com exit_action=handoff) era DESCARTADO ("specialist owns handoff") e a qualificação completa se perdia. Agora força o handoff_specialist com diretiva no prompt (`SpecialistCtx.exitActionDirective`) + `pendingHandoffTrigger` armado (step 22 executa se o LLM só verbalizar; guard `!hadExplicitHandoff` evita duplo); `qualificationGate` é pulado com o sinal pendente; guard de tag durável impede re-transbordo.
- **Router pipeline extraído do index.ts:** bloco de ~830 linhas (hop guard, classifyIntent, dispatch, no-result loop, gate, overrides, pré-busca, runSpecialist) virou **`_shared/agent/routerPipeline.ts`** — move-only verificado por diff byte-a-byte; index.ts 4152→3344 linhas. Passo do D6 (aposentar monolith).
- **HUMANIZATION_RULES fonte única:** `buildHumanizationRules()` em `promptRules.ts`, injetada pelo `specialistBase` em TODO specialist (objection/handoff ganharam as regras que não tinham) + monolith; cópias divergentes removidas de greeting/qualification/product (regras específicas preservadas).
- **INTERNAL_TAG_KEYS fonte única** em `constants.ts` (4 cópias → base + extras por site; facts block do monolith passa a esconder também `multi_interesse_pending`/`qualif_horizontal`).
- **Bônus:** suíte `productSpecialist.test` estava MASCARADA há meses (import `https:` via validatorAgent quebrava o loader; cadeia removida) — reativada com 2 asserts stale corrigidos (prompt cresceu 4,6→8,6 KB v7.49→v7.58 sem ninguém ver; reduzir é backlog).
- Verificação: deno check 0 em TODAS as fns, vitest 1260 verdes (14 fails pré-existentes), tsc 0. Deploy ai-agent **v267** + **smoke E2E real no sandbox**: turno determinístico (qualify-first tintas) ✓ e turno LLM (router→objection/handoff specialist gpt-4.1, handoff com reason rico, fila D-β reusada, msg fora-de-horário personalizada) ✓. Nota do smoke: handoff duplicado observado foi artefato do teste (curl direto bypassa o debounce que serializa turnos por conversa em prod).

---

### v7.88.0 (2026-06-12) — 🧹 Onda 1 da auditoria do AI Agent: constantes únicas + hot path + observabilidade

Quick wins da auditoria de inconsistências (4 agentes + verificação manual), comportamento preservado:

- **Constantes fonte única** (`_shared/constants.ts`): modelos default (`DEFAULT_SPECIALIST_MODEL` substituiu 'gpt-4.1' inline em 5 pontos do index; validator/router idem), caps de handoff (8/40, R146) e `max_lead_interactions` (15), e os **markers de handoff** `handoff_created:true`/`human_assigned:true` (2 leitores via `hasActiveHandoffMarker` + 6 escritores em 3 arquivos com chave computada — typo aqui desligava o gate de silêncio v7.76).
- **llmProvider coerente**: `callLLM` repassa o modelo RESOLVIDO pro `callOpenAI` (antes, `req.model` vazio roteava como gpt-4.1-mini mas executava o default interno **gpt-5-mini** reasoning, 4× mais caro); defaults unificados em `DEFAULT_LLM_MODEL`.
- **Hot path**: `getLeadFullName` memoizado (full_name era re-buscado em até 5 paths de handoff/turno) + logs dos 5 detectores determinísticos viram fire-and-forget **com catch logado** (~50-100ms/turno) + índice composto `ai_agent_logs(conversation_id, agent_id, event, created_at)` pros 2 COUNTs do greeting check (migration `20260612010000`).
- **Gap do v7.85 fechado**: `executeShadowTool.update_lead_profile` gravava `full_name` SEM `sanitizeProfileName` — o shadow vendor LLM ainda podia gravar "Garagem" como nome. Agora usa a mesma fonte única.
- **Observabilidade**: 2 `catch {}` do `automationEngine` (parse do messageId do poll) agora logam. **Docs**: router documentado como gpt-4.1-mini (gpt-5-nano falhava parse JSON) em `wiki/arquitetura.md` + nota no CLAUDE.md.
- Suíte: 1207 verdes (14 fails pré-existentes idênticos no HEAD — testes Deno `https:` + asserts antigos do "anotei"; confirmado via stash). deno check 0. Deploy: ai-agent v266, whatsapp-webhook, form-bot.

---

### v7.87.0 (2026-06-12) — 🟢 Drawer "Reatribuir atendimento" não lista mais gestores

**Pedido (print):** Josafá e Michelly (gestores) apareciam como candidatos no drawer de reatribuição do dashboard de Fila — gestor não atende.

**Fix por PAPEL (não por nome):** RPC `get_queue_attendant_stats` ganha coluna `is_manager` (EXISTS em `user_roles` com role `gerente`/`super_admin` — cobre multi-role; DROP+CREATE porque RETURNS TABLE não aceita coluna nova, GRANT reaplicado). O `ReassignDrawer` filtra `!is_manager`; os **cards de stats da aba Atendentes continuam mostrando todos** (o RPC inclui gestor de propósito ali). Migration `20260612000000_queue_attendant_stats_is_manager`. Validado no DB real: Josafá/Michelly/George/**Televendas** vêm `is_manager=true` — ⚠️ Televendas tem role `gerente` no sistema e também saiu da lista; se ele deve ser reatribuível, trocar a role pra `user`.

**Fila automática ("mesma coisa para a fila"):** auditoria mostrou que o rodízio JÁ filtra gestor por design — `pick_next_assignee` (D30, Q6) pula role `gerente` sem `gestor_in_queue=true`, e os 3 gestores estão com `gestor_in_queue=false`. **Buraco real achado e fechado:** o reuso D-β (`isPreviousAssigneeEligible` em `handoffQueue.ts`) só checava `queue_paused` — selecionava `gestor_in_queue` mas NUNCA usava → gestor que pegou uma conversa manualmente UMA vez podia receber o re-handoff da mesma conversa pra sempre. Agora espelha a regra Q6 (lookup `user_roles` role=gerente + `gestor_in_queue`). 2 testes novos (23 verdes), deno 0. Deploy das 4 fns que bundlam handoffQueue: ai-agent v265, requeue-conversations, assign-handoff, handoff-abandoned-leads.

---

### v7.86.0 (2026-06-12) — 🟢 Vaga de emprego: resposta determinística pedindo currículo + classificação (pedido do dono) + docs de providers corrigidas

**Pedido:** lead que chega por vaga de emprego → classificar como vaga de emprego, pedir currículo pro `dppeletropiso@hotmail.com` e perguntar se pode ajudar em algo mais.

**Design (mode-agnostic + config-driven):** novo `_shared/agent/jobVacancy.ts` — `detectJobVacancy` (sinais fortes: currículo/emprego/contratando/processo seletivo/trabalhar com vocês; sinal fraco "vaga(s)" bloqueado por contexto físico garagem/estacionamento/demarcação) + `tryJobVacancyShortCircuit` wireado no index.ts **ANTES do gate `routing_mode='router'`** que pula R129/R136 (nenhum specialist trata RH → sem caminho paralelo; os 3 agentes rodam router). Só ativa com `business_info.jobs_email` preenchido (multi-tenant: sem e-mail, inerte). Ao detectar: tag durável `motivo:vaga_emprego` (guard anti-loop — "vou mandar o currículo" não re-dispara) + resposta com o e-mail + "Posso te ajudar em algo mais?". Send falhou → tag persiste e o LLM assume (o e-mail entrou no `buildBusinessSection`, que os specialists herdam via R148). Summarizer já tinha categoria `vaga_emprego` (v7.82) → dashboard Motivos classifica ao resolver.

**Config/UI:** campo "E-mail para Currículos (vagas)" no `BusinessInfoConfig` (JSONB `business_info.jobs_email`, já coberto por ALLOWED_FIELDS — sem migration). E-mail aplicado nos 3 agentes (Eletropiso/EletropisoV2/Sandbox). 11 testes novos (detector + reply + short-circuit com mocks), 57 verdes no total, deno 0. Deploy ai-agent **v264**.

**Docs (auditoria itens 1-2):** `wiki/infraestrutura.md:45` (Cérebro IA dizia "Gemini" → OpenAI gpt-4.1-mini, fallback Gemini) + summarizer Groq→OpenAI/callLLM em `wiki/arquitetura.md`, `AGENTS.md`, `README.md` (separando carousel copy, que segue Groq→Gemini→Mistral).

---

### v7.85.0 (2026-06-12) — 🟢 Telefone do lead na lista do Helpdesk + IA não grava mais INTERESSE como NOME ("Garagem")

**Contexto (2 prints do dono):** (1) lista de conversas não mostrava o número do WhatsApp do lead; (2) lead aparecia como **"Garagem"** — a IA pegou o interesse ("produtos para garagem") e gravou como `full_name` via `update_lead_profile`. Auditoria no DB: **5 leads** afetados ("Garagem", "Chuveiro" ×2, "Material", "Cozinha"); o caso Garagem tinha pushname real "Juliana Wanderley 👫" sendo escondido pelo nome errado (display name prioriza `lead_profiles.full_name`, v7.78.0).

**Fix UI:** `ConversationItem.tsx` mostra o telefone formatado (`formatPhone` de `phoneUtils`) sob o nome; omitido quando o display name JÁ é o telefone (sem duplicar).

**Fix de raiz (nome):** `sanitizeProfileName` em `_shared/agent/nameCapture.ts` (fonte única) — estrutura (só letras, 1-5 palavras, sem dígito/?/@), léxico (`NON_NAME_WORDS` ampliada: ambientes/cômodos, papéis, materiais — com e sem acento) e **contexto** (candidato contido nos interesses do lead = interesse, não nome; trade-off "lead Rosa × tinta rosa" documentado). Aplicado no `updateLeadProfile` (crmTools): nome rejeitado NÃO grava + feedback explícito pro LLM ("NUNCA chame o lead de X; pergunte o nome"). O dedup de doubling ("PedroPedro") migrou pra dentro do sanitize. Os caminhos determinísticos (`extractLeadName`, 2 usos no index.ts) herdam a blocklist ampliada sem mudança.

**Dados:** `full_name` dos 5 leads anulado (exibição volta pro pushname sincronizado pelo webhook). 47 testes verdes (14 nameCapture + 33 crmTools, casos novos p/ Garagem/Suvinil-em-interesse/Michelly legítimo), deno check 0. Deploy: ai-agent **v263**.

---

### v7.84.0 (2026-06-11) — 🟢 Venda detectada na fase do VENDEDOR (melhoria #1) + fix falso-positivo "Tá certo" (97/99 das vendas IA eram fantasma)

**Contexto:** funil v7.83 tinha venda só por regex lead-side (`detectSaleClosed`) + drawer (7 usos/30d). 587 handoffs/30d → só 89 com venda marcada; o fechamento que acontece COM O VENDEDOR não virava tag. Dono aprovou opção C (defesa em profundidade, 2 camadas).

**Camada A — tempo real (takeover celular):**
- `detectVendorSaleClosed` em `_shared/saleClosedDetection.ts`: padrões do lado VENDEDOR ("segue a chave pix", "comprovante recebido", "pedido faturado", "entrega agendada", "obrigado pela compra") com fallback pros padrões lead. Wire no bloco `sale_closed_detected` do ai-agent quando `shadow_only` (antes a msg do vendedor era varrida só com padrões de lead) + `metadata.source` (`vendor_message`/`lead_message`).
- Shadow vendor LLM: enum `venda_status` ganha **`fechada`** (só negociando/fechando/perdida/pausada existiam — o sinal não tinha onde ser registrado) + regra anti-intenção. `executeShadowTool` promove deterministicamente `venda_status:fechada` → `venda:fechada` (`shouldPromoteVendorStatusToSale`), com guard: veredito existente (`venda:*` da IA ou `resultado:*` do humano, ex. `resultado:perdido`) NUNCA é sobrescrito por LLM.

**Camada B — rede de segurança no summarizer (cobre vendedor pelo Helpdesk app, invisível pro shadow):**
- `SUMMARY_SYSTEM_PROMPT` ganha chave `sale_closed` (regras estritas: pagamento/pix/comprovante/pedido faturado = sim; INTENÇÃO não é venda; na dúvida false) + `normalizeSaleClosed` (boolean coerce, default false).
- `auto-summarize`/`summarize-conversation`: `sale_closed=true` sem veredito prévio → merge `venda:fechada`. Custo extra ZERO (mesma chamada).
- Migration `find_summarize_candidates_resummary`: conversa com atividade nova pós-resumo (last_message_at > generated_at, fallback expires-60d) volta a ser candidata — sem isso, venda que fecha DEPOIS do resumo escaparia pra sempre. Auto-throttle (re-resumo atualiza generated_at). Re-burn imediato: 31 convs.

**🚨 Achado de auditoria no E2E — funil INFLADO, não subnotificado:** medindo `sale_closed_detected` (30d), **97/99 tinham casado só a palavra "certo"** ("Tá certo", "Certo, obrigada!") — o grupo `(\s+pra\s+(mim|n(ó|o)s))?` do padrão `fechado` era OPCIONAL e `\bcerto\b` casava sozinho. Inflava o funil E disparava handoff prematuro (path Bug 18) em modo normal. **Fix:** "certo"/"finalizado" agora exigem o complemento "pra mim/nós"; venda verbalizada de forma vaga fica pro shadow LLM/summarizer (com guard). **Decisão do dono: histórico intocado** — as 99 tags antigas ficam (limitação documentada); só dados novos são confiáveis.

**E2E real (sandbox, pipeline vivo):** (1) summarizer sobre conversa com fechamento → `sale_closed=true` + tag ✓; (2) `vendor_message` "Segue a chave pix" → `pix_enviado`/`source:vendor_message` + tag ✓; (3) msg vaga sem regex → LLM tagueou `venda_status:fechada` → promoção gravou `venda:fechada` (`source:shadow_vendor_llm`) ✓; (4) "Tá certo, obrigado!" → ZERO detecção determinística ✓. Cleanup completo (msgs de teste deletadas, tags restauradas). 17+3 testes deno + 10 vitest, deno check 0. Deploy: ai-agent v262, auto-summarize v7, summarize-conversation v6.

---

### v7.83.0 (2026-06-11) — 🟢 Funil de Conversão REAL (5 etapas por tags duráveis) + lead score religado + família de venda unificada + resolved_at honesto

**Decisão do dono (opção C):** funil contato → qualificação → intenção → **repasse ao vendedor** → **venda marcada** (híbrida: IA `venda:fechada` via saleClosedDetection + humano `resultado:venda` via Finalizar Atendimento — que JÁ EXISTIA completo no `TicketResolutionDrawer`).

**Causa raiz do funil 2 meses zerado:** contrato produtor↔consumidor quebrado — `aggregate-metrics` esperava `extracted_data.tags[]` com vocabulário `intencao:alta`/`conversao:*`, mas o tool `extract_shadow_data` emite objeto LIVRE sem `tags` → etapa null e score delta 0 SEMPRE (653 leads parados no default 50). **Fix na fonte:** etapas derivadas DETERMINISTICAMENTE das tags duráveis de `conversations.tags` (`_shared/funnelStages.ts` puro, 10 testes) + lead score lido de `lead_score:NN` (determinístico, preLLMAutoExtract). Migration: etapa `handoff` no CHECK; TRUNCATE+re-derivação 30d.

**Família de venda unificada** (KPI dizia 97, funil 19): TODOS os contadores agora contam `venda:fechada` OU `resultado:venda` — `dash_kpis_resumo`, `dash_vendas_por_vendedor`, `dash_cotacoes`, `dash_conversao_orcamento_venda`, `get_conversion_by_origin` (que ainda buscava a tag fantasma `venda:fechada` em `lead_profiles.tags` → 0 eterno; agora lê eventos reais do funil + **SECURITY DEFINER** — sem ele, RLS de `conversion_funnel_events` exige inbox_users membership e o gestor via 0). `venda_status:fechando` = em-fechamento → intenção, não conversão.

**resolved_at honesto:** `v_vendor_activity`/`v_handoff_details`/`aggregate-metrics` usam `resolved_at` real (drawer) com fallback `updated_at` + backfill 2 faltantes — tempo médio do Lucas caiu de "192h52min" (proxy updated_at) pra **2h50min**.

**E2E real (Playwright + DB):** funil ao vivo 591→412→380→480→**99** · Conversão por origem 99/16,8% · KPI 100 · score médio 41 (302 leads com score real, 42 quentes ≥70, antes ZERO) · varredura card a card do /dashboard/gestao. 10/10 testes funnelStages, deno 0, tsc 0 novos.

---

### v7.82.0 (2026-06-11) — 🟢 Motivos de contato com TAXONOMIA de negócio ("info sobre telha de PVC" = Interesse de compra) + subinteresses no tooltip

**Pedido do dono (print do card):** motivos saíam como frases soltas ("Solicitação De Informações Sobre Telha De Pvc" 1x cada) — *"se o lead manda informações sobre telha de pvc e não é uma dúvida técnica isso é interesse de compra, reclassifique todos ou crie um subinteresse"*.

**Fix na fonte (taxonomia no resumo, não pós-processamento):**
- `_shared/summaryPrompt.ts` NOVO — fonte única do prompt de resumo + taxonomia fixa de 8 categorias (`interesse_compra`, `duvida_tecnica`, `troca_devolucao`, `status_entrega`, `reclamacao`, `vaga_emprego`, `fornecedor`, `outro`) com a REGRA do dono: *pedido de informação/preço/disponibilidade/modelos de PRODUTO = interesse_compra; dúvida técnica é SÓ uso/instalação/aplicação; na dúvida, interesse_compra*. `normalizeSummaryCategory()` coage resposta inválida do LLM pra `outro`.
- `auto-summarize` + `summarize-conversation` usam o prompt compartilhado e gravam `ai_summary.category` validado (antes cada um tinha cópia do prompt sem categoria).
- **`TopContactReasons` reescrito:** agrupa por categoria DETERMINISTICAMENTE (sem LLM em tempo de view — aposenta a chamada `group-reasons` do card, que ainda caía em CORS no localhost); barra por categoria + **subinteresses no tooltip** ("telha de PVC (3x)…"); badge "Classificado por IA". De quebra zera os 4 erros tsc pré-existentes do arquivo.
- `AiSummary.category?` no types.
- **Reclassificação total:** 121 resumos da era sem-categoria anulados → o cron backfill (v7.81.0) regenera tudo com categoria; restantes ~600 já nascem categorizados.
- **Bug pego no E2E da reclassificação — cota do Groq free:** após o wipe, os ticks do cron retornavam 200 em ~17s gravando ZERO (~350ms/conversa = todas as chamadas Groq falhando rápido; o teto DIÁRIO de tokens do free tier esgotou com os ~120 resumos + recompute — falha progressiva silenciosa que começou ANTES da taxonomia). **Fix de raiz:** summarizers migrados do fetch Groq cru pro **`callLLM` do `_shared/llmProvider.ts`** (stack padrão do projeto: OpenAI `gpt-4.1-mini` primário + fallback Gemini + circuit breaker). Custo do backfill completo ~US$0,70. Sonda pós-deploy: `interesse_compra` / "Interesse em telha Imbralit… tamanhos e preços" ✓.

**Validação:** deno check 0 (2 fns), tsc 0 erros novos, E2E real (sonda single-conv + categorias coerentes no DB + card agrupado por categoria).

---

### v7.81.0 (2026-06-11) — 🟢 Dashboard Gestor: "Motivos de conversa" religado (pipeline ai_summary NUNCA tinha rodado) + Ranking Vendedores contava 0 resolvidas (views com status em INGLÊS)

**Pedido do dono:** "audite e veja pq nao tem motivos de conversa no dashboard". **Achado 1 — o card nunca teve dado:** das 805 conversas (30d), **ZERO com `ai_summary`** (zero all-time). O único produtor automático era o trigger `auto_summarize_on_resolve`, **morto em 4 camadas**: (a) lia GUC `app.settings.anon_key` que é sempre NULL (Supabase não seta — só emitia WARNING e pulava o HTTP call); (b) URL de fallback hardcoded do projeto MORTO `crzcpnczpuzwieyzbqev` (herança Lovable, 2 migrações atrás); (c) `extensions.net.http_post` = schema inexistente; (d) mesmo se chamasse, `verify_jwt=true` + anon key → 401. E os modos `backfill`/`inactive` da fn nunca tiveram cron (só existia o cron que APAGA summaries expirados).

**Fix (padrão estabelecido, zero gambiarra):**
- Trigger morto DROPado; cron `auto-summarize-backfill` (vault `CRON_AUTH_KEY`, mesmo padrão do jobid 38) chama `mode=backfill`.
- RPC `find_summarize_candidates`: filtro de ≥3 mensagens vai pro SQL — antes, conversas curtas ("oi" e sumiu) ficavam PERMANENTEMENTE no topo da janela de candidatos, estrangulando as elegíveis mais antigas. + piso 60d alinhado ao expiry (sem ele, summaries expirados re-entravam em churn infinito). `REVOKE FROM PUBLIC/anon/authenticated`.
- `verify_jwt=false` no config.toml (regra: fn chamada por pg_cron) + deploy CLI scoop (v3).
- `TopContactReasons`: filtro de instância passa pro servidor (`inboxes!inner`) — client-side após `limit(500)` deixava outras instâncias consumirem o limite.

**Achado 2 — família de bugs EN×PT em `conversations.status`** (valores reais: `aberta`/`pendente`/`resolvida`): 3 views comparavam `'resolved'`/`'pending'` → `v_vendor_activity` (Ranking Vendedores "0 resolv./0%" pra todos + `v_ia_vs_vendor.vendor_resolved` herdado), `v_handoff_details` (**`converteu` sempre false**), `v_lead_metrics` (resolved_count 0). + `aggregate-metrics:149` (`'resolved'` → shadow_metrics histórico zerado), `assistantQueries.pending_conversations` (`'pending'` → assistente sempre respondia 0), `useVendorDetail.ts` front (`'open'/'pending'`). **Tudo corrigido** (migration `fix_view_status_literals_pt` + 2 fns redeployadas + front) e shadow_metrics dos últimos 30 dias **recomputado** (fn aceita `date`). Bônus: 3 erros deno pré-existentes zerados (aggregate-metrics tipo do consolidated; assistant-chat `.catch` em PromiseLike).

**Validação E2E real (Playwright, localhost + DB prod):** backfill ao vivo populando (89+ resumos na 1ª hora, motivos coerentes: "telha de PVC", "chuveiro Lorenzetti", "caixa d'água 2000L"); card "Principais Motivos de Contato" RENDERIZANDO com agrupamento IA; Ranking Vendedores ao vivo: Lucas 110 conv/28 resolv./26%, Rafaella 64% (antes: tudo 0). deno check 0 nas 3 fns; tsc sem erro novo (5 pré-existentes provados via stash). Backfill completo ~750 conversas conclui via cron.

---

### v7.80.0 (2026-06-11) — 🟢 Cutucada e transbordo por inatividade citam o PEDIDO do lead ("Vi que você procurava porcelanato 60 por 60!")

**Pedido do dono (caso real Van/porcelanato):** a cutucada de abandono saía genérica ("Ainda tá por aí? 😊…") mesmo com o pedido seedado nas tags (`pedido_original:porcelanato 60 por 60`) — contexto que recupera o interesse do lead estava jogado fora.

**Fix (determinístico, zero LLM):**
- `parsePedidoOriginal(tags)` — extrai `pedido_original:` (fallback `interesse:`), cap 60 chars em fronteira de palavra.
- `personalizeNudge(msg, nome, pedido)` — tece o pedido: placeholder `{pedido}` na mensagem configurada OU prefixo neutro "Vi que você procurava {pedido}! "; compõe com o nome ("Eduarda, vi que você procurava…"). Sem pedido → comportamento de sempre.
- **Transbordo (estágio 2)** também cita: `itemSummary` recebe o pedido no fluxo inatividade-sem-carrinho → *"Seu pedido de porcelanato 60 por 60. Já passei tudo pro nosso vendedor…"*.
- **Nota interna rica**: `🔎 Lead buscava: {pedido}` — vendedor não precisa rolar a conversa (fecha achado (b) da auditoria de áudio 2026-06-11).
- Trigger do log de handoff também ganha o pedido (`Lead buscava: …`).

**Validação NOTA 10:** 45/45 testes (10 novos: pedido+nome, placeholder, strip gracioso, cap, retrocompat) · deno check 0 · **E2E real sandbox via CRON DE PRODUÇÃO** (invokes manuais deram scanned:0; o tick real de 1min executou os 2 estágios na função deployada, WhatsApp entregue no número do operador): estágio 1 *"Vi que você procurava porcelanato 60 por 60! Ainda tá por aí? 😊…"* → estágio 2 transbordo citando o pedido + nota interna 🔎 + `status_ia=shadow` + tags limpas. Flags do sandbox restauradas; zero efeito colateral (só a conversa de teste tocada).

---

### v7.79.0 → v7.77.0 (2026-06-09/11)

Movidas p/ [[wiki/changelog/2026-06-part4]] (busca server-side acha conversa fora do filtro + deep-link; preview da lista congelava na última msg da IA — trigger fonte única + backfill 725; nome extraído pela IA vence o pushname na exibição — caso "oi"→Jessica; vendedores Android sem enviar foto — aba velha pós-deploy + auto-recuperação de versão + upload anti-zumbi + telemetria).

---

### v7.76.0 → v7.75.0 (2026-06-09)

AI Agent: handoff repetia + IA falava após transbordo — gate de silêncio durável (`status_ia→shadow` por `handoff_created`/`human_assigned`), handoff idempotente, webhook não rebaixa `shadow→ligada` (ai-agent v260/webhook v15). Helpdesk: foto HEIC envia (`normalizeOutboundImage` magic bytes + `heic2any`→JPEG). Detalhe: memórias `project_handoff_repeat_silence_v776` · `project_heic_photo_send_v775`.

### v7.74.x → v7.73.0 (2026-06-04/05)

Fila: quem enviou cada msg + "{Nome} (responsável)" + busca + rede-segurança Disparador. Arquivado: [[wiki/changelog/2026-06-part3]].

### v7.72.0 → v7.68.0 (2026-06-03/04)

Movidas p/ [[wiki/changelog/2026-06-part2]] (reatribuição notifica atendente, mídia base64→URL, cadastro de membro atômico, import em massa, auto-enroll do Disparador, módulo de bases + hardening, avatar de instância no Storage).

### v7.67.0 → v7.63.1 (2026-06-01 a 06-02)

Movidas p/ [[wiki/changelog/2026-06-part1]] (paridade Agente↔admin, fora-horário acumula pedido, inatividade 2 estágios, 5 bugs determinísticos, fila sem-atendimento).

### v7.63.0 → v7.61.0 (2026-05-31)

Movidas p/ [[wiki/changelog/2026-05-part13]] (Dashboard gestor + fetch_messages_timeout + reload de aba).

### v7.60.0 (2026-05-31) e anteriores

v7.60.0 → v7.56.1 → ver [[wiki/changelog/2026-05-part12]]. Anteriores → [[wiki/changelog/2026-05-part11]].
