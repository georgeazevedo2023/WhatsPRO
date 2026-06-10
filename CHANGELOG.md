---
title: Changelog
type: changelog
updated: 2026-06-10
audited_at: 2026-06-05
---

# Changelog

> Releases ativas (últimos ~14 dias). Histórico completo em [[wiki/changelog/]].
>
> **Convenção:** semver. Toda feature/fix shipado vira entrada aqui (REGRA 17 do CLAUDE.md). Após release recente envelhecer >14 dias, mover pra `wiki/changelog/<ano-mes>.md`.

---

### v7.78.0 (2026-06-10) — 🟢 Helpdesk: nome extraído pela IA vence o pushname na exibição (caso "oi" → Jessica)

**Bug do dono:** lead com pushname do WhatsApp literalmente "oi" se apresentou como "Jessica"; a IA gravou certinho em `lead_profiles.full_name` (via `update_lead_profile`), mas header/lista do Helpdesk continuavam mostrando "oi". **Não era falha de extração — é a arquitetura de DOIS nomes:** `contacts.name` preserva o pushname (re-sincronizado a cada mensagem pelo `whatsapp-webhook`; sobrescrever = o webhook reverte na próxima msg) e o nome informado na conversa vive em `lead_profiles`. A UI só olhava `contacts.name`.

**Fix (camada de exibição, zero mudança no backend/webhook):**
- `src/lib/contactDisplayName.ts` — lógica PURA (8 testes): prioridade `lead_profiles.full_name` → pushname → telefone.
- Lista (`ConversationItem`), header do chat (`ChatPanel`), painel lateral (`ContactInfoPanel`) e aria-labels (`ConversationList`) usam o helper.
- Busca local também encontra pelo nome extraído (`useHelpdeskFilters`) — quem vê "Jessica" acha digitando "Jessica".
- Select da lista embeda `lead_profiles(full_name)` aninhado (1:1, `contact_id` UNIQUE).

**Validação:** tsc 0 · 22/22 testes das áreas tocadas · 19 fails da suite provados pré-existentes (re-rodados com `src/` stashado) · **E2E real Playwright** no app local (login admin → deep-link da conversa): header "oi"→"Jessica" + busca "Jessica" acha a conversa (screenshot conferido).

**Limitação anotada:** `GlobalSearchDialog` (busca global, server-side) ainda não busca por full_name extraído — backlog.

### v7.77.0 (2026-06-09) — 🟢 Helpdesk: vendedores Android sem enviar foto — aba velha pós-deploy era a causa; auto-recuperação de versão + upload anti-zumbi + telemetria

**Bug do dono:** "alguns vendedores/atendentes não conseguem enviar fotos pros leads pelo Helpdesk; acho que usam Android". **Ground truth chocante:** em 7 dias, **ZERO uploads de Android** no `helpdesk-media`; em 14 dias só 9 imagens humanas no total; vendedores já usavam **workaround pelo celular** (7/8 imagens de hoje foram fromMe). RLS descartada (policy pública p/ authenticated).

**Causas-raiz (auditoria multi-agente 5 traces + verificação adversarial):** (1) **CONFIRMADO** — o fix HEIC da v7.75.0 só ficou vivo HOJE (08:04 UTC; deploy anterior era de 06-05) e celular mantém a aba viva por DIAS sem recarregar + `index.html` sem `Cache-Control` (cache heurístico) → vendedores rodavam código **pré-fix**, onde foto de câmera Android (HEIC) toma 500 do UAZAPI. (2) **CONFIRMADO** — cada redeploy **apaga os chunks do build anterior** (flagrado ao vivo: 404 + Bad Gateway); aba antiga que lazy-loada o chunk do heic2any (1,35MB, só baixa no 1º envio de HEIC) toma 404, o Chromium **cacheia a falha do módulo** e todo retry falha até F5 — bolha genérica. (3) **PARCIAL** — upload ao Storage era o único passo de rede sem proteção anti-sessão-zumbi (spinner infinito). (4) **PARCIAL** — heic2any 0.0.4: worker sem error-handler (OOM = promise eterna), asm.js 16MB, zero cap de dimensão; erros reais (`ERR_LIBHEIF`, `Cannot enlarge memory`) não casavam o `humanizeSendError`. (5) Bugs menores: `userId:''` → UAZAPI entrega + INSERT falha + retry **duplica a foto no lead**; cap 20MB pré-conversão; foto cloud-only (0 bytes) sem mensagem.

