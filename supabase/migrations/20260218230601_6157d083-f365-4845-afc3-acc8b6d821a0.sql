
-- MIGRAÇÃO 1: Apenas adicionar o valor 'gerente' ao enum (precisa de commit isolado)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'gerente';
