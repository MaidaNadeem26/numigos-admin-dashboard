import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { AdminStatusRuleRow, EventRow, ProfileRow, RegistrationRow, SocietyRow } from '@/lib/database.types';
import { EmptyState, ErrorState } from '@/components/ui/loading-empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { ReviewDecisionActions } from '@/components/overview/review-decision-actions';
import { DataTable } from '@/components/ui/data-table';
import { QueryPagination } from '@/components/ui/query-pagination';

type SearchParams = Record<string, string | string[] | undefined>;
type QueryError = { message: string };
type EventListRow = Pick<EventRow, 'id' | 'society_id' | 'society_name' | 'title' | 'short_title' | 'category' | 'date' | 'date_label' | 'time' | 'time_label' | 'venue' | 'capacity' | 'registered_count' | 'registrations_count' | 'status' | 'submitted_at' | 'created_at'>;
type EventDetails = EventRow;
type RegistrationListRow = Pick<RegistrationRow, 'id' | 'event_id' | 'user_id' | 'event_title' | 'name' | 'roll_number' | 'department' | 'semester' | 'email' | 'status' | 'registered_at'>;
type ProfileMini = Pick<ProfileRow, 'id' | 'full_name' | 'email' | 'roll_number' | 'department'>;
type SocietyMini = Pick<SocietyRow, 'id' | 'name'>;
type DecisionRow = { id: string; entity_type: string; entity_id: string; action: string; previous_status: string; new_status: string; notes: string | null; actor_id: string; created_at: string };

