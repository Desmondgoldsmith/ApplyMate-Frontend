import type { ComponentType } from 'react';
import {
  Archive,
  BrainCircuit,
  Briefcase,
  FileSearch,
  FileText,
  GraduationCap,
  House,
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
  /** Kept routable but left out of menus to keep navigation simple. */
  hidden?: boolean;
  /** Target for the welcome tour (`data-tour`); shared by sidebar and mobile bar. */
  tourAttr?: string;
  /** Nested job workspace links (sidebar accordion / mobile sheet) */
  children?: DashboardNavItem[];
};

export const DASHBOARD_NAV_ITEMS: DashboardNavItem[] = [
  {
    id: 'overview',
    label: 'Home',
    shortLabel: 'Home',
    href: '/dashboard',
    icon: House,
    always: true,
  },
  {
    id: 'job-workspace',
    label: 'Jobs',
    shortLabel: 'Jobs',
    href: '/dashboard/jobs',
    icon: Briefcase,
    feature: 'jobs',
    tourAttr: 'nav-jobs',
    children: [
      {
        id: 'job-board',
        label: 'Find jobs',
        shortLabel: 'Find jobs',
        href: '/dashboard/job-board',
        icon: Search,
        feature: 'jobs',
      },
      {
        id: 'job-analyze',
        label: 'Check a job',
        shortLabel: 'Check a job',
        href: '/dashboard/jobs/analyze?clean=1',
        icon: FileSearch,
        feature: 'jobs',
      },
      {
        id: 'jobs',
        label: 'My applications',
        shortLabel: 'Applications',
        href: '/dashboard/jobs',
        icon: Briefcase,
        feature: 'jobs',
      },
      {
        id: 'job-archive',
        label: 'Archived jobs',
        shortLabel: 'Archive',
        href: '/dashboard/jobs/archive',
        icon: Archive,
        feature: 'jobs',
        hidden: true,
      },
      {
        id: 'career-achievements',
        label: 'Career achievements',
        shortLabel: 'Wins',
        href: '/dashboard/career-achievements',
        icon: Trophy,
        feature: 'jobs',
        hidden: true,
      },
    ],
  },
  {
    id: 'cv',
    label: 'My CV',
    shortLabel: 'My CV',
    href: '/dashboard/cv',
    icon: FileText,
    always: true,
    tourAttr: 'nav-cv',
  },
  {
    id: 'cv-profiles',
    label: 'CV versions',
    shortLabel: 'Versions',
    href: '/dashboard/cv-profiles',
    icon: Library,
    always: true,
  },
  {
    id: 'interviews',
    label: 'Interview practice',
    shortLabel: 'Practice',
    href: '/dashboard/interview',
    icon: BrainCircuit,
    feature: 'interviews',
    tourAttr: 'nav-interviews',
  },
  {
    id: 'student',
    label: 'Student Guide',
    shortLabel: 'Study',
    href: '/dashboard/student',
    icon: GraduationCap,
    feature: 'student',
    comingSoon: true,
    hidden: true,
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
    if (item.hidden) return false;
    if (item.always) return true;
    if (!item.feature) return false;
    return features.includes(item.feature);
  }).map((item) => {
    if (!item.children?.length) return item;
    return {
      ...item,
      children: item.children.filter((ch) => {
        if (ch.hidden) return false;
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
      return !p.startsWith('/dashboard/jobs/analyze');
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
