
-- 1. CHECK constraints on utm_campaigns
DO $$ BEGIN
  ALTER TABLE public.utm_campaigns ADD CONSTRAINT chk_utm_status
    CHECK (status IN ('active', 'paused', 'archived'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.utm_campaigns ADD CONSTRAINT chk_campaign_type
    CHECK (campaign_type IN ('venda', 'suporte', 'promocao', 'evento', 'recall', 'fidelizacao'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Missing FKs
DO $$ BEGIN
  ALTER TABLE public.shift_report_configs
    ADD CONSTRAINT fk_shift_instance FOREIGN KEY (instance_id)
    REFERENCES public.instances(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.instance_connection_logs
    ADD CONSTRAINT fk_connection_instance FOREIGN KEY (instance_id)
    REFERENCES public.instances(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
;
