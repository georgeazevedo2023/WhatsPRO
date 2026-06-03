-- Avatares de instâncias em Storage (resolve foto de perfil expirada no CDN)
--
-- Contexto: instances.profile_pic_url guarda a URL assinada do CDN do
-- WhatsApp (pps.whatsapp.net/...?oe=<expira>). Esse valor só é gravado uma
-- vez, no sync da instância, e o `oe=` expira em ~semanas — depois disso o
-- <img> falha (tela Disparador / Instâncias com avatar quebrado).
--
-- Solução: espelhar o que já fazemos para contatos (ver
-- 20260430000002_contact_avatars_storage.sql + _shared/avatarStorage.ts):
-- baixar o binário via GET /instance/status → upload no bucket público
-- `contact-avatars` (reusado; paths com prefixo `instance-<id>` não colidem
-- com `<contact_uuid>.jpg`) → gravar a URL pública estável aqui.

ALTER TABLE public.instances
  ADD COLUMN IF NOT EXISTS profile_pic_storage_path text,
  ADD COLUMN IF NOT EXISTS profile_pic_synced_at timestamptz;

COMMENT ON COLUMN public.instances.profile_pic_storage_path IS
  'Path no bucket contact-avatars (ex: instance-<instance_id>.jpg). NULL se sync ainda não rodou ou instância sem foto.';
COMMENT ON COLUMN public.instances.profile_pic_synced_at IS
  'Última vez que avatarStorage.syncInstanceAvatar() rodou para esta instância. Usado para throttle do refresh.';

-- Bucket contact-avatars já existe (20260430000002) com policy service_role
-- FOR ALL e SELECT público — cobre os objetos instance-*.jpg sem mudança.
