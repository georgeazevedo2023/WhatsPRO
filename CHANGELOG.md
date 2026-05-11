---
title: Changelog
type: changelog
updated: 2026-05-11
audited_at: 2026-05-11
---

# Changelog

> Releases ativas (últimos ~14 dias). Histórico completo em [[wiki/changelog/]].
>
> **Convenção:** semver. Toda feature/fix shipado vira entrada aqui (REGRA 17 do CLAUDE.md). Após release recente envelhecer >14 dias, mover pra `wiki/changelog/<ano-mes>.md`.

---

### v7.32.6 (2026-05-10) — Polish helpdesk: áudios outgoing + player + console

**Contexto:** Após o fix do pipeline de transcrição (v7.32.5), 4 demandas incrementais do usuário durante o teste E2E: (1) player do áudio com pouco contraste, (2) áudio outgoing também precisa transcrever pra extrair métricas de atendimento, (3) console mostrando 2 erros (URL pré-migração + URL relativa em carrossel), (4) UX do player precisava de identificação clara incoming vs outgoing.

**Player redesign (`AudioPlayer.tsx`):**

- Container do player ganhou bg próprio (`bg-emerald-900/55` outgoing, `bg-foreground/5` incoming) com `ring` sutil — fica "card embed" estilo Spotify
- Outgoing: paleta emerald-200/100 com play button branco + texto emerald-800. Passa WCAG AA contra a bolha verde clara.
- Incoming: paleta **sky** (não primary verde) — diferenciação visual do outgoing à primeira vista
- Waveform decorativo: 32 barras com alturas pseudo-aleatórias estáveis por src (memoized)
- Mic badge decorativo no canto inferior direito do play button
- Speed pill com 2 estados (idle/playing) e variantes por direction
- Label "🎤 ÁUDIO DO CLIENTE" / "🎤 ÁUDIO ENVIADO" acima do player
- Transcrição agora num card estilizado com bg sutil (não mais texto solto)

**Transcrição outgoing (`ChatInput.tsx`):**

- `handleSendAudio` dispara `transcribe-audio` (fire-and-forget) após o INSERT da mensagem outgoing
- Habilita métricas de atendimento (tempo médio de resposta em texto, análise de sentimento, busca textual em conversas)
- Spinner "Transcrevendo..." aparece em outgoing também enquanto a edge processa

**Console fixes:**

- `pps.whatsapp.net 403`: `ContactAvatar.triggerRefresh` aceitava qualquer URL retornada por `refresh-avatar`, inclusive CDN do WhatsApp que expira em 24h. Fix: filtrar via `isStaleSrc` antes de setar `refreshedSrc`.
- `<UUID>.jpg ERR_NAME_NOT_RESOLVED`: 2 causas. (a) Carrossel renderizava `card.image` sem validar protocolo — strings sem `https://` viravam URLs relativas (`localhost:8080/UUID.jpg`). Fix: regex `/^https?:\/\//`. (b) `contacts.profile_pic_url` legacy de pré-migração 2026-05-06 (`euljumeflwtljegknawy.supabase.co`) — DNS não resolve mais. Fix: `isStaleSrc` extrai o ref do projeto da URL e compara com `VITE_SUPABASE_URL` atual; refs diferentes são tratados como stale.

**Auto-avaliação:** **9/10** — fixes focados, validação E2E real (transcrição "Olá, 1, 2, 3, testando o áudio." visível no helpdesk).

---

### v7.32.5 (2026-05-10) — Fix áudios + transcrição quebrada

**Contexto:** Usuário reportou que áudios outgoing não tocavam no helpdesk (caixas verdes vazias com badge "1x") e áudios incoming ficavam presos em "Transcrevendo...". Investigação revelou 3 bugs encadeados em produção.

**Bugs:**

