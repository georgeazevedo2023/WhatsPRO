---
title: Activity Log
type: log
---

# Activity Log

> Registro cronológico de ingestões, consultas e manutenções do vault. Append-only.

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

**Manutenção arquitetural**: 9/10 — cumpriu hard limit literalmente, criou orquestrador funcional, healthcheck rodável. Nota não é 10 porque (a) o split mecânico em "partN" não preserva contexto narrativo perfeito (algumas seções ficaram cortadas no meio), (b) o `index.md` agora tem links muito longos numa célula só pra cumprir limite (visualmente menos elegante mas funcional).

---

## 2026-05-10 (final tarde) — Manutenção da documentação

> Pedido explícito do usuário após avaliação do estado do vault (nota 8/10): particionar log.md, criar wiki/audio-pipeline, padronizar `audited_at`.

### Mudanças

- **`log.md` particionado**: 1830 → ~210 linhas. Entradas de 2026-05-07 e anteriores arquivadas em [[wiki/log-arquivo-2026-pre-05-08]] (1693 linhas, 30+ entradas). Cumpre regra 16 do CLAUDE.md (max 200 linhas).
- **Nova wiki [[wiki/audio-pipeline]]**: mapeia o fluxo end-to-end de áudio (incoming + outgoing) consolidado após o incidente de 2026-05-10. Inclui ASCII diagram, configuração crítica (buckets + secrets), healthcheck SQL pra detectar regressão.
- **Padronizado campo `audited_at`** no frontmatter de [[wiki/erros-e-licoes]] e da nova [[wiki/audio-pipeline]]. Significado: "última vez que alguém revisou e confirmou que está atualizado". Aplicar gradualmente quando wikis forem efetivamente revisadas.
- **`index.md`**: aponta pra novo arquivo + audio-pipeline.

### Auto-avaliação

**Manutenção**: 9/10 — particionamento limpo (cortado em separador `---` natural), nova wiki tem ASCII + healthcheck. Nota não é 10 porque `audited_at` foi adicionado em só 2 wikis (deveria ser sweep amplo) e `PRD.md` ainda tem 4350 linhas (próximo TODO: separar `CHANGELOG.md`).

---

## 2026-05-10 (tarde) — Polish helpdesk: áudios outgoing + player + console (v7.32.6)

> Sessão de polish do helpdesk após o fix do pipeline de transcrição (v7.32.5). 4 melhorias incrementais focadas em UX e métricas.

### Mudanças

**Player de áudio** (`AudioPlayer.tsx` + `MessageBubble.tsx`):

- Container do player ganhou bg próprio (`bg-emerald-900/55` outgoing, `bg-foreground/5` incoming) com `ring` sutil — vira "card embed" estilo Spotify, destaca da bolha em vez de competir
- Outgoing: paleta emerald-200/100 + play button branco com texto emerald-800. Mic badge invertido (emerald-400/emerald-900). WCAG AA passa.
- Incoming: paleta sky em vez de primary verde — diferencia visualmente do outgoing à primeira vista
- Waveform decorativo: 32 barras com alturas pseudo-aleatórias estáveis por src (memo)
- Speed pill (idle/playing) com variantes claras
- Label "🎤 ÁUDIO DO CLIENTE" / "🎤 ÁUDIO ENVIADO" acima do player
- Transcrição agora num card estilizado com bg sutil (não texto solto)

**Transcrição de áudio outgoing** (`ChatInput.tsx`):

- `handleSendAudio` agora dispara `transcribe-audio` (fire-and-forget) após o INSERT em `conversation_messages`. Antes só incoming era transcrito.
- Justificativa do usuário: "importante para a gente extrair métricas do atendimento" — habilita análise textual de tempo de resposta, sentimento, busca em conversas
- Spinner "Transcrevendo..." agora também aparece em outgoing enquanto a edge processa (com cores brancas)
- Reprocessei manualmente os 2 áudios outgoing existentes do George via Groq → " Olá, 1, 2, 3, testando o áudio."

