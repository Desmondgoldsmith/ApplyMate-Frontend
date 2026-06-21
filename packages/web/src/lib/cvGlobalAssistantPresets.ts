import type { CvGlobalAssistantOperation } from '@/lib/cvGlobalAssistant';

/** Default global assistant presets — kept in sync with backend catalog keys. */
export const CV_GLOBAL_ASSISTANT_DEFAULT_PRESETS: readonly CvGlobalAssistantOperation[] =
  [
    {
      operation: 'rewrite_action_verbs',
      label: 'Action verbs on bullets',
      description: 'Start every bullet with a strong verb',
      exampleCommand: 'Rewrite all bullets to start with action verbs.',
      affectedScopeLabel: 'Entire resume',
      scope: 'full_cv',
    },
    {
      operation: 'add_metrics',
      label: 'Add metrics',
      description: 'Quantify impact in experience bullets',
      exampleCommand:
        'Add quantified metrics to all experience bullets where possible.',
      affectedScopeLabel: 'Entire resume',
      scope: 'full_cv',
    },
    {
      operation: 'standardise_dates',
      label: 'Standardise dates',
      description: 'One date style across the CV',
      exampleCommand: 'Standardise all date formats across sections.',
      affectedScopeLabel: 'Entire resume',
      scope: 'full_cv',
    },
    {
      operation: 'change_tone',
      label: 'Change tone',
      description: 'Pick senior, concise, or technical',
      exampleCommand:
        'Change overall tone to [more senior / more concise / more technical].',
      affectedScopeLabel: 'Entire resume',
      scope: 'full_cv',
    },
    {
      operation: 'remove_mentions',
      label: 'Remove mentions',
      description: 'Strip a technology or company name',
      exampleCommand:
        'Remove all mentions of [specific technology or company].',
      affectedScopeLabel: 'Entire resume',
      scope: 'full_cv',
    },
    {
      operation: 'generate_skills',
      label: 'Generate skills',
      description: 'Build skills from your experience',
      exampleCommand: 'Generate a skills section from all experience content.',
      affectedScopeLabel: 'Entire resume',
      scope: 'full_cv',
    },
    {
      operation: 'recruiter_scan',
      label: 'Recruiter scan',
      description: 'Findings only — no automatic edits',
      exampleCommand: 'Apply a recruiter scan and return findings.',
      affectedScopeLabel: 'Findings only',
      scope: 'findings',
    },
  ];

/** Merge API catalog over defaults so prompts always exist offline / before GET returns. */
export function resolveGlobalAssistantPresets(
  fromApi: CvGlobalAssistantOperation[],
): CvGlobalAssistantOperation[] {
  const apiByKey = new Map(
    fromApi
      .filter((o) => o.operation !== 'custom')
      .map((o) => [o.operation, o] as const),
  );

  return CV_GLOBAL_ASSISTANT_DEFAULT_PRESETS.map((def) => {
    const remote = apiByKey.get(def.operation);
    if (!remote) return { ...def };
    const exampleCommand = remote.exampleCommand.trim() || def.exampleCommand;
    return {
      ...def,
      label: remote.label.trim() || def.label,
      description: remote.description.trim() || def.description,
      exampleCommand,
      affectedScopeLabel: remote.affectedScopeLabel.trim() || def.affectedScopeLabel,
      scope: remote.scope === 'findings' ? 'findings' : def.scope,
    };
  });
}
