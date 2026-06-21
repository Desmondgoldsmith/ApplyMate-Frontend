'use client';

import { queryKeys } from '@/lib/queryKeys';
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
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  closeMobileNavForTour,
  matchTourId,
  MOBILE_JOBS_REVEAL_MS,
  MOBILE_NAV_REVEAL_MS,
  resolveStepSelector,
  resolveStepSide,
  stepsForTour,
  tourIdToPageApiKey,
  tourMeta,
  type TourId,
  type TourStepDef,
} from '@/components/onboarding/featureTourDefinitions';
import {
  applyTourSpotlight,
  clearTourSpotlight,
  isDriverDummyElement,
  resolveTourHighlightTarget,
  waitForTourTarget,
} from '@/components/onboarding/tourSpotlight';
import {
  isGlobalTourFinished,
  markGlobalTourCompleted,
  markGlobalTourSkipped,
  markPageTourCompleted,
  markPageTourSkipped,
  shouldShowDashboardTour,
  shouldShowPageTour,
  TOUR_COMPLETED_KEY,
  TOUR_SKIPPED_KEY,
} from '@/components/onboarding/featureTourStorage';
import {
  applyMobileTourPopoverPosition,
  clearTourPopoverInlinePosition,
} from '@/components/onboarding/tourPopoverLayout';
import {
  bindTourScrollPrevent,
  lockTourScroll,
  unlockTourScroll,
} from '@/components/onboarding/tourScrollLock';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';

import './onboarding-tour.css';

const TOUR_START_DELAY_MS = 1200;
const TOUR_DOM_RETRY_MS = 500;
const TOUR_DOM_MAX_ATTEMPTS = 16;

function isNarrowViewport(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(max-width: 767px)').matches
  );
}

function scrollTourTargetIntoView(element: Element | null | undefined): void {
  if (!element) return;
  const inHeader = Boolean(element.closest('header'));
  element.scrollIntoView({
    block: inHeader ? 'nearest' : 'center',
    inline: 'nearest',
    behavior: 'auto',
  });
}

function refreshDriverLayout(drv: ReturnType<typeof driver> | null): void {
  if (!drv?.isActive()) return;
  drv.refresh();
  window.requestAnimationFrame(() => drv.refresh());
}

function stepSelector(step: DriveStep | undefined): string {
  const el = step?.element;
  return typeof el === 'string' ? el : '';
}

function repositionMobileTourPopover(
  element: Element | null | undefined,
  wrap?: HTMLElement | null,
): void {
  const pop =
    wrap ?? document.getElementById('driver-popover-content');
  if (!(pop instanceof HTMLElement)) return;
  const placement = applyMobileTourPopoverPosition(pop, element);
  pop.classList.toggle('applymate-tour-popover--above', placement === 'above');
  pop.classList.toggle('applymate-tour-popover--below', placement === 'below');
}

/** driver.js positions the popover after onPopoverRender — override on the next frames. */
function scheduleMobileTourLayout(
  getDriver: () => ReturnType<typeof driver> | null,
  wrap?: HTMLElement | null,
): void {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      const drv = getDriver();
      if (!drv?.isActive()) return;
      const step = drv.getActiveStep();
      const selector = stepSelector(step);
      const target = resolveTourHighlightTarget(
        drv.getActiveElement(),
        selector,
      );
      if (target) applyTourSpotlight(target, selector);
      repositionMobileTourPopover(target, wrap);
    });
  });
}

