-- Avatares de contatos em Storage (resolve 403 do pps.whatsapp.net)
--
-- Contexto: WhatsApp CDN devolve URL assinada que expira em ~24h. Hoje
-- gravamos esse URL direto em contacts.profile_pic_url, gerando GET 403
-- no console quando a foto é renderizada depois de expirar.
--
-- Solução: baixar binário, salvar em Storage (URL pública estável do CDN
-- Supabase) e armazenar o path. profile_pic_url passa a apontar para o
-- nosso domínio.

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS profile_pic_storage_path text,
  ADD COLUMN IF NOT EXISTS profile_pic_synced_at timestamptz;

COMMENT ON COLUMN public.contacts.profile_pic_storage_path IS
  'Path no bucket contact-avatars (ex: {contact_id}.jpg). NULL se sync ainda não rodou ou contato não tem foto.';
COMMENT ON COLUMN public.contacts.profile_pic_synced_at IS
  'Última vez que avatarStorage.syncContactAvatar() rodou para este contato. Usado para refresh periódico.';

-- Bucket público — foto de perfil do WhatsApp já é pública por natureza,
-- e bucket público dispensa signed URLs (cache HTTP nativo do CDN).
-- Tamanho máximo 1 MB, só image/*.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contact-avatars',
  'contact-avatars',
  true,
  1048576, -- 1 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- INSERT/UPDATE/DELETE: só service_role (edge functions). SELECT é
-- liberado pelo bucket público, sem policy explícita.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Service role manages contact-avatars'
  ) THEN
    CREATE POLICY "Service role manages contact-avatars"
      ON storage.objects FOR ALL
      TO service_role
      USING (bucket_id = 'contact-avatars')
      WITH CHECK (bucket_id = 'contact-avatars');
  END IF;
END $$;
