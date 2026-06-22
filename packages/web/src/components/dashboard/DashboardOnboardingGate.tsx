'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useOnboardingStatus } from '@/hooks/useOnboarding';
import { useAuthStore } from '@/store/useAuthStore';

/** Sends users who skipped onboarding back to `/onboarding` (e.g. stale cookie + middleware). */
export function DashboardOnboardingGate() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const { data: status, isSuccess } = useOnboardingStatus();

  useEffect(() => {
    if (!accessToken) return;
    if (user?.onboardingCompleted === true) return;
    if (user?.onboardingCompleted === false) {
      router.replace('/onboarding');
      return;
    }
    if (isSuccess && status && !status.completed) {
      router.replace('/onboarding');
    }
  }, [accessToken, isSuccess, router, status, user?.onboardingCompleted]);

  return null;
}
