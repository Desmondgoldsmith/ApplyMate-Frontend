'use client';

import { motion, useReducedMotion } from 'framer-motion';
import {
  AlertTriangle,
  Briefcase,
  GraduationCap,
  Mail,
  MapPin,
  Phone,
  Sparkles,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/Button';
import type { CVBuilderData } from '@/lib/cvBuilder';

const MAX_SKILLS = 14;

function dateRange(start: string, end: string, current: boolean): string {
  const s = start.trim();
  const e = current ? 'Present' : end.trim();
  if (s && e) return `${s} – ${e}`;
  return s || e;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (
    (parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '')
  );
}

function Block({
  icon,
  title,
  count,
  children,
  delay,
}: {
  icon: ReactNode;
  title: string;
  count?: string;
  children: ReactNode;
  delay: number;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.section
      initial={reducedMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: reducedMotion ? 0 : delay,
        duration: 0.35,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="rounded-2xl border border-border-subtle bg-bg-surface p-4 shadow-raised"
    >
      <h3 className="flex items-center gap-2 text-[13px] font-semibold text-text-secondary">
        <span className="text-accent-text" aria-hidden>
          {icon}
        </span>
        {title}
        {count ? (
          <span className="ml-auto rounded-full bg-bg-hover px-2 py-0.5 text-[12px] font-medium text-text-secondary">
            {count}
          </span>
        ) : null}
      </h3>
      <div className="mt-3">{children}</div>
    </motion.section>
  );
}

/** "Check what we found" — shows the parsed CV content so users can trust the import before continuing. */
export function OnboardingCvReview({
  data,
  loading,
  onContinue,
  onFixInEditor,
  onUploadAnother,
  uploadAnotherLabel = 'Upload a different file',
  continueLabel = 'Looks right, choose a design',
  error = false,
  onRetry,
}: {
  data: CVBuilderData | null;
  loading: boolean;
  onContinue: () => void;
  onFixInEditor?: () => void;
  onUploadAnother?: () => void;
  uploadAnotherLabel?: string;
  continueLabel?: string;
  /** Loading the parsed CV failed (network / API restart). */
  error?: boolean;
  onRetry?: () => void;
}) {
  const reducedMotion = useReducedMotion();

  if (error && !data) {
    return (
      <div
        className="w-full rounded-2xl border border-border-subtle bg-bg-surface px-5 py-8 text-center"
        role="alert"
      >
        <p className="text-[15px] font-semibold text-text-primary">
          We couldn&apos;t load your CV just now
        </p>
        <p className="mt-1.5 text-[13px] text-text-tertiary">
          Your CV is saved. Check your connection and try again.
        </p>
        {onRetry ? (
          <Button
            type="button"
            variant="accent"
            onClick={onRetry}
            className="mt-5 px-7"
          >
            Try again
          </Button>
        ) : null}
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div
        className="w-full space-y-3"
        aria-busy="true"
        aria-label="Loading your CV"
      >
        {[88, 140, 96, 110].map((h, i) => (
          <div
            key={i}
            className="animate-pulse rounded-2xl border border-border-subtle bg-bg-surface"
            style={{ height: h }}
          />
        ))}
      </div>
    );
  }

  const p = data.personal;
  const experience = data.experience.items.filter(
    (x) => x.title.trim() || x.company.trim(),
  );
  const education = data.education.items.filter(
    (x) => x.school.trim() || x.degree.trim() || x.field.trim(),
  );
  const skills = Array.from(
    new Set(
      data.skills.categories.flatMap((c) =>
        c.skills.map((s) => s.trim()).filter(Boolean),
      ),
    ),
  );
  const summary = data.summary.text.replace(/<[^>]+>/g, '').trim();
  const thin = experience.length === 0 && education.length === 0;
  const contact: Array<{ icon: ReactNode; text: string }> = [];
  if (p.email)
    contact.push({ icon: <Mail className="h-3.5 w-3.5" />, text: p.email });
  if (p.phone)
    contact.push({ icon: <Phone className="h-3.5 w-3.5" />, text: p.phone });
  if (p.location)
    contact.push({
      icon: <MapPin className="h-3.5 w-3.5" />,
      text: p.location,
    });

  return (
    <div className="w-full text-left">
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-2xl border border-accent-border bg-accent-subtle p-5"
      >
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center bg-brand-gradient rounded-2xl text-lg font-bold uppercase text-text-on-accent">
            {initials(p.name) || <Sparkles className="h-6 w-6" />}
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-[20px] font-bold tracking-[-0.02em] text-text-primary">
              {p.name.trim() || 'Your name'}
            </p>
            {p.headline.trim() ? (
              <p className="truncate text-[14px] text-text-secondary">
                {p.headline}
              </p>
            ) : null}
          </div>
        </div>
        {contact.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-text-secondary">
            {contact.map((c) => (
              <span
                key={c.text}
                className="inline-flex min-w-0 items-center gap-1.5"
              >
                <span className="text-accent-text">{c.icon}</span>
                <span className="truncate">{c.text}</span>
              </span>
            ))}
          </div>
        ) : null}
      </motion.div>

      {thin ? (
        <div className="mt-3 flex items-start gap-2.5 rounded-2xl border border-border-subtle bg-warning-subtle px-4 py-3 text-[13px] font-medium text-warning-text">
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-warning-text"
            aria-hidden
          />
          We couldn&apos;t find your work history or education. You can add them
          in the editor, or try a different file.
        </div>
      ) : null}

      <div className="mt-3 space-y-3">
        {experience.length > 0 ? (
          <Block
            icon={<Briefcase className="h-3.5 w-3.5" />}
            title="Experience"
            count={`${experience.length} ${experience.length === 1 ? 'role' : 'roles'}`}
            delay={0.08}
          >
            <ul className="space-y-2.5">
              {experience.slice(0, 5).map((x) => (
                <li
                  key={x.id}
                  className="flex items-start justify-between gap-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-semibold text-text-primary">
                      {x.title || 'Role'}
                    </span>
                    <span className="block truncate text-[13px] text-text-tertiary">
                      {x.company}
                    </span>
                  </span>
                  <span className="shrink-0 text-[12px] tabular-nums text-text-tertiary">
                    {dateRange(x.startDate, x.endDate, x.current)}
                  </span>
                </li>
              ))}
            </ul>
            {experience.length > 5 ? (
              <p className="mt-2 text-[12px] text-text-tertiary">
                +{experience.length - 5} more
              </p>
            ) : null}
          </Block>
        ) : null}

        {education.length > 0 ? (
          <Block
            icon={<GraduationCap className="h-3.5 w-3.5" />}
            title="Education"
            delay={0.14}
          >
            <ul className="space-y-2">
              {education.slice(0, 3).map((x) => (
                <li
                  key={x.id}
                  className="flex items-start justify-between gap-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-semibold text-text-primary">
                      {[x.degree, x.field].filter((v) => v.trim()).join(', ') ||
                        x.school}
                    </span>
                    {x.degree.trim() || x.field.trim() ? (
                      <span className="block truncate text-[13px] text-text-tertiary">
                        {x.school}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-[12px] tabular-nums text-text-tertiary">
                    {[x.startYear, x.endYear]
                      .filter((v) => v.trim())
                      .join(' – ')}
                  </span>
                </li>
              ))}
            </ul>
          </Block>
        ) : null}

        {skills.length > 0 ? (
          <Block
            icon={<Sparkles className="h-3.5 w-3.5" />}
            title="Skills"
            count={`${skills.length}`}
            delay={0.2}
          >
            <div className="flex flex-wrap gap-1.5">
              {skills.slice(0, MAX_SKILLS).map((s) => (
                <span
                  key={s}
                  className="rounded-full border border-border-subtle bg-bg-sunken px-2.5 py-1 text-[12px] text-text-secondary"
                >
                  {s}
                </span>
              ))}
              {skills.length > MAX_SKILLS ? (
                <span className="rounded-full px-2 py-1 text-[12px] text-text-tertiary">
                  +{skills.length - MAX_SKILLS} more
                </span>
              ) : null}
            </div>
          </Block>
        ) : null}

        {summary ? (
          <Block
            icon={<Sparkles className="h-3.5 w-3.5" />}
            title="Summary"
            delay={0.26}
          >
            <p className="line-clamp-3 text-[13px] leading-relaxed text-text-secondary">
              {summary}
            </p>
          </Block>
        ) : null}
      </div>

      <div className="mt-6 flex flex-col-reverse items-center gap-3 sm:flex-row sm:justify-between">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[13px]">
          {onFixInEditor ? (
            <button
              type="button"
              onClick={onFixInEditor}
              className="font-medium text-text-secondary underline-offset-4 transition hover:text-text-primary hover:underline"
            >
              Something wrong? Fix it in the editor
            </button>
          ) : null}
          {onUploadAnother ? (
            <button
              type="button"
              onClick={onUploadAnother}
              className="font-medium text-text-secondary underline-offset-4 transition hover:text-text-primary hover:underline"
            >
              {uploadAnotherLabel}
            </button>
          ) : null}
        </div>
        <Button
          type="button"
          variant="accent"
          onClick={onContinue}
          className="w-full shrink-0 whitespace-nowrap px-7 sm:w-auto"
        >
          {continueLabel}
        </Button>
      </div>
    </div>
  );
}
