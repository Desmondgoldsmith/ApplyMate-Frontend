export type CvParseImportSectionKind = 'core' | 'optional' | 'custom' | 'links';

export type CvParseImportSectionRow = {
  type: string;
  label: string;
  itemCount: number;
  kind: CvParseImportSectionKind;
};

export type CvParseImportSummary = {
  sectionCount: number;
  message: string;
  sections: CvParseImportSectionRow[];
};

const IMPORT_KINDS = new Set<CvParseImportSectionKind>([
  'core',
  'optional',
  'custom',
  'links',
]);

function parseImportKind(v: unknown): CvParseImportSectionKind {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  if (IMPORT_KINDS.has(s as CvParseImportSectionKind)) return s as CvParseImportSectionKind;
  return 'core';
}

function normalizeImportSectionRow(raw: unknown): CvParseImportSectionRow | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const type = typeof o.type === 'string' ? o.type.trim() : '';
  const label = typeof o.label === 'string' ? o.label.trim() : '';
  if (!type && !label) return null;
  const itemCount =
    typeof o.itemCount === 'number' && Number.isFinite(o.itemCount)
      ? Math.max(0, Math.floor(o.itemCount))
      : 0;
  return {
    type: type || 'section',
    label: label || type || 'Section',
    itemCount,
    kind: parseImportKind(o.kind),
  };
}

export function normalizeCvParseImportSummary(raw: unknown): CvParseImportSummary | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const sectionsRaw = o.sections;
  const sections = Array.isArray(sectionsRaw)
    ? sectionsRaw
        .map((row) => normalizeImportSectionRow(row))
        .filter((row): row is CvParseImportSectionRow => row !== null)
    : [];
  const sectionCount =
    typeof o.sectionCount === 'number' && Number.isFinite(o.sectionCount)
      ? Math.max(0, Math.floor(o.sectionCount))
      : sections.length;
  const message =
    typeof o.message === 'string' && o.message.trim()
      ? o.message.trim()
      : sections.length > 0
        ? `We found ${sectionCount} sections in your CV — here's what was imported.`
        : '';
  if (!message && sections.length === 0) return null;
  return { sectionCount, message, sections };
}

export function extractCvParseImportSummary(
  body: Record<string, unknown>,
): CvParseImportSummary | null {
  const nested =
    body.importSummary !== null &&
    typeof body.importSummary === 'object' &&
    !Array.isArray(body.importSummary)
      ? (body.importSummary as Record<string, unknown>)
      : null;
  return normalizeCvParseImportSummary(nested ?? body.importSummary);
}

export function itemCountLabel(count: number): string {
  if (count === 0) return 'No entries';
  if (count === 1) return '1 entry';
  return `${count} entries`;
}
