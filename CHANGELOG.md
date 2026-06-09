---
title: Changelog
type: changelog
updated: 2026-06-05
audited_at: 2026-06-05
---

# Changelog

> Releases ativas (últimos ~14 dias). Histórico completo em [[wiki/changelog/]].
>
> **Convenção:** semver. Toda feature/fix shipado vira entrada aqui (REGRA 17 do CLAUDE.md). Após release recente envelhecer >14 dias, mover pra `wiki/changelog/<ano-mes>.md`.

---

### v7.75.0 (2026-06-09) — 🟢 Helpdesk: foto de iPhone/Android (HEIC) finalmente envia — conversão p/ JPEG + UX de erro

**Reclamação do dono:** atendentes não conseguem enviar FOTO ao cliente; suspeita em "arquivos grandes".

**Diagnóstico (auditoria multi-agente + teste empírico ao vivo no proxy DEPLOYADO, instância Sandbox):** "arquivos grandes" é **falso culpado** — JPEG/PNG/WEBP de até **17,6MB** enviam e são entregues (200+messageid, ~5s, sem timeout; o limite de 10MB da doc UAZAPI NÃO é imposto via URL). A causa real é **FORMATO**: esta instância UAZAPI transcodifica toda imagem p/ JPEG e **não decodifica HEIC/HEIF** (padrão de foto do iPhone e do Android em "alta eficiência"/HEIF) → HTTP 500 `unsupported image format` (mesmo erro do base64 da v7.71.4). Pós-v7.71.4 esse 500 virou toast → atendente vê falhar.

**Fix de raiz (frontend, helper único compartilhado):**
- `normalizeOutboundImage.ts` (novo): detecta formato por **magic bytes** (não confia em `file.type`, vazio no mobile); JPEG/PNG/WEBP/GIF passam direto; **HEIC/HEIF → JPEG** via `heic2any` (import dinâmico, chunk lazy — wasm só baixa quando há HEIC); desconhecido decodificável → canvas→JPEG; senão erro amigável. Também conserta o caso "foto vira documento" quando `file.type` vem vazio.
- `useSendFile` + `uploadOutboundMedia` chamam a normalização (Helpdesk, Grupo, Lead). `ChatInput` `accept="image/*,.heic,.heif"`.
- **UX de erro** (`sendErrors.ts` `humanizeSendError`): traduz o erro cru ("unsupported image format", "timed out after 30000ms") em PT acionável; rótulo imagem/documento correto. **Bolha de "Falha ao enviar" persistente** no `ChatPanel` (vermelha, com "Tentar de novo"/"Dispensar") — fim do toast efêmero.
- **Disparador/Carrossel base64→URL** (mesma raiz): `BroadcastMessageForm`, `sendCarouselToNumber` (carrossel/lead) e imagem da enquete agora sobem ao Storage e mandam **URL** (não base64).
- **Edge `uazapi-proxy`**: `send-media` timeout **30s→60s** + erro de timeout em PT (504).

**Verificação:** E2E real no navegador (Chromium) — `sample.heic` 718KB → módulo do app + heic2any → **JPEG válido** (`FF D8 FF`, 465KB). 23 unit tests novos. tsc 0 · deno check 0 · ESLint 0 (arquivos novos) · suíte 1696✓ (19 fails pré-existentes, 0 regressão). Dep nova: `heic2any` (lazy). Detalhe: memória `project_heic_photo_send_v775`.

---

### v7.74.3 (2026-06-05) — 🟢 Fila: atendente pelo celular vira "{Nome} (responsável)" (revisa o gate honesto da v7.73.2)

No modal "Conversa com…" da Fila, mensagens que o vendedor responde **pelo celular** (takeover, sem `sender_id`) agora exibem **"{Nome} (responsável)"** — o atendente atribuído à conversa, nome curto sem o sufixo " - Eletropiso" — no lugar do genérico **"Atendente"**. Pedido do dono (print do Djavan: msg 16h08 pelo celular saindo "Atendente"). **Revisa deliberadamente o gate `assigned_at <= created_at` da v7.73.2:** a linha do celular é COMPARTILHADA (16 operadores na EletropisoV2) e o sistema não registra quem digitou, então **"(responsável)" é atribuição de DONO da conversa (`assigned_to`), NÃO de autoria da bolha** — o sufixo é o que mantém honesto ([[feedback_never_false_data]]); mensagens do **app** (com `sender_id`) seguem mostrando o **autor EXATO** sem sufixo (e nunca caem no nome do responsável — bug latente pego na revisão adversarial). Dono escolheu (AskUserQuestion) ciente do trade-off (vira o assignee atual; reatribuir renomeia bolhas antigas). Lógica pura extraída p/ `conversationLabel.ts` + **14 testes** fixam a decisão (caso Djavan, fallback do app, reatribuição). `tsc` 0, ESLint 0, trace determinístico nos dados reais = "Djavan (responsável)". Frontend-only (`ConversationModal.tsx` + `conversationLabel.ts`); entrega: push → CI → Portainer webhook. Detalhe: [[project_fila_message_sender_names_v773]].

---

### v7.74.2 (2026-06-05) — 🔎 Contexto IA (Helpdesk): especificações do pedido em destaque + chips sem ruído

No painel "Contexto IA" (`ContactInfoPanel.tsx`) a cor/tipo do pedido ficavam invisíveis: a IA **capturava** certo (`cor_vaso:gelo`, `tipo_vaso:acoplado` nos tags **e** na nota do vendedor), mas o painel só destacava a categoria ("vasos sanitarios") e jogava a cor num chip cinza enterrado entre ~18 chips internos (`lead_score`, `enriching`, `flow_mode`, `seller_notified`…). Agora: campo **"Especificações do pedido"** lê `cor_vaso`/`tipo_vaso`/`acabamento`/`marca_preferida` e mostra **"Tipo: Acoplado · Cor: Gelo"** em destaque; chips de ruído interno escondidos (só atributos úteis ao atendente). Pedido do dono (caso JJgomes/Jurandir). Frontend-only, `tsc` 0, E2E real.

