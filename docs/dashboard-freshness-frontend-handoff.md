# Dashboard freshness — hooks updated; what you should verify

**Subject:** Dashboard freshness — hooks updated; what you should verify

We fixed stale Search at a Glance / today-plan data when navigating back to `/dashboard` without changing tabs.

## Already merged for you

`useTodayPlan`, `useWeeklyStallSummary`, `useAnalytics`, and growth day-plan hooks now use `staleTime: 0`, `refetchOnMount: 'always'`, `refetchOnWindowFocus: 'always'`, `gcTime: 5 * 60_000` so the home dashboard refetches on every visit, not only after 45–60s or on window focus.

## Your checklist

- New mutations / flows that change pipeline, digest, or analytics must still call `invalidateTodayPlanQueries(queryClient)` (and `invalidateGrowthQueries` where relevant) on success so mid-session updates stay correct without waiting for navigation.
- **Optional UX:** use `isFetching` / `isPlaceholderData` on `useTodayPlan` if you want a subtle loading state during background refetch (data may briefly show previous counts then update).
- `useAnalytics` is also used from OnboardingTour — expect one extra refetch when that route mounts; acceptable; if it becomes noisy, split into `useAnalytics({ enabled })` or a dashboard-only variant later.

## Backend

Today-plan inputs hash now includes interview sessions and hub reminders, so server cache aligns with interview prep / CRM-style updates.
