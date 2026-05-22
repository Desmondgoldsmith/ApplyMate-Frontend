'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';

import { useBreadcrumbTrail, type BreadcrumbItem } from '@/components/dashboard/BreadcrumbContext';
import { cn } from '@/lib/utils';

function buildBaseTrail(pathname: string): BreadcrumbItem[] {
  const path = pathname.split('?')[0] ?? pathname;
  const crumbs: BreadcrumbItem[] = [{ label: 'Dashboard', href: '/dashboard' }];

  if (path === '/dashboard') return crumbs;

  if (path.startsWith('/dashboard/job-board')) {
    crumbs.push({ label: 'Job Board', href: '/dashboard/job-board' });
    return crumbs;
  }

  if (path.startsWith('/dashboard/jobs/analyze')) {
    crumbs.push({ label: 'Job Analyzer', href: '/dashboard/jobs/analyze' });
    return crumbs;
  }

  if (path === '/dashboard/jobs/archive') {
    crumbs.push({ label: 'Job Hub', href: '/dashboard/jobs' });
    crumbs.push({ label: 'Archived jobs' });
    return crumbs;
  }

  if (path.startsWith('/dashboard/jobs')) {
    crumbs.push({ label: 'Job Hub', href: '/dashboard/jobs' });
    return crumbs;
  }

  if (path.startsWith('/dashboard/career-achievements')) {
    crumbs.push({ label: 'Career Achievements' });
    return crumbs;
  }

  if (path.startsWith('/dashboard/achievements')) {
    crumbs.push({ label: 'Achievements' });
    return crumbs;
  }

  if (path.startsWith('/dashboard/analyses')) {
    crumbs.push({ label: 'Analyses', href: '/dashboard/analyses' });
    return crumbs;
  }

  if (path.startsWith('/dashboard/cv-profiles')) {
    crumbs.push({ label: 'CV Profiles', href: '/dashboard/cv-profiles' });
    return crumbs;
  }

  if (path.startsWith('/dashboard/cv')) {
    crumbs.push({ label: 'CV Clinic', href: '/dashboard/cv' });
    return crumbs;
  }

  if (path.startsWith('/dashboard/follow-up-jobs')) {
    crumbs.push({ label: 'Follow-up jobs', href: '/dashboard/follow-up-jobs' });
    return crumbs;
  }

  if (path.startsWith('/dashboard/interview')) {
    crumbs.push({ label: 'Interview prep', href: '/dashboard/interview' });
    return crumbs;
  }

  if (path.startsWith('/dashboard/settings')) {
    crumbs.push({ label: 'Settings', href: '/dashboard/settings' });
    return crumbs;
  }

  if (path.startsWith('/dashboard/career-goals')) {
    crumbs.push({ label: 'Career goals', href: '/dashboard/career-goals' });
    return crumbs;
  }

  const segment = path.replace('/dashboard/', '').split('/')[0];
  if (segment) {
    const label = segment
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    crumbs.push({ label });
  }

  return crumbs;
}

export function DashboardBreadcrumbs({ className }: { className?: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { trailSuffix } = useBreadcrumbTrail();

  const trail = useMemo(() => {
    const base = buildBaseTrail(pathname);
    if (trailSuffix?.length) {
      const withoutLast = base.length > 1 ? base.slice(0, -1) : base;
      return [...withoutLast, ...trailSuffix];
    }

    const onJobHubDetail =
      pathname.startsWith('/dashboard/jobs') &&
      !pathname.startsWith('/dashboard/jobs/analyze') &&
      pathname !== '/dashboard/jobs/archive' &&
      (Boolean(searchParams.get('jobKey')?.trim()) ||
        Boolean(searchParams.get('jobId')?.trim()) ||
        Boolean(searchParams.get('jobAnalysisId')?.trim()) ||
        Boolean(searchParams.get('applicationId')?.trim()) ||
        Boolean(searchParams.get('bookmarkId')?.trim()) ||
        Boolean(searchParams.get('jobListingId')?.trim()));

    if (onJobHubDetail && base[base.length - 1]?.label === 'Job Hub') {
      return [...base, { label: 'Job details' }];
    }

    return base;
  }, [pathname, searchParams, trailSuffix]);

  const crumbClass = 'truncate text-[12px] font-medium sm:text-[13px]';

  if (trail.length <= 1 && trail[0]?.href === '/dashboard') {
    return (
      <nav aria-label="Breadcrumb" className={cn('min-w-0', className)}>
        <span className={cn(crumbClass, 'font-semibold text-white/95')}>
          {trail[0]?.label ?? 'Dashboard'}
        </span>
      </nav>
    );
  }

  return (
    <nav aria-label="Breadcrumb" className={cn('min-w-0', className)}>
      <ol className="flex min-w-0 flex-wrap items-center gap-1">
        {trail.map((item, i) => {
          const isLast = i === trail.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex min-w-0 max-w-full items-center gap-1">
              {i > 0 ? (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/25" aria-hidden />
              ) : null}
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className={cn(crumbClass, 'text-white/55 transition hover:text-[#00C9B1]')}
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={cn(crumbClass, isLast ? 'font-semibold text-white/95' : 'text-white/55')}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