---

### v7.74.1 (2026-06-05) — 🛡️ Disparador: rede de segurança do auto-cadastro (cobertura garantida)

Auditoria do dono confirmou que os leads do Helpdesk entram **100%** na base de disparo (496/496 messagers do EletropisoV2 na base; 500/500 `source=helpdesk`; 46/46 novos pós-deploy; 20/20 das últimas 24h). Mas o enroll real-time (`whatsapp-webhook` fire-and-forget) é **sem retry** → lag p90 ~32min sob rajada e risco de lead de mensagem única escapar; o path de segurança antigo (`process-jobs` `lead_auto_add`) está morto (`job_queue` vazia) e quebrado. **Fix:** migration `20260605140000_reconcile_broadcast_enrollments.sql` — RPC `reconcile_broadcast_enrollments` (idempotente, SECURITY DEFINER, REVOKE PUBLIC) + **pg_cron `*/2` (jobid 41)** varre e cadastra quem escapou (sweep testado=0, cron `succeeded` 172ms). Número antigo NÃO ligado (só tráfego interno/teste). Detalhe: [[project_auto_enroll_broadcast_v770]].

---

### v7.74.0 (2026-06-05) — 🔎 Fila: busca por nome ou número do lead (parcial)

Na lista "Sem atend." do dashboard da Fila (`/dashboard/fila`), novo campo **"Buscar por nome ou número (ex.: Tiago, 6099)…"** filtra os leads carregados por **nome** OU por **trecho do número** do WhatsApp (dígitos normalizados — "6099" casa qualquer telefone que contenha 6099) e lista os matches na hora (client-side, sem rede). Compõe com os filtros de janela/ordenação/atendente já existentes; empty-state dedicado ("Nenhum lead encontrado para …"). Pedido do dono junto do print do Tiago Feitosa. `UnattendedLeadsTab.tsx`, frontend-only, `tsc` 0, E2E real no app. Detalhe: [[project_fila_message_sender_names_v773]].

---

### v7.73.2 (2026-06-05) — 🟢 Fila: atendente pelo celular só recebe nome se já era o responsável no horário (senão "Atendente")

Fecha 2 problemas levantados pelo print do dono (msg *"Não tenho esse revestimento da ceral."*, contato Márcia Patriota, aparecendo como **"IA"**). **(1) Defeito operacional — causa-raiz:** a PROD estava rodando bundle **pré-v7.73.0**. A v7.73.0/.1 foi buildada (GHCR `:latest`, CI verde) mas o **redeploy do Portainer nunca foi disparado** (`deploy.yml` só builda a imagem; o redeploy no servidor é um webhook manual). Por isso o modal usava a lógica antiga (todo outgoing sem `sender_id` = "IA"), mesmo a msg sendo de takeover pelo celular (`external_id` hex `3EB0E808…`, sem `sender_id`, conversa `shadow`). **Provado** varrendo os 132 chunks JS do site live (`agentPhone`/`queue_oof_`/"Nota interna" ausentes; "Abrir no Helpdesk" presente = modal antigo). Este release dispara o redeploy. **(2) Atribuição honesta:** takeover pelo celular não registra QUEM digitou — a v7.73.1 atribuía ao responsável **atual**, errado em **2398/3128 (~77%)** das msgs (conversa atribuída/reatribuída depois do envio). Agora o nome do atendente só aparece se `assigned_at <= created_at` (já era o responsável no momento do envio); senão **"Atendente"** (não inventa nome). No caso Márcia: Alvaro só foi atribuído às 17:50, msg às 12:56 → **"Atendente"**. `tsc` 0. Frontend-only (`ConversationModal.tsx`; push → CI → Portainer webhook). Detalhe: [[project_fila_message_sender_names_v773]].

---

### v7.73.1 (2026-06-04) — 🟢 Fila: msg do atendente pelo celular mostra o NOME (atendente atribuído)

Refino da v7.73.0 (pedido do dono, print): mensagens que o vendedor responde **pelo celular** (takeover — sem `sender_id`) agora exibem o **nome do atendente atribuído à conversa** (`conversations.assigned_to` → `user_profiles.full_name`) em vez do genérico "Atendente". Caso real validado: *"BOA TARDE, essas luminárias de jardim, eu irei verificar as cores…"* (contato ".", assignee Thiago) saía como **"IA"** (versão antiga) → agora **"Thiago · 02/06, 14:44"**. O modal passa a buscar o `assigned_to` da conversa e incluí-lo no `useUserProfiles`. App-sent segue por `sender_id` (exato); sem assignee, fallback "Atendente". **E2E real no app** (Playwright): rótulo confirmado "Thiago". `tsc` 0. Frontend-only (`ConversationModal.tsx`; push → CI). Detalhe: [[project_fila_message_sender_names_v773]].

---

### v7.73.0 (2026-06-04) — 🟢 Fila: cada mensagem mostra QUEM enviou (lead / atendente / IA)

No modal "Conversa com …" da Fila (`/dashboard/fila`, e também no detalhe do Lead), cada mensagem agora identifica **quem enviou**: nome do **lead** (recebidas), nome **real do atendente** (enviadas pelo app, resolvido via `useUserProfiles` — mesmo padrão do Helpdesk), **"Atendente"** quando o vendedor respondeu pelo **celular** (takeover) e **"IA"** quando foi o agente. Antes era genérico ("Lead"/"Atendente"/"IA") e — bug latente — mensagens humanas digitadas no celular apareciam como **"IA"**.

