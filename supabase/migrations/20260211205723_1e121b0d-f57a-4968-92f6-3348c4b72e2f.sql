
-- 1. Enum para roles de inbox
CREATE TYPE public.inbox_role AS ENUM ('admin', 'gestor', 'agente', 'vendedor');

-- 2. Tabela inboxes
CREATE TABLE public.inboxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id text NOT NULL REFERENCES public.instances(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.inboxes ENABLE ROW LEVEL SECURITY;

-- 3. Tabela inbox_users
CREATE TABLE public.inbox_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inbox_id uuid NOT NULL REFERENCES public.inboxes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role inbox_role NOT NULL DEFAULT 'agente',
  is_available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(inbox_id, user_id)
);
ALTER TABLE public.inbox_users ENABLE ROW LEVEL SECURITY;

-- 4. Helper functions (tables exist now)
CREATE OR REPLACE FUNCTION public.has_inbox_access(_user_id uuid, _inbox_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM inbox_users
    WHERE user_id = _user_id AND inbox_id = _inbox_id
  )
$$;

CREATE OR REPLACE FUNCTION public.get_inbox_role(_user_id uuid, _inbox_id uuid)
RETURNS inbox_role
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM inbox_users
  WHERE user_id = _user_id AND inbox_id = _inbox_id
  LIMIT 1
$$;

-- 5. RLS for inboxes
CREATE POLICY "Super admins can manage all inboxes" ON public.inboxes FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "Users can view their inboxes" ON public.inboxes FOR SELECT USING (has_inbox_access(auth.uid(), id));

-- 6. RLS for inbox_users
CREATE POLICY "Super admins can manage all inbox_users" ON public.inbox_users FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "Users can view own inbox memberships" ON public.inbox_users FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Inbox admins and gestors can manage members" ON public.inbox_users FOR ALL USING (
  get_inbox_role(auth.uid(), inbox_id) IN ('admin', 'gestor')
);

-- 7. Tabela contacts
CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  jid text NOT NULL UNIQUE,
  name text,
  profile_pic_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage all contacts" ON public.contacts FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "Authenticated users can view contacts" ON public.contacts FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert contacts" ON public.contacts FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 8. Tabela conversations
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inbox_id uuid NOT NULL REFERENCES public.inboxes(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'aberta',
  priority text NOT NULL DEFAULT 'media',
  assigned_to uuid,
  is_read boolean NOT NULL DEFAULT false,
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage all conversations" ON public.conversations FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "Inbox users can view conversations" ON public.conversations FOR SELECT USING (has_inbox_access(auth.uid(), inbox_id));
CREATE POLICY "Inbox users can update conversations" ON public.conversations FOR UPDATE USING (has_inbox_access(auth.uid(), inbox_id));
CREATE POLICY "Inbox users can insert conversations" ON public.conversations FOR INSERT WITH CHECK (has_inbox_access(auth.uid(), inbox_id));

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9. Tabela conversation_messages
CREATE TABLE public.conversation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  direction text NOT NULL DEFAULT 'incoming',
  content text,
  media_type text NOT NULL DEFAULT 'text',
  media_url text,
  sender_id uuid,
  external_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage all messages" ON public.conversation_messages FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "Inbox users can view messages" ON public.conversation_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM conversations c WHERE c.id = conversation_messages.conversation_id AND has_inbox_access(auth.uid(), c.inbox_id))
);
CREATE POLICY "Inbox users can insert messages" ON public.conversation_messages FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM conversations c WHERE c.id = conversation_messages.conversation_id AND has_inbox_access(auth.uid(), c.inbox_id))
);

-- 10. Tabela labels
CREATE TABLE public.labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',
  inbox_id uuid NOT NULL REFERENCES public.inboxes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage all labels" ON public.labels FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "Inbox users can view labels" ON public.labels FOR SELECT USING (has_inbox_access(auth.uid(), inbox_id));
CREATE POLICY "Inbox admins can manage labels" ON public.labels FOR ALL USING (
  get_inbox_role(auth.uid(), inbox_id) IN ('admin', 'gestor')
);

-- 11. Tabela conversation_labels
CREATE TABLE public.conversation_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  label_id uuid NOT NULL REFERENCES public.labels(id) ON DELETE CASCADE,
  UNIQUE(conversation_id, label_id)
);
ALTER TABLE public.conversation_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage all conversation_labels" ON public.conversation_labels FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "Inbox users can view conversation_labels" ON public.conversation_labels FOR SELECT USING (
  EXISTS (SELECT 1 FROM conversations c WHERE c.id = conversation_labels.conversation_id AND has_inbox_access(auth.uid(), c.inbox_id))
);
CREATE POLICY "Inbox users can manage conversation_labels" ON public.conversation_labels FOR ALL USING (
  EXISTS (SELECT 1 FROM conversations c WHERE c.id = conversation_labels.conversation_id AND has_inbox_access(auth.uid(), c.inbox_id))
);

-- 12. Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_messages;