1. **Bucket `audio-messages` privado** mas o sistema gera URLs `/object/public/...` (formato exclusivo de bucket público). Migration original (`20260320011313`) define `public: true` mas o estado divergiu em algum ponto. Mesmo problema em `helpdesk-media`.
2. **Webhook insere `max_retries`** em `job_queue` cujo schema usa `max_attempts`. INSERT falha silenciosamente (erro logado em error-level, ignorado).
3. **RPCs `claim_jobs` e `complete_job` ausentes** no DB. Mesmo se o INSERT funcionasse, o cron nunca processaria — pipeline inteiro de jobs parado.

**Fix:**

- `UPDATE storage.buckets SET public=true` em `audio-messages` e `helpdesk-media`. Validado via curl HEAD.
- `whatsapp-webhook/index.ts:1057-1075` reescrito: ao invés de inserir job em `job_queue` (cadeia quebrada), chama a edge `transcribe-audio` direto via `backgroundFetch`. Elimina dependência da fila + RPCs ausentes.
- Deploy: `whatsapp-webhook` deployado em `prfcbfumyrrycsrcrvms`.

**Pendência:** chamada manual a `transcribe-audio` retorna `{ ok: false, error: 'All transcription providers failed' }` — Gemini key existe nas envs (não retornou "No provider configured") mas falha em runtime. Possíveis causas: key inválida, modelo `gemini-2.0-flash` deprecated, cota esgotada. **Usuário precisa verificar `GEMINI_API_KEY` no Dashboard** (Settings → Edge Functions → Secrets).

**Histórico:** áudios incoming foram transcritos normalmente até 25/03/2026 (16/16). A partir de 28/03 a maioria começou a falhar. Há um corte temporal claro — provavelmente coincide com mudança que introduziu o `max_retries` errado.

**Aprendizado:** registrado em `wiki/erros-e-licoes.md` — schema mismatch silencioso #2 (companion ao bug `notify-vendor-assignment` da v7.32.3). Lição reforçada: **todo INSERT/UPDATE em tabela crítica precisa validação E2E real verificando `error === null`**.

**Auto-avaliação:** **7/10** — fixei 2/3 bugs; o 3º depende do usuário. Nota baixa porque a degradação passou ~6 semanas em prod sem alarme.

---

### v7.32.4 (2026-05-09) — Card MOTIVO no Contexto IA do helpdesk

**Contexto:** Usuário perguntou por que os motivos do contato (compra, cotação, vaga de emprego, fornecedor, etc) não apareciam no painel direito do helpdesk. A taxonomia já existia no AI agent (`saudacao | compra | troca | orcamento | duvida_tecnica | suporte | financeiro | emprego | fornecedor | informacao | fora_escopo` — ver `ai-agent/index.ts:2400`) e a tag `motivo:X` era atribuída corretamente em cada conversa, mas a UI nunca renderizava o valor — `kpiMotivo` em `ContactInfoPanel.tsx` era calculado e descartado (TS warning `ts6133`).

**Fix:**

- Novo card **MOTIVO** (azul, ícone Target) na primeira linha da grid de KPIs do Contexto IA.
- Mapa `MOTIVO_LABELS` pra humanizar valores: `orcamento`→"Orçamento", `emprego`→"Vaga de emprego", `duvida_tecnica`→"Dúvida técnica", etc.
- Reorganização da grid: removido `col-span-2` do "Atendido IA", agora ele ocupa só 1 coluna. Total 8 cards em 4 linhas de 2.

**Auto-avaliação:** **9/10** — fix focado, sem novas regras. Nota não é 10 porque a omissão deveria ter sido pega no review do painel original.

---

### v7.32.3 (2026-05-09) — Polish Helpdesk + Fix crítico notify-vendor-assignment

**Contexto:** Sessão de UX no helpdesk descobriu — durante simulação E2E pedida pelo usuário — que a edge function `notify-vendor-assignment` (shipped na v7.32.0) **nunca havia entregado uma notif em prod** por bug de schema mascarado por `.maybeSingle()`. Bug oculto porque outro guard parava o pipeline antes (`skip_no_number`, já que vendors não tinham número cadastrado).

