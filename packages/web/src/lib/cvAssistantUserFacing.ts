import type { CVImprovementItem, CVSectionRecord } from '@/lib/api';
import type { CVBuilderData } from '@/lib/cvBuilder';
import { ensureCvPreviewData } from '@/lib/cvBuilder';
import type {
  CvGlobalAssistantFindingsResult,
  RecruiterFindingsPartition,
} from '@/lib/cvGlobalAssistant';
import { partitionRecruiterScanFindings } from '@/lib/cvGlobalAssistant';

/** Sections the CV already has (API rows + editor content). */
export type CvSectionInventory = {
  hasSummary: boolean;
  hasExperience: boolean;
  hasEducation: boolean;
  hasProjects: boolean;
  hasSkills: boolean;
  sectionTypesPresent: string[];
};

const ADD_SECTION_PATTERNS: Record<
  'summary' | 'experience' | 'education' | 'projects',
  RegExp[]
> = {
  summary: [
    /\binclude\s+(an?\s+)?(['"])?summary\2?\s+section\b/i,
    /\badd\s+(an?\s+)?(['"])?summary\2?\s+section\b/i,
    /\bmissing\s+(a\s+)?summary\s+section\b/i,
    /\bno\s+summary\s+section\b/i,
    /\bdoes\s+not\s+contain\b[^.]{0,80}\bsummary\b/i,
  ],
  experience: [
    /\binclude\s+(an?\s+)?(['"])?experience\2?\s+section\b/i,
    /\badd\s+(an?\s+)?(['"])?experience\2?\s+section\b/i,
    /\bmissing\s+(an?\s+)?experience\s+section\b/i,
    /\bno\s+experience\s+section\b/i,
    /\bdoes\s+not\s+contain\b[^.]{0,120}\bexperience\b/i,
    /\bno\s+data\s+for\s+['"]?experience['"]?/i,
  ],
  education: [
    /\binclude\s+(an?\s+)?(['"])?education\2?\s+section\b/i,
    /\badd\s+(an?\s+)?(['"])?education\2?\s+section\b/i,
    /\bmissing\s+(an?\s+)?education\s+section\b/i,
    /\bno\s+education\s+section\b/i,
    /\bdoes\s+not\s+contain\b[^.]{0,120}\beducation\b/i,
    /\bno\s+data\s+for\s+['"]?education['"]?/i,
  ],
  projects: [
    /\binclude\s+(an?\s+)?(['"])?projects?\2?\s+section\b/i,
    /\badd\s+(an?\s+)?(['"])?projects?\2?\s+section\b/i,
    /\bmissing\s+(a\s+)?projects?\s+section\b/i,
    /\bno\s+projects?\s+section\b/i,
    /\bdoes\s+not\s+contain\b[^.]{0,120}\bprojects?\b/i,
    /\bno\s+data\s+for\s+['"]?projects?['"]?/i,
  ],
};

function normSectionType(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '_');
}

function sectionRowVisible(row: CVSectionRecord): boolean {
  return row.hidden !== true;
}

function hasExperienceContent(data: CVBuilderData): boolean {
  return data.experience.items.some(
    (item) =>
      item.title.trim() ||
      item.company.trim() ||
      item.bullets.some((b) => b.trim().length > 0),
  );
}

function hasEducationContent(data: CVBuilderData): boolean {
  return data.education.items.some(
    (item) =>
      item.school.trim() ||
      item.degree.trim() ||
      item.field.trim(),
  );
}

function hasProjectsContent(data: CVBuilderData): boolean {
  return data.projects.some(
    (p) => p.name.trim() || p.description.trim() || String(p.bullets ?? '').trim(),
  );
}

function hasSkillsContent(data: CVBuilderData): boolean {
  return data.skills.categories.some(
    (c) => c.name.trim() || c.skills.some((s) => s.trim().length > 0),
  );
}

/** Build inventory from server section rows and the latest editor snapshot. */
export function buildCvSectionInventory(
  data: CVBuilderData | Partial<CVBuilderData> | null | undefined,
  sectionRows: CVSectionRecord[] | null | undefined,
): CvSectionInventory {
  const d = ensureCvPreviewData(data);
  const types = new Set<string>();

  for (const row of sectionRows ?? []) {
    if (!sectionRowVisible(row)) continue;
    const t = normSectionType(row.type ?? '');
    if (t) types.add(t);
    if (t.includes('experience')) types.add('experience');
    if (t.includes('education')) types.add('education');
    if (t.includes('project')) types.add('projects');
    if (t.includes('skill')) types.add('skills');
    if (t === 'summary' || t.includes('profile')) types.add('summary');
  }

  const hasSummary =
    types.has('summary') || Boolean(d.summary.text.trim());
  const hasExperience =
    types.has('experience') || hasExperienceContent(d);
  const hasEducation =
    types.has('education') || hasEducationContent(d);
  const hasProjects =
    types.has('projects') || hasProjectsContent(d);
  const hasSkills = types.has('skills') || hasSkillsContent(d);

  return {
    hasSummary,
    hasExperience,
    hasEducation,
    hasProjects,
    hasSkills,
    sectionTypesPresent: [...types],
  };
}

/** Strip model-internal wording from clarification prompts shown to users. */
export function sanitizeAssistantClarificationQuestion(question: string): string {
  let s = String(question ?? '').trim();
  if (!s) return 'Could you clarify what you would like changed?';

  s = s.replace(/\bthe\s+provided\s+cv\s+json\b/gi, 'your CV');
  s = s.replace(/\bprovided\s+cv\s+json\b/gi, 'your CV');
  s = s.replace(/\bcv\s+json\b/gi, 'your CV');
  s = s.replace(/\bjson\s+payload\b/gi, 'CV');
  s = s.replace(/\bjson\b/gi, 'CV');
  s = s.replace(
    /\bdoes\s+not\s+contain\s+any\s+data\s+for\b/gi,
    'does not show content for',
  );
  s = s.replace(
    /\bto\s+address\s+the\s+findings,\s*would\s+you\s+like\s+me\s+to\s+add\s+placeholder\s+sections\b/gi,
    'to address the findings, would you like me to draft content for empty sections',
  );
  s = s.replace(/\s{2,}/g, ' ').trim();
  return s;
}

function matchesAddMissingSectionFinding(
  text: string,
  inventory: CvSectionInventory,
): boolean {
  const t = text.trim();
  if (!t) return false;

  if (inventory.hasSummary) {
    for (const re of ADD_SECTION_PATTERNS.summary) {
      if (re.test(t)) return true;
    }
  }
  if (inventory.hasExperience) {
    for (const re of ADD_SECTION_PATTERNS.experience) {
      if (re.test(t)) return true;
    }
  }
  if (inventory.hasEducation) {
    for (const re of ADD_SECTION_PATTERNS.education) {
      if (re.test(t)) return true;
    }
  }
  if (inventory.hasProjects) {
    for (const re of ADD_SECTION_PATTERNS.projects) {
      if (re.test(t)) return true;
    }
  }
  return false;
}

function filterFindingLines(
  lines: string[],
  inventory: CvSectionInventory,
): { kept: string[]; dropped: string[] } {
  const kept: string[] = [];
  const dropped: string[] = [];
  for (const line of lines) {
    if (matchesAddMissingSectionFinding(line, inventory)) {
      dropped.push(line);
    } else {
      kept.push(line);
    }
  }
  return { kept, dropped };
}

export function filterRecruiterFindingsPartition(
  partition: RecruiterFindingsPartition,
  inventory: CvSectionInventory,
): { partition: RecruiterFindingsPartition; dropped: string[] } {
  const pos = filterFindingLines(partition.positives, inventory);
  const act = filterFindingLines(partition.actionable, inventory);
  const other = filterFindingLines(partition.otherNotes, inventory);
  const dropped = [...pos.dropped, ...act.dropped, ...other.dropped];
  const actionable = act.kept;
  return {
    partition: {
      positives: pos.kept,
      actionable,
      otherNotes: other.kept,
      hasActionableFindings: actionable.length > 0,
    },
    dropped,
  };
}

export function filterRecruiterScanFindingsResult(
  result: CvGlobalAssistantFindingsResult,
  inventory: CvSectionInventory,
): { result: CvGlobalAssistantFindingsResult; dropped: string[] } {
  const base = partitionRecruiterScanFindings(result);
  const { partition, dropped } = filterRecruiterFindingsPartition(base, inventory);

  const filterList = (lines: string[] | undefined) => {
    const src = lines ?? [];
    return filterFindingLines(src, inventory).kept;
  };

  return {
    result: {
      ...result,
      findings: filterList(result.findings),
      positiveFindings: partition.positives,
      improvementFindings: partition.actionable,
      actionableFindings: partition.actionable,
      uncategorizedFindings: partition.otherNotes,
    },
    dropped,
  };
}

export function filterUnrealisticCvSuggestions(
  items: CVImprovementItem[],
  inventory: CvSectionInventory,
): { items: CVImprovementItem[]; dropped: Array<{ section: string; issue: string; id?: string }> } {
  const kept: CVImprovementItem[] = [];
  const dropped: Array<{ section: string; issue: string; id?: string }> = [];

  for (const item of items) {
    const issue = String(item.issue ?? item.message ?? '').trim();
    const suggestion = String(item.suggestion ?? '').trim();
    const combined = `${issue} ${suggestion}`.trim();
    if (matchesAddMissingSectionFinding(combined, inventory)) {
      dropped.push({
        section: String(item.section ?? ''),
        issue: issue || suggestion,
        id: item.id,
      });
      continue;
    }
    kept.push(item);
  }

  return { items: kept, dropped };
}

export function logUnrealisticCvRecommendationDropDev(
  context: string,
  profileId: string | null | undefined,
  dropped: Array<{ section: string; issue: string; id?: string } | string>,
): void {
  if (process.env.NODE_ENV !== 'development') return;
  if (!dropped.length) return;
  // eslint-disable-next-line no-console -- dev diagnostics for backend follow-up
  console.info('[cv:assistant] filtered unrealistic recommendations', {
    context,
    profileId: profileId?.trim() || null,
    dropped,
  });
}
