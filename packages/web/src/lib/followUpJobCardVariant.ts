import type { LucideIcon } from 'lucide-react';
import { BarChart3, Bookmark, Briefcase } from 'lucide-react';

import type { FollowUpJobSource } from '@/lib/today-plan';

export type FollowUpCardVariant = {
  key: 'analysis' | 'bookmark' | 'application' | 'unknown';
  label: string;
  shortLabel: string;
  Icon: LucideIcon;
  /** Left accent bar + icon tint */
  accentBar: string;
  iconWrap: string;
  /** Card surface + border */
  card: string;
  /** Small meta pill */
  pill: string;
};

const VARIANTS: Record<FollowUpCardVariant['key'], FollowUpCardVariant> = {
  analysis: {
    key: 'analysis',
    label: 'Job analysis',
    shortLabel: 'Analysis',
    Icon: BarChart3,
    accentBar: 'bg-gradient-to-b from-[#00C9B1] via-[#5EEAD4] to-[#0D9488]/80',
    iconWrap: 'border-[#00C9B1]/35 bg-[#00C9B1]/12 text-[#5EEAD4]',
    card: 'border-[#00C9B1]/22 bg-gradient-to-br from-[#00C9B1]/[0.07] to-transparent shadow-[inset_0_1px_0_0_rgba(0,201,177,0.12)]',
    pill: 'border-[#00C9B1]/25 bg-[#00C9B1]/10 text-[#9CF5EA]',
  },
  bookmark: {
    key: 'bookmark',
    label: 'Bookmarked role',
    shortLabel: 'Bookmark',
    Icon: Bookmark,
    accentBar: 'bg-gradient-to-b from-amber-400 via-amber-500 to-orange-600/90',
    iconWrap: 'border-amber-400/35 bg-amber-500/12 text-amber-200',
    card: 'border-amber-500/20 bg-gradient-to-br from-amber-500/[0.06] to-transparent shadow-[inset_0_1px_0_0_rgba(251,191,36,0.1)]',
    pill: 'border-amber-400/25 bg-amber-500/12 text-amber-100/90',
  },
  application: {
    key: 'application',
    label: 'Application',
    shortLabel: 'Applied',
    Icon: Briefcase,
    accentBar: 'bg-gradient-to-b from-emerald-400 via-emerald-500 to-teal-700/90',
    iconWrap: 'border-emerald-400/35 bg-emerald-500/12 text-emerald-200',
    card: 'border-emerald-500/22 bg-gradient-to-br from-emerald-500/[0.07] to-transparent shadow-[inset_0_1px_0_0_rgba(16,185,129,0.12)]',
    pill: 'border-emerald-400/25 bg-emerald-500/12 text-emerald-100/90',
  },
  unknown: {
    key: 'unknown',
    label: 'Follow-up',
    shortLabel: 'Queue',
    Icon: Briefcase,
    accentBar: 'bg-gradient-to-b from-white/40 to-white/10',
    iconWrap: 'border-white/15 bg-white/[0.06] text-white/70',
    card: 'border-white/[0.12] bg-white/[0.03]',
    pill: 'border-white/12 bg-white/[0.06] text-white/55',
  },
};

export function followUpJobCardVariant(source: FollowUpJobSource | null | undefined): FollowUpCardVariant {
  const s = (source ?? '').trim().toLowerCase();
  if (s === 'analysis') return VARIANTS.analysis;
  if (s === 'bookmark') return VARIANTS.bookmark;
  if (s === 'application') return VARIANTS.application;
  return VARIANTS.unknown;
}

/** Human label derived from `source` only (not coaching stage). */
export function followUpJobSourceDisplayLabel(source: FollowUpJobSource | null | undefined): string {
  return followUpJobCardVariant(source).label;
}
