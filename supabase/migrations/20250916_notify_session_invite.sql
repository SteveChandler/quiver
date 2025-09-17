-- Notify Session Invite RPC
-- Inserts an activity owned by the invitee while preserving inviter as metadata

begin;

create or replace function public.notify_session_invite(
  p_actor_id uuid,
  p_recipient_id uuid,
  p_session_id uuid,
  p_payload jsonb default '{}'::jsonb
) returns public.user_activities
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.user_activities;
begin
  insert into public.user_activities (
    user_id,
    activity_type,
    entity_type,
    entity_id,
    metadata
  ) values (
    p_recipient_id,
    'session_invite.created',
    'session',
    p_session_id,
    coalesce(jsonb_build_object('actor_id', p_actor_id) || p_payload, jsonb_build_object('actor_id', p_actor_id))
  )
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.notify_session_invite(uuid, uuid, uuid, jsonb) to authenticated;

commit;