function collectSteps(
  defs: TourStepDef[],
  narrow: boolean,
  onStepHighlight: () => void,
  getDriver: () => ReturnType<typeof driver> | null,
): DriveStep[] {
  const steps: DriveStep[] = [];
  for (const row of defs) {
    const selector = resolveStepSelector(row, narrow);
    const el = document.querySelector(selector);
    if (!el && !row.revealOnHighlight) continue;

    let rebindDepth = 0;

    const settleStep = async (element: Element | undefined) => {
      const drv = getDriver();
      if (!drv?.isActive()) return;

      if (row.revealOnHighlight) {
        await waitForTourTarget(
          selector,
          narrow ? MOBILE_NAV_REVEAL_MS + MOBILE_JOBS_REVEAL_MS + 320 : 520,
        );
        const idx = drv.getActiveIndex();
        if (idx !== undefined) {
          rebindDepth += 1;
          drv.moveTo(idx);
          rebindDepth -= 1;
        }
        if (narrow) scheduleMobileTourLayout(getDriver);
        return;
      }

      const target = resolveTourHighlightTarget(
        element,
        selector,
      ) ??
        (document.querySelector(selector) as HTMLElement | null);

      if (!target || isDriverDummyElement(target)) return;

      scrollTourTargetIntoView(target);
      applyTourSpotlight(target, selector);
      if (narrow) {
        scheduleMobileTourLayout(getDriver);
      } else {
        refreshDriverLayout(drv);
        window.requestAnimationFrame(() => refreshDriverLayout(drv));
      }
    };

    steps.push({
      element: selector,
      popover: {
        title: row.title,
        description: row.description,
        side: el ? resolveStepSide(el, row, narrow) : row.side,
        align: row.align ?? 'center',
        showButtons: ['next'],
        popoverOffset: row.popoverOffset ?? 12,
      } as DriveStep['popover'],
      onHighlightStarted: (element) => {
        onStepHighlight();
        if (rebindDepth > 0) {
          const target = resolveTourHighlightTarget(element, selector);
          if (target) {
            scrollTourTargetIntoView(target);
            applyTourSpotlight(target, selector);
            if (narrow) scheduleMobileTourLayout(getDriver);
          }
          if (!narrow) refreshDriverLayout(getDriver());
          return;
        }
        if (row.beforeHighlight) {
          row.beforeHighlight();
          const delay = row.revealOnHighlight
            ? narrow
              ? MOBILE_NAV_REVEAL_MS + MOBILE_JOBS_REVEAL_MS
              : 280
            : 180;
          window.setTimeout(() => {
            void settleStep(element);
          }, delay);
          return;
        }
        void settleStep(element);
      },
      onDeselected: () => {
        clearTourSpotlight();
      },
    });
  }
  return steps;
}

function countReadyTourTargets(defs: TourStepDef[], narrow: boolean): number {
  let n = 0;
  for (const row of defs) {
    const selector = resolveStepSelector(row, narrow);
    if (document.querySelector(selector)) n += 1;
  }
  return n;
}

