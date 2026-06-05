import {
  assistantChangedFieldLabel,
  assistantDiffDisplayStrings,
} from '@/lib/cvAssistantDiffDisplay';
import { sanitizeAssistantClarificationQuestion } from '@/lib/cvAssistantUserFacing';
import { normalizeCvRecruiterScanReport } from '@/lib/cvRecruiterScan';

/** Machine keys from GET /cv/assistant/global/operations */
export type CvGlobalAssistantOperationKey =
  | 'rewrite_action_verbs'
  | 'add_metrics'
  | 'standardise_dates'
  | 'change_tone'
  | 'remove_mentions'
  | 'generate_skills'
  | 'recruiter_scan'
  | 'apply_recruiter_findings'
  | 'custom';

export type CvGlobalAssistantOperationScope = 'full_cv' | 'findings';

export type CvGlobalAssistantOperation = {
  operation: CvGlobalAssistantOperationKey;
  label: string;
  description: string;
  exampleCommand: string;
  affectedScopeLabel: string;
  scope: CvGlobalAssistantOperationScope;
};

export type CvAssistantScope = 'section' | 'full_cv' | 'findings';

export type CvAssistantSectionDiff = {
  targetSection: string;
  patch: Record<string, unknown>;
  diff: {
    before: unknown;
    after: unknown;
    summary: string;
  };
};

export type CvGlobalAssistantFindingsResult = {
  type: 'result';
  scope: 'findings';
  affectedScopeLabel: string;
  operation: CvGlobalAssistantOperationKey;
  operationLabel?: string;
  commandId: string;
  findings: string[];
  positiveFindings?: string[];
  improvementFindings?: string[];
  actionableFindings?: string[];
  uncategorizedFindings?: string[];
  diff: { summary: string };
  /** Comprehensive recruiter scan report (2026-06). */
  report?: import('@/lib/cvRecruiterScan').CvRecruiterScanReport | null;
  scanId?: string;
};

export type CvGlobalAssistantFullCvResult = {
  type: 'result';
  scope: 'full_cv';
  affectedScopeLabel: string;
  operation: CvGlobalAssistantOperationKey;
  operationLabel?: string;
  commandId: string;
  patch: Record<string, unknown>;
  sectionDiffs: CvAssistantSectionDiff[];
  diff: { summary: string };
};

export type CvGlobalAssistantCommandResponse =
  | { type: 'clarify'; commandId: string; question: string }
  | CvGlobalAssistantFindingsResult
  | CvGlobalAssistantFullCvResult;

export type CvAssistantSectionCommandResult = {
  type: 'result';
  scope: 'section';
  affectedScopeLabel: string;
  commandId: string;
  targetSection: string;
  patch: Record<string, unknown>;
  diff: { before: unknown; after: unknown; summary: string };
};

export type CvAssistantCommandResponse =
  | { type: 'clarify'; commandId: string; question: string }
  | CvAssistantSectionCommandResult;

const GLOBAL_OPERATION_KEYS = new Set<string>([
  'rewrite_action_verbs',
  'add_metrics',
  'standardise_dates',
  'change_tone',
  'remove_mentions',
  'generate_skills',
  'recruiter_scan',
  'apply_recruiter_findings',
  'custom',
]);

/** Body fields for applying recruiter-scan findings as a full-CV global command. */
export type CvGlobalAssistantApplyFindingsPayload = {
  operation: 'apply_recruiter_findings';
  command: string;
  findings: string[];
  scanCommandId?: string;
};

export function buildGlobalFixPromptFromFindings(findings: string[]): string {
  const lines = findings.map((f) => f.trim()).filter(Boolean);
  if (lines.length === 0) {
    return 'Improve my CV based on the recruiter scan findings. Only use facts already in my CV.';
  }
  return [
    'Address these recruiter scan findings with edits across my entire CV.',
    'Only use information already in my CV; do not invent roles, dates, or skills.',
    '',
    ...lines.map((f) => `• ${f}`),
  ].join('\n');
}