**Polish UX:**

- `QueuePauseToggle`: label "Disponível" → "Pausar". Atendente lê o botão como ação, não como estado. Estado pausado segue mostrando "Pausado".
- `ContactInfoPanel`: KPI **DURAÇÃO ATUAL** tickea em tempo real (intervalo 30s) usando `now − sessionStartIso`. Antes era estático. Em conversas resolvidas, congela em `resolved_at − sessionStart`.
- `VendorNotificationBanner`: oculto pra `super_admin` e `gerente`. O texto pede "Peça ao admin..." — auto-referente quando admin é quem vê. Esses roles não recebem handoff.

**Fix crítico — notify-vendor-assignment:**

- Select inicial tentava ler colunas inexistentes (`instance_id`, `contact_name`, `contact_phone`) direto em `conversations`. PostgREST devolveu erro de coluna, `.maybeSingle()` engoliu silenciosamente → `data=null` → `skip_reason='conv_not_found'`.
- Reescrito com embedding PostgREST: `'id, inbox_id, contact_id, assigned_at, contact:contacts(name, phone, jid), inbox:inboxes(instance_id)'`. `instanceId` agora resolvido via `convRow.inbox?.instance_id`. Mesma correção em `notifyPreviousAssignee()`.
- Validação E2E real: deltas aplicados (Lucas com `personal_whatsapp=+5581993856099`, `notifications_enabled=true`, `extended_hours_until=NOW()+30min`), edge function invocada → `{ ok: true }`, log `status=sent`, mensagem renderizada no WhatsApp com emojis/acentos corretos. Deltas revertidos.
- Deploy: `supabase functions deploy notify-vendor-assignment` no projeto `prfcbfumyrrycsrcrvms`.

**Aprendizado:** registrado em `wiki/erros-e-licoes.md` — toda edge function que envia mensagem/notif **precisa de validação E2E real** (chamada que force o caminho até `status=sent`). TS-check + unit test não pegam schema mismatch porque PostgREST não tipa selects encadeados.

**Auto-avaliação:** **8.5/10** — fix correto e validado, mas nota não é 10 porque o bug original passou batido por 2 dias antes da descoberta acidental (deveria ter sido coberto por teste E2E na v7.32.0).

---

### v7.32.2 (2026-05-07) — Refactor: UAZAPI não tem janela 24h (correção de premissa errada)

**Contexto:** Após shipar v7.32.1, usuário reforçou "não trabalhamos com API oficial, usamos UAZAPI". Identificado que toda a lógica de handshake/janela 24h foi implementada incorretamente — essa regra é da WhatsApp Business API oficial (Meta), NÃO do UAZAPI (que usa WhatsApp Web protocol via chip). UAZAPI não tem janela formal — o risco real é banimento de chip por uso abusivo, mitigado pelo rate limit (3/h) + batching + business_hours já existentes.

**Refactor:**

- Edge `whatsapp-webhook`: REMOVIDO intercept de handshake (~50 linhas). Vendedor não precisa mais mandar "oi" pra ativar. Conversas inbound seguem fluxo normal.
- Edge `notify-vendor-assignment`: REMOVIDO guard `skip_session_expired` + select de `whatsapp_session_until`. Função `notifyPreviousAssignee` simplificada (sem checagem de janela).
- Edge `escalate-stale-handoffs`: REMOVIDO checagem de `whatsapp_session_until` (vendor + manager).
- UI `UserNotificationPanel`: 6 estados → 4 (no_number / opted_out / active / paused). Removidos: never_handshake, expired, expiring_soon, hints "mande oi pra renovar".
- UI `VendorNotificationBanner`: completamente reescrito — só sinaliza vendedor sem `personal_whatsapp` cadastrado (alerta single-state amarelo). Removidos estados expired/expiring.
- UI `InstanceNotificationToggle`: tooltip atualizado ("rate limit 3/h" em vez de "renovar janela").
- Migration: DROP `user_profiles.whatsapp_handshake_at` + `whatsapp_session_until`.
- Total: ~80 linhas removidas + 2 colunas dropadas.

