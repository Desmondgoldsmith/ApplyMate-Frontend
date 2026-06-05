import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CVScoreCard } from '@/components/cv/CVScoreCard';

vi.mock('@/hooks/useCvScoreSectionActions', () => ({
  useCvScoreSectionActions: () => ({
    fixWithAi: vi.fn(),
    fixMyself: vi.fn(),
  }),
}));

describe('CVScoreCard Phase 1 (ATS + job match)', () => {
  it('renders ATS section title and heuristic disclaimer in info hint only', async () => {
    render(
      <CVScoreCard
        mode="full"
        score={72}
        scorePreview={false}
        breakdown={{
          overall: 72,
          careerStage: 'mid',
          sections: {
            contact: { score: 80, weight: 0.1, feedback: '', flags: [] },
            experience: { score: 70, weight: 0.25, feedback: '', flags: [] },
            education: { score: 75, weight: 0.1, feedback: '', flags: [] },
            skills: { score: 68, weight: 0.2, feedback: '', flags: [] },
            summary: { score: 72, weight: 0.15, feedback: '', flags: [] },
            formatting: { score: 80, weight: 0.1, feedback: '', flags: [] },
          },
          ats: {
            score: 70,
            compatible: true,
            passed: ['Plain section headings'],
            issues: [],
          },
          flags: [],
          strengths: [],
          improvements: [],
        }}
      />,
    );
    expect(screen.getByText(/ATS read \(basic checks\)/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/These ATS-related items are heuristic checks on structure and text in this product/i),
    ).not.toBeInTheDocument();
    const hint = screen.getByRole('button', { name: /about heuristic ATS checks/i });
    expect(hint).toBeInTheDocument();
    fireEvent.pointerEnter(hint.parentElement!);
    expect(
      await screen.findByText(/These ATS-related items are heuristic checks on structure and text in this product/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/ATS-friendly \(basic checks\)/i)).toBeInTheDocument();
  });

  it('shows hybrid blend and rubric-only banner', async () => {
    render(
      <CVScoreCard
        mode="compact"
        score={73}
        hideJobMatch
        scorePayload={{
          score: 73,
          scoringMethod: 'hybrid',
          structuralScore: 62,
          aiScore: 78,
          aiCached: true,
          scoringTransparency: {
            headline: 'Blended CV score',
            methods: {
              hybrid: { title: 'Hybrid', short: 'Structure plus quality review.' },
              rubric_only: {
                title: 'Structure only',
                short: 'Quality review unavailable — structure check only.',
              },
            },
            structural: { title: 'Structure', short: 'Section completeness check.' },
            ai: { title: 'Quality', short: 'AI reads your CV excerpt.' },
            weights: { structuralPercent: 30, aiPercent: 70, short: '30/70.' },
            cache: { title: 'Cache', short: 'Cached for 24 hours.' },
            jobContext: { title: 'Job', short: 'Optional.' },
          },
          aiAssessment: { summary: 'Recruiter-style feedback here.' },
        }}
        breakdown={{
          overall: 73,
          careerStage: 'mid',
          sections: {
            contact: { score: 80, weight: 0.1, feedback: '', flags: [] },
            experience: { score: 70, weight: 0.25, feedback: '', flags: [] },
            education: { score: 75, weight: 0.1, feedback: '', flags: [] },
            skills: { score: 68, weight: 0.2, feedback: '', flags: [] },
            summary: { score: 72, weight: 0.15, feedback: '', flags: [] },
            formatting: { score: 80, weight: 0.1, feedback: '', flags: [] },
          },
          ats: { score: 0, compatible: true, issues: [], passed: [] },
          flags: [],
          strengths: [],
          improvements: [],
        }}
      />,
    );
    expect(screen.getByText(/Blended from two scores/i)).toBeInTheDocument();
    expect(screen.getByText(/30% structure · 70% quality/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /where the blend weights come from/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/^Structure score$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Quality score$/i)).toBeInTheDocument();
    expect(
      screen.getByText(/How we calculated this: 73 ≈ 30% × 62 \+ 70% × 78/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Recruiter-style feedback here/i)).toBeInTheDocument();
    expect(screen.getByText(/Cached quality review/i)).toBeInTheDocument();
    const hint = screen.getByRole('button', { name: /how your resume score is calculated/i });
    fireEvent.pointerEnter(hint.parentElement!);
    expect(await screen.findByText(/Blended CV score/i)).toBeInTheDocument();
  });

  it('does not show rubric-only unavailable banner above the score ring', () => {
    render(
      <CVScoreCard
        mode="compact"
        score={55}
        hideJobMatch
        scorePayload={{
          score: 55,
          scoringMethod: 'rubric_only',
          structuralScore: 55,
          aiScore: null,
          scoringTransparency: {
            headline: 'Structure check only',
            methods: {
              hybrid: { title: 'Hybrid', short: 'Hybrid method.' },
              rubric_only: {
                title: 'Structure only',
                short: 'Quality review unavailable — showing structure check only.',
              },
            },
            structural: { title: 'Structure', short: 'Rubric sections.' },
            ai: { title: 'Quality', short: 'AI off.' },
            weights: { structuralPercent: 100, aiPercent: 0, short: '100% structure.' },
            cache: { title: 'Cache', short: 'N/A.' },
            jobContext: { title: 'Job', short: 'N/A.' },
          },
        }}
        breakdown={{
          overall: 55,
          careerStage: 'early',
          sections: {
            contact: { score: 80, weight: 0.1, feedback: '', flags: [] },
            experience: { score: 50, weight: 0.25, feedback: '', flags: [] },
            education: { score: 75, weight: 0.1, feedback: '', flags: [] },
            skills: { score: 68, weight: 0.2, feedback: '', flags: [] },
            summary: { score: 72, weight: 0.15, feedback: '', flags: [] },
            formatting: { score: 80, weight: 0.1, feedback: '', flags: [] },
          },
          ats: { score: 0, compatible: true, issues: [], passed: [] },
          flags: [],
          strengths: [],
          improvements: [],
        }}
      />,
    );
    expect(screen.getByText(/Resume score/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/Quality review unavailable — showing structure check only/i),
    ).not.toBeInTheDocument();
  });

  it('shows job match panel when jobMatch has weight', () => {
    render(
      <CVScoreCard
        mode="full"
        score={65}
        scorePreview
        breakdown={{
          overall: 65,
          careerStage: 'early',
          sections: {
            contact: { score: 80, weight: 0.09, feedback: '', flags: [] },
            experience: { score: 70, weight: 0.22, feedback: '', flags: [] },
            education: { score: 75, weight: 0.09, feedback: '', flags: [] },
            skills: { score: 68, weight: 0.18, feedback: '', flags: [] },
            summary: { score: 72, weight: 0.135, feedback: '', flags: [] },
            formatting: { score: 80, weight: 0.09, feedback: '', flags: [] },
            jobMatch: {
              score: 55,
              weight: 0.1,
              feedback: 'Moderate overlap with posting.',
              flags: [],
              missingSkills: ['Kubernetes'],
              alignmentInsights: ['Leadership terms align well.'],
              recommendations: ['Add one metric from the posting.'],
            },
          },
          ats: { score: 0, compatible: true, issues: [], passed: [] },
          flags: [],
          strengths: [],
          improvements: [],
        }}
      />,
    );
    expect(screen.getByText(/Job match/i)).toBeInTheDocument();
    expect(screen.getByText('55%')).toBeInTheDocument();
    expect(screen.getByText(/Preview \(not saved\)/i)).toBeInTheDocument();
    expect(screen.getByText('Kubernetes')).toBeInTheDocument();
  });

  it('backward compatible: legacy breakdown shape without jobMatch still renders', () => {
    render(
      <CVScoreCard
        mode="compact"
        score={50}
        breakdown={{ summary: 50, experience: 50, skills: 50, education: 50 }}
      />,
    );
    expect(screen.getByText(/\/100/)).toBeInTheDocument();
  });

  it('renders ATS simulation metrics, keyword panels, recommendations, and draft handler', () => {
    const onAssist = vi.fn();
    render(
      <CVScoreCard
        mode="full"
        score={72}
        scorePreview
        onAtsKeywordAssist={onAssist}
        breakdown={{
          overall: 72,
          careerStage: 'mid',
          sections: {
            contact: { score: 80, weight: 0.1, feedback: '', flags: [] },
            experience: { score: 70, weight: 0.25, feedback: '', flags: [] },
            education: { score: 75, weight: 0.1, feedback: '', flags: [] },
            skills: { score: 68, weight: 0.2, feedback: '', flags: [] },
            summary: { score: 72, weight: 0.15, feedback: '', flags: [] },
            formatting: { score: 80, weight: 0.1, feedback: '', flags: [] },
            jobMatch: { score: 60, weight: 0.1, feedback: '', flags: [] },
          },
          ats: {
            score: 74,
            compatible: false,
            passed: ['Plain section headings'],
            issues: ['Simulation: tighten keyword coverage'],
            simulation: {
              overallScore: 74,
              coveragePercent: 55,
              dimensions: {
                keywordMatch: { score0to100: 60, weight: 0.3, contribution: 18 },
              },
              keywords: {
                required: { present: ['TypeScript'], missing: ['Kubernetes', 'Docker'] },
                preferred: { present: ['REST'], missing: [] },
              },
              hardSkillMatches: [
                { term: 'TypeScript', matched: true },
                { term: 'Kubernetes', matched: false },
              ],
              titleAlignmentScore: 82,
              seniorityAlignmentScore: 70,
              semanticSimilarityScore: 66,
              formattingParseabilityScore: 88,
              recommendations: ['Mirror priority keywords from the posting in your skills block.'],
            },
          },
          flags: [],
          strengths: [],
          improvements: [],
        }}
      />,
    );

    expect(screen.getByTestId('ats-simulation-root')).toBeInTheDocument();
    expect(screen.getByTestId('ats-simulation-metrics')).toBeInTheDocument();
    expect(screen.getByTestId('ats-metric-keyword-match')).toHaveTextContent('60%');
    expect(screen.getByTestId('ats-metric-hard-skills')).toHaveTextContent('50%');
    expect(screen.getByTestId('ats-metric-title-alignment')).toHaveTextContent('82%');
    expect(screen.getByTestId('ats-metric-seniority-alignment')).toHaveTextContent('70%');
    expect(screen.getByTestId('ats-metric-semantic-similarity')).toHaveTextContent('66%');
    expect(screen.getByTestId('ats-metric-formatting')).toHaveTextContent('88%');
    expect(screen.getByTestId('ats-simulation-dimensions')).toBeInTheDocument();
    expect(screen.getByTestId('ats-hard-skill-matches')).toBeInTheDocument();
    expect(screen.getByTestId('ats-missing-keywords')).toBeInTheDocument();
    expect(screen.getByTestId('ats-missing-keywords')).toHaveTextContent('Kubernetes');
    expect(screen.getByTestId('ats-matched-keywords')).toBeInTheDocument();
    expect(screen.getByTestId('ats-matched-keywords')).toHaveTextContent('TypeScript');
    expect(screen.getByTestId('ats-simulation-recommendations')).toBeInTheDocument();
    expect(screen.getByText(/Mirror priority keywords/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ats-draft-keywords-assistant'));
    expect(onAssist).toHaveBeenCalledTimes(1);
    expect(onAssist.mock.calls[0][0]).toMatch(/Kubernetes/);
    expect(onAssist.mock.calls[0][0]).toMatch(/Docker/);
  });
});
