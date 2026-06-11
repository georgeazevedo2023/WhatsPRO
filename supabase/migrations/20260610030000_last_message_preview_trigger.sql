-- Preview da lista do Helpdesk ficava STALE (caso "Está"/"ta certo" 2026-06-10):
-- conversations.last_message (TEXTO) só era escrito pela IA; webhook (lead +
-- takeover celular) e app confiavam num trigger que só atualizava o TIMESTAMP.
-- O comentário do webhook prometia "last_message_at + last_message + is_read"
-- citando um trigger (update_conversation_on_message_insert) que NUNCA existiu.
-- Agora o trigger real faz os 3 — fonte única pra TODOS os caminhos de escrita.
-- Emojis de mídia espelham src/lib/messagePreview.ts (mediaPreview).
--
-- Backfill one-off executado via SQL em 2026-06-10: 725 conversas com preview
-- congelado recalculadas a partir da última mensagem não-nota.
CREATE OR REPLACE FUNCTION public.update_conversation_last_message_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = NEW.created_at,
      -- private_note não é mensagem da conversa: preserva o preview atual
      last_message = CASE
        WHEN NEW.direction = 'private_note' THEN last_message
        ELSE LEFT(
          COALESCE(
            NULLIF(BTRIM(NEW.content), ''),
            CASE NEW.media_type
              WHEN 'image'    THEN '📷 Foto'
              WHEN 'video'    THEN '🎥 Vídeo'
              WHEN 'audio'    THEN '🎵 Áudio'
              WHEN 'document' THEN '📎 Documento'
              WHEN 'sticker'  THEN '🌟 Figurinha'
              WHEN 'carousel' THEN '🎠 Carrossel'
              WHEN 'poll'     THEN '📊 Enquete'
              WHEN 'contact'  THEN '👤 Contato'
              ELSE NULL
            END,
            last_message
          ), 200)
      END,
      is_read = CASE WHEN NEW.direction = 'incoming' THEN false ELSE is_read END
  WHERE id = NEW.conversation_id
    AND (last_message_at IS NULL OR last_message_at < NEW.created_at);
  RETURN NEW;
END;
$$;
