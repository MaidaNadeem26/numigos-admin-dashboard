import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { AdminStatusRuleRow, EventRow, SocietyMemberRow, SocietyRow } from '@/lib/database.types';
import { EmptyState, ErrorState } from '@/components/ui/loading-empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { ReviewDecisionActions } from '@/components/overview/review-decision-actions';

type SearchParams = Record<string, string | string[] | undefined>;
type QueryError = { message: string };
type SocietyPageRow = Pick<SocietyRow, 'id' | 'name' | 'short_name' | 'category' | 'dept' | 'faculty_advisor' | 'status' | 'created_at' | 'members_count' | 'events_count'>;
type SocietyFilterRow = Pick<SocietyRow, 'status' | 'category' | 'dept'>;
type MemberCountRow = Pick<SocietyMemberRow, 'society_id'>;
type EventCountRow = Pick<EventRow, 'society_id'>;
type TeamRow = Pick<SocietyMemberRow, 'id' | 'society_id' | 'user_id' | 'name' | 'roll_number' | 'role' | 'group_name' | 'department' | 'email' | 'avatar' | 'joined_date' | 'created_at'>;
type SocietyMini = Pick<SocietyRow, 'id' | 'name'>;

const pageSize = 10;
const societyColumns = 'id,name,short_name,category,dept,faculty_advisor,status,created_at,members_count,events_count';
const teamColumns = 'id,society_id,user_id,name,roll_number,role,group_name,department,email,avatar,joined_date,created_at';

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function numberParam(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function escapedSearch(value: string) {
  return value.replace(/[\\,"()]/g, '\\$&');
}

function withParams(params: Record<string, string>, overrides: Record<string, string | null>) {
  const next = new URLSearchParams(params);
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null || value === '') next.delete(key);
    else next.set(key, value);
  }
  return `/societies?${next.toString()}`;
}

function getReviewStatuses(rules: AdminStatusRuleRow[]) {
  return new Set(rules
    .filter((rule) => rule.entity_type?.toLowerCase() === 'society')
    .flatMap((rule) => Array.isArray(rule.from_statuses) ? rule.from_statuses : []));
}

function stringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry === 'string') return [entry];
    if (entry && typeof entry === 'object' && 'action' in entry && typeof entry.action === 'string') return [entry.action];
    return [];
  });
}

function actionsForStatus(rules: AdminStatusRuleRow[], status: string) {
  const actions = new Set<string>();
  for (const rule of rules) {
    if (rule.entity_type?.toLowerCase() !== 'society') continue;
    if (!Array.isArray(rule.from_statuses) || !rule.from_statuses.includes(status)) continue;
    const row = rule as Record<string, unknown>;
    for (const action of stringList(row.actions)) actions.add(action);
    for (const key of ['action', 'decision', 'allowed_action']) {
      if (typeof row[key] === 'string') actions.add(row[key] as string);
    }
  }
  return [...actions];
}

async function fetchAllPages<T>(getPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: QueryError | null }>) {
  const rows: T[] = [];
  let from = 0;
  const batchSize = 1000;
  try {
    while (true) {
      const result = await getPage(from, from + batchSize - 1);
      if (result.error) return { rows: [] as T[], error: result.error.message };
      const batch = result.data ?? [];
      rows.push(...batch);
      if (batch.length < batchSize) return { rows, error: null as string | null };
      from += batchSize;
    }
  } catch (error) {
    return { rows: [] as T[], error: error instanceof Error ? error.message : 'Database query failed.' };
  }
}

function paginationLinks(tab: string, page: number, totalPages: number, params: Record<string, string>) {
  return totalPages <= 1 ? null : (
    <nav className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-ink" aria-label={`${tab} pagination`}>
      <Link aria-disabled={page <= 1} className={`osa-button border border-line px-4 py-2 ${page <= 1 ? 'pointer-events-none bg-field text-ink-muted' : 'bg-surface text-ink'}`} href={withParams(params, { page: String(Math.max(1, page - 1)) })}>Previous</Link>
      <span>Page {page} of {totalPages}</span>
      <Link aria-disabled={page >= totalPages} className={`osa-button border border-line px-4 py-2 ${page >= totalPages ? 'pointer-events-none bg-field text-ink-muted' : 'bg-surface text-ink'}`} href={withParams(params, { page: String(Math.min(totalPages, page + 1)) })}>Next</Link>
    </nav>
  );
}