export function FeatureTour() {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);
  const storeUser = useAuthStore((s) => s.user);
  const { data: meUser } = useCurrentUser();
  const user = useMemo(() => {
    if (!meUser && !storeUser) return null;
    const id = meUser?.id?.trim() || storeUser?.id?.trim() || '';
    if (!id) return null;
    return {
      ...(storeUser ?? {}),
      ...(meUser ?? {}),
      id,
      onboardingCompleted:
        meUser?.onboardingCompleted === true ||
        storeUser?.onboardingCompleted === true,
      uiPrefs: meUser?.uiPrefs ?? storeUser?.uiPrefs ?? null,
    };
  }, [meUser, storeUser]);
  const driverRef = useRef<ReturnType<typeof driver> | null>(null);
  const celebrateRef = useRef(false);
  const tourCompletionSyncedRef = useRef(false);
  const unbindScrollPreventRef = useRef<(() => void) | null>(null);
  const tourRestartNonceRef = useRef(0);
  const [tourRestartNonce, setTourRestartNonce] = useState(0);
  const activeTourRef = useRef<TourId | null>(null);
  const tourId = matchTourId(pathname);

  useEffect(() => {
    if (user?.uiPrefs?.tourCompleted !== true) return;
    if (tourRestartNonceRef.current > 0) return;
    markGlobalTourCompleted(user.id);
  }, [user?.uiPrefs?.tourCompleted, user?.id]);

  useEffect(() => {
    const onRestart = () => {
      tourRestartNonceRef.current += 1;
      setTourRestartNonce((n) => n + 1);
    };
    window.addEventListener('applymate:tour-restart', onRestart);
    return () => window.removeEventListener('applymate:tour-restart', onRestart);
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (
        (e.key === TOUR_COMPLETED_KEY || e.key === TOUR_SKIPPED_KEY) &&
        e.newValue === 'true'
      ) {
        driverRef.current?.destroy();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const d = driverRef.current;
      if (!d?.isActive()) return;
      e.preventDefault();
      celebrateRef.current = false;
      const id = activeTourRef.current;
      if (id === 'dashboard') markGlobalTourSkipped();
      else if (id) markPageTourSkipped(id, user?.id);
      d.destroy();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [user?.id]);

  useEffect(() => {
    const d = driverRef.current;
    if (!d?.isActive()) return;
    if (matchTourId(pathname) === activeTourRef.current) return;
    celebrateRef.current = false;
    d.destroy();
  }, [pathname]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isNarrowViewport()) return;
    if (!user?.id || !tourId) return;
    if (user.onboardingCompleted !== true) return;

    const restarted = tourRestartNonceRef.current > 0;
    const showGlobalDashboard =
      tourId === 'dashboard' &&
      shouldShowDashboardTour(user) &&
      (restarted || !isGlobalTourFinished(user));
    const showPage =
      tourId !== 'dashboard' &&
      shouldShowPageTour(tourId, user.id, user.uiPrefs ?? null);

    if (!showGlobalDashboard && !showPage) return;
    if (driverRef.current?.isActive()) return;

    let cancelled = false;
    const meta = tourMeta(tourId);

    const endTourChrome = () => {
      unlockTourScroll();
      unbindScrollPreventRef.current?.();
      unbindScrollPreventRef.current = null;
    };

    const beginTourChrome = () => {
      lockTourScroll();
      if (!unbindScrollPreventRef.current) {
        unbindScrollPreventRef.current = bindTourScrollPrevent(() =>
          Boolean(driverRef.current?.isActive()),
        );
      }
    };

    const syncTourPageCompletedApi = (id: TourId) => {
      void (async () => {
        const pageKey = tourIdToPageApiKey(id);
        try {
          await api.users.updateMe({
            uiPrefs: { tourPagesCompleted: { [pageKey]: true } },
          });
          await queryClient.invalidateQueries({
            queryKey: queryKeys.auth.me(accessToken ?? ''),
          });
        } catch {
          /* local flags still prevent immediate re-show */
        }
      })();
    };

    const syncTourCompletedApi = () => {
      syncTourPageCompletedApi('dashboard');
      void (async () => {
        if (tourCompletionSyncedRef.current) return;
        tourCompletionSyncedRef.current = true;
        try {
          await api.users.updateMe({ tourCompleted: true });
          await queryClient.invalidateQueries({
            queryKey: queryKeys.auth.me(accessToken ?? ''),
          });
        } catch {
          tourCompletionSyncedRef.current = false;
        }
      })();
    };

    const attachPopoverChrome =
      (totalSteps: number, id: TourId) =>
      (popover: PopoverDOM, opts: { driver: ReturnType<typeof driver> }) => {
        const wrap = popover.wrapper;
        const narrow = isNarrowViewport();

        wrap.classList.add('applymate-tour-popover');
        wrap.classList.toggle('applymate-tour-popover--mobile', narrow);
        wrap.dataset.applymateTour = id;

        if (narrow) {
          scheduleMobileTourLayout(() => opts.driver, wrap);
        } else {
          clearTourPopoverInlinePosition(wrap);
          wrap.classList.remove(
            'applymate-tour-popover--above',
            'applymate-tour-popover--below',
          );
          refreshDriverLayout(opts.driver);
        }

        const activeIdx = (opts.driver.getActiveIndex() ?? 0) + 1;
        const pct = Math.round((activeIdx / Math.max(1, totalSteps)) * 100);
        wrap.style.setProperty('--progress', `${pct}%`);
        wrap.classList.toggle('first-step', activeIdx === 1);
        wrap.classList.toggle('final-step', activeIdx === totalSteps);

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
            if (id === 'dashboard') {
              markGlobalTourSkipped();
              syncTourCompletedApi();
            } else {
              markPageTourSkipped(id, user?.id);
              syncTourPageCompletedApi(id);
            }
            if (isNarrowViewport()) closeMobileNavForTour();
            opts.driver.destroy();
          });
          wrap.appendChild(skip);
        }
      };

    const launch = (steps: DriveStep[], id: TourId) => {
      if (steps.length === 0) return;
      activeTourRef.current = id;
      const lastIdx = steps.length - 1;
      const celebrateOnFinish = meta.celebrate;
      const withButtons = steps.map((s, i) => ({
        ...s,
        popover: {
          ...s.popover,
          nextBtnText:
            i === lastIdx ? "Got it — let's go! 🚀" : 'Next →',
          onNextClick: (
            _el: Element | undefined,
            _step: DriveStep,
            {
              driver: drv,
            }: { driver: { isLastStep: () => boolean; moveNext: () => void } },
          ) => {
            if (drv.isLastStep()) {
              celebrateRef.current = celebrateOnFinish;
              if (id === 'dashboard') {
                markGlobalTourCompleted(user!.id);
                syncTourCompletedApi();
              } else {
                markPageTourCompleted(id, user!.id);
                syncTourPageCompletedApi(id);
              }
            }
            drv.moveNext();
          },
        },
      }));

      const cfg: Config = {
        animate: true,
        overlayOpacity: 0.78,
        overlayColor: '#050808',
        stagePadding: 24,
        stageRadius: 14,
        allowClose: false,
        smoothScroll: true,
        allowKeyboardControl: true,
        disableActiveInteraction: true,
        popoverClass: 'applymate-tour-popover',
        showButtons: ['next'],
        showProgress: false,
        steps: withButtons,
        onPopoverRender: attachPopoverChrome(withButtons.length, id),
        onHighlighted: (element, step) => {
          beginTourChrome();
          const selector = stepSelector(step);
          const target = resolveTourHighlightTarget(element, selector);
          if (target) applyTourSpotlight(target, selector);
          if (isNarrowViewport()) {
            scheduleMobileTourLayout(() => driverRef.current);
          } else {
            refreshDriverLayout(driverRef.current);
          }
        },
        onDestroyed: () => {
          clearTourSpotlight();
          activeTourRef.current = null;
          tourRestartNonceRef.current = 0;
          endTourChrome();
          unlockTourScroll();
          document.body.style.removeProperty('overflow');
          const main = document.querySelector(
            'main.dashboard-app-canvas-bg',
          ) as HTMLElement | null;
          main?.style.removeProperty('overflow');
          driverRef.current = null;
          if (isNarrowViewport()) closeMobileNavForTour();
          if (celebrateRef.current) {
            celebrateRef.current = false;
            void confetti({
              particleCount: 90,
              spread: 75,
              origin: { y: 0.55 },
              colors: ['#00C9B1', '#ffffff', '#00A896', 'rgba(0,201,177,0.6)'],
              ticks: 200,
              gravity: 1.1,
            });
          }
        },
      };

      const drv = driver(cfg);
      driverRef.current = drv;
      drv.drive();
    };

    const tryLaunchTour = (attempt = 0) => {
      if (cancelled) return;
      if (!user?.id || !tourId) return;

      const restartedNow = tourRestartNonceRef.current > 0;
      const showGlobalDashboard =
        tourId === 'dashboard' &&
        shouldShowDashboardTour(user) &&
        (restartedNow || !isGlobalTourFinished(user));
      const showPage =
        tourId !== 'dashboard' && shouldShowPageTour(tourId, user.id);
      if (!showGlobalDashboard && !showPage) return;

      const narrow = isNarrowViewport();
      const defs = stepsForTour(tourId, narrow);
      const minSteps = tourId === 'dashboard' ? (narrow ? 3 : 2) : 1;
      const steps = collectSteps(defs, narrow, beginTourChrome, () =>
        driverRef.current,
      );

      if (steps.length >= minSteps) {
        launch(steps, tourId);
        return;
      }

      const readyTargets = countReadyTourTargets(defs, narrow);
      if (readyTargets === 0 && attempt >= TOUR_DOM_MAX_ATTEMPTS) return;

      if (attempt < TOUR_DOM_MAX_ATTEMPTS) {
        window.setTimeout(() => tryLaunchTour(attempt + 1), TOUR_DOM_RETRY_MS);
      }
    };

    const timer = window.setTimeout(() => {
      if (cancelled) return;
      tryLaunchTour(0);
    }, TOUR_START_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (driverRef.current?.isActive()) {
        celebrateRef.current = false;
        driverRef.current.destroy();
      }
      endTourChrome();
    };
  }, [
    accessToken,
    tourId,
    tourRestartNonce,
    user?.id,
    user?.onboardingCompleted,
  ]);

  return null;
}

/** @deprecated Use FeatureTour — kept for existing imports */
export const OnboardingTour = FeatureTour;
