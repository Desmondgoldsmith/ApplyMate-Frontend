'use client';

import { motion } from 'framer-motion';
import { Loader2, Plus, X } from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { useCareerGoals, useSaveCareerGoals } from '@/hooks/useCareerGoals';
import type { CareerGoalsRemotePreference, CareerGoalsWorkspace } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/axios';
import { cn } from '@/lib/utils';

const EMPTY: CareerGoalsWorkspace = {
  targetRoles: [],
  targetCompanies: [],
  targetLocations: [],
  targetIndustries: [],
  targetSkills: [],
  employmentTypes: [],
  salaryMin: null,
  salaryCurrency: null,
  remotePreference: null,
};

const EMPLOYMENT_PRESETS = ['Full-time', 'Contract', 'Internship', 'Part-time'] as const;

const REMOTE_OPTIONS: { value: CareerGoalsRemotePreference; label: string; hint: string }[] = [
  { value: 'remote', label: 'Remote', hint: 'Mostly or fully distributed' },
  { value: 'hybrid', label: 'Hybrid', hint: 'Mix of office + remote' },
  { value: 'onsite', label: 'Onsite', hint: 'Primarily in-office' },
  { value: 'any', label: 'Any', hint: 'No strict preference' },
];

const CURRENCIES = ['USD', 'GBP', 'EUR', 'CAD', 'AUD', 'GHS', 'NGN', 'ZAR'] as const;

