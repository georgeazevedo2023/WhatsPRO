---
title: Pipeline de Áudio — Helpdesk
tags: [helpdesk, audio, transcricao, groq, uazapi, pipeline]
sources: [supabase/functions/whatsapp-webhook, supabase/functions/transcribe-audio, src/components/helpdesk/ChatInput.tsx, src/components/helpdesk/AudioPlayer.tsx, src/components/helpdesk/MessageBubble.tsx]
audited_at: 2026-05-10
updated: 2026-05-10
---

# Pipeline de Áudio — Helpdesk

> Mapeamento end-to-end do fluxo de áudios incoming (do lead) e outgoing (do atendente). Criado depois do incidente de 2026-05-10 onde 3 bugs encadeados (bucket privado + schema mismatch `max_retries`/`max_attempts` + RPCs ausentes) deixaram a transcrição quebrada por ~6 semanas sem ninguém ver.

---

## Visão geral

```
┌──────────────┐                ┌─────────────────────────┐
│  WhatsApp    │  webhook       │  whatsapp-webhook       │
│  do lead     │ ─────────────→ │  (edge function)        │
└──────────────┘                └────────┬────────────────┘
                                         │ INSERT
                                         ▼
                                ┌─────────────────────────┐
                                │  conversation_messages  │
                                │  (media_type='audio')   │
                                └────────┬────────────────┘
                                         │ backgroundFetch
                                         ▼
                                ┌─────────────────────────┐    Groq Whisper-large-v3
                                │  transcribe-audio       │ ─→ (primary)
                                │  (edge function)        │    Gemini 2.0-flash
                                │                         │    (fallback)
                                └────────┬────────────────┘
                                         │ UPDATE transcription
                                         ▼
                                ┌─────────────────────────┐
                                │  Realtime broadcast     │ → AudioPlayer + transcrição
                                │  (helpdesk-realtime)    │   visíveis no helpdesk
                                └─────────────────────────┘
```

---

## Fluxo INCOMING (lead → empresa)

### 1. Lead grava áudio no WhatsApp

UAZAPI recebe e dispara webhook pra `https://prfcbfumyrrycsrcrvms.supabase.co/functions/v1/whatsapp-webhook`.

### 2. `whatsapp-webhook` processa

**Arquivo:** `supabase/functions/whatsapp-webhook/index.ts:1057-1075`

- INSERT em `conversation_messages` com `media_type='audio'`, `direction='incoming'`, `media_url` apontando pra `https://wsmart.uazapi.com/files/<hash>.mp3` (URL direta da UAZAPI — **expira em ~30 dias**)
- Imediatamente após o INSERT, dispara `transcribe-audio` via `backgroundFetch` (`EdgeRuntime.waitUntil`):

```ts
backgroundFetch(fetch(`${SUPABASE_URL}/functions/v1/transcribe-audio`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${SVC_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ messageId, audioUrl, mimeType, conversationId }),
}))
```

**Por que NÃO fila:** o sistema antigo usava `job_queue` + RPCs `claim_jobs`/`complete_job`. Estavam quebrados há semanas (RPCs nunca foram criadas + INSERT inseria `max_retries` em coluna inexistente). Solução foi eliminar a fila pra esse caso específico — chamada direta é mais simples e suficiente porque transcrição não tem requisito de retry/backoff.

### 3. `transcribe-audio` transcreve

**Arquivo:** `supabase/functions/transcribe-audio/index.ts`

- Provider chain: **Groq Whisper-large-v3** (primary) → **Gemini 2.0-flash** (fallback)
- Groq: download via `fetchWithTimeout` → POST multipart pra `https://api.groq.com/openai/v1/audio/transcriptions`
- Gemini: download → base64 inline → POST pra `generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`
- UPDATE `conversation_messages.transcription` quando obtém texto
- Broadcast via `realtime/v1/api/broadcast` topic `helpdesk-realtime` event `transcription-updated`
- Trigger `ai-agent` (se `isService`) — mensagem virou texto, IA pode processar

### 4. Helpdesk renderiza

**Arquivos:** `src/components/helpdesk/MessageBubble.tsx:256-274`, `src/components/helpdesk/AudioPlayer.tsx`

- `AudioPlayer` com paleta **sky** (azul, `bg-sky-500`) — diferencia visualmente do outgoing verde
- Container do player com `bg-foreground/5` + ring sutil (card embed)
- Label "🎤 ÁUDIO DO CLIENTE" acima
- Transcrição num card cinza-suave abaixo
- Enquanto não chega, spinner "Transcrevendo..."