/** Preferred follow-up after `recruiter_scan` (server returns `full_cv` + sectionDiffs). */
export function buildApplyRecruiterFindingsPayload(
  findings: string[],
  scanCommandId?: string,
): CvGlobalAssistantApplyFindingsPayload {
  const list = findings.map((f) => f.trim()).filter(Boolean);
  const id = scanCommandId?.trim();
  return {
    operation: 'apply_recruiter_findings',
    command: buildGlobalFixPromptFromFindings(list),
    findings: list,
    ...(id ? { scanCommandId: id } : {}),
  };
}

export type RecruiterFindingsPartition = {
  positives: string[];
  actionable: string[];
  /** Neutral lines from API grouping — shown without per-item fix controls. */
  otherNotes: string[];
  hasActionableFindings: boolean;
};

/** Lines to send with `apply_recruiter_findings` — API improvement buckets first. */
export function getRecruiterImprovementFindingsForApply(
  result: Pick<
    CvGlobalAssistantFindingsResult,
    | 'findings'
    | 'improvementFindings'
    | 'actionableFindings'
    | 'positiveFindings'
    | 'uncategorizedFindings'
  >,
): string[] {
  const fromApi = [
    ...(result.improvementFindings ?? []),
    ...(result.actionableFindings ?? []),
  ]
    .map((line) => line.trim())
    .filter(Boolean);
  if (fromApi.length > 0) {
    return [...new Set(fromApi)];
  }
  return partitionRecruiterScanFindings(result).actionable;
}

/** Split recruiter scan results for UI: strengths vs actionable improvements only. */
export function partitionRecruiterScanFindings(
  result: Pick<
    CvGlobalAssistantFindingsResult,
    | 'findings'
    | 'positiveFindings'
    | 'improvementFindings'
    | 'actionableFindings'
    | 'uncategorizedFindings'
  >,
): RecruiterFindingsPartition {
  const fromApiPositives = (result.positiveFindings ?? [])
    .map((item) => item.trim())
    .filter(Boolean);
  const fromApiImprovements = [
    ...(result.improvementFindings ?? []),
    ...(result.actionableFindings ?? []),
  ]
    .map((item) => item.trim())
    .filter(Boolean);
  const fromApiUncategorized = (result.uncategorizedFindings ?? [])
    .map((item) => item.trim())
    .filter(Boolean);

  const hasApiGrouping =
    fromApiPositives.length > 0 ||
    fromApiImprovements.length > 0 ||
    fromApiUncategorized.length > 0;

  if (hasApiGrouping) {
    const actionable = [...new Set(fromApiImprovements)];
    const positives = [...new Set(fromApiPositives)];
    const otherNotes = fromApiUncategorized.filter(
      (item) => !positives.includes(item) && !actionable.includes(item),
    );
    return {
      positives,
      actionable,
      otherNotes,
      hasActionableFindings: actionable.length > 0,
    };
  }

  const positives: string[] = [];
  const actionable: string[] = [];
  const otherNotes: string[] = [];
  for (const raw of result.findings) {
    const item = raw.trim();
    if (!item) continue;
    if (/^POSITIVE:\s*/i.test(item)) {
      positives.push(item.replace(/^POSITIVE:\s*/i, '').trim() || item);
      continue;
    }
    if (/^ACTION:\s*/i.test(item)) {
      actionable.push(item.replace(/^ACTION:\s*/i, '').trim() || item);
      continue;
    }
    otherNotes.push(item);
  }
  return {
    positives,
    actionable,
    otherNotes,
    hasActionableFindings: actionable.length > 0,
  };
}

function parseOperationKey(raw: unknown): CvGlobalAssistantOperationKey {
  const s = String(raw ?? '').trim();
  if (GLOBAL_OPERATION_KEYS.has(s)) return s as CvGlobalAssistantOperationKey;
  return 'custom';
}

function parseOperationScope(raw: unknown): CvGlobalAssistantOperationScope {
  return String(raw ?? '').trim() === 'findings' ? 'findings' : 'full_cv';
}

export function normalizeCvGlobalAssistantOperation(
  raw: unknown,
): CvGlobalAssistantOperation | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const operation = parseOperationKey(o.operation);
  const label = String(o.label ?? '').trim();
  if (!label) return null;
  const scope = parseOperationScope(o.scope);
  return {
    operation,
    label,
    description: String(o.description ?? '').trim(),
    exampleCommand: String(o.exampleCommand ?? o.example_command ?? '').trim(),
    affectedScopeLabel: String(
      o.affectedScopeLabel ?? o.affected_scope_label ?? (scope === 'findings' ? 'Findings only' : 'Entire CV'),
    ).trim(),
    scope,
  };
}