function TabNavigation({ active, params }: { active: string; params: Record<string, string> }) {
  const tabs = [
    { id: 'all', label: 'All societies' },
    { id: 'approvals', label: 'Approvals' },
    { id: 'teams', label: 'Teams' },
  ];
  return (
    <nav className="flex gap-2 overflow-x-auto overscroll-x-contain pb-1" aria-label="Society sections">
      {tabs.map((tab) => <Link key={tab.id} href={withParams(params, { tab: tab.id, page: '1' })} aria-current={active === tab.id ? 'page' : undefined} className={`osa-button shrink-0 border px-4 py-2 text-sm font-medium transition ${active === tab.id ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-ink-muted hover:border-brand/40 hover:text-brand-strong'}`}>{tab.label}</Link>)}
    </nav>
  );
}

function FilterSelect({ name, label, value, options }: { name: string; label: string; value: string; options: string[] }) {
  return (
    <label className="grid gap-1 text-xs font-medium text-ink-muted">
      {label}
      <select name={name} defaultValue={value} className="osa-field min-w-0 px-3 py-2 text-sm text-ink outline-none">
        <option value="">All {label.toLowerCase()}</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function EmptySocieties() {
  return <EmptyState title="No societies found" description="No societies match the current search and filters." />;
}

async function AllSocietiesTab({ params, search, status, category, department, sort, page }: { params: Record<string, string>; search: string; status: string; category: string; department: string; sort: string; page: number }) {
  const supabase = createServerSupabaseClient();
  const filtersQuery = fetchAllPages<SocietyFilterRow>((from, to) => supabase.from('societies').select('status,category,dept').range(from, to));
  const membersQuery = fetchAllPages<MemberCountRow>((from, to) => supabase.from('society_members').select('society_id').range(from, to));
  const eventsQuery = fetchAllPages<EventCountRow>((from, to) => supabase.from('events').select('society_id').range(from, to));

  const [filterResult, memberResult, eventResult] = await Promise.all([filtersQuery, membersQuery, eventsQuery]);
  let societyQuery = supabase.from('societies').select(societyColumns, { count: 'exact' });
  if (search) {
    const needle = escapedSearch(search);
    societyQuery = societyQuery.or(`name.ilike."%${needle}%",short_name.ilike."%${needle}%"`);
  }
  if (status) societyQuery = societyQuery.eq('status', status);
  if (category) societyQuery = societyQuery.eq('category', category as SocietyRow['category']);
  if (department) societyQuery = societyQuery.eq('dept', department);

  const sortColumns: Record<string, keyof SocietyRow> = { name: 'name', category: 'category', department: 'dept', created: 'created_at', status: 'status' };
  const sortColumn = sortColumns[sort] ?? 'name';
  const ascending = first(params.direction) !== 'desc';
  const from = (page - 1) * pageSize;
  const { data, count, error } = await societyQuery.order(sortColumn, { ascending, nullsFirst: false }).range(from, from + pageSize - 1);

  const filterValues = filterResult.rows;
  const statuses = [...new Set(filterValues.map((row) => row.status).filter((value): value is string => Boolean(value)))].sort();
  const categories = [...new Set(filterValues.map((row) => row.category).filter(Boolean))].sort();
  const departments = [...new Set(filterValues.map((row) => row.dept).filter((value): value is string => Boolean(value)))].sort();
  const memberCounts = new Map<string, number>();
  const eventCounts = new Map<string, number>();
  for (const row of memberResult.rows) memberCounts.set(row.society_id, (memberCounts.get(row.society_id) ?? 0) + 1);
  for (const row of eventResult.rows) eventCounts.set(row.society_id, (eventCounts.get(row.society_id) ?? 0) + 1);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / pageSize));
  const errorMessage = error?.message ?? filterResult.error ?? memberResult.error ?? eventResult.error;

  return (
      <div className="space-y-5">
        <form action="/societies" method="get" className="grid gap-3 rounded-[22px] border border-line bg-surface p-4 shadow-[0_5px_20px_rgba(11,48,41,0.04)] md:grid-cols-2 xl:grid-cols-6">
          <input type="hidden" name="tab" value="all" />
          <label className="grid gap-1 text-xs font-medium text-ink-muted xl:col-span-2">Search<input name="search" defaultValue={search} placeholder="Name or short name" className="osa-field min-w-0 px-4 py-2 text-sm text-ink outline-none" /></label>
          <FilterSelect name="status" label="Status" value={status} options={statuses} />
          <FilterSelect name="category" label="Category" value={category} options={categories} />
          <FilterSelect name="department" label="Department" value={department} options={departments} />
          <label className="grid gap-1 text-xs font-medium text-ink-muted">Sort by<select name="sort" defaultValue={sort} className="osa-field min-w-0 px-3 py-2 text-sm text-ink outline-none"><option value="name">Name</option><option value="category">Category</option><option value="department">Department</option><option value="status">Status</option><option value="created">Created date</option></select></label>
          <label className="grid gap-1 text-xs font-medium text-ink-muted">Order<select name="direction" defaultValue={ascending ? 'asc' : 'desc'} className="osa-field min-w-0 px-3 py-2 text-sm text-ink outline-none"><option value="asc">Ascending</option><option value="desc">Descending</option></select></label>
          <div className="flex items-end gap-2 md:col-span-2 xl:col-span-4"><button className="osa-button bg-brand px-5 py-2 text-sm font-semibold text-white hover:bg-brand-strong">Apply filters</button><Link href="/societies?tab=all" className="osa-button border border-line bg-field px-5 py-2 text-sm font-medium text-ink">Clear</Link></div>
        </form>
        {errorMessage ? <ErrorState title="Societies could not be loaded" description={errorMessage} /> : data?.length ? (
          <section className="overflow-hidden rounded-[22px] border border-line bg-surface shadow-[0_5px_20px_rgba(11,48,41,0.04)]">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-field text-xs uppercase tracking-wide text-ink-muted"><tr><th className="px-4 py-3">Society</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Department</th><th className="px-4 py-3">Faculty advisor</th><th className="px-4 py-3">Members</th><th className="px-4 py-3">Events</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Created</th></tr></thead>
                <tbody className="divide-y divide-line">{data.map((society) => <tr key={society.id} className="relative cursor-pointer transition hover:bg-brand-mist/60"><td className="p-0"><Link className="after:absolute after:inset-0 after:content-['']" href={`/societies/${encodeURIComponent(society.id)}`}><span className="relative z-1 block px-4 py-3"><span className="font-semibold text-brand-deep">{society.name}</span><span className="mt-0.5 block text-xs text-ink-muted">{society.short_name}</span></span></Link></td><td className="px-4 py-3">{society.category}</td><td className="px-4 py-3">{society.dept ?? '—'}</td><td className="px-4 py-3">{society.faculty_advisor ?? '—'}</td><td className="px-4 py-3 tabular-nums">{memberCounts.get(society.id) ?? 0}</td><td className="px-4 py-3 tabular-nums">{eventCounts.get(society.id) ?? 0}</td><td className="px-4 py-3"><StatusBadge label={society.status} /></td><td className="px-4 py-3 text-ink-muted">{new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(society.created_at))}</td></tr>)}</tbody>
              </table>
            </div>
            {paginationLinks('all', page, totalPages, params)}
          </section>
        ) : <EmptySocieties />}
        {filterResult.error || memberResult.error || eventResult.error ? <p role="alert" className="text-xs text-warning">Some filter/count data could not be loaded: {[filterResult.error, memberResult.error, eventResult.error].filter(Boolean).join(' · ')}</p> : null}
      </div>
  );
}