const pageSize = 10;
const eventColumns = 'id,society_id,society_name,title,short_title,category,date,date_label,time,time_label,venue,capacity,registered_count,registrations_count,status,submitted_at,created_at';
const registrationColumns = 'id,event_id,user_id,event_title,name,roll_number,department,semester,email,status,registered_at';

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function positivePage(value: string | undefined) {
  const page = Number.parseInt(value ?? '', 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function escapedSearch(value: string) {
  return value.replace(/[\\,"()]/g, '\\$&');
}

function paramsHref(params: Record<string, string>, overrides: Record<string, string | null>) {
  const next = new URLSearchParams(params);
  for (const [key, value] of Object.entries(overrides)) {
    if (!value) next.delete(key);
    else next.set(key, value);
  }
  return `/events?${next.toString()}`;
}

function parseDate(value: string | null | undefined): number | null {
  if (!value?.trim()) return null;
  const text = value.trim();
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(text);
  const timestamp = Date.parse(dateOnly ? `${text}T00:00:00` : text);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function dateInRange(value: string, from: string, to: string) {
  const parsed = parseDate(value);
  if (parsed === null) return false;
  const fromValue = parseDate(from);
  const toValue = parseDate(to);
  const toInclusive = toValue === null ? null : toValue + 86_399_999;
  return (fromValue === null || parsed >= fromValue) && (toInclusive === null || parsed <= toInclusive);
}

function eventDateLabel(event: Pick<EventRow, 'date' | 'date_label' | 'time' | 'time_label'>) {
  const timestamp = parseDate(event.date);
  const dateLabel = event.date_label || (timestamp === null ? event.date : new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(timestamp));
  const timeLabel = event.time_label || event.time;
  return timeLabel ? `${dateLabel} · ${timeLabel}` : dateLabel;
}

function submittedLabel(value: string) {
  const timestamp = parseDate(value);
  return timestamp === null ? value : new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(timestamp);
}

function ruleActions(rules: AdminStatusRuleRow[], entityType: string, status: string) {
  const result = new Set<string>();
  for (const rule of rules) {
    if (rule.entity_type?.toLowerCase() !== entityType.toLowerCase()) continue;
    if (!Array.isArray(rule.from_statuses) || !rule.from_statuses.includes(status)) continue;
    const data = rule as Record<string, unknown>;
    const list = data.actions;
    if (Array.isArray(list)) {
      for (const item of list) {
        if (typeof item === 'string') result.add(item);
        else if (item && typeof item === 'object' && 'action' in item && typeof item.action === 'string') result.add(item.action);
      }
    }
    for (const key of ['action', 'decision', 'allowed_action']) if (typeof data[key] === 'string') result.add(data[key] as string);
  }
  return [...result];
}

async function fetchAllPages<T>(getPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: QueryError | null }>) {
  const rows: T[] = [];
  let from = 0;
  const batchSize = 1000;
  try {
    while (true) {
      const { data, error } = await getPage(from, from + batchSize - 1);
      if (error) return { rows: [] as T[], error: error.message };
      const batch = data ?? [];
      rows.push(...batch);
      if (batch.length < batchSize) return { rows, error: null as string | null };
      from += batchSize;
    }
  } catch (error) {
    return { rows: [] as T[], error: error instanceof Error ? error.message : 'Database query failed.' };
  }
}

function SelectFilter({ name, label, value, values }: { name: string; label: string; value: string; values: string[] }) {
  return <label className="grid gap-1 text-xs font-medium text-ink-muted">{label}<select name={name} defaultValue={value} className="osa-field min-w-0 px-3 py-2 text-sm text-ink outline-none"><option value="">All {label.toLowerCase()}</option>{values.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function EventTabs({ active, params }: { active: string; params: Record<string, string> }) {
  const tabs = [{ id: 'all', label: 'All events' }, { id: 'approvals', label: 'Approvals' }, { id: 'registrations', label: 'Registrations' }];
  return <nav className="flex gap-2 overflow-x-auto overscroll-x-contain pb-1" aria-label="Event sections">{tabs.map((tab) => <Link key={tab.id} href={paramsHref(params, { tab: tab.id, page: '1' })} aria-current={active === tab.id ? 'page' : undefined} className={`osa-button shrink-0 border px-4 py-2 text-sm font-medium transition ${active === tab.id ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-ink-muted hover:border-brand/40 hover:text-brand-strong'}`}>{tab.label}</Link>)}</nav>;
}

async function AllEventsTab({ params, search, status, society, category, venue, fromDate, toDate, sort, direction, page }: { params: Record<string, string>; search: string; status: string; society: string; category: string; venue: string; fromDate: string; toDate: string; sort: string; direction: string; page: number }) {
  const supabase = createServerSupabaseClient();
  const [allResult, eventOptionsResult] = await Promise.all([
    fetchAllPages<EventListRow>((from, to) => {
      let query = supabase.from('events').select(eventColumns);
      if (search) {
        const needle = escapedSearch(search);
        query = query.or(`title.ilike."%${needle}%",society_name.ilike."%${needle}%"`);
      }
      if (status) query = query.eq('status', status as EventRow['status']);
      if (society) query = query.eq('society_id', society);
      if (category) query = query.eq('category', category as EventRow['category']);
      if (venue) query = query.eq('venue', venue);
      return query.range(from, to);
    }),
    fetchAllPages<Pick<EventRow, 'status' | 'society_id' | 'society_name' | 'category' | 'venue' | 'date'>>((from, to) => supabase.from('events').select('status,society_id,society_name,category,venue,date').range(from, to)),
  ]);
  const options = eventOptionsResult.rows;
  const statuses = [...new Set(options.map((event) => event.status).filter(Boolean))].sort();
  const societies = [...new Map(options.map((event) => [event.society_id, event.society_name])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const categories = [...new Set(options.map((event) => event.category).filter(Boolean))].sort();
  const venues = [...new Set(options.map((event) => event.venue).filter(Boolean))].sort();
  const filtered = allResult.rows.filter((event) => (!fromDate && !toDate) || dateInRange(event.date, fromDate, toDate));
  const sortColumns: Record<string, (event: EventListRow) => string | number> = {
    title: (event) => event.title.toLocaleLowerCase(),
    society: (event) => event.society_name.toLocaleLowerCase(),
    category: (event) => event.category.toLocaleLowerCase(),
    date: (event) => parseDate(event.date) ?? Number.MAX_SAFE_INTEGER,
    submitted: (event) => parseDate(event.submitted_at) ?? Number.MAX_SAFE_INTEGER,
    status: (event) => event.status.toLocaleLowerCase(),
  };
  const orderBy = sortColumns[sort] ?? sortColumns.submitted;
  filtered.sort((left, right) => {
    const a = orderBy(left);
    const b = orderBy(right);
    const comparison = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b));
    return direction === 'asc' ? comparison : -comparison;
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const tableRows = pageRows.map((event) => ({ ...event }));
  const queryError = allResult.error ?? eventOptionsResult.error;
  const pageHref = (nextPage: number) => paramsHref(params, { page: String(nextPage) });

  return (
    <div className="space-y-5">
      <form action="/events" method="get" className="grid gap-3 rounded-[22px] border border-line bg-surface p-4 shadow-[0_5px_20px_rgba(11,48,41,0.04)] md:grid-cols-2 xl:grid-cols-6">
        <input type="hidden" name="tab" value="all" />
        <label className="grid gap-1 text-xs font-medium text-ink-muted xl:col-span-2">Search<input name="search" defaultValue={search} placeholder="Title or society name" className="osa-field min-w-0 px-4 py-2 text-sm text-ink outline-none" /></label>
        <SelectFilter name="status" label="Status" value={status} values={statuses} />
        <label className="grid gap-1 text-xs font-medium text-ink-muted">Society<select name="society" defaultValue={society} className="osa-field min-w-0 px-3 py-2 text-sm text-ink outline-none"><option value="">All societies</option>{societies.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        <SelectFilter name="category" label="Category" value={category} values={categories} />
        <SelectFilter name="venue" label="Venue" value={venue} values={venues} />
        <div className="grid grid-cols-2 gap-3 md:col-span-2 xl:col-span-3"><label className="grid gap-1 text-xs font-medium text-ink-muted">From date<input type="date" name="from" defaultValue={fromDate} className="osa-field min-w-0 px-3 py-2 text-sm text-ink outline-none" /></label><label className="grid gap-1 text-xs font-medium text-ink-muted">To date<input type="date" name="to" defaultValue={toDate} className="osa-field min-w-0 px-3 py-2 text-sm text-ink outline-none" /></label></div>
        <label className="grid gap-1 text-xs font-medium text-ink-muted">Sort by<select name="sort" defaultValue={sort} className="osa-field min-w-0 px-3 py-2 text-sm text-ink outline-none"><option value="submitted">Submitted</option><option value="date">Event date</option><option value="title">Title</option><option value="society">Society</option><option value="category">Category</option><option value="status">Status</option></select></label>
        <label className="grid gap-1 text-xs font-medium text-ink-muted">Order<select name="direction" defaultValue={direction} className="osa-field min-w-0 px-3 py-2 text-sm text-ink outline-none"><option value="desc">Descending</option><option value="asc">Ascending</option></select></label>
        <div className="flex items-end gap-2 md:col-span-2 xl:col-span-3"><button className="osa-button bg-brand px-5 py-2 text-sm font-semibold text-white hover:bg-brand-strong">Apply filters</button><Link href="/events?tab=all" className="osa-button border border-line bg-field px-5 py-2 text-sm font-medium text-ink">Clear</Link></div>
      </form>
      {queryError ? <ErrorState title="Events could not be loaded" description={queryError} /> : pageRows.length === 0 ? <EmptyState title="No events found" description="No event records match these search terms, filters, or safely parsed date range." /> : (
        <section className="space-y-3">
          <DataTable rows={tableRows} columns={[
            { key: 'title', header: 'Title', render: (event) => <Link className="font-semibold text-brand-deep hover:underline" href={`/events/${encodeURIComponent(event.id)}`}>{event.title}{event.short_title ? <span className="mt-0.5 block text-xs font-normal text-ink-muted">{event.short_title}</span> : null}</Link> },
            { key: 'society_name', header: 'Society' },
            { key: 'category', header: 'Category' },
            { key: 'date', header: 'Date / time', render: (event) => eventDateLabel(event) },
            { key: 'venue', header: 'Venue' },
            { key: 'capacity', header: 'Capacity' },
            { key: 'registered_count', header: 'Registered' },
            { key: 'submitted_at', header: 'Submitted', render: (event) => submittedLabel(event.submitted_at) },
            { key: 'status', header: 'Status', render: (event) => <StatusBadge label={event.status} /> },
          ]} />
          <QueryPagination page={page} totalPages={pageCount} />
        </section>
      )}
    </div>
  );
}

async function ApprovalsTab() {
  const supabase = createServerSupabaseClient();
  const [eventResult, rulesResult] = await Promise.all([
    fetchAllPages<EventListRow>((from, to) => supabase.from('events').select(eventColumns).order('submitted_at', { ascending: true }).range(from, to)),
    fetchAllPages<AdminStatusRuleRow>((from, to) => supabase.from('admin_status_rules').select('*').range(from, to)),
  ]);
  if (eventResult.error) return <ErrorState title="Event approvals unavailable" description={eventResult.error} />;
  if (rulesResult.error) return <ErrorState title="Event approval rules unavailable" description={rulesResult.error} />;
  const rules = rulesResult.rows;
  const reviewStatuses = new Set(rules.filter((rule) => rule.entity_type?.toLowerCase() === 'event').flatMap((rule) => Array.isArray(rule.from_statuses) ? rule.from_statuses : []));
  const pending = eventResult.rows.filter((event) => reviewStatuses.has(event.status));
  if (pending.length === 0) return <EmptyState title="No events awaiting review" description="No event status matches from_statuses in the event rules." />;
  return <div className="space-y-3">{pending.map((event) => <article key={event.id} className="rounded-[22px] border border-line bg-surface p-5 shadow-[0_5px_20px_rgba(11,48,41,0.04)]"><div className="flex flex-wrap items-start justify-between gap-4"><div><Link href={`/events/${encodeURIComponent(event.id)}`} className="font-semibold text-brand-deep hover:underline">{event.title}</Link><p className="mt-1 text-sm text-ink-muted">{event.society_name} · {event.category} · Submitted {submittedLabel(event.submitted_at)}</p><p className="mt-1 text-sm text-ink-muted">{eventDateLabel(event)} · {event.venue}</p></div><StatusBadge label={event.status} /></div><div className="mt-4"><ReviewDecisionActions entityType="event" entityId={event.id} availableActions={ruleActions(rules, 'event', event.status)} /></div></article>)}</div>;
}

async function RegistrationsTab({ params, search, eventId, societyId, status, fromDate, toDate, page }: { params: Record<string, string>; search: string; eventId: string; societyId: string; status: string; fromDate: string; toDate: string; page: number }) {
  const supabase = createServerSupabaseClient();
  const [registrationResult, eventResult, societyResult] = await Promise.all([
    fetchAllPages<RegistrationListRow>((from, to) => supabase.from('registrations').select(registrationColumns).order('registered_at', { ascending: false }).range(from, to)),
    fetchAllPages<Pick<EventRow, 'id' | 'title' | 'society_id' | 'society_name'>>((from, to) => supabase.from('events').select('id,title,society_id,society_name').range(from, to)),
    fetchAllPages<Pick<SocietyRow, 'id' | 'name'>>((from, to) => supabase.from('societies').select('id,name').range(from, to)),
  ]);
  const userIds = [...new Set(registrationResult.rows.map((registration) => registration.user_id).filter((id): id is string => Boolean(id)))];
  const profileResult = userIds.length
    ? await fetchAllPages<ProfileMini>((from, to) => supabase.from('profiles').select('id,full_name,email,roll_number,department').in('id', userIds).range(from, to))
    : { rows: [] as ProfileMini[], error: null as string | null };
  const events = eventResult.rows;
  const societies = societyResult.rows;
  const profiles = new Map(profileResult.rows.map((profile) => [profile.id, profile]));
  const eventMap = new Map(events.map((event) => [event.id, event]));
  const societyMap = new Map(societies.map((society) => [society.id, society]));
  const allRegistrations = registrationResult.rows.map((registration) => {
    const event = eventMap.get(registration.event_id);
    const profile = registration.user_id ? profiles.get(registration.user_id) : undefined;
    return { ...registration, studentName: profile?.full_name || registration.name || profile?.email || registration.email, roll: profile?.roll_number || registration.roll_number, eventTitle: event?.title || registration.event_title || registration.event_id, societyId: event?.society_id || '', societyName: event?.society_name || societyMap.get(event?.society_id ?? '')?.name || 'Unknown society' };
  });
  const eventOptions = [...new Map(events.map((event) => [event.id, event.title])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const societyOptions = [...new Map(societies.map((society) => [society.id, society.name])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const statusOptions = [...new Set(registrationResult.rows.map((registration) => registration.status))].sort();
  const needle = search.toLocaleLowerCase();
  const filtered = allRegistrations.filter((registration) => {
    const searchMatch = !needle || [registration.studentName, registration.roll, registration.eventTitle, registration.societyName].some((value) => value.toLocaleLowerCase().includes(needle));
    const eventMatch = !eventId || registration.event_id === eventId;
    const societyMatch = !societyId || registration.societyId === societyId;
    const statusMatch = !status || registration.status === status;
    const dateMatch = (!fromDate && !toDate) || dateInRange(registration.registered_at, fromDate, toDate);
    return searchMatch && eventMatch && societyMatch && statusMatch && dateMatch;
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const tableRows = pageRows.map((row) => ({ ...row }));
  const queryError = registrationResult.error ?? eventResult.error ?? societyResult.error ?? profileResult.error;
  const pageHref = (nextPage: number) => paramsHref(params, { page: String(nextPage) });

  return (
    <div className="space-y-5">
      <form action="/events" method="get" className="grid gap-3 rounded-[22px] border border-line bg-surface p-4 shadow-[0_5px_20px_rgba(11,48,41,0.04)] md:grid-cols-2 xl:grid-cols-6">
        <input type="hidden" name="tab" value="registrations" />
        <label className="grid gap-1 text-xs font-medium text-ink-muted xl:col-span-2">Search<input name="search" defaultValue={search} placeholder="Student, roll number, event, society" className="osa-field min-w-0 px-4 py-2 text-sm text-ink outline-none" /></label>
        <label className="grid gap-1 text-xs font-medium text-ink-muted">Event<select name="event" defaultValue={eventId} className="osa-field min-w-0 px-3 py-2 text-sm text-ink outline-none"><option value="">All events</option>{eventOptions.map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select></label>
        <label className="grid gap-1 text-xs font-medium text-ink-muted">Society<select name="society" defaultValue={societyId} className="osa-field min-w-0 px-3 py-2 text-sm text-ink outline-none"><option value="">All societies</option>{societyOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        <SelectFilter name="status" label="Attendance status" value={status} values={statusOptions} />
        <div className="grid grid-cols-2 gap-3 md:col-span-2 xl:col-span-3"><label className="grid gap-1 text-xs font-medium text-ink-muted">Registered from<input type="date" name="from" defaultValue={fromDate} className="osa-field min-w-0 px-3 py-2 text-sm text-ink outline-none" /></label><label className="grid gap-1 text-xs font-medium text-ink-muted">Registered to<input type="date" name="to" defaultValue={toDate} className="osa-field min-w-0 px-3 py-2 text-sm text-ink outline-none" /></label></div>
        <div className="flex items-end gap-2 md:col-span-2 xl:col-span-3"><button className="osa-button bg-brand px-5 py-2 text-sm font-semibold text-white hover:bg-brand-strong">Apply filters</button><Link href="/events?tab=registrations" className="osa-button border border-line bg-field px-5 py-2 text-sm font-medium text-ink">Clear</Link></div>
      </form>
      {queryError ? <ErrorState title="Registrations could not be loaded" description={queryError} /> : pageRows.length === 0 ? <EmptyState title="No registrations found" description="No registrations match this search, filters, or safely parsed registration date range." /> : (
        <div className="space-y-3"><DataTable rows={tableRows} columns={[
          { key: 'studentName', header: 'Student' },
          { key: 'roll', header: 'Roll number' },
          { key: 'eventTitle', header: 'Event', render: (row) => <Link className="font-medium text-brand hover:underline" href={`/events/${encodeURIComponent(row.event_id)}`}>{row.eventTitle}</Link> },
          { key: 'societyName', header: 'Society' },
          { key: 'registered_at', header: 'Registered', render: (row) => submittedLabel(row.registered_at) },
          { key: 'status', header: 'Attendance', render: (row) => <StatusBadge label={row.status} /> },
        ]} /><QueryPagination page={page} totalPages={pageCount} /></div>
      )}
    </div>
  );
}

export default async function EventsPage({ searchParams = {} }: { searchParams?: SearchParams }) {
  const params = Object.fromEntries(Object.entries(searchParams).flatMap(([key, value]) => {
    const selected = first(value);
    return selected === undefined ? [] : [[key, selected]];
  }));
  const tab = ['all', 'approvals', 'registrations'].includes(params.tab ?? '') ? params.tab! : 'all';
  const page = positivePage(params.page);
  const content = tab === 'approvals'
    ? await ApprovalsTab()
    : tab === 'registrations'
      ? await RegistrationsTab({ params, search: params.search ?? '', eventId: params.event ?? '', societyId: params.society ?? '', status: params.status ?? '', fromDate: params.from ?? '', toDate: params.to ?? '', page })
      : await AllEventsTab({ params, search: params.search ?? '', status: params.status ?? '', society: params.society ?? '', category: params.category ?? '', venue: params.venue ?? '', fromDate: params.from ?? '', toDate: params.to ?? '', sort: params.sort ?? 'submitted', direction: params.direction ?? 'desc', page });

  return <div className="space-y-6"><header><p className="text-xs uppercase tracking-[0.2em] text-ink-muted">Events</p><h2 className="mt-2 text-3xl font-semibold text-brand-deep">Event administration</h2></header><EventTabs active={tab} params={params} />{content}</div>;
}
