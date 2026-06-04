---
title: Activity Log
type: log
---

# Activity Log

> Registro cronológico de ingestões, consultas e manutenções do vault. Append-only.

---
## 2026-06-04 (tarde II) — 🔍 Causa raiz do `.git/index` corrompido + v7.73.1 (nome do atendente-celular)

**Investigação `.git/index` (3ª corrupção):** o índice corrompido é **172224 bytes 100% zeros** com o tamanho exato de um índice válido — assinatura clássica de **perda do write-back cache do NTFS em desligamento sujo** (NTFS jornaliza o tamanho, não os dados). **Causa raiz CONFIRMADA via Event Log:** a máquina (Acer, notebook) sofre **BSODs frequentes** — ~12 BugChecks (Event 1001) em 20 dias, dominados por **`0x139` KERNEL_SECURITY_CHECK_FAILURE** (subcódigo `0xa`=LIST_ENTRY corrompida) + `0xfc`/`0x50`/`0x1e`. Datas batem exatamente: crash 04/06 09:00 → índice zerado 09:18; crashes 24/05 12:10 e 17:22 → 1ª corrupção. OneDrive descartado (repo fora do OneDrive); Defender não é causa; bateria 100%/AC. **Mitigação aplicada (git):** `core.fsync=all` + `core.fsyncMethod=fsync` GLOBAL — git passa a fazer flush durável do índice ANTES do rename atômico, então um crash não deixa mais o índice zerado (fica o válido antigo OU o novo). **NÃO resolve os BSODs** (driver de kernel/RAM — fora do escopo; recomendado analisar minidumps em `C:\Windows\Minidump` + Windows Memory Diagnostic + atualizar drivers). Detalhe: [[project_git_index_corruption_root_cause]].

**v7.73.1 — nome do atendente pelo celular:** print do dono — msg "BOA TARDE, essas luminárias de jardim…" (contato ".", takeover) saía como "IA". DB confirmou: `sender_id` NULL + `external_id` hex (`3EB09C…`) = atendente no celular; assignee = **Thiago**. Refino: msgs de takeover (sem sender_id) agora mostram o **nome do atendente atribuído** (`assigned_to`→`user_profiles`) em vez de "Atendente" genérico. `ConversationModal.tsx` busca o `assigned_to` da conversa + inclui no `useUserProfiles`. **E2E real (Playwright):** rótulo "Thiago · 02/06, 14:44" confirmado. tsc 0, frontend-only. Detalhe: [[project_fila_message_sender_names_v773]].

---
## 2026-06-04 (tarde) — 🟢 Fila: cada mensagem mostra QUEM enviou (lead/atendente/IA) — v7.73.0

Dono (print do modal "Conversa com Marya Silva" na Fila): cada mensagem deve mostrar **quem enviou** e o **nome do atendente**. Hoje o `ConversationModal.tsx` rotulava genérico: incoming→"Lead", outgoing+`sender_id`→"Atendente" (sem nome), senão→"IA".

**Processo (ultracode + workflow):** workflow de auditoria+escopo (4 agentes) mapeou call sites + o padrão de resolução de nome. **Verificação adversarial do ponto de risco** (classificar IA vs atendente-no-celular): o webhook insere TODA msg `fromMe` com `external_id` hex e SEM `sender_id` (não pula `wasSentByApi`) — dúvida: hex seriam echoes da IA? **Provado no DB PROD** (`prfcbfumyrrycsrcrvms`): das 3128 linhas outgoing hex, **0 casavam com echo de `ai_*`**; amostra de conteúdo (vCards, "Da certo sim", "me envie o cep… enderço") + `status_ia=shadow/desligada` confirmam = **atendente digitando no celular** (takeover). IA sempre grava `external_id` com prefixo (`ai_agent_`/`ai_*`/`follow_up_`/`abandon_`/`auto_`/`nps_`/`queue_oof_`) ou NULL; app grava `sender_id`.

**Fix (`ConversationModal.tsx`, frontend-only):** classificação por `kind` (lead/note/agent/agentPhone/ia) — incoming→nome do lead (`contactName`); outgoing+`sender_id`→nome real via `useUserProfiles` namesMap (MESMO padrão do Helpdesk; super_admin/co-membro vê via RLS, fallback "Atendente"); outgoing sem sender_id→`isAiSent(external_id)` (NULL/prefixo→IA, hex→"Atendente" celular). Add `external_id` à interface+SELECT.

