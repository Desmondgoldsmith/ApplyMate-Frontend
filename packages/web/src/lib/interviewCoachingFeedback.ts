import {
  resolveAnsweredQuestionContext,
  resolveAnsweredQuestionText,
} from '@/lib/interviewPrepNavigation';
import { displayImprovedAnswer } from '@/lib/interviewCoachingSnapshot';
import { normalizeSuggestedFollowUps } from '@/lib/interviewPrepSuggestedFollowUps';
import type {
  CoachingFeedback,
  CoachingIntensity,
  CoachingStarBreakdown,
  CoachingSnapshot,
  PracticeCoachingResponse,
  SuggestedFollowUp,
  TurnAnswerResponse,
} from '@/lib/interview-prep-types';

export { resolveAnsweredQuestionContext, resolveAnsweredQuestionText };

const GENERIC_FOLLOW_UP_PATTERNS = [
  /can you say that again/i,
  /two clear sentences/i,
  /expand on that\?$/i,
];

export function isGenericFollowUpPlaceholder(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  return GENERIC_FOLLOW_UP_PATTERNS.some((re) => re.test(t));
}

/** Never use static copy as the follow-up question — backend/snapshot only. */
export function resolveFollowUpQuestion(
  selectedFollowUpQuestion: string | null | undefined,
  backendFollowUpQuestion: string | null | undefined,
  snapshotQuestions?: string[],
): string | null {
  const candidates = [
    selectedFollowUpQuestion?.trim(),
    backendFollowUpQuestion?.trim(),
    ...(snapshotQuestions ?? []).map((q) => q.trim()),
  ].filter(Boolean) as string[];

  for (const q of candidates) {
    if (!isGenericFollowUpPlaceholder(q)) return q;
  }
  return null;
}

/** Turn-shaped response for practice-coaching — same coaching panel layout as main turns. */
export function turnAnswerResponseFromPractice(
  practice: PracticeCoachingResponse,
  questionText: string,
  answerText?: string,
): TurnAnswerResponse {
  const q = questionText.trim();
  const a = answerText?.trim() ?? '';
  const feedback = {
    ...practice.coachingFeedback,
    questionText: practice.coachingFeedback.questionText?.trim() || q,
  };
  return {
    turn: {
      id: 'practice',
      questionId: 'practice',
      order: 0,
      depth: 0,
      category: 'practice',
      questionText: q,
      answerText: a,
      status: 'answered',
      turnKind: 'follow_up',
      label: 'Side question (practice)',
    },
    scores: {
      clarityScore: practice.coachingFeedback.clarityScore,
      structureScore: practice.coachingFeedback.structureScore,
      relevanceScore: practice.coachingFeedback.relevanceScore,
    },
    starFeedback: { missingParts: [], suggestionText: '' },
    followUp: null,
    answeredQuestion: {
      turnId: 'practice',
      questionId: 'practice',
      questionText: q,
      scoredAnswerText: a,
      turnKind: 'follow_up',
      label: 'Side question (practice)',
    },
    coachingFeedback: feedback,
    coachingSnapshot: practice.coachingSnapshot,
  };
}

export function coachingFeedbackFromResponse(
  response: TurnAnswerResponse | null | undefined,
): CoachingFeedback | null {
  if (!response?.coachingFeedback) return null;
  return response.coachingFeedback;
}

export type FollowUpCoachingItem = {
  question: string;
  reason: string;
  practiceOnly: boolean;
  parentQuestionText?: string;
  contextLabel?: string;
};

export function followUpItemsFromCoaching(
  suggestedFollowUps: SuggestedFollowUp[] | string[] | undefined,
  answeredQuestionText: string,
  options?: {
    excludeTexts?: string[];
    answeredSideQuestions?: string[];
    selectedFollowUpQuestion?: string | null;
  },
): FollowUpCoachingItem[] {
  const normalized = normalizeSuggestedFollowUps(suggestedFollowUps);
  const currentNorm = answeredQuestionText.trim().toLowerCase();
  const excludeNorms = new Set(
    [
      ...(options?.excludeTexts ?? []),
      ...(options?.answeredSideQuestions ?? []),
    ]
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean),
  );
  const items: FollowUpCoachingItem[] = [];

  const push = (raw: string) => {
    const question = raw.trim();
    if (!question || isGenericFollowUpPlaceholder(question)) return;
    const qNorm = question.toLowerCase();
    if (qNorm === currentNorm) return;
    if (excludeNorms.has(qNorm)) return;
    if (items.some((i) => i.question.toLowerCase() === qNorm)) return;
    const chip = normalized.find(
      (c) => c.questionText.trim().toLowerCase() === qNorm,
    );
    items.push({
      question,
      reason: chip?.contextLabel || 'A natural follow-up on what you shared.',
      practiceOnly: chip?.practiceOnly ?? true,
      parentQuestionText: chip?.parentQuestionText,
      contextLabel: chip?.contextLabel,
    });
  };

  for (const chip of normalized) push(chip.questionText);

  return items.slice(0, 3);
}

