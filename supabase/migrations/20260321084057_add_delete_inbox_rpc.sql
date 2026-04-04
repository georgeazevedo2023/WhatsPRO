
CREATE OR REPLACE FUNCTION public.delete_inbox(_inbox_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only super_admins can delete inboxes
  IF NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas super admins podem excluir caixas de entrada';
  END IF;

  -- Delete the inbox - CASCADE will handle conversations, messages, labels, inbox_users, departments, etc.
  DELETE FROM public.inboxes WHERE id = _inbox_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Caixa de entrada não encontrada';
  END IF;
END;
$$;
;
