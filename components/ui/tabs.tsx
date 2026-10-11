'use client';

import { type KeyboardEvent, type ReactNode, useEffect, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

type TabItem = {
  id: string;
  label: string;
  content: ReactNode;
};

type TabsProps = {
  tabs: TabItem[];
  defaultTab: string;
};

export function Tabs({ tabs, defaultTab }: TabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentTab = useMemo(() => {
    const nextTab = searchParams.get('tab') ?? defaultTab;
    return tabs.some((tab) => tab.id === nextTab) ? nextTab : defaultTab;
  }, [defaultTab, searchParams, tabs]);

  const currentIndex = tabs.findIndex((tab) => tab.id === currentTab);

  useEffect(() => {
    if (searchParams.get('tab') !== currentTab) {
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.set('tab', currentTab);
      router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
    }
  }, [currentTab, pathname, router, searchParams]);

  const updateTab = (nextTab: string) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set('tab', nextTab);
    router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      const nextIndex = (index + 1) % tabs.length;
      updateTab(tabs[nextIndex].id);
      const nextButton = document.getElementById(`tab-${tabs[nextIndex].id}`) as HTMLButtonElement | null;
      nextButton?.focus();
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      const nextIndex = (index - 1 + tabs.length) % tabs.length;
      updateTab(tabs[nextIndex].id);
      const nextButton = document.getElementById(`tab-${tabs[nextIndex].id}`) as HTMLButtonElement | null;
      nextButton?.focus();
    }

    if (event.key === 'Home') {
      event.preventDefault();
      updateTab(tabs[0].id);
      const firstButton = document.getElementById(`tab-${tabs[0].id}`) as HTMLButtonElement | null;
      firstButton?.focus();
    }

    if (event.key === 'End') {
      event.preventDefault();
      updateTab(tabs[tabs.length - 1].id);
      const lastButton = document.getElementById(`tab-${tabs[tabs.length - 1].id}`) as HTMLButtonElement | null;
      lastButton?.focus();
    }
  };

  const activeTab = tabs[currentIndex] ?? tabs[0];

  return (
    <div className="space-y-6">
      <div className="flex gap-2 overflow-x-auto overscroll-x-contain pb-1" role="tablist" aria-label="Dashboard sections">
        {tabs.map((tab, index) => {
          const isActive = tab.id === currentTab;
          return (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => updateTab(tab.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={[
                'osa-button shrink-0 border px-4 py-2 text-sm font-medium transition',
                isActive
                  ? 'border-brand bg-brand text-white'
                  : 'border-line bg-surface text-ink-muted hover:border-brand/40 hover:text-brand-strong',
              ].join(' ')}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div id={`panel-${activeTab.id}`} role="tabpanel" aria-labelledby={`tab-${activeTab.id}`} tabIndex={0} className="rounded-2xl border border-line bg-surface p-6">
        {activeTab.content}
      </div>
    </div>
  );
}
