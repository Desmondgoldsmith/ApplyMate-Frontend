'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Info } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { GlowCard } from '@/components/ui/GlowCard';
import { useToast } from '@/components/ui/Toast';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { api, type NotificationPrefs } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/axios';
import {
  clampMarketingCap,
  effectiveDailyGrowthDigest,
  effectiveEmailHubReminderDue,
  effectivePushHubReminderDue,
  effectiveWeeklyStallDigest,
  isMarketingPauseActive,
} from '@/lib/user-notification-ui';
import { useAuthStore } from '@/store/useAuthStore';
import { cn } from '@/lib/utils';

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function NotificationsTab() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const syncUserFromMe = useAuthStore((s) => s.syncUserFromMe);
  const { data: user, isLoading } = useCurrentUser();

  const prefs = user?.notificationPrefs ?? null;
  const pauseUntil = user?.nudgePausedUntil ?? null;

  const emailOn = effectiveEmailHubReminderDue(prefs);
  const digestOn = effectiveWeeklyStallDigest(prefs);
  const dailyGrowthDigestOn = effectiveDailyGrowthDigest(prefs);
  const pushOn = effectivePushHubReminderDue(prefs);
  const capDisplay = prefs?.maxMarketingEmailsPerWeek ?? 3;

  const [capDraft, setCapDraft] = useState(String(capDisplay));
  const [pauseLocal, setPauseLocal] = useState('');

  useEffect(() => {
    setCapDraft(String(prefs?.maxMarketingEmailsPerWeek ?? 3));
  }, [prefs?.maxMarketingEmailsPerWeek]);

  useEffect(() => {
    if (pauseUntil && isMarketingPauseActive(pauseUntil)) {
      setPauseLocal(toDatetimeLocalValue(pauseUntil));
    } else {
      setPauseLocal('');
    }
  }, [pauseUntil]);

  const patchMe = useMutation({
    mutationFn: api.users.updateMe,
    onSuccess: (next) => {
      syncUserFromMe(next);
      void queryClient.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const patchPrefs = useCallback(
    (partial: Partial<NotificationPrefs>) => {
      patchMe.mutate(
        { notificationPrefs: partial },
        { onSuccess: () => toast.success('Preference saved') },
      );
    },
    [patchMe, toast],
  );

  const pauseActive = isMarketingPauseActive(pauseUntil);

  const saveCap = useCallback(() => {
    const n = parseInt(capDraft, 10);
    if (!Number.isFinite(n)) {
      toast.error('Enter a number between 1 and 21');
      return;
    }
    const c = clampMarketingCap(n);
    if (c !== n) {
      setCapDraft(String(c));
      toast.info('Adjusted to allowed range (1–21)');
    }
    patchMe.mutate(
      { notificationPrefs: { maxMarketingEmailsPerWeek: c } },
      {
        onSuccess: () => toast.success('Weekly email cap updated'),
      },
    );
  }, [capDraft, patchMe, toast]);

  const applyPause = useCallback(() => {
    if (!pauseLocal.trim()) {
      toast.error('Pick a date and time');
      return;
    }
    const iso = new Date(pauseLocal).toISOString();
    const t = new Date(iso).getTime();
    if (!Number.isFinite(t)) {
      toast.error('Invalid date');
      return;
    }
    if (t <= Date.now()) {
      toast.error('Choose a time in the future');
      return;
    }
    patchMe.mutate(
      { nudgePausedUntil: iso },
      {
        onSuccess: () => toast.success('Marketing nudges paused until then'),
      },
    );
  }, [pauseLocal, patchMe, toast]);

  const clearPause = useCallback(() => {
    patchMe.mutate(
      { nudgePausedUntil: null },
      {
        onSuccess: () => {
          setPauseLocal('');
          toast.success('Pause cleared');
        },
      },
    );
  }, [patchMe, toast]);

  if (isLoading && !user) {
    return (
      <GlowCard contentClassName="p-6">
        <div className="h-40 animate-pulse rounded-xl bg-white/[0.04]" />
      </GlowCard>
    );
  }

  return (
    <div className="space-y-6">
      <GlowCard contentClassName="p-6">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#00C9B1]/15">
            <Bell className="h-5 w-5 text-[#00C9B1]" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Notifications</p>
            <p className="mt-1.5 text-xs leading-relaxed text-white/45">
              <span className="text-white/70">Defaults are on.</span> We email you when a follow-up you set on a job is
              due, and (when scheduled) a weekly email about roles that may need attention—until you turn a toggle off.{' '}
              <span className="text-white/55">
                Some alerts can still show inside the app even if email is off.
              </span>
            </p>
          </div>
        </div>

        <div className="space-y-6 border-t border-white/[0.06] pt-5">
          <ToggleRow
            id="email-hub-reminder"
            label="Email when a follow-up reminder is due"
            description="For follow-ups you set on jobs in your tracker. Turn this off to stop only these emails—not the weekly summary below."
            checked={emailOn}
            disabled={patchMe.isPending}
            onChange={(on) => patchPrefs({ emailHubReminderDue: on })}
          />

          <ToggleRow
            id="push-hub-reminder"
            label="Phone notification when a follow-up is due"
            description="Not available yet; we’ll use this when mobile push is ready. Left on by default for later."
            checked={pushOn}
            disabled
            onChange={() => {}}
          />

          <ToggleRow
            id="daily-growth-digest"
            label="Daily growth digest email"
            description="A concise daily summary of new high-match opportunities and actions needing attention."
            checked={dailyGrowthDigestOn}
            disabled={patchMe.isPending}
            onChange={(on) => patchPrefs({ dailyGrowthDigest: on })}
          />

          <ToggleRow
            id="weekly-digest"
            label="Weekly “jobs to revisit” email"
            description="One email when you have applications or saved jobs that look stuck. Sent Mondays 09:00 UTC. Different from the follow-up emails above."
            checked={digestOn}
            disabled={patchMe.isPending}
            onChange={(on) => patchPrefs({ weeklyStallDigest: on })}
          />

          <div>
            <label htmlFor="marketing-cap" className="mb-1.5 block text-xs font-medium text-white/50">
              Max digest emails per week
            </label>
            <p className="mb-2 text-[11px] text-white/35">
              Only caps the weekly “jobs to revisit” emails (1–21 per rolling week). Does not limit follow-up reminder
              emails.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="marketing-cap"
                type="number"
                min={1}
                max={21}
                inputMode="numeric"
                value={capDraft}
                onChange={(e) => setCapDraft(e.target.value)}
                className="w-24 rounded-xl border border-[#00C9B1]/20 bg-[#111616] px-3 py-2 text-sm text-white outline-none transition focus:border-[#00C9B1]"
              />
              <Button type="button" variant="ghost" className="border border-white/10" onClick={() => saveCap()}>
                Save cap
              </Button>
            </div>
          </div>
        </div>
      </GlowCard>

      <GlowCard contentClassName="p-6">
        <p className="mb-1 text-sm font-semibold text-white">Pause extra check-in emails</p>
        <p className="mb-4 text-xs leading-relaxed text-white/45">
          Pauses scheduled check-in style emails (like the weekly “jobs to revisit” message). Your{' '}
          <span className="text-white/60">follow-up reminder</span> toggle at the top still controls due-date reminder
          emails—turn that off separately if you want.
        </p>

        {pauseActive ? (
          <div className="mb-4 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/95">
            Paused until{' '}
            <span className="font-medium">
              {pauseUntil ? new Date(pauseUntil).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
            </span>{' '}
            (UTC stored on server; shown in your local time).
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="pause-until" className="mb-1.5 block text-xs font-medium text-white/50">
              Snooze until
            </label>
            <input
              id="pause-until"
              type="datetime-local"
              value={pauseLocal}
              onChange={(e) => setPauseLocal(e.target.value)}
              className="w-full max-w-md rounded-xl border border-[#00C9B1]/20 bg-[#111616] px-3 py-2 text-sm text-white outline-none transition focus:border-[#00C9B1]"
            />
          </div>
          <Button type="button" onClick={applyPause} disabled={patchMe.isPending} className="shrink-0">
            Apply pause
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="shrink-0 border border-white/10"
            onClick={clearPause}
            disabled={patchMe.isPending || (!pauseActive && !pauseLocal.trim())}
          >
            Clear pause
          </Button>
        </div>

        <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-white/40">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/40" aria-hidden />
          <span>
            Link in the weekly email opens{' '}
            <Link href="/dashboard/next-moves" className="font-medium text-[#00C9B1] hover:underline">
              Next moves
            </Link>{' '}
            in the app. That weekly rundown is email-first; your{' '}
            <Link href="/dashboard" className="text-[#00C9B1] hover:underline">
              Dashboard
            </Link>{' '}
            (Today’s Plan) and{' '}
            <Link href="/dashboard/jobs" className="text-[#00C9B1] hover:underline">
              Job Hub
            </Link>{' '}
            are where you manage day-to-day—they don’t mirror the full weekly email.
          </span>
        </p>
      </GlowCard>
    </div>
  );
}

function ToggleRow(props: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <label htmlFor={props.id} className="text-sm font-medium text-white">
          {props.label}
        </label>
        <p className="mt-0.5 text-xs text-white/40">{props.description}</p>
      </div>
      <button
        id={props.id}
        type="button"
        role="switch"
        aria-checked={props.checked}
        disabled={props.disabled}
        onClick={() => props.onChange(!props.checked)}
        className={cn(
          'relative h-7 w-12 shrink-0 rounded-full transition-colors',
          props.disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer',
          props.checked ? 'bg-[#00C9B1]' : 'bg-white/15',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform',
            props.checked ? 'left-6 translate-x-[-2px]' : 'left-0.5',
          )}
        />
      </button>
    </div>
  );
}