A distinção IA × atendente-no-celular usa o `external_id`: a IA/automação sempre grava prefixo (`ai_agent_`, `ai_*`, `follow_up_`, `abandon_`, `auto_`, `nps_`, `queue_oof_`) ou NULL; o atendente pelo celular chega via webhook com `external_id` cru do WhatsApp (hex) e sem `sender_id`. **Verificado no DB PROD** (3128 linhas hex outgoing, 0 echoes de IA) e **E2E no app real** (Playwright) nos 5 casos. `tsc` 0. Frontend-only (`ConversationModal.tsx`; push → CI). Detalhe: [[project_fila_message_sender_names_v773]].

---

### v7.72.0 (2026-06-03) — 🔔 Reatribuição do gestor notifica o novo atendente no WhatsApp

No dashboard da Fila (`/dashboard/fila` → "Sem atend." → **Reatribuir**), reatribuir uma conversa agora **notifica o novo atendente** no WhatsApp pessoal dele (e avisa o **anterior** que saiu). Reusa a `notify-vendor-assignment` da fila automática — mesmos **8 guards** (opt-in, horário comercial, rate-limit 3/h, número cadastrado, etc.). Wire em `useReassignConversation` (fire-and-forget pós-RPC; falha na notif NÃO quebra a reatribuição) + `UnattendedLeadsTab` passa o atendente anterior. `tsc` 0; invocação da fn pelo frontend (como Gerente) confirmada (200, sem spam). Frontend-only (push → CI).

**v7.72.1 (2026-06-04) — bypass de guards de disponibilidade na reatribuição manual.** A reatribuição manual do gestor agora passa `force_manual` → a `notify-vendor-assignment` **bypassa `queue_paused` e `off_hours`** (mantém opt-out/DND/sem-número/rate-limit). Sem isso a notif era pulada quando o atendente escolhido estava **"Pausado"** na fila (achado real: Letícia). **E2E real (Playwright dev→PROD):** reatribuir Carmem Lucia → Letícia (pausada) → `notification_log` **status=sent** + WhatsApp entregue (`🔔 Novo atendimento, Letícia!`). Edge fn `notify-vendor-assignment` redeployada (CLI).

---

### v7.71.5 (2026-06-03) — 🐛 Grupo + Lead: envio de mídia também base64 → URL (mesmo root cause do Helpdesk)

Estende o fix da v7.71.4 aos 2 pontos que ainda mandavam imagem como **base64** (rejeitada pelo UAZAPI): **Enviar ao Grupo** (`SendMediaForm`) e **Enviar pra Lead** (`LeadMessageForm`). Helper novo `uploadOutboundMedia(file)` sobe o arquivo pro bucket público `helpdesk-media` e devolve a **URL pública** (contentType/ext robustos); o UAZAPI baixa do CDN. No lead, a URL agora também **espelha no Helpdesk/log** (antes ficava vazio em upload de arquivo). **E2E real:** upload ao Storage (como Michelly) → URL pública → proxy deployado → **200 + foto entregue** ao número controlado → objeto de teste limpo. `tsc` 0, frontend-only (push → CI).

**Ainda no backlog (mesmo padrão de base64):** Disparador em massa (`BroadcastMessageForm`/`useBroadcastSend`) e carrossel (`sendCarouselToNumber(..., fileToBase64)`) em upload de arquivo.

---

### v7.71.4 (2026-06-03) — 🔴 Helpdesk: envio de FOTO ao cliente voltou a funcionar (base64 → URL)

**Crítico.** Vendedores/atendentes não conseguiam enviar fotos aos clientes. Auditoria multi-agente com **teste ao vivo** provou a causa-raiz: o Helpdesk mandava a imagem como **base64-cru** no `/send/media` da UAZAPI, que **rejeita** (`HTTP 500 "unsupported image format"`); a **URL pública do Storage** — que o frontend já tinha em mãos e **descartava** — é **aceita e entregue** (mesmo `file: <URL>` que o AI Agent usa em PROD). A falha era invisível porque o frontend **ignorava a resposta** do UAZAPI. Dado de PROD: último envio de foto por vendedor foi **2026-05-28** (vendedores tentaram, falhou, desistiram).

- **`useSendFile.ts`:** envia `filePublicUrl` (URL do Storage) em vez de base64; contentType/extensão robustos (fallback `image/jpeg` quando o mobile manda `file.type` vazio → evita `octet-stream`); **valida a resposta** (só marca "enviada" com `messageid`/`id`; senão lança erro real e **NÃO insere msg-fantasma no DB**).
- **`uazapi-proxy` (case `send-media`):** fim do passthrough cego — UAZAPI 200-com-corpo-de-erro vira **502** (o chamador lança de fato); **guard de tamanho** 16MB no base64 (paridade com `send-audio`).

**Verificação E2E real** (logado como Michelly, via proxy deployado, número controlado `5581993856099`): URL → **200 + foto entregue**; base64 → **500** (erro agora aparece). **Não é regressão** (cadeia congelada desde 2026-03-23) **nem storage** (bucket `helpdesk-media` público).

**Deploy:** edge fn `uazapi-proxy` (CLI scoop) + frontend via push. `tsc` 0, `deno check` 0.

**Achados correlatos (mesmo root cause — backlog, fora do escopo do Helpdesk):** `SendMediaForm.tsx` (Enviar ao Grupo) converte arquivo em base64 (`fileToBase64`) → mesmo bug ao subir foto a grupo; `MessageBubble` não reflete falha de entrega na UI; `accept` do anexo não inclui HEIC (iPhone).

---

### v7.71.3 (2026-06-03) — 🐛 Cadastro de membro: criação atômica server-side (fim do "Criando..." eterno + órfão)

