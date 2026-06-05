'use client';

import { queryKeys } from '@/lib/queryKeys';
import { Suspense } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Briefcase,
  FileText,
  GraduationCap,
  Lock,
  MessageSquare,
} from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { GlowCard } from '@/components/ui/GlowCard';
import { useToast } from '@/components/ui/Toast';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/axios';
import { useAuthStore } from '@/store/useAuthStore';
import { resetGlobalTourFlags } from '@/components/onboarding/featureTourStorage';
import { cn } from '@/lib/utils';

import { NotificationsTab } from './NotificationsTab';

type Tab = 'account' | 'features' | 'notifications';

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-white/[0.06]" />
          <div className="h-64 animate-pulse rounded-2xl bg-white/[0.04]" />
        </div>
      }
    >
      <SettingsPageInner />
    </Suspense>
  );
}

function SettingsPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tab: Tab = useMemo(() => {
    const t = searchParams.get('tab');
    if (t === 'account') return 'account';
    if (t === 'notifications') return 'notifications';
    return 'features';
  }, [searchParams]);

  const setTab = useCallback(
    (next: Tab) => {
      const path =
        next === 'features'
          ? '/dashboard/settings'
          : `/dashboard/settings?tab=${next === 'notifications' ? 'notifications' : 'account'}`;
      router.replace(path, { scroll: false });
    },
    [router],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className={cn('mx-auto w-full space-y-6', tab === 'account' ? 'max-w-3xl' : 'max-w-2xl')}
    >
      <div>
        <h2 className="text-2xl font-extrabold text-white">Settings</h2>
        <p className="text-sm text-white/50">Account details and dashboard tools.</p>
      </div>

      <div className="flex gap-6 border-b border-white/10">
        <button
          type="button"
          onClick={() => setTab('features')}
          className={cn(
            '-mb-px pb-3 text-sm font-semibold transition-colors duration-200 ease-out',
            tab === 'features' ? 'border-b-2 border-[#00C9B1] text-white' : 'text-white/45',
          )}
        >
          Features
        </button>
        <button
          type="button"
          onClick={() => setTab('notifications')}
          className={cn(
            '-mb-px pb-3 text-sm font-semibold transition-colors duration-200 ease-out',
            tab === 'notifications' ? 'border-b-2 border-[#00C9B1] text-white' : 'text-white/45',
          )}
        >
          Notifications
        </button>
        <button
          type="button"
          onClick={() => setTab('account')}
          className={cn(
            '-mb-px pb-3 text-sm font-semibold transition-colors duration-200 ease-out',
            tab === 'account' ? 'border-b-2 border-[#00C9B1] text-white' : 'text-white/45',
          )}
        >
          Account
        </button>
      </div>

      {tab === 'account' ? (
        <AccountTab />
      ) : tab === 'notifications' ? (
        <NotificationsTab />
      ) : (
        <FeaturesTab />
      )}
    </motion.div>
  );
}

