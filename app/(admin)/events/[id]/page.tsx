import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { AdminDecisionRow, AdminStatusRuleRow, EventRow, ProfileRow, RegistrationRow, SocietyRow } from '@/lib/database.types';
import { EmptyState, ErrorState } from '@/components/ui/loading-empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { ReviewDecisionActions } from '@/components/overview/review-decision-actions';

type EventDetailRow = EventRow;
type RegistrationDetailRow = Pick<RegistrationRow, 'id' | 'event_id' | 'user_id' | 'name' | 'roll_number' | 'department' | 'semester' | 'email' | 'status' | 'registered_at'>;
type ProfileMini = Pick<ProfileRow, 'id' | 'full_name' | 'email' | 'roll_number' | 'department' | 'semester'>;
type SocietyMini = Pick<SocietyRow, 'id' | 'name' | 'short_name' | 'contact_email' | 'faculty_advisor'>;
type DecisionRow = Pick<AdminDecisionRow, 'id' | 'entity_type' | 'entity_id' | 'action' | 'previous_status' | 'new_status' | 'notes' | 'actor_id' | 'created_at'>;

function parseDate(value: string | null | undefined): number | null {
  if (!value?.trim()) return null;
  const text = value.trim();
  const parsed = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T00:00:00` : text);
  return Number.isFinite(parsed) ? parsed : null;
}

function displayDate(value: string | null | undefined, withTime = false) {
  if (!value) return 'Not provided';
  const parsed = parseDate(value);
  if (parsed === null) return value;
  return new Intl.DateTimeFormat('en', withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }).format(parsed);
}

function actionsForStatus(rules: AdminStatusRuleRow[], status: string) {
  const actions = new Set<string>();
  for (const rule of rules) {
    if (rule.entity_type?.toLowerCase() !== 'event' || !rule.from_statuses?.includes(status)) continue;
    const data = rule as Record<string, unknown>;
    if (Array.isArray(data.actions)) {
      for (const item of data.actions) {
        if (typeof item === 'string') actions.add(item);
        else if (item && typeof item === 'object' && 'action' in item && typeof item.action === 'string') actions.add(item.action);
      }
    }
    for (const key of ['action', 'decision', 'allowed_action']) if (typeof data[key] === 'string') actions.add(data[key] as string);
  }
  return [...actions];
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return <div className="min-w-0"><dt className="text-xs font-medium text-ink-muted">{label}</dt><dd className="mt-1 wrap-break-word text-sm text-ink">{value === null || value === undefined || value === '' ? '—' : value}</dd></div>;
}

function initials(value: string) {
  return value.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase() || 'S';
}

export default async function EventDetailPage({ params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const eventId = decodeURIComponent(params.id);
  const [eventResult, registrationsResult, decisionsResult, rulesResult] = await Promise.all([
    supabase.from('events').select('id,society_id,society_name,title,short_title,category,category_tag,badge,date,date_label,time,time_label,date_time_full,venue,wing,capacity,registered_count,registrations_count,deadline,deadline_text,urgent,image,club_logo,description,status,osa_notes,submitted_at,created_at,updated_at').eq('id', eventId).maybeSingle(),
    supabase.from('registrations').select('id,event_id,user_id,name,roll_number,department,semester,email,status,registered_at').eq('event_id', eventId).order('registered_at', { ascending: false }),
    supabase.from('admin_decisions').select('id,entity_type,entity_id,action,previous_status,new_status,notes,actor_id,created_at').eq('entity_type', 'event').eq('entity_id', eventId).order('created_at', { ascending: false }),
    supabase.from('admin_status_rules').select('*'),
  ]);

  if (eventResult.error) return <ErrorState title="Event unavailable" description={eventResult.error.message} />;
  if (!eventResult.data) notFound();
  const event = eventResult.data as EventDetailRow;
  const registrations = (registrationsResult.data ?? []) as RegistrationDetailRow[];
  const decisions = (decisionsResult.data ?? []) as DecisionRow[];
  const rules = (rulesResult.data ?? []) as AdminStatusRuleRow[];
  const relatedUserIds = [...new Set(registrations.map((registration) => registration.user_id).filter((id): id is string => Boolean(id)))];
  const [profileResult, societyResult] = await Promise.all([
    relatedUserIds.length
      ? supabase.from('profiles').select('id,full_name,email,roll_number,department,semester').in('id', relatedUserIds)
      : Promise.resolve({ data: [] as ProfileMini[], error: null }),
    supabase.from('societies').select('id,name,short_name,contact_email,faculty_advisor').eq('id', event.society_id).maybeSingle(),
  ]);
  const profiles = new Map(((profileResult.data ?? []) as ProfileMini[]).map((profile) => [profile.id, profile]));
  const actorIds = [...new Set(decisions.map((decision) => decision.actor_id))];
  const actorsResult = actorIds.length
    ? await supabase.from('profiles').select('id,full_name,email').in('id', actorIds)
    : { data: [] as Array<Pick<ProfileRow, 'id' | 'full_name' | 'email'>>, error: null };
  const actorNames = new Map(((actorsResult.data ?? []) as Array<Pick<ProfileRow, 'id' | 'full_name' | 'email'>>).map((actor) => [actor.id, actor.full_name || actor.email]));
  const society = societyResult.data as SocietyMini | null;
  const actions = actionsForStatus(rules, event.status);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4"><div><Link href="/events?tab=all" className="text-sm font-semibold text-brand hover:text-brand-strong">← All events</Link><p className="mt-4 text-xs uppercase tracking-[0.2em] text-ink-muted">Event detail</p><h2 className="mt-2 text-3xl font-semibold text-brand-deep">{event.title}</h2><p className="mt-1 text-sm text-ink-muted">{society ? <Link className="font-medium text-brand hover:underline" href={`/societies/${encodeURIComponent(society.id)}`}>{society.name}</Link> : event.society_name} · {event.category}</p></div><StatusBadge label={event.status} /></header>

      {registrationsResult.error || decisionsResult.error || rulesResult.error || profileResult.error || societyResult.error || actorsResult.error ? <div className="grid gap-3">{registrationsResult.error ? <ErrorState title="Registrations unavailable" description={registrationsResult.error.message} /> : null}{decisionsResult.error ? <ErrorState title="Decision history unavailable" description={decisionsResult.error.message} /> : null}{rulesResult.error ? <ErrorState title="Event rules unavailable" description={rulesResult.error.message} /> : null}{profileResult.error ? <ErrorState title="Student profiles unavailable" description={profileResult.error.message} /> : null}{societyResult.error ? <ErrorState title="Society information unavailable" description={societyResult.error.message} /> : null}{actorsResult.error ? <ErrorState title="Admin names unavailable" description={actorsResult.error.message} /> : null}</div> : null}

      <section className="rounded-[22px] border border-line bg-surface p-5 shadow-[0_5px_20px_rgba(11,48,41,0.04)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><h3 className="text-lg font-semibold text-ink">Event information</h3><p className="mt-2 max-w-4xl whitespace-pre-wrap text-sm leading-6 text-ink-muted">{event.description || 'No event description provided.'}</p></div>{event.badge ? <span className="rounded-full bg-brand-mist px-3 py-1 text-xs font-medium text-brand">{event.badge}</span> : null}</div>
        <dl className="mt-6 grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3"><Field label="Event ID" value={event.id} /><Field label="Society" value={society?.name ?? event.society_name} /><Field label="Category" value={event.category} /><Field label="Date" value={event.date_label || displayDate(event.date)} /><Field label="Time" value={event.time_label || event.time} /><Field label="Schedule details" value={event.date_time_full} /><Field label="Venue" value={event.venue} /><Field label="Wing" value={event.wing} /><Field label="Capacity" value={event.capacity} /><Field label="Registered" value={event.registered_count} /><Field label="Deadline" value={event.deadline_text || event.deadline} /><Field label="Submitted" value={displayDate(event.submitted_at, true)} /><Field label="Updated" value={displayDate(event.updated_at, true)} /></dl>
        {event.osa_notes ? <div className="mt-5 rounded-2xl border border-warning/20 bg-warning-soft p-4"><p className="text-xs font-semibold uppercase tracking-wide text-warning">OSA notes</p><p className="mt-2 whitespace-pre-wrap text-sm text-ink">{event.osa_notes}</p></div> : null}
        {rulesResult.error ? null : actions.length ? <div className="mt-5 border-t border-line pt-4"><p className="mb-3 text-sm font-semibold text-ink">Available next actions</p><ReviewDecisionActions entityType="event" entityId={event.id} availableActions={actions} /></div> : <p className="mt-5 border-t border-line pt-4 text-sm text-ink-muted">No next actions are configured for this status.</p>}
      </section>

      <section className="rounded-[22px] border border-line bg-surface p-5 shadow-[0_5px_20px_rgba(11,48,41,0.04)] sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3"><h3 className="text-lg font-semibold text-ink">Registrations</h3><span className="text-sm text-ink-muted">{registrations.length}</span></div>
        {registrationsResult.error ? null : registrations.length === 0 ? <EmptyState title="No registrations yet" description="Students registered for this event will appear here." /> : <div className="overflow-x-auto rounded-2xl border border-line"><table className="min-w-full text-left text-sm"><thead className="bg-field text-xs uppercase tracking-wide text-ink-muted"><tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Roll number</th><th className="px-4 py-3">Registered</th><th className="px-4 py-3">Attendance</th></tr></thead><tbody className="divide-y divide-line">{registrations.map((registration) => { const profile = registration.user_id ? profiles.get(registration.user_id) : undefined; const name = profile?.full_name || registration.name; return <tr key={registration.id}><td className="px-4 py-3"><span className="flex items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-mist text-xs font-semibold text-brand">{initials(name)}</span><span><span className="block font-medium text-ink">{name}</span><span className="block text-xs text-ink-muted">{profile?.email || registration.email}</span></span></span></td><td className="px-4 py-3">{profile?.roll_number || registration.roll_number}</td><td className="px-4 py-3 text-ink-muted">{displayDate(registration.registered_at, true)}</td><td className="px-4 py-3"><StatusBadge label={registration.status} /></td></tr>; })}</tbody></table></div>}
      </section>

      <section className="rounded-[22px] border border-line bg-surface p-5 shadow-[0_5px_20px_rgba(11,48,41,0.04)] sm:p-6">
        <h3 className="mb-4 text-lg font-semibold text-ink">Decision history</h3>
        {decisionsResult.error ? null : decisions.length === 0 ? <EmptyState title="No decisions recorded" description="OSA decisions for this event will appear here." /> : <ol className="divide-y divide-line">{decisions.map((decision) => <li key={decision.id} className="grid gap-2 py-4 first:pt-0 sm:grid-cols-[1fr_auto]"><div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-event-sage/25 text-xs font-semibold uppercase text-success">{initials(actorNames.get(decision.actor_id) ?? '')}</span><div><p className="font-medium capitalize text-ink">{decision.action.replaceAll('_', ' ')}</p><p className="mt-1 text-sm text-ink-muted">{decision.previous_status} → {decision.new_status} · {actorNames.get(decision.actor_id) ?? decision.actor_id}</p>{decision.notes ? <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{decision.notes}</p> : null}</div></div><time className="text-xs text-ink-muted">{displayDate(decision.created_at, true)}</time></li>)}</ol>}
      </section>
    </div>
  );
}