**Fix de raiz (8 frentes):**
- `nginx.conf`: `Cache-Control: no-cache` no index.html + version.json (assets seguem immutable).
- `main.tsx`: listener global `vite:preloadError` → **reload automático 1x** (guarda anti-loop) — chunk 404 pós-deploy se auto-recupera.
- `vite.config.ts`: `__APP_BUILD__` + `version.json` por build; `useTabFocusRefresh` checa no tab-resume e mostra **toast "Nova versão — Recarregar"** (passivo, lição v7.61.0: nunca reload forçado).
- `normalizeOutboundImage.ts`: HEIC blindado — retry do import + erro tipado `CHUNK_LOAD_FAILED`, **teto 60s** na conversão (worker morto não pendura mais), normaliza rejeições-objeto do heic2any, fallback canvas (Safari decodifica HEIC nativo), **cap 4096px** no canvas (anti-OOM).
- `sendErrors.ts`: mapeia ChunkLoadError→"recarregue a página", ERR_LIBHEIF/memória→dica de print, sessão expirada, "mídia" com acento, arquivo 0 bytes→dica Google Fotos.
- `useSendFile`/`uploadOutboundMedia`: upload com **teto 120s + recoverStuckSession** (fim do spinner infinito); cap 20MB movido pra DEPOIS da conversão; teto duro 50MB pré; `uazapiClient` AbortController 90s.
- `ChatInput`: guard `!user` ANTES de enviar (mata a foto duplicada no lead).
- **Telemetria** (`media_send_telemetry` + edge fn `log-send-failure` verify_jwt=false + `sendTelemetry.ts` fire-and-forget text/plain keepalive): toda falha grava estágio/erro/build/UA — falha client-side deixou de ser invisível. Smoke E2E ok.
- `deploy.yml`: **CI chama o webhook do Portainer** (secret `PORTAINER_WEBHOOK_URL`) — mata o deploy-fantasma de vez (2 ocorrências registradas; a de hoje detectada e corrigida nesta sessão).

**Verificação:** 32/32 testes novos+existentes dos módulos; suite 545✓ (5 fails pré-existentes forms); tsc/deno 0 novos; build emite version.json com id idêntico ao bundle; telemetria smoke E2E (beacon→DB). Detalhe: [[project_vendor_photo_send_audit_v777]].

---

### v7.76.0 (2026-06-09) — 🔴→🟢 AI Agent: handoff repetia + IA falava depois do transbordo — gate de silêncio durável + handoff idempotente

**Bug do dono** (print MARMOBOX ALMOXARIFADO / lead Guedes — na verdade **EletropisoV2**, "MARMOBOX" é só o nome de perfil do contato): após o transbordo a IA **reenviou a MESMA mensagem de handoff** ("Guedes, seu pedido de cabos. Já passei tudo pro nosso vendedor…") a cada nova mensagem do lead. No DB de prod: **3 transbordos idênticos** (11:00/14:58/15:04) + filas/notas/vendedores novos a cada um. Regra violada: **depois do handoff a IA deve ficar MUDA pro lead até o atendente Finalizar ou clicar "Ativar IA"**.

**Causa-raiz (auditoria multi-agente 6 traces + verificação adversarial, ancorada no DB real):** dois defeitos compostos. **(1) não-silenciado:** "humano no controle" estava codificado SÓ em `status_ia` (volátil) — o gate de entrada só barra `desligada`, `assigned_to` nunca era lido, e `dispatchResponse:417`/`webhook:1124`/reabertura regravavam `ligada` por cima do `shadow` do handoff. **(2) repetição:** o handoff não era idempotente — `handoffToHuman` gravava `handoff_created:true` mas **nunca o lia**, o `handoff_cooldown_minutes=30` **só era logado** (nunca enforçado), e as **tags do loop sem-resultado** (`enriching/enrich_count/catalog_result/flow_mode`) **nunca eram limpas** → assim que `status_ia` voltava a ≠shadow, o loop re-detectava "pronto pra handoff" e re-disparava o MESMO transbordo.

**Fix de raiz (zero gambiarra, 7 arquivos):**
- **Gate de silêncio durável** (`ai-agent/index.ts` após :219): se `handoff_created`/`human_assigned` presente e `status_ia≠shadow` → coage `status_ia→shadow` (+self-heal no DB). Cai no SHADOW MODE → **detecção interna viva, zero texto pro lead** (decisão do dono). Neutraliza TODOS os resets de uma vez.
- **Handoff idempotente** (`setTagsAndHandoff.ts`): suprime reenvio se `handoff_created`/`handoff_at:<ms>` dentro do cooldown; grava `handoff_at` (cooldown agora REAL); **remove as tags de loop** no transbordo.
- **Defesa em profundidade** (loop guard :3093): checa a tag durável `handoff_created` ([[feedback_guard_must_check_durable_tags]]).
- **Religar de fato** (`ChatPanel` "Ativar IA" + `conversationReopen`): limpam `handoff_created/human_assigned/handoff_at` + tags de loop (decisão: *Ativar IA OU Finalizar/reabrir* religam).
- **Webhook** (`whatsapp-webhook:1124`): não deixa o payload do n8n rebaixar `shadow→ligada` com handoff ativo.

**Verificação:** `deno check` 0 · `tsc` (ChatPanel) 0 · **+4 testes novos** (idempotência ×3 + reopen-strip), suíte 0 regressão (14 fails pré-existentes não-relacionados). **Deploy PROD** (ai-agent v260, whatsapp-webhook v15). **Cleanup:** UPDATE limpou as tags de loop de **128 conversas órfãs** (preservou handoff markers + tags de negócio). Detalhe: [[project_handoff_repeat_silence_v776]].

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

### v7.67.0 → v7.63.1 (2026-06-01 a 06-02)

Movidas p/ [[wiki/changelog/2026-06-part1]] (paridade Agente↔admin, fora-horário acumula pedido, inatividade 2 estágios, 5 bugs determinísticos, fila sem-atendimento).

### v7.63.0 → v7.61.0 (2026-05-31)

Movidas p/ [[wiki/changelog/2026-05-part13]] (Dashboard gestor + fetch_messages_timeout + reload de aba).

### v7.60.0 (2026-05-31) e anteriores

v7.60.0 → v7.56.1 → ver [[wiki/changelog/2026-05-part12]]. Anteriores → [[wiki/changelog/2026-05-part11]].