Fecha a **2ª causa-raiz** do travamento em "Criando..." (caso real: cadastro da Michelly). A v7.71.1 cobriu o `getSession` zumbi, mas o fluxo ainda fazia **4 chamadas de rede**: 1 edge fn (auth+papel) + **3 inserts no cliente** (instância/caixa/departamento via `Promise.all`). Numa oscilação de rede (`ERR_NAME_NOT_RESOLVED`/DNS), o `Promise.all` pendurava pra sempre **e** deixava o membro **órfão** (auth+papel criados, sem vínculos).

- **Criação atômica server-side:** `admin-create-user` agora recebe `instance_id`/`inbox_id`/`department_ids` e faz os 3 vínculos **idempotentes** numa única requisição. Se a rede cair depois que a fn terminou, está tudo criado (um refresh mostra o membro inteiro) — sem órfão, sem "e-mail já existe" no retry.
- **Recuperação self-healing:** se o e-mail já existir de um cadastro interrompido, a fn recupera o usuário e completa os vínculos que faltam (em vez de falhar). Nova RPC `admin_find_auth_user_by_email` (SECURITY DEFINER, grant só `service_role`).
- **Timeout no `edgeFunctionFetch`:** `AbortController` de 60s → nenhuma chamada a edge function pendura infinitamente (backstop contra qualquer hang de rede).
- **Frontend:** `UsersTab.tsx` passa os vínculos pra edge fn e **removeu os 3 inserts client-side**.
- **Caso Michelly:** estava meio-criada (auth+papel sem vínculos) → completei os 3 vínculos direto no DB; loga como Gerente (`michelly@eletropiso.com.br`).

**Deploy:** edge fn `admin-create-user` v4 (CLI scoop, PAT eletropiso) + migration aplicada em PROD + frontend via push. `deno check` 0, `tsc` 0, smoke test runtime 403 OK (boot limpo).

---

### v7.71.2 (2026-06-03) — ⚡ Fluxo de criar membro mais rápido (paralelização + refetch silencioso)

Complemento da v7.71.1. Otimizações no fluxo de "Novo Membro" (`/dashboard/admin/users`):
- **Vínculos em paralelo:** os 3 vínculos pós-criação (`user_instance_access` / `inbox_users` / `department_members`) eram em SÉRIE (3 round-trips) → agora `Promise.all` (1 round-trip).
- **Refetch silencioso:** após criar, `fetchUsers({ silent: true })` atualiza a lista sem piscar o estado de "carregando" (antes recarregava 8 queries com flash visível).
- **Edge fn `admin-create-user`:** o log de auditoria (`log_admin_action`) saiu do caminho crítico via `EdgeRuntime.waitUntil` (resposta volta antes; log completa em background sem perda — padrão já usado em `ai-agent-debounce`/`whatsapp-webhook`).

**E2E real (Playwright, dev local):** criar membro COM instância+caixa+departamento → os 3 vínculos criados (confirmado no DB), role único correto, sem travar; usuário de teste excluído. `tsc`/`deno check` 0. Edge fn deployada (CLI); frontend via push→CI.

---

### v7.71.1 (2026-06-03) — 🐛 Cadastro de membro (e toda edge function) travando em "Criando..."

Dono reportou: criar novo membro (`/dashboard/admin/users`) ficava preso em "Criando...". **Causa-raiz** (logs + código): `getAccessToken` (`src/hooks/useAuthSession.ts`) fazia `await supabase.auth.getSession()` **cru, sem timeout** — e o `getSession()` do supabase-js **trava** em sessão zumbi (token perto de expirar + aba antiga; mesma família do `fetch_messages_timeout`/v7.62.1). Como `edgeFunctionFetch` chama `getAccessToken()` **antes** do fetch, a requisição nunca saía do navegador — nos logs, `admin-create-user` **não aparecia nenhuma vez**. Afetava **toda** edge function chamada via `edgeFunctionFetch`.

**Fix:** `getAccessToken`/`getSessionUserId` resolvem a sessão de forma resiliente (`resolveSession`): `getSession()` corre contra um teto de 3s e, se travar/expirar, cai no token **já persistido no localStorage** (válido enquanto não expirou); token expirado → "Sessão expirada" em vez de travar para sempre. **E2E real (Playwright, dev local):** criar membro voltou a funcionar (~1-2s, sem travar; confirmado em `auth.users`, usuário de teste excluído). `tsc` 0. Frontend-only — via push→CI.

---

### v7.71.0 (2026-06-03) — 🟢 Importação em massa de contatos na base existente (lista / CSV / .vcf / grupos)

No "Gerenciar Base de Leads" (que só tinha "Adicionar contato manualmente", 1 por vez) agora dá pra importar em massa por 4 modos. **Descoberta:** 3 já existiam como abas reutilizáveis do wizard de envio (`PasteTab`/`CsvTab`/`GroupsTab` — devolvem `Lead[]` sem tocar o DB); só faltava o vCard.

- **`ImportContactsDialog`** (novo) — Dialog com 4 abas (Colar Lista · CSV · vCard · Grupos) cujo callback **insere direto na base atual**: telefone normalizado pra dígitos (via `jidToDigits`, casa com os existentes), dedup contra os atuais + `ON CONFLICT (database_id, phone) DO NOTHING`, recontagem direta.
- **Parser de vCard** `src/lib/vcfParser.ts` (novo, função pura + 11 testes) — lê arquivos `.vcf` com vários cartões e vários telefones por cartão (`FN`/`N` + todas as `TEL`, line folding RFC 6350). Aba `VcfTab` espelha o `CsvTab`.
- Grupos: usa a instância vinculada à base; se a base não tem instância, oferece um seletor.
- Botão "Importar lista, CSV, .vcf ou grupos" no `ManageLeadDatabaseDialog`. `Lead.source` += `'vcf'`.

