import type { ComponentType } from 'react';
import {
  Archive,
  BrainCircuit,
  Briefcase,
  FileSearch,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Library,
  Search,
  Settings,
  Trophy,
} from 'lucide-react';

export type DashboardNavItem = {
  id: string;
  /** Desktop / sidebar label */
  label: string;
  /** Short label for mobile bottom bar */
  shortLabel: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  always?: boolean;
  feature?: 'jobs' | 'interviews' | 'student';
  comingSoon?: boolean;
  /** For tour / analytics */
  tourAttr?: string;
  /** Nested job workspace links (sidebar accordion / mobile sheet) */
  children?: DashboardNavItem[];
};

export const DASHBOARD_NAV_ITEMS: DashboardNavItem[] = [
  {
    id: 'overview',
    label: 'Overview',
    shortLabel: 'Home',
    href: '/dashboard',
    icon: LayoutDashboard,
    always: true,
  },
  {
    id: 'job-workspace',
    label: 'Jobs workspace',
    shortLabel: 'Jobs',
    href: '/dashboard/jobs',
    icon: Briefcase,
    feature: 'jobs',
    children: [
      {
        id: 'job-board',
        label: 'Job Board',
        shortLabel: 'Board',
        href: '/dashboard/job-board',
        icon: Search,
        feature: 'jobs',
        tourAttr: 'nav-job-board',
      },
      {
        id: 'job-analyze',
        label: 'Job Analyzer',
        shortLabel: 'Analyze',
        href: '/dashboard/jobs/analyze?clean=1',
        icon: FileSearch,
        feature: 'jobs',
        tourAttr: 'nav-job-analyzer',
      },
      {
        id: 'jobs',
        label: 'Job Hub',
        shortLabel: 'Hub',
        href: '/dashboard/jobs',
        icon: Briefcase,
        feature: 'jobs',
        tourAttr: 'nav-job-hub',
      },
      {
        id: 'job-archive',
        label: 'Archived jobs',
        shortLabel: 'Archive',
        href: '/dashboard/jobs/archive',
        icon: Archive,
        feature: 'jobs',
      },
      {
        id: 'career-achievements',
        label: 'Career Achievements',
        shortLabel: 'Wins',
        href: '/dashboard/career-achievements',
        icon: Trophy,
        feature: 'jobs',
      },
    ],
  },
  {
    id: 'cv',
    label: 'CV Clinic',
    shortLabel: 'CV',
    href: '/dashboard/cv',
    icon: FileText,
    always: true,
  },
  {
    id: 'cv-profiles',
    label: 'CV Profiles',
    shortLabel: 'Profiles',
    href: '/dashboard/cv-profiles',
    icon: Library,
    always: true,
  },
  {
    id: 'interviews',
    label: 'Interviews',
    shortLabel: 'Prep',
    href: '/dashboard/interview',
    icon: BrainCircuit,
    feature: 'interviews',
  },
  {
    id: 'student',
    label: 'Student Guide',
    shortLabel: 'Study',
    href: '/dashboard/student',
    icon: GraduationCap,
    feature: 'student',
    comingSoon: true,
  },
  {
    id: 'settings',
    label: 'Settings',
    shortLabel: 'Settings',
    href: '/dashboard/settings',
    icon: Settings,
    always: true,
  },
];

/** Flatten nested nav for consumers that need a linear list (e.g. “extra” items). */
export function flattenDashboardNavItems(
  items: DashboardNavItem[],
): DashboardNavItem[] {
  const out: DashboardNavItem[] = [];
  for (const item of items) {
    if (item.children?.length) {
      out.push(...item.children.map((c) => ({ ...c, children: undefined })));
    } else {
      out.push({ ...item, children: undefined });
    }
  }
  return out;
}

export function getVisibleDashboardNavItems(
  features: string[],
): DashboardNavItem[] {
  return DASHBOARD_NAV_ITEMS.filter((item) => {
    if (item.always) return true;
    if (!item.feature) return false;
    return features.includes(item.feature);
  }).map((item) => {
    if (!item.children?.length) return item;
    return {
      ...item,
      children: item.children.filter((ch) => {
        if (ch.always) return true;
        if (!ch.feature) return true;
        return features.includes(ch.feature);
      }),
    };
  });
}

/** True if pathname matches this route or any child route. */
export function isDashboardNavActive(pathname: string, href: string): boolean {
  const p = pathname.split('?')[0] ?? pathname;
  const h = href.split('?')[0] ?? href;
  if (h === '/dashboard') return p === '/dashboard' || p === '/dashboard/';
  if (h === '/dashboard/jobs/analyze') {
    return (
      p === '/dashboard/jobs/analyze' ||
      p.startsWith('/dashboard/jobs/analyze/') ||
      /^\/dashboard\/jobs\/analyze\/[0-9a-f-]{36}$/i.test(p)
    );
  }
  if (h === '/dashboard/jobs') {
    if (p === '/dashboard/jobs' || p === '/dashboard/jobs/') return true;
    if (p.startsWith('/dashboard/jobs/')) {
      return (
        !p.startsWith('/dashboard/jobs/analyze') &&
        !p.startsWith('/dashboard/jobs/archive')
      );
    }
    return false;
  }
  if (h === '/dashboard/jobs/archive') {
    return (
      p === '/dashboard/jobs/archive' ||
      p.startsWith('/dashboard/jobs/archive/')
    );
  }
  return p === h || p.startsWith(`${h}/`);
}

/** Active if this entry or any descendant matches pathname. */
export function isDashboardNavEntryActive(
  pathname: string,
  item: DashboardNavItem,
): boolean {
  if (item.children?.length) {
    return item.children.some((c) => isDashboardNavActive(pathname, c.href));
  }
  return isDashboardNavActive(pathname, item.href);
}