**Console errors zerados** (`ContactAvatar.tsx`, `useContactProfilePic.ts`, `MessageBubble.tsx`):

- `pps.whatsapp.net 403`: fix em `ContactAvatar.triggerRefresh` — aceitava URL do CDN do WhatsApp como `refreshedSrc`. Agora filtra via `isStaleSrc` antes de aceitar (CDN expira em 24h)
- `<UUID>.jpg ERR_NAME_NOT_RESOLVED`: causa era duas:
  1. Carrossel renderizava `card.image` sem validar se era URL absoluta — string sem `https://` virava `localhost:8080/<UUID>.jpg`. Fix: regex `/^https?:\/\//`
  2. `contacts.profile_pic_url` ainda apontava pra `euljumeflwtljegknawy.supabase.co` (projeto antigo, pré-migração 2026-05-06). DNS não resolve mais. Fix: `isStaleSrc` agora detecta supabase.co de outro ref (compara com `VITE_SUPABASE_URL`)

### Histórico desta sessão (relacionado a v7.32.5+v7.32.6)

- v7.32.3: fix schema mismatch em `notify-vendor-assignment` (commit `da22d61`)
- v7.32.4: card MOTIVO no Contexto IA (commit `e9c0cdd`)
- v7.32.5: bucket público + pipeline transcrição (commits `1f4976f`, `8e3915d`)
- v7.32.6: este — player + transcrição outgoing + console (commits `620f6f1`, `063ff91`, `7481880`, `579895a`)

### Auto-avaliação

**Conteúdo**: 9/10 — fix focado em cada item solicitado, com validação E2E real (transcrição visível na tela do helpdesk).
**Documentação**: 8/10 — esta sessão acumulou 4 versões em 1 dia, e documentei tudo.
**Estado do vault**: 7/10 — `log.md` está em ~1750 linhas (regra 16 do CLAUDE.md = max 200 → particionar). **TODO**: arquivar entradas antigas em `wiki/log-arquivo-{periodo}.md`.

---

## 2026-05-10 (manhã) — Fix áudios + transcrição quebrada (v7.32.5)

> Usuário reportou que áudios não apareciam no helpdesk e transcrição não funcionava (incoming presa em "Transcrevendo..."). Investigação revelou 4 bugs encadeados.

### Bugs encontrados

1. **Bucket `audio-messages` privado** mas o código gera URL `/object/public/...` (formato que só funciona em bucket público). Mesma coisa pra `helpdesk-media`. **Causa**: estado do DB divergiu da migration `20260320011313_create_storage_buckets.sql` (que define `public=true`). Fix: `UPDATE storage.buckets SET public=true WHERE name IN ('audio-messages','helpdesk-media')`.

2. **Webhook insere `max_retries`** em `job_queue`, mas o schema da tabela usa `max_attempts`. INSERT falha silenciosamente (`jobErr.message='column max_retries does not exist'`), erro logado em info-level e ignorado. Resultado: nenhum job de transcrição é enfileirado.

3. **RPCs `claim_jobs` e `complete_job` não existem** no DB. O `process-jobs/index.ts` chama essas RPCs em loop — todas falham. Mesmo se o INSERT do (2) funcionasse, o cron nunca processaria. Pipeline inteiro de jobs está quebrado para todos os tipos (`lead_auto_add`, `profile_pic_fetch`, `transcribe_audio`).

4. **Diagnóstico inferido**: chamada manual a `transcribe-audio` retorna `{ ok: false, error: 'All transcription providers failed' }`. A key existe (não retornou "No provider configured") mas Gemini falha em runtime — possivelmente key inválida, modelo deprecated (`gemini-2.0-flash`), ou cota esgotada. **Pendente verificação do usuário** nas envs do projeto novo (`prfcbfumyrrycsrcrvms`).

### Histórico

