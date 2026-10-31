'use client';

import { useQueryClient } from '@tanstack/react-query';
import confetti from 'canvas-confetti';
import { useReducedMotion } from 'framer-motion';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';

import {
  computeTourLayout,
  findVisibleTourTarget,
  type TourLayout,
} from '@/components/dashboard/welcome-tour/welcomeTourLayout';
import { pageTourForPath } from '@/components/dashboard/welcome-tour/pageTours';
import { PortalThemeScope } from '@/components/theme/ThemeScope';
import { Button } from '@/components/ui/Button';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';
import { WELCOME_TOUR_START_EVENT } from '@/lib/welcomeEvents';
import { useAuthStore } from '@/store/useAuthStore';

const NO_STEPS: never[] = [];
const START_DELAY_MS = 700;
const TARGET_WAIT_MS = 8000;
const SETTLE_MS = 600;
const TARGET_RETRIES = 3;
const TARGET_RETRY_MS = 250;

/** Mobile keeps its bottom bar hideable; the tour needs it on screen for the nav steps. */
function showMobileNav() {
  window.dispatchEvent(
    new CustomEvent('applymate:tour-set-nav-visible', {
      detail: { visible: true },
    }),
  );
}

function useTourUser() {
  const storeUser = useAuthStore((s) => s.user);
  const { data: me } = useCurrentUser();
  const id = me?.id?.trim() || storeUser?.id?.trim() || '';
  if (!id) return null;
  return {
    id,
    onboardingCompleted:
      me?.onboardingCompleted === true ||
      storeUser?.onboardingCompleted === true,
    uiPrefs: me?.uiPrefs ?? storeUser?.uiPrefs ?? null,
  };
}