export function normalizeCvGlobalAssistantOperations(
  raw: unknown,
): CvGlobalAssistantOperation[] {
  const body =
    raw !== null && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const list = Array.isArray(body.operations)
    ? body.operations
    : Array.isArray(body)
      ? body
      : [];
  return list
    .map((item) => normalizeCvGlobalAssistantOperation(item))
    .filter((x): x is CvGlobalAssistantOperation => x != null);
}

function parseSectionDiffs(raw: unknown): CvAssistantSectionDiff[] {
  if (!Array.isArray(raw)) return [];
  const out: CvAssistantSectionDiff[] = [];
  for (const item of raw) {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    const targetSection = String(o.targetSection ?? o.target_section ?? '').trim();
    if (!targetSection) continue;
    const patch =
      o.patch && typeof o.patch === 'object' && !Array.isArray(o.patch)
        ? (o.patch as Record<string, unknown>)
        : {};
    const diffRaw = o.diff;
    const diff =
      diffRaw && typeof diffRaw === 'object' && !Array.isArray(diffRaw)
        ? {
            before: (diffRaw as Record<string, unknown>).before ?? null,
            after: (diffRaw as Record<string, unknown>).after ?? null,
            summary: String((diffRaw as Record<string, unknown>).summary ?? ''),
          }
        : { before: null, after: null, summary: '' };
    out.push({ targetSection, patch, diff });
  }
  return out;
}

export function normalizeCvGlobalAssistantCommandResponse(
  raw: unknown,
): CvGlobalAssistantCommandResponse {
  const body =
    raw !== null && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  if (body.type === 'clarify') {
    return {
      type: 'clarify',
      commandId: String(body.commandId ?? body.command_id ?? ''),
      question: sanitizeAssistantClarificationQuestion(
        String(body.question ?? 'Could you clarify your request?'),
      ),
    };
  }

  const scope = String(body.scope ?? '').trim();
  const commandId = String(body.commandId ?? body.command_id ?? '');
  const operation = parseOperationKey(body.operation);
  const operationLabel = String(
    body.operationLabel ?? body.operation_label ?? '',
  ).trim();
  const affectedScopeLabel = String(
    body.affectedScopeLabel ?? body.affected_scope_label ?? '',
  ).trim();
  const diffRaw = body.diff;
  const diffSummary =
    diffRaw && typeof diffRaw === 'object' && !Array.isArray(diffRaw)
      ? String((diffRaw as Record<string, unknown>).summary ?? '')
      : '';

  if (scope === 'findings') {
    const findings = Array.isArray(body.findings)
      ? body.findings.map((f) => String(f ?? '').trim()).filter(Boolean)
      : [];
    const positiveFindingsRaw = Array.isArray(body.positiveFindings)
      ? body.positiveFindings
      : body.positive_findings;
    const improvementFindingsRaw = Array.isArray(body.improvementFindings)
      ? body.improvementFindings
      : body.improvement_findings;
    const actionableFindingsRaw = Array.isArray(body.actionableFindings)
      ? body.actionableFindings
      : body.actionable_findings;
    const uncategorizedFindingsRaw = Array.isArray(body.uncategorizedFindings)
      ? body.uncategorizedFindings
      : body.uncategorized_findings;
    const positiveFindings = Array.isArray(positiveFindingsRaw)
      ? positiveFindingsRaw.map((f) => String(f ?? '').trim()).filter(Boolean)
      : [];
    const improvementFindings = Array.isArray(improvementFindingsRaw)
      ? improvementFindingsRaw
          .map((f) => String(f ?? '').trim())
          .filter(Boolean)
      : [];
    const actionableFindings = Array.isArray(actionableFindingsRaw)
      ? actionableFindingsRaw.map((f) => String(f ?? '').trim()).filter(Boolean)
      : [];
    const uncategorizedFindings = Array.isArray(uncategorizedFindingsRaw)
      ? uncategorizedFindingsRaw
          .map((f) => String(f ?? '').trim())
          .filter(Boolean)
      : [];
    const report = normalizeCvRecruiterScanReport(body.report);
    const scanId = String(body.scanId ?? body.scan_id ?? '').trim() || undefined;
    return {
      type: 'result',
      scope: 'findings',
      affectedScopeLabel: affectedScopeLabel || 'Findings only',
      operation,
      ...(operationLabel ? { operationLabel } : {}),
      commandId,
      ...(scanId ? { scanId } : {}),
      findings,
      ...(positiveFindings.length ? { positiveFindings } : {}),
      ...(improvementFindings.length ? { improvementFindings } : {}),
      ...(actionableFindings.length ? { actionableFindings } : {}),
      ...(uncategorizedFindings.length ? { uncategorizedFindings } : {}),
      ...(report ? { report } : {}),
      diff: { summary: diffSummary },
    };
  }

  const patch =
    body.patch && typeof body.patch === 'object' && !Array.isArray(body.patch)
      ? (body.patch as Record<string, unknown>)
      : {};

  return {
    type: 'result',
    scope: 'full_cv',
    affectedScopeLabel: affectedScopeLabel || 'Entire CV',
    operation,
    ...(operationLabel ? { operationLabel } : {}),
    commandId,
    patch,
    sectionDiffs: parseSectionDiffs(body.sectionDiffs ?? body.section_diffs),
    diff: { summary: diffSummary },
  };
}

