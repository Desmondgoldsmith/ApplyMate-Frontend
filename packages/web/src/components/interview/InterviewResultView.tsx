'use client';

import { ArrowLeft, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';

import { InterviewAvatar } from '@/components/interview/InterviewAvatar';
import { GrowthReport } from '@/components/interview/GrowthReport';
import { RealityScorePanel } from '@/components/interview/RealityScorePanel';
import { InterviewGrowthProfile } from '@/components/interview/InterviewGrowthProfile';
import { InterviewResultPrepSections } from '@/components/interview/results/InterviewResultPrepSections';
import { SessionProgressFeedback } from '@/components/interview/SessionProgressFeedback';
import {
  useInterviewPersonaMemory,
} from '@/hooks/useInterviewPersonaMemory';
import { isSimulationMode } from '@/lib/interview-prep-types';
import { Button } from '@/components/ui/Button';
import { normalizeInterviewPersonalityId, PERSONALITIES } from '@/lib/interviewPersonalities';
import type { InterviewResult, InterviewSession, QuestionScore } from '@/lib/api';
import { scoreFromInterviewResult, scoreFromInterviewSession } from '@/lib/interviewDisplayScore';
import { cn } from '@/lib/utils';

function scoreTone(score: number) {
  if (score >= 75) return { label: 'Interview ready', className: 'text-emerald-300' };
  if (score >= 50) return { label: 'Good progress', className: 'text-amber-200' };
  return { label: 'Keep practicing', className: 'text-sky-300' };
}

function metricLabel(key: keyof InterviewResult['scoreBreakdown']) {
  if (key === 'roleAlignment') return 'Role Alignment';
  return key.charAt(0).toUpperCase() + key.slice(1);
}

const QUESTION_SCORE_KEYS: Array<keyof QuestionScore['scores']> = [
  'relevance',
  'clarity',
  'depth',
  'confidence',
  'roleAlignment',
];

type QuestionScoreWithSection = QuestionScore & {
  sectionTitle?: string;
};

function QuestionScoreMetricBars({ scores, motionIndexOffset = 0 }: { scores: QuestionScore['scores']; motionIndexOffset?: number }) {
  return (
    <div className="space-y-2.5">
      {QUESTION_SCORE_KEYS.map((k, i) => {
        const value = Math.max(0, Math.min(100, Math.round(scores[k])));
        return (
          <div key={k} className="grid grid-cols-[minmax(0,96px)_1fr_40px] items-center gap-2 sm:grid-cols-[110px_1fr_44px]">
            <span className="truncate text-[11px] text-white/55">{metricLabel(k as keyof InterviewResult['scoreBreakdown'])}</span>
            <div className="h-2 min-w-0 overflow-hidden rounded-full bg-white/10">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${value}%` }}
                transition={{ duration: 0.45, delay: (motionIndexOffset + i) * 0.05 }}
                className="h-full rounded-full bg-gradient-to-r from-[#00C9B1] to-[#00C9B1]"
              />
            </div>
            <span className="text-right text-[11px] font-semibold tabular-nums text-white/80">{value}</span>
          </div>
        );
      })}
    </div>
  );
}

function PerQuestionReviewCard({ q, motionOffset }: { q: QuestionScoreWithSection; motionOffset: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 sm:p-4">
      <p className="text-sm font-semibold leading-snug text-white">{q.question}</p>
      <p className="mt-2 max-h-28 overflow-y-auto text-xs leading-relaxed text-white/65">{q.answer}</p>
      <div className="mt-3 rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Scores</p>
        <QuestionScoreMetricBars scores={q.scores} motionIndexOffset={motionOffset} />
      </div>
      <p className="mt-3 text-xs leading-relaxed text-emerald-200/95">
        <span className="font-semibold text-emerald-300/90">Strength</span> — {q.strength}
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-amber-200/95">
        <span className="font-semibold text-amber-300/90">Improve</span> — {q.improvement}
      </p>
      {q.betterAnswer ? (
        <div className="mt-3 rounded-lg border border-[#00C9B1]/25 bg-[#00C9B1]/8 p-3 text-xs leading-relaxed text-white/85">
          <p className="font-semibold text-[#00C9B1]">A stronger answer might look like</p>
          <p className="mt-1.5 text-white/75">{q.betterAnswer}</p>
        </div>
      ) : null}
    </div>
  );
}

export function InterviewResultView({
  result,
  session,
  onBackToInterviewList,
  onPracticeAgain,
  onDone,
}: {
  result: InterviewResult;
  session: InterviewSession;
  onBackToInterviewList: () => void;
  onPracticeAgain: () => void;
  onDone: () => void;
}) {
  const [openReview, setOpenReview] = useState(false);
  const personalityId = normalizeInterviewPersonalityId(session.personality);
  const cfg = PERSONALITIES[personalityId];
  const displayScore =
    scoreFromInterviewResult(result) ??
    scoreFromInterviewSession(session) ??
    Math.round(result.overallScore);
  const tone = scoreTone(displayScore);
  const score = displayScore;
  const scoreRing = `conic-gradient(rgba(0,212,212,0.9) ${score * 3.6}deg, rgba(255,255,255,0.14) 0deg)`;

  const breakdownRows = useMemo(
    () =>
      (Object.keys(result.scoreBreakdown) as Array<keyof InterviewResult['scoreBreakdown']>).map((key) => ({
        key,
        label: metricLabel(key),
        value: Math.max(0, Math.min(100, Math.round(result.scoreBreakdown[key]))),
      })),
    [result.scoreBreakdown],
  );

  const hasSectionTitlesInBreakdown = useMemo(
    () =>
      result.questionScores.some(
        (qs) => typeof (qs as QuestionScoreWithSection).sectionTitle === 'string' && (qs as QuestionScoreWithSection).sectionTitle!.trim().length > 0,
      ),
    [result.questionScores],
  );

  const personaMemory = useInterviewPersonaMemory({
    sessionId: session.id,
    session,
    enabled: Boolean(session.id),
  });

  const groupedBySection = useMemo(() => {
    const groups: Record<string, QuestionScoreWithSection[]> = {};
    result.questionScores.forEach((raw) => {
      const qs = raw as QuestionScoreWithSection;
      const section = (qs.sectionTitle?.trim() || 'General') as string;
      if (!groups[section]) groups[section] = [];
      groups[section]!.push(qs);
    });
    return Object.entries(groups).map(([sectionTitle, questions]) => ({
      sectionTitle,
      questions,
    }));
  }, [result.questionScores]);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBackToInterviewList}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-white/80 transition hover:border-white/20 hover:bg-white/[0.04] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
          <span>Interview history</span>
        </button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0C0F0F] p-5">
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-44 w-44 rounded-full p-2" style={{ background: scoreRing }}>
            <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-[#081010]">
              <p className="text-5xl font-black text-white">{score}</p>
              <p className="text-xs text-white/60">Overall Score</p>
            </div>
          </div>
          <p className={cn('text-lg font-semibold', tone.className)}>{tone.label}</p>
          {result.readyForInterview ? (
            <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
              Ready for interview
            </span>
          ) : null}
        </div>
      </div>

      <div className={cn('rounded-2xl border border-white/10 p-4 sm:p-5', cfg.color)}>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-5">
          <div className="flex w-full shrink-0 justify-center sm:w-auto sm:justify-start">
            <div className="rounded-2xl border border-white/10 bg-[#0B1010]/80 p-2 shadow-inner">
              <InterviewAvatar personality={personalityId} isSpeaking={false} isListening={false} size="md" />
            </div>
          </div>
          <p className="min-w-0 flex-1 text-center text-sm leading-relaxed text-white/85 sm:text-left">
            {result.encouragementNote}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0C0F0F] p-4">
        <h3 className="text-sm font-semibold text-white">Score breakdown</h3>
        <div className="mt-3 space-y-3">
          {breakdownRows.map((row, i) => (
            <div key={row.key} className="grid grid-cols-[110px_1fr_44px] items-center gap-3">
              <span className="text-xs text-white/60">{row.label}</span>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${row.value}%` }}
                  transition={{ duration: 0.5, delay: i * 0.06 }}
                  className="h-full rounded-full bg-gradient-to-r from-[#00C9B1] to-[#00C9B1]"
                />
              </div>
              <span className="text-xs font-semibold text-white/75">{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      <SessionProgressFeedback result={result} session={session} memory={personaMemory} />

      <InterviewGrowthProfile memory={personaMemory} />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-4">
          <h3 className="text-sm font-semibold text-emerald-200">What you did well ✓</h3>
          <ul className="mt-2 space-y-1 text-sm text-white/80">
            {result.strengths.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-amber-400/20 bg-amber-500/5 p-4">
          <h3 className="text-sm font-semibold text-amber-200">Areas to focus on</h3>
          <ul className="mt-2 space-y-1 text-sm text-white/80">
            {result.improvements.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0C0F0F] p-4">
        <h3 className="text-sm font-semibold text-white">Practice tips</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-white/80">
          {result.suggestions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0C0F0F] p-4">
        <button
          type="button"
          className="flex w-full items-center justify-between text-left"
          onClick={() => setOpenReview((v) => !v)}
        >
          <span className="text-sm font-semibold text-white">Review your answers</span>
          <ChevronDown className={cn('h-4 w-4 text-white/60 transition-transform', openReview && 'rotate-180')} />
        </button>
        {openReview ? (
          <div className="mt-3 space-y-3">
            {hasSectionTitlesInBreakdown
              ? groupedBySection.map(({ sectionTitle, questions }) => (
                  <div key={sectionTitle} className="space-y-3">
                    <h4 className="border-b border-white/5 pb-2 text-xs font-semibold uppercase tracking-wider text-[#00C9B1]/70">
                      {sectionTitle}
                    </h4>
                    {questions.map((q, qi) => (
                      <PerQuestionReviewCard key={q.questionId} q={q} motionOffset={qi * 6} />
                    ))}
                  </div>
                ))
              : result.questionScores.map((q, qi) => (
                  <PerQuestionReviewCard key={q.questionId} q={q as QuestionScoreWithSection} motionOffset={qi * 6} />
                ))}
          </div>
        ) : null}
      </div>

      <InterviewResultPrepSections session={session} result={result} />
      <GrowthReport sessionId={session.id} />
      {isSimulationMode(session.prepMode) ? (
        <RealityScorePanel realityScore={result.realityScore ?? session.realityScore} />
      ) : null}

      <section className="flex flex-wrap gap-2">
        <Button onClick={onPracticeAgain}>Practice Again →</Button>
        <Button variant={result.readyForInterview ? 'primary' : 'ghost'} onClick={onDone}>
          I&apos;m Ready! →
        </Button>
      </section>
    </div>
  );
}
