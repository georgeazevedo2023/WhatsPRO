-- Criar tabela para bases de dados de leads
CREATE TABLE public.lead_databases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  leads_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lead_databases ENABLE ROW LEVEL SECURITY;

-- Policy: usuários podem gerenciar suas próprias bases
CREATE POLICY "Users can manage own lead databases" ON public.lead_databases
  FOR ALL USING (auth.uid() = user_id);

-- Super admins podem ver todas as bases
CREATE POLICY "Super admins can view all lead databases" ON public.lead_databases
  FOR SELECT USING (is_super_admin(auth.uid()));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_lead_databases_updated_at
  BEFORE UPDATE ON public.lead_databases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Criar tabela para entradas de leads
CREATE TABLE public.lead_database_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  database_id uuid NOT NULL REFERENCES public.lead_databases(id) ON DELETE CASCADE,
  phone text NOT NULL,
  name text,
  jid text NOT NULL,
  is_verified boolean DEFAULT false,
  verified_name text,
  verification_status text,
  source text DEFAULT 'paste',
  group_name text,
  created_at timestamptz DEFAULT now()
);

-- Index para buscas rápidas
CREATE INDEX idx_lead_entries_database ON public.lead_database_entries(database_id);

-- Enable RLS
ALTER TABLE public.lead_database_entries ENABLE ROW LEVEL SECURITY;

-- Policy: usuários podem gerenciar entradas via ownership da base
CREATE POLICY "Users can manage entries via database ownership" ON public.lead_database_entries
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.lead_databases 
      WHERE lead_databases.id = lead_database_entries.database_id 
      AND lead_databases.user_id = auth.uid()
    )
  );

-- Super admins podem ver todas as entradas
CREATE POLICY "Super admins can view all lead entries" ON public.lead_database_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.lead_databases 
      WHERE lead_databases.id = lead_database_entries.database_id 
      AND is_super_admin(auth.uid())
    )
  );