**Validação:** `tsc` 0, `vitest` 11/11 (parser); **E2E real no app** (dev local, base de teste descartável): Colar Lista (dedup do duplicado OK), vCard (multi-telefone → 2 entradas), count e telefone-em-dígitos conferidos no DB, base de teste removida, base real (454) intacta. **Bug pego em dev:** chamar `recalc_lead_database_count` do frontend dava 403 (RPC service-only, REVOKE de `authenticated` na v7.69.0) → trocado por recontagem direta (UPDATE permitido por RLS). Frontend-only — sem backend/migration; via push→CI.

---

### v7.70.0 (2026-06-03) — 🟢 Auto-cadastro de leads na base do Disparador (por instância)

Dono pediu: todo lead que mandar mensagem numa instância deve entrar automaticamente numa base do Disparador, pronta pra receber ofertas (ex.: quem fala no EletropisoV2 → base "EletropisoV2"). **Descoberta na auditoria:** a feature já existia no `whatsapp-webhook` (bloco "Auto-add contact to instance lead database") mas estava **deployada e 100% quebrada** (`total_databases=0` em PROD). **Causa-raiz provada no DB** (erro `42P10` reproduzido): o upsert de criação da base usava `ON CONFLICT (instance_id)`, mas o índice único de `instance_id` é **parcial** (`WHERE instance_id IS NOT NULL`) — Postgres não infere índice parcial sem predicado → exceção engolida pelo `catch` fire-and-forget. Bug 2º: a RPC `update_lead_count_from_entries` nunca existiu.

**Fix de raiz (zero gambiarra):**
- **RPC atômica** `enroll_lead_in_instance_database` (SECURITY DEFINER): checa o toggle, garante a base com o predicado correto (`ON CONFLICT (instance_id) WHERE instance_id IS NOT NULL`), faz upsert do contato (UNIQUE `(database_id, phone)`) e recalcula via `recalc_lead_database_count`. REVOKE de PUBLIC/anon/authenticated; só `service_role` (lição v7.69.0).
- **Webhook** passa a fazer **1 chamada** à RPC (substitui os 2 upserts frágeis + a RPC inexistente).
- **Toggle por instância** `instance_settings.auto_enroll_broadcast_db` (default OFF) + UI `InstanceBroadcastEnrollToggle` em `InboxesTab` (ao lado do toggle de notificações). Ligado só no **EletropisoV2**.
- Nome da base = **nome da instância** (renomeável na tela de Bases). Sem backfill (só novas mensagens).

**Validação:** RPC via SQL (cria / idempotente / OFF=no-op / valida phone); **E2E real** (POST no webhook deployado pra Sandbox temporariamente ligada → base criada + contato enrolado, depois revertido e limpo); `deno check`/`tsc --noEmit` 0. Migration `20260603030000` + edge fn `whatsapp-webhook` em PROD; frontend via push→CI. **Nota:** captação automática em base de marketing é opt-in por instância (LGPD); envio segue manual pelo wizard.

---

### v7.69.0 (2026-06-03) — 🟢 Módulo de gestão de bases do Disparador + hardening do envio agendado

Auditoria completa do Disparador (3 frentes) → módulo dedicado de bases + correção dos riscos do envio agendado.

**Parte A — Módulo de Bases (`/dashboard/broadcast/databases`, sub-item "Bases"):**
- Página `LeadDatabases.tsx` standalone (listar/criar/renomear/excluir bases + busca + contadores) — antes só dava pra gerenciar bases dentro do wizard de envio.
- **Editar contato individual** (`EditContactDialog`, gap da auditoria — antes só add/remove).
- **Seleção em massa + mover/copiar entre bases** (`MoveContactsDialog`) e **remover em lote** no `ManageLeadDatabaseDialog`.
- **Unir bases com dedup** (`MergeDatabasesDialog`).
- RPCs atômicas `move_lead_entries` / `merge_lead_databases` (SECURITY DEFINER, dedup por phone, recalc de `leads_count`, ownership via `auth.uid()`) + índice `idx_lead_entries_db_phone`.
- Fix do bug `useLeadsBroadcaster.ts:393` (`verification_status`→`verificationStatus`; aviso de "não verificado" sempre disparava).

**Parte B — Hardening do envio agendado (`scheduled_messages`):**
- **Claim atômico** `claim_scheduled_messages` (FOR UPDATE SKIP LOCKED — fim do envio duplicado por crons concorrentes); `process-scheduled-messages` passa a claimar via RPC.
- **Retry** com backoff exponencial (colunas `attempts`/`max_retries`).
- **Crons** `requeue-stuck-scheduled-messages` (5min, processing>15min→pending) e `purge-scheduled-message-logs` (90d retention).
- **Trigger** `enforce_scheduled_message_guards` (valida acesso à instância via `user_instance_access` + rate-limit 500/h) — fecha gap da RLS.

**Validação:** RPCs e trigger testados via SQL (move/merge/dedup/ownership; claim retorna token; guard bloqueia acesso cruzado); módulo via Playwright (criar base, add, editar, seleção+barra, move dialog); `tsc`/`deno check` 0. **Achado de segurança corrigido no E2E:** `claim_scheduled_messages` era executável por `anon` (EXECUTE default a PUBLIC) e devolvia tokens de instância → REVOKE de PUBLIC/anon, só `service_role`. Migrations+edge fn em PROD; frontend via push→CI.

---

### v7.68.0 (2026-06-03) — 🟢 Fotos de perfil das instâncias permanentes (Storage) — SHIPPED PROD

Avatares das instâncias apareciam quebrados no **Disparador** (e telas afins). Causa-raiz: `instances.profile_pic_url` guardava a URL assinada do CDN do WhatsApp (`pps.whatsapp.net/...?oe=<expira>`), gravada uma vez no sync e já expirada. Replicado o padrão de avatar de **contato** (Storage permanente + refresh on-demand) para instâncias.