**E2E real no app (Playwright, dev local + dados PROD), todos os 5 casos:** lead→"Carmem Lucia"/"Marcenaria Lucine"/"José Maria da Silva"; IA→"IA"; nota→"Nota interna"; takeover-celular (foto/áudio/vCard)→"Atendente" (era "IA"); app→nome real **"Televendas"**. tsc 0. Fecha um bug latente (msgs humanas do celular eram exibidas como "IA"). Detalhe: [[project_fila_message_sender_names_v773]].

**Manutenção da sessão:** `log.md` particionado (299→161; entradas 2026-05-29→06-01 → [[wiki/log-arquivo-2026-05-29-a-06-01]]) pra respeitar o hard limit 300.

---
## 2026-06-04 (manhã) — 🧰 Fix de raiz: coordenadas de deploy/Supabase paravam de "sumir" toda sessão

Início de sessão com pedido do dono: "veja o que falta commitar/deployar e **por que você esquece os dados do Supabase e de deploy toda vez**". **Git:** `.git/index` corrompido DE NOVO (assinatura `0x00000000`, 3ª vez — já comeu a v7.47.0 fantasma); reconstruído do HEAD (`git read-tree`, backup `.git/index.corrupt.bak.2026-06-04`), sem perda. Working tree limpo, 0 unpushed, último = v7.72.1; nada estava pendente.

**Causa raiz do "esquecimento" (dupla):** (1) as docs duráveis do repo apontavam pro **ref morto** `euljumeflwtljegknawy` (atual = `prfcbfumyrrycsrcrvms`, migração 2026-05-19) e mandavam `npx supabase` (**quebrado** nesta máquina, `uv_spawn`) — eu lia, errava, tomava 403/uv_spawn e redescobria. (2) A info certa (`reference_supabase_token_novo`, `feedback_deploy_edge_use_cli_not_mcp`) existia em memória mas **não carregava**: `MEMORY.md` estava 26.9 KB > limite 24.4 KB → truncado → seção References nunca chegava ao contexto.

**Fix (3 frentes, aprovado via AskUserQuestion):** (a) bloco **"🚀 Deploy & Supabase — coordenadas"** no `CLAUDE.md` (sempre carregado; ref/binário scoop/`--use-api`/403=PAT, SEM valor do token). (b) **11 docs corrigidas** (deploy.md, deploy-checklist.md, deploy-detalhado.md, ARCHITECTURE.md, AGENTS.md, RULES.md, README.md, banco-de-dados.md, ai-agent.md, regras-preventivas.md + este log): ref atual + binário scoop (não npx). (c) `MEMORY.md` enxugado 26.9→20.4 KB (hooks ≤~150 chars, dedupe `manager_attendance_dashboard`, corrigido hook errado "npx" do `deploy_edge_use_cli_not_mcp`) + memória `reference_supabase_token_novo` alinhada ao scoop. Healthcheck 300 lin OK em todos. Planos/auditorias datados deixados como registro point-in-time.

---
## 2026-06-03 (noite IV) — 🔔 Reatribuição do gestor notifica o novo atendente (v7.72.0)

Dono pediu: ao reatribuir uma conversa no dashboard da Fila ("Sem atend." → Reatribuir), o **novo atendente** recebe a notificação no WhatsApp pessoal dele (e o anterior é avisado que saiu). Reusa a `notify-vendor-assignment` da fila automática (8 guards). Wire em `useReassignConversation` (fire-and-forget pós-RPC; falha não quebra a reatribuição) + `UnattendedLeadsTab` passa o `assigned_to` anterior. tsc 0; invocação frontend confirmada (200 skipped sem spam). Frontend-only. Commit `89cb7f8`/merge `8984e7d`. Cruza [[project_manager_attendance_dashboard]] e [[project_vendor_notif_activated_eletropisov2]].

---
## 2026-06-03 (noite III) — 🐛 Grupo + Lead: mídia também base64 → URL (v7.71.5)

Estende o fix v7.71.4 aos 2 outros pontos que mandavam imagem como base64 (rejeitada pelo UAZAPI): **Enviar ao Grupo** (`SendMediaForm`) e **Enviar pra Lead** (`LeadMessageForm`). Helper novo `uploadOutboundMedia(file)` sobe pro bucket público `helpdesk-media` e devolve a URL pública (contentType/ext robustos). **E2E real:** upload ao Storage (como Michelly) → URL → proxy deployado → 200 + foto entregue → objeto limpo. tsc 0, frontend-only. Commit `3e2f6bf`/merge `3409747`. Detalhe: [[project_helpdesk_image_send_url_v7714]]. Backlog: Disparador em massa + carrossel ainda usam base64.