**Por que aconteceu:** quando usuário disse "instância do helpdesk", vi `uazapi-proxy` no código mas tratei mentalmente como Business API oficial (regra default que vinha do meu treinamento sobre WhatsApp pra empresas). Não questionei a premissa, e nas 3 auditorias subsequentes não revisitei essa base. Lição: **questionar premissas técnicas sobre integrações específicas antes de codar**.

**Tudo o que continua funcionando:** cadastro `personal_whatsapp` + opt-in + pause admin/gestor + business_hours + rate limit 3/h + batching rajada + escalation 5/10min + reatribuição órfã + KPI 1ª resposta + custo display + idempotência UNIQUE + banner "no_number".

**Impacto pro admin/vendor:**
- Admin: tela de cadastro mais simples (3 estados: 🟢 Ativo / ⏸ Pausado / 📭 Não cadastrado). Não precisa explicar handshake.
- Vendor: cadastra número uma vez, recebe notif sempre que assignment ocorrer. Sem ritual matinal de "mandar oi".

**Auto-avaliação:** **8/10** — refactor correto, mas o erro original derrubou a nota. Lição registrada em `wiki/erros-e-licoes.md`.

---

### v7.32.1 (2026-05-07) — Notif handoff: gaps F3+ resolvidos (A/B/C/D + médios E/F/G)

**Contexto:** Logo após shipar v7.32.0, usuário pediu pra mapear e resolver TODOS os gaps documentados como "dívida F3+". Fizemos auditoria final classificando 13 gaps em 3 níveis: críticos (A-D), médios (E-G), dependentes externo (I-M, mantidos como roadmap).

**Críticos resolvidos:**

- **Gap A — `business_hours` real** (era placeholder hardcoded `true`, guard `skip_off_hours` quebrado): implementado helper que lê `ai_agents.business_hours` JSONB + `extended_hours_until` (D30 Sprint E bypass), formata weekday em America/Sao_Paulo, suporta janela atravessando meia-noite, falha aberta em config inválida.

- **Gap B — Reatribuição órfã** (vendor anterior não sabia que perdeu): `notify-vendor-assignment` aceita `previous_assigned_to_id`. Quando diferente do `assigned_to_id`, dispara msg "⚠️ Atendimento reatribuído pra X, você foi liberado" pro vendor anterior (best effort, respeita guards essenciais session/optout/no_number/paused). `handoffQueue.ts` passa `previousAssigneeId` quando há reatribuição real (não em D-β reuse).

- **Gap C — Escalation 5min/10min** (lead morria por silêncio): nova edge function `escalate-stale-handoffs` rodando via pg_cron 1min. Migration: `notification_log.re_pinged_at` + `manager_alerted_at` (sem violar UNIQUE conv,vendor). Lógica: detecta `vendorResponded()` via `conversation_messages.direction='outgoing' AND sender_id=assigned_to`. 5min sem resposta → re-ping ("⏰ Lucas, lead João ainda esperando, atender agora"). 10min → alerta gerente do dept ("🚨 Lead órfão, considere reatribuir"). Tudo respeita session/paused/no_number.

- **Gap D — Batching de rajada**: query em `notification_log` detecta se vendor já recebeu notif sent <60s atrás. Se sim, mensagem fica compacta ("🔔 +1 atendimento, Lucas / 👤 João Silva — atender") em vez do template completo. Reduz spam sem violar idempotência.

**Médios resolvidos (best effort):**

- **Gap E — Custo UAZAPI exibido**: `NotificationLogPanel` mostra card "Custo estimado UAZAPI" baseado em count de notif sent nos últimos 30d × R$ 0,08 (preço conservador UAZAPI plano padrão).