- **Migration `instance_avatar_storage`:** `instances` ganha `profile_pic_storage_path` + `profile_pic_synced_at`; reusa bucket público `contact-avatars` (paths `instance-<id>.jpg`).
- **`_shared/avatarStorage.ts`:** `fetchInstanceProfilePicUrl` (GET `/instance/status` → `profilePicUrl`, só token — `/contact/getProfilePic` dá 405 no servidor) + `syncInstanceAvatar` (download→upload→UPDATE). `uploadAvatarToStorage` generalizado (`contactId`→`objectId`).
- **Edge fn `refresh-instance-avatar`:** `{ instance_id }` → re-busca/sobe/grava URL pública estável; `verify_jwt=true`, throttle 5 min.
- **`InstanceAvatar.tsx`:** espelho do `ContactAvatar` (detecta URL stale, rehidrata on-mount/onError, fallback ícone Server). Wire: `InstanceSelector` (Disparador), `InstanceCard`, `InstanceDetails`, `BroadcasterHeader`.
- **E2E:** 3 instâncias migradas p/ Storage (HTTP 200, inclusive Sandbox IA antes `null`); Disparador exibe as 3 fotos reais via Playwright; `tsc`/`deno check` 0, 29/29 testes avatarStorage. Migration+edge fn em PROD; frontend via push→CI.

---

### v7.67.0 (2026-06-02) — 🟢 Auditoria de paridade Agente IA ↔ Painel Admin: 1 bug + 2 toggles mortos religados — SHIPPED PROD

Auditoria cruzando `ai_agents` (70 colunas via SQL) × `ALLOWED_FIELDS` (UI) × reads do backend × controles da UI. Achou 3 gaps reais (corrigidos) + 3 menores (anotados). Releases v7.65/66 confirmadas 100% wired (o "toggle não aparece" era só lag de build do front).

- **Gap #1 (🔴 bug latente) — `max_lead_messages`:** estava no `ALLOWED_FIELDS`, tinha input no `RulesConfig` e era lido pelo backend (`index.ts:1483-84`), **mas a coluna nunca foi criada**. Editar o campo quebrava o auto-save inteiro (PostgREST "column does not exist") e o backend sempre usava o default. **Fix:** migration cria a coluna **nullable sem default** (default 8 reintroduziria o bug qualify-first do `so_se_pedir`→40).
- **Gap #2 (🟠 toggle morto) — `handoff_negative_sentiment`:** switch salvava OK mas o backend nunca lia. **Religado:** handoff por sentimento negativo **PERSISTENTE** (≥2 sinais na sessão: 2 msgs negativas, OU tag `sentimento:negativo` prévia + atual negativa). Helper puro `_shared/agent/handoffCaps.ts`.
- **Gap #3 (🟠 toggle morto) — `handoff_max_conversation_minutes`:** input salvava OK mas backend nunca lia. **Religado:** cap de duração da conversa (minutos desde `sessionStartDt`).
- **Wire no `index.ts`:** 2 caps pré-LLM logo após o cap de interações, reusando as MESMAS primitivas (`pickHandoffMessage`/`runQueueAssignment`/resumo-do-pedido/shadow) via closure local `runAbsoluteCapHandoff`. **Zero gambiarra.**
- **Rollout seguro (igual v7.65/66):** os 2 flags tinham default ligado (15/true) em TODOS os agentes — religar a leitura sem reset transbordaria todo mundo. Migration **zera os defaults (0/false) + reseta os rows existentes**; features ligadas explicitamente por agente (EletropisoV2, com OK). UI alinhada (`?? false`/`?? 0` + descrições). Query de sentimento gated pelo flag → custo zero pros agentes OFF.
- **Pipeline (SHIPPED):** `handoffCaps.test.ts` 19 testes · vitest 617 totais · deno 0 · tsc 0. Merge `16fe9bd` → master (push). Migration aplicada+verificada em PROD. **`ai-agent` deployado v259 (verify_jwt false). EletropisoV2 ligado: `handoff_negative_sentiment=true`, `handoff_max_conversation_minutes=0` (OFF, decisão do dono).** Os outros 2 agentes seguem OFF. UI do `RulesConfig` (default OFF) sobe no próximo build do front.
- **Menores anotados (backlog):** `specialist_model`/`business_name` lidos mas sem coluna (sempre default/undefined); `tts_fallback_providers` sem UI; `sub_agents`/`out_of_hours_message` colunas legadas órfãs.

---

### v7.66.0 (2026-06-02) — 🟢 Fora-horário: IA continua atendendo e acumula o pedido até o lead terminar / 15 interações

Fecha bug auditado (caso George, EletropisoV2 PROD, fora-horário): ao qualificar um produto OFFLINE (catálogo vazio), o agente transbordava **por-produto** assim que batia o cap de enriquecimento → `status_ia=shadow` → parava de responder; a próxima pergunta do lead ("Tem trena?") caía no vazio (e o cron requeue reenviava a OOF). Pedido do dono: **fora do horário, a IA continua atendendo e ACUMULA o pedido**, transbordando só no FIM (closer / 15 interações / silêncio) com **uma** mensagem fora-horário + resumo itemizado + shadow.