---
## 2026-06-03 (noite II) — 🔴 Helpdesk: envio de FOTO ao cliente voltou a funcionar (v7.71.4)

Dono: vendedores não conseguem enviar fotos aos clientes pelo Helpdesk. **Auditoria por workflow multi-agente** (`audit-helpdesk-image-send`: 5 investigadores paralelos + síntese) com **teste ao vivo**. Causa-raiz: `useSendFile.ts` subia a foto pro Storage (já tinha `filePublicUrl`) mas **descartava a URL** e mandava **base64-cru** pro `/send/media`, que o UAZAPI **rejeita** (HTTP 500 "unsupported image format"); a **URL pública é aceita+entregue** (mesmo `file: <URL>` do AI Agent em PROD). Falha invisível: o front ignorava a resposta do UAZAPI → "Imagem enviada!" fantasma. Último envio de foto por vendedor real: 2026-05-28. **Fix:** envia `filePublicUrl` + **valida a resposta** (sem fantasma) + contentType/ext robustos; `uazapi-proxy` `send-media` vira **502** em 200-com-erro + guard 16MB. **E2E real** (logado como Michelly via proxy deployado, nº controlado): URL→200+foto entregue, base64→500. Deploy: `uazapi-proxy` CLI + frontend push. tsc/deno 0. Commit `e499c37`/merge `78f5cc9`. Detalhe: [[project_helpdesk_image_send_url_v7714]]. **Backlog (mesmo root cause):** `SendMediaForm.tsx` (Enviar ao Grupo) usa base64; `MessageBubble` sem estado de falha; sem HEIC.

---
## 2026-06-03 (noite I) — 🐛 Cadastro de membro atômico server-side + Michelly resolvida (v7.71.3)

Dono: erro ao cadastrar Michelly (Gerente), preso em "Criando...". **Diagnóstico:** a `admin-create-user` já criava auth+perfil+papel, mas os 3 vínculos (instância/caixa/depto) eram feitos pelo **navegador** depois — travou no meio (`ERR_NAME_NOT_RESOLVED`/DNS na máquina do dono), deixando a Michelly **meio-criada** (sem vínculos). Completei os 3 vínculos da Michelly direto no DB (loga Gerente, `michelly@eletropiso.com.br`). **Fix de raiz:** vínculos movidos pra DENTRO da edge fn (criação **atômica**, 1 requisição) + recuperação self-healing se o e-mail já existir (RPC `admin_find_auth_user_by_email`) + timeout 60s no `edgeFunctionFetch` + remoção dos 3 inserts client-side. Deploy: edge fn `admin-create-user` v4 (CLI) + migration PROD + frontend push. deno/tsc 0, smoke 403. Commit `ce0a997`/merge `9449e5f`. Detalhe: [[project_member_create_hang_v7711]].

---
## 2026-06-03 (tarde V) — 🔔 Notificação de novo lead p/ vendedor ATIVADA na EletropisoV2 + teste OK

Dono pediu teste de notificação de novo lead pro atendente Thiago (+5587999031455) + auditoria. **Auditei os 8 guards da `notify-vendor-assignment`:** 7 OK (número, opt-in, não-pausado, fila ativa, horário, rate-limit 0/3, token); só o toggle `instance_settings.notifications_enabled` da EletropisoV2 estava OFF → estava **INATIVA**. Com OK do dono, **ativei** (`notifications_enabled=true` em `re662a6d32de7e0`). **Teste real:** lead de teste atribuído ao Thiago → edge fn passou os guards → `notification_log.status=sent` (msg "🔔 Novo atendimento, Thiago! … Cliente: Teste Notificação"). Lead de teste limpo; toggle mantido ON.

**Quem recebe agora:** a notif é POR ATRIBUIÇÃO INDIVIDUAL (vai só pro `assigned_to`, NÃO broadcast). Aptos (WhatsApp + opt-in) = **9/15**: Alberto, Djavan, Fernando, Flaviana, Jussara, Lucas, Nerivaldo, Rafaella, Thiago. 6 NÃO recebem por falta de `personal_whatsapp` (Alvaro, Dilma, Flávio, Josafá, Letícia, Televendas — opt-in ON, sem número). Guards por-vendedor seguem: opt-in, horário (08-18 seg-sex/08-12 sáb), rate-limit 3/h, pausa individual. Config-only (sem código/commit). Detalhe: [[project_vendor_notif_activated_eletropisov2]].

---
## 2026-06-03 (tarde IV) — ⚡ Otimização do fluxo de criar membro (v7.71.2)

