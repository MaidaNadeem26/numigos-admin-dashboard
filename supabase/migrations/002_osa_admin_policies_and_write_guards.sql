-- Phase 2 migration 2 of 3.
-- Add OSA policies and write guards. This migration intentionally does not
-- enable or disable RLS on any existing table.

drop policy if exists osa_admin_read_profiles on public.profiles;
create policy osa_admin_read_profiles
  on public.profiles for select to authenticated
  using (public.is_osa_admin());

drop policy if exists osa_admin_read_societies on public.societies;
create policy osa_admin_read_societies
  on public.societies for select to authenticated
  using (public.is_osa_admin());

drop policy if exists osa_admin_update_society_review_fields on public.societies;
create policy osa_admin_update_society_review_fields
  on public.societies for update to authenticated
  using (public.is_osa_admin())
  with check (public.is_osa_admin());

drop policy if exists osa_admin_read_society_members on public.society_members;
create policy osa_admin_read_society_members
  on public.society_members for select to authenticated
  using (public.is_osa_admin());

drop policy if exists osa_admin_read_events on public.events;
create policy osa_admin_read_events
  on public.events for select to authenticated
  using (public.is_osa_admin());

drop policy if exists osa_admin_update_event_review_fields on public.events;
create policy osa_admin_update_event_review_fields
  on public.events for update to authenticated
  using (public.is_osa_admin())
  with check (public.is_osa_admin());

drop policy if exists osa_admin_read_registrations on public.registrations;
create policy osa_admin_read_registrations
  on public.registrations for select to authenticated
  using (public.is_osa_admin());

-- The current profiles table has role but no role-specific update policy.
-- Block authenticated role changes regardless of any broader legacy policy.
create or replace function public.prevent_authenticated_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null then
    raise exception 'Profile role changes must be performed by a trusted administrative process.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_authenticated_profile_role_change on public.profiles;
create trigger prevent_authenticated_profile_role_change
  before update of role on public.profiles
  for each row
  execute function public.prevent_authenticated_profile_role_change();

-- The existing Auth sync trigger copied role and managed_society_id from user
-- metadata. Treat that metadata as untrusted: new Auth users are students and
-- later Auth metadata changes never alter either privileged profile field.
create or replace function public.handle_auth_user_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, email, full_name, roll_number, department, role, managed_society_id, is_verified, updated_at
  ) values (
    new.id,
    coalesce(new.email, ''),
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'roll_number',
    new.raw_user_meta_data->>'department',
    'student',
    null,
    true,
    now()
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(excluded.full_name, public.profiles.full_name),
      roll_number = coalesce(excluded.roll_number, public.profiles.roll_number),
      department = coalesce(excluded.department, public.profiles.department),
      is_verified = true,
      updated_at = now();

  return new;
end;
$$;

-- RLS policies cannot restrict individual columns. These guards ensure OSA
-- direct updates are limited to review fields even when legacy policies are
-- permissive. Other authenticated users retain existing content edits, but
-- cannot alter OSA review status.
create or replace function public.guard_society_osa_review_update()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if public.is_osa_admin() then
    if (to_jsonb(new) - array['status', 'updated_at'])
      is distinct from (to_jsonb(old) - array['status', 'updated_at']) then
      raise exception 'OSA may update only society status and updated_at directly.'
        using errcode = '42501';
    end if;
  elsif new.status is distinct from old.status then
    raise exception 'Only OSA administrators may update society review status.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_society_osa_review_update on public.societies;
create trigger guard_society_osa_review_update
  before update on public.societies
  for each row
  execute function public.guard_society_osa_review_update();

create or replace function public.guard_event_osa_review_update()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if public.is_osa_admin() then
    if (to_jsonb(new) - array['status', 'updated_at'])
      is distinct from (to_jsonb(old) - array['status', 'updated_at']) then
      raise exception 'OSA may update only event status and updated_at directly.'
        using errcode = '42501';
    end if;
  elsif new.status is distinct from old.status then
    if not exists (
      select 1
      from public.profiles as profile
      where profile.id = auth.uid()
        and profile.role = 'society_admin'
        and profile.managed_society_id = old.society_id
    ) or old.status <> 'Changes Requested' or new.status <> 'Pending Approval' then
      raise exception 'Only the managing society admin may resubmit an event after changes are requested.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_event_osa_review_update on public.events;
create trigger guard_event_osa_review_update
  before update on public.events
  for each row
  execute function public.guard_event_osa_review_update();
