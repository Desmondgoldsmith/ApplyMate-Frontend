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

export function sortTrendPoints(
  points: ProgressTrendPoint[],
): ProgressTrendPoint[] {
  return [...points].sort(
    (a, b) =>
      new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime(),
  );
}

export function toInterviewChartPoints(
  points: ProgressTrendPoint[],
  options?: {
    currentSessionId?: string;
  },
): InterviewChartPoint[] {
  const out: InterviewChartPoint[] = [];
  for (const p of sortTrendPoints(points)) {
    const score = scoreFromProgressTrendPoint(p);
    if (score == null) continue;
    const point: InterviewChartPoint = {
      sessionId: p.sessionId,
      score,
      capturedAt: p.capturedAt,
      dateLabel: formatInterviewChartDate(p.capturedAt),
    };
    if (options?.currentSessionId) {
      point.isCurrent = p.sessionId === options.currentSessionId;
    }
    out.push(point);
  }
  return out;
}
