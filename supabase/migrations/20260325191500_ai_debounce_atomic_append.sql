CREATE OR REPLACE FUNCTION public.append_ai_debounce_message(
  p_conversation_id uuid,
  p_instance_id uuid,
  p_message jsonb,
  p_process_after timestamptz,
  p_first_message_at timestamptz DEFAULT now()
)
RETURNS TABLE (
  id uuid,
  messages jsonb,
  process_after timestamptz,
  processed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO public.ai_debounce_queue (
    conversation_id,
    instance_id,
    messages,
    first_message_at,
    process_after,
    processed
  )
  VALUES (
    p_conversation_id,
    p_instance_id,
    jsonb_build_array(p_message),
    COALESCE(p_first_message_at, now()),
    p_process_after,
    false
  )
  ON CONFLICT (conversation_id)
  DO UPDATE SET
    instance_id = EXCLUDED.instance_id,
    messages = CASE
      WHEN public.ai_debounce_queue.processed THEN jsonb_build_array(p_message)
      ELSE COALESCE(public.ai_debounce_queue.messages, '[]'::jsonb) || p_message
    END,
    first_message_at = CASE
      WHEN public.ai_debounce_queue.processed THEN COALESCE(p_first_message_at, now())
      ELSE COALESCE(public.ai_debounce_queue.first_message_at, p_first_message_at, now())
    END,
    process_after = p_process_after,
    processed = false
  RETURNING
    public.ai_debounce_queue.id,
    public.ai_debounce_queue.messages,
    public.ai_debounce_queue.process_after,
    public.ai_debounce_queue.processed;
END;
$$;
