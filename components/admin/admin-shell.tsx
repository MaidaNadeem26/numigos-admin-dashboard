'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BriefcaseBusiness, CalendarDays, LayoutGrid, LogOut, Menu, ShieldCheck, Users, X } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const navItems = [
  { href: '/overview', label: 'Overview', icon: LayoutGrid },
  { href: '/societies', label: 'Societies', icon: BriefcaseBusiness },
  { href: '/events', label: 'Events', icon: CalendarDays },
  { href: '/students', label: 'Students', icon: Users },
];

export function AdminShell({ adminName, children }: { adminName: string; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/sign-in');
    router.refresh();
  };

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div className="flex min-h-screen">
        <aside
          className={[
            'fixed inset-y-0 left-0 z-40 w-72 border-r border-line bg-surface p-4 transition-transform duration-200 lg:static lg:translate-x-0',
            isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0',
          ].join(' ')}
          aria-label="Sidebar navigation"
        >
          <div className="flex h-full flex-col">
            <div className="mb-6 flex items-center justify-between rounded-2xl border border-line bg-brand-mist p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-ink-muted">OSA</p>
                  <p className="text-sm font-semibold text-brand-deep">NUMIGOS Admin</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close menu"
                className="rounded-full p-2 text-ink-muted hover:bg-surface lg:hidden"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="space-y-1.5" aria-label="Main navigation">
              {navItems.map(({ href, label, icon: Icon }) => {
                const isActive = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setIsOpen(false)}
                    className={[
                      'flex items-center gap-3 rounded-[28px] px-3.5 py-2.5 text-sm font-medium transition',
                      isActive
                        ? 'bg-brand-mist text-brand-strong ring-1 ring-brand/20'
                        : 'text-ink-muted hover:bg-field hover:text-ink',
                    ].join(' ')}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {label}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto rounded-2xl border border-line bg-field p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-ink-muted">Signed in as</p>
              <p className="mt-1 truncate text-sm font-semibold text-ink" title={adminName}>{adminName}</p>
              <button
                type="button"
                onClick={handleSignOut}
                className="osa-button mt-3 inline-flex w-full items-center justify-center gap-2 border border-line bg-surface px-3 py-2 text-sm font-medium text-ink transition hover:border-error/40 hover:text-error"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </div>
        </aside>

        {isOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-ink/40 backdrop-blur-[2px] lg:hidden"
            aria-label="Close navigation"
            onClick={() => setIsOpen(false)}
          />
        ) : null}

        <div className="flex-1 min-w-0 flex flex-col">
          <header className="sticky top-0 z-20 border-b border-line bg-surface/95 px-3 py-3 sm:px-6 lg:px-8 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => setIsOpen((current) => !current)}
                  className="inline-flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink transition hover:bg-field lg:hidden"
                  aria-label="Toggle navigation"
                  aria-expanded={isOpen}
                >
                  <Menu className="h-5 w-5" />
                </button>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs uppercase tracking-[0.18em] text-ink-muted">Dashboard</p>
                  <h1 className="truncate text-base sm:text-lg font-semibold text-brand-deep">Admin Console</h1>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="hidden items-center gap-2.5 rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-ink sm:flex">
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand font-semibold text-xs">
                    {adminName.charAt(0).toUpperCase()}
                  </span>
                  <span className="max-w-[160px] truncate font-medium">{adminName}</span>
                </div>
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand font-semibold text-xs sm:hidden">
                  {adminName.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
          </header>

          <main className="flex-1 min-w-0 px-3 py-4 sm:px-6 sm:py-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