async function ApprovalsTab() {
  const supabase = createServerSupabaseClient();
  const [societyResult, rulesResult] = await Promise.all([
    supabase.from('societies').select(societyColumns).order('created_at', { ascending: true }),
    supabase.from('admin_status_rules').select('*'),
  ]);
  if (societyResult.error) return <ErrorState title="Society approvals unavailable" description={societyResult.error.message} />;
  if (rulesResult.error) return <ErrorState title="Society approval rules unavailable" description={rulesResult.error.message} />;
  const rules = (rulesResult.data ?? []) as AdminStatusRuleRow[];
  const reviewStatuses = getReviewStatuses(rules);
  const pending = ((societyResult.data ?? []) as SocietyPageRow[]).filter((society) => reviewStatuses.has(society.status));
  if (pending.length === 0) return <EmptyState title="No societies awaiting review" description="No society status matches from_statuses in the society rules." />;
  return (
    <div className="space-y-3">{pending.map((society) => <article key={society.id} className="rounded-[22px] border border-line bg-surface p-5 shadow-[0_5px_20px_rgba(11,48,41,0.04)]"><div className="flex flex-wrap items-start justify-between gap-4"><div><Link href={`/societies/${encodeURIComponent(society.id)}`} className="font-semibold text-brand-deep hover:underline">{society.name}</Link><p className="mt-1 text-sm text-ink-muted">{society.category} · {society.dept ?? 'Department not listed'} · Created {new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(society.created_at))}</p></div><StatusBadge label={society.status} /></div><div className="mt-4"><ReviewDecisionActions entityType="society" entityId={society.id} availableActions={actionsForStatus(rules, society.status)} /></div></article>)}</div>
  );
}

