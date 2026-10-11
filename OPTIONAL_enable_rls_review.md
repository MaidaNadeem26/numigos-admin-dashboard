# Optional RLS Review Plan

This file is planning guidance only. None of the Phase 2 migrations enables or disables RLS on an existing application table. Before any later RLS change, confirm each table's current `relrowsecurity` state and test with the same user roles used by the Expo app.

## Application tables

| Table | Student app usage to preserve | Society-admin usage to preserve | Review before enabling/changing RLS |
| --- | --- | --- | --- |
| `profiles` | Read the signed-in profile, verify email/account, show student identity | Read the signed-in admin profile and managed society ID | Students must read/update only their own profile; no user may change `role` or `managed_society_id`. Existing mobile login also looks up profiles by email/roll number. |
| `societies` | List and view society profiles, names, status, counts, and public details | Read and update the managed society profile | Public/authenticated listing and managed-society updates must continue. OSA decision changes are restricted by migration trigger/RPC. |
| `society_members` | Read public rosters and leadership | Read/manage only the managed society roster | Preserve public roster reads if intended; restrict insert/update/delete to that society's admin. |
| `events` | List approved/completed events and fetch event details | Read events for the managed society; create/edit its events and resubmit changes-requested events | Preserve approved/completed event reads; allow only a managed society admin to create/edit its events. OSA decisions go through `decide_event`. |
| `registrations` | Create and view the student's own registrations | View registrations for managed-society events and update attendance | Keep registration insert and self-read; scope admin read/attendance update to events in the managed society. |
| `posts` | Read society announcements and event posts | Read society posts | Preserve public/authenticated reads; separately scope any future write path to society admins. |
| `post_likes` | Add/remove the signed-in user's likes | Not used by OSA decision workflow | Restrict all operations to rows owned by `auth.uid()`. |
| `bookmarks` | Add/remove and list the signed-in user's saved events | Not used by OSA decision workflow | Restrict all operations to rows owned by `auth.uid()`. |
| `club_followers` | Follow/unfollow societies and read own follows | Not used by OSA decision workflow | Restrict writes to rows owned by `auth.uid()`; decide explicitly whether counts require a safe aggregate path. |
| `chat_messages` | Read society chat where applicable | Read/send messages for the managed society | Scope reads and inserts to the correct society membership/admin relationship; do not rely on broad authenticated policies. |
| `notifications` | Read/update/delete notifications for the signed-in user | Read society notifications for the managed society | Scope user notifications to `user_id = auth.uid()` and society notifications to a managed society; review existing broad `WITH CHECK` behavior. |

## Role integrity

Migration `002_osa_admin_policies_and_write_guards.sql` installs a trigger that blocks authenticated changes to `profiles.role`. It also replaces the Auth profile sync trigger so user metadata cannot assign or update a privileged role. Keep role provisioning in a trusted administrative process, not a client policy.

Society review uses `societies.status`. Reviewable values are derived from
`from_statuses` in society rows of `admin_status_rules`; do not maintain a
separate society-request table or hardcode review statuses in the dashboard.

## Audit table

`admin_decisions` is newly created by Phase 2 migration `001`; that migration enables RLS on this new table only. OSA admins may select and insert (with the actor constrained to the current user); no update/delete policies or grants are provided. Existing app-table RLS settings are not changed by Phase 2.
