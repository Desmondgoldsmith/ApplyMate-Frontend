'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronLeft, ChevronRight, Loader2, Search, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { JobBoardAlertsBar } from '@/components/job-board/JobBoardAlertsBar';
import { JobBoardFilters, type JobBoardFiltersState } from '@/components/job-board/JobBoardFilters';
import { JobDetailPanel } from '@/components/job-board/JobDetailPanel';
import { JobListingCard } from '@/components/job-board/JobListingCard';
import { Button } from '@/components/ui/Button';
import { InfoHint } from '@/components/ui/InfoHint';
import { useToast } from '@/components/ui/Toast';
import { useCVProfiles } from '@/hooks/useCVProfiles';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useIsMaxLg } from '@/hooks/useIsMaxLg';
import { useJobDiscovery } from '@/hooks/useJobDiscovery';
import { api, type JobListingDto } from '@/lib/api';
import { trackFunnelEvent } from '@/lib/actionFunnel';
import { compactLocationForJobSearch } from '@/lib/jobBoardDiscoverQuery';
import { formatSearchContextBanner } from '@/lib/jobBoardSearchContext';
import { resolveEffectiveLocationClient } from '@/lib/resolve-effective-location-client';
import { useAuthStore } from '@/store/useAuthStore';
import { useLocationStore } from '@/store/useLocationStore';

const DEFAULT_PAGE_SIZE = 20;
const LOCATION_STORAGE_KEY_PREFIX = 'applymate:job-board:last-location';

type ImmediateFilterKey = 'workMode' | 'employmentType' | 'datePosted';