async function TeamsTab(params: Record<string, string>, search: string, societyId: string, group: string, role: string, department: string, page: number, selectedId: string) {
  const supabase = createServerSupabaseClient();
  const [societyOptionsResult, distinctResult] = await Promise.all([
    supabase.from('societies').select('id,name').order('name'),
    fetchAllPages<Pick<SocietyMemberRow, 'group_name' | 'role' | 'department'>>((from, to) => supabase.from('society_members').select('group_name,role,department').range(from, to)),
  ]);
  let membersQuery = supabase.from('society_members').select(teamColumns, { count: 'exact' });
  if (search) {
    const needle = escapedSearch(search);
    membersQuery = membersQuery.or(`name.ilike."%${needle}%",roll_number.ilike."%${needle}%"`);
  }
  if (societyId) membersQuery = membersQuery.eq('society_id', societyId);
  if (group) membersQuery = membersQuery.eq('group_name', group as SocietyMemberRow['group_name']);
  if (role) membersQuery = membersQuery.eq('role', role);
  if (department) membersQuery = membersQuery.eq('department', department);
  const start = (page - 1) * pageSize;
  const [memberResult, allMembersResult] = await Promise.all([
    membersQuery.order('name').range(start, start + pageSize - 1),
    fetchAllPages<TeamRow>((from, to) => supabase.from('society_members').select(teamColumns).order('name').range(from, to)),
  ]);

  const rows = (memberResult.data ?? []) as TeamRow[];
  const count = memberResult.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  const societyOptions = (societyOptionsResult.data ?? []) as SocietyMini[];
  const societyNames = new Map(societyOptions.map((society) => [society.id, society.name]));
  const distinct = distinctResult.rows;
  const groups = [...new Set(distinct.map((row) => row.group_name).filter(Boolean))].sort();
  const roles = [...new Set(distinct.map((row) => row.role).filter(Boolean))].sort();
  const departments = [...new Set(distinct.map((row) => row.department).filter((value): value is string => Boolean(value)))].sort();
  const selectedMember = (allMembersResult.rows.find((member) => member.id === selectedId) ?? rows[0]) || null;
  const profileResult = selectedMember?.user_id
    ? await supabase.from('profiles').select('id,email,full_name,roll_number,department,semester,avatar_url').eq('id', selectedMember.user_id).maybeSingle()
    : null;
  const memberError = memberResult.error?.message ?? null;
  const filterError = societyOptionsResult.error?.message ?? distinctResult.error ?? allMembersResult.error;
  const profileError = profileResult?.error?.message ?? null;
  const profile = profileResult?.data ?? null;

  return (
    <div className="space-y-5">
      {filterError ? <ErrorState title="Team filters or details unavailable" description={filterError} /> : null}
      <form action="/societies" method="get" className="grid gap-3 rounded-[22px] border border-line bg-surface p-4 shadow-[0_5px_20px_rgba(11,48,41,0.04)] md:grid-cols-2 xl:grid-cols-5">
        <input type="hidden" name="tab" value="teams" />
        <label className="grid gap-1 text-xs font-medium text-ink-muted xl:col-span-2">Search<input name="search" defaultValue={search} placeholder="Member name or roll number" className="osa-field min-w-0 px-4 py-2 text-sm text-ink outline-none" /></label>
        <label className="grid gap-1 text-xs font-medium text-ink-muted">Society<select name="society" defaultValue={societyId} className="osa-field min-w-0 px-3 py-2 text-sm text-ink outline-none"><option value="">All societies</option>{societyOptions.map((society) => <option key={society.id} value={society.id}>{society.name}</option>)}</select></label>
        <FilterSelect name="group" label="Group" value={group} options={groups} />
        <FilterSelect name="role" label="Role" value={role} options={roles} />
        <FilterSelect name="department" label="Department" value={department} options={departments} />
        <div className="flex items-end gap-2 md:col-span-2 xl:col-span-5"><button className="osa-button bg-brand px-5 py-2 text-sm font-semibold text-white hover:bg-brand-strong">Apply filters</button><Link href="/societies?tab=teams" className="osa-button border border-line bg-field px-5 py-2 text-sm font-medium text-ink">Clear</Link></div>
      </form>
      {memberError ? <ErrorState title="Society team unavailable" description={memberError} /> : rows.length === 0 ? <EmptyState title="No team members found" description="No society members match the current search and filters." /> : (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]">
          <section className="overflow-hidden rounded-[22px] border border-line bg-surface shadow-[0_5px_20px_rgba(11,48,41,0.04)]">
            <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-field text-xs uppercase tracking-wide text-ink-muted"><tr><th className="px-4 py-3">Member</th><th className="px-4 py-3">Society</th><th className="px-4 py-3">Group</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Department</th></tr></thead><tbody className="divide-y divide-line">{rows.map((member) => <tr key={member.id} className={selectedMember?.id === member.id ? 'bg-brand-mist/60' : ''}><td className="p-0"><Link href={withParams(params, { member: member.id })} className="block px-4 py-3"><span className="font-semibold text-brand-deep">{member.name}</span><span className="mt-0.5 block text-xs text-ink-muted">{member.roll_number}</span></Link></td><td className="px-4 py-3">{societyNames.get(member.society_id) ?? member.society_id}</td><td className="px-4 py-3">{member.group_name}</td><td className="px-4 py-3">{member.role}</td><td className="px-4 py-3">{member.department ?? '—'}</td></tr>)}</tbody></table></div>
            {paginationLinks('teams', page, totalPages, params)}
          </section>
          <aside className="rounded-[22px] border border-line bg-surface p-5 shadow-[0_5px_20px_rgba(11,48,41,0.04)]" aria-label="Member details">
            {selectedMember ? <><div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-full bg-brand-soft font-bold uppercase text-brand">{selectedMember.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('')}</span><div><h3 className="font-semibold text-ink">{selectedMember.name}</h3><p className="text-xs text-ink-muted">{societyNames.get(selectedMember.society_id) ?? selectedMember.society_id}</p></div></div><dl className="mt-5 space-y-3 text-sm"><Detail label="Roll number" value={profile?.roll_number ?? selectedMember.roll_number} /><Detail label="Group" value={selectedMember.group_name} /><Detail label="Role" value={selectedMember.role} /><Detail label="Department" value={profile?.department ?? selectedMember.department} /><Detail label="Email" value={profile?.email ?? selectedMember.email} /><Detail label="Semester" value={profile?.semester} /><Detail label="Joined" value={selectedMember.joined_date} /></dl>{profileError ? <p className="mt-4 text-xs text-warning" role="status">Profile details unavailable: {profileError}</p> : null}</> : <EmptyState title="Select a member" description="Member details will appear here." />}
          </aside>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return <div className="grid grid-cols-[110px_1fr] gap-2"><dt className="text-ink-muted">{label}</dt><dd className="wrap-break-word text-ink">{value || '—'}</dd></div>;
}

export default async function SocietiesPage({ searchParams = {} }: { searchParams?: SearchParams }) {
  const params = Object.fromEntries(Object.entries(searchParams).flatMap(([key, value]) => {
    const selected = first(value);
    return selected === undefined ? [] : [[key, selected]];
  }));
  const tab = ['all', 'approvals', 'teams'].includes(params.tab ?? '') ? params.tab! : 'all';
  const page = numberParam(params.page, 1);
  const content = tab === 'approvals'
    ? await ApprovalsTab()
    : tab === 'teams'
      ? await TeamsTab(params, params.search ?? '', params.society ?? '', params.group ?? '', params.role ?? '', params.department ?? '', page, params.member ?? '')
      : await AllSocietiesTab({ params, search: params.search ?? '', status: params.status ?? '', category: params.category ?? '', department: params.department ?? '', sort: params.sort ?? 'name', page });

  return (
    <div className="space-y-6">
      <header><p className="text-xs uppercase tracking-[0.2em] text-ink-muted">Societies</p><h2 className="mt-2 text-3xl font-semibold text-brand-deep">Society operations</h2></header>
      <TabNavigation active={tab} params={params} />
      {content}
    </div>
  );
}
