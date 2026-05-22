import type { InterviewResult } from '@/lib/api';

export type InterviewEvaluationStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed';

export type InterviewEvaluationPollState =
  | {
      status: 'pending';
      evaluationStatus: 'queued' | 'processing';
      estimatedWaitSeconds?: number;
    }
  | { status: 'completed'; result: InterviewResult }
  | {
      status: 'failed';
      message: string;
      failureReason?: string;
    };

function asRecord(raw: unknown): Record<string, unknown> | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

function isInterviewResultShape(o: Record<string, unknown>): boolean {
  return typeof o.overallScore === 'number' && Array.isArray(o.questionScores);
}

/** Parse GET /interviews/:id/result (200 / 202 / 404 failed). */
export function parseInterviewResultPoll(
  httpStatus: number,
  raw: unknown,
): InterviewEvaluationPollState {
  const o = asRecord(raw);
  if (!o) {
    if (httpStatus === 202) {
      return { status: 'pending', evaluationStatus: 'queued' };
    }
    return { status: 'pending', evaluationStatus: 'processing' };
  }

  const evaluationStatus = o.evaluationStatus as InterviewEvaluationStatus | undefined;

  if (httpStatus === 404 || evaluationStatus === 'failed') {
    return {
      status: 'failed',
      message: String(o.message ?? 'Interview scoring failed. You can retry from this session.'),
      failureReason:
        typeof o.failureReason === 'string' ? o.failureReason : undefined,
    };
  }

  if (httpStatus === 202 || evaluationStatus === 'queued' || evaluationStatus === 'processing') {
    return {
      status: 'pending',
      evaluationStatus:
        evaluationStatus === 'processing' ? 'processing' : 'queued',
      estimatedWaitSeconds:
        typeof o.estimatedWaitSeconds === 'number'
          ? o.estimatedWaitSeconds
          : undefined,
    };
  }

  const nested = asRecord(o.result);
  if (nested && isInterviewResultShape(nested)) {
    return { status: 'completed', result: nested as unknown as InterviewResult };
  }

  if (evaluationStatus === 'completed' && nested) {
    return { status: 'completed', result: nested as unknown as InterviewResult };
  }

  if (isInterviewResultShape(o)) {
    return { status: 'completed', result: o as unknown as InterviewResult };
  }

  return { status: 'pending', evaluationStatus: 'processing' };
}

export function interviewResultFromPoll(
  poll: InterviewEvaluationPollState | null | undefined,
): InterviewResult | null {
  if (!poll || poll.status !== 'completed') return null;
  return poll.result;
}
