import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { ProfileRole, ProfileRow } from '@/lib/database.types';
import { DataTable } from '@/components/ui/data-table';
import { QueryPagination } from '@/components/ui/query-pagination';
import { EmptyState, ErrorState } from '@/components/ui/loading-empty-state';
import { StatusBadge } from '@/components/ui/status-badge';

type SearchParams = Record<string, string | string[] | undefined>;
type QueryError = { message: string };
type StudentRow = Pick<ProfileRow, 'id' | 'email' | 'full_name' | 'roll_number' | 'department' | 'semester' | 'is_verified' | 'role' | 'created_at' | 'avatar_url'>;
type FilterRow = Pick<ProfileRow, 'department' | 'semester' | 'is_verified' | 'role'>;
const pageSize = 10;
const studentColumns = 'id,email,full_name,roll_number,department,semester,is_verified,role,created_at,avatar_url';

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function pageNumber(value: string | undefined) {
  const page = Number.parseInt(value ?? '', 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function escapeSearch(value: string) {
  return value.replace(/[\\,"()]/g, '\\$&');
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase() || 'S';
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

function FilterSelect({ name, label, value, options }: { name: string; label: string; value: string; options: string[] }) {
  return <label className="grid gap-1 text-xs font-medium text-ink-muted">{label}<select name={name} defaultValue={value} className="osa-field min-w-0 px-3 py-2 text-sm text-ink outline-none"><option value="">All {label.toLowerCase()}</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

export default async function StudentsPage({ searchParams = {} }: { searchParams?: SearchParams }) {
  const params = Object.fromEntries(Object.entries(searchParams).flatMap(([key, value]) => {
    const selected = first(value);
    return selected === undefined ? [] : [[key, selected]];
  }));
  const search = params.search ?? '';
  const department = params.department ?? '';
  const semester = params.semester ?? '';
  const verified = params.verified ?? '';
  const role = params.role ?? '';
  const sort = params.sort ?? 'created';
  const direction = params.direction ?? 'desc';
  const page = pageNumber(params.page);
  const supabase = createServerSupabaseClient();
  const filterQuery = fetchAllPages<FilterRow>((from, to) => supabase.from('profiles').select('department,semester,is_verified,role').range(from, to));
  let studentQuery = supabase.from('profiles').select(studentColumns, { count: 'exact' });
  if (search) {
    const query = escapeSearch(search);
    studentQuery = studentQuery.or(`full_name.ilike."%${query}%",email.ilike."%${query}%",roll_number.ilike."%${query}%"`);
  }
  if (department) studentQuery = studentQuery.eq('department', department);
  if (semester) studentQuery = studentQuery.eq('semester', semester);
  if (verified === 'true') studentQuery = studentQuery.eq('is_verified', true);
  if (verified === 'false') studentQuery = studentQuery.eq('is_verified', false);
  if (role) studentQuery = studentQuery.eq('role', role as ProfileRole);

  const sortColumns: Record<string, keyof ProfileRow> = { name: 'full_name', email: 'email', roll: 'roll_number', department: 'department', semester: 'semester', role: 'role', verified: 'is_verified', created: 'created_at' };
  const sortColumn = sortColumns[sort] ?? 'created_at';
  const ascending = direction === 'asc';
  const start = (page - 1) * pageSize;
  const [filterResult, studentResult] = await Promise.all([
    filterQuery,
    studentQuery.order(sortColumn, { ascending, nullsFirst: false }).range(start, start + pageSize - 1),
  ]);

  const options = filterResult.rows;
  const departments = [...new Set(options.map((row) => row.department).filter((value): value is string => Boolean(value)))].sort();
  const semesters = [...new Set(options.map((row) => row.semester).filter((value): value is string => Boolean(value)))].sort();
  const roles = [...new Set(options.map((row) => row.role).filter(Boolean))].sort();
  const verifiedOptions = [...new Set(options.map((row) => row.is_verified))].sort((a, b) => Number(b) - Number(a));
  const students = (studentResult.data ?? []) as StudentRow[];
  const rows = students.map((student) => ({
    ...student,
    display_name: student.full_name || student.email,
    verification_label: student.is_verified ? 'Verified' : 'Unverified',
  }));
  const totalPages = Math.max(1, Math.ceil((studentResult.count ?? 0) / pageSize));
  const queryError = studentResult.error?.message ?? filterResult.error;

  return (
    <div className="space-y-6">
      <header><p className="text-xs uppercase tracking-[0.2em] text-ink-muted">Students</p><h2 className="mt-2 text-3xl font-semibold text-brand-deep">Student directory</h2></header>
      <form action="/students" method="get" className="grid gap-3 rounded-[22px] border border-line bg-surface p-4 shadow-[0_5px_20px_rgba(11,48,41,0.04)] md:grid-cols-2 xl:grid-cols-6">
        <label className="grid gap-1 text-xs font-medium text-ink-muted xl:col-span-2">Search<input name="search" defaultValue={search} placeholder="Name, email or roll number" className="osa-field min-w-0 px-4 py-2 text-sm text-ink outline-none" /></label>
        <FilterSelect name="department" label="Department" value={department} options={departments} />
        <FilterSelect name="semester" label="Semester" value={semester} options={semesters} />
        <label className="grid gap-1 text-xs font-medium text-ink-muted">Verified<select name="verified" defaultValue={verified} className="osa-field min-w-0 px-3 py-2 text-sm text-ink outline-none"><option value="">All verification states</option>{verifiedOptions.map((value) => <option key={String(value)} value={String(value)}>{value ? 'Verified' : 'Unverified'}</option>)}</select></label>
        <FilterSelect name="role" label="Role" value={role} options={roles} />
        <label className="grid gap-1 text-xs font-medium text-ink-muted">Sort by<select name="sort" defaultValue={sort} className="osa-field min-w-0 px-3 py-2 text-sm text-ink outline-none"><option value="created">Created date</option><option value="name">Name</option><option value="email">Email</option><option value="roll">Roll number</option><option value="department">Department</option><option value="semester">Semester</option><option value="role">Role</option><option value="verified">Verification</option></select></label>
        <label className="grid gap-1 text-xs font-medium text-ink-muted">Order<select name="direction" defaultValue={direction} className="osa-field min-w-0 px-3 py-2 text-sm text-ink outline-none"><option value="desc">Descending</option><option value="asc">Ascending</option></select></label>
        <div className="flex flex-wrap items-end gap-2 md:col-span-2 xl:col-span-4"><button className="osa-button w-full sm:w-auto bg-brand px-5 py-2 text-sm font-semibold text-white hover:bg-brand-strong">Apply filters</button><Link href="/students" className="osa-button w-full sm:w-auto border border-line bg-field px-5 py-2 text-center text-sm font-medium text-ink">Clear</Link></div>
      </form>
      {queryError ? <ErrorState title="Students could not be loaded" description={queryError} /> : students.length === 0 ? <EmptyState title="No students found" description="No profiles match this search and filter selection." /> : (
        <div className="space-y-3">
          <DataTable rows={rows} rowHref={(student) => `/students/${encodeURIComponent(String(student.id))}`} rowLabel={(student) => `View student ${String(student.display_name)}`} columns={[
            { key: 'display_name', header: 'Name', render: (student) => <span className="flex items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-semibold uppercase text-brand">{initials(String(student.display_name))}</span><span className="font-semibold text-brand-deep">{String(student.display_name)}</span></span> },
            { key: 'email', header: 'Email' },
            { key: 'roll_number', header: 'Roll number' },
            { key: 'department', header: 'Department' },
            { key: 'semester', header: 'Semester' },
            { key: 'verification_label', header: 'Verified', render: (student) => <StatusBadge label={String(student.verification_label)} /> },
            { key: 'role', header: 'Role', render: (student) => <StatusBadge label={String(student.role)} /> },
            { key: 'created_at', header: 'Created', render: (student) => new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(String(student.created_at))) },
          ]} />
          <QueryPagination page={page} totalPages={totalPages} />
        </div>
      )}
    </div>
  );
}
