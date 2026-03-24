CREATE POLICY "Inbox users can delete private notes"
ON public.conversation_messages
FOR DELETE
USING (
  direction = 'private_note'
  AND EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = conversation_messages.conversation_id
      AND has_inbox_access(auth.uid(), c.inbox_id)
  )
);