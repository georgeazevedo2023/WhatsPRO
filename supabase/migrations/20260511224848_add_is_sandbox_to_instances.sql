-- Sandbox/produção: marca instância de teste pra esconder do dashboard do gestor
ALTER TABLE public.instances ADD COLUMN IF NOT EXISTS is_sandbox boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.instances.is_sandbox IS 'Instância de testes/sandbox — escondida do dashboard do gestor por padrão';

CREATE INDEX IF NOT EXISTS idx_instances_is_sandbox ON public.instances(is_sandbox) WHERE is_sandbox = true;

-- Marca Sandbox IA como sandbox
UPDATE public.instances SET is_sandbox = true WHERE id = 'rb84e079eeab167';