function normalizeBulletKey(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Merge coaching bullet lists without repeating the same line. */
export function dedupeCoachingBullets(...lists: Array<string[] | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const raw of list ?? []) {
      const text = raw?.trim();
      if (!text) continue;
      const key = normalizeBulletKey(text);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(text);
    }
  }
  return out;
}

/** Actionable tips first; keyIssues only when not already in improvements. */
export function splitCoachingFeedbackBullets(
  improvements: string[] | undefined,
  keyIssues: string[] | undefined,
): { improvements: string[]; keyIssues: string[] } {
  const tips = dedupeCoachingBullets(improvements);
  const tipKeys = new Set(tips.map(normalizeBulletKey));
  const issues = dedupeCoachingBullets(keyIssues).filter(
    (issue) => !tipKeys.has(normalizeBulletKey(issue)),
  );
  return { improvements: tips, keyIssues: issues };
}

const INVALID_EXAMPLE_PATTERNS = [/\[add:/i, /nothing better/i];

const STAR_PART_KEYS = ['situation', 'task', 'action', 'result'] as const;
export type StarPartKey = (typeof STAR_PART_KEYS)[number];

export const STAR_MISSING_LABEL = 'Not stated in your answer';

export type StarBreakdownPart = {
  key: StarPartKey;
  text: string;
  isMissing: boolean;
};

export function isRenderableExampleAnswer(text: string | null | undefined): boolean {
  const t = text?.trim();
  if (!t || t.length < 40) return false;
  return !INVALID_EXAMPLE_PATTERNS.some((re) => re.test(t));
}

export function resolveExampleAnswer(
  feedback: CoachingFeedback | null,
  snapshot: CoachingSnapshot | null,
  answeredQuestionText?: string,
): string | null {
  const fromFeedback = feedback?.exampleAnswer?.trim();
  if (fromFeedback && isRenderableExampleAnswer(fromFeedback)) return fromFeedback;
  if (snapshot) {
    const fromSnapshot = displayImprovedAnswer(snapshot, answeredQuestionText);
    if (isRenderableExampleAnswer(fromSnapshot)) return fromSnapshot;
  }
  return null;
}

export function starBreakdownIsTriplicate(
  star: CoachingStarBreakdown | null | undefined,
): boolean {
  if (!star) return false;
  const values = STAR_PART_KEYS.map((k) => star[k]?.trim()).filter(Boolean) as string[];
  if (values.length < 2) return false;
  const first = normalizeBulletKey(values[0]!);
  return values.every((v) => normalizeBulletKey(v) === first);
}

/** STAR parts for UI — null when hidden; empty hint mode handled by caller. */
export function buildStarBreakdownParts(
  star: CoachingStarBreakdown | null | undefined,
): StarBreakdownPart[] | null {
  if (!star || starBreakdownIsTriplicate(star)) return null;

  const parts: StarBreakdownPart[] = [];
  for (const key of STAR_PART_KEYS) {
    const text = star[key]?.trim();
    if (text) {
      parts.push({ key, text, isMissing: false });
    } else if (key === 'task' || key === 'result') {
      parts.push({ key, text: STAR_MISSING_LABEL, isMissing: true });
    }
  }
  return parts.length > 0 ? parts : null;
}

export function assertCoachingResponseQuality(
  response: TurnAnswerResponse | null | undefined,
): void {
  if (process.env.NODE_ENV === 'production') return;
  if (!response?.coachingFeedback) return;

  const example = response.coachingFeedback.exampleAnswer?.trim();
  if (example && example.length <= 80) {
    console.warn('[interview-coaching] exampleAnswer shorter than expected', example.length);
  }

  const star = response.coachingFeedback.starBreakdown;
  if (star && starBreakdownIsTriplicate(star)) {
    console.warn('[interview-coaching] STAR breakdown appears triplicate', star);
  }
}

export function focusAreaLabel(focusArea: string): string {
  const key = focusArea.trim().toLowerCase();
  const labels: Record<string, string> = {
    structure: 'Structure',
    clarity: 'Clarity',
    depth: 'Depth',
    relevance: 'Relevance',
    star: 'STAR format',
  };
  return labels[key] ?? (focusArea.trim() || 'Your answer');
}

export type CoachingPanelView = {
  summary: string;
  scores: { clarity: number; structure: number; depth: number; relevance: number };
  focusArea: string;
  focusLabel: string;
  improvements: string[];
  keyIssues: string[];
  interviewerInsight: string;
  starBreakdown: CoachingFeedback['starBreakdown'];
  starParts: StarBreakdownPart[] | null;
  starShowHintOnly: boolean;
  exampleAnswer: string | null;
  showScores: boolean;
  showStar: boolean;
  showExample: boolean;
  showFollowUps: boolean;
  showInterviewerInsight: boolean;
};

export function buildCoachingPanelView(
  feedback: CoachingFeedback | null,
  snapshot: CoachingSnapshot | null,
  intensity: CoachingIntensity,
  interviewerContext?: string,
  answeredQuestionText?: string,
): CoachingPanelView | null {
  if (feedback) {
    const bullets = splitCoachingFeedbackBullets(
      feedback.improvements,
      feedback.keyIssues,
    );
    const view: CoachingPanelView = {
      summary: feedback.summary?.trim() || snapshot?.coachingSummary?.trim() || '',
      scores: {
        clarity: feedback.clarityScore,
        structure: feedback.structureScore,
        depth: feedback.depthScore,
        relevance: feedback.relevanceScore,
      },
      focusArea: feedback.focusArea,
      focusLabel: focusAreaLabel(feedback.focusArea),
      improvements: bullets.improvements,
      keyIssues: bullets.keyIssues,
      interviewerInsight: interviewerContext?.trim() || '',
      starBreakdown: feedback.starBreakdown ?? null,
      starParts: buildStarBreakdownParts(feedback.starBreakdown),
      starShowHintOnly: starBreakdownIsTriplicate(feedback.starBreakdown),
      exampleAnswer: resolveExampleAnswer(feedback, snapshot, answeredQuestionText),
      showScores: intensity !== 'light',
      showStar: Boolean(
        buildStarBreakdownParts(feedback.starBreakdown)?.length ||
          starBreakdownIsTriplicate(feedback.starBreakdown),
      ),
      showExample: Boolean(resolveExampleAnswer(feedback, snapshot, answeredQuestionText)),
      showFollowUps: intensity === 'intensive',
      showInterviewerInsight: Boolean(interviewerContext?.trim()),
    };
    if (intensity === 'light') {
      view.improvements = view.improvements.slice(0, 1);
      view.keyIssues = [];
    }
    if (intensity === 'standard') {
      view.showFollowUps = false;
    }
    return view;
  }

  if (!snapshot) return null;

  const snapshotBullets = dedupeCoachingBullets(
    snapshot.weaknesses.length ? snapshot.weaknesses : snapshot.strengths,
  );
  const view: CoachingPanelView = {
    summary: snapshot.coachingSummary?.trim() ?? '',
    scores: { ...snapshot.score },
    focusArea: snapshot.weaknesses[0] ?? 'structure',
    focusLabel: focusAreaLabel(snapshot.weaknesses[0] ?? 'structure'),
    improvements: snapshotBullets,
    keyIssues: [],
    interviewerInsight: snapshot.nextHint?.trim() ?? '',
    starBreakdown: null,
    starParts: null,
    starShowHintOnly: false,
    exampleAnswer: resolveExampleAnswer(null, snapshot, undefined),
    showScores: intensity !== 'light',
    showStar: false,
    showExample: Boolean(resolveExampleAnswer(null, snapshot, undefined)),
    showFollowUps: intensity === 'intensive',
    showInterviewerInsight: intensity !== 'light',
  };
  if (intensity === 'light') {
    view.improvements = view.improvements.slice(0, 1);
  }
  return view;
}

export function isWeakScore(score: number): boolean {
  return score < 40;
}
