-- P1-8: form_sessions e form_submissions tinham 6 FKs com ON DELETE NO ACTION,
-- causando acúmulo silencioso de órfãs quando conversation/contact/form é deletado.
-- Auditoria 2026-05-05 confirmou 0 órfãs hoje.
--
-- Estratégia (mista, ditada pela nullability das colunas):
-- - Colunas NULLable (contact_id em ambas tabelas, session_id no submissions):
--   ON DELETE SET NULL — preserva o registro mesmo se o pai sumir.
-- - Colunas NOT NULL (form_id em ambas, conversation_id em sessions):
--   ON DELETE CASCADE — sem alternativa válida, e semanticamente correto:
--   se um form é deletado, suas sessions/submissions perdem sentido.
--
-- Operacionalmente: admin NUNCA deve deletar forms em prod (deve usar status
-- inactive). Mas se acontecer, CASCADE evita FK violations em retention sweeps.

-- form_sessions
ALTER TABLE public.form_sessions DROP CONSTRAINT IF EXISTS form_sessions_conversation_id_fkey;
ALTER TABLE public.form_sessions ADD CONSTRAINT form_sessions_conversation_id_fkey
  FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;

ALTER TABLE public.form_sessions DROP CONSTRAINT IF EXISTS form_sessions_contact_id_fkey;
ALTER TABLE public.form_sessions ADD CONSTRAINT form_sessions_contact_id_fkey
  FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;

ALTER TABLE public.form_sessions DROP CONSTRAINT IF EXISTS form_sessions_form_id_fkey;
ALTER TABLE public.form_sessions ADD CONSTRAINT form_sessions_form_id_fkey
  FOREIGN KEY (form_id) REFERENCES public.whatsapp_forms(id) ON DELETE CASCADE;

-- form_submissions
ALTER TABLE public.form_submissions DROP CONSTRAINT IF EXISTS form_submissions_contact_id_fkey;
ALTER TABLE public.form_submissions ADD CONSTRAINT form_submissions_contact_id_fkey
  FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;

ALTER TABLE public.form_submissions DROP CONSTRAINT IF EXISTS form_submissions_form_id_fkey;
ALTER TABLE public.form_submissions ADD CONSTRAINT form_submissions_form_id_fkey
  FOREIGN KEY (form_id) REFERENCES public.whatsapp_forms(id) ON DELETE CASCADE;

ALTER TABLE public.form_submissions DROP CONSTRAINT IF EXISTS form_submissions_session_id_fkey;
ALTER TABLE public.form_submissions ADD CONSTRAINT form_submissions_session_id_fkey
  FOREIGN KEY (session_id) REFERENCES public.form_sessions(id) ON DELETE SET NULL;
