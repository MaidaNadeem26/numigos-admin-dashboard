import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { AdminDecisionRow, EventRow, SocietyMemberRow, SocietyRow } from '@/lib/database.types';
import { EmptyState, ErrorState } from '@/components/ui/loading-empty-state';
import { StatusBadge } from '@/components/ui/status-badge';

type SocietyDetail = SocietyRow;
type RosterEntry = Pick<SocietyMemberRow, 'id' | 'society_id' | 'user_id' | 'name' | 'roll_number' | 'role' | 'group_name' | 'department' | 'email' | 'avatar' | 'joined_date' | 'created_at'>;
type RelatedEvent = Pick<EventRow, 'id' | 'title' | 'category' | 'date' | 'venue' | 'status' | 'created_at'>;
type Decision = Pick<AdminDecisionRow, 'id' | 'entity_type' | 'entity_id' | 'action' | 'previous_status' | 'new_status' | 'notes' | 'actor_id' | 'created_at'>;
type ProfileSummary = { id: string; full_name: string | null; email: string };

function displayDate(value: string | null | undefined, withTime = false) {
  if (!value) return 'Not provided';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat('en', withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }).format(date);
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return <div className="min-w-0"><dt className="text-xs font-medium text-ink-muted">{label}</dt><dd className="mt-1 wrap-break-word text-sm text-ink">{value === null || value === undefined || value === '' ? '—' : value}</dd></div>;
}

function decisionLabel(action: string) {
  return action.replaceAll('_', ' ');
}

