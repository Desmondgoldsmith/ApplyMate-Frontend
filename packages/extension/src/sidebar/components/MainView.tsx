import { useState } from 'react';

import type { User } from '@/shared/types';

import { JobSessionProvider, useJobSession } from '../context/JobSessionContext';
import { ApplyTab } from './ApplyTab';
import { CVTab } from './CVTab';
import { HistoryTab } from './HistoryTab';
import { JobTab } from './JobTab';
import { PendingNewJobBanner } from './PendingNewJobBanner';

type TabId = 'job' | 'cv' | 'apply' | 'history';

type TabDef = {
  id: TabId;
  label: string;
  icon: (active: boolean) => JSX.Element;
};

function TabIconBriefcase({ active }: { active: boolean }) {
  const stroke = active ? '#00C9B1' : 'rgba(240,244,242,0.45)';
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="8" width="18" height="12" rx="2" stroke={stroke} strokeWidth="1.75" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" stroke={stroke} strokeWidth="1.75" />
    </svg>
  );
}

function TabIconCv({ active }: { active: boolean }) {
  const stroke = active ? '#00C9B1' : 'rgba(240,244,242,0.45)';
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M7 4h7l5 5v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" stroke={stroke} strokeWidth="1.75" />
      <path d="M14 4v5h5" stroke={stroke} strokeWidth="1.75" />
      <path d="M8 13h8M8 17h5" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function TabIconApply({ active }: { active: boolean }) {
  const stroke = active ? '#00C9B1' : 'rgba(240,244,242,0.45)';
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 3v12" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" />
      <path d="M8 11l4 4 4-4" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 21h14" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function TabIconHistory({ active }: { active: boolean }) {
  const stroke = active ? '#00C9B1' : 'rgba(240,244,242,0.45)';
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke={stroke} strokeWidth="1.75" />
      <path d="M12 8v4l3 2" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

const TABS: TabDef[] = [
  { id: 'job', label: 'Job', icon: (active) => <TabIconBriefcase active={active} /> },
  { id: 'cv', label: 'Analysis', icon: (active) => <TabIconCv active={active} /> },
  { id: 'apply', label: 'Autofill', icon: (active) => <TabIconApply active={active} /> },
  { id: 'history', label: 'History', icon: (active) => <TabIconHistory active={active} /> },
];

function userInitials(user: User): string {
  const first = user.firstName?.trim().charAt(0) ?? '';
  const last = user.lastName?.trim().charAt(0) ?? '';
  if (first || last) return `${first}${last}`.toUpperCase();
  const email = user.email?.trim() ?? '';
  if (email) return email.charAt(0).toUpperCase();
  return '?';
}

type MainViewProps = {
  user: User;
};

function HeaderChrome({ user }: MainViewProps) {
  const { aiUsage } = useJobSession();
  const initials = userInitials(user);
  const aiLabel =
    aiUsage && aiUsage.aiDailyLimit != null
      ? `${aiUsage.aiUsesToday}/${aiUsage.aiDailyLimit}`
      : aiUsage
        ? `${aiUsage.aiUsesToday}`
        : '…';

  return (
    <header className="relative flex h-[52px] shrink-0 items-center border-b border-am-border bg-am-surface px-3">
      <span className="text-[15px] font-bold tracking-tight text-am-primary">ApplyMate</span>

      {aiLabel ? (
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-am-primary/25 bg-am-primary-subtle px-2.5 py-1 text-[10px] font-semibold text-am-primary">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M12 3l1.6 4.9H19l-4 2.9 1.5 4.9L12 13.8 7.5 15.7 9 10.8 5 7.9h5.4L12 3z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
            {aiLabel === '…' ? 'AI usage…' : `${aiLabel} AI today`}
          </span>
        </div>
      ) : null}

      <div
        className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-[#141C18] text-[11px] font-bold text-am-text-secondary"
        title={user.firstName ? `${user.firstName} ${user.lastName ?? ''}`.trim() : user.email}
        aria-label="Account"
      >
        {initials}
      </div>
    </header>
  );
}

export function MainView({ user }: MainViewProps) {
  const [activeTab, setActiveTab] = useState<TabId>('job');

  return (
    <JobSessionProvider>
      <div className="flex h-screen w-full flex-col bg-am-bg">
        <HeaderChrome user={user} />

        <nav
          className="flex h-12 shrink-0 border-b border-am-border bg-am-surface"
          aria-label="Sidebar tabs"
        >
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={[
                  'flex h-12 flex-1 flex-col items-center justify-center gap-0.5 transition-all duration-150',
                  active
                    ? 'border-b-2 border-am-primary bg-am-primary-subtle text-am-primary'
                    : 'border-b-2 border-transparent text-am-text-secondary hover:text-am-text/70',
                ].join(' ')}
                aria-current={active ? 'page' : undefined}
              >
                {tab.icon(active)}
                <span className="text-[10px] font-semibold leading-none">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="am-scroll flex-1 overflow-y-auto p-4">
          <SidebarBody activeTab={activeTab} />
        </div>
      </div>
    </JobSessionProvider>
  );
}

function SidebarBody({ activeTab }: { activeTab: TabId }) {
  return (
    <>
      <PendingNewJobBanner />
      <div style={{ display: activeTab === 'job' ? 'block' : 'none' }}>
        <JobTab />
      </div>
      <div style={{ display: activeTab === 'cv' ? 'block' : 'none' }}>
        <CVTab />
      </div>
      <div style={{ display: activeTab === 'apply' ? 'block' : 'none' }}>
        <ApplyTab />
      </div>
      <div style={{ display: activeTab === 'history' ? 'block' : 'none' }}>
        <HistoryTab />
      </div>
    </>
  );
}
