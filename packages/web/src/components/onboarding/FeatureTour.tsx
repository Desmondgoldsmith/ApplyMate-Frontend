'use client';

import confetti from 'canvas-confetti';
import {
  driver,
  type Config,
  type DriveStep,
  type PopoverDOM,
} from 'driver.js';
import 'driver.js/dist/driver.css';
import { useQueryClient } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

import {
  matchTourId,
  resolveStepSelector,
  resolveStepSide,
  stepsForTour,
  tourMeta,
  tourStorageKey,
  type TourId,
  type TourStepDef,
} from '@/components/onboarding/featureTourDefinitions';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';

import './onboarding-tour.css';

const LEGACY_DASHBOARD_KEY = 'applymate:tour:completed';

function markTourCompleteLocal(storageKey: string): void {
  try {
    localStorage.setItem(storageKey, 'true');
  } catch {
    /* ignore */
  }
}

function readTourCompleteLocal(storageKey: string): boolean {
  try {
    return localStorage.getItem(storageKey) === 'true';
  } catch {
    return false;
  }
}

function dashboardTourFinished(
  user:
    | { id?: string; uiPrefs?: { tourCompleted?: boolean } | null }
    | null
    | undefined,
  storageKey: string,
): boolean {
  const legacyKey = user?.id
    ? `${LEGACY_DASHBOARD_KEY}:${user.id}`
    : LEGACY_DASHBOARD_KEY;
  return (
    user?.uiPrefs?.tourCompleted === true ||
    readTourCompleteLocal(storageKey) ||
    readTourCompleteLocal(legacyKey)
  );
}

function collectSteps(defs: TourStepDef[], narrow: boolean): DriveStep[] {
  const steps: DriveStep[] = [];
  for (const row of defs) {
    const selector = resolveStepSelector(row, narrow);
    const el = document.querySelector(selector);
    if (!el) continue;
    steps.push({
      element: selector,
      popover: {
        title: row.title,
        description: row.description,
        side: resolveStepSide(el, row, narrow),
        align: row.align ?? 'center',
        showButtons: ['next'],
        popoverOffset: row.popoverOffset ?? 16,
      } as DriveStep['popover'],
      onHighlightStarted: (element) => {
        if (row.beforeHighlight) {
          row.beforeHighlight();
          window.setTimeout(() => {
            element?.scrollIntoView({
              block: 'center',
              inline: 'nearest',
              behavior: 'smooth',
            });
          }, 150);
          return;
        }
        element?.scrollIntoView({
          block: 'center',
          inline: 'nearest',
          behavior: 'smooth',
        });
      },
    });
  }
  return steps;
}

function firstStepReady(tourId: TourId, narrow: boolean): boolean {
  const defs = stepsForTour(tourId, narrow);
  if (defs.length === 0) return false;
  const first = defs[0]!;
  return Boolean(document.querySelector(resolveStepSelector(first, narrow)));
}

