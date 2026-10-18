'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  GraduationCap,
  type LucideIcon,
  Sparkles,
  Users,
  UsersRound,
} from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';

type StatIconName = 'societies' | 'calendar' | 'clock' | 'check' | 'students' | 'registrations';
type StatTone = 'brand' | 'gold' | 'sage' | 'coral';

type SummaryStat = {
  label: string;
  value: number | null;
  helper: string;
  error?: string | null;
  icon: StatIconName;
  tone: StatTone;
  needsAttention?: boolean;
};

const statIcons: Record<StatIconName, LucideIcon> = {
  societies: UsersRound,
  calendar: CalendarDays,
  clock: Clock3,
  check: CheckCircle2,
  students: GraduationCap,
  registrations: Users,
};
const defaultStatIcon = Building2;

const toneClasses: Record<StatTone, { chip: string; icon: string }> = {
  brand: { chip: 'bg-brand-soft', icon: 'text-brand' },
  gold: { chip: 'bg-accent-gold/45', icon: 'text-accent-ink' },
  sage: { chip: 'bg-event-sage/25', icon: 'text-success' },
  coral: { chip: 'bg-event-coral/20', icon: 'text-warning' },
};

function CountUp({ value }: { value: number | null }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (value === null) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion || value === 0) {
      setShown(value);
      return;
    }

    let frame = 0;
    const duration = 720;
    const started = performance.now();
    const animate = (now: number) => {
      const progress = Math.min((now - started) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      setShown(Math.round(value * eased));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <>{value === null ? '—' : shown.toLocaleString()}</>;
}

export function SummaryHero({
  firstName,
  today,
  reviewCount,
}: {
  firstName: string;
  today: string;
  reviewCount: number | null;
}) {
  return (
    <section className="relative isolate overflow-hidden rounded-[28px] bg-gradient-to-br from-brand-deep to-brand px-6 py-7 text-white shadow-[0_16px_38px_rgba(11,48,41,0.18)] sm:px-8 sm:py-8">
      <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-14 -z-10 h-56 w-56 rounded-full border-[32px] border-brand-soft/10" />
      <div aria-hidden="true" className="pointer-events-none absolute right-24 top-14 -z-10 h-24 w-24 rounded-full bg-accent-gold/10" />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/85">
            <Sparkles className="h-3.5 w-3.5 text-accent-gold" />
            OSA overview
          </div>
          <h2 className="text-2xl font-semibold sm:text-[30px]">Good day, {firstName}</h2>
          <p className="mt-2 text-sm text-white/75">{today}</p>
          <p className="mt-4 text-base text-white/90">
            {reviewCount === null ? 'Review queue status is unavailable.' : `${reviewCount} ${reviewCount === 1 ? 'item' : 'items'} awaiting your review`}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row flex-wrap gap-2.5 sm:gap-3 w-full lg:w-auto">
          <Link href="/overview?tab=review-queue" className="osa-button w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white px-5 py-3 text-sm font-semibold text-brand-deep transition hover:bg-brand-mist">
            Review queue <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/events?tab=approvals" className="osa-button w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-white/30 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/20">
            Event approvals <CalendarDays className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

export function SummaryStatGrid({ stats }: { stats: SummaryStat[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map(({ label, value, helper, error, icon, tone, needsAttention }) => {
        const toneStyle = toneClasses[tone];
        const Icon = statIcons[icon] ?? defaultStatIcon;
        return (
          <article
            key={label}
            className={`group rounded-[22px] border bg-surface p-4 shadow-[0_5px_20px_rgba(11,48,41,0.045)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_14px_28px_rgba(11,48,41,0.11)] ${needsAttention && value !== null && value > 0 ? 'border-accent-gold' : 'border-line'}`}
          >
            <div className="flex items-start justify-between gap-3">
              <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${toneStyle.chip}`}>
                <Icon className={`h-5 w-5 ${toneStyle.icon}`} strokeWidth={1.8} />
              </span>
              {needsAttention && value !== null && value > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent-gold/35 px-2.5 py-1 text-[10px] font-semibold text-accent-ink">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent-ink" /> Needs attention
                </span>
              ) : null}
            </div>
            {error ? (
              <p className="mt-4 min-h-9 text-sm text-error" role="alert">Unavailable: {error}</p>
            ) : (
              <p className="mt-4 text-[32px] font-semibold leading-none tabular-nums text-brand-deep"><CountUp value={value} /></p>
            )}
            <p className="mt-2 text-sm font-semibold text-ink">{label}</p>
            <p className="mt-1 text-xs leading-5 text-ink-muted">{helper}</p>
          </article>
        );
      })}
    </div>
  );
}

export type RecentSubmission = {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  createdAt: string;
};

export function RecentSubmissionsList({ title, entries, error }: { title: string; entries: RecentSubmission[]; error?: string | null }) {
  return (
    <section className="rounded-[22px] border border-line bg-surface p-5 shadow-[0_5px_20px_rgba(11,48,41,0.045)]">
      <h3 className="mb-3 text-base font-semibold text-ink">{title}</h3>
      {error ? <p className="text-sm text-error" role="alert">{error}</p> : entries.length === 0 ? <p className="py-7 text-center text-sm text-ink-muted">No recent submissions to show.</p> : (
        <ul className="divide-y divide-line">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-center gap-3 py-3 first:pt-1 last:pb-1">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-mist text-xs font-bold uppercase text-brand" aria-hidden="true">{initials(entry.title)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{entry.title}</p>
                <p className="mt-0.5 truncate text-xs text-ink-muted">{entry.subtitle} · {relativeTime(entry.createdAt)}</p>
              </div>
              <StatusBadge label={entry.status} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function RecentDecisionList({
  decisions,
  adminNames,
  error,
  migrationMissing,
}: {
  decisions: Array<{ id: string; entity_type: string; entity_id: string; action: string; new_status: string; actor_id: string; created_at: string }>;
  adminNames: Record<string, string>;
  error?: string | null;
  migrationMissing?: boolean;
}) {
  return (
    <section className="rounded-[22px] border border-line bg-surface p-5 shadow-[0_5px_20px_rgba(11,48,41,0.045)]">
      <div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-base font-semibold text-ink">Recent admin decisions</h3><Link href="/overview?tab=activity-log" className="text-sm font-semibold text-brand hover:text-brand-strong">Activity log</Link></div>
      {migrationMissing ? <p className="py-7 text-center text-sm text-ink-muted">Audit migration has not been applied.</p> : error ? <p className="text-sm text-error" role="alert">{error}</p> : decisions.length === 0 ? <p className="py-7 text-center text-sm text-ink-muted">No recorded decisions yet.</p> : (
        <ul className="divide-y divide-line">
          {decisions.map((decision) => {
            const admin = adminNames[decision.actor_id] ?? 'OSA admin';
            return (
              <li key={decision.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-1 last:pb-1">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-event-sage/25 text-xs font-bold uppercase text-success" aria-hidden="true">{initials(admin)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold capitalize text-ink">{admin} · {decision.action.replaceAll('_', ' ')} {decision.entity_type}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">{decision.new_status} · {relativeTime(decision.created_at)}</p>
                </div>
                <StatusBadge label={decision.new_status} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function initials(value: string) {
  return value.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? '').join('') || 'N';
}

function relativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return 'Date unavailable';
  const delta = timestamp - Date.now();
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31_536_000_000],
    ['month', 2_592_000_000],
    ['week', 604_800_000],
    ['day', 86_400_000],
    ['hour', 3_600_000],
    ['minute', 60_000],
  ];
  const [unit, size] = units.find(([, unitSize]) => Math.abs(delta) >= unitSize) ?? ['minute', 60_000];
  return formatter.format(Math.round(delta / size), unit);
}