/** First-visit guided tour of Home and the CV editor, on desktop and mobile. */
export function WelcomeTour() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);
  const reducedMotion = useReducedMotion();
  const user = useTourUser();
  const tour = pageTourForPath(pathname);
  const onTourPage = tour != null;
  const forcedByUrl = searchParams.get('tour') === '1';
  const openProfileId = searchParams.get('profileId');

  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [layout, setLayout] = useState<TourLayout | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLElement | null>(null);
  const autoStartedRef = useRef(false);
  const startedRef = useRef(false);

  const steps = tour?.steps ?? NO_STEPS;

  const persist = useCallback(
    (outcome: 'completed' | 'skipped') => {
      if (!tour) return;
      tour.markDone(user, outcome);
      void api.users
        .updateMe({
          ...(tour.id === 'dashboard' ? { tourCompleted: true } : {}),
          uiPrefs: { tourPagesCompleted: { [tour.prefKey]: true } },
        })
        .then(() =>
          queryClient.invalidateQueries({
            queryKey: queryKeys.auth.me(accessToken ?? ''),
          }),
        )
        .catch(() => {
          /* the local flag still stops it showing again on this device */
        });
    },
    [accessToken, queryClient, tour, user],
  );

  const finish = useCallback(
    (outcome: 'completed' | 'skipped') => {
      setActive(false);
      setLayout(null);
      persist(outcome);
      if (outcome === 'completed' && !reducedMotion) {
        void confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#b9f542', '#d6ff5e', '#17b26a', '#3ad68a'],
          disableForReducedMotion: true,
        });
      }
    },
    [persist, reducedMotion],
  );

  /**
   * Moves to the next (or previous) step whose target is on screen; ends the tour past the last.
   * Retries briefly first, because mobile nav targets can still be sliding in.
   */
  const go = useCallback(
    (from: number, dir: 1 | -1) => {
      const attempt = (retriesLeft: number) => {
        showMobileNav();
        let i = from;
        while (i >= 0 && i < steps.length) {
          if (findVisibleTourTarget(steps[i]!.target)) {
            setIndex(i);
            return;
          }
          i += dir;
        }
        if (retriesLeft > 0) {
          window.setTimeout(() => attempt(retriesLeft - 1), TARGET_RETRY_MS);
          return;
        }
        if (dir === 1) finish('completed');
      };
      attempt(TARGET_RETRIES);
    },
    [finish, steps],
  );

  const start = useCallback(() => {
    startedRef.current = true;
    setActive(true);
    go(0, 1);
  }, [go]);

  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  });
  const userId = user?.id ?? null;
  const onboardingDone = user?.onboardingCompleted === true;

  // Auto-start once per page for users who haven't seen it, or when asked via ?tour=1.
  useEffect(() => {
    const current = userRef.current;
    if (!tour || autoStartedRef.current || !userId || !onboardingDone) return;
    if (steps.length === 0) return;
    const eligible =
      forcedByUrl || (current != null && tour.shouldAutoStart(current));
    if (!eligible) return;
    autoStartedRef.current = true;

    let cancelled = false;
    const startedAt = Date.now();
    const waitForTargets = () => {
      if (cancelled) return;
      if (findVisibleTourTarget(steps[0]!.target)) {
        window.setTimeout(() => {
          if (cancelled) return;
          if (forcedByUrl) {
            const params = new URLSearchParams(window.location.search);
            params.delete('tour');
            const qs = params.toString();
            router.replace(`${window.location.pathname}${qs ? `?${qs}` : ''}`, {
              scroll: false,
            });
          }
          start();
        }, START_DELAY_MS);
        return;
      }
      if (Date.now() - startedAt < TARGET_WAIT_MS)
        window.setTimeout(waitForTargets, 300);
    };
    waitForTargets();
    return () => {
      cancelled = true;
      // Allow a retry if this run was interrupted before the tour opened.
      if (!startedRef.current) autoStartedRef.current = false;
    };
  }, [forcedByUrl, tour, onboardingDone, router, start, steps, userId]);

  // A new page means a different tour: allow it to auto-start there once.
  useEffect(() => {
    autoStartedRef.current = false;
    startedRef.current = false;
  }, [tour?.id, openProfileId]);

  // Manual start from the Help menu or Settings.
  useEffect(() => {
    const onStart = () => {
      if (pageTourForPath(window.location.pathname)) start();
    };
    window.addEventListener(WELCOME_TOUR_START_EVENT, onStart);
    window.addEventListener('applymate:tour-restart', onStart);
    return () => {
      window.removeEventListener(WELCOME_TOUR_START_EVENT, onStart);
      window.removeEventListener('applymate:tour-restart', onStart);
    };
  }, [start]);

  useEffect(() => {
    if (active && !onTourPage) {
      setActive(false);
      setLayout(null);
    }
  }, [active, onTourPage]);

  const targetIdRef = useRef<string | null>(null);
  const measure = useCallback(() => {
    let el = targetRef.current;
    const dialog = dialogRef.current;
    // After a resize the old target can vanish (e.g. mobile bar -> desktop sidebar): re-find it.
    if (!el || !el.isConnected || el.getClientRects().length === 0) {
      el = targetIdRef.current
        ? findVisibleTourTarget(targetIdRef.current)
        : null;
      targetRef.current = el;
    }
    if (!el) return;
    const r = el.getBoundingClientRect();
    setLayout(
      computeTourLayout(
        { top: r.top, left: r.left, width: r.width, height: r.height },
        { width: window.innerWidth, height: window.innerHeight },
        {
          width: dialog?.offsetWidth ?? 360,
          height: dialog?.offsetHeight ?? 220,
        },
      ),
    );
  }, []);

  // Bring the current target into view, then keep the highlight glued to it.
  useLayoutEffect(() => {
    if (!active) return;
    const step = steps[index];
    targetIdRef.current = step?.target ?? null;
    const el = step ? findVisibleTourTarget(step.target) : null;
    targetRef.current = el;
    if (!el) return;
    el.scrollIntoView({
      block: 'center',
      inline: 'nearest',
      behavior: reducedMotion ? 'auto' : 'smooth',
    });
    measure();
    let frame = 0;
    const until = performance.now() + SETTLE_MS;
    const tick = () => {
      measure();
      if (performance.now() < until) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [active, index, measure, reducedMotion, steps]);

  // Focus the card on each step so screen readers announce it (once it is positioned and visible).
  const positioned = layout != null;
  useEffect(() => {
    if (active && positioned) dialogRef.current?.focus({ preventScroll: true });
  }, [active, index, positioned]);

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      finish('skipped');
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(index + 1, 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(index - 1, -1);
    } else if (e.key === 'Tab') {
      const focusables =
        dialogRef.current?.querySelectorAll<HTMLElement>('button');
      if (!focusables?.length) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  if (!active || typeof document === 'undefined') return null;
  const step = steps[index];
  if (!step) return null;

  const visibleSteps = steps.filter((s) => findVisibleTourTarget(s.target));
  const position = Math.max(
    0,
    visibleSteps.findIndex((s) => s.id === step.id),
  );
  const isLast = position === visibleSteps.length - 1;
  const spot = layout?.spotlight;
  const pop = layout?.popover;

  return createPortal(
    <PortalThemeScope>
      <div className="fixed inset-0 z-[200]" data-lenis-prevent>
        {spot ? (
          <div
            aria-hidden
            className={cn(
              'pointer-events-none fixed rounded-2xl ring-2 ring-accent-solid',
              !reducedMotion &&
                'transition-[top,left,width,height] duration-300 ease-out',
            )}
            style={{
              top: spot.top,
              left: spot.left,
              width: spot.width,
              height: spot.height,
              boxShadow: '0 0 0 9999px var(--ck-bg-overlay)',
            }}
          />
        ) : (
          <div aria-hidden className="fixed inset-0 bg-bg-overlay" />
        )}

        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="welcome-tour-title"
          aria-describedby="welcome-tour-body"
          tabIndex={-1}
          onKeyDown={onKeyDown}
          className={cn(
            'fixed rounded-3xl border border-border-subtle bg-bg-raised p-5 shadow-overlay outline-none',
            pop?.mode === 'sheet'
              ? cn(
                  'inset-x-3',
                  pop.edge === 'bottom'
                    ? 'bottom-[max(0.75rem,env(safe-area-inset-bottom))]'
                    : 'top-[max(0.75rem,env(safe-area-inset-top))]',
                )
              : 'w-[360px]',
            !pop && 'invisible',
          )}
          style={
            pop?.mode === 'floating'
              ? { top: pop.top, left: pop.left }
              : undefined
          }
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] font-semibold text-accent-text">
              Step {position + 1} of {visibleSteps.length}
            </p>
            <div className="flex gap-1" aria-hidden>
              {visibleSteps.map((s, i) => (
                <span
                  key={s.id}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-300',
                    i === position
                      ? 'w-5 bg-accent-solid'
                      : 'w-1.5 bg-border-default',
                  )}
                />
              ))}
            </div>
          </div>
          <h2
            id="welcome-tour-title"
            className="mt-2 font-display text-[20px] font-bold tracking-[-0.02em] text-text-primary"
          >
            {step.title}
          </h2>
          <p
            id="welcome-tour-body"
            className="mt-1.5 text-[15px] leading-relaxed text-text-secondary"
          >
            {step.body}
          </p>
          <div className="mt-5 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => finish('skipped')}
              className="min-h-[44px] rounded-lg px-1 text-[14px] font-medium text-text-secondary hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
            >
              Skip tour
            </button>
            <div className="flex gap-2">
              {position > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 px-4"
                  onClick={() => go(index - 1, -1)}
                >
                  Back
                </Button>
              ) : null}
              <Button
                type="button"
                variant="accent"
                className="h-11 px-5"
                onClick={() => go(index + 1, 1)}
              >
                {isLast ? 'Finish' : 'Next'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </PortalThemeScope>,
    document.body,
  );
}
