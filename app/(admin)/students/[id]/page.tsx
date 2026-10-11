import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { EventRow, ProfileRow, RegistrationRow, SocietyMemberRow, SocietyRow } from '@/lib/database.types';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState, ErrorState } from '@/components/ui/loading-empty-state';
import { StatusBadge } from '@/components/ui/status-badge';

type StudentProfile = ProfileRow;
type RegistrationDetail = Pick<RegistrationRow, 'id' | 'event_id' | 'event_title' | 'status' | 'registered_at'>;
type EventMini = Pick<EventRow, 'id' | 'title' | 'society_id' | 'society_name'>;
type SocietyMini = Pick<SocietyRow, 'id' | 'name'>;
type Membership = Pick<SocietyMemberRow, 'id' | 'society_id' | 'name' | 'roll_number' | 'role' | 'group_name' | 'department' | 'joined_date' | 'created_at'>;

function displayDate(value: string | null | undefined, includeTime = false) {
  if (!value) return 'Not provided';
  const date = new Date(value);
  if (!Number.isFinite(date.valueOf())) return value;
  return new Intl.DateTimeFormat('en', includeTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }).format(date);
}

function initials(value: string) {
  return value.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase() || 'S';
}

function DetailField({ label, value }: { label: string; value: string | boolean | null | undefined }) {
  return <div><dt className="text-xs font-medium text-ink-muted">{label}</dt><dd className="mt-1 wrap-break-word text-sm text-ink">{value === null || value === undefined || value === '' ? '—' : typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value}</dd></div>;
}

export default async function StudentDetailPage({ params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const studentId = params.id;
  const profileResult = await supabase.from('profiles').select('id,email,full_name,roll_number,department,role,is_verified,created_at,updated_at,managed_society_id,semester,phone,avatar_url').eq('id', studentId).maybeSingle();
  if (profileResult.error) return <ErrorState title="Student profile unavailable" description={profileResult.error.message} />;
  if (!profileResult.data) notFound();
  const student = profileResult.data as StudentProfile;

  const [registrationsResult, membershipsResult, eventsResult, societiesResult] = await Promise.all([
    supabase.from('registrations').select('id,event_id,event_title,status,registered_at').eq('user_id', studentId).order('registered_at', { ascending: false }),
    supabase.from('society_members').select('id,society_id,name,roll_number,role,group_name,department,joined_date,created_at').eq('user_id', studentId).order('created_at', { ascending: false }),
    supabase.from('events').select('id,title,society_id,society_name').order('title'),
    supabase.from('societies').select('id,name').order('name'),
  ]);

  const registrations = (registrationsResult.data ?? []) as RegistrationDetail[];
  const events = (eventsResult.data ?? []) as EventMini[];
  const societies = (societiesResult.data ?? []) as SocietyMini[];
  const memberships = (membershipsResult.data ?? []) as Membership[];
  const eventMap = new Map(events.map((event) => [event.id, event]));
  const societyMap = new Map(societies.map((society) => [society.id, society]));
  const registrationRows = registrations.map((registration) => {
    const event = eventMap.get(registration.event_id);
    return {
      ...registration,
      display_event_title: event?.title || registration.event_title || registration.event_id,
      display_society_name: event?.society_name || societyMap.get(event?.society_id ?? '')?.name || '—',
      registered_label: displayDate(registration.registered_at, true),
    };
  });
  const membershipRows = memberships.map((membership) => ({
    ...membership,
    display_society_name: societyMap.get(membership.society_id)?.name || membership.society_id,
    joined_label: displayDate(membership.joined_date || membership.created_at),
  }));
  const queryErrors = [registrationsResult.error, membershipsResult.error, eventsResult.error, societiesResult.error].filter(Boolean);

  return (
    <div className="space-y-6">
      <header>
        <Link href="/students" className="text-sm font-semibold text-brand hover:text-brand-strong">← Student directory</Link>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-soft text-base font-bold uppercase text-brand">{initials(student.full_name || student.email)}</span>
          <div><p className="text-xs uppercase tracking-[0.2em] text-ink-muted">Student profile</p><h2 className="mt-1 text-3xl font-semibold text-brand-deep">{student.full_name || student.email}</h2></div>
          <div className="ml-auto flex flex-wrap gap-2"><StatusBadge label={student.is_verified ? 'Verified' : 'Unverified'} /><StatusBadge label={student.role} /></div>
        </div>
      </header>

      {queryErrors.length ? <div className="grid gap-3">{registrationsResult.error ? <ErrorState title="Event registrations unavailable" description={registrationsResult.error.message} /> : null}{membershipsResult.error ? <ErrorState title="Society memberships unavailable" description={membershipsResult.error.message} /> : null}{eventsResult.error ? <ErrorState title="Event details unavailable" description={eventsResult.error.message} /> : null}{societiesResult.error ? <ErrorState title="Society details unavailable" description={societiesResult.error.message} /> : null}</div> : null}

      <section className="rounded-[22px] border border-line bg-surface p-5 shadow-[0_5px_20px_rgba(11,48,41,0.04)] sm:p-6">
        <h3 className="mb-5 text-lg font-semibold text-ink">Profile information</h3>
        <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          <DetailField label="Full name" value={student.full_name} />
          <DetailField label="Email" value={student.email} />
          <DetailField label="Roll number" value={student.roll_number} />
          <DetailField label="Department" value={student.department} />
          <DetailField label="Semester" value={student.semester} />
          <DetailField label="Phone" value={student.phone} />
          <DetailField label="Verified" value={student.is_verified} />
          <DetailField label="Role" value={student.role} />
          <DetailField label="Created" value={displayDate(student.created_at)} />
        </dl>
      </section>

      <section className="space-y-4">
        <div><h3 className="text-lg font-semibold text-ink">Event registrations</h3><p className="mt-1 text-sm text-ink-muted">{registrations.length} registration records</p></div>
        {registrationsResult.error ? null : registrationRows.length === 0 ? <EmptyState title="No event registrations" description="This student has no registration records." /> : <DataTable rows={registrationRows} columns={[
          { key: 'display_event_title', header: 'Event', render: (row) => <Link href={`/events/${encodeURIComponent(String(row.event_id))}`} className="font-medium text-brand hover:underline">{String(row.display_event_title)}</Link> },
          { key: 'display_society_name', header: 'Society' },
          { key: 'registered_label', header: 'Registered' },
          { key: 'status', header: 'Attendance', render: (row) => <StatusBadge label={String(row.status)} /> },
        ]} />}
      </section>

      <section className="space-y-4">
        <div><h3 className="text-lg font-semibold text-ink">Society and team memberships</h3><p className="mt-1 text-sm text-ink-muted">{memberships.length} membership records</p></div>
        {membershipsResult.error ? null : membershipRows.length === 0 ? <EmptyState title="No society memberships" description="This student has no society_members records." /> : <DataTable rows={membershipRows} columns={[
          { key: 'display_society_name', header: 'Society', render: (row) => <Link href={`/societies/${encodeURIComponent(String(row.society_id))}`} className="font-medium text-brand hover:underline">{String(row.display_society_name)}</Link> },
          { key: 'group_name', header: 'Group' },
          { key: 'role', header: 'Role' },
          { key: 'department', header: 'Department' },
          { key: 'joined_label', header: 'Joined' },
        ]} />}
      </section>
    </div>
  );
}