Complemento da v7.71.1 (que destravou). Otimizei o fluxo: (1) os 3 vínculos pós-criação (instância/caixa/departamento) viram `Promise.all` (eram série); (2) `fetchUsers` ganha opção `silent` — refetch pós-criação sem flash de loading; (3) edge fn `admin-create-user` move `log_admin_action` pra `EdgeRuntime.waitUntil` (resposta volta antes, log completa em background; padrão do projeto). **E2E real (Playwright dev local):** criei membro com instância+caixa+departamento → 3 vínculos criados (DB confirma), role único 'user', sem travar; excluí. tsc/deno 0. Edge fn deployada (CLI); frontend pendente push→CI→Portainer. Detalhe: [[project_member_create_hang_v7711]].

---
## 2026-06-03 (tarde III) — 🐛 Cadastro de membro travando em "Criando..." (getAccessToken/getSession) — v7.71.1

Dono mandou print: "Novo Membro" preso em "Criando...". **Diagnóstico com dados:** logs de edge function NÃO mostravam `admin-create-user` (a req nunca saiu do navegador); `edgeFunctionFetch` faz `await getAccessToken()` antes do fetch; `getAccessToken` = `supabase.auth.getSession()` CRU sem timeout → trava em sessão zumbi (mesma família do v7.62.1 `fetch_messages_timeout`, que cobriu o Helpdesk mas deixou `getAccessToken` de fora). Afeta TODA edge fn via `edgeFunctionFetch`.

**Fix:** `resolveSession()` em `useAuthSession.ts` — `getSession()` com teto de 3s (`withTimeout`) + fallback no token persistido no localStorage (`readPersistedSession`); token expirado → trata como sem sessão. `getAccessToken` e `getSessionUserId` usam o helper. **E2E real (Playwright dev local):** criei membro de teste → criou em ~1-2s sem travar (confirmado em `auth.users`), excluí (cleanup SQL). tsc 0. Frontend-only. Detalhe: [[project_member_create_hang_v7711]].

---
## 2026-06-03 (tarde II) — 🟢 Importação em massa na base existente: lista/CSV/.vcf/grupos (v7.71.0)

Dono pediu: no "Gerenciar Base de Leads" (só tinha add manual 1-a-1), importar em massa por digitação de lista, CSV, .vcf e grupos. Explorei e descobri que 3 modos JÁ existiam como abas reutilizáveis do wizard (`PasteTab`/`CsvTab`/`GroupsTab`, devolvem `Lead[]` sem tocar o DB); só vCard não existia.

**Implementação (frontend-only, reaproveitamento máximo):** `ImportContactsDialog` (4 abas) com handler único que insere na base atual (phone=`jidToDigits` pra casar com os 454 em dígitos; dedup cliente+existingPhones + `ON CONFLICT DO NOTHING`; recontagem direta). Parser puro `src/lib/vcfParser.ts` (+11 testes vitest: multi-cartão, multi-TEL, N-fallback, item1.TEL, line folding, malformado) + aba `VcfTab` espelhando `CsvTab`. Grupos usa instância da base ou seletor. Botão no `ManageLeadDatabaseDialog`. `Lead.source` += `'vcf'`.

**Validação:** tsc 0, vitest 11/11. **E2E real (Playwright, dev local 8083, base de teste descartável):** Colar Lista 3→2 (dedup do número duplicado), vCard 3 válidos (Joao multi-telefone→2 entradas), count=5 e telefones em dígitos conferidos no DB; base de teste deletada, base real (454) intacta. **Bug pego em dev:** `recalc_lead_database_count` chamada do front = 403 (RPC service-only revogada de `authenticated` na v7.69.0) → trocado por recontagem direta via UPDATE (RLS permite). Pendente: commit+push+Portainer. Detalhe: [[project_bulk_import_v771]].

---
## 2026-06-03 (tarde) — 🟢 Auto-cadastro de leads na base do Disparador, por instância (v7.70.0)

Dono pediu (com print da tela "Bases" vazia): leads que falam numa instância devem entrar automaticamente numa base do Disparador, prontos pra receber ofertas (ex.: quem fala no EletropisoV2 → base "EletropisoV2"). **Auditei antes de codar e descobri que a feature JÁ EXISTIA** no `whatsapp-webhook` (bloco "Auto-add contact to instance lead database", desde o commit base) **mas nascera 100% quebrada**: `total_databases=0`/`entries=0` em PROD. **Causa-raiz provada no DB** (erro `42P10` reproduzido): o upsert de criação da base usa `ON CONFLICT (instance_id)`, mas o índice único de `instance_id` é PARCIAL (`WHERE instance_id IS NOT NULL`) — Postgres não infere índice parcial sem o predicado → exceção engolida pelo `catch` fire-and-forget. Bug 2º: RPC `update_lead_count_from_entries` nunca existiu (só `recalc_lead_database_count`).

