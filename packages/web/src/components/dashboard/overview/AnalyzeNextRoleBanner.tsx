'use client';

import { motion } from 'framer-motion';
import {
  Briefcase,
  FileText,
  GraduationCap,
  MessageSquare,
  Rocket,
} from 'lucide-react';
import Link from 'next/link';

import type { CvProfileSummary } from '@/lib/api';
import { sectionMotion } from '@/components/dashboard/overview/dashboardOverviewHelpers';

export function AnalyzeNextRoleBanner({
  primaryGoal,
  defaultProfile,
}: {
  primaryGoal: string | null | undefined;
  defaultProfile: CvProfileSummary | null;
}) {
  const cvHref =
    defaultProfile != null
      ? `/dashboard/cv?profileId=${encodeURIComponent(defaultProfile.id)}`
      : '/dashboard/cv';

  const config =
    primaryGoal === 'jobs'
      ? {
          icon: Briefcase,
          title: 'Ready to analyze your next role?',
          body: 'Paste any job description to get your match score and a tailored cover letter in about 60 seconds.',
          cta: 'Analyze a Job →',
          href: '/dashboard/jobs/analyze',
        }
      : primaryGoal === 'cv'
        ? {
            icon: FileText,
            title: 'Sharpen your CV in the Clinic',
            body: 'Run a full scan for section-by-section suggestions and a clear score you can improve.',
            cta: 'Open CV Clinic →',
            href: cvHref,
          }
        : primaryGoal === 'interviews'
          ? {
              icon: MessageSquare,
              title: 'Interview prep is on the way',
              body: 'Mock interviews tailored to your role are coming soon — keep your CV ready.',
              cta: 'View interviews →',
              href: '/dashboard/interview',
            }
          : primaryGoal === 'student'
            ? {
                icon: GraduationCap,
                title: 'Start building your story',
                body: 'The student career guide is coming soon. Your CV is the best place to begin.',
                cta: 'Build my CV →',
                href: cvHref,
              }
            : {
                icon: Rocket,
                title: 'Ready to analyze your next role?',
                body: 'Paste any job description to get your match score and a tailored cover letter in about 60 seconds.',
                cta: 'Analyze a Job →',
                href: '/dashboard/jobs/analyze',
              };

  const Icon = config.icon;

  return (
    <motion.section
      {...sectionMotion}
      transition={{
        duration: 0.35,
        delay: 0.45,
        ease: [0.21, 0.47, 0.32, 0.98],
      }}
      className="rounded-2xl border border-[rgba(0,201,177,0.3)] bg-gradient-to-br from-[rgba(0,201,177,0.15)] to-[rgba(0,201,177,0.05)] p-6 sm:p-8"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[rgba(0,201,177,0.12)] sm:h-14 sm:w-14">
          <Icon className="h-7 w-7 text-[#00C9B1] sm:h-8 sm:w-8" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[16px] font-semibold text-white">
            {config.title}
          </h3>
          <p className="mt-2 text-[13px] font-medium leading-relaxed text-white/60">
            {config.body}
          </p>
        </div>
      </div>
      <Link
        href={config.href}
        className="mt-6 flex min-h-[48px] w-full items-center justify-center rounded-xl bg-[#00C9B1] px-4 py-3 text-[14px] font-semibold text-[#080A0A] transition-colors hover:bg-[#33d4c2]"
      >
        {config.cta}
      </Link>
    </motion.section>
  );
}
