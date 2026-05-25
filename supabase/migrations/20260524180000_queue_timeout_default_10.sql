-- 2026-05-24 (pedido do dono): tempo padrão da fila round-robin sobe de 5 → 10 min.
-- Paridade entre 3 lugares: (1) este default de coluna, (2) TIMEOUT_DEFAULT na UI
-- QueueConfig.tsx, (3) valor já aplicado no dept Vendas do EletropisoV2.
-- Afeta apenas NOVOS departamentos criados sem valor explícito; os existentes
-- mantêm seu valor configurado.
alter table public.departments
  alter column queue_mode_timeout_minutes set default 10;