**Decisões (AskUserQuestion):** toggle por instância (default OFF, ligo no EletropisoV2); sem backfill; nome da base = nome da instância.

**Fix de raiz:** RPC atômica `enroll_lead_in_instance_database` (SECURITY DEFINER: checa `instance_settings.auto_enroll_broadcast_db`, garante base com predicado correto, upsert do contato via UNIQUE `(database_id,phone)`, recalc; REVOKE PUBLIC/anon/authenticated, GRANT service_role). Webhook reduzido a 1 chamada à RPC. Toggle UI `InstanceBroadcastEnrollToggle` (espelha `InstanceNotificationToggle`) em `InboxesTab`. Tipos `instance_settings` atualizados em `integrations/supabase/types.ts`.

**Validação:** RPC via SQL (cria base "Eletropiso 558781592373"; idempotente; Sandbox OFF=no-op; phone curto ignorado); **E2E real ponta-a-ponta** (POST no webhook deployado pra Sandbox temporariamente ligada → base "Sandbox IA" + contato enrolado; depois revertido e dados de teste limpos); `deno check`/`tsc --noEmit` 0. Migration `20260603030000` + edge fn `whatsapp-webhook` em PROD (`prfcbfumyrrycsrcrvms`); frontend commitado/deployado (commit `fac09ab`, CI success, Portainer 204). **UI verificada no app real** (Playwright): toggle renderiza nas 3 caixas, read+write OK. **PROVA DE PRODUÇÃO REAL:** a base do EletropisoV2 nasceu às 09:43 por tráfego real (lead "Izabela Interaminense" mandou mensagem e foi cadastrada sozinha). **Backfill (a pedido do dono):** populada com os contatos que já conversaram — número real **454 únicos** (o "538" era inflado por query sem DISTINCT), todos individuais; via SQL com dedup → 454 entries, `leads_count=454`. Detalhe: [[project_auto_enroll_broadcast_v770]].

---
## 2026-06-03 (manhã) — 🟢 Módulo de gestão de bases do Disparador + hardening do envio (v7.69.0)

Dono pediu: módulo pra gerenciar bases do Disparador (editar contatos, organizar listas) + **auditoria completa do Disparador**. Auditoria em 3 frentes (Explore agents: frontend / dados / backend), achados verificados no código (descartei 2 falsos positivos: `groupjid: number` é parâmetro, não a função; e "não há DELETE de base" — existe). Escopo definido com o dono via AskUserQuestion.

**Parte A — Módulo de Bases** (`/dashboard/broadcast/databases`, sub-item "Bases"): página standalone `LeadDatabases.tsx` (CRUD de base + busca + contadores); `EditContactDialog` (editar contato individual — gap real); seleção em massa + `MoveContactsDialog` (mover/copiar entre bases) + remover em lote no `ManageLeadDatabaseDialog`; `MergeDatabasesDialog` (unir + dedup). RPCs `move_lead_entries`/`merge_lead_databases` (SECURITY DEFINER, dedup por phone, recalc count, ownership) + índice. Bug `useLeadsBroadcaster.ts:393` (`verification_status`→camelCase) corrigido.

**Parte B — Hardening do envio agendado:** claim atômico `claim_scheduled_messages` (FOR UPDATE SKIP LOCKED, fim do envio duplicado) + retry com backoff (`attempts`/`max_retries`) + crons (requeue stuck 15min, purge logs 90d) + trigger `enforce_scheduled_message_guards` (acesso à instância + rate-limit 500/h). `process-scheduled-messages` reescrito pra claimar via RPC.

**Validação:** RPCs/trigger via SQL (move/merge/dedup/ownership; claim retorna token; guard bloqueia cruzado); módulo via Playwright (criar/add/editar/seleção/move — editar travou 1x por sessão supabase-js zumbi, OK após reload); tsc/deno 0. **Achado de segurança no E2E:** `claim_scheduled_messages` executável por anon (EXECUTE→PUBLIC default) devolvia tokens → REVOKE PUBLIC/anon. Migrations+edge fn em PROD; frontend via push→CI. Detalhe: [[project_disparador_databases_module_v769]].

