import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { AdminDecisionRow, AdminStatusRuleRow, EventRow, RegistrationRow, SocietyRow } from '@/lib/database.types';
import { EmptyState, ErrorState } from '@/components/ui/loading-empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { OverviewCharts } from '@/components/overview/overview-charts';
import { ReviewDecisionActions } from '@/components/overview/review-decision-actions';
import { getServerAdminProfile } from '@/lib/auth';
import { RecentDecisionList, RecentSubmissionsList, SummaryHero, SummaryStatGrid } from '@/components/overview/summary-presentation';

type QueryValue = string | string[] | undefined;
type OverviewSearchParams = Record<string, QueryValue>;
type QueryError = { message: string; code?: string };
type PageResult<T> = { rows: T[]; error: QueryError | null };
type SocietyOverviewRow = Pick<SocietyRow, 'id' | 'name' | 'category' | 'status' | 'created_at'>;
type EventOverviewRow = Pick<EventRow, 'id' | 'society_id' | 'society_name' | 'title' | 'category' | 'date' | 'venue' | 'status' | 'created_at'>;
type RegistrationOverviewRow = Pick<RegistrationRow, 'id' | 'event_id' | 'status' | 'registered_at'>;

async function fetchAllPages<T>(getPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: QueryError | null }>): Promise<PageResult<T>> {
  const rows: T[] = [];
  const pageSize = 1000;
  let from = 0;
  try {
    while (true) {
      const { data, error } = await getPage(from, from + pageSize - 1);
      if (error) return { rows: [], error };
      const page = data ?? [];
      rows.push(...page);
      if (page.length < pageSize) return { rows, error: null };
      from += pageSize;
    }
  } catch (error) {
    return { rows: [], error: { message: error instanceof Error ? error.message : 'Request failed' } };
  }
}

async function queryResult<T>(query: () => PromiseLike<{ data: T | null; error: QueryError | null; count?: number | null }>) {
  try {
    const result = await query();
    return { data: result.data, count: result.count ?? null, error: result.error };
  } catch (error) {
    return { data: null, count: null, error: { message: error instanceof Error ? error.message : 'Request failed' } };
  }
}

function first(value: QueryValue) {
  return Array.isArray(value) ? value[0] : value;
}

function tally(values: Array<string | null | undefined>) {
  const counts = new Map<string, number>();
  for (const value of values) if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => a.label.localeCompare(b.label));
}

function displayDate(value: string | null | undefined) {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(date);
}

