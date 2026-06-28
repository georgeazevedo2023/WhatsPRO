-- Dashboard do Gestor — preview dos cards de Atendimento (v7.100.0)
-- RPC aditiva (read-only, SECURITY INVOKER → RLS aplica) que devolve, por conversa,
-- a ÚLTIMA mensagem do lead (incoming) + o atendente atribuído. Consumida SÓ para a
-- página VISÍVEL dos cards "Sem 1ª resposta", "Sem resposta há +24h" e
-- "Cotações em andamento" (busca preguiçosa → não sobrecarrega o load inicial).
-- Não altera as RPCs existentes que montam as listas leves.

create or replace function public.get_pending_conversation_previews(p_conversation_ids uuid[])
returns table(
  conversation_id uuid,
  lead_message text,
  lead_message_at timestamptz,
  assigned_to uuid
)
language sql
stable
set search_path to 'public'
as $function$
  with last_incoming as (
    select distinct on (cm.conversation_id)
      cm.conversation_id,
      coalesce(
        nullif(cm.content, ''),
        cm.transcription,
        case when cm.media_type <> 'text' then '[' || cm.media_type || ']' else null end
      ) as lead_message,
      cm.created_at as lead_message_at
    from public.conversation_messages cm
    where cm.conversation_id = any(p_conversation_ids)
      and cm.direction = 'incoming'
    order by cm.conversation_id, cm.created_at desc
  )
  select
    c.id as conversation_id,
    li.lead_message,
    li.lead_message_at,
    c.assigned_to
  from public.conversations c
  left join last_incoming li on li.conversation_id = c.id
  where c.id = any(p_conversation_ids);
$function$;

revoke all on function public.get_pending_conversation_previews(uuid[]) from public;
grant execute on function public.get_pending_conversation_previews(uuid[]) to authenticated;