---
## 2026-06-03 (madrugada) — 🟢 Fotos de perfil das instâncias (Disparador + telas) — v7.68.0 SHIPPED PROD

Dono mandou print do **Disparador** (`/dashboard/broadcast`): avatares das instâncias quebrados/genéricos. **Causa-raiz** (confirmada no DB PROD): `instances.profile_pic_url` guardava a URL assinada do **CDN do WhatsApp** (`pps.whatsapp.net/...?oe=<expira>`), gravada uma única vez no sync — e o `oe=` já tinha **expirado** (Eletropiso ≈ abr, V2 ≈ mai; hoje jun). Sandbox IA estava `null`. Mesmo mal que contatos já tinham (resolvido via Storage).

**Fix de raiz (espelha o pipeline de avatar de contato):** migration 2 colunas em `instances` (`profile_pic_storage_path` + `profile_pic_synced_at`, reusa bucket `contact-avatars`) · `_shared/avatarStorage.ts` ganha `fetchInstanceProfilePicUrl` (GET `/instance/status` → `profilePicUrl` fresco, só token) + `syncInstanceAvatar` (download→upload `instance-<id>.jpg`→UPDATE) · edge fn `refresh-instance-avatar` (verify_jwt, throttle 5min) · componente `InstanceAvatar.tsx` (espelho do `ContactAvatar`: `isStaleSrc` + rehidrata on-mount/onError, fallback ícone Server) · wire em `InstanceSelector` (Disparador), `InstanceCard`, `InstanceDetails`, `BroadcasterHeader`.

**Descoberta:** `/contact/getProfilePic` (usado p/ contatos) dá **405** no servidor `wsmart.uazapi.com`; p/ a própria instância o canônico é **`GET /instance/status`** (campo `instance.profilePicUrl`). Doc local marcava `/profile/info` (404, inexistente).

**E2E real:** edge fn invocada p/ as 3 instâncias → `ok:true`, `profile_pic_url` agora aponta p/ `...supabase.co/storage/...` (HTTP 200 image/jpeg, inclusive Sandbox IA que era null). Playwright no dev local (8083): Disparador exibe as **3 fotos reais** (Eletropiso azul / V2 amarelo / Sandbox Tamandaré), 0 erro de console. `tsc` 0, `deno check` 0, 29/29 testes avatarStorage. Migration + edge fn já em PROD. **Pendência: push do frontend (CI→Portainer) — dados já corrigem o visual na prod atual.**

---
## 2026-06-02 (noite) — 🟢 Equipe: badge "WhatsApp de notificação" sempre visível (frontend)

Dono pediu "deixe exibindo quais atendentes têm whatsapp de notificação cadastrado" na tela Equipe (`/dashboard/admin/users` → `UsersTab.tsx`). Os dados (`personal_whatsapp`, `notify_on_assignment`, `notifications_paused_until`) já vinham no `select * from user_profiles`, mas só apareciam no painel EXPANDIDO (`UserNotificationPanel`). Faltava na linha de badges sempre-visível (que só tinha instâncias/caixas/departamentos).

**Fix:** 4º badge na linha colapsada, colorido por estado (reusa a lógica do `getSessionState`): **verde + número formatado** (ativo) · **âmbar** (cadastrado mas opt-out) · **laranja** (pausado) · **cinza "Sem WhatsApp"** (sem número). Tooltip mostra número + detalhe. `formatPhoneForDisplay` pro número (`+55 87 98115-1586`). +3 imports lucide (MessageCircle/BellOff/Pause). **Só UI, zero backend/schema.**

**Verificado:** dev server local + dados PROD → Playwright na tela Equipe: 9/17 membros com badge verde+número (Alberto, Djavan, Fernando, Flaviana, Jussara, Nerivaldo, Rafaella, Slone, Thiago), 8 com "Sem WhatsApp". `tsc -p tsconfig.app.json`: único erro em UsersTab é a linha 401 (`log_admin_action`, **pré-existente**, mesmo de InboxesTab/QueueConfig). **Deploy: via commit→CI→Portainer (frontend).**

---
## 2026-06-02 (noite) — 🟢 Chuveiros/resistências = SÓ ELÉTRICO (nada a gás) — config-fix PROD (sem deploy)

Print do dono (EletropisoV2 PROD, lead **Clodoaldo Filho** 558799885420, conv `dad91f2c`): lead pediu **resistência** de chuveiro (foto Lorenzetti 220V) e a IA perguntou **"Qual tipo? elétrico ou a gás."**. Regra de negócio (esclarecida pelo dono): **só trabalham com ELÉTRICOS** — chuveiros elétricos E resistências (elétricas). Nada a gás.