export default async function SocietyDetailPage({ params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const societyId = decodeURIComponent(params.id);
  const [societyResult, memberResult, eventResult, decisionResult] = await Promise.all([
    supabase.from('societies').select('id,name,short_name,tagline,category,category_label,dept,faculty_advisor,contact_email,instagram,meeting_schedule,members_count,events_count,logo,banner,mission,status,created_at,updated_at').eq('id', societyId).maybeSingle(),
    supabase.from('society_members').select('id,society_id,user_id,name,roll_number,role,group_name,department,email,avatar,joined_date,created_at').eq('society_id', societyId).order('group_name').order('name'),
    supabase.from('events').select('id,title,category,date,venue,status,created_at').eq('society_id', societyId).order('created_at', { ascending: false }),
    supabase.from('admin_decisions').select('id,entity_type,entity_id,action,previous_status,new_status,notes,actor_id,created_at').eq('entity_type', 'society').eq('entity_id', societyId).order('created_at', { ascending: false }),
  ]);

  if (societyResult.error) return <ErrorState title="Society unavailable" description={societyResult.error.message} />;
  if (!societyResult.data) notFound();

  const society = societyResult.data as SocietyDetail;
  const members = (memberResult.data ?? []) as RosterEntry[];
  const events = (eventResult.data ?? []) as RelatedEvent[];
  const decisions = (decisionResult.data ?? []) as Decision[];
  const actorIds = [...new Set(decisions.map((decision) => decision.actor_id))];
  const actorResult = actorIds.length
    ? await supabase.from('profiles').select('id,full_name,email').in('id', actorIds)
    : { data: [] as ProfileSummary[], error: null };
  const actorMap = new Map(((actorResult.data ?? []) as ProfileSummary[]).map((profile) => [profile.id, profile.full_name || profile.email]));
  const rosterGroups = [...new Set(members.map((member) => member.group_name))];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/societies?tab=all" className="text-sm font-semibold text-brand hover:text-brand-strong">← All societies</Link>
          <p className="mt-4 text-xs uppercase tracking-[0.2em] text-ink-muted">Society detail</p>
          <h2 className="mt-2 text-3xl font-semibold text-brand-deep">{society.name}</h2>
          <p className="mt-1 text-sm text-ink-muted">{society.short_name}{society.tagline ? ` · ${society.tagline}` : ''}</p>
        </div>
        <StatusBadge label={society.status} />
      </header>

      {memberResult.error || eventResult.error || decisionResult.error || actorResult.error ? <div className="grid gap-3">{memberResult.error ? <ErrorState title="Team roster unavailable" description={memberResult.error.message} /> : null}{eventResult.error ? <ErrorState title="Related events unavailable" description={eventResult.error.message} /> : null}{decisionResult.error ? <ErrorState title="Decision history unavailable" description={decisionResult.error.message} /> : null}{actorResult.error ? <ErrorState title="Admin profiles unavailable" description={actorResult.error.message} /> : null}</div> : null}

      <section className="rounded-[22px] border border-line bg-surface p-5 shadow-[0_5px_20px_rgba(11,48,41,0.04)] sm:p-6">
        <h3 className="mb-5 text-lg font-semibold text-ink">Society information</h3>
        {society.mission ? <p className="mb-6 max-w-4xl whitespace-pre-wrap text-sm leading-6 text-ink">{society.mission}</p> : <p className="mb-6 text-sm text-ink-muted">No mission statement provided.</p>}
        <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Society ID" value={society.id} />
          <Field label="Category" value={society.category} />
          <Field label="Category label" value={society.category_label} />
          <Field label="Department" value={society.dept} />
          <Field label="Faculty advisor" value={society.faculty_advisor} />
          <Field label="Contact email" value={society.contact_email} />
          <Field label="Instagram" value={society.instagram} />
          <Field label="Meeting schedule" value={society.meeting_schedule} />
          <Field label="Members" value={society.members_count} />
          <Field label="Events" value={society.events_count} />
          <Field label="Created" value={displayDate(society.created_at)} />
          <Field label="Updated" value={displayDate(society.updated_at)} />
          <Field label="Logo reference" value={society.logo} />
          <Field label="Banner reference" value={society.banner} />
        </dl>
      </section>

      <section className="rounded-[22px] border border-line bg-surface p-5 shadow-[0_5px_20px_rgba(11,48,41,0.04)] sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3"><h3 className="text-lg font-semibold text-ink">Team roster</h3><span className="text-sm text-ink-muted">{members.length} members</span></div>
        {memberResult.error ? null : members.length === 0 ? <EmptyState title="No team members listed" description="No society_members records are associated with this society." /> : (
          <div className="space-y-6">{rosterGroups.map((groupName) => <div key={groupName}><h4 className="mb-2 text-sm font-semibold text-brand-deep">{groupName}</h4><div className="overflow-x-auto rounded-2xl border border-line"><table className="min-w-full text-left text-sm"><thead className="bg-field text-xs uppercase tracking-wide text-ink-muted"><tr><th className="px-4 py-3">Member</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Roll number</th><th className="px-4 py-3">Department</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Joined</th></tr></thead><tbody className="divide-y divide-line">{members.filter((member) => member.group_name === groupName).map((member) => <tr key={member.id}><td className="px-4 py-3 font-medium text-ink">{member.name}</td><td className="px-4 py-3">{member.role}</td><td className="px-4 py-3">{member.roll_number}</td><td className="px-4 py-3">{member.department ?? '—'}</td><td className="px-4 py-3">{member.email ?? '—'}</td><td className="px-4 py-3 text-ink-muted">{displayDate(member.joined_date)}</td></tr>)}</tbody></table></div></div>)}</div>
        )}
      </section>

      <section className="rounded-[22px] border border-line bg-surface p-5 shadow-[0_5px_20px_rgba(11,48,41,0.04)] sm:p-6">
        <h3 className="mb-4 text-lg font-semibold text-ink">Related events</h3>
        {eventResult.error ? null : events.length === 0 ? <EmptyState title="No related events" description="No events are associated with this society." /> : <div className="overflow-x-auto rounded-2xl border border-line"><table className="min-w-full text-left text-sm"><thead className="bg-field text-xs uppercase tracking-wide text-ink-muted"><tr><th className="px-4 py-3">Event</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Venue</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-line">{events.map((event) => <tr key={event.id}><td className="px-4 py-3 font-medium text-ink">{event.title}</td><td className="px-4 py-3">{event.category}</td><td className="px-4 py-3">{displayDate(event.date)}</td><td className="px-4 py-3">{event.venue}</td><td className="px-4 py-3"><StatusBadge label={event.status} /></td></tr>)}</tbody></table></div>}
      </section>

      <section className="rounded-[22px] border border-line bg-surface p-5 shadow-[0_5px_20px_rgba(11,48,41,0.04)] sm:p-6">
        <h3 className="mb-4 text-lg font-semibold text-ink">Decision history</h3>
        {decisionResult.error ? null : decisions.length === 0 ? <EmptyState title="No society decisions recorded" description="OSA decisions for this society will appear here." /> : <ol className="divide-y divide-line">{decisions.map((decision) => <li key={decision.id} className="grid gap-2 py-4 first:pt-0 sm:grid-cols-[1fr_auto]"><div><div className="flex flex-wrap items-center gap-2"><p className="font-medium capitalize text-ink">{decisionLabel(decision.action)}</p><StatusBadge label={decision.new_status} /></div><p className="mt-1 text-sm text-ink-muted">{decision.previous_status} → {decision.new_status} · {actorMap.get(decision.actor_id) ?? decision.actor_id}</p>{decision.notes ? <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{decision.notes}</p> : null}</div><time className="text-xs text-ink-muted">{displayDate(decision.created_at, true)}</time></li>)}</ol>}
      </section>
    </div>
  );
}
