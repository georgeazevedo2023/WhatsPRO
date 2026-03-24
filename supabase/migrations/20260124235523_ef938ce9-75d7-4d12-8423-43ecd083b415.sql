-- Tabela de relacionamento N:N entre usuários e instâncias
CREATE TABLE public.user_instance_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  instance_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, instance_id)
);

-- Índices para performance
CREATE INDEX idx_user_instance_access_user_id ON public.user_instance_access(user_id);
CREATE INDEX idx_user_instance_access_instance_id ON public.user_instance_access(instance_id);

-- Habilitar RLS
ALTER TABLE public.user_instance_access ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para user_instance_access
CREATE POLICY "Super admin can manage all access"
  ON public.user_instance_access
  FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Users can view own access"
  ON public.user_instance_access
  FOR SELECT
  USING (auth.uid() = user_id);

-- Remover políticas antigas da tabela instances
DROP POLICY IF EXISTS "Users can view own instances" ON public.instances;
DROP POLICY IF EXISTS "Users can update own instances" ON public.instances;
DROP POLICY IF EXISTS "Super admin can view all instances" ON public.instances;
DROP POLICY IF EXISTS "Super admin can update all instances" ON public.instances;

-- Novas políticas para instances baseadas em user_instance_access
CREATE POLICY "Users can view assigned instances"
  ON public.instances
  FOR SELECT
  USING (
    is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_instance_access
      WHERE user_instance_access.instance_id = instances.id
      AND user_instance_access.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update assigned instances"
  ON public.instances
  FOR UPDATE
  USING (
    is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_instance_access
      WHERE user_instance_access.instance_id = instances.id
      AND user_instance_access.user_id = auth.uid()
    )
  );