**Auditoria:** puxei a conversa do DB + tracei a origem. **Causa-raiz = CONFIG, não código.** `ai_agents.service_categories.categories[chuveiros].stages[0].fields[0]` tinha `tipo_chuveiro.examples = "elétrico ou a gás"` literal — o phrasing renderizava a frase. Idêntico nos **3 agentes** (Eletropiso/V2/Sandbox). **Zero** ocorrência de "a gás" em template/seed/default do código (grep src+functions) → foi config manual. A resistência NÃO era produto excluído (o vendedor humano cotou R$56,90 no mesmo chat — estava certo).

**Fix 1 (IA nunca OFERECE gás):** `tipo_chuveiro.examples` → **"resistência ou chuveiro completo"** nos 3 agentes (SQL `replace` cirúrgico — não tocou `registros."água ou gás"`). Pergunta vira "Qual tipo? resistência ou chuveiro completo." (os dois elétricos). Como a foto já trouxe 220V (auto-extract), qualifica e transborda.

**Fix 2 (IA RECUSA se o LEAD pedir gás):** `excluded_products += chuveiro_aquecedor_gas` (keywords: chuveiro/ducha/aquecedor a gás, aquecedor de água a gás, a glp, a gás natural; msg "Trabalhamos só com chuveiros e resistências elétricos 😊…"). Pré-LLM, sem handoff, sem contar msg.

**Config-only, SEM deploy** (ai-agent lê service_categories+excluded_products ao vivo). **Paridade UI provada via Playwright no painel PROD**: Qualificacao → Chuveiros → campo "tipo" = "resistência ou chuveiro completo" + preview sem gás; Produtos que NÃO vendemos → entrada `chuveiro_aquecedor_gas` (busca "gás"). Detalhe: [[project_chuveiros_gas_electric_fix]].

**Fix 3 (registros = só água):** dono confirmou "registro só de água" → campo de registros `aplicacao_registro` (label "aplicação" / examples "água ou gás") → **"tipo" / "gaveta ou pressão"** nos 3 agentes. Verificado: `service_categories` sem NENHUM "gás" nos 3 agentes (keyword de gás fica só em `excluded_products`, proposital).

---
## 2026-06-02 (tarde) — 🟢 Auditoria de paridade Agente IA ↔ Painel Admin (v7.67.0) — SHIPPED PROD

Dono pediu "audite paridade agente ia com painel admin ui". Cruzei as 4 fontes de verdade da SYNC RULE: schema real de `ai_agents` (70 colunas via SQL no projeto novo), `ALLOWED_FIELDS` (66 campos, `AIAgentTab.tsx`), reads do backend (`ai-agent` + `_shared/agent/*`, via 2 exploradores) e os controles de UI (`RulesConfig`/`AbandonHandoffConfig`/…). Confirmei cada achado na fonte (query `IN`, greps, leitura dos componentes).

**3 gaps reais (aprovados pelo dono via AskUserQuestion → implementados):**
- **#1 `max_lead_messages` (bug latente):** no `ALLOWED_FIELDS` + input editável + lido pelo backend, **mas sem coluna** → editar quebrava o auto-save inteiro (`.update()` em coluna inexistente) e o backend sempre usava default. Fix: migration cria coluna **nullable sem default** (default 8 reintroduziria o bug qualify-first do `so_se_pedir`→40, comentado no index.ts).
- **#2 `handoff_negative_sentiment` (toggle morto):** switch salvava mas backend nunca lia → religado como handoff por sentimento negativo PERSISTENTE (≥2 sinais).
- **#3 `handoff_max_conversation_minutes` (toggle morto):** input salvava mas backend nunca lia → religado como cap de duração da conversa.

**Risco de prod pego na investigação:** os 2 flags já tinham default ligado (15/true) em TODOS os agentes — religar a leitura sem reset transbordaria todo mundo de uma vez. Decisão do dono: **default OFF + reset dos rows + ligar só EletropisoV2** (igual v7.65/66).

