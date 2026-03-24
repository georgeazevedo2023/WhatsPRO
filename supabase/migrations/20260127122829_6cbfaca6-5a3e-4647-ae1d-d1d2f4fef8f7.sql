-- Adicionar coluna random_delay para controle de intervalo anti-bloqueio em mensagens agendadas
ALTER TABLE public.scheduled_messages 
ADD COLUMN random_delay TEXT CHECK (random_delay IN ('none', '5-10', '10-20')) DEFAULT 'none';