function normalizeChipList(items: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of items) {
    const t = String(raw ?? '')
      .trim()
      .replace(/\s+/g, ' ');
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

function normalizeWorkspace(v: CareerGoalsWorkspace): CareerGoalsWorkspace {
  return {
    ...EMPTY,
    ...v,
    targetRoles: normalizeChipList(v.targetRoles ?? []),
    targetCompanies: normalizeChipList(v.targetCompanies ?? []),
    targetLocations: normalizeChipList(v.targetLocations ?? []),
    targetIndustries: normalizeChipList(v.targetIndustries ?? []),
    targetSkills: normalizeChipList(v.targetSkills ?? []),
    employmentTypes: normalizeChipList(v.employmentTypes ?? []),
    salaryMin: typeof v.salaryMin === 'number' && Number.isFinite(v.salaryMin) ? Math.max(0, v.salaryMin) : null,
    salaryCurrency: v.salaryCurrency?.trim() ? v.salaryCurrency : null,
    remotePreference: v.remotePreference ?? null,
  };
}

function stableGoalsKey(v: CareerGoalsWorkspace): string {
  const n = normalizeWorkspace(v);
  const payload = {
    targetRoles: n.targetRoles,
    targetCompanies: n.targetCompanies,
    targetLocations: n.targetLocations,
    targetIndustries: n.targetIndustries,
    targetSkills: n.targetSkills,
    employmentTypes: n.employmentTypes,
    salaryMin: n.salaryMin,
    salaryCurrency: n.salaryCurrency,
    remotePreference: n.remotePreference,
  };
  return JSON.stringify(payload);
}

function ChipListField({
  label,
  hint,
  placeholder,
  items,
  onChange,
}: {
  label: string;
  hint?: string;
  placeholder: string;
  items: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState('');
  const add = useCallback(() => {
    const t = draft.trim();
    if (!t) return;
    if (items.some((x) => x.toLowerCase() === t.toLowerCase())) {
      setDraft('');
      return;
    }
    onChange([...items, t]);
    setDraft('');
  }, [draft, items, onChange]);

  return (
    <div className="space-y-2">
      <div>
        <p className="text-[13px] font-semibold text-white/90">{label}</p>
        {hint ? <p className="mt-0.5 text-[12px] leading-relaxed text-white/45">{hint}</p> : null}
      </div>
      {items.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {items.map((it) => (
            <li
              key={it}
              className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/[0.04] py-1 pl-2.5 pr-1 text-[12px] text-white/85"
            >
              <span>{it}</span>
              <button
                type="button"
                className="flex h-6 w-6 items-center justify-center rounded-full text-white/45 hover:bg-white/[0.08] hover:text-white"
                aria-label={`Remove ${it}`}
                onClick={() => onChange(items.filter((x) => x !== it))}
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="min-h-[44px] w-full flex-1 rounded-xl border border-white/12 bg-[#0c1010] px-3 py-2 text-[13px] text-white placeholder:text-white/30 focus:border-[#00C9B1]/40 focus:outline-none"
        />
        <button
          type="button"
          onClick={add}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.02] px-3 text-[13px] font-semibold text-white/85 transition-colors hover:border-[#00C9B1]/45 hover:text-[#9CF5EA] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00C9B1]/40"
        >
          <Plus className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Add</span>
        </button>
      </div>
    </div>
  );
}

export default function CareerGoalsPage() {
  const toast = useToast();
  const q = useCareerGoals();
  const save = useSaveCareerGoals();
  const [form, setForm] = useState<CareerGoalsWorkspace>(EMPTY);
  const [savedKey, setSavedKey] = useState<string>('');

  useEffect(() => {
    if (!q.data) return;
    /* Populate controlled form when GET resolves or refetches — avoids derived-state flicker vs.first paint. */
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional hydration from React Query payload
    setForm(normalizeWorkspace(q.data));
    setSavedKey(stableGoalsKey(q.data));
  }, [q.data]);

  const merge = useCallback((patch: Partial<CareerGoalsWorkspace>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  }, []);

  const toggleEmployment = useCallback((preset: string) => {
    setForm((prev) => {
      const has = prev.employmentTypes.some((x) => x.toLowerCase() === preset.toLowerCase());
      const employmentTypes = has
        ? prev.employmentTypes.filter((x) => x.toLowerCase() !== preset.toLowerCase())
        : [...prev.employmentTypes, preset];
      return { ...prev, employmentTypes };
    });
  }, []);

  const isDirty = useMemo(() => {
    if (!savedKey) return false;
    return stableGoalsKey(form) !== savedKey;
  }, [form, savedKey]);

  const onSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const payload = normalizeWorkspace(form);
      save.mutate(payload, {
        onSuccess: (data) => {
          if (data.updatedAt) setForm((prev) => ({ ...prev, updatedAt: data.updatedAt }));
          setSavedKey(stableGoalsKey(data));
          toast.success('Career goals saved. Dashboard recommendations will refresh.');
        },
        onError: (err) => {
          toast.error(getApiErrorMessage(err));
        },
      });
    },
    [form, save, toast],
  );

  if (q.isLoading) {
    return (
      <div className="mx-auto w-full max-w-[1100px] space-y-6 pb-12">
        <div className="space-y-3">
          <Skeleton className="h-9 w-64 rounded-lg" />
          <Skeleton className="h-5 w-[520px] max-w-full rounded-lg" />
        </div>
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <Skeleton className="h-[560px] w-full rounded-3xl" />
          <Skeleton className="h-[280px] w-full rounded-3xl" />
        </div>
      </div>
    );
  }

  if (q.isError) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-rose-500/25 bg-rose-500/10 p-6 text-[13px] text-rose-100">
        Could not load career goals. {getApiErrorMessage(q.error)}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto w-full max-w-[1100px] space-y-8 pb-12"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Career goals</h1>
          <p className="mt-2 max-w-[72ch] text-[14px] leading-relaxed text-white/55">
          Tell ApplyMate what roles and environments you want so we can align matches, scoring, and dashboard coaching.
          </p>
          {form.updatedAt ? (
            <p className="mt-2 text-[11px] text-white/35">
              Last saved{' '}
              {new Date(form.updatedAt).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[12px] font-semibold text-white/70">
            Used for: recommendations
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[12px] font-semibold text-white/70">
            Job board matching
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[12px] font-semibold text-white/70">
            Scoring signals
          </span>
        </div>
      </div>

      <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
        <div className="space-y-6">
          <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 shadow-[0_20px_70px_-50px_rgba(0,0,0,0.75)] sm:p-7">
            <div className="mb-6">
              <p className="text-[13px] font-semibold text-white/80">What you’re aiming for</p>
              <p className="mt-1 text-[12px] leading-relaxed text-white/45">
                Keep this tight (2–5 items per field). Clear goals produce sharper recommendations.
              </p>
            </div>
            <div className="grid gap-7 lg:grid-cols-2">
              <ChipListField
                label="Target roles"
                hint="Examples: Frontend Engineer, Full Stack Developer, Product Engineer"
                placeholder="e.g. Frontend Engineer"
                items={form.targetRoles}
                onChange={(targetRoles) => merge({ targetRoles })}
              />
              <ChipListField
                label="Target companies"
                hint="Dream employers or teams you are pursuing"
                placeholder="e.g. Google"
                items={form.targetCompanies}
                onChange={(targetCompanies) => merge({ targetCompanies })}
              />
              <ChipListField
                label="Preferred locations"
                hint="Cities, regions, or “Remote”"
                placeholder="e.g. London"
                items={form.targetLocations}
                onChange={(targetLocations) => merge({ targetLocations })}
              />
              <ChipListField
                label="Industries"
                hint="Where you want to grow — Fintech, AI, SaaS, etc."
                placeholder="e.g. Fintech"
                items={form.targetIndustries}
                onChange={(targetIndustries) => merge({ targetIndustries })}
              />
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 sm:p-7">
            <div className="mb-6">
              <p className="text-[13px] font-semibold text-white/80">Signals to emphasize</p>
              <p className="mt-1 text-[12px] leading-relaxed text-white/45">
                These steer tailoring and discovery. Add the skills you want highlighted across roles.
              </p>
            </div>
            <div className="grid gap-7 lg:grid-cols-2">
              <ChipListField
                label="Skills"
                hint="Examples: React, TypeScript, System design, Stakeholder management"
                placeholder="e.g. React"
                items={form.targetSkills}
                onChange={(targetSkills) => merge({ targetSkills })}
              />
              <div className="space-y-3">
                <p className="text-[13px] font-semibold text-white/90">Employment types</p>
                <p className="text-[12px] text-white/45">Select any that apply.</p>
                <div className="flex flex-wrap gap-2">
                  {EMPLOYMENT_PRESETS.map((preset) => {
                    const active = form.employmentTypes.some((x) => x.toLowerCase() === preset.toLowerCase());
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => toggleEmployment(preset)}
                        className={cn(
                          'rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors',
                          active
                            ? 'border-[#00C9B1]/55 bg-[#00C9B1]/15 text-[#9CF5EA]'
                            : 'border-white/12 bg-white/[0.03] text-white/60 hover:border-white/20 hover:text-white/75',
                        )}
                      >
                        {preset}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 sm:p-7">
            <div className="mb-6">
              <p className="text-[13px] font-semibold text-white/80">Constraints</p>
              <p className="mt-1 text-[12px] leading-relaxed text-white/45">
                Optional. These help filter or rank recommendations.
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <label className="text-[13px] font-semibold text-white/90" htmlFor="salary-min">
                  Minimum salary
                </label>
                <input
                  id="salary-min"
                  type="number"
                  min={0}
                  step={1000}
                  inputMode="numeric"
                  value={form.salaryMin ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '') merge({ salaryMin: null });
                    else if (Number.isFinite(Number(v))) merge({ salaryMin: Math.max(0, Number(v)) });
                  }}
                  placeholder="e.g. 120000"
                  className="min-h-[44px] w-full rounded-xl border border-white/12 bg-[#0c1010] px-3 py-2 text-[13px] text-white placeholder:text-white/30 focus:border-[#00C9B1]/40 focus:outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[13px] font-semibold text-white/90" htmlFor="salary-ccy">
                  Currency
                </label>
                <select
                  id="salary-ccy"
                  value={form.salaryCurrency ?? ''}
                  onChange={(e) => merge({ salaryCurrency: e.target.value.trim() || null })}
                  className="min-h-[44px] w-full rounded-xl border border-white/12 bg-[#0c1010] px-3 py-2 text-[13px] text-white focus:border-[#00C9B1]/40 focus:outline-none"
                >
                  <option value="">Select…</option>
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-7 space-y-3">
              <p className="text-[13px] font-semibold text-white/90">Work preference</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {REMOTE_OPTIONS.map((opt) => {
                  const active = form.remotePreference === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => merge({ remotePreference: opt.value })}
                      className={cn(
                        'rounded-xl border px-4 py-3 text-left transition-colors',
                        active
                          ? 'border-[#00C9B1]/55 bg-[#00C9B1]/12 ring-1 ring-[#00C9B1]/25'
                          : 'border-white/10 bg-white/[0.02] hover:border-white/18',
                      )}
                    >
                      <p className="text-[13px] font-semibold text-white">{opt.label}</p>
                      <p className="mt-0.5 text-[11px] text-white/45">{opt.hint}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-6">
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 sm:p-7">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-white/85">Save changes</p>
                <p className="mt-1 text-[12px] leading-relaxed text-white/45">
                  Updates take effect immediately on your dashboard and job board.
                </p>
              </div>
              {isDirty ? (
                <span className="shrink-0 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-100/90">
                  Unsaved
                </span>
              ) : (
                <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.02] px-2.5 py-1 text-[11px] font-semibold text-white/55">
                  Up to date
                </span>
              )}
            </div>

            <Button
              type="submit"
              disabled={save.isPending || !isDirty}
              className="mt-5 min-h-[48px] w-full bg-[#00C9B1] px-6 text-[14px] font-semibold text-[#080A0A] hover:bg-[#33d4c2] disabled:opacity-60"
            >
              {save.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Saving…
                </>
              ) : (
                'Save career goals'
              )}
            </Button>

            <div className="mt-5 rounded-2xl border border-white/10 bg-[#0B1010] p-4">
              <p className="text-[12px] font-semibold text-white/80">Tips for better results</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-[12px] leading-relaxed text-white/50">
                <li>Use 2–5 target roles and keep titles specific.</li>
                <li>Add 3–8 skills you want highlighted.</li>
                <li>Locations can include “Remote” if you’re flexible.</li>
              </ul>
            </div>
          </div>
        </aside>
      </form>
    </motion.div>
  );
}
