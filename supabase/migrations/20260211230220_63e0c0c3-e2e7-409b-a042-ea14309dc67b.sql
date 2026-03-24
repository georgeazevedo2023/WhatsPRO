
-- 1. Habilitar REPLICA IDENTITY FULL para Realtime funcionar com RLS
ALTER TABLE conversation_messages REPLICA IDENTITY FULL;
ALTER TABLE conversations REPLICA IDENTITY FULL;

-- 2. Limpar mensagens duplicadas (manter a com external_id mais curto)
DELETE FROM conversation_messages a
USING conversation_messages b
WHERE a.id > b.id
  AND a.content IS NOT NULL
  AND b.content IS NOT NULL
  AND a.content = b.content
  AND a.conversation_id = b.conversation_id
  AND a.direction = b.direction
  AND a.external_id IS NOT NULL
  AND b.external_id IS NOT NULL
  AND a.external_id <> b.external_id
  AND (
    a.external_id LIKE '%:' || b.external_id
    OR b.external_id LIKE '%:' || a.external_id
  );
