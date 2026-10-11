# Optional RLS Review

Do not run this as part of Phase 2. No Phase 2 migration enables or disables RLS. The checked-in `supabase-schema.sql` and `supabase-seed-full.sql` enable RLS on the five tables below, but the live PostgREST endpoint does not expose `relrowsecurity`; verify actual flags in the Supabase SQL Editor before planning a separate RLS change.

## `profiles`

- The mobile app reads the signed-in profile by `id` and role-checks `role`; login also looks up a profile by email or roll number.
- Authenticated users need to read their own profile. Society admins need profile details for event registrants and society team displays. The current production schema allows authenticated profile reads broadly.
- Profile edits are used by society admins for their own profile. Prevent users from changing `role` or `managed_society_id`; Phase 2 adds a database trigger that blocks authenticated role changes.
- Avoid exposing the full student directory to anonymous users.

## `societies`

- Students and signed-out discovery flows read the public society directory, society names, category, mission, logos, and counts.
- Society admins read and update their own society profile; OSA needs directory-wide reads and status review.
- The live table has a free-text `status` column and uses `created_at` for record dates. Current live rows observed all use `Active & Approved by OSA`. Reviewable society statuses are read from society rows in `admin_status_rules`.

## `society_members`

- Students read society rosters and leadership. Society admins list, add, edit, and remove members for their own society.
- Scope writes to the managed society and avoid exposing roster email/roll-number fields to anonymous users unless the product explicitly requires that.

## `events`

- Students and anonymous discovery read approved/completed events; society admins need all statuses for events belonging to their society and can create/update their event proposals.
- Society admins also need updates to event content fields. OSA decision writes should only affect `status` and `updated_at`; decision notes are retained in `admin_decisions`.
- Event statuses defined by the checked-in production schema are `Draft`, `Pending Approval`, `Approved`, `Rejected`, `Changes Requested`, `Completed`, and `Cancelled`.

## `registrations`

- Students create registrations and read their own registration/pass/history records.
- Society admins read registrations for events owned by their society and update attendance to `Registered`, `Attended`, or `Absent`.
- OSA needs read access across registrations for dashboard aggregates. Do not allow OSA dashboard code to update attendance directly.

## `admin_decisions` (new)

- Only OSA administrators should read the audit trail or create decisions; no client may update or delete decisions.
- The audit table has OSA-only read/insert RLS policies and no update/delete policy or grant. Role-checked decision/list RPCs provide the application interface.

## Review Notes

- RLS policies do not enforce access while RLS is disabled. The Phase 2 migrations deliberately leave current flags unchanged as requested.
- `supabase-seed-full.sql` contains broad authenticated `FOR ALL` policies on several app tables. Review and replace those carefully rather than layering restrictive policies without checking existing app flows.
- Migration `002_osa_admin_policies_and_write_guards.sql` changes the Auth user-sync trigger so new profiles are students and untrusted Auth metadata cannot set `role` or `managed_society_id`. Provision OSA roles only through a trusted administrative process.
