import { gapLabelsFromScore, strengthLabelsFromScore } from '@/shared/job-session';
import type { CvScoreResult } from '@/shared/types';

/** Plain-language summary for the analyze panel (not server jargon). */
export function humanScoreSummary(score: CvScoreResult): string {
  const hint = score.analysisDetailHint?.trim();
  if (hint && !/gaps below come from the server/i.test(hint)) {
    return hint;
  }

  if (score.isTailored && score.tailorSummary?.trim()) {
    return score.tailorSummary.trim();
  }

  const recommendation = score.recommendation?.trim();
  if (recommendation && recommendation.length > 20) {
    return recommendation;
  }

  const strengths = strengthLabelsFromScore(score, 2);
  const gaps = gapLabelsFromScore(score, 2);
  const match = Math.round(score.matchScore);

  if (match >= 75) {
    if (strengths.length >= 2) {
      return `Your CV aligns well with this role — you clearly bring ${strengths[0]} and ${strengths[1]}.`;
    }
    if (strengths.length === 1) {
      return `Strong fit. Your background in ${strengths[0]} matches what they're looking for.`;
    }
    return 'Your CV is a strong match for this role — most key requirements are covered.';
  }

  if (match >= 60) {
    if (gaps.length > 0) {
      return `Good overlap overall. Highlighting ${gaps[0]} more clearly could strengthen your application.`;
    }
    return 'A solid match — your experience covers most of what this role needs.';
  }

  if (match >= 40) {
    if (gaps.length >= 2) {
      return `Partial fit. ${gaps[0]} and ${gaps[1]} aren't clearly shown on your CV yet — worth addressing before you apply.`;
    }
    if (gaps.length === 1) {
      return `Some gaps to close — ${gaps[0]} isn't clearly covered in your CV. Consider tailoring or upskilling.`;
    }
    return 'Moderate match. Tailoring your CV for this role could improve your chances.';
  }

  if (gaps.length >= 2) {
    return `This role expects more than your CV shows today — ${gaps[0]} and ${gaps[1]} are the main gaps.`;
  }
  if (gaps.length === 1) {
    return `Lower overlap for this role. ${gaps[0]} is a key gap to address before applying.`;
  }
  return 'Review the gaps below — tailoring your CV or building targeted experience may help.';
}
