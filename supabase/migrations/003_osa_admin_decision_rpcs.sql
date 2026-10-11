-- Phase 2 migration 3 of 3.
-- Decision changes and audit rows commit or roll back in the same transaction.
-- No RLS settings are changed by this migration.

create or replace function public.decide_event(event_id text, action text, notes text default null)
returns public.admin_decisions
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  previous_status text;
  next_status text;
  decision_row public.admin_decisions%rowtype;
begin
  if not public.is_osa_admin() then
    raise exception 'OSA administrator permission required.' using errcode = '42501';
  end if;

  if $2 is null or $2 not in ('approve', 'reject', 'request_changes') then
    raise exception 'Unsupported event decision.' using errcode = '22023';
  end if;

  if $2 in ('reject', 'request_changes') and nullif(btrim($3), '') is null then
    raise exception 'Notes are required to reject or request changes.' using errcode = '22023';
  end if;

  select event_row.status
    into previous_status
    from public.events as event_row
    where event_row.id = $1
    for update;

  if not found then
    raise exception 'Event not found.' using errcode = 'P0002';
  end if;

  if previous_status <> 'Pending Approval' then
    raise exception 'Event status % cannot be reviewed.', previous_status using errcode = '22023';
  end if;

  next_status := case $2
    when 'approve' then 'Approved'
    when 'reject' then 'Rejected'
    when 'request_changes' then 'Changes Requested'
  end;

  update public.events as event_row
    set status = next_status,
        updated_at = now()
    where event_row.id = $1;

  insert into public.admin_decisions (
    entity_type, entity_id, action, previous_status, new_status, notes, actor_id
  ) values (
    'event', $1, $2, previous_status, next_status, nullif(btrim($3), ''), auth.uid()
  ) returning * into decision_row;

  return decision_row;
end;
$$;

create or replace function public.decide_society(society_id text, action text, notes text default null)
returns public.admin_decisions
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  previous_status text;
  next_status text;
  rule_data jsonb;
  rule_from_statuses jsonb;
  decision_row public.admin_decisions%rowtype;
begin
  if not public.is_osa_admin() then
    raise exception 'OSA administrator permission required.' using errcode = '42501';
  end if;

  if $2 is null or $2 not in ('approve', 'reject', 'request_changes') then
    raise exception 'Unsupported society decision.' using errcode = '22023';
  end if;

  if $2 in ('reject', 'request_changes') and nullif(btrim($3), '') is null then
    raise exception 'Notes are required to reject or request changes.' using errcode = '22023';
  end if;

  select society_row.status
    into previous_status
    from public.societies as society_row
    where society_row.id = $1
    for update;

  if not found then
    raise exception 'Society not found.' using errcode = 'P0002';
  end if;

  -- Use the configured society rule's from_statuses and target status.
  for rule_data in select to_jsonb(status_rule) from public.admin_status_rules as status_rule loop
    if coalesce(rule_data->>'entity_type', rule_data->>'entity', rule_data->>'table_name') <> 'society'
      or coalesce(rule_data->>'action', rule_data->>'decision') <> $2 then
      continue;
    end if;

    rule_from_statuses := rule_data->'from_statuses';
    if jsonb_typeof(rule_from_statuses) = 'array' and rule_from_statuses ? previous_status then
      next_status := coalesce(rule_data->>'to_status', rule_data->>'new_status', rule_data->>'target_status', rule_data->>'result_status');
      exit when next_status is not null;
    end if;
  end loop;

  if next_status is null then
    raise exception 'No society status rule allows action % from status %.', $2, previous_status using errcode = '22023';
  end if;

  update public.societies as society_row
    set status = next_status,
        updated_at = now()
    where society_row.id = $1;

  insert into public.admin_decisions (
    entity_type, entity_id, action, previous_status, new_status, notes, actor_id
  ) values (
    'society', $1, $2, previous_status, next_status, nullif(btrim($3), ''), auth.uid()
  ) returning * into decision_row;

  return decision_row;
end;
$$;

-- This role-checked RPC provides filtered audit access in addition to the
-- audit table's OSA-only RLS policies.
create or replace function public.list_admin_decisions(
  p_entity_type text default null,
  p_action text default null,
  p_actor_id uuid default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_search text default null,
  p_limit integer default 500
)
returns setof public.admin_decisions
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.is_osa_admin() then
    raise exception 'OSA administrator permission required.' using errcode = '42501';
  end if;

  return query
  select decision.*
  from public.admin_decisions as decision
  where (p_entity_type is null or decision.entity_type = p_entity_type)
    and (p_action is null or decision.action = p_action)
    and (p_actor_id is null or decision.actor_id = p_actor_id)
    and (p_from is null or decision.created_at >= p_from)
    and (p_to is null or decision.created_at < p_to)
    and (
      nullif(btrim(p_search), '') is null
      or decision.entity_id ilike '%' || btrim(p_search) || '%'
      or coalesce(decision.notes, '') ilike '%' || btrim(p_search) || '%'
    )
  order by decision.created_at desc
  limit least(greatest(coalesce(p_limit, 500), 1), 500);
end;
$$;

revoke all on function public.decide_event(text, text, text) from public;
revoke all on function public.decide_society(text, text, text) from public;
revoke all on function public.list_admin_decisions(text, text, uuid, timestamptz, timestamptz, text, integer) from public;
grant execute on function public.decide_event(text, text, text) to authenticated;
grant execute on function public.decide_society(text, text, text) to authenticated;
grant execute on function public.list_admin_decisions(text, text, uuid, timestamptz, timestamptz, text, integer) to authenticated;