export default function JobBoardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const profilesQ = useCVProfiles();
  const me = useCurrentUser();
  const accessToken = useAuthStore((s) => s.accessToken);
  const selectedLocationStore = useLocationStore((s) => s.selectedLocation);
  const setSelectedLocation = useLocationStore((s) => s.setSelectedLocation);
  const detectedLocationStore = useLocationStore((s) => s.detectedLocation);
  const profiles = profilesQ.data?.rows ?? [];
  const isMaxLg = useIsMaxLg();
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  const [qInput, setQInput] = useState('');
  const [locationInput, setLocationInput] = useState('');

  const [appliedFilters, setAppliedFilters] = useState<JobBoardFiltersState>({
    q: '',
    workMode: '',
    employmentType: '',
    location: '',
    datePosted: '',
    page: 1,
    remoteFirst: false,
  });

  const [dismissedLocationFallbackBanner, setDismissedLocationFallbackBanner] = useState(false);
  const [dismissedRemoteFirstBanner, setDismissedRemoteFirstBanner] = useState(false);
  const [dismissedFreshnessBanner, setDismissedFreshnessBanner] = useState(false);
  const [dismissedSearchContextBanner, setDismissedSearchContextBanner] = useState(false);
  const [hideLowMatch, setHideLowMatch] = useState(true);
  const queryClient = useQueryClient();
  const [filtersCollapsed, setFiltersCollapsed] = useState(true);
  const [locationBootstrapped, setLocationBootstrapped] = useState(false);
  const locationInputRef = useRef<HTMLInputElement>(null);
  const refinedTrackedRef = useRef(new Set<string>());
  const seenMarkedRef = useRef(false);
  const locationStorageKey = useMemo(
    () => `${LOCATION_STORAGE_KEY_PREFIX}:${me.data?.id?.trim() || 'anon'}`,
    [me.data?.id],
  );

  const setRemoteFirst = useCallback((next: boolean) => {
    setAppliedFilters((prev) => ({
      ...prev,
      remoteFirst: next,
      location: next ? '' : prev.location,
      page: 1,
    }));
    if (next) setLocationInput('');
  }, []);

  useEffect(() => {
    if (selectedProfileId) return;
    if (profiles.length === 0) return;
    const id = profiles.find((p) => p.isDefault)?.id ?? profiles[0]!.id;
    setSelectedProfileId(id);
  }, [profiles, selectedProfileId]);

  useEffect(() => {
    if (locationBootstrapped) return;
    if (!profilesQ.isFetched) return;
    if (accessToken && !me.isFetched) return;
    if (profiles.length > 0 && !selectedProfileId) return;

    const profile =
      profiles.find((p) => p.id === selectedProfileId) ??
      profiles.find((p) => p.isDefault) ??
      profiles[0];

    let saved = '';
    try {
      saved = window.localStorage.getItem(locationStorageKey)?.trim() ?? '';
    } catch {
      /* ignore */
    }

    const uiPrefs = me.data?.uiPrefs as { jobSearchLocation?: string } | null | undefined;
    const savedPref =
      typeof uiPrefs?.jobSearchLocation === 'string' ? uiPrefs.jobSearchLocation.trim() : '';
    const accountLoc = me.data?.location?.trim();
    const profLoc = profile?.location?.trim();
    const effective = resolveEffectiveLocationClient({
      savedPreference: selectedLocationStore || savedPref || undefined,
      detected: detectedLocationStore,
      cvLocation: profLoc || accountLoc,
    });
    const pick = effective.label || accountLoc || profLoc || saved || '';

    setLocationBootstrapped(true);
    if (pick) {
      setLocationInput(pick);
      setAppliedFilters((prev) => ({ ...prev, location: pick, page: 1 }));
    }
  }, [
    locationBootstrapped,
    profilesQ.isFetched,
    profiles,
    selectedProfileId,
    me.data?.location,
    locationStorageKey,
    accessToken,
    me.isFetched,
  ]);

  useEffect(() => {
    setDismissedLocationFallbackBanner(false);
    setDismissedRemoteFirstBanner(false);
    setDismissedFreshnessBanner(false);
    setDismissedSearchContextBanner(false);
  }, [
    appliedFilters.q,
    appliedFilters.location,
    appliedFilters.remoteFirst,
    appliedFilters.workMode,
    appliedFilters.employmentType,
    appliedFilters.datePosted,
    selectedProfileId,
    selectedLocationStore,
    detectedLocationStore,
    me.data?.uiPrefs,
  ]);

  const patchImmediateFilter = useCallback((key: ImmediateFilterKey, value: string) => {
    setAppliedFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  }, []);

  const applySearch = useCallback(() => {
    const nextLoc = appliedFilters.remoteFirst ? '' : locationInput.trim();
    const nextQ = qInput.trim();
    if (nextLoc) {
      try {
        window.localStorage.setItem(locationStorageKey, nextLoc);
      } catch {
        /* ignore */
      }
      setSelectedLocation(nextLoc);
      void api.users
        .updateMe({ uiPrefs: { jobSearchLocation: nextLoc } })
        .then(() => queryClient.invalidateQueries({ queryKey: ['me'] }))
        .catch(() => {
          toast.error('Location saved locally but could not sync to your account.');
        });
    }
    setAppliedFilters((prev) => ({ ...prev, q: nextQ, location: nextLoc, page: 1 }));
  }, [
    qInput,
    locationInput,
    locationStorageKey,
    appliedFilters.remoteFirst,
    setSelectedLocation,
    queryClient,
    toast,
  ]);

  const resetNonLocationFilters = useCallback(() => {
    setQInput('');
    setAppliedFilters((prev) => ({
      ...prev,
      q: '',
      workMode: '',
      employmentType: '',
      datePosted: '',
      page: 1,
      remoteFirst: false,
    }));
  }, []);

  const cvProfileIdForDiscover = useMemo(() => {
    if (profiles.length === 0) return undefined;
    if (selectedProfileId) return selectedProfileId;
    return profiles.find((p) => p.isDefault)?.id ?? profiles[0]?.id;
  }, [profiles, selectedProfileId]);

  const collapsedLocationHint = useMemo(() => {
    if (appliedFilters.remoteFirst) return 'Remote-first';
    return compactLocationForJobSearch(
      appliedFilters.location.trim() || locationInput.trim() || me.data?.location?.trim() || '',
    );
  }, [appliedFilters.remoteFirst, appliedFilters.location, locationInput, me.data?.location]);

  const collapsedCvLabel = useMemo(() => {
    const p =
      profiles.find((x) => x.id === selectedProfileId) ??
      profiles.find((x) => x.isDefault) ??
      profiles[0];
    return p?.name?.trim() ?? '';
  }, [profiles, selectedProfileId]);
  const selectedProfileLocation = useMemo(() => {
    const p =
      profiles.find((x) => x.id === selectedProfileId) ??
      profiles.find((x) => x.isDefault) ??
      profiles[0];
    return p?.location?.trim() ?? '';
  }, [profiles, selectedProfileId]);

  const collapsedSummaryTitle = useMemo(() => {
    const bits = [collapsedLocationHint, collapsedCvLabel].filter(Boolean);
    if (bits.length === 0) return 'Search & filters';
    return `Search & filters · ${bits.join(' · ')}`;
  }, [collapsedLocationHint, collapsedCvLabel]);

  const params = useMemo(() => {
    /** Keyword override only — omit for default list; backend builds JSearch query from CV + location. */
    const q = appliedFilters.q.trim() ? appliedFilters.q.trim().slice(0, 500) : undefined;
    return {
      ...(q ? { q } : {}),
      workMode: appliedFilters.workMode || undefined,
      employmentType: appliedFilters.employmentType || undefined,
      location: appliedFilters.remoteFirst ? undefined : appliedFilters.location || undefined,
      datePosted: appliedFilters.datePosted || undefined,
      page: appliedFilters.page,
      pageSize: DEFAULT_PAGE_SIZE,
      cvProfileId: cvProfileIdForDiscover,
      remoteFirst: appliedFilters.remoteFirst ? true : undefined,
    };
  }, [appliedFilters, cvProfileIdForDiscover]);

  const discoverEnabled =
    profilesQ.isFetched && (profiles.length === 0 || Boolean(cvProfileIdForDiscover));

  const jobs = useJobDiscovery(params, discoverEnabled);
  const items = useMemo(
    () => jobs.data?.items ?? [],
    [jobs.data?.items],
  );
  const displayItems = useMemo(() => {
    if (!hideLowMatch) return items;
    return items.filter((j) => j.ranking?.tier !== 'LOW_MATCH');
  }, [items, hideLowMatch]);
  const hiddenLowMatchCount = items.length - displayItems.length;
  const searchContext = jobs.data?.searchContext;
  const searchContextBanner = useMemo(
    () =>
      searchContext
        ? formatSearchContextBanner({
            locationLabel: searchContext.locationLabel,
            locationSource: searchContext.locationSource,
            roleQuery: searchContext.roleQuery,
          })
        : null,
    [searchContext],
  );
  const total = jobs.data?.total ?? 0;
  const pageSize = jobs.data?.pageSize ?? DEFAULT_PAGE_SIZE;
  const locationFallback = jobs.data?.locationFallback === true;
  const remoteFirstResponse = jobs.data?.remoteFirst === true;
  const locationLabel =
    appliedFilters.location.trim() || locationInput.trim() || me.data?.location?.trim() || 'your area';
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (appliedFilters.page - 1) * pageSize + 1;
  const rangeEnd = Math.min(appliedFilters.page * pageSize, total);
  const showPagination = total > 0 && totalPages > 1;
  const userCommittedSearch = appliedFilters.q.trim().length > 0;
  const showListRefetchOverlay = jobs.isFetching && jobs.data !== undefined && !jobs.isError;
  const freshness = jobs.data?.freshness;
  const qualityState = jobs.data?.qualityState;
  const hasLocationContext =
    Boolean(appliedFilters.location.trim()) ||
    Boolean(locationInput.trim()) ||
    Boolean(me.data?.location?.trim()) ||
    Boolean(selectedProfileLocation);
  const shouldShowLowQualityBanner = useMemo(() => {
    if (qualityState?.mode !== 'low_quality') return false;
    if ((qualityState.suggestedActions?.length ?? 0) === 0) return false;
    if (items.length === 0) return false;
    const hasStrong = items.some((j) => j.highlight?.isTopMatch === true);
    return !hasStrong;
  }, [qualityState, items]);

  const showJobListSkeleton =
    !profilesQ.isFetched ||
    (profiles.length > 0 && !cvProfileIdForDiscover) ||
    (discoverEnabled && jobs.isFetching && jobs.data === undefined && !jobs.isError);

  const prefetchListing = useCallback(
    (job: JobListingDto) => {
      void queryClient.prefetchQuery({
        queryKey: ['job-discovery-detail', job.id],
        queryFn: () => api.jobDiscovery.getDetail(job.id),
      });
      trackFunnelEvent('jobboard_card_prefetched', { jobListingId: job.id });
      void api.dashboard.prefetchNextActions({ jobListingIds: [job.id] });
    },
    [queryClient],
  );
  const handleSuggestedAction = useCallback(
    (action: { type: string; route: string; label: string }) => {
      trackFunnelEvent('jobboard_empty_guidance_clicked', { type: action.type, route: action.route });
      if (action.type === 'expand_location') {
        setFiltersCollapsed(false);
        if (!appliedFilters.remoteFirst) setRemoteFirst(true);
        setAppliedFilters((prev) => ({ ...prev, page: 1 }));
        toast.success('Expanded your scope to broader remote opportunities.');
        return;
      }
      if (action.type === 'adjust_filters') {
        setFiltersCollapsed(false);
        toast.info('Filters opened. Update filters and run Search.');
        return;
      }
      router.push(action.route);
    },
    [appliedFilters.remoteFirst, router, setRemoteFirst, toast],
  );

  const boardAlerts = useMemo(() => {
    const list: Array<{
      id: string;
      tone: 'teal' | 'neutral' | 'amber';
      message: string;
      action?: { label: string; onClick: () => void };
      onDismiss: () => void;
    }> = [];
    if (!dismissedFreshnessBanner && freshness && (freshness.newSinceLastVisitCount > 0 || freshness.updatedSinceLastVisitCount > 0)) {
      list.push({
        id: 'freshness',
        tone: 'teal',
        message:
          freshness.newSinceLastVisitCount > 0
            ? `${freshness.newSinceLastVisitCount} new jobs since your last visit`
            : `${freshness.updatedSinceLastVisitCount} jobs updated since your last visit`,
        onDismiss: () => setDismissedFreshnessBanner(true),
      });
    }
    if (!dismissedSearchContextBanner && searchContextBanner && !appliedFilters.remoteFirst) {
      list.push({
        id: 'search-context',
        tone: 'neutral',
        message: searchContextBanner,
        action: {
          label: 'Change',
          onClick: () => {
            setFiltersCollapsed(false);
            window.setTimeout(() => locationInputRef.current?.focus(), 80);
          },
        },
        onDismiss: () => setDismissedSearchContextBanner(true),
      });
    }
    if (!dismissedRemoteFirstBanner && remoteFirstResponse) {
      list.push({
        id: 'remote-first',
        tone: 'teal',
        message: 'Showing international remote roles — apply from anywhere',
        onDismiss: () => setDismissedRemoteFirstBanner(true),
      });
    }
    if (!dismissedLocationFallbackBanner && locationFallback) {
      list.push({
        id: 'location-fallback',
        tone: 'amber',
        message: `No jobs in ${locationLabel}. Showing remote roles instead.`,
        onDismiss: () => setDismissedLocationFallbackBanner(true),
      });
    }
    if (!appliedFilters.remoteFirst && !hasLocationContext) {
      list.push({
        id: 'set-location',
        tone: 'neutral',
        message: 'Set your location for stronger local matches.',
        action: {
          label: 'Set location',
          onClick: () => {
            setFiltersCollapsed(false);
            toast.info('Add your location in Search & Filters, then click Search.');
          },
        },
        onDismiss: () => {},
      });
    }
    if (shouldShowLowQualityBanner && qualityState?.suggestedActions?.length) {
      const first = qualityState.suggestedActions[0]!;
      list.push({
        id: 'low-quality',
        tone: 'amber',
        message: 'Results are low quality — try:',
        action: {
          label: first.label,
          onClick: () => handleSuggestedAction(first),
        },
        onDismiss: () => {},
      });
    }
    return list;
  }, [
    appliedFilters.remoteFirst,
    dismissedFreshnessBanner,
    dismissedLocationFallbackBanner,
    dismissedRemoteFirstBanner,
    dismissedSearchContextBanner,
    freshness,
    handleSuggestedAction,
    hasLocationContext,
    locationFallback,
    locationInputRef,
    locationLabel,
    qualityState,
    remoteFirstResponse,
    searchContextBanner,
    shouldShowLowQualityBanner,
    toast,
  ]);

  useEffect(() => {
    for (const row of items) {
      const refined = row.matchPreview?.refinedReady === true && typeof row.matchPreview?.refinedScore === 'number';
      if (!refined) continue;
      const key = `${row.id}:${Math.round(row.matchPreview!.refinedScore!)}`;
      if (refinedTrackedRef.current.has(key)) continue;
      refinedTrackedRef.current.add(key);
      trackFunnelEvent('jobboard_refined_score_ready', { jobListingId: row.id, score: row.matchPreview?.refinedScore });
    }
  }, [items]);

  useEffect(() => {
    if (seenMarkedRef.current) return;
    if (!jobs.isSuccess || items.length === 0) return;
    if (!freshness || (freshness.newSinceLastVisitCount <= 0 && freshness.updatedSinceLastVisitCount <= 0)) return;
    seenMarkedRef.current = true;
    void api.jobDiscovery.markSeen();
  }, [jobs.isSuccess, items.length, freshness]);

  useEffect(() => {
    if (items.length === 0) {
      setActiveJobId(null);
      setMobileDetailOpen(false);
      return;
    }
    if (isMaxLg) {
      setActiveJobId((prev) => (prev && displayItems.some((j) => j.id === prev) ? prev : null));
      return;
    }
    setActiveJobId((prev) =>
      prev && displayItems.some((j) => j.id === prev) ? prev : (displayItems[0]?.id ?? null),
    );
  }, [items.length, displayItems, isMaxLg]);

  useEffect(() => {
    if (!isMaxLg) setMobileDetailOpen(false);
  }, [isMaxLg]);

  /** Today’s Plan / deep links: `/dashboard/job-board?jobListingId=…` selects that listing when it appears in the current result set. */
  const focusLocationFromUrl = searchParams.get('focusLocation') === '1';
  const listingFromUrl = searchParams.get('jobListingId')?.trim() ?? '';
  const focusTokenFromUrl = searchParams.get('focusToken')?.trim() ?? '';
  const bookmarkIdFromUrl = searchParams.get('bookmarkId')?.trim() ?? '';
  const jobAnalysisIdFromUrl = searchParams.get('jobAnalysisId')?.trim() ?? '';
  const applicationIdFromUrl = searchParams.get('applicationId')?.trim() ?? '';
  useEffect(() => {
    if (!focusLocationFromUrl) return;
    setFiltersCollapsed(false);
    const timer = window.setTimeout(() => {
      locationInputRef.current?.focus();
      locationInputRef.current?.select();
      router.replace(pathname, { scroll: false });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [focusLocationFromUrl, pathname, router]);

  useEffect(() => {
    if (!focusTokenFromUrl) return;
    void api.jobDiscovery
      .focusResolve(focusTokenFromUrl)
      .then((resolved) => {
        const id = resolved.jobListingId?.trim();
        if (!id) return;
        trackFunnelEvent('jobboard_focus_opened', { focusToken: focusTokenFromUrl, jobListingId: id });
        setActiveJobId(id);
        if (isMaxLg) setMobileDetailOpen(true);
      })
      .finally(() => {
        router.replace(pathname, { scroll: false });
      });
  }, [focusTokenFromUrl, isMaxLg, pathname, router]);
  useEffect(() => {
    if (!listingFromUrl || items.length === 0) return;
    const hit = items.find((j) => j.id === listingFromUrl);
    if (!hit) return;
    setActiveJobId(hit.id);
    if (isMaxLg) setMobileDetailOpen(true);
    router.replace(pathname, { scroll: false });
  }, [listingFromUrl, items, isMaxLg, pathname, router]);

  useEffect(() => {
    if (!bookmarkIdFromUrl || items.length === 0) return;
    const hit = items.find((j) => j.bookmarkRowId === bookmarkIdFromUrl);
    if (!hit) return;
    setActiveJobId(hit.id);
    if (isMaxLg) setMobileDetailOpen(true);
    router.replace(pathname, { scroll: false });
  }, [bookmarkIdFromUrl, items, isMaxLg, pathname, router]);

  useEffect(() => {
    if (!jobAnalysisIdFromUrl || items.length === 0) return;
    const hit = items.find((j) => j.jobAnalysisId === jobAnalysisIdFromUrl);
    if (!hit) return;
    setActiveJobId(hit.id);
    if (isMaxLg) setMobileDetailOpen(true);
    router.replace(pathname, { scroll: false });
  }, [jobAnalysisIdFromUrl, items, isMaxLg, pathname, router]);

  useEffect(() => {
    if (!applicationIdFromUrl || items.length === 0) return;
    const hit = items.find((j) => j.applicationId === applicationIdFromUrl);
    if (!hit) return;
    setActiveJobId(hit.id);
    if (isMaxLg) setMobileDetailOpen(true);
    router.replace(pathname, { scroll: false });
  }, [applicationIdFromUrl, items, isMaxLg, pathname, router]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-[#0C0F0F] p-2" data-tour="job-board-filters">
        <button
          type="button"
          onClick={() => setFiltersCollapsed((v) => !v)}
          title={collapsedSummaryTitle}
          className="flex w-full items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-[0.08em] text-white/65 hover:bg-white/[0.03]"
        >
          <span className="min-w-0 truncate normal-case tracking-normal inline-flex items-center gap-1.5">
            Search & Filters
            <InfoHint text="Default results use your selected CV and location. Use Search when you want keyword overrides." />
            {collapsedLocationHint ? (
              <span className="text-white/45"> · {collapsedLocationHint}</span>
            ) : null}
            {collapsedCvLabel ? (
              <span className="text-white/45"> · {collapsedCvLabel}</span>
            ) : null}
          </span>
          <ChevronDown className={filtersCollapsed ? 'h-4 w-4 shrink-0 -rotate-90' : 'h-4 w-4 shrink-0'} />
        </button>
        {!filtersCollapsed ? (
          <div className="mt-2">
            <JobBoardFilters
              filters={appliedFilters}
              locationInput={locationInput}
              locationInputRef={locationInputRef}
              onLocationInputChange={setLocationInput}
              locationDisabled={appliedFilters.remoteFirst}
              locationDisabledTitle="Searching globally for remote roles"
              qInput={qInput}
              onQInputChange={setQInput}
              onImmediateFilterChange={patchImmediateFilter}
              remoteFirst={appliedFilters.remoteFirst}
              onRemoteFirstChange={setRemoteFirst}
              profiles={profiles}
              selectedProfileId={selectedProfileId}
              onProfileChange={(id) => {
                setSelectedProfileId(id);
                setAppliedFilters((prev) => ({ ...prev, page: 1 }));
              }}
              onApplySearch={applySearch}
              isFetching={jobs.isFetching}
              onResetFilters={resetNonLocationFilters}
            />
          </div>
        ) : null}
      </div>

      <JobBoardAlertsBar alerts={boardAlerts} />

      <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0C0F0F] max-lg:min-h-[min(78dvh,640px)] lg:h-[calc(100dvh-12rem)] lg:max-h-[calc(100dvh-12rem)] lg:flex-row lg:items-stretch">
        <div
          data-tour="job-board-listings"
          className="flex min-h-[280px] w-full min-w-0 shrink-0 flex-col overflow-hidden border-b border-white/[0.06] max-lg:flex-1 max-lg:min-h-0 lg:min-h-0 lg:w-[min(52%,520px)] lg:max-w-[520px] lg:border-b-0 lg:border-r lg:border-white/[0.06]"
        >
          <div className="shrink-0 space-y-2 px-3 pt-3">
            {false && !dismissedFreshnessBanner && freshness && (freshness.newSinceLastVisitCount > 0 || freshness.updatedSinceLastVisitCount > 0) ? (
              <div className="mb-2 flex items-start gap-2 rounded-xl border border-[#00C9B1]/25 bg-[#00C9B1]/10 px-3 py-2.5 text-sm text-white/90">
                <p className="min-w-0 flex-1 leading-snug">
                  {freshness.newSinceLastVisitCount > 0
                    ? `${freshness.newSinceLastVisitCount} new jobs since your last visit`
                    : `${freshness.updatedSinceLastVisitCount} jobs updated since your last visit`}
                </p>
                <button
                  type="button"
                  onClick={() => setDismissedFreshnessBanner(true)}
                  className="shrink-0 rounded-md p-1 text-white/50 transition hover:bg-white/10 hover:text-white/80"
                  aria-label="Dismiss"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : null}
            {false && !dismissedSearchContextBanner && searchContextBanner && !appliedFilters.remoteFirst ? (
              <div className="flex items-start gap-2 rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2.5 text-sm text-white/85">
                <p className="min-w-0 flex-1 leading-snug">{searchContextBanner}</p>
                <button
                  type="button"
                  onClick={() => {
                    setFiltersCollapsed(false);
                    window.setTimeout(() => locationInputRef.current?.focus(), 80);
                  }}
                  className="shrink-0 rounded-md border border-[#00C9B1]/35 bg-[#00C9B1]/10 px-2 py-1 text-xs font-semibold text-[#7ef4e6] hover:bg-[#00C9B1]/15"
                >
                  Change
                </button>
                <button
                  type="button"
                  onClick={() => setDismissedSearchContextBanner(true)}
                  className="shrink-0 rounded-md p-1 text-white/50 transition hover:bg-white/10 hover:text-white/80"
                  aria-label="Dismiss"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : null}
            {false && !dismissedRemoteFirstBanner && remoteFirstResponse ? (
              <div className="flex items-start gap-2 rounded-xl border border-[#00C9B1]/25 bg-[#00C9B1]/10 px-3 py-2.5 text-sm text-white/90">
                <p className="min-w-0 flex-1 leading-snug">Showing international remote roles - apply from anywhere</p>
                <button
                  type="button"
                  onClick={() => setDismissedRemoteFirstBanner(true)}
                  className="shrink-0 rounded-md p-1 text-white/50 transition hover:bg-white/10 hover:text-white/80"
                  aria-label="Dismiss"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : null}
            {false && !dismissedLocationFallbackBanner && locationFallback ? (
              <div className="flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-500/[0.08] px-3 py-2.5 text-sm text-amber-100/95">
                <p className="min-w-0 flex-1 leading-snug">No jobs found in {locationLabel}. Showing remote roles instead.</p>
                <button
                  type="button"
                  onClick={() => setDismissedLocationFallbackBanner(true)}
                  className="shrink-0 rounded-md p-1 text-amber-200/60 transition hover:bg-amber-500/15 hover:text-amber-100"
                  aria-label="Dismiss"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : null}
            {!appliedFilters.remoteFirst && !hasLocationContext ? (
              <div className="rounded-xl border border-white/12 bg-white/[0.03] px-3 py-2.5 text-sm text-white/85">
                <p className="leading-snug">Set your location to get stronger local matches.</p>
                <div className="mt-2">
                  <button
                    type="button"
                    className="rounded-lg border border-[#00C9B1]/35 bg-[#00C9B1]/10 px-2.5 py-1 text-xs font-semibold text-[#7ef4e6] hover:bg-[#00C9B1]/15"
                    onClick={() => {
                      setFiltersCollapsed(false);
                      toast.info('Add your location in Search & Filters, then click Search.');
                    }}
                  >
                    Set location
                  </button>
                </div>
              </div>
            ) : null}
            {false && shouldShowLowQualityBanner ? (
              <div className="rounded-xl border border-amber-400/25 bg-amber-500/[0.08] px-3 py-2.5 text-sm text-amber-100/95">
                <p className="leading-snug">Results are currently low quality. Try one of these:</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {qualityState!.suggestedActions.slice(0, 3).map((a) => (
                    <button
                      key={`${a.type}:${a.route}`}
                      type="button"
                      className="rounded-lg border border-amber-300/35 bg-amber-400/10 px-2 py-1 text-xs font-semibold text-amber-100 hover:bg-amber-400/15"
                      onClick={() => handleSuggestedAction(a)}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {items.length > 0 ? (
              <div className="flex items-center justify-between gap-2 px-0.5 pb-1">
                <p className="text-[11px] text-white/40">
                  Ranked by fit{hiddenLowMatchCount > 0 && hideLowMatch ? ` · ${hiddenLowMatchCount} low-match hidden` : ''}
                </p>
                <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] text-white/55">
                  <input
                    type="checkbox"
                    checked={hideLowMatch}
                    onChange={(e) => setHideLowMatch(e.target.checked)}
                    className="rounded border-white/20"
                  />
                  Hide low match
                </label>
              </div>
            ) : null}
          </div>
          <div
            className="relative app-scrollbar min-h-0 flex-1 flex-col divide-y divide-white/[0.05] overflow-y-auto overscroll-contain p-3 pb-24 pr-2 pt-0 lg:pb-3"
            aria-busy={showListRefetchOverlay}
          >
            {showListRefetchOverlay ? (
              <div
                className="pointer-events-none absolute inset-0 z-[1] flex items-start justify-center bg-[#0C0F0F]/60 pt-10"
                aria-hidden
              >
                <Loader2 className="h-9 w-9 animate-spin text-[#00C9B1]" />
              </div>
            ) : null}
            {showJobListSkeleton ? (
              <>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/[0.04]" />
                ))}
              </>
            ) : jobs.isError ? (
              <div className="rounded-2xl border border-rose-400/20 bg-rose-500/[0.08] p-4">
                <p className="text-sm font-semibold text-rose-200">Could not load job listings.</p>
                <Button type="button" className="mt-3" onClick={() => jobs.refetch()}>
                  Retry
                </Button>
              </div>
            ) : displayItems.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center">
                <Search className="mx-auto h-10 w-10 text-[#00C9B1]" />
                <p className="mt-2 text-sm font-semibold text-white">
                  {userCommittedSearch
                    ? `Nothing matched your search for “${appliedFilters.q.trim()}”. Try different keywords or clear the search and click Search again.`
                    : hideLowMatch && items.length > 0
                      ? 'Only low-match roles are visible with current filters. Show low-match jobs to see them.'
                      : appliedFilters.remoteFirst
                        ? 'No remote roles found matching your CV right now.'
                        : 'No jobs found for these filters.'}
                </p>
                {hideLowMatch && items.length > 0 ? (
                  <Button
                    type="button"
                    className="mt-3"
                    onClick={() => setHideLowMatch(false)}
                  >
                    Show low-match jobs
                  </Button>
                ) : null}
                {qualityState?.suggestedActions?.length ? (
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {qualityState.suggestedActions.slice(0, 3).map((a) => (
                      <Button
                        key={`${a.type}:${a.route}`}
                        type="button"
                        variant="ghost"
                        className="border border-white/15 text-xs"
                        onClick={() => handleSuggestedAction(a)}
                      >
                        {a.label}
                      </Button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              displayItems.map((job) => (
                <JobListingCard
                  key={job.id}
                  job={job}
                  active={job.id === activeJobId}
                  onPrefetch={prefetchListing}
                  onClick={() => {
                    setActiveJobId(job.id);
                    if (isMaxLg) setMobileDetailOpen(true);
                  }}
                />
              ))
            )}
          </div>

          {showPagination ? (
            <div className="flex shrink-0 flex-col gap-2 border-t border-white/5 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-center text-[11px] text-white/45 sm:text-left">
                {rangeStart}-{rangeEnd} of {total}
                {totalPages > 1 ? (
                  <span className="text-white/35"> · Page {appliedFilters.page} of {totalPages}</span>
                ) : null}
              </p>
              <div className="flex items-center justify-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="border border-white/10 px-2"
                  disabled={appliedFilters.page <= 1 || jobs.isFetching}
                  onClick={() => setAppliedFilters((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="border border-white/10 px-2"
                  disabled={appliedFilters.page >= totalPages || jobs.isFetching}
                  onClick={() => setAppliedFilters((prev) => ({ ...prev, page: Math.min(totalPages, prev.page + 1) }))}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <div
          data-tour="job-board-detail"
          className="hidden min-h-[280px] min-w-0 flex-1 flex-col overflow-hidden lg:flex lg:min-h-0"
        >
          {activeJobId ? (
            <div className="app-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
              <JobDetailPanel jobId={activeJobId} cvProfileId={cvProfileIdForDiscover} />
            </div>
          ) : (
            <div className="flex min-h-[280px] flex-col items-center justify-center p-6 text-center lg:min-h-0 lg:flex-1">
              <Search className="h-10 w-10 text-[#00C9B1]" />
              <p className="mt-3 text-sm font-semibold text-white">Select a job to see details</p>
              <p className="mt-1 text-xs text-white/50">Choose any listing from the left panel.</p>
            </div>
          )}
        </div>
      </div>

      {isMaxLg ? (
        <AnimatePresence initial={false}>
          {mobileDetailOpen && activeJobId ? (
            <>
              <motion.div
                key="job-board-detail-backdrop"
                role="presentation"
                aria-hidden
                className="fixed inset-0 z-[45] bg-black/50"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22 }}
                onClick={() => setMobileDetailOpen(false)}
              />
              <motion.div
                key={activeJobId}
                role="dialog"
                aria-modal
                aria-label="Job details"
                className="fixed inset-x-0 bottom-0 z-[50] flex h-[min(92dvh,780px)] max-h-[min(92dvh,780px)] min-h-0 flex-col overflow-hidden rounded-t-[1.25rem] border border-[#00C9B1]/50 bg-[#060a0a] pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-6px_28px_-12px_rgba(0,201,177,0.45)]"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ duration: 0.44, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.06] px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setMobileDetailOpen(false)}
                    className="inline-flex min-h-[44px] items-center gap-1.5 text-[13px] font-semibold text-[#00C9B1] transition-colors duration-150 hover:brightness-125"
                  >
                    <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
                    Back to list
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileDetailOpen(false)}
                    className="rounded-lg border border-white/12 p-2 text-white/45 transition-colors hover:border-[#00C9B1]/40 hover:bg-[#00C9B1]/15 hover:text-[#00C9B1]"
                    aria-label="Close job details"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="app-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y [webkit-overflow-scrolling:touch] px-3 pb-24 pt-1 lg:pb-4">
                  <JobDetailPanel jobId={activeJobId} cvProfileId={cvProfileIdForDiscover} />
                </div>
              </motion.div>
            </>
          ) : null}
        </AnimatePresence>
      ) : null}
    </div>
  );
}