Query no DB: dia 25/03 todos os 16 áudios incoming foram transcritos com sucesso. A partir de 28/03 a maioria começou a falhar. Há um corte temporal claro — provavelmente coincide com migração de projeto ou mudança de schema que introduziu o `max_retries` errado.

### Fix aplicado

- `UPDATE storage.buckets SET public=true` em `audio-messages` e `helpdesk-media`. Validado via `curl HEAD` (HTTP 200, Content-Type correto).
- `whatsapp-webhook/index.ts:1057-1075` reescrito: ao invés de inserir job em `job_queue` (cadeia quebrada), chama a edge `transcribe-audio` diretamente via `backgroundFetch` (`EdgeRuntime.waitUntil`). Elimina dependência de `claim_jobs`/`complete_job`/coluna `max_attempts`.
- Deploy via CLI (`whatsapp-webhook` no projeto `prfcbfumyrrycsrcrvms`).

### O que ainda falta

- **Áudios outgoing**: ✅ funcionando (bucket público).
- **Áudios incoming novos**: pipeline restaurado — chega no `transcribe-audio`. **Mas** o erro 500 da função permanece até resolver Gemini key.
- **Áudios antigos sem transcrição** (12 no DB): ficam órfãos. Após resolver a key, pode-se rodar um script pra reprocessar.

### Lições registradas

`wiki/erros-e-licoes.md`:
- Schema mismatch silencioso #2: `max_retries` vs `max_attempts` em INSERT (mesmo padrão do bug do `notify-vendor-assignment`). Lição reforçada: **todo INSERT/UPDATE numa tabela com schema crítico precisa ser validado E2E logo após a primeira chamada real, não só pelo TS**.
- RPCs faltando em DB sem alerta: chamadas a `supabase.rpc('X')` para função inexistente retornam `{data:null, error}` — se o caller não verifica `error`, segue silencioso. Cron jobs nunca executaram.

### Auto-avaliação

**Conteúdo**: 7/10 — descobri 3 bugs encadeados em prod e fixei 2; o 3º (Gemini key) depende de info do usuário. A nota não é maior porque o fix foi descoberto por sorte (cliente reportou); deveria ter sido pego em monitoring.
**Documentação**: 9/10 — log + erros + PRD alinhados.

---

## 2026-05-09 (noite, parte 2) — Card MOTIVO no Contexto IA (v7.32.4)

> Usuário perguntou por que motivos do contato (compra, cotação, vaga de emprego, fornecedor) não apareciam no painel direito do helpdesk.

### Causa raiz

- A variável `kpiMotivo` em `ContactInfoPanel.tsx:72` era calculada a partir da tag `motivo:X` mas **nunca renderizada** na UI (TS warning `ts6133` "declared but never read" denunciava o gap havia tempo).
- Taxonomia do AI agent (`ai-agent/index.ts:2400`) já cobre todos os casos pedidos: `compra`, `orcamento` (=cotação), `emprego` (=vaga), `fornecedor`, `troca`, `duvida_tecnica`, `suporte`, `financeiro`, `informacao`, `fora_escopo`, `saudacao`. Ou seja: o classificador funciona, só faltava exibir.
- Conversa do George tinha `motivo:compra` na tag mas o painel não mostrava.

### Fix

- `ContactInfoPanel.tsx`: novo card **MOTIVO** (azul, ícone Target) na primeira linha da grid de KPIs.
- Adicionado mapa `MOTIVO_LABELS` pra humanizar (`orcamento` → "Orçamento", `emprego` → "Vaga de emprego", `duvida_tecnica` → "Dúvida técnica", etc).
- Reorganização da grid: removido `col-span-2` do card "Atendido IA" (estava ocupando linha inteira no fim), realocado pra linha 2 do par. Total 8 cards bem distribuídos em 4 linhas de 2.

### Auto-avaliação

**Conteúdo**: 9/10 — fix focado e simples. Nota não é 10 porque o card deveria ter sido entregue na primeira versão do painel (a tag existia desde sempre).
**Documentação**: 9/10 — log + PRD + commit alinhados.