function AccountTab() {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const toast = useToast();
  const syncUserFromMe = useAuthStore((s) => s.syncUserFromMe);
  const [name, setName] = useState(user?.name ?? '');

  useEffect(() => {
    setName(user?.name ?? '');
  }, [user?.name]);

  const save = useMutation({
    mutationFn: (payload: { name: string }) => api.users.updateMe(payload),
    onSuccess: (next) => {
      syncUserFromMe(next);
      void queryClient.invalidateQueries({ queryKey: queryKeys.auth.me() });
      toast.success('Profile updated');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  return (
    <GlowCard contentClassName="p-6 sm:p-8">
      <div className="mb-8 border-b border-white/[0.08] pb-6">
        <h3 className="text-xl font-semibold tracking-tight text-white">Account</h3>
        <p className="mt-1.5 text-sm text-white/45">
          Manage how you appear in ApplyMate and update your sign-in details.
        </p>
      </div>
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate({ name: name.trim() });
        }}
      >
        <div>
          <label htmlFor="settings-name" className="mb-1.5 block text-xs font-medium text-white/50">
            Display name
          </label>
          <input
            id="settings-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-white/12 bg-[#111616] px-4 py-3 text-sm text-white outline-none transition focus:border-[#00C9B1] focus:ring-2 focus:ring-[#00C9B1]/20"
            autoComplete="name"
          />
        </div>
        <div>
          <label htmlFor="settings-email" className="mb-1.5 block text-xs font-medium text-white/50">
            Email
          </label>
          <input
            id="settings-email"
            value={user?.email ?? ''}
            readOnly
            disabled
            className="w-full cursor-not-allowed rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/50"
          />
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
          <p className="text-xs font-medium text-white/45">Password</p>
          <p className="mt-1 text-sm text-white/60">
            Change your password from your account provider when available.
          </p>
          <Button
            type="button"
            variant="ghost"
            className="mt-4 border border-white/10"
            onClick={() => toast.info('Coming soon')}
          >
            Change password
          </Button>
        </div>
        <div className="flex flex-col-reverse gap-3 border-t border-white/[0.08] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/dashboard/cv-profiles" className="text-sm font-medium text-[#00C9B1] hover:underline">
            CV profiles & uploads →
          </Link>
          <Button type="submit" disabled={save.isPending} className="sm:min-w-[10rem]">
            {save.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>
    </GlowCard>
  );
}

type FeatureKey = 'cv' | 'jobs' | 'interviews' | 'student';

/** Stable fallback — never use inline `['cv']` (new ref each render breaks useEffect). */
const DEFAULT_FEATURES: string[] = ['cv'];

function sameFeatureList(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

function FeaturesTab() {
  const toast = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUser();
  const setSelectedFeatures = useAuthStore((s) => s.setSelectedFeatures);

  const serverFeatures = useMemo(() => {
    if (!user?.selectedFeatures?.length) return DEFAULT_FEATURES;
    const s = user.selectedFeatures;
    return s.includes('cv') ? s : [...s, 'cv'];
  }, [user?.selectedFeatures]);

  const [local, setLocal] = useState<string[]>(DEFAULT_FEATURES);

  useEffect(() => {
    setLocal((prev) => (sameFeatureList(prev, serverFeatures) ? prev : serverFeatures));
  }, [serverFeatures]);

  const updateFeat = useMutation({
    mutationFn: (selectedFeatures: string[]) => api.users.updateFeatures(selectedFeatures),
    onSuccess: (data) => {
      setSelectedFeatures(data.selectedFeatures);
      void queryClient.invalidateQueries({ queryKey: queryKeys.auth.me() });
    },
    onError: () => {
      toast.error('Failed to update — please try again');
      void queryClient.invalidateQueries({ queryKey: queryKeys.auth.me() });
    },
  });

  const toggle = useCallback(
    (key: FeatureKey, nextOn: boolean) => {
      if (key === 'cv') return;
      const base = new Set(local.filter((x) => x !== key));
      if (nextOn) base.add(key);
      const nextArr = Array.from(base);
      const withCv = nextArr.includes('cv') ? nextArr : [...nextArr, 'cv'];
      setLocal(withCv);
      updateFeat.mutate(withCv);
    },
    [local, updateFeat],
  );

  const rows = useMemo(
    () =>
      [
        {
          key: 'cv' as const,
          icon: FileText,
          title: 'CV Tools',
          desc: 'CV builder, scoring, and export',
          disabled: true,
        },
        {
          key: 'jobs' as const,
          icon: Briefcase,
          title: 'Job Analysis',
          desc: 'Analyze job listings, match scores, and cover letter generation',
          disabled: false,
        },
        {
          key: 'interviews' as const,
          icon: MessageSquare,
          title: 'Mock Interviews',
          desc: 'AI-powered interview practice for your target role',
          badge: 'Coming soon',
          disabled: false,
        },
        {
          key: 'student' as const,
          icon: GraduationCap,
          title: 'Student Career Guide',
          desc: 'A step-by-step path from zero to your first role',
          badge: 'Coming soon',
          disabled: false,
        },
      ] as const,
    [],
  );

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[20px] font-bold text-white">Your Features</h3>
        <p className="mt-1 text-sm text-white/25">
          Choose which tools appear in your dashboard. You can change these anytime.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {rows.map((row) => {
          const Icon = row.icon;
          const on = local.includes(row.key);
          return (
            <GlowCard key={row.key} contentClassName="p-0">
              <div className="flex flex-row items-center gap-4 px-6 py-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgba(0,201,177,0.12)]">
                  {row.key === 'cv' ? (
                    <Lock className="h-5 w-5 text-[#00C9B1]" />
                  ) : (
                    <Icon className="h-5 w-5 text-[#00C9B1]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[15px] font-semibold text-white">{row.title}</p>
                    {'badge' in row && row.badge ? (
                      <span className="rounded-full bg-[#00C9B1]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#00C9B1]">
                        {row.badge}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-[13px] text-white/55">{row.desc}</p>
                  {row.key === 'cv' ? (
                    <p className="mt-1 text-[11px] text-white/25">Always included</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  disabled={row.disabled || updateFeat.isPending}
                  role="switch"
                  aria-checked={on}
                  onClick={() => toggle(row.key, !on)}
                  className={cn(
                    'relative h-7 w-12 shrink-0 rounded-full transition-colors',
                    row.disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer',
                    on ? 'bg-[#00C9B1]' : 'bg-white/15',
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform',
                      on ? 'left-6 translate-x-[-2px]' : 'left-0.5',
                    )}
                  />
                </button>
              </div>
            </GlowCard>
          );
        })}
      </div>

      <GlowCard contentClassName="p-5 sm:p-6">
        <h4 className="text-sm font-semibold text-white">Product tour</h4>
        <p className="mt-1 text-sm text-white/45">
          Replay the guided walkthrough of your dashboard — AI credits, jobs, CV Clinic, and Pro.
        </p>
        <button
          type="button"
          className="mt-4 text-sm font-medium text-[#00C9B1] transition-colors hover:text-[#00e5cc]"
          onClick={() => {
            resetGlobalTourFlags(user?.id);
            window.dispatchEvent(new CustomEvent('applymate:tour-restart'));
            toast.success('Tour reset — opening your dashboard');
            router.push('/dashboard');
          }}
        >
          Restart product tour
        </button>
      </GlowCard>
    </div>
  );
}
