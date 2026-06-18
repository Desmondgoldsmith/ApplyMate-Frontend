export type ScoreImprovementBand = 'low' | 'medium' | 'high';
export type ScoreImprovementAxis = 'skills' | 'experience' | 'role_level' | 'evidence';

export type ScoreImprovementItem = {
  id: string;
  title: string;
  detail: string;
  axis: ScoreImprovementAxis;
};

export type ScoreImprovementGuide = {
  currentScore: number;
  scoreBeforeTailoring: number | null;
  scoreDelta: number | null;
  scoreBand: ScoreImprovementBand;
  headline: string;
  ceilingHint: string;
  interviewReminder?: string;
  items: ScoreImprovementItem[];
};

export const SCORE_BAND_LABELS: Record<ScoreImprovementBand, string> = {
  low: 'Stretch fit',
  medium: 'Viable with gaps',
  high: 'Strong on paper',
};

const BANDS = new Set<ScoreImprovementBand>(['low', 'medium', 'high']);
const AXES = new Set<ScoreImprovementAxis>(['skills', 'experience', 'role_level', 'evidence']);

function parseBand(raw: unknown): ScoreImprovementBand {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  return BANDS.has(s as ScoreImprovementBand) ? (s as ScoreImprovementBand) : 'medium';
}

function parseAxis(raw: unknown): ScoreImprovementAxis {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (AXES.has(s as ScoreImprovementAxis)) return s as ScoreImprovementAxis;
  if (s === 'role level' || s === 'rolelevel') return 'role_level';
  return 'experience';
}

function parseOptionalScore(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? parseFloat(raw) : Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function parseItem(row: unknown, index: number): ScoreImprovementItem | null {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
  const o = row as Record<string, unknown>;
  const title =
    (typeof o.title === 'string' && o.title.trim()) ||
    (typeof o.label === 'string' && o.label.trim()) ||
    '';
  const detail =
    (typeof o.detail === 'string' && o.detail.trim()) ||
    (typeof o.description === 'string' && o.description.trim()) ||
    '';
  if (!title || !detail) return null;

  const id =
    (typeof o.id === 'string' && o.id.trim()) ||
    (typeof o.slug === 'string' && o.slug.trim()) ||
    `score-improvement-${index}`;

  return {
    id,
    title: stripScoreImprovementCopy(title),
    detail: stripScoreImprovementCopy(detail),
    axis: parseAxis(o.axis),
  };
}

function stripScoreImprovementCopy(text: string): string {
  return text
    .replace(/\bJD\b/g, 'job description')
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Parse `scoreImprovement` from GET /jobs/:id or tailor payloads (post-tailor only). */
export function parseScoreImprovementGuide(raw: unknown): ScoreImprovementGuide | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;

  const itemsRaw = o.items ?? o.suggestions ?? o.steps;
  if (!Array.isArray(itemsRaw)) return undefined;

  const items: ScoreImprovementItem[] = [];
  for (let i = 0; i < itemsRaw.length && items.length < 5; i++) {
    const item = parseItem(itemsRaw[i], i);
    if (item) items.push(item);
  }
  if (items.length === 0) return undefined;

  const headline = stripScoreImprovementCopy(
    (typeof o.headline === 'string' && o.headline.trim()) ||
      (typeof o.summary === 'string' && o.summary.trim()) ||
      '',
  );
  const ceilingHint = stripScoreImprovementCopy(
    (typeof o.ceilingHint === 'string' && o.ceilingHint.trim()) ||
      (typeof o.ceiling_hint === 'string' && o.ceiling_hint.trim()) ||
      '',
  );
  const interviewReminderRaw =
    (typeof o.interviewReminder === 'string' && o.interviewReminder.trim()) ||
    (typeof o.interview_reminder === 'string' && o.interview_reminder.trim()) ||
    '';
  const interviewReminder = interviewReminderRaw
    ? stripScoreImprovementCopy(interviewReminderRaw)
    : undefined;

  if (!headline || !ceilingHint) return undefined;

  const currentScore =
    parseOptionalScore(o.currentScore ?? o.current_score) ??
    parseOptionalScore(o.matchScore ?? o.match_score) ??
    0;

  return {
    currentScore,
    scoreBeforeTailoring: parseOptionalScore(
      o.scoreBeforeTailoring ?? o.score_before_tailoring,
    ),
    scoreDelta: parseOptionalScore(o.scoreDelta ?? o.score_delta),
    scoreBand: parseBand(o.scoreBand ?? o.score_band),
    headline,
    ceilingHint,
    ...(interviewReminder ? { interviewReminder } : {}),
    items,
  };
}

export function shouldShowScoreImprovementGuide(
  guide: ScoreImprovementGuide | null | undefined,
): guide is ScoreImprovementGuide {
  return Boolean(guide && guide.items.length > 0 && guide.headline.trim());
}

const SENIORITY_TOKEN_LABELS: Record<string, string> = {
  entry: 'entry-level',
  junior: 'junior',
  mid: 'mid-level',
  middle: 'mid-level',
  senior: 'senior',
  staff: 'staff',
  principal: 'principal',
  lead: 'lead',
  executive: 'executive',
  director: 'director',
};

/** Human-readable seniority — never show bare enum tokens like "mid". */
export function formatSeniorityLabel(raw: string): string {
  const t = raw.trim().toLowerCase().replace(/_/g, ' ').replace(/\s+level$/, '').trim();
  if (!t) return raw.trim();
  return SENIORITY_TOKEN_LABELS[t] ?? (t.includes('level') ? t : `${t}-level`);
}

/**
 * Soften backend copy that leaks enum tokens ("reads as mid").
 * Prefer backend fixes in `build-score-improvement-guide.ts` — see docs.
 */
export function humanizeScoreImprovementDetail(detail: string): string {
  let out = stripScoreImprovementCopy(detail);
  if (!out) return out;

  out = out.replace(
    /\bframed as\s+([\w-]+)(?:\s+level)?\b/gi,
    (_, token: string) => `targets ${formatSeniorityLabel(token)} experience`,
  );
  out = out.replace(
    /\breads as\s+([\w-]+)\b/gi,
    (_, token: string) => `reads as ${formatSeniorityLabel(token)} on your CV`,
  );
  out = out.replace(
    /\b(job|role)\s+is\s+([\w-]+)\s+level\b/gi,
    (_, noun: string, token: string) => `${noun} targets ${formatSeniorityLabel(token)} experience`,
  );
  out = out.replace(/\bmid level\b/gi, 'mid-level');
  out = out.replace(/\bmid-level level\b/gi, 'mid-level');

  if (/targets mid-level experience.*reads as mid-level on your cv/i.test(out)) {
    out = out.replace(
      /targets mid-level experience;\s*your cv reads as mid-level on your cv\.?/i,
      'You and the role are both mid-level on paper. The gap is more about years, scope, or must-have depth, not title alone.',
    );
  }

  return out;
}

export function scoreImprovementAxisLabel(axis: ScoreImprovementAxis): string {
  switch (axis) {
    case 'experience':
      return 'Needs experience';
    case 'role_level':
      return 'Outside your CV';
    case 'evidence':
      return 'Outside your CV';
    default:
      return 'Outside your CV';
  }
}
