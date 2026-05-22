import { scoreFromProgressTrendPoint } from '@/lib/interviewDisplayScore';
import type { ProgressTrendPoint } from '@/lib/interview-prep-types';

export type InterviewChartPoint = {
  sessionId: string;
  score: number;
  capturedAt: string;
  dateLabel: string;
  isCurrent?: boolean;
};

export function formatInterviewChartDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function sortTrendPoints(points: ProgressTrendPoint[]): ProgressTrendPoint[] {
  return [...points].sort(
    (a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime(),
  );
}

export function toInterviewChartPoints(
  points: ProgressTrendPoint[],
  options?: {
    currentSessionId?: string;
  },
): InterviewChartPoint[] {
  return sortTrendPoints(points)
    .map((p) => {
      const score = scoreFromProgressTrendPoint(p);
      if (score == null) return null;
      return {
        sessionId: p.sessionId,
        score,
        capturedAt: p.capturedAt,
        dateLabel: formatInterviewChartDate(p.capturedAt),
        isCurrent: options?.currentSessionId ? p.sessionId === options.currentSessionId : false,
      };
    })
    .filter((p): p is InterviewChartPoint => p != null);
}
