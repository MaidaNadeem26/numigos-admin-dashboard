-- Phase 2 migration 1 of 3.
-- Creates the OSA role helper and append-only decision audit table.
-- This enables RLS only on the new audit table. It does not change RLS on any
-- existing application table.

create or replace function public.is_osa_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.profiles as profile
    where profile.id = auth.uid()
      and profile.role = 'osa_admin'
  );
$$;

revoke all on function public.is_osa_admin() from public;
grant execute on function public.is_osa_admin() to authenticated;

create table if not exists public.admin_decisions (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('society', 'event')),
  entity_id text not null,
  action text not null check (action in ('approve', 'reject', 'request_changes')),
  previous_status text not null,
  new_status text not null,
  notes text,
  actor_id uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.admin_decisions enable row level security;

create index if not exists admin_decisions_created_at_idx
  on public.admin_decisions (created_at desc);

create index if not exists admin_decisions_entity_idx
  on public.admin_decisions (entity_type, entity_id, created_at desc);

revoke all on table public.admin_decisions from public, anon, authenticated;
grant select, insert on table public.admin_decisions to authenticated;

-- The audit table is new and RLS is enabled above. Existing application tables
-- are not altered here.
drop policy if exists osa_admin_read_decisions on public.admin_decisions;
create policy osa_admin_read_decisions
  on public.admin_decisions
  for select
  to authenticated
  using (public.is_osa_admin());

drop policy if exists osa_admin_insert_decisions on public.admin_decisions;
create policy osa_admin_insert_decisions
  on public.admin_decisions
  for insert
  to authenticated
  with check (public.is_osa_admin() and actor_id = auth.uid());

-- No UPDATE or DELETE grants or policies are provided for admin_decisions.