export function normalizeCvAssistantSectionCommandResponse(
  body: Record<string, unknown>,
): CvAssistantSectionCommandResult {
  const targetSection = String(body.targetSection ?? body.target_section ?? 'summary');
  const patch =
    body.patch && typeof body.patch === 'object' && !Array.isArray(body.patch)
      ? (body.patch as Record<string, unknown>)
      : {};
  const diffRaw = body.diff;
  const diff =
    diffRaw && typeof diffRaw === 'object' && !Array.isArray(diffRaw)
      ? {
          before: (diffRaw as Record<string, unknown>).before ?? null,
          after: (diffRaw as Record<string, unknown>).after ?? null,
          summary: String((diffRaw as Record<string, unknown>).summary ?? ''),
        }
      : { before: null, after: null, summary: '' };

  return {
    type: 'result',
    scope: 'section',
    affectedScopeLabel: String(
      body.affectedScopeLabel ?? body.affected_scope_label ?? 'This section',
    ).trim() || 'This section',
    commandId: String(body.commandId ?? body.command_id ?? ''),
    targetSection,
    patch,
    diff,
  };
}

export type CvGlobalAssistantChangedField = {
  field?: string;
  fieldPath: string;
  fieldLabel?: string;
  before: string;
  after: string;
  type: 'changed';
  /** Index into `sectionDiffs` for inline accept/reject in the CV builder. */
  sectionDiffIndex: number;
};

/** Build per-section changed fields for global diff review UI. */
export function globalAssistantChangedFields(
  sectionDiffs: CvAssistantSectionDiff[],
): CvGlobalAssistantChangedField[] {
  return sectionDiffs.map((sd, sectionDiffIndex) => {
    const target = sd.targetSection.trim();
    const { before, after } = assistantDiffDisplayStrings(
      target,
      sd.diff.before,
      sd.diff.after,
    );
    return {
      fieldPath: target,
      field: assistantChangedFieldLabel(target),
      fieldLabel: sd.diff.summary.trim() || assistantChangedFieldLabel(target),
      before,
      after,
      type: 'changed' as const,
      sectionDiffIndex,
    };
  });
}

/** Shallow-merge patches for accepted section keys only. */
export function mergeGlobalAssistantPatches(
  sectionDiffs: CvAssistantSectionDiff[],
  acceptedSectionKeys: string[],
): Record<string, unknown> {
  const accepted = new Set(
    acceptedSectionKeys.map((k) => k.trim().toLowerCase()).filter(Boolean),
  );
  const merged: Record<string, unknown> = {};
  for (const sd of sectionDiffs) {
    const key = sd.targetSection.trim().toLowerCase();
    if (!accepted.has(key)) continue;
    Object.assign(merged, sd.patch);
  }
  return merged;
}
