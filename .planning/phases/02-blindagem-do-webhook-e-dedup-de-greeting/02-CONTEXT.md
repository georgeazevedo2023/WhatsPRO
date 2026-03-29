# Phase 2: Blindagem do Webhook e Dedup de Greeting — Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Hardening de backend para eliminar race conditions e garantir confiabilidade em operações críticas:
- Dedup atômico de greeting (fallback quando RPC falha)
- Retry de transcrição de áudio via job_queue
- Contador atômico de mensagens do lead
- Migração de `mergeTags()` para shared
- Padronização de error responses usando helper existente

Escopo: `supabase/functions/whatsapp-webhook/index.ts`, `supabase/functions/ai-agent/index.ts`, `supabase/functions/_shared/agentHelpers.ts`

Sem mudanças de UI. Sem novos endpoints públicos.

</domain>

<decisions>
## Implementation Decisions

### Área 2 — Retry de transcrição de áudio

- **D-01:** Usar `job_queue` como mecanismo **primário** (não fallback). O webhook insere um job em vez de chamar `transcribe-audio` diretamente.
- **D-02:** `process-jobs` executa o job chamando `transcribe-audio` via HTTP (que já tem internamente Gemini → Groq chain).
- **D-03:** `max_retries = 1` para jobs de transcrição. Se falhar na 1ª tentativa, process-jobs tenta 1 vez mais.
- **D-04:** Se todas as tentativas falharem, job marcado como `failed` — apenas log, sem fallback adicional. A chain Gemini → Groq dentro de `transcribe-audio` já cobre falhas de provider.
- **D-05:** Tipo do job: `transcribe_audio`. Payload: `{ messageId, audioUrl, mimeType, conversationId }` (mesmos campos do call atual).

### Área 3 — Contador atômico de mensagens

- **D-06:** Adicionar coluna `lead_msg_count INTEGER NOT NULL DEFAULT 0` na tabela `conversations` via nova migration.
- **D-07:** Operação atômica: `UPDATE conversations SET lead_msg_count = lead_msg_count + 1 RETURNING lead_msg_count` em vez de `SELECT COUNT(*) ...` separado.
- **D-08:** Resetar `lead_msg_count = 0` quando "clear context" é acionado (ação `ia_cleared`). Consistente com a lógica de sessão atual.
- **D-09:** O check de limite continua usando `agent.max_lead_messages || 8`. A lógica de `sessionStartDt` via tag `ia_cleared:TIMESTAMP` é substituída pelo reset direto do contador.

### Área 1 — Fallback do greeting dedup (Claude's Discretion)

Não discutido pelo usuário. Abordagem conservadora:
- Se `try_insert_greeting` lançar erro (DB error, timeout): **pular greeting silenciosamente** (log + return early).
- Evita duplicatas em cenários de falha. Lead perde o greeting em caso de erro de DB, o que é preferível a receber greeting duplicado.

### Tarefas de refatoração (sem decisão necessária)

- **D-10:** Mover `mergeTags()` de `ai-agent/index.ts:164` para `_shared/agentHelpers.ts` e exportar. Atualizar todos os 5 usos em ai-agent para importar do shared.
- **D-11:** `unauthorizedResponse()` **já existe** em `_shared/auth.ts:81`. Atualizar `whatsapp-webhook/index.ts:95` e `ai-agent/index.ts:190` para importar e usar o helper em vez de inline Response.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Arquivos de escopo direto
- `supabase/functions/whatsapp-webhook/index.ts` — webhook principal (audio transcription trigger, auth inline)
- `supabase/functions/ai-agent/index.ts` — ai-agent (greeting dedup, lead counter, mergeTags, auth inline)
- `supabase/functions/_shared/agentHelpers.ts` — shared helpers (destino de mergeTags)
- `supabase/functions/_shared/auth.ts` — unauthorizedResponse() já existe aqui (linha 81)

### Infraestrutura de job_queue
- `supabase/functions/process-jobs/index.ts` — worker existente com SKIP LOCKED; adicionar handler para `transcribe_audio`
- `supabase/functions/transcribe-audio/index.ts` — função atual (tem Gemini→Groq chain internamente); não mudar lógica interna, só o chamador

### Schema
- `supabase/migrations/` — nova migration para `lead_msg_count` em `conversations`

### Padrões existentes
- `supabase/functions/_shared/constants.ts` — STATUS_IA constants
- `supabase/functions/_shared/fetchWithTimeout.ts` — helper de timeout (usado no transcribe atual)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `unauthorizedResponse()` em `_shared/auth.ts:81` — já pronto, só importar
- `transcribeWithGemini()` + `transcribeWithGroq()` em `transcribe-audio/index.ts` — chain já implementada
- job_queue table + process-jobs worker — infraestrutura de retry já existente

### Established Patterns
- job_queue jobs: `{ type: string, payload: Json, status: 'pending'|'processing'|'done'|'failed', retries: int, max_retries: int }`
- process-jobs usa `claim_jobs(FOR UPDATE SKIP LOCKED)` — não alterar o mecanismo de claim
- Tags no formato `chave:valor` (ex: `ia_cleared:TIMESTAMP`) — `mergeTags()` mantém só último valor por chave

### Integration Points
- Webhook → job_queue: substituir bloco de `fetchWithTimeout(transcribe-audio)` por `supabase.from('job_queue').insert(...)`
- ai-agent → conversations: trocar SELECT COUNT + check por UPDATE RETURNING + check
- agentHelpers: adicionar export de `mergeTags()`, importar em ai-agent

</code_context>

<specifics>
## Specific Ideas

- A chain Gemini → Groq **já existe** dentro de `transcribe-audio`. Não recriar — só mudar o ponto de chamada (webhook → job_queue → process-jobs → transcribe-audio).
- `lead_msg_count` reseta junto com `ia_cleared` — update atômico: `UPDATE conversations SET lead_msg_count = 0, ... WHERE id = conversation_id` na ação de clear context.
- `mergeTags()` deve ser `export function` em agentHelpers.ts (não default export).

</specifics>

<deferred>
## Deferred Ideas

None — discussão se manteve dentro do escopo da fase.

</deferred>

---

*Phase: 02-blindagem-do-webhook-e-dedup-de-greeting*
*Context gathered: 2026-03-29 via /gsd:discuss-phase 2*