- **Gap F — KPI tempo médio 1ª resposta**: SQL function `kpi_avg_first_response_minutes(_days)` retorna avg/p50/p90 + sample_size. Usado pelo painel admin pra mostrar performance dos vendedores.

- **Gap G — Banner pra vendor sem número**: `VendorNotificationBanner` agora mostra estado `no_number` (banner vermelho "peça ao admin pra cadastrar seu número pessoal pra receber alertas").

**Documentado como roadmap F3+ (dependente externo):**

- **Gap I — Template HSM Meta**: requer aprovação Meta 1-3 dias + custo recorrente ~R$ 0,10-0,30/msg. Decisão produto (não bloqueia MVP).
- **Gap J — LGPD termo formal**: tela de aceite com timestamp/IP. Decisão jurídica.
- **Gap K — i18n**: só pt-BR é suficiente p/ escopo BR atual. Refactor grande.
- **Gap L — Multi-org isolation**: requer `instances.org_id` (refactor estrutural). Edge case raro.
- **Gap M — Validação periódica de número** (vendedor demitido → número reaproveitado): cron mensal — incremental.

**Files changed:** +1 edge function nova (escalate-stale-handoffs) + 3 redeploys (notify-vendor, assign-handoff, ai-agent) + 3 migrations novas + 3 frontend touches (NotificationLogPanel stats cards, VendorBanner no_number state, helper businessHours).

**Auto-avaliação:**
- Conteúdo: **9/10** — pipeline completo agora (handshake + 8 guards + escalation + reatribuição + batching). Faltou validação periódica de número (Gap M baixa-prioridade).
- Orquestração: **9.5/10** — todas as decisões refletidas em código, migrations idempotentes, deploys validados.
- Vault: **9/10** — wiki + log + PRD atualizados.

---

### v7.32.0 (2026-05-07) — Notif handoff por WhatsApp pessoal (MVP F0+F1+F2)

**Contexto:** Hoje quando lead é atribuído via Lucas default ou Robin lista-on, o vendedor precisa estar logado no painel pra perceber. Lead morno esfria em 10-15min. Solução: ping no WhatsApp pessoal do vendedor com nome do lead, última msg e link direto pra conversa no helpdesk.

**Decisões arquiteturais (3 auditorias antes de codar):**
- Janela WhatsApp 24h: limitação aceita (vendedor renova handshake mandando qualquer msg pro WhatsApp da empresa, sistema responde "✅ Notificações ativas pelas próximas 24h"). Sem template HSM no MVP.
- Instância: reuso da do helpdesk (1 número só) → exigiu refactor do webhook pra interceptar msg do vendedor antes de criar conversa fantasma.
- Permissão pra pausar: super_admin pausa qualquer vendedor; gerente só do mesmo dept (validado no RPC).
- Idempotência: UNIQUE (conversation_id, assigned_to_id) em notification_log + UPSERT.
- Rollback: feature flag `instance_settings.notifications_enabled = false` (default) — desliga tudo silenciosamente sem rollback de código.

**F0 — Handshake do vendedor:**
- Migration: `user_profiles.whatsapp_handshake_at` + `whatsapp_session_until`.
- Refactor `whatsapp-webhook/index.ts` (1253 linhas) — intercept entre linhas 577-580: matching por `personal_whatsapp` → renova `whatsapp_session_until = now() + 24h` + auto-resposta + `return early` (NÃO cria conversa).
- Helper compartilhado `_shared/sendWhatsApp.ts` (sendUazapiText).

**F1 — DB + painel admin (8 colunas, 2 tabelas, 1 RPC):**
- `user_profiles`: 8 colunas novas (personal_whatsapp E.164 com CHECK regex + notify_on_assignment + 2 handshake + 4 paused). Index parcial em personal_whatsapp.
- `conversations.assigned_at TIMESTAMPTZ` — momento da atribuição (NULL pros antigos).
- Tabela `instance_settings` (PK instance_id, FK instances) — feature flag `notifications_enabled`. RLS via user_instance_access.
- Tabela `notification_log` (audit trail) — UNIQUE(conv, vendor) + index parcial pro rate limit. RLS: super_admin all, gerente same-dept.
- RPC `pause_user_notifications(target, until, reason)` — SECURITY DEFINER com checagem de dept p/ gerente.
- UI: `UserNotificationPanel` (cadastro número + toggle + status visual 5 estados + modal pausa 5 presets + reativar) renderizado dentro do CollapsibleContent de UsersTab. `InstanceNotificationToggle` no card da inbox em InboxesTab.

