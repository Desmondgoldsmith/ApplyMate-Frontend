'use client';

import { motion, useReducedMotion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  GraduationCap,
  Mail,
  MapPin,
  Phone,
  Sparkles,
} from 'lucide-react';
import type { ReactNode } from 'react';

import type { CVBuilderData } from '@/lib/cvBuilder';
import { cn } from '@/lib/utils';

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
      className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4"
    >
      <h3 className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-white/50">
        <span className="text-[#00C9B1]" aria-hidden>
          {icon}
        </span>
        {title}
        {count ? (
          <span className="ml-auto rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium normal-case tracking-normal text-white/55">
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
        className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 py-8 text-center"
        role="alert"
      >
        <p className="text-[15px] font-semibold text-white">
          We couldn&apos;t load your CV just now
        </p>
        <p className="mt-1.5 text-[13px] text-white/55">
          Your CV is saved. Check your connection and try again.
        </p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-[#00C9B1] px-6 text-[14px] font-semibold text-[#080A0A]"
          >
            Try again
          </button>
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
            className="animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.03]"
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
        className="relative overflow-hidden rounded-2xl border border-[rgba(0,201,177,0.25)] bg-[linear-gradient(135deg,rgba(0,201,177,0.12),rgba(0,201,177,0.02))] p-5"
      >
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#00C9B1] text-lg font-bold uppercase text-[#080A0A]">
            {initials(p.name) || <Sparkles className="h-6 w-6" />}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[18px] font-bold text-white">
              {p.name.trim() || 'Your name'}
            </p>
            {p.headline.trim() ? (
              <p className="truncate text-[14px] text-white/65">{p.headline}</p>
            ) : null}
          </div>
        </div>
        {contact.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-white/60">
            {contact.map((c) => (
              <span
                key={c.text}
                className="inline-flex min-w-0 items-center gap-1.5"
              >
                <span className="text-[#00C9B1]">{c.icon}</span>
                <span className="truncate">{c.text}</span>
              </span>
            ))}
          </div>
        ) : null}
      </motion.div>

      {thin ? (
        <div className="mt-3 flex items-start gap-2.5 rounded-2xl border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-4 py-3 text-[13px] text-amber-100/90">
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-[#F59E0B]"
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
                    <span className="block truncate text-[14px] font-semibold text-white">
                      {x.title || 'Role'}
                    </span>
                    <span className="block truncate text-[13px] text-white/55">
                      {x.company}
                    </span>
                  </span>
                  <span className="shrink-0 text-[12px] tabular-nums text-white/45">
                    {dateRange(x.startDate, x.endDate, x.current)}
                  </span>
                </li>
              ))}
            </ul>
            {experience.length > 5 ? (
              <p className="mt-2 text-[12px] text-white/40">
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
                    <span className="block truncate text-[14px] font-semibold text-white">
                      {[x.degree, x.field].filter((v) => v.trim()).join(', ') ||
                        x.school}
                    </span>
                    {x.degree.trim() || x.field.trim() ? (
                      <span className="block truncate text-[13px] text-white/55">
                        {x.school}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-[12px] tabular-nums text-white/45">
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
                  className="rounded-full border border-white/[0.1] bg-white/[0.04] px-2.5 py-1 text-[12px] text-white/75"
                >
                  {s}
                </span>
              ))}
              {skills.length > MAX_SKILLS ? (
                <span className="rounded-full px-2 py-1 text-[12px] text-white/45">
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
            <p className="line-clamp-3 text-[13px] leading-relaxed text-white/65">
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
              className="text-white/55 underline-offset-4 transition hover:text-white hover:underline"
            >
              Something wrong? Fix it in the editor
            </button>
          ) : null}
          {onUploadAnother ? (
            <button
              type="button"
              onClick={onUploadAnother}
              className="text-white/40 underline-offset-4 transition hover:text-white/75 hover:underline"
            >
              {uploadAnotherLabel}
            </button>
          ) : null}
        </div>
        <motion.button
          type="button"
          onClick={onContinue}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          className={cn(
            'group inline-flex h-12 w-full shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-[#00C9B1] px-6 text-[14px] font-semibold text-[#080A0A] sm:w-auto',
            'shadow-[0_8px_30px_rgba(0,201,177,0.25)] transition-shadow hover:shadow-[0_10px_36px_rgba(0,201,177,0.38)]',
          )}
        >
          {continueLabel}
          <ArrowRight
            className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
            strokeWidth={2.5}
          />
        </motion.button>
      </div>
    </div>
  );
}