**Implementação (zero gambiarra):** helper puro testável `_shared/agent/handoffCaps.ts` (`shouldHandoffByConversationMinutes` + `shouldHandoffByNegativeSentiment` + `hasNegativeWord`, 19 testes) + wire de 2 caps pré-LLM no `index.ts` reusando as primitivas do cap de interações (closure `runAbsoluteCapHandoff`) + UI alinhada (`RulesConfig` `?? false`/`?? 0` + descrições) + migration `20260602120000` (coluna #1 + zera defaults + reset). **deno 0 · tsc 0 · vitest 19 novos + 617 totais (2 suítes https pré-existentes).**

**Menores anotados (backlog):** `specialist_model`/`business_name` lidos mas sem coluna; `tts_fallback_providers` sem UI; `sub_agents`/`out_of_hours_message` órfãos.

**SHIPPED (sequência completa):** commit `a5dc710` + docs `ab94d1c` → **merge `16fe9bd` → master + push** (hook do vault passou) · **migration aplicada e verificada em PROD** (coluna `max_lead_messages` integer/null + defaults 0/false) · **`ai-agent` deployado v259** (verify_jwt false; o 403 inicial era o CLI logado na conta antiga — resolvido usando o PAT eletropiso de [[reference_supabase_token_novo]] no binário scoop) · **EletropisoV2 ligado** (`handoff_negative_sentiment=true`, minutos `0`/OFF — decisão do dono; outros 2 agentes OFF) · `erros-e-licoes.md` particionado (295→62, novo [[wiki/erros/historico-2026-05-part4]]). UI do `RulesConfig` (default OFF) sobe no próximo build do front. Detalhe: [[project_audit_parity_handoff_caps_v767]].

---
## 2026-06-02 — 🟢 Fora-horário: IA continua atendendo + acumula pedido até o fim (v7.66.0) — SHIPPED PROD

Print do dono (George/EletropisoV2 PROD, fora-horário): após qualificar canos (esgoto+Tigre) a IA **transbordou por-produto** e, no "Tem trena?", repetiu a mensagem canned de fora-horário em vez de atender. Trace confirmou: o no-result loop offline transborda ao bater `max_enrichment_questions` (cego ao horário) → shadow → cron requeue reenviou a OOF. Pedido: fora-horário, **continuar atendendo e acumular o pedido**, transbordar só no fim.

**Processo (workflow keyword + ultracode):** (1) workflow de AUDITORIA (5 agentes) mapeou as causas-raiz + plano; (2) AskUserQuestion travou escopo (só fora-horário) + UX (perguntar a cada item); (3) implementação; (4) workflow de REVISÃO ADVERSARIAL (4 agentes) pegou 1 blocker + 2 majors → corrigidos; (5) E2E real.

**Fix de raiz (flag `continue_outside_hours_until_done`, default OFF):** no `ai-agent/index.ts`, sob flag ON + fora-horário, o no-result loop offline **NÃO transborda** ao bater o cap — registra o item no `cart_items`, **reseta o estado por-item via PRESERVE-LIST** (limpa atributos de qualquer categoria + lead_score; só durables ficam), seta `offline_order:1`+`offline_await_more:1`, pergunta "Quer mais alguma coisa ou é só isso?". Closer (via `offline_order` durável) → `pendingSaleClosedHandoff='offline_order_done'` → executor cart-aware (OOF + shadow + nota itemizada). Novo produto → limpa só `offline_await_more`, segue atendendo. specificItem ("o da foto") transborda na hora. cap-15 ganhou nota itemizada (paridade). NÃO toca o fluxo de tintas.

**Achados da revisão adversarial (todos corrigidos):** blocker = PER_ITEM_PREFIXES era denylist incompleto → vazava ambiente/formato/quantidade/lead_score pro 2º produto (→ preserve-list); major1 = encadeamento catalogado+não-categorizado+closer não finalizava (→ `offline_order` durável); major2 = cap-15 sem resumo do cart (→ nota itemizada). Nits: regex closer ancorado (sem "fechar"/"pode passar" nus, +"é isso", guard de "?") + dedup do cart.

**E2E real sandbox nota 10:** "Tigre" → cart["canos esgoto Tigre"]+ligada+"quer mais?"; preserve-list limpou ambiente/formato/lead_score; "Tem trena?" → atendido (ferramentas)+offline_order mantido; "é só isso" → shadow+OOF+nota com 2 itens. deno 0, tsc 0, vitest 54. **EletropisoV2 LIGADO.** Detalhe: [[project_continue_outside_hours_v766]].

---

## Entries arquivadas

Entries de 2026-05-29 a 2026-06-01 (v7.57.4–v7.65.1) → [[wiki/log-arquivo-2026-05-29-a-06-01]].
Entries de 2026-05-28 (v7.57.0–v7.57.3) → [[wiki/log-arquivo-2026-05-28-part2]].
Entries de 2026-05-26 e anteriores → [[wiki/log-arquivo-2026-05-28-part1]].
Para arquivos mais antigos, ver `wiki/log-arquivo-*`.
