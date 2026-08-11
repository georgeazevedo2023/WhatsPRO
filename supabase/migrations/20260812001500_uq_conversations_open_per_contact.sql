-- Trava de raiz do bug das conversas duplicadas (2026-08-11): NUNCA mais de
-- uma conversa aberta/pendente por contato+inbox. O whatsapp-webhook trata o
-- 23505 do perdedor da corrida re-selecionando a vencedora.
-- Contexto: lookup com .maybeSingle() sem .limit(1) errava com 2+ abertas, o
-- erro era engolido e cada mensagem criava conversa nova (93 duplicadas em 8
-- contatos; limpeza executada antes desta migration — dedup_fechada:2026-08-11).
CREATE UNIQUE INDEX IF NOT EXISTS uq_conversations_open_per_contact
  ON public.conversations (inbox_id, contact_id)
  WHERE status IN ('aberta', 'pendente');