- **Flag por-agente** `ai_agents.continue_outside_hours_until_done` (default OFF, migration `20260602000000`). SYNC RULE: types.ts + ALLOWED_FIELDS + UI (3º card em `AbandonHandoffConfig`). **Ligada só no EletropisoV2.**
- **`ai-agent/index.ts` (2 blocos):** (1) no "no-result loop", sob flag ON + fora-horário + !specificItem, em vez de transbordar registra o item em `cart_items` (nome via tags), **reseta o estado por-item via PRESERVE-LIST** (limpa TODO atributo de qualquer categoria + `lead_score`; mantém só durables), seta `offline_order:1`+`offline_await_more:1` e pergunta "Quer mais alguma coisa ou é só isso?". (2) Antes do executor de handoff: `offline_order` (durável) + closer ("é só isso"/despedida, ancorado, ignora "?") → reusa `pendingSaleClosedHandoff='offline_order_done'` (executor cart-aware: OOF + shadow + nota itemizada); novo produto → limpa só o `offline_await_more` e segue atendendo. **specificItem ("o da foto") continua transbordando na hora.**
- **Redes de segurança cart-aware:** cap-15 (`max_lead_interactions`) agora também anexa o resumo itemizado do cart (paridade); o cron de inatividade já lê `cart_items`.
- **Não-regressão:** flag OFF ou dentro do horário → os 2 blocos são no-op (byte-a-byte o comportamento atual). Zero toque no fluxo de tintas (marcador `offline_order` distinto).
- **Auditoria adversarial (workflow, 4 agentes)** pegou 1 blocker (denylist→preserve-list) + 2 majors (cap-15 sem resumo; encadeamento catalogado+não-categorizado não finalizava) — **todos corrigidos** antes do commit.
- **E2E real sandbox nota 10** (invocação direta, flag ON + fora-horário): canos "Tigre" → cart + "quer mais?" + ligada (sem transbordo); preserve-list limpa `ambiente`/`formato`/`lead_score`; "Tem trena?" → atendido (qualifica) + `offline_order` mantido; "é só isso" → shadow + OOF + nota com **2 itens** (canos no cart + trena nas tags). deno 0, tsc 0, vitest 54.

### v7.65.1 (2026-06-01) — Inatividade vira 2 estágios (cutucada 3min → transbordo +3min = 6min)

Ajuste do dono sobre a v7.65.0 (mesma sessão): em vez de transbordo **direto** aos 3min, o fluxo de inatividade genérica passa a ter **cutucada antes** — igual ao fluxo pendente, mas pra qualquer lead silencioso. Cutucada após `inactivity_nudge_after_min` (default 3) → transbordo após `inactivity_handoff_after_min` da cutucada (default +3, **total 6min**). Se o lead responder à cutucada, a timeline é abortada.

- **Coluna nova** `ai_agents.inactivity_nudge_after_min` (=3). `inactivity_handoff_after_min` muda de semântica (era "silêncio→handoff direto"; agora "min APÓS a cutucada") — default 3 segue válido, sem migração de dado. Migration `20260601000002` + RPC retorna a coluna nova (DROP+CREATE). SYNC RULE: types.ts + ALLOWED_FIELDS + UI (card de inatividade agora com 2 inputs + total, igual ao de abandono).
- **`decideAbandonStage` unificado** (2 estágios pros dois fluxos): quando o lead é elegível ao T2 (inatividade ON + interagiu + não-encerrou), os **limiares do T2 governam** mesmo com tag pendente; T1 só vale quando T2 não se aplica. Reusa o nudge tag `abandon_nudged:{ms}` e o stage de cutucada já existente no edge. `silent_min` na nota passa a contar do **último incoming do lead** (tempo total de silêncio).
- **E2E real sandbox nota 10** (2 invocações): invoke#1 → A classificado **nudge** (send tentado; `errors:1` no jid fake, como na v7.56.0); invoke#2 (cutucada simulada há 4min) → A **handoff** (`status_ia=shadow`, log `inactivity:true`, `silent_min:6`, nota "lead ficou 6min sem responder"). B (despedida)/C (nunca respondeu)/D (1,5min) seguem `skipped`.
- **Pipeline:** vitest 36/36 · deno 0 · tsc 0 · migration PROD · deploy CLI (scoop). **EletropisoV2: cutucada 3 + transbordo +3 (total 6min).**

### v7.65.0 (2026-06-01) — 🟢 Transbordo por INATIVIDADE genérica (qualquer lead silencioso → fila do vendedor)

Estende o transbordo automático (v7.56.0 só pegava lead com handoff **pendente** — tag `seller_handoff_pending`). Agora **QUALQUER lead** que parar de responder à IA por N min vai pra fila do vendedor — fecha o buraco do lead que esfria no meio da conversa sem ninguém saber. Pedido do dono; **ligado só no EletropisoV2**. *(v7.65.0 nasceu como transbordo direto aos 3min; a v7.65.1, mesma sessão, trocou pra cutucada+transbordo.)*

- **2 colunas novas em `ai_agents`** (default OFF): `inactivity_handoff_enabled` + `inactivity_handoff_after_min` (=3). Independente do fluxo pendente. SYNC RULE: migration + types.ts + ALLOWED_FIELDS + UI (`AbandonHandoffConfig` ganhou 2º card "Transbordo por Inatividade").
- **Transbordo DIRETO (sem cutucada)** — decisão do dono. Guarda-corpos no `_shared/agent/abandonHandoff.ts` (`decideAbandonStage` caminho T2, precede o nudge pendente): só transborda quem **já interagiu ≥1x** (`leadEverReplied`) E a conversa **não terminou em despedida** (`looksLikeConversationClosed` — ignora "obrigado/tchau/vou pensar"/acks curtos; pergunta com "?" nunca é encerramento). Evita inundar o vendedor com lead frio ou conversa concluída.
- **RPC `find_abandoned_handoff_candidates` generalizada** (DROP+CREATE): retorna também leads sem tag pendente quando inatividade ligada, com flag `has_pending_handoff` (decide a razão/nota) + pré-filtro de 1min. **Cron `*/2`→`* * * * *`** (1min) pra mirar os 3min com precisão. Gate de horário comercial preservado (não transborda fora do expediente).
- **Nota interna distinta** pro vendedor (*"📋 Transbordo automático — lead ficou Nmin sem responder à IA"*) + log `handoff_trigger {inactivity:true, silent_min}`. Reusa as MESMAS primitivas do `dispatchResponse` step 22 — zero duplicação, NÃO toca `ai-agent/index.ts`.
- **E2E real sandbox nota 10** (função deployada, cron via `net.http_post`): 4 cenários — A (interagiu+4min)→**transbordo** (`status_ia=shadow`, log inativity=true, nota interna); B (despedida)→**não**; C (nunca respondeu)→**não**; D (1,5min<3)→**não**. Resposta da fn: `scanned:4, handed_off:1, skipped:3, errors:0`.
- **Pipeline:** vitest 34/34 (decisão pura + `looksLikeConversationClosed`) · deno check 0 · tsc 0 (front) · migration aplicada em PROD · deploy CLI (binário scoop). **EletropisoV2 LIGADO (3min)**; demais OFF.

### v7.64.0 (2026-06-01) — 🟢 AI Agent: 5 bugs determinísticos + cap de interações + categoria bombas

Pacote de 6 correções no AI Agent a partir de 3 conversas reais de PROD (diagnóstico forense provou que TODOS eram determinísticos — não foi falha de visão/GEMINI). E2E real nas 2 sandboxes nota 10 + config aplicada em PROD (EletropisoV2) + ai-agent/requeue deployados.

- **Bug 1 — loop "Qual formato?" sem transbordo (Dauana):** o override premium hardcoded (`serviceCategories.ts withPremiumCategoryOverrides`) FORÇAVA `revestimentos`/`torneiras` a `digital` + injetava o campo `formato` (60×60/90×90/120×120), ignorando a config OFFLINE do admin → quando o lead mandava foto de um tijolo 32,5×57 e dizia "o da foto", a pergunta repetia pra sempre. Fix de raiz (decisão do dono): **respeitar a config offline do admin** (override só quando `digital`); + **loop-breaker** determinístico (`evaluateQualifyReaskGuard`, reusa `max_qualification_retries`) no caminho digital; + **detector "o da foto"** (`detectSpecificItemRequest`) → handoff imediato nos caminhos digital e offline. E2E: "quero o que está na foto" → transbordo na hora (zero repetição).
- **Bug 2 — lead novo não recebia saudação (Michelaine):** `hasInteracted` (index.ts) contava QUALQUER linha de `ai_agent_logs`, mas os detectores passivos (`brand_mentioned`/`payment`/`client_type`) inserem log ANTES da contagem → lead cuja 1ª msg citava marca ("brasilit") era classificado 'ativo' e perdia a saudação. Fix cirúrgico: contar só `INTERACTION_EVENTS` (resposta real do agente). E2E: "tem impermeabilizante brasilit?" → "Boa tarde! Bem-vindo a Eletropiso, com quem eu falo?".
- **Bug 3 — "bomba d'água" → "Qual tipo de portão?" (Cris):** não existia categoria `bombas`; o LLM mapeou bomba→`motores` (portões). Fix: **categoria `bombas`** (offline, uso→tipo→marca→handoff) nas 3 instâncias + `motores.catalog_status` null→offline. E2E: bomba pra poço → uso/tipo/marca → handoff "Categoria: bombas", ZERO menção a portão.
- **Feat 4 — "temos cano de 100":** categoria `canos` reordenada (já existia) → tipo (esgoto/água) → marca → handoff. E2E: cano 100 esgoto Tigre → transbordo, 0 negações.
- **Feat 5b — teto absoluto de 15 interações:** nova coluna `ai_agents.max_lead_interactions` (default 15, 0=off, SYNC RULE 8 locais). Gate determinístico pré-LLM que VENCE qualquer `handoff_rule` ('nunca'/'so_se_pedir'): ao atingir N msgs do lead → transbordo + shadow + para de responder. E2E (cap=3): 3ª msg → `max_interactions` handoff, 4ª em shadow → `shadow_trivial_skip`.
- **Bug 5a — fora-horário pra lead idle:** auditoria confirmou que a ENTRADA já está correta (IA atende normal fora do horário). Único emissor restante: cron `requeue-conversations` Case B avisava lead PARADO na fila. Fix: `decideOutOfHoursSend` ganha `queueEnteredAtMs` → idle (não falou após entrar) não recebe OOF, só pausa. 12 testes deno verdes.

Cobertura: `productQualificationFlow.test.ts` +12 (loop-breaker/detector/getReaskState), `queueRotation.test.ts` +4 (idle OOF). deno check 0, frontend build OK. HIGH RISK aprovado pelo dono.

### v7.63.1 (2026-06-01) — 🟢 Fila "Sem atendimento": ordenação + filtro por atendente

Ajustes pedidos pelo dono na aba "Sem atendimento" (`UnattendedLeadsTab`):
- **Ordem padrão mais recente → mais antiga.** RPC `get_unattended_handoff_leads` passa a ordenar `assigned_at DESC` (era ASC) — bônus: o cap de 200 agora guarda os 200 leads **mais recentes** (mais acionáveis). Migration `20260601000000_unattended_leads_order_desc.sql` (aplicada em PROD).
- **Seletor de ordenação** (client-side, 4 modos): Mais recentes / Mais antigos / Maior espera / Nome (A–Z).
- **Filtro por atendente** (client-side): dropdown derivado dos próprios leads, com contagem por atendente ("Dilma (12)") + "Todos os atendentes (N)". Compõe com a ordenação.
- **E2E real** (Playwright app): ordem padrão crescente (35m→39m), filtro Dilma → 12 cards só dela, "Maior espera" → 54h no topo, sort+filtro compõem. tsc 0 nos arquivos da feature, vite build OK.

### v7.63.0 → v7.61.0 (2026-05-31)

Movidas p/ [[wiki/changelog/2026-05-part13]] (Dashboard gestor + fetch_messages_timeout + reload de aba).

### v7.60.0 (2026-05-31) e anteriores

v7.60.0 → v7.56.1 → ver [[wiki/changelog/2026-05-part12]]. Anteriores → [[wiki/changelog/2026-05-part11]].