export function FeatureTour() {
  const pathname = usePathname();
  const analytics = useAnalytics();
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);
  const { data: user } = useCurrentUser();
  const tourId = matchTourId(pathname);
  const storageKey = tourId ? tourStorageKey(tourId, user?.id) : '';
  const driverRef = useRef<ReturnType<typeof driver> | null>(null);
  const celebrateRef = useRef(false);
  const tourCompletionSyncedRef = useRef(false);
  const persistTourCompletionRef = useRef<() => void>(() => {});
  const activeTourRef = useRef<TourId | null>(null);

  useEffect(() => {
    persistTourCompletionRef.current = () => {
      if (!storageKey) return;
      markTourCompleteLocal(storageKey);
      if (tourId === 'dashboard') {
        markTourCompleteLocal(
          user?.id
            ? `${LEGACY_DASHBOARD_KEY}:${user.id}`
            : LEGACY_DASHBOARD_KEY,
        );
      }
      if (tourId !== 'dashboard') return;
      void (async () => {
        if (tourCompletionSyncedRef.current) return;
        tourCompletionSyncedRef.current = true;
        try {
          await api.users.updateMe({ tourCompleted: true });
          await queryClient.invalidateQueries({
            queryKey: ['me', accessToken ?? ''],
          });
        } catch {
          tourCompletionSyncedRef.current = false;
        }
      })();
    };
  }, [accessToken, queryClient, storageKey, tourId, user?.id]);

  useEffect(() => {
    if (
      user?.uiPrefs?.tourCompleted === true &&
      tourId === 'dashboard' &&
      storageKey
    ) {
      markTourCompleteLocal(storageKey);
    }
  }, [user?.uiPrefs?.tourCompleted, storageKey, tourId]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!storageKey || e.key !== storageKey || e.newValue !== 'true') return;
      driverRef.current?.destroy();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [storageKey]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const d = driverRef.current;
      if (!d?.isActive()) return;
      e.preventDefault();
      celebrateRef.current = false;
      d.destroy();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const d = driverRef.current;
    if (!d?.isActive()) return;
    if (matchTourId(pathname) === activeTourRef.current) return;
    celebrateRef.current = false;
    d.destroy();
  }, [pathname]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!user?.id) return;
    if (!tourId || !storageKey) return;

    const finished =
      tourId === 'dashboard'
        ? dashboardTourFinished(user, storageKey)
        : readTourCompleteLocal(storageKey);
    if (finished) return;

    if (tourId === 'dashboard') {
      if (analytics.isLoading) return;
      if ((analytics.data?.jobsAnalyzed ?? 0) > 0) return;
    }

    if (driverRef.current?.isActive()) return;

    let cancelled = false;
    const meta = tourMeta(tourId);

    const attachPopoverChrome =
      (totalSteps: number, id: TourId) =>
      (popover: PopoverDOM, opts: { driver: ReturnType<typeof driver> }) => {
        const wrap = popover.wrapper;
        wrap.classList.add('applymate-tour-popover');
        wrap.dataset.applymateTour = id;

        const activeIdx = (opts.driver.getActiveIndex() ?? 0) + 1;
        const pct = Math.round((activeIdx / Math.max(1, totalSteps)) * 100);

        let metaEl = wrap.querySelector('[data-applymate-tour-meta]');
        if (!metaEl) {
          metaEl = document.createElement('div');
          metaEl.setAttribute('data-applymate-tour-meta', '');
          metaEl.className = 'applymate-tour-meta';
          wrap.insertBefore(metaEl, wrap.firstChild);
        }
        metaEl.innerHTML = `
          <p class="applymate-tour-kicker">${meta.label} tour</p>
          <p class="applymate-tour-progress-label">Step ${activeIdx} of ${totalSteps}</p>
          <div class="applymate-tour-progress-track" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
            <div class="applymate-tour-progress-fill" style="width:${pct}%"></div>
          </div>
        `;

        let skip = wrap.querySelector<HTMLButtonElement>(
          '[data-applymate-tour-skip-btn]',
        );
        if (!skip) {
          skip = document.createElement('button');
          skip.type = 'button';
          skip.setAttribute('data-applymate-tour-skip-btn', 'true');
          skip.className = 'applymate-tour-skip';
          skip.textContent = 'Skip tour';
          skip.addEventListener('click', () => {
            celebrateRef.current = false;
            opts.driver.destroy();
          });
          wrap.appendChild(skip);
        }
      };

    const launch = (steps: DriveStep[]) => {
      if (steps.length === 0) return;
      const lastIdx = steps.length - 1;
      const withButtons = steps.map((s, i) => ({
        ...s,
        popover: {
          ...s.popover,
          nextBtnText: i === lastIdx ? "Got it — let's go" : 'Next',
          onNextClick: (
            _el: Element | undefined,
            _step: DriveStep,
            {
              driver: drv,
            }: { driver: { isLastStep: () => boolean; moveNext: () => void } },
          ) => {
            if (drv.isLastStep()) celebrateRef.current = meta.celebrate;
            drv.moveNext();
          },
        },
      }));

      const cfg: Config = {
        animate: true,
        overlayOpacity: 0.72,
        overlayColor: '#050808',
        stagePadding: 8,
        stageRadius: 12,
        allowClose: false,
        smoothScroll: false,
        allowKeyboardControl: true,
        disableActiveInteraction: false,
        popoverClass: 'applymate-tour-popover',
        showButtons: ['next'],
        showProgress: false,
        steps: withButtons,
        onPopoverRender: attachPopoverChrome(withButtons.length, tourId),
        onDestroyed: () => {
          driverRef.current = null;
          activeTourRef.current = null;
          persistTourCompletionRef.current();
          if (celebrateRef.current) {
            celebrateRef.current = false;
            void confetti({
              particleCount: 72,
              spread: 64,
              origin: { y: 0.58 },
              colors: ['#00C9B1', '#ffffff', '#00A896'],
            });
          }
        },
      };

      const drv = driver(cfg);
      driverRef.current = drv;
      activeTourRef.current = tourId;
      drv.drive();
    };

    const scheduleStart = () => {
      const narrow = window.matchMedia('(max-width: 767px)').matches;
      const defs = stepsForTour(tourId, narrow);
      let steps = collectSteps(defs, narrow);
      if (steps.length > 0 && firstStepReady(tourId, narrow)) {
        launch(steps);
        return;
      }
      window.setTimeout(() => {
        if (cancelled) return;
        steps = collectSteps(defs, narrow);
        if (steps.length > 0) launch(steps);
      }, 600);
    };

    const timer = window.setTimeout(
      () => {
        if (cancelled) return;
        scheduleStart();
      },
      tourId === 'dashboard' ? 800 : 500,
    );

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    user?.id,
    user?.uiPrefs?.tourCompleted,
    storageKey,
    tourId,
    pathname,
    analytics.isLoading,
    analytics.data?.jobsAnalyzed,
  ]);

  return null;
}

/** @deprecated Use FeatureTour — kept for existing imports */
export const OnboardingTour = FeatureTour;