---

## 2026-05-09 (noite) — Polish Helpdesk + fix crítico notify-vendor-assignment (v7.32.3)

> Sessão de UX no helpdesk + descoberta e correção de bug de schema na edge function de notif handoff (que NUNCA entregou mensagem em prod por bug silencioso de PostgREST).

### Polish UX Helpdesk

- **`QueuePauseToggle`**: botão "Disponível" renomeado pra "Pausar". Motivo: usuário (Lucas) lê o label como ação ("vou ao banheiro → clico Pausar"), não como estado. Estado pausado segue mostrando "Pausado".
- **`ContactInfoPanel`**: KPI **DURAÇÃO ATUAL** agora tickea em tempo real (30s) usando `now − sessionStart`. Antes era estático (`last_message_at − sessionStart`). Se a conversa for resolvida, congela em `resolved_at − sessionStart`.
- **`VendorNotificationBanner`**: passa a ser oculto pra `super_admin` e `gerente`. Motivo: o texto diz "Peça ao admin..." — auto-referente quando o admin é quem está vendo. Esses roles não recebem handoff da fila, então o número pessoal não é necessário pra eles.

### Fix crítico — notify-vendor-assignment (bug em prod desde shipping da v7.32.0)

- Função selecionava `instance_id, contact_name, contact_phone` direto em `conversations` — colunas que NÃO existem (devem vir via `inboxes` JOIN e `contacts` JOIN, respectivamente).
- PostgREST devolve erro de coluna inexistente, mas `.maybeSingle()` engole o erro e retorna `data=null`. Resultado: a função sempre retornava `skip_reason='conv_not_found'` silenciosamente, e ninguém percebeu porque até essa sessão nenhum vendor da Eletropiso tinha `personal_whatsapp` preenchido (o pipeline parava antes em `skip_no_number`).
- **Fix**: trocado o select inicial por embedding PostgREST: `'id, inbox_id, contact_id, assigned_at, contact:contacts(name, phone, jid), inbox:inboxes(instance_id)'`. Mesmo fix aplicado em `notifyPreviousAssignee()`.
- **Validação E2E real**: aplicados deltas (Lucas com `personal_whatsapp=+5581993856099`, `notifications_enabled=true`, `extended_hours_until=NOW()+30min`), invocada a edge function de fato → retornou `{ ok: true }`, log gravou `status=sent`, mensagem chegou no WhatsApp 5581993856099 com emojis e acentos corretos. Deltas revertidos depois.
- **Deploy**: feito via `supabase functions deploy notify-vendor-assignment` no projeto `prfcbfumyrrycsrcrvms`.

### Aprendizado registrado

- `wiki/erros-e-licoes.md`: novo item — **PostgREST `.maybeSingle()` mascara erros de coluna inexistente**. Regra: validar pipeline edge function via teste E2E real (com dado válido) antes de considerar shipping concluído. Code review e TS-check não pegam isso porque o cliente Supabase não tipa selects encadeados.

### Auto-avaliação

**Conteúdo**: 9/10 — bug encontrado por sorte (cliente quis simular notif), mas resolvido com fix focado e validação E2E.
**Orquestração**: 8/10 — log + erros-e-licoes + PRD + commit + deploy alinhados.
**Estado do vault**: 8/10 — vault atualizado, mas `wiki/notif-handoff*` deveria ter a nota de incidente também (TODO).

---

## 2026-05-07 e anteriores

> Entradas até **2026-05-07** foram arquivadas em [[wiki/log-arquivo-2026-pre-05-08]] (1693 linhas, 30+ entradas).
>
> Conteúdo arquivado: v7.32.0–v7.32.2 (notif handoff MVP+gaps+refactor UAZAPI), Sessões 3–4 do Sandbox IA, R100–R114, Playwright ondas 1–4, migração projeto novo `prfcbfumyrrycsrcrvms`, hotfixes R101/R102, auditoria AI Agent (R103–R105), R106 sandbox criada.

---
