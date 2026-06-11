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

### v7.79.0 (2026-06-11) — 🟢 Helpdesk: busca acha QUALQUER conversa da caixa (server-side) + deep-link abre conversa fora do filtro

**Bug do dono:** buscou `558196970061` (até com filtro "Todas") e não achou a conversa — ela era "resolvida" e fora das 50 carregadas. **Causa:** a busca era 100% client-side sobre a página carregada (status filtrado no servidor + paginação 50); o `?conv=` da URL também só selecionava conversa presente na lista carregada (deep-link da busca global pra conversa resolvida falhava silencioso).

**Fix:**
- **Busca server-side (3+ chars):** consulta `contacts` (telefone só-dígitos + pushname) e `lead_profiles.full_name` (nome extraído), busca as conversas da caixa em QUALQUER status e injeta na lista (dedup por id, mesmo shape via `CONVERSATION_LIST_SELECT`/`mapConversationRows` compartilhados). Helpers puros em `src/lib/helpdeskServerSearch.ts` (10 testes). Telefone formatado funciona ("+55 81 9697-0061").
- **Deep-link `?conv=`:** fallback fetch-by-id quando a conversa não está na página carregada (guard: só abre se for da caixa atual).

**Causa-raiz lateral descoberta no E2E:** o arquivo da página estava como `Helpdesk.tsx` no disco Windows mas `HelpDesk.tsx` no git/imports → Vite (case-sensitive no module graph) servia versão STALE da página em dev; edits não chegavam no browser. Disco renomeado pro casing do git.

**E2E real Playwright 3/3 PASS:** busca pelo número acha a "Van" (resolvida, fora da página) · clique abre · deep-link abre direto. tsc 0, 138 testes lib verdes.

---

### v7.78.1 (2026-06-10) — 🟢 Helpdesk: preview da lista congelava na última msg da IA (725 conversas corrigidas)

**Bug do dono (print):** na conversa a última mensagem era "ta certo" (17:17), mas a lista mostrava "Vai ser para uso em área interna ou externa?" — com a hora certa. **Causa raiz:** `conversations.last_message` (texto do preview) só era escrito pela IA; webhook (mensagens do lead + takeover pelo celular) e app confiavam num trigger que só atualizava o TIMESTAMP. O comentário do webhook (linha 1101) prometia "last_message_at + last_message + is_read atualizados pelo trigger" citando um trigger (`update_conversation_on_message_insert`) que **nunca existiu**. Enquanto a aba está aberta o realtime mascara (patch em memória); ao recarregar volta o valor stale do DB.

**Fix de raiz (fonte única):** trigger `update_conversation_last_message_at` agora grava os 3 campos em TODOS os caminhos de escrita — `last_message_at`, `last_message` (content ou preview de mídia 📷/🎥/🎵/📎/🌟/🎠/📊/👤, espelhando `mediaPreview()` do front; `private_note` não altera preview) e `is_read=false` em incoming (antes NENHUM caminho backend resetava unread em conversa existente — badge dependia do realtime). Migration `last_message_preview_trigger` + **backfill: 725 conversas** com preview congelado recalculadas. Comentário do webhook corrigido (sem redeploy — só comentário).

**Validação E2E real:** caso do print conferido no DB ("Vai ser para uso…" → "ta certo") + INSERT de teste em transação com rollback automático (trigger atualizou preview/is_read/timestamp; dado de teste comprovadamente não persistiu).

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

### v7.72.0 → v7.68.0 (2026-06-03/04)

Movidas p/ [[wiki/changelog/2026-06-part2]] (reatribuição notifica atendente, mídia base64→URL, cadastro de membro atômico, import em massa, auto-enroll do Disparador, módulo de bases + hardening, avatar de instância no Storage).

### v7.67.0 → v7.63.1 (2026-06-01 a 06-02)

Movidas p/ [[wiki/changelog/2026-06-part1]] (paridade Agente↔admin, fora-horário acumula pedido, inatividade 2 estágios, 5 bugs determinísticos, fila sem-atendimento).

### v7.63.0 → v7.61.0 (2026-05-31)

Movidas p/ [[wiki/changelog/2026-05-part13]] (Dashboard gestor + fetch_messages_timeout + reload de aba).

### v7.60.0 (2026-05-31) e anteriores

v7.60.0 → v7.56.1 → ver [[wiki/changelog/2026-05-part12]]. Anteriores → [[wiki/changelog/2026-05-part11]].
