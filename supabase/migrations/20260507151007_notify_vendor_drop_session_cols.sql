-- =============================================================================
-- v7.32.2 — drop colunas vestigiais (UAZAPI não tem janela 24h)
--
-- Originalmente criadas em 20260507151002 pra rastrear janela WhatsApp 24h
-- (regra da Business API oficial). Como vocês usam UAZAPI (WhatsApp Web),
-- não há janela formal — vendedor não precisa renovar handshake.
-- =============================================================================

ALTER TABLE public.user_profiles
  DROP COLUMN IF EXISTS whatsapp_handshake_at,
  DROP COLUMN IF EXISTS whatsapp_session_until;