---

## Fluxo OUTGOING (atendente → lead)

### 1. Atendente grava no helpdesk

**Arquivo:** `src/components/helpdesk/ChatInput.tsx:212+`

- `MediaRecorder` API → `Blob` (MIME real `audio/webm`, salvo com extensão `.ogg` por compat WhatsApp)
- Upload pra bucket `audio-messages` (Supabase Storage)
- URL pública: `https://prfcbfumyrrycsrcrvms.supabase.co/storage/v1/object/public/audio-messages/<conv_id>/<timestamp>.ogg`

### 2. Envia pro WhatsApp via UAZAPI

- `uazapiProxy({ action: 'send-audio', audio: base64 })`

### 3. INSERT em `conversation_messages`

- `direction='outgoing'`, `media_type='audio'`, `media_url=<storage_url>`

### 4. Dispara transcrição (fire-and-forget)

```ts
supabase.functions.invoke('transcribe-audio', {
  body: { messageId, audioUrl, mimeType, conversationId },
}).catch(...)
```

**Por que transcrever outgoing:** habilita métricas de atendimento — tempo médio de resposta em texto, análise de sentimento, busca textual em conversas, qualidade do atendente.

### 5. Helpdesk renderiza

- Player com paleta **emerald** (verde) — combina com bolha verde da mensagem outgoing
- Container `bg-emerald-900/55` cria contraste forte com a bolha verde clara
- Play button branco com texto `emerald-800`
- Label "🎤 ÁUDIO ENVIADO"

---

## Configuração crítica

### Buckets Storage

| Bucket | Public | Por que |
|---|---|---|
| `audio-messages` | **true** | URLs `/object/public/...` salvas no DB; player precisa baixar sem auth |
| `helpdesk-media` | **true** | Mesma lógica pra imagens, vídeos, docs |

> **Histórico de bug**: ambos foram para `public=false` em algum momento, quebrando todos os medias. Migration original (`20260320011313_create_storage_buckets.sql`) define `public=true`. Se voltar a quebrar: `UPDATE storage.buckets SET public=true WHERE name IN ('audio-messages','helpdesk-media')`.

### Secrets (Supabase Edge Functions)

| Secret | Onde usado | Como configurar |
|---|---|---|
| `GROQ_API_KEY` | `transcribe-audio` (provider primary) | `npx supabase secrets set GROQ_API_KEY=gsk_...` |
| `GEMINI_API_KEY` (ou `GOOGLE_AI_API_KEY`) | `transcribe-audio` (fallback) | Mesma forma |
| `SUPABASE_SERVICE_ROLE_KEY` | webhook → transcribe-audio | Auto-injetado |

> **Diagnóstico**: se `transcribe-audio` retorna `{ ok: false, error: 'No transcription provider configured' }` → nenhuma key está setada. Se retorna `'All transcription providers failed'` → keys existem mas falham em runtime (modelo deprecated, cota, key inválida).

---

## Anti-bugs (lições registradas)

Ver `wiki/erros-e-licoes.md`:
- Schema mismatch silencioso (`max_retries` vs `max_attempts`)
- PostgREST `.maybeSingle()` mascara erro de coluna inexistente
- URLs Supabase de outro projeto (legacy migração) → ERR_NAME_NOT_RESOLVED

## Healthcheck rápido

```sql
-- 1. Áudios incoming sem transcrição na última hora?
SELECT count(*) FROM conversation_messages
WHERE media_type='audio' AND direction='incoming' AND transcription IS NULL
  AND created_at > NOW() - INTERVAL '1 hour';

-- 2. Bucket está público?
SELECT name, public FROM storage.buckets WHERE name='audio-messages';
-- Esperado: public=true

-- 3. Edge functions deployadas?
-- Via CLI: npx supabase functions list --project-ref prfcbfumyrrycsrcrvms
```

Se (1) > 0 e crescendo: provavelmente Groq key falhou. Verificar via:
```bash
curl -X POST "https://prfcbfumyrrycsrcrvms.supabase.co/functions/v1/transcribe-audio" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"messageId":"...", "audioUrl":"...", "conversationId":"..."}'
```
Resposta `200 { ok:true }` = saudável. `500 { error: 'All ... failed' }` = key/modelo problemático.
