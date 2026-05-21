-- D34 (2026-05-17) — Reabertura de conversa resolvida em janela 60d
--
-- ARQUIVO RETROATIVO (Sprint A 2026-05-21):
-- A coluna conversations.resolved_at + index idx_conversations_contact_resolved_at
-- foram criados no DB de prod via MCP apply_migration na sessão 2026-05-17
-- mas NÃO foram committados ao repo supabase/migrations/.
--
-- Este arquivo restaura consistência supabase db reset / dev local. Todas as
-- operações são idempotentes (IF NOT EXISTS).

-- Coluna principal: timestamp da resolução (setada pelo TicketResolutionDrawer ao Finalizar)
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

-- Backfill: usar updated_at como aproximação histórica
UPDATE public.conversations
SET resolved_at = updated_at
WHERE status = 'resolvida' AND resolved_at IS NULL;

-- Index parcial para query de reabertura (shouldReopenConversation)
-- Procura "última conv resolvida do mesmo contato dentro de 60d"
CREATE INDEX IF NOT EXISTS idx_conversations_contact_resolved_at
ON public.conversations (contact_id, resolved_at DESC)
WHERE status = 'resolvida';

COMMENT ON COLUMN public.conversations.resolved_at IS
'D34: timestamp da resolução. Usado pela lógica shouldReopenConversation (60d janela) em _shared/conversationReopen.ts.';