function groupRegistrationsByMonth(rows: RegistrationOverviewRow[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const month = row.registered_at.slice(0, 7);
    if (month.length === 7) counts.set(month, (counts.get(month) ?? 0) + 1);
  }
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, value]) => ({
    label: new Intl.DateTimeFormat('en', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`)),
    value,
  }));
}

function validDateStart(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

function validDateEndExclusive(value: string | undefined) {
  const start = validDateStart(value);
  if (!start) return null;
  const date = new Date(start);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString();
}

function isAuditMigrationMissing(error: QueryError | null) {
  if (!error) return false;
  return error.code === 'PGRST202' || error.code === 'PGRST205' || error.code === '42P01'
    || (/admin_decisions|list_admin_decisions/i.test(error.message) && /schema cache|does not exist|could not find/i.test(error.message));
}

function societyRules(rows: AdminStatusRuleRow[]) {
  return rows.filter((rule) => rule.entity_type?.toLowerCase() === 'society');
}

function societyReviewStatuses(rows: AdminStatusRuleRow[]) {
  return new Set(societyRules(rows).flatMap((rule) => Array.isArray(rule.from_statuses) ? rule.from_statuses : []));
}

function AuditMigrationState() {
  return <EmptyState title="Audit migration not applied" description="Apply the admin decision and audit migrations to enable decision history." />;
}

function OverviewTabs({ activeTab, children }: { activeTab: string; children: React.ReactNode }) {
  const tabs = [
    { id: 'summary', label: 'Summary' },
    { id: 'review-queue', label: 'Review queue' },
    { id: 'activity-log', label: 'Activity log' },
  ];

  return (
    <div className="space-y-6">
      <nav className="flex gap-2 overflow-x-auto overscroll-x-contain pb-1" aria-label="Overview sections">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={`/overview?tab=${tab.id}`}
            aria-current={activeTab === tab.id ? 'page' : undefined}
            className={`osa-button shrink-0 border px-4 py-2 text-sm font-medium transition ${activeTab === tab.id ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-ink-muted hover:border-brand/40 hover:text-brand-strong'}`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      <div className="rounded-2xl border border-line bg-surface p-6">{children}</div>
    </div>
  );
}

function ReviewQueue({ societies, events, societyError, eventError }: { societies: SocietyOverviewRow[]; events: EventOverviewRow[]; societyError: string | null; eventError: string | null }) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="rounded-2xl border border-line bg-surface p-5">
        <div className="mb-4 flex items-center justify-between gap-3"><h3 className="font-semibold text-ink">Societies awaiting review</h3><Link href="/societies?tab=approvals" className="text-sm font-medium text-brand hover:text-brand-strong">Approvals tab</Link></div>
        {societyError ? <ErrorState title="Society review queue unavailable" description={societyError} /> : societies.length === 0 ? <EmptyState title="No societies awaiting review" description="No society status matches any society rule's from_statuses." /> : <ul className="divide-y divide-line">{societies.map((society) => <li key={society.id} className="space-y-3 py-4 first:pt-0 last:pb-0"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium text-ink">{society.name}</p><p className="mt-1 text-xs text-ink-muted">Created {displayDate(society.created_at)} · {society.category}</p></div><StatusBadge label={society.status} /></div><ReviewDecisionActions entityType="society" entityId={society.id} /></li>)}</ul>}
      </section>
      <section className="rounded-2xl border border-line bg-surface p-5">
        <div className="mb-4 flex items-center justify-between gap-3"><h3 className="font-semibold text-ink">Events awaiting review</h3><Link href="/events?tab=approvals" className="text-sm font-medium text-brand hover:text-brand-strong">Approvals tab</Link></div>
        {eventError ? <ErrorState title="Event review queue unavailable" description={eventError} /> : events.length === 0 ? <EmptyState title="No events awaiting review" description="No events currently have Pending Approval status." /> : <ul className="divide-y divide-line">{events.map((event) => <li key={event.id} className="space-y-3 py-4 first:pt-0 last:pb-0"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium text-ink">{event.title}</p><p className="mt-1 text-xs text-ink-muted">{event.society_name} · Created {displayDate(event.created_at)}</p><p className="mt-1 text-xs text-ink-muted">{displayDate(event.date)} · {event.venue}</p></div><StatusBadge label={event.status} /></div><ReviewDecisionActions entityType="event" entityId={event.id} /></li>)}</ul>}
      </section>
    </div>
  );
}

function ActivityLog({ decisions, admins, error, migrationMissing, filters }: { decisions: AdminDecisionRow[]; admins: Array<{ id: string; label: string }>; error: string | null; migrationMissing: boolean; filters: { search: string; type: string; action: string; admin: string; from: string; to: string } }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <form action="/overview" method="get" className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <input type="hidden" name="tab" value="activity-log" />
        <label className="grid gap-1 text-xs font-medium text-ink-muted xl:col-span-2">Search<input name="search" defaultValue={filters.search} placeholder="Notes or entity ID" className="osa-field min-w-0 px-4 py-2 text-sm text-ink outline-none" /></label>
        <label className="grid gap-1 text-xs font-medium text-ink-muted">Type<select name="type" defaultValue={filters.type} className="osa-field min-w-0 px-4 py-2 text-sm text-ink outline-none"><option value="">All types</option><option value="society">Society</option><option value="event">Event</option></select></label>
        <label className="grid gap-1 text-xs font-medium text-ink-muted">Decision<select name="action" defaultValue={filters.action} className="osa-field min-w-0 px-4 py-2 text-sm text-ink outline-none"><option value="">All decisions</option><option value="approve">Approve</option><option value="reject">Reject</option><option value="request_changes">Request changes</option></select></label>
        <label className="grid gap-1 text-xs font-medium text-ink-muted">Admin<select name="admin" defaultValue={filters.admin} className="osa-field min-w-0 px-4 py-2 text-sm text-ink outline-none"><option value="">All admins</option>{admins.map((admin) => <option key={admin.id} value={admin.id}>{admin.label}</option>)}</select></label>
        <div className="grid grid-cols-2 gap-3 md:col-span-2 xl:col-span-3"><label className="grid gap-1 text-xs font-medium text-ink-muted">From<input type="date" name="from" defaultValue={filters.from} className="osa-field min-w-0 px-4 py-2 text-sm text-ink outline-none" /></label><label className="grid gap-1 text-xs font-medium text-ink-muted">To<input type="date" name="to" defaultValue={filters.to} className="osa-field min-w-0 px-4 py-2 text-sm text-ink outline-none" /></label></div>
        <div className="flex items-end gap-2 md:col-span-2 xl:col-span-3"><button className="osa-button bg-brand px-5 py-2 text-sm font-semibold text-white shadow-[0_5px_12px_rgba(30,93,75,0.16)] hover:bg-brand-strong">Apply filters</button><Link href="/overview?tab=activity-log" className="osa-button border border-line bg-surface px-5 py-2 text-center text-sm font-medium text-ink">Clear</Link></div>
      </form>
      {migrationMissing ? <AuditMigrationState /> : error ? <ErrorState title="Activity log unavailable" description={error} /> : decisions.length === 0 ? <EmptyState title="No decisions match these filters" description="Try a broader date range or clear one of the filters." /> : (
        <ol className="divide-y divide-line">{decisions.map((decision) => { const admin = admins.find((item) => item.id === decision.actor_id)?.label ?? decision.actor_id; return <li key={decision.id} className="grid gap-2 py-4 first:pt-0 md:grid-cols-[1fr_auto] md:items-start"><div><div className="flex flex-wrap items-center gap-2"><p className="font-medium capitalize text-ink">{decision.entity_type} · {decision.action.replace('_', ' ')}</p><StatusBadge label={decision.new_status} /></div><p className="mt-1 text-sm text-ink-muted">ID: {decision.entity_id} · {admin}</p>{decision.notes ? <p className="mt-2 text-sm text-ink">{decision.notes}</p> : null}</div><time className="text-xs text-ink-muted" dateTime={decision.created_at}>{new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(decision.created_at))}</time></li>; })}</ol>
      )}
    </section>
  );
}

export default async function OverviewPage({ searchParams = {} }: { searchParams?: OverviewSearchParams }) {
  const supabase = createServerSupabaseClient();
  const adminProfileQuery = getServerAdminProfile();
  const societyQuery = fetchAllPages<SocietyOverviewRow>((from, to) => supabase.from('societies').select('id,name,category,status,created_at').order('created_at', { ascending: false }).range(from, to));
  const eventQuery = fetchAllPages<EventOverviewRow>((from, to) => supabase.from('events').select('id,society_id,society_name,title,category,date,venue,status,created_at').order('created_at', { ascending: false }).range(from, to));
  const registrationQuery = fetchAllPages<RegistrationOverviewRow>((from, to) => supabase.from('registrations').select('id,event_id,status,registered_at').order('registered_at', { ascending: false }).range(from, to));
  const rulesQuery = fetchAllPages<AdminStatusRuleRow>((from, to) => supabase.from('admin_status_rules').select('*').range(from, to));
  const studentsQuery = queryResult(() => supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student'));
  const adminsQuery = queryResult(() => supabase.from('profiles').select('id,full_name,email').eq('role', 'osa_admin').order('full_name'));

  const [societyResult, eventResult, registrationResult, rulesResult, studentsResult, adminsResult, adminProfile] = await Promise.all([
    societyQuery, eventQuery, registrationQuery, rulesQuery, studentsQuery, adminsQuery, adminProfileQuery,
  ]);

  const societyData = societyResult.rows;
  const eventData = eventResult.rows;
  const registrationData = registrationResult.rows;
  const rules = rulesResult.rows;
  const reviewStatuses = societyReviewStatuses(rules);
  const societyQueue = societyData.filter((society) => reviewStatuses.has(society.status)).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const eventQueue = eventData.filter((event) => event.status === 'Pending Approval').sort((a, b) => a.created_at.localeCompare(b.created_at));
  const currentTab = first(searchParams.tab) ?? 'summary';
  const activitySearch = first(searchParams.search)?.trim() ?? '';
  const activityType = first(searchParams.type) ?? '';
  const activityAction = first(searchParams.action) ?? '';
  const activityAdmin = first(searchParams.admin) ?? '';
  const fromValue = first(searchParams.from) ?? '';
  const toValue = first(searchParams.to) ?? '';
  const validType = activityType === 'society' || activityType === 'event' ? activityType : null;
  const validAction = ['approve', 'reject', 'request_changes'].includes(activityAction) ? activityAction : null;
  const validAdmin = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(activityAdmin) ? activityAdmin : null;

  const recentDecisionsQuery = queryResult(() => supabase.rpc('list_admin_decisions', { p_entity_type: null, p_action: null, p_actor_id: null, p_from: null, p_to: null, p_search: null, p_limit: 8 }));
  const activityQuery = queryResult(() => supabase.rpc('list_admin_decisions', { p_entity_type: validType, p_action: validAction, p_actor_id: validAdmin, p_from: validDateStart(fromValue), p_to: validDateEndExclusive(toValue), p_search: activitySearch || null, p_limit: 500 }));
  const [recentDecisionResult, activityResult] = await Promise.all([recentDecisionsQuery, activityQuery]);

  const adminRows = adminsResult.data ?? [];
  const adminNames = Object.fromEntries(adminRows.map((admin) => [admin.id, admin.full_name || admin.email]));
  const admins = adminRows.map((admin) => ({ id: admin.id, label: admin.full_name || admin.email }));
  const recentDecisions = (recentDecisionResult.data ?? []) as AdminDecisionRow[];
  const activityDecisions = (activityResult.data ?? []) as AdminDecisionRow[];
  const activityRpcMissing = isAuditMigrationMissing(activityResult.error);
  const recentDecisionRpcMissing = isAuditMigrationMissing(recentDecisionResult.error);
  const activityError = adminsResult.error?.message ?? activityResult.error?.message ?? null;
  const today = new Date().toISOString().slice(0, 10);

  const pendingEvents = eventData.filter((event) => event.status === 'Pending Approval').length;
  const upcomingApprovedEvents = eventData.filter((event) => event.status === 'Approved' && event.date >= today).length;
  const completedEvents = eventData.filter((event) => event.status === 'Completed').length;
  const itemsAwaitingReview = societyResult.error || rulesResult.error || eventResult.error ? null : societyQueue.length + pendingEvents;
  const firstName = adminProfile?.profile.full_name.split(/\s+/)[0] || 'Admin';
  const todayLabel = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date());

  const stats = [
    { label: 'Total societies', value: societyResult.error ? null : societyData.length, error: societyResult.error?.message, helper: 'Registered on NUMIGOS', icon: 'societies' as const, tone: 'brand' as const },
    { label: 'Societies awaiting review', value: societyResult.error || rulesResult.error ? null : societyQueue.length, error: societyResult.error?.message ?? rulesResult.error?.message, helper: 'Matched from society rules', icon: 'clock' as const, tone: 'gold' as const, needsAttention: true },
    { label: 'Total events', value: eventResult.error ? null : eventData.length, error: eventResult.error?.message, helper: 'Across all societies', icon: 'calendar' as const, tone: 'sage' as const },
    { label: 'Events awaiting review', value: eventResult.error ? null : pendingEvents, error: eventResult.error?.message, helper: 'Pending approval', icon: 'clock' as const, tone: 'coral' as const, needsAttention: true },
    { label: 'Approved upcoming events', value: eventResult.error ? null : upcomingApprovedEvents, error: eventResult.error?.message, helper: 'Scheduled from today onward', icon: 'check' as const, tone: 'brand' as const },
    { label: 'Completed events', value: eventResult.error ? null : completedEvents, error: eventResult.error?.message, helper: 'Marked complete', icon: 'check' as const, tone: 'sage' as const },
    { label: 'Total students', value: studentsResult.error ? null : studentsResult.count ?? 0, error: studentsResult.error?.message, helper: 'Student profiles', icon: 'students' as const, tone: 'gold' as const },
    { label: 'Total registrations', value: registrationResult.error ? null : registrationData.length, error: registrationResult.error?.message, helper: 'Across campus events', icon: 'registrations' as const, tone: 'coral' as const },
  ];

  const recentSocietyEntries = societyData.slice(0, 5).map((society) => ({ id: society.id, title: society.name, subtitle: society.category, status: society.status, createdAt: society.created_at }));
  const recentEventEntries = eventData.slice(0, 5).map((event) => ({ id: event.id, title: event.title, subtitle: event.society_name, status: event.status, createdAt: event.created_at }));

  const summaryContent = (
    <div className="space-y-6">
      <SummaryHero firstName={firstName} today={todayLabel} reviewCount={itemsAwaitingReview} />
      <SummaryStatGrid stats={stats} />
      <OverviewCharts
        eventsByStatus={tally(eventData.map((event) => event.status))}
        societiesByCategory={tally(societyData.map((society) => society.category))}
        registrationsOverTime={groupRegistrationsByMonth(registrationData)}
        registrationsByStatus={tally(registrationData.map((registration) => registration.status))}
        errors={{ events: eventResult.error?.message, societies: societyResult.error?.message, registrations: registrationResult.error?.message }}
      />
      <div className="grid gap-5 xl:grid-cols-2">
        <RecentSubmissionsList title="Recent society submissions" entries={recentSocietyEntries} error={societyResult.error?.message} />
        <RecentSubmissionsList title="Recent event submissions" entries={recentEventEntries} error={eventResult.error?.message} />
      </div>
      <RecentDecisionList decisions={recentDecisions} adminNames={adminNames} error={recentDecisionRpcMissing ? null : recentDecisionResult.error?.message ?? null} migrationMissing={recentDecisionRpcMissing} />
    </div>
  );

  const reviewContent = <ReviewQueue societies={societyQueue} events={eventQueue} societyError={societyResult.error?.message ?? rulesResult.error?.message ?? null} eventError={eventResult.error?.message ?? null} />;
  const activityContent = <ActivityLog decisions={activityDecisions} admins={admins} error={activityRpcMissing ? null : activityError} migrationMissing={activityRpcMissing} filters={{ search: activitySearch, type: activityType, action: activityAction, admin: activityAdmin, from: fromValue, to: toValue }} />;
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between"><div><p className="text-xs uppercase tracking-[0.2em] text-ink-muted">Overview</p><h2 className="mt-2 text-3xl font-semibold text-brand-deep">OSA command center</h2></div></div>
      <OverviewTabs activeTab={['summary', 'review-queue', 'activity-log'].includes(currentTab) ? currentTab : 'summary'}>
        {currentTab === 'review-queue' ? reviewContent : currentTab === 'activity-log' ? activityContent : summaryContent}
      </OverviewTabs>
    </div>
  );
}
