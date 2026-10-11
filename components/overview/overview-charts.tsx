'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, ChartNoAxesCombined, ChartPie, ClipboardList } from 'lucide-react';
import { EmptyState, ErrorState } from '@/components/ui/loading-empty-state';

type ChartPoint = { label: string; value: number };
type TrendPoint = { label: string; value: number };

const chartPalette = ['#1e5d4b', '#f08b67', '#f5c76f', '#82ac9d', '#f2cc8f', '#14233d'];
const axisColor = '#687872';
const gridColor = '#dbe4e0';
const tooltipStyle = { borderColor: gridColor, borderRadius: 14, backgroundColor: '#ffffff', color: '#12251f', boxShadow: '0 8px 24px rgba(11,48,41,0.10)' };

function ChartFrame({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="flex min-h-[360px] flex-col rounded-[22px] border border-line bg-surface p-5 shadow-[0_7px_24px_rgba(11,48,41,0.055)] sm:p-6">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        <p className="mt-1 text-xs text-ink-muted">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function ChartEmpty({ title, icon: Icon }: { title: string; icon: typeof Activity }) {
  return (
    <div className="flex min-h-[260px] flex-1 flex-col items-center justify-center rounded-2xl bg-brand-mist/55 px-6 text-center">
      <span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-brand-soft text-brand"><Icon className="h-5 w-5" strokeWidth={1.7} /></span>
      <p className="text-sm font-semibold text-ink">Nothing to chart yet</p>
      <p className="mt-1 max-w-xs text-xs leading-5 text-ink-muted">{title} will appear as matching records arrive.</p>
    </div>
  );
}

function ChartError({ message }: { message: string }) {
  return <div className="flex min-h-[260px] flex-1 items-center"><ErrorState title="Chart unavailable" description={message} /></div>;
}

export function OverviewCharts({
  eventsByStatus,
  societiesByCategory,
  registrationsOverTime,
  registrationsByStatus,
  errors = {},
}: {
  eventsByStatus: ChartPoint[];
  societiesByCategory: ChartPoint[];
  registrationsOverTime: TrendPoint[];
  registrationsByStatus: ChartPoint[];
  errors?: { events?: string; societies?: string; registrations?: string };
}) {
  const registrationTotal = registrationsByStatus.reduce((total, point) => total + point.value, 0);
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <ChartFrame title="Events by status" subtitle="Distribution across the current event lifecycle">
        {errors.events ? <ChartError message={errors.events} /> : eventsByStatus.length === 0 ? <ChartEmpty title="Event status totals" icon={ClipboardList} /> : (
          <div className="h-[260px] w-full flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={eventsByStatus} margin={{ top: 8, right: 8, bottom: 4, left: -18 }}>
                <CartesianGrid stroke={gridColor} strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: axisColor, fontSize: 11 }} axisLine={{ stroke: gridColor }} tickLine={false} tickMargin={10} />
                <YAxis allowDecimals={false} tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#edf7f3' }} />
                <Bar dataKey="value" name="Events" fill="#1e5d4b" radius={[8, 8, 2, 2]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartFrame>

      <ChartFrame title="Societies by category" subtitle="How registered societies are distributed">
        {errors.societies ? <ChartError message={errors.societies} /> : societiesByCategory.length === 0 ? <ChartEmpty title="Society categories" icon={ChartPie} /> : (
          <div className="flex min-h-[260px] flex-1 flex-col justify-center">
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={societiesByCategory} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={58} outerRadius={88} paddingAngle={3} stroke="#ffffff" strokeWidth={3}>
                    {societiesByCategory.map((entry, index) => <Cell key={entry.label} fill={chartPalette[index % chartPalette.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 pt-2">
              {societiesByCategory.map((item, index) => <span key={item.label} className="inline-flex items-center gap-2 text-xs text-ink-muted"><span className="h-2.5 w-2.5 rounded-full" style={{ background: chartPalette[index % chartPalette.length] }} />{item.label}<strong className="font-semibold text-ink">{item.value}</strong></span>)}
            </div>
          </div>
        )}
      </ChartFrame>

      <ChartFrame title="Registrations over time" subtitle="Monthly registrations from event sign-up records">
        {errors.registrations ? <ChartError message={errors.registrations} /> : registrationsOverTime.length === 0 ? <ChartEmpty title="Registration activity" icon={ChartNoAxesCombined} /> : (
          <div className="h-[260px] w-full flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={registrationsOverTime} margin={{ top: 8, right: 8, bottom: 4, left: -18 }}>
                <defs><linearGradient id="registrationArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f08b67" stopOpacity={0.32} /><stop offset="100%" stopColor="#f2cc8f" stopOpacity={0.04} /></linearGradient></defs>
                <CartesianGrid stroke={gridColor} strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: axisColor, fontSize: 11 }} axisLine={{ stroke: gridColor }} tickLine={false} tickMargin={10} />
                <YAxis allowDecimals={false} tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="value" name="Registrations" stroke="#f08b67" strokeWidth={2.5} fill="url(#registrationArea)" activeDot={{ r: 5, fill: '#f5c76f', stroke: '#ffffff', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartFrame>

      <ChartFrame title="Registrations by attendance status" subtitle="Check-in outcomes across all event registrations">
        {errors.registrations ? <ChartError message={errors.registrations} /> : registrationsByStatus.length === 0 ? <ChartEmpty title="Attendance status" icon={Activity} /> : (
          <div className="flex min-h-[260px] flex-1 flex-col justify-center">
            <div className="relative h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={registrationsByStatus} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={64} outerRadius={92} paddingAngle={3} stroke="#ffffff" strokeWidth={3}>
                    {registrationsByStatus.map((entry, index) => <Cell key={entry.label} fill={chartPalette[index % chartPalette.length]} />)}
                    <Label position="center" content={({ viewBox }) => {
                      const box = viewBox as { cx?: number; cy?: number } | undefined;
                      return box?.cx === undefined || box.cy === undefined ? null : <g><text x={box.cx} y={box.cy - 5} textAnchor="middle" fill="#0b3029" fontSize="25" fontWeight="700">{registrationTotal.toLocaleString()}</text><text x={box.cx} y={box.cy + 15} textAnchor="middle" fill="#687872" fontSize="10">registrations</text></g>;
                    }} />
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 pt-2">
              {registrationsByStatus.map((item, index) => <span key={item.label} className="inline-flex items-center gap-2 text-xs text-ink-muted"><span className="h-2.5 w-2.5 rounded-full" style={{ background: chartPalette[index % chartPalette.length] }} />{item.label}<strong className="font-semibold text-ink">{item.value}</strong></span>)}
            </div>
          </div>
        )}
      </ChartFrame>
    </div>
  );
}