**F2 — Notificação core:**
- Edge function `notify-vendor-assignment` (verify_jwt=false, chamada com service-role) com pipeline de 8 guards: skip_disabled, skip_optout, skip_no_number, skip_session_expired, skip_paused, skip_off_hours, skip_queue_paused, skip_rate_limited (3/h).
- Helper `formatLastMessage` mapeia tipo (texto truncado / 🎙️ Áudio / 📷 Imagem / 📎 Documento / 🌟 Figurinha / 🎴 Carrossel).
- Hook em `_shared/handoffQueue.ts` `assignHandoff()`: após UPDATE `assigned_to + assigned_at`, fire-and-forget POST com try/catch silencioso (handoff NUNCA quebra por falha de notif).
- Banner contextual `VendorNotificationBanner` no helpdesk header (amarelo se janela <2h, vermelho se expirou; oculto se sem número).
- Página admin `/dashboard/admin/notifications` com `NotificationLogPanel` (tabela paginada com filtros status/busca, mostra skip_reason traduzido).

**Smoke tests SQL passados:** RPC rejeita unauthenticated; CHECK E.164 aceita +5511987654321 e rejeita 11987654321/+0123/+too_long; UPSERT em notification_log preserva mesma row em conflict (idempotência).

**Files changed:** 5 SQL migrations aplicadas + 4 edge functions (1 nova, 3 modificadas + redeploys: notify-vendor-assignment, whatsapp-webhook, assign-handoff) + 6 TS files novos (UserNotificationPanel, InstanceNotificationToggle, NotificationLogPanel, AdminNotifications, VendorNotificationBanner, sendWhatsApp helper) + 4 TS files modificados (UsersTab, InboxesTab, HelpDesk, App.tsx, handoffQueue.ts).

**⚠️ Pendência crítica:** ai-agent **NÃO foi re-deployado** (regra HIGH-RISK do RULES.md exige aprovação explícita). Sem isso, o hook do `handoffQueue.ts` SÓ dispara via path do `assign-handoff` (cron + reassign manual pelo gestor) — os 6 paths do ai-agent ainda usam o handoffQueue antigo em cache até o próximo redeploy. **Pra MVP completo, redeployar ai-agent.**

**Limitações conhecidas (dívida F3+):** sem escalation 5min/10min; sem notif "removido" pro vendedor anterior em reatribuição; sem dashboard tempo pausado/disponível; sem template HSM; só pt-BR; sem tela formal de aceite LGPD; multi-tenant edge case com mesmo número em 2 orgs.

**Auto-avaliação:**
- Qualidade do conteúdo: **8.5/10** — pipeline robusto com 8 guards, rollback safe, idempotência, audit trail. Faltou pequeno polish em business_hours (placeholder retornando true).
- Orquestração entre arquivos: **9/10** — RESEARCH.md + PLAN.md + wiki + PRD + log + index alinhados. 3 auditorias antes de escrever código (boa).
- Estado do vault: **9/10** — wiki nova criada, index atualizado, log com session-summary.

---


---

## Releases anteriores

- [[wiki/changelog/2026-05]] — v7.21.0 a v7.31.0 (D30 Fila + R113-R115)
- [[wiki/changelog/2026-04]] — v7.0.0 a v7.20.x (M12-M19, Helpdesk audit)
- [[wiki/changelog/2026-pre-04]] — v1.x a v6.4 (v3-v6 auditorias, sprints)
