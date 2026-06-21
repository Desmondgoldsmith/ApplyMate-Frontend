import axios from 'axios';

import {
  api,
  type CVProfile,
  type CVSectionRecord,
  type CvAcceptUpdatedSection,
  type CvBatchUpsertSectionInput,
} from '@/lib/api';
import { normalizeProfessionalHeadlineTitle } from '@/lib/infer-cv-profile-name';
import { isPayloadTooLargeError } from '@/lib/axios';
import { logCvDevPerf } from '@/lib/cvDevPerf';
import { richTextPlainText } from '@/lib/cvRichTextCore';
import { normalizeText } from '@/lib/normalizeText';

/** --- CV layout keys (keep in sync across builder, preview, onboarding, API) --- */
export type CvTemplateId =
  | 'classic'
  | 'modern'
  | 'creative'
  | 'professional'
  | 'onyx';

export const CV_TEMPLATE_IDS: readonly CvTemplateId[] = [
  'classic',
  'modern',
  'creative',
  'professional',
  'onyx',
];

export function isCvTemplateId(v: string | undefined | null): v is CvTemplateId {
  return typeof v === 'string' && (CV_TEMPLATE_IDS as readonly string[]).includes(v);
}

/** Split CV bullets whether stored as a string (newline-separated) or string[]. */
export function normalizeBullets(bullets: string | string[] | undefined | null): string[] {
  if (!bullets) return [];
  if (Array.isArray(bullets)) {
    return bullets
      .flatMap((b) => (typeof b === 'string' ? [b.trim()] : []))
      .map((s) => s.replace(/^[-•]\s*/, ''))
      .filter((s) => s.length > 0);
  }
  if (typeof bullets === 'string') {
    return bullets
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((s) => s.replace(/^[-•]\s*/, ''));
  }
  return [];
}

/** --- CVBuilder domain types (aligned with section PATCH payloads) --- */

export type CVBuilderPersonal = {
  name: string;
  email: string;
  phone: string;
  location: string;
  headline: string;
  website?: string;
  linkedin?: string;
  github?: string;
  /** Distinct from general website — portfolio / personal site. */
  portfolio?: string;
  extras: { label: string; value: string }[];

  /** International template fields — optional */
  dateOfBirth?: string;
  placeOfBirth?: string;
  nationality?: string;
  gender?: string;
  maritalStatus?: string;
  drivingLicence?: string;
  photoUrl?: string;
  hobbies?: string;
};

export type CVBuilderSummary = {
  text: string;
};

export type CVBuilderExperienceItem = {
  id: string;
  title: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  bullets: string[];
};

export type CVBuilderEducationItem = {
  id: string;
  degree: string;
  field: string;
  school: string;
  startYear: string;
  endYear: string;
  grade?: string;
};

export type CVBuilderSkillCategory = {
  id: string;
  name: string;
  skills: string[];
};

export type CVBuilderSkills = {
  categories: CVBuilderSkillCategory[];
};

export type CVBuilderProject = {
  id: string;
  name: string;
  description: string;
  technologies: string[];
  url: string;
  bullets: string;
};

export type CVBuilderCertification = {
  id: string;
  name: string;
  issuer: string;
  date: string;
  url: string;
};

export type CVBuilderLanguage = {
  id: string;
  language: string;
  proficiency: '' | 'Native' | 'Fluent' | 'Professional' | 'Intermediate' | 'Basic';
  /** CEFR breakdown — used by Europass templates */
  listening?: string;
  reading?: string;
  spokenInteraction?: string;
  spokenProduction?: string;
  writing?: string;
};

export type CVBuilderReference = {
  id: string;
  name: string;
  title: string;
  company: string;
  email: string;
  phone: string;
};

/** UK-style placeholder rows importers sometimes add — not a real reference entry. */
export function isCvReferenceUponRequestPlaceholder(ref: {
  name?: string;
  title?: string;
  company?: string;
  email?: string;
  phone?: string;
}): boolean {
  const blob = [ref.name, ref.title, ref.company, ref.email, ref.phone]
    .map((v) => (typeof v === 'string' ? v : ''))
    .join(' ')
    .toLowerCase();
  return (
    /\bavailable\s+upon\s+request\b/.test(blob) ||
    /\breferences?\s+available\s+upon\s+request\b/.test(blob) ||
    /\bupon\s+request\b/.test(blob)
  );
}

export function filterCvBuilderReferences(refs: CVBuilderReference[]): CVBuilderReference[] {
  return refs.filter((r) => !isCvReferenceUponRequestPlaceholder(r));
}

export function cvReferenceHasContent(ref: CVBuilderReference): boolean {
  return Boolean(
    ref.name.trim() || ref.title.trim() || ref.company.trim() || ref.email.trim() || ref.phone.trim(),
  );
}

export type CVBuilderAchievement = {
  id: string;
  title: string;
  issuer: string;
  date: string;
  detail: string;
};

export type CVBuilderCustomSection = {
  id: string;
  title: string;
  body: string;
};

/** Parsed upload sections with API section id (type `custom_*`). */
export type CVBuilderParsedCustomItem = {
  id: string;
  text: string;
  date?: string;
  subItems: string[];
};

export type CVBuilderParsedCustomSection = {
  sectionId: string;
  sectionType: string;
  title: string;
  items: CVBuilderParsedCustomItem[];
};

export type CVBuilderData = {
  personal: CVBuilderPersonal;
  summary: CVBuilderSummary;
  experience: { items: CVBuilderExperienceItem[] };
  education: { items: CVBuilderEducationItem[] };
  skills: CVBuilderSkills;
  projects: CVBuilderProject[];
  certifications: CVBuilderCertification[];
  languages: CVBuilderLanguage[];
  achievements: CVBuilderAchievement[];
  references: CVBuilderReference[];
  /** Legacy aggregate `custom` section (items with title + body). */
  customSections: CVBuilderCustomSection[];
  /** One entry per `custom_*` API section row. */
  parsedCustomSections: CVBuilderParsedCustomSection[];
};

export function newLocalId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function emptyCVBuilderData(defaults?: { email?: string; name?: string }): CVBuilderData {
  return {
    personal: {
      name: defaults?.name ?? '',
      email: defaults?.email ?? '',
      phone: '',
      location: '',
      headline: '',
      website: '',
      linkedin: '',
      github: '',
      portfolio: '',
      extras: [],
    },
    summary: { text: '' },
    experience: { items: [] },
    education: { items: [] },
    skills: { categories: [] },
    projects: [],
    certifications: [],
    languages: [],
    achievements: [],
    references: [],
    customSections: [],
    parsedCustomSections: [],
  };
}

/**
 * Coerces partial or merged builder snapshots (e.g. optimistic patches) into a shape safe for
 * document preview components, which assume `experience.items`, `education.items`, etc. exist.
 */
export function ensureCvPreviewData(data: CVBuilderData | Partial<CVBuilderData> | null | undefined): CVBuilderData {
  const empty = emptyCVBuilderData();
  if (!data || typeof data !== 'object') return empty;
  const d = data as Partial<CVBuilderData>;
  const rawPersonal =
    d.personal && typeof d.personal === 'object' ? { ...empty.personal, ...d.personal } : empty.personal;
  const personal: CVBuilderPersonal = {
    ...rawPersonal,
    name: normalizeText(rawPersonal.name),
    email: normalizeText(rawPersonal.email),
    phone: normalizeText(rawPersonal.phone),
    location: normalizeText(rawPersonal.location),
    headline: normalizeText(rawPersonal.headline),
    website: normalizeText(rawPersonal.website ?? ''),
    linkedin: normalizeText(rawPersonal.linkedin ?? ''),
    github: normalizeText(rawPersonal.github ?? ''),
    portfolio: normalizeText(rawPersonal.portfolio ?? ''),
    extras: Array.isArray(rawPersonal.extras)
      ? rawPersonal.extras.map((e) => ({
          label: normalizeText(e?.label),
          value: normalizeText(e?.value),
        }))
      : [],
    dateOfBirth: rawPersonal.dateOfBirth !== undefined ? normalizeText(rawPersonal.dateOfBirth) : undefined,
    placeOfBirth: rawPersonal.placeOfBirth !== undefined ? normalizeText(rawPersonal.placeOfBirth) : undefined,
    nationality: rawPersonal.nationality !== undefined ? normalizeText(rawPersonal.nationality) : undefined,
    gender: rawPersonal.gender !== undefined ? normalizeText(rawPersonal.gender) : undefined,
    maritalStatus: rawPersonal.maritalStatus !== undefined ? normalizeText(rawPersonal.maritalStatus) : undefined,
    drivingLicence: rawPersonal.drivingLicence !== undefined ? normalizeText(rawPersonal.drivingLicence) : undefined,
    photoUrl:
      rawPersonal.photoUrl === undefined
        ? undefined
        : (() => {
            const s = normalizeText(rawPersonal.photoUrl as unknown);
            return s || undefined;
          })(),
    hobbies: rawPersonal.hobbies !== undefined ? normalizeText(rawPersonal.hobbies) : undefined,
  };
  const summaryPlain =
    typeof d.summary === 'string'
      ? normalizeText(d.summary)
      : normalizeText((d.summary as { text?: unknown } | undefined)?.text);
  return {
    personal,
    summary: { text: summaryPlain || empty.summary.text },
    experience: {
      items: Array.isArray(d.experience?.items) ? d.experience.items : [],
    },
    education: {
      items: Array.isArray(d.education?.items) ? d.education.items : [],
    },
    skills: {
      categories: Array.isArray(d.skills?.categories) ? d.skills.categories : [],
    },
    projects: Array.isArray(d.projects) ? d.projects : [],
    certifications: Array.isArray(d.certifications) ? d.certifications : [],
    languages: Array.isArray(d.languages) ? d.languages : [],
    achievements: Array.isArray(d.achievements) ? d.achievements : [],
    references: Array.isArray(d.references) ? d.references : [],
    customSections: Array.isArray(d.customSections) ? d.customSections : [],
    parsedCustomSections: Array.isArray(d.parsedCustomSections) ? d.parsedCustomSections : [],
  };
}

/**
 * Ensures every user-visible string leaf in builder state is a plain string (never `[object Object]`).
 * Use after deep-merging assistant patches or when hydrating snapshots that may contain nested API shapes.
 */
export function coerceStructuredTextInCvBuilderData(data: CVBuilderData): CVBuilderData {
  const base = ensureCvPreviewData(data);
  const profOrder = ['Native', 'Fluent', 'Professional', 'Intermediate', 'Basic'] as const;
  const coerceProf = (p: CVBuilderLanguage['proficiency']): CVBuilderLanguage['proficiency'] => {
    if (p === '') return '';
    if (typeof p === 'string' && (profOrder as readonly string[]).includes(p)) return p;
    const t = normalizeText(p as unknown).trim();
    if (!t) return '';
    return (profOrder as readonly string[]).includes(t) ? (t as CVBuilderLanguage['proficiency']) : '';
  };
  return {
    ...base,
    experience: {
      items: base.experience.items.map((it) => ({
        ...it,
        title: normalizeText(it.title as unknown),
        company: normalizeText(it.company as unknown),
        location: normalizeText(it.location as unknown),
        startDate: normalizeText(it.startDate as unknown),
        endDate: normalizeText(it.endDate as unknown),
        bullets: (Array.isArray(it.bullets) ? it.bullets : []).map((b) => normalizeText(b as unknown)),
      })),
    },
    education: {
      items: base.education.items.map((it) => ({
        ...it,
        degree: normalizeText(it.degree as unknown),
        field: normalizeText(it.field as unknown),
        school: normalizeText(it.school as unknown),
        startYear: normalizeText(it.startYear as unknown),
        endYear: normalizeText(it.endYear as unknown),
        grade: normalizeText(it.grade as unknown),
      })),
    },
    skills: {
      categories: base.skills.categories.map((c) => ({
        ...c,
        name: normalizeText(c.name as unknown),
        skills: (Array.isArray(c.skills) ? c.skills : []).map((s) => {
          const normalized = normalizeText(s as unknown);
          return richTextPlainText(normalized) || normalized;
        }),
      })),
    },
    projects: base.projects.map((p) => ({
      ...p,
      name: normalizeText(p.name as unknown),
      description: normalizeText(p.description as unknown),
      technologies: (Array.isArray(p.technologies) ? p.technologies : []).map((t) => normalizeText(t as unknown)),
      url: normalizeText(p.url as unknown),
      bullets: normalizeText(p.bullets as unknown),
    })),
    certifications: base.certifications.map((c) => ({
      ...c,
      name: normalizeText(c.name as unknown),
      issuer: normalizeText(c.issuer as unknown),
      date: normalizeText(c.date as unknown),
      url: normalizeText(c.url as unknown),
    })),
    achievements: base.achievements.map((a) => ({
      ...a,
      title: normalizeText(a.title as unknown),
      issuer: normalizeText(a.issuer as unknown),
      date: normalizeText(a.date as unknown),
      detail: normalizeText(a.detail as unknown),
    })),
    languages: base.languages.map((l) => ({
      ...l,
      language: normalizeText(l.language as unknown),
      proficiency: coerceProf(l.proficiency),
      listening: l.listening !== undefined ? normalizeText(l.listening as unknown) : undefined,
      reading: l.reading !== undefined ? normalizeText(l.reading as unknown) : undefined,
      spokenInteraction:
        l.spokenInteraction !== undefined ? normalizeText(l.spokenInteraction as unknown) : undefined,
      spokenProduction:
        l.spokenProduction !== undefined ? normalizeText(l.spokenProduction as unknown) : undefined,
      writing: l.writing !== undefined ? normalizeText(l.writing as unknown) : undefined,
    })),
    references: filterCvBuilderReferences(
      base.references.map((r) => ({
        ...r,
        name: normalizeText(r.name as unknown),
        title: normalizeText(r.title as unknown),
        company: normalizeText(r.company as unknown),
        email: normalizeText(r.email as unknown),
        phone: normalizeText(r.phone as unknown),
      })),
    ),
    customSections: base.customSections.map((c) => ({
      ...c,
      title: normalizeText(c.title as unknown),
      body: normalizeText(c.body as unknown),
    })),
    parsedCustomSections: base.parsedCustomSections.map((sec) => ({
      ...sec,
      title: normalizeText(sec.title as unknown),
      items: sec.items.map((it) => ({
        ...it,
        text: normalizeText(it.text as unknown),
        date: it.date !== undefined ? normalizeText(it.date as unknown) : undefined,
        subItems: (Array.isArray(it.subItems) ? it.subItems : []).map((s) => normalizeText(s as unknown)),
      })),
    })),
  };
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function sectionByType(sections: CVSectionRecord[], type: string): CVSectionRecord | undefined {
  return sections.find((s) => s.type.toLowerCase() === type.toLowerCase());
}

/** True if experience section rows have at least one title or company (backend may leave placeholder rows after re-parse). */
function sectionExperienceHasMeaningfulItems(items: unknown[]): boolean {
  for (const raw of items) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const o = raw as Record<string, unknown>;
    if (str(o.title ?? o.role ?? o.position).trim() || str(o.company ?? o.organization).trim()) return true;
  }
  return false;
}

function sectionEducationHasMeaningfulItems(items: unknown[]): boolean {
  for (const raw of items) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const o = raw as Record<string, unknown>;
    if (str(o.degree ?? o.qualification).trim() || str(o.school ?? o.institution ?? o.university).trim()) return true;
  }
  return false;
}

function sectionSkillsHasMeaningfulData(skSec: CVSectionRecord | undefined): boolean {
  if (!skSec?.data) return false;
  const d = skSec.data;
  if (Array.isArray(d.skillCategories) && d.skillCategories.length > 0) return true;
  if (Array.isArray(d.groups) && d.groups.length > 0) return true;
  if (Array.isArray(d.categories)) {
    return d.categories.some((c) => {
      if (!c || typeof c !== 'object') return false;
      const o = c as Record<string, unknown>;
      const skills = Array.isArray(o.skills)
        ? o.skills.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        : [];
      const items = Array.isArray(o.items)
        ? o.items.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        : [];
      return skills.length > 0 || items.length > 0;
    });
  }
  if (Array.isArray(d.items)) {
    return d.items.some((x) => typeof x === 'string' && x.trim());
  }
  return false;
}

const SECTION_ITEM_KEYS_EXP = [
  'items',
  'entries',
  'roles',
  'experiences',
  'workHistory',
  'history',
  'jobs',
] as const;

const SECTION_ITEM_KEYS_EDU = [
  'items',
  'entries',
  'education',
  'degrees',
  'schools',
  'qualifications',
] as const;

function coalesceItemsFromSectionData(
  d: Record<string, unknown> | undefined,
  keys: readonly string[],
): unknown[] | undefined {
  if (!d) return undefined;
  for (const k of keys) {
    const v = d[k];
    if (Array.isArray(v) && v.length > 0) return v;
  }
  return undefined;
}

function structuredCoreIsEmpty(st: CVProfile['structured'] | undefined): boolean {
  const ex = st?.experience;
  const ed = st?.education;
  const sk = st?.skills;
  const pk = st?.primarySkills;
  const sc = (st as { skillCategories?: unknown[] } | undefined)?.skillCategories;
  const noEx = !Array.isArray(ex) || ex.length === 0;
  const noEd = !Array.isArray(ed) || ed.length === 0;
  const noSk =
    (!Array.isArray(sk) || sk.length === 0) &&
    (!Array.isArray(pk) || pk.length === 0) &&
    (!Array.isArray(sc) || sc.length === 0);
  return noEx && noEd && noSk;
}

function djb2Short(input: string, max = 4000): string {
  const s = input.length > max ? input.slice(0, max) : input;
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 33) ^ s.charCodeAt(i)!;
  }
  return (h >>> 0).toString(36);
}

function stripCvExtractionNoise(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\n--\s*\d+\s+of\s+\d+\s+--\s*\n/gi, '\n')
    .replace(/\*{3}[^*\n]+?\*{3}/g, '')
    .trim();
}

type ParsedCvTextSection = 'summary' | 'education' | 'skills' | 'projects' | 'experience';

const CV_TEXT_SECTION_HEADERS: { key: ParsedCvTextSection; pattern: RegExp }[] = [
  { key: 'summary', pattern: /^(professional\s+)?summary$/i },
  { key: 'summary', pattern: /^profile$/i },
  { key: 'summary', pattern: /^objective$/i },
  { key: 'summary', pattern: /^about(\s+me)?$/i },
  { key: 'education', pattern: /^education$/i },
  { key: 'education', pattern: /^academic(\s+background)?$/i },
  { key: 'experience', pattern: /^(work\s+)?experience$/i },
  { key: 'experience', pattern: /^employment(\s+history)?$/i },
  { key: 'experience', pattern: /^professional\s+experience$/i },
  { key: 'skills', pattern: /^skills$/i },
  { key: 'skills', pattern: /^technical\s+skills$/i },
  { key: 'skills', pattern: /^core\s+competencies$/i },
  { key: 'skills', pattern: /^areas\s+of\s+expertise$/i },
  { key: 'skills', pattern: /^expertise$/i },
  { key: 'projects', pattern: /^projects?$/i },
  { key: 'projects', pattern: /^selected\s+projects$/i },
];

function matchCvTextSectionHeader(line: string): ParsedCvTextSection | null {
  const t = line.trim().replace(/[:：]\s*$/, '');
  if (t.length < 3 || t.length > 72) return null;
  if (t.includes('http') || t.includes('@')) return null;
  if (t.includes('•')) return null;
  for (const { key, pattern } of CV_TEXT_SECTION_HEADERS) {
    if (pattern.test(t)) return key;
  }
  return null;
}

/** Split CV plain text on common ALL-CAPS / title headings (upload extract when `structured` is empty). */
function splitCvTextIntoSections(raw: string): Map<ParsedCvTextSection, string> {
  const out = new Map<ParsedCvTextSection, string>();
  const lines = stripCvExtractionNoise(raw).split('\n');
  let current: ParsedCvTextSection | null = null;
  const buf: string[] = [];

  const flush = () => {
    if (!current) return;
    const body = buf.join('\n').trim();
    if (!body) return;
    const prev = out.get(current);
    out.set(current, prev ? `${prev}\n\n${body}` : body);
    buf.length = 0;
  };

  for (const line of lines) {
    const next = matchCvTextSectionHeader(line);
    if (next) {
      flush();
      current = next;
      continue;
    }
    if (current) buf.push(line);
  }
  flush();
  return out;
}

function parseEducationItemsFromTextBlob(blob: string): CVBuilderEducationItem[] {
  const lines = blob.split('\n').map((l) => l.trim()).filter(Boolean);
  const items: CVBuilderEducationItem[] = [];
  /** Start of school line: has optional "|" and a 4-digit year range, or classic "University …" */
  const isSchoolLine = (ln: string) =>
    /\d{4}\s*[–—-]\s*(\d{4}|present)/i.test(ln) && (ln.includes('|') || /university|college|institute|school|academy/i.test(ln));

  let i = 0;
  while (i < lines.length) {
    const first = lines[i]!;
    if (!isSchoolLine(first)) {
      i += 1;
      continue;
    }
    const yr = first.match(/(\d{4})\s*[–—-]\s*(\d{4}|present)/i);
    let school = first;
    let startYear = '';
    let endYear = '';
    if (yr && yr.index !== undefined) {
      startYear = yr[1]!;
      endYear = /present/i.test(yr[2]!) ? 'Present' : yr[2]!;
      school = first.slice(0, yr.index).trim().replace(/\|\s*$/, '').trim();
    }
    const degree = (lines[i + 1] && !isSchoolLine(lines[i + 1]!) ? lines[i + 1]! : '').replace(/\s*\.\s*$/, '').trim();
    if (school.length > 2 || degree.length > 2) {
      items.push({
        id: newLocalId(),
        school,
        degree,
        field: '',
        startYear,
        endYear,
        grade: '',
      });
    }
    i += degree ? 2 : 1;
  }
  return items;
}

function parseSkillCategoriesFromTextBlob(blob: string): CVBuilderSkillCategory[] {
  const lines = blob.split('\n').map((l) => l.trim()).filter(Boolean);
  const cats: CVBuilderSkillCategory[] = [];

  for (const line of lines) {
    const bulletCat = line.match(/^[•\-\u2022]\s*(.+?):\s*(.+)$/);
    if (bulletCat) {
      const name = bulletCat[1]!.trim();
      const rest = bulletCat[2]!;
      const skills = rest
        .split(/[,|;]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 1 && s.length < 120);
      if (name && skills.length) cats.push({ id: newLocalId(), name, skills });
      continue;
    }
    if (line.includes('|') && line.length < 400 && !line.includes('http')) {
      const parts = line.split('|').map((s) => s.trim()).filter((s) => s.length > 1);
      if (parts.length >= 3) {
        cats.push({ id: newLocalId(), name: 'Expertise', skills: parts });
      }
    }
  }
  return cats;
}

function parseProjectsFromTextBlob(blob: string): CVBuilderProject[] {
  const chunks = blob.split(/\n\s*\n+/).map((c) => c.trim()).filter(Boolean);
  const projects: CVBuilderProject[] = [];
  for (const chunk of chunks) {
    const urlM = chunk.match(/https?:\/\/[^\s)]+/i);
    const url = urlM ? urlM[0]!.replace(/[),.;]+$/, '') : '';
    const lines = chunk.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    const titleParts: string[] = [];
    for (const ln of lines) {
      if (/^https?:\/\//i.test(ln)) break;
      if (/^o\s+/i.test(ln)) continue;
      if (ln.startsWith('•') || ln.startsWith('-')) break;
      if (titleParts.length < 2 && ln.length < 120) titleParts.push(ln.replace(/[-–—]\s*$/, '').trim());
      else break;
    }
    const title = titleParts.join(' — ').trim();
    const bulletLines = lines.filter((l) => /^[•\-\u2022o]\s+/i.test(l) || /^o\s+/i.test(l));
    const bullets = bulletLines
      .map((l) => l.replace(/^[•\-\u2022o]\s+/i, '').replace(/^o\s+/i, '').trim())
      .filter(Boolean)
      .join('\n');
    if (title || url || bullets.length > 20) {
      projects.push({
        id: newLocalId(),
        name: title || 'Project',
        description: '',
        technologies: [],
        url,
        bullets,
      });
    }
  }
  return projects;
}

function extractContactHintsFromRawText(raw: string, base: CVBuilderData): void {
  const first = raw.split('\n')[0]?.trim() ?? '';
  if (!base.personal.location.trim() && first.includes('|')) {
    const locCand = first.split('|')[0]?.trim() ?? '';
    if (/^[A-Za-zÀ-ÿ0-9\s,.()-]{3,80}$/.test(locCand) && !locCand.includes('@')) {
      base.personal.location = locCand;
    }
  }
  const gh = raw.match(/https?:\/\/(www\.)?github\.com\/[^\s)\]]+/i);
  if (gh && !(base.personal.github ?? '').trim()) {
    base.personal.github = gh[0]!.replace(/[),.;]+$/, '');
  }
  const li = raw.match(/https?:\/\/(www\.)?linkedin\.com\/[^\s)\]]+/i);
  if (li && !(base.personal.linkedin ?? '').trim()) {
    base.personal.linkedin = li[0]!.replace(/[),.;]+$/, '');
  }
  const mail = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (mail && !base.personal.email.trim()) {
    base.personal.email = mail[0]!;
  }
}

/**
 * When the API leaves `structured.experience` (etc.) empty but `rawText` holds a readable CV,
 * infer sections from common headings so the builder is usable without a second backend parse.
 */
function applyRawTextFallbackToBuilder(profile: CVProfile, base: CVBuilderData): void {
  const raw = profile.rawText?.trim();
  if (!raw || raw.length < 80) return;
  // Do not gate the whole fallback on `structuredCoreIsEmpty`: when the API fills
  // education/skills but omits projects/experience, we still need PROJECTS/EXPERIENCE
  // slices from rawText (previously we returned early and left those blocks empty).

  extractContactHintsFromRawText(raw, base);
  const parsedSections = splitCvTextIntoSections(raw);

  const sum = parsedSections.get('summary');
  if (sum && !base.summary.text.trim()) {
    base.summary.text = sum.trim();
  }

  const eduBlob = parsedSections.get('education');
  if (eduBlob && base.education.items.length === 0) {
    const eduItems = parseEducationItemsFromTextBlob(eduBlob);
    if (eduItems.length) base.education.items = eduItems;
  }

  const skillsOnly = parsedSections.get('skills');
  const areas = raw.match(
    /areas\s+of\s+expertise\s*\n([\s\S]*?)(?=\n(?:SKILLS|PROJECTS|EDUCATION|EXPERIENCE|REFERENCE)\b)/i,
  );
  let skillSource = skillsOnly?.trim() ?? '';
  if (!skillSource && areas?.[1]) skillSource = areas[1]!.trim();

  if (skillSource && base.skills.categories.every((c) => !c.skills.length)) {
    const cats = parseSkillCategoriesFromTextBlob(skillSource);
    if (cats.length) base.skills.categories = cats;
  }

  const projBlob = parsedSections.get('projects');
  if (projBlob && base.projects.length === 0) {
    const ps = parseProjectsFromTextBlob(projBlob);
    if (ps.length) base.projects = ps;
  }

  const expBlob = parsedSections.get('experience');
  if (expBlob && base.experience.items.length === 0) {
    const lines = expBlob.split('\n').map((l) => l.trim()).filter(Boolean);
    const bullets: string[] = [];
    let title = '';
    let company = '';
    for (const ln of lines) {
      if (!title && ln.length < 100 && !ln.startsWith('•')) {
        title = ln;
        continue;
      }
      if (title && !company && ln.length < 120) {
        company = ln;
        continue;
      }
      if (ln.startsWith('•') || ln.startsWith('-')) bullets.push(ln.replace(/^[•\-]\s*/, '').trim());
    }
    if (title || bullets.length) {
      base.experience.items.push({
        id: newLocalId(),
        title: title || 'Experience',
        company: company || '',
        location: '',
        startDate: '',
        endDate: '',
        current: false,
        bullets,
      });
    }
  }
}

/**
 * Signature of server-fetched profile + sections. Used to remount the CV editor when
 * `GET /cv/profiles/:id` fills `profile.structured` after parse without adding section rows yet
 * (otherwise `useState(initialData)` would never pick up the parsed content).
 */
export function cvProfileContentFingerprint(
  profile: CVProfile | null,
  sections: CVSectionRecord[],
): string {
  const st = profile?.structured;
  const sectionSig = sections
    .map((s) => `${s.id}:${s.type}:${s.order}`)
    .sort()
    .join(';');
  const expN = st?.experience?.length ?? 0;
  const eduN = st?.education?.length ?? 0;
  const skillsN = (st?.skills?.length ?? 0) + (st?.primarySkills?.length ?? 0);
  const summaryLen = typeof st?.summary === 'string' ? st.summary.length : 0;
  const kwN = st?.keywords?.length ?? 0;
  const role = st?.roleLevel ?? '';
  const rawFb =
    profile?.rawText && structuredCoreIsEmpty(st) ? djb2Short(profile.rawText) : '';
  return [
    profile?.id ?? '',
    profile?.updatedAt ?? '',
    profile?.headline ?? '',
    String(profile?.rawText?.length ?? 0),
    String(summaryLen),
    String(expN),
    String(eduN),
    String(skillsN),
    String(kwN),
    String(role),
    String(sections.length),
    sectionSig,
    rawFb,
  ].join('|');
}

function parseFirstLineName(raw?: string): string {
  if (!raw?.trim()) return '';
  const line = raw.split('\n')[0]?.trim() ?? '';
  if (line.includes('@') || line.length > 120) return '';
  return line;
}

/** Map loose API item → experience row */
function mapExpItem(o: Record<string, unknown>, id: string): CVBuilderExperienceItem {
  let startDate = str(o.startDate ?? o.start ?? '');
  let endDate = str(o.endDate ?? o.end ?? '');
  const duration = str(o.duration);
  if (!startDate && !endDate && duration) {
    const enParts = duration.split(/\s*[–—]\s*/u);
    if (enParts.length >= 2) {
      startDate = enParts[0]!.trim();
      endDate = enParts[1]!.trim();
    } else {
      const hyParts = duration.split(/\s*-\s*/);
      if (hyParts.length >= 2) {
        startDate = hyParts[0]!.trim();
        endDate = hyParts[1]!.trim();
      } else {
        startDate = duration;
      }
    }
  }
  let bullets =
    Array.isArray(o.bullets) || typeof o.bullets === 'string'
      ? normalizeBullets(o.bullets as string | string[] | undefined)
      : [];
  if (!bullets.length && str(o.description)) {
    bullets = normalizeBullets(str(o.description));
  }
  return {
    id,
    title: str(o.title ?? o.role ?? o.position),
    company: str(o.company ?? o.organization),
    location: str(o.location),
    startDate,
    endDate,
    current: o.current === true || str(o.endDate ?? endDate).toLowerCase() === 'present',
    bullets,
  };
}

function mapEduItem(o: Record<string, unknown>, id: string): CVBuilderEducationItem {
  return {
    id,
    degree: str(o.degree ?? o.qualification),
    field: str(o.field ?? o.fieldOfStudy ?? ''),
    school: str(o.school ?? o.institution ?? o.university),
    startYear: str(o.startYear ?? o.start ?? ''),
    endYear: str(o.endYear ?? o.year ?? o.graduationYear ?? ''),
    grade: str(o.grade ?? o.gpa ?? ''),
  };
}

const LANGUAGE_PROFICIENCY_LEVELS = ['Native', 'Fluent', 'Professional', 'Intermediate', 'Basic'] as const;

function humanizeCustomSectionType(type: string): string {
  const raw = type.replace(/^custom_?/i, '').replace(/_/g, ' ').trim();
  if (!raw) return 'Custom section';
  return raw.replace(/\b\w/g, (c) => c.toUpperCase());
}

function mapParsedCustomItemRaw(raw: unknown): CVBuilderParsedCustomItem {
  if (typeof raw === 'string') {
    const t = raw.trim();
    return { id: newLocalId(), text: t, subItems: [] };
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { id: newLocalId(), text: '', subItems: [] };
  }
  const o = raw as Record<string, unknown>;
  const id = str(o.id) || newLocalId();
  const text = str(o.text ?? o.title ?? o.name ?? o.label ?? o.heading);
  const date = str(o.date);
  let subItems: string[] = [];
  if (Array.isArray(o.subItems)) {
    subItems = o.subItems.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean);
  } else if (Array.isArray(o.bullets)) {
    subItems = o.bullets.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean);
  } else if (typeof o.subItemsText === 'string') {
    subItems = o.subItemsText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  }
  return { id, text, date: date || undefined, subItems };
}

function mapSectionToParsedCustom(s: CVSectionRecord): CVBuilderParsedCustomSection {
  const d = (s.data ?? {}) as Record<string, unknown>;
  const title = str(d.title) || humanizeCustomSectionType(s.type);
  const rawItems = d.items;
  const items: CVBuilderParsedCustomItem[] = [];
  if (Array.isArray(rawItems)) {
    for (const raw of rawItems) {
      items.push(mapParsedCustomItemRaw(raw));
    }
  } else if (typeof d.body === 'string' && d.body.trim()) {
    items.push({ id: newLocalId(), text: d.body.trim(), subItems: [] });
  }
  return { sectionId: s.id, sectionType: s.type, title, items };
}

export function transformSectionsToCVBuilderData(
  profile: CVProfile | null,
  sections: CVSectionRecord[],
  defaults?: { email?: string; name?: string },
): CVBuilderData {
  const base = emptyCVBuilderData(defaults);
  const sorted = [...sections].sort((a, b) => a.order - b.order);

  if (profile) {
    base.personal.headline = normalizeProfessionalHeadlineTitle(normalizeText(profile.headline as unknown));
    base.personal.phone = profile.phone ?? '';
    base.personal.location = profile.location ?? '';
    base.personal.website = profile.website ?? '';
    const stRec = profile.structured as Record<string, unknown> | undefined;
    base.personal.linkedin = str(stRec?.linkedin);
    base.personal.github = str(stRec?.github);
    base.personal.portfolio = str(stRec?.portfolio);
    const rawExtras = stRec?.extras;
    if (Array.isArray(rawExtras)) {
      base.personal.extras = rawExtras
        .filter((x): x is Record<string, unknown> => x !== null && typeof x === 'object' && !Array.isArray(x))
        .map((o) => ({ label: str(o.label), value: str(o.value) }))
        .filter((e) => e.label || e.value);
    }
    base.personal.dateOfBirth =
      typeof stRec?.dateOfBirth === 'string' ? stRec.dateOfBirth : undefined;
    base.personal.placeOfBirth =
      typeof stRec?.placeOfBirth === 'string' ? stRec.placeOfBirth : undefined;
    base.personal.nationality =
      typeof stRec?.nationality === 'string' ? stRec.nationality : undefined;
    base.personal.gender = typeof stRec?.gender === 'string' ? stRec.gender : undefined;
    base.personal.maritalStatus =
      typeof stRec?.maritalStatus === 'string' ? stRec.maritalStatus : undefined;
    base.personal.drivingLicence =
      typeof stRec?.drivingLicence === 'string' ? stRec.drivingLicence : undefined;
    base.personal.photoUrl = typeof stRec?.photoUrl === 'string' ? stRec.photoUrl : undefined;
    base.personal.hobbies = typeof stRec?.hobbies === 'string' ? stRec.hobbies : undefined;

    if (Array.isArray(stRec?.references)) {
      base.references = (stRec.references as Record<string, unknown>[]).map((r) => ({
        id: typeof r.id === 'string' ? r.id : newLocalId(),
        name: typeof r.name === 'string' ? r.name : '',
        title: typeof r.title === 'string' ? r.title : '',
        company: typeof r.company === 'string' ? r.company : '',
        email: typeof r.email === 'string' ? r.email : '',
        phone: typeof r.phone === 'string' ? r.phone : '',
      }));
    }
    const structuredName =
      str(stRec?.fullName) ||
      str(stRec?.name) ||
      str(stRec?.legalName) ||
      str(stRec?.displayName) ||
      str(stRec?.candidateName) ||
      str(stRec?.contactName);
    base.personal.name =
      parseFirstLineName(profile.rawText) ||
      structuredName ||
      defaults?.name?.trim() ||
      '';
  } else {
    base.personal.name = defaults?.name?.trim() || '';
  }
  const stRecTop = profile?.structured as Record<string, unknown> | undefined;
  const structuredEmail = str(
    stRecTop?.email ?? stRecTop?.contactEmail ?? stRecTop?.eMail ?? stRecTop?.mail,
  );
  base.personal.email = structuredEmail || defaults?.email?.trim() || '';

  const st = profile?.structured;
  if (st?.summary != null && String(st.summary).trim() !== '') {
    const fromStructured = normalizeText(st.summary as unknown).trim();
    if (fromStructured) base.summary.text = fromStructured;
  }

  const sumSec = sectionByType(sorted, 'summary');
  if (sumSec?.data) {
    const d = sumSec.data;
    const t = normalizeText(d.text ?? d.summary ?? d.content ?? d.body).trim();
    if (t) base.summary.text = t;
  }

  const expSec = sectionByType(sorted, 'experience');
  const expData =
    expSec?.data !== null && typeof expSec?.data === 'object' && !Array.isArray(expSec.data)
      ? (expSec.data as Record<string, unknown>)
      : undefined;
  const expItemsRaw =
    coalesceItemsFromSectionData(expData, SECTION_ITEM_KEYS_EXP) ??
    (Array.isArray(expData?.items) ? expData.items : undefined);
  const useExpFromSections =
    Array.isArray(expItemsRaw) &&
    expItemsRaw.length > 0 &&
    sectionExperienceHasMeaningfulItems(expItemsRaw);
  if (useExpFromSections) {
    base.experience.items = (expItemsRaw as unknown[]).map((raw) => {
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        return mapExpItem(raw as Record<string, unknown>, str((raw as { id?: string }).id) || newLocalId());
      }
      return mapExpItem({}, newLocalId());
    });
  } else if (Array.isArray(st?.experience) && st.experience.length > 0) {
    base.experience.items = (st.experience as unknown[])
      .filter((e) => e !== null && typeof e === 'object' && !Array.isArray(e))
      .map((e) => {
        const raw = e as Record<string, unknown>;
        const bulletsRaw = Array.isArray(raw.bullets)
          ? raw.bullets
          : Array.isArray(raw.responsibilities)
            ? raw.responsibilities
            : Array.isArray(raw.achievements)
              ? raw.achievements
              : typeof raw.description === 'string'
                ? [raw.description]
                : [];
        return mapExpItem(
          {
            title: raw.title ?? raw.jobTitle ?? raw.role ?? raw.position ?? raw.designation,
            company: raw.company ?? raw.employer ?? raw.organization ?? raw.organisation ?? raw.companyName,
            location: raw.location ?? raw.city,
            startDate: raw.startDate ?? raw.start ?? raw.from ?? raw.startYear,
            endDate: raw.endDate ?? raw.end ?? raw.to ?? raw.endYear,
            current: raw.current ?? raw.isCurrent ?? raw.isPresent,
            bullets: bulletsRaw,
            duration: raw.duration,
          },
          newLocalId(),
        );
      })
      .filter((item) => item.title.trim().length > 0 || item.company.trim().length > 0);
  }

  const eduSec = sectionByType(sorted, 'education');
  const eduData =
    eduSec?.data !== null && typeof eduSec?.data === 'object' && !Array.isArray(eduSec.data)
      ? (eduSec.data as Record<string, unknown>)
      : undefined;
  const eduItemsRaw =
    coalesceItemsFromSectionData(eduData, SECTION_ITEM_KEYS_EDU) ??
    (Array.isArray(eduData?.items) ? eduData.items : undefined);
  const useEduFromSections =
    Array.isArray(eduItemsRaw) && eduItemsRaw.length > 0 && sectionEducationHasMeaningfulItems(eduItemsRaw);
  if (useEduFromSections) {
    base.education.items = (eduItemsRaw as unknown[]).map((raw) => {
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        return mapEduItem(raw as Record<string, unknown>, str((raw as { id?: string }).id) || newLocalId());
      }
      return mapEduItem({}, newLocalId());
    });
  } else if (Array.isArray(st?.education) && st.education.length > 0) {
    base.education.items = (st.education as unknown[])
      .filter((e) => e !== null && typeof e === 'object' && !Array.isArray(e))
      .map((e) => {
        const raw = e as Record<string, unknown>;
        return mapEduItem(
          {
            degree: raw.degree ?? raw.qualification ?? raw.certificate ?? raw.program ?? raw.award,
            field: raw.field ?? raw.major ?? raw.fieldOfStudy ?? raw.course ?? raw.subject,
            school: raw.school ?? raw.institution ?? raw.university ?? raw.college ?? raw.institute,
            startYear: raw.startYear ?? raw.start ?? raw.from ?? raw.startDate,
            endYear: raw.endYear ?? raw.year ?? raw.end ?? raw.to ?? raw.graduationYear ?? raw.endDate,
            grade: raw.grade ?? raw.gpa ?? raw.result ?? raw.classification ?? raw.honors ?? raw.honour,
            location: raw.location ?? raw.city,
          },
          newLocalId(),
        );
      })
      .filter((item) => item.school.trim().length > 0 || item.degree.trim().length > 0);
  }

  const skSec = sectionByType(sorted, 'skills');
  const useSkillsFromSections = skSec?.data && sectionSkillsHasMeaningfulData(skSec);
  if (useSkillsFromSections && skSec?.data) {
    const d = skSec.data;
    if (Array.isArray(d.skillCategories) && d.skillCategories.length > 0) {
      base.skills.categories = (d.skillCategories as { category?: string; items?: string[] }[])
        .filter((c) => c && Array.isArray(c.items) && c.items.length > 0)
        .map((c) => ({
          id: newLocalId(),
          name: String(c.category ?? 'Skills').trim(),
          skills: (c.items ?? []).filter((s): s is string => typeof s === 'string' && s.trim().length > 0),
        }))
        .filter((c) => c.skills.length > 0);
    } else if (Array.isArray(d.groups) && d.groups.length > 0) {
      base.skills.categories = (d.groups as unknown[])
        .filter((g): g is Record<string, unknown> => g !== null && typeof g === 'object' && !Array.isArray(g))
        .map((g) => ({
          id: newLocalId(),
          name: String(g.name ?? g.title ?? g.category ?? 'Skills').trim(),
          skills: (Array.isArray(g.skills) ? g.skills : Array.isArray(g.items) ? g.items : [])
            .filter((s): s is string => typeof s === 'string' && s.trim().length > 0),
        }))
        .filter((c) => c.skills.length > 0);
    } else if (Array.isArray(d.categories)) {
      base.skills.categories = (d.categories as unknown[]).map((c) => {
        if (!c || typeof c !== 'object')
          return { id: newLocalId(), name: '', skills: [] as string[] };
        const o = c as Record<string, unknown>;
        const id = str(o.id) || newLocalId();
        const name = str(o.name ?? o.title ?? '');
        const skills = Array.isArray(o.skills)
          ? o.skills.filter((x): x is string => typeof x === 'string')
          : Array.isArray(o.items)
            ? o.items.filter((x): x is string => typeof x === 'string')
            : [];
        return { id, name, skills };
      });
    } else if (Array.isArray(d.items)) {
      const items = d.items.filter((x): x is string => typeof x === 'string');
      base.skills.categories = [{ id: newLocalId(), name: '', skills: items }];
    }
  } else if (
    (Array.isArray(st?.skills) && st.skills.length > 0) ||
    (Array.isArray(st?.primarySkills) && st.primarySkills.length > 0) ||
    (Array.isArray((st as { skillCategories?: unknown })?.skillCategories) &&
      ((st as { skillCategories?: unknown[] }).skillCategories?.length ?? 0) > 0)
  ) {
    const stExt = st as Record<string, unknown>;

    if (
      Array.isArray(stExt.skillCategories) &&
      stExt.skillCategories.length > 0 &&
      typeof stExt.skillCategories[0] === 'object' &&
      stExt.skillCategories[0] !== null
    ) {
      base.skills.categories = (stExt.skillCategories as { category?: string; items?: string[] }[])
        .filter((c) => c.items && c.items.length > 0)
        .map((c) => ({
          id: newLocalId(),
          name: String(c.category ?? 'Skills').trim(),
          skills: (c.items ?? []).filter((s): s is string => typeof s === 'string' && s.trim().length > 0),
        }))
        .filter((c) => c.skills.length > 0);
    }

    if (
      base.skills.categories.length === 0 &&
      Array.isArray(st?.skills) &&
      st.skills.length > 0 &&
      typeof st.skills[0] === 'object' &&
      st.skills[0] !== null
    ) {
      base.skills.categories = (st.skills as unknown[])
        .filter((c): c is Record<string, unknown> => c !== null && typeof c === 'object' && !Array.isArray(c))
        .map((c) => ({
          id: newLocalId(),
          name: String(c.category ?? c.name ?? 'Skills').trim(),
          skills: (Array.isArray(c.items) ? c.items : Array.isArray(c.skills) ? c.skills : [])
            .filter((s): s is string => typeof s === 'string' && s.trim().length > 0),
        }))
        .filter((c) => c.skills.length > 0);
    }

    if (base.skills.categories.length === 0) {
      const flat = (st?.skills ?? []) as unknown[];
      const primary = (st?.primarySkills ?? []) as unknown[];
      const merged = [
        ...flat.filter((s): s is string => typeof s === 'string'),
        ...primary.filter((s): s is string => typeof s === 'string'),
      ];
      const unique = [...new Set(merged.map((s) => s.trim()).filter(Boolean))];
      if (unique.length > 0) {
        base.skills.categories = [{ id: newLocalId(), name: '', skills: unique }];
      }
    }
  }

  const linksSec = sectionByType(sorted, 'links');
  const linkItems = linksSec?.data?.items;
  if (Array.isArray(linkItems)) {
    for (const raw of linkItems) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
      const o = raw as Record<string, unknown>;
      const label = str(o.label).toLowerCase();
      const url = str(o.url ?? o.href ?? o.value);
      if (!url) continue;
      if (label.includes('linkedin')) base.personal.linkedin = base.personal.linkedin || url;
      else if (label.includes('github')) base.personal.github = base.personal.github || url;
      else if (label.includes('portfolio') || label.includes('website')) base.personal.portfolio = base.personal.portfolio || url;
    }
  }

  const customSlugSections = sorted.filter((s) => s.type.startsWith('custom_'));
  const hasCustomSlugSections = customSlugSections.length > 0;

  const customSec = !hasCustomSlugSections
    ? sorted.find((s) => s.type.toLowerCase() === 'custom')
    : undefined;
  if (customSec?.data?.items && Array.isArray(customSec.data.items)) {
    base.customSections = (customSec.data.items as Record<string, unknown>[]).map((o) => ({
      id: str(o.id) || newLocalId(),
      title: str(o.title),
      body: str(o.body ?? o.text ?? o.content),
    }));
  }

  const LEGACY_CUSTOM_TYPES = new Set(['publications', 'volunteering', 'interests']);
  const slugParsed = customSlugSections.map((s) => mapSectionToParsedCustom(s));
  const slugTitleKeys = new Set(
    slugParsed.map((b) => normalizedCustomSectionKey(b.title, b.sectionType)),
  );
  const legacyParsed = sorted
    .filter((s) => LEGACY_CUSTOM_TYPES.has(s.type.toLowerCase()))
    .filter((s) => {
      const block = mapSectionToParsedCustom(s);
      return !slugTitleKeys.has(normalizedCustomSectionKey(block.title, s.type));
    })
    .map((s) => mapSectionToParsedCustom(s));

  base.parsedCustomSections = filterReferenceUponRequestParsedBlocks([
    ...slugParsed,
    ...legacyParsed,
  ]);

  if (hasCustomSlugSections) {
    base.customSections = [];
  }

  for (const s of sorted) {
    const t = s.type.toLowerCase();
    if (t === 'projects' && s.data?.items && Array.isArray(s.data.items)) {
      base.projects = (s.data.items as Record<string, unknown>[]).map((o) => ({
        id: str(o.id) || newLocalId(),
        name: str(o.name ?? o.title),
        description: str(o.description),
        technologies: Array.isArray(o.technologies)
          ? o.technologies.filter((x): x is string => typeof x === 'string')
          : [],
        url: str(o.url),
        bullets: bulletsFromProjectRaw(o),
      }));
    }
    if (t === 'certifications' && s.data?.items && Array.isArray(s.data.items)) {
      base.certifications = (s.data.items as Record<string, unknown>[]).map((o) => ({
        id: str(o.id) || newLocalId(),
        name: str(o.name ?? o.title),
        issuer: str(o.issuer ?? o.issuingBody),
        date: str(o.date),
        url: str(o.url),
      }));
    }
    if (t === 'languages' && s.data?.items && Array.isArray(s.data.items)) {
      base.languages = (s.data.items as Record<string, unknown>[]).map((o) => {
        const rawProf =
          str(o.proficiency) || str(o.level) || str(o.fluency) || str(o.proficiencyLevel);
        const norm = rawProf.trim();
        const match = LANGUAGE_PROFICIENCY_LEVELS.find((l) => l.toLowerCase() === norm.toLowerCase());
        const proficiency = (match ?? '') as CVBuilderLanguage['proficiency'];
        const cefr = (key: string, alt?: string) => {
          const v = str(o[key]).trim() || (alt ? str(o[alt]).trim() : '');
          return v || undefined;
        };
        return {
          id: str(o.id) || newLocalId(),
          language: str(o.language ?? o.name ?? o.title),
          proficiency,
          listening: cefr('listening'),
          reading: cefr('reading'),
          spokenInteraction: cefr('spokenInteraction', 'spoken_interaction'),
          spokenProduction: cefr('spokenProduction', 'spoken_production'),
          writing: cefr('writing'),
        };
      });
    }
    if (t === 'achievements' && s.data?.items && Array.isArray(s.data.items)) {
      base.achievements = (s.data.items as Record<string, unknown>[]).map((o) => {
        const id = str((o as { id?: string }).id) || newLocalId();
        return {
          id,
          title: str(o.title ?? o.name ?? o.award),
          issuer: str(o.issuer ?? o.organization ?? o.issuingBody),
          date: str(o.date ?? o.year),
          detail: str(o.detail ?? o.note ?? o.description ?? o.notes),
        };
      });
    }
    if (t === 'references' && s.data?.items && Array.isArray(s.data.items)) {
      base.references = filterCvBuilderReferences(
        (s.data.items as Record<string, unknown>[]).map((o) => ({
          id: str((o as { id?: string }).id) || newLocalId(),
          name: str(o.name),
          title: str(o.title),
          company: str(o.company),
          email: str(o.email),
          phone: str(o.phone),
        })),
      );
    }
  }

  if (profile) {
    applyRawTextFallbackToBuilder(profile, base);
  }

  base.personal.website = sanitizeContactUrlField(base.personal.website);
  base.personal.portfolio = sanitizeContactUrlField(base.personal.portfolio);

  return base;
}

function normalizedCustomSectionKey(title: string, type: string): string {
  const fromTitle = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 36);
  if (fromTitle) return fromTitle;
  return type
    .toLowerCase()
    .replace(/^custom_?/, '')
    .replace(/_\d+$/, '');
}

function filterReferenceUponRequestParsedBlocks(
  blocks: CVBuilderParsedCustomSection[],
): CVBuilderParsedCustomSection[] {
  return blocks.filter((b) => {
    const title = b.title.trim().toLowerCase();
    const refLike = title === 'reference' || title === 'references';
    if (!refLike) return true;
    const blob = [
      b.title,
      ...b.items.map((i) => i.text),
      ...b.items.flatMap((i) => i.subItems),
    ]
      .join(' ')
      .toLowerCase();
    return !(
      /\bavailable\s+upon\s+request\b/.test(blob) ||
      /\breferences?\s+available\s+upon\s+request\b/.test(blob) ||
      /\bupon\s+request\b/.test(blob)
    );
  });
}

function stripExpId(items: CVBuilderExperienceItem[]): Record<string, unknown>[] {
  return items.map(({ id: _id, bullets, ...rest }) => ({
    ...rest,
    bullets: bullets
      .map((b) => (typeof b === 'string' ? b : String(b ?? '')).trim())
      .filter(Boolean),
  }));
}

/** Backend `@IsUrl()` — ensure scheme so bare domains validate. */
export function normalizeProfileWebsiteUrl(input: string): string {
  const t = input.trim().slice(0, 200);
  if (!t) return '';
  if (/^https?:\/\//i.test(t)) return t;
  if (/^[a-z][\w+.-]*:\/\//i.test(t)) return t;
  if (/^[\w.-]+\.[a-z]{2,}([\/?#].*)?$/i.test(t)) return `https://${t}`.slice(0, 200);
  return t;
}

function collapseAlternatingPathRepeat(parts: string[]): string[] {
  const out = [...parts];
  while (out.length >= 4) {
    const n = out.length;
    if (out[n - 4] === out[n - 2] && out[n - 3] === out[n - 1]) {
      out.pop();
      out.pop();
    } else {
      break;
    }
  }
  return out;
}

/**
 * Parser bugs can concatenate `/segment/segment` many times or paste an email onto the URL.
 * Used when hydrating website/portfolio from the API so previews stay readable.
 */
export function sanitizeContactUrlField(raw: string | undefined | null): string {
  let s = (raw ?? '').trim();
  if (!s) return '';
  s = s.replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\s*$/i, '').trim();
  if (!s) return '';

  /** Collapse `/a/b/a/b/...` glue (parser duplicates path pairs; no spaces so a naive URL regex cannot split). */
  let prev = '';
  while (prev !== s) {
    prev = s;
    s = s.replace(/(\/[^/]+\/[^/]+)(\1)+/gi, '$1');
  }

  const hadScheme = /^https?:\/\//i.test(s);
  const withScheme = hadScheme ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    const parts = u.pathname.split('/').filter(Boolean);
    const collapsed = collapseAlternatingPathRepeat(parts);
    u.pathname = collapsed.length ? `/${collapsed.join('/')}` : '/';
    let out = u.href;
    if (!hadScheme) {
      out = out.replace(/^https:\/\//i, '');
    }
    return out.replace(/\/+$/, '').slice(0, 500);
  } catch {
    const t = s.length > 2048 ? s.slice(0, 2048) : s;
    try {
      const u = new URL(t.startsWith('http') ? t : `https://${t}`);
      const parts = u.pathname.split('/').filter(Boolean);
      const collapsed = collapseAlternatingPathRepeat(parts);
      u.pathname = collapsed.length ? `/${collapsed.join('/')}` : '/';
      let out = u.href;
      if (!hadScheme) out = out.replace(/^https:\/\//i, '');
      return out.replace(/\/+$/, '').slice(0, 500);
    } catch {
      const origin = s.match(/^https?:\/\/[^/\s?#]+/i)?.[0] ?? '';
      return (origin || s).slice(0, 500);
    }
  }
}

/**
 * PDF/DOCX export reads stored profile + section rows. Sanitize bloated URLs before download:
 * top-level `website`, `structured` contact fields, and `links` section items (export often mirrors DB, not the in-memory preview).
 */
export async function patchSanitizedContactUrlsForExport(cvProfileId: string): Promise<void> {
  const id = cvProfileId.trim();
  if (!id) return;

  let detail: Awaited<ReturnType<typeof api.cv.getProfileById>>;
  try {
    detail = await api.cv.getProfileById(id);
  } catch {
    return;
  }

  const profile = detail.profile;
  const st = profile.structured as Record<string, unknown> | undefined;
  const rawW = profile.website?.trim() ?? '';
  const rawPf = str(st?.portfolio).trim();
  const rawLi = str(st?.linkedin).trim();
  const rawGh = str(st?.github).trim();

  const sw = sanitizeContactUrlField(rawW);
  const spf = sanitizeContactUrlField(rawPf);
  const sli = sanitizeContactUrlField(rawLi);
  const sgh = sanitizeContactUrlField(rawGh);

  const payload: Parameters<typeof api.cv.patchProfilesEntry>[1] = {};

  if (sw !== rawW) {
    if (sw) {
      const normalized = normalizeProfileWebsiteUrl(sw);
      payload.website = normalized || sw;
    } else {
      payload.website = null;
    }
  }

  if (spf !== rawPf || sli !== rawLi || sgh !== rawGh) {
    payload.structured = {
      ...(typeof st === 'object' && st !== null && !Array.isArray(st) ? st : {}),
      ...(spf !== rawPf ? { portfolio: spf } : {}),
      ...(sli !== rawLi ? { linkedin: sli.slice(0, 500) } : {}),
      ...(sgh !== rawGh ? { github: sgh.slice(0, 500) } : {}),
    } as CVProfile['structured'];
  }

  if (Object.keys(payload).length > 0) {
    try {
      await api.cv.patchProfilesEntry(id, payload);
    } catch {
      /* continue — try links sections */
    }
  }

  for (const section of detail.sections) {
    if (section.type?.toLowerCase() !== 'links') continue;
    const d = section.data;
    if (!d || typeof d !== 'object' || Array.isArray(d)) continue;
    const items = d.items;
    if (!Array.isArray(items)) continue;

    let changed = false;
    const nextItems = items.map((raw) => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
      const o = raw as Record<string, unknown>;
      const rawUrl = str(o.url || o.href || o.value).trim();
      if (!rawUrl) return raw;
      const cleaned = sanitizeContactUrlField(rawUrl);
      if (cleaned === rawUrl) return raw;
      changed = true;
      const out = { ...o } as Record<string, unknown>;
      if (typeof o.url === 'string') out.url = cleaned;
      if (typeof o.href === 'string') out.href = cleaned;
      if (typeof o.value === 'string') out.value = cleaned;
      return out;
    });

    if (!changed) continue;

    try {
      await api.cv.updateSection(section.id, { data: { ...d, items: nextItems } }, id);
    } catch {
      /* export still proceeds */
    }
  }
}

export type CvProfilePatchPayload = {
  headline?: string | null;
  phone?: string | null;
  location?: string | null;
  website?: string | null;
  template?: string;
  structured?: Record<string, unknown>;
};

/**
 * PATCH /cv/profile — UpdateCvProfileDto: top-level headline/location/phone/website/template;
 * linkedin, github, extras live under `structured` (shallow merge).
 */
export function buildCvProfilePatch(
  data: CVBuilderData,
  template?: CvTemplateId,
): CvProfilePatchPayload {
  const p = data.personal;
  const patch: CvProfilePatchPayload = {};
  const nm = p.name?.trim();
  const h = p.headline?.trim();
  const hn = h ? normalizeProfessionalHeadlineTitle(h) : '';
  patch.headline = hn ? hn.slice(0, 120) : null;
  const ph = p.phone?.trim();
  patch.phone = ph ? ph.slice(0, 20) : null;
  const loc = p.location?.trim();
  patch.location = loc ? loc.slice(0, 100) : null;
  const w = sanitizeContactUrlField(p.website ?? '');
  if (w) {
    const normalized = normalizeProfileWebsiteUrl(w);
    patch.website = normalized || null;
  } else {
    patch.website = null;
  }
  if (template && isCvTemplateId(template)) {
    patch.template = template;
  }

  const structured: Record<string, unknown> = {};
  if (nm) {
    structured.fullName = nm.slice(0, 120);
    structured.name = nm.slice(0, 120);
  }
  const em = p.email?.trim();
  if (em) {
    structured.email = em.slice(0, 180);
    structured.contactEmail = em.slice(0, 180);
  }
  const li = p.linkedin?.trim();
  if (li) structured.linkedin = li.slice(0, 500);
  const gh = p.github?.trim();
  if (gh) structured.github = gh.slice(0, 500);
  const pf = sanitizeContactUrlField(p.portfolio ?? '');
  if (pf) structured.portfolio = pf.slice(0, 500);
  const extras = p.extras
    .map((e) => ({ label: e.label.trim(), value: e.value.trim() }))
    .filter((e) => e.label || e.value);
  if (extras.length) structured.extras = extras;

  if (p.dateOfBirth?.trim()) structured.dateOfBirth = p.dateOfBirth.trim();
  if (p.placeOfBirth?.trim()) structured.placeOfBirth = p.placeOfBirth.trim();
  if (p.nationality?.trim()) structured.nationality = p.nationality.trim();
  if (p.gender?.trim()) structured.gender = p.gender.trim();
  if (p.maritalStatus?.trim()) structured.maritalStatus = p.maritalStatus.trim();
  if (p.drivingLicence?.trim()) structured.drivingLicence = p.drivingLicence.trim();
  if (p.photoUrl?.trim()) structured.photoUrl = p.photoUrl.trim();
  if (p.hobbies?.trim()) structured.hobbies = p.hobbies.trim();
  if (data.summary.text?.trim()) structured.summary = data.summary.text.trim();

  structured.references = filterCvBuilderReferences(data.references ?? []).map(({ id: _id, ...r }) => ({
    name: r.name.trim(),
    title: r.title.trim(),
    company: r.company.trim(),
    email: r.email.trim(),
    phone: r.phone.trim(),
  }));

  if (Object.keys(structured).length) patch.structured = structured;
  return patch;
}

/** Onyx template picker thumbnail — matches the Olivia Schumacher reference layout. */
export function cvOnyxTemplatePreviewSampleData(): CVBuilderData {
  return {
    personal: {
      name: 'Olivia Schumacher',
      email: 'hello@reallygreatsite.com',
      phone: '+123-456-7890',
      location: '123 Anywhere St., Any City',
      headline: 'Business Consultant',
      website: '',
      linkedin: '',
      github: '',
      portfolio: '',
      extras: [],
      dateOfBirth: '',
      placeOfBirth: '',
      nationality: '',
      gender: '',
      maritalStatus: '',
      drivingLicence: '',
      photoUrl: '',
      hobbies: '',
    },
    summary: {
      text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam quis nostrud exercitation.',
    },
    experience: {
      items: [
        {
          id: 'ox-e1',
          title: 'Business Consultant',
          company: 'Aldenaire & Partners',
          location: '',
          startDate: '2020-01',
          endDate: '',
          current: true,
          bullets: [
            'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
          ],
        },
        {
          id: 'ox-e2',
          title: 'Business Consultant',
          company: 'Aldenaire & Partners',
          location: '',
          startDate: '2015-01',
          endDate: '2020-01',
          current: false,
          bullets: [
            'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
          ],
        },
        {
          id: 'ox-e3',
          title: 'Business Consultant',
          company: 'Aldenaire & Partners',
          location: '',
          startDate: '2010-01',
          endDate: '2015-01',
          current: false,
          bullets: [
            'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
          ],
        },
        {
          id: 'ox-e4',
          title: 'Business Consultant',
          company: 'Aldenaire & Partners',
          location: '',
          startDate: '2006-01',
          endDate: '2010-01',
          current: false,
          bullets: [
            'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
          ],
        },
      ],
    },
    education: {
      items: [
        {
          id: 'ox-ed1',
          degree: 'Master of Business Management',
          field: '',
          school: 'Wardiere University',
          startYear: '2006-09',
          endYear: '2008-06',
          grade: '',
        },
        {
          id: 'ox-ed2',
          degree: 'Bachelor of Business Management',
          field: '',
          school: 'Wardiere University',
          startYear: '2002-09',
          endYear: '2006-06',
          grade: '',
        },
      ],
    },
    skills: {
      categories: [
        {
          id: 'ox-sk1',
          name: '',
          skills: [
            'Management Skills',
            'Creativity',
            'Digital Marketing',
            'Negotiation',
            'Critical Thinking',
            'Leadership',
          ],
        },
      ],
    },
    projects: [],
    certifications: [],
    languages: [],
    achievements: [],
    references: [
      {
        id: 'ox-r1',
        name: 'Estelle Darcy',
        title: 'CEO',
        company: 'Wardiere Inc.',
        email: 'hello@reallygreatsite.com',
        phone: '+123-456-7890',
      },
      {
        id: 'ox-r2',
        name: 'Harper Richard',
        title: 'CEO',
        company: 'Wardiere Inc.',
        email: 'hello@reallygreatsite.com',
        phone: '+123-456-7890',
      },
    ],
    customSections: [],
    parsedCustomSections: [],
  };
}

/** Rich sample CV for template picker thumbnails */
export function cvTemplatePreviewSampleData(): CVBuilderData {
  return {
    personal: {
      name: 'Alex Morgan',
      email: 'alex.morgan@email.com',
      phone: '+1 555 010 2030',
      location: 'London, UK',
      headline: 'Product Designer',
      website: '',
      linkedin: '',
      github: '',
      portfolio: '',
      extras: [],
      dateOfBirth: '14 March 1990',
      placeOfBirth: 'London, UK',
      nationality: 'British',
      gender: 'Male',
      maritalStatus: 'Single',
      drivingLicence: 'B',
      photoUrl: '',
      hobbies: 'Hiking, Photography, Open-source development',
    },
    summary: {
      text: 'Product designer with 6+ years shipping user-centred flows for B2B SaaS. Focused on research, systems, and measurable uplift in activation.',
    },
    experience: {
      items: [
        {
          id: 's1',
          title: 'Senior Product Designer',
          company: 'Northwind Labs',
          location: 'Remote',
          startDate: '2021-03',
          endDate: '',
          current: true,
          bullets: [
            'Led design system used by 12 squads, cutting build time for new features by roughly 30%.',
            'Partnered with PM and engineering on roadmap; shipped onboarding refresh that lifted activation 18%.',
          ],
        },
      ],
    },
    education: {
      items: [
        {
          id: 'e1',
          degree: 'BSc Computer Science',
          field: 'Human–Computer Interaction',
          school: 'University of Example',
          startYear: '2014-09',
          endYear: '2018-06',
          grade: '',
        },
      ],
    },
    skills: {
      categories: [
        { id: 'sk1', name: 'Cloud Platforms', skills: ['AWS', 'Azure', 'GCP'] },
        { id: 'sk2', name: 'Environments', skills: ['Linux', 'Windows'] },
        { id: 'sk3', name: 'Languages', skills: ['Bash', 'JavaScript', 'Python'] },
        { id: 'sk4', name: 'Versioning', skills: ['Git', 'Azure DevOps'] },
      ],
    },
    projects: [],
    certifications: [],
    languages: [
      {
        id: 'l1',
        language: 'English',
        proficiency: 'Native',
        listening: 'C2',
        reading: 'C2',
        spokenInteraction: 'C2',
        spokenProduction: 'C2',
        writing: 'C2',
      },
      {
        id: 'l2',
        language: 'French',
        proficiency: 'Professional',
        listening: 'B2',
        reading: 'B2',
        spokenInteraction: 'B1',
        spokenProduction: 'B1',
        writing: 'B2',
      },
    ],
    achievements: [],
    references: [
      {
        id: 'r1',
        name: 'Jane Smith',
        title: 'Engineering Manager',
        company: 'Northwind Labs',
        email: 'jane.smith@northwindlabs.com',
        phone: '+44 20 7946 0321',
      },
    ],
    customSections: [],
    parsedCustomSections: [],
  };
}

/** Template-specific thumbnail sample (Onyx uses its own reference layout). */
export function cvTemplatePreviewSampleDataFor(template: CvTemplateId): CVBuilderData {
  if (template === 'onyx') return cvOnyxTemplatePreviewSampleData();
  return cvTemplatePreviewSampleData();
}

function stripEduId(items: CVBuilderEducationItem[]): Record<string, unknown>[] {
  return items.map(({ id: _id, ...rest }) => ({ ...rest }));
}

/** PDF / importers sometimes use arrays instead of a single `bullets` string. */
function bulletsFromProjectRaw(o: Record<string, unknown>): string {
  if (Array.isArray(o.bullets)) {
    const arr = (o.bullets as unknown[]).filter((x): x is string => typeof x === 'string');
    if (arr.length) return arr.map((s) => s.trim()).filter(Boolean).join('\n');
  }
  const direct = str(o.bullets);
  if (direct) return direct;
  for (const key of ['activities', 'highlights', 'bulletPoints', 'achievements'] as const) {
    const arr = o[key];
    if (Array.isArray(arr)) {
      const lines = arr
        .filter((x): x is string => typeof x === 'string')
        .map((s) => s.trim())
        .filter(Boolean);
      if (lines.length) return lines.join('\n');
    }
  }
  return '';
}

function projectBulletLinesForSave(bullets: string): string[] {
  const lines = bullets.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length > 0) return lines.map((b) => b.replace(/^[-•]\s*/, ''));
  const t = bullets.trim().replace(/^[-•]\s*/, '');
  return t ? [t] : [];
}

/** Nest / PDF may use different keys (`activities`, `title`, merged `content`, etc.). */
function projectToSectionPayload(p: CVBuilderProject): Record<string, unknown> {
  const lines = projectBulletLinesForSave(p.bullets ?? '');
  const bulletsStr = p.bullets ?? '';
  const techJoined = p.technologies.filter(Boolean).join(', ');
  const detailsBlock = [p.description?.trim(), lines.map((x) => `• ${x}`).join('\n'), techJoined]
    .filter(Boolean)
    .join('\n\n');
  return {
    title: p.name,
    name: p.name,
    projectName: p.name,
    description: p.description,
    summary: p.description,
    technologies: p.technologies,
    techStack: p.technologies,
    stack: techJoined,
    url: p.url,
    link: p.url,
    website: p.url,
    bullets: bulletsStr,
    highlights: lines,
    activities: lines,
    bulletPoints: lines,
    achievements: lines,
    keyAchievements: lines,
    details: detailsBlock,
    content: detailsBlock,
    fullText: detailsBlock,
    body: bulletsStr.trim() || detailsBlock,
  };
}

function languageToSectionPayload(l: CVBuilderLanguage): Record<string, unknown> {
  const lang = l.language.trim();
  const prof = l.proficiency;
  const out: Record<string, unknown> = {
    language: lang,
    name: lang,
    proficiency: prof,
    level: prof,
    fluency: prof,
  };
  if (l.listening?.trim()) out.listening = l.listening.trim();
  if (l.reading?.trim()) out.reading = l.reading.trim();
  if (l.spokenInteraction?.trim()) out.spokenInteraction = l.spokenInteraction.trim();
  if (l.spokenProduction?.trim()) out.spokenProduction = l.spokenProduction.trim();
  if (l.writing?.trim()) out.writing = l.writing.trim();
  return out;
}

function nextOrder(sections: CVSectionRecord[]): number {
  return sections.reduce((m, s) => Math.max(m, s.order), 0) + 1;
}

function findSectionByTypeLoose(mutable: CVSectionRecord[], type: string): CVSectionRecord | undefined {
  const t = type.toLowerCase();
  return mutable.find((s) => s.type.toLowerCase() === t);
}

/** Deterministic JSON for save fingerprinting (canonical compare). */
export function stableStringify(value: unknown): string {
  if (value === null) return 'null';
  const typ = typeof value;
  if (typ === 'number' || typ === 'boolean') return JSON.stringify(value);
  if (typ === 'string') return JSON.stringify(value);
  if (typ !== 'object') return JSON.stringify(String(value));
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

export type SaveCVBuilderDataResult = {
  usedBatch: boolean;
  /** Client attempted a non-empty profile PATCH body (server may still no-op). */
  profilePatched: boolean;
  sections?: CVSectionRecord[];
  batch?: { updated: number; unchanged: number };
};

/** CV Builder autosave / toolbar status (Phase 4 — extended states). */
export type CvBuilderSaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export function logCvBuilderSavePerfDev(
  label: string,
  startedAt: number,
  detail?: Record<string, unknown>,
): void {
  if (process.env.NODE_ENV !== 'development') return;
  const ms = Math.round(performance.now() - startedAt);
  // eslint-disable-next-line no-console -- intentional dev diagnostics
  console.info('[cv:builder-save]', { label, ms, ...detail });
  if (label.includes('autosave')) {
    logCvDevPerf('cv.autosave', startedAt, { subLabel: label, ...detail });
  }
  if (label.includes('hydrate')) {
    logCvDevPerf('cv.builderHydration', startedAt, { subLabel: label, ...detail });
  }
}

function normalizeSectionOrder(order: unknown): number {
  if (order == null || order === '') return 0;
  const n = typeof order === 'number' ? order : typeof order === 'string' ? parseFloat(order) : NaN;
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

function buildCvBuilderBatchSectionEntries(
  data: CVBuilderData,
  template: CvTemplateId | undefined,
  mutable: CVSectionRecord[],
): CvBatchUpsertSectionInput[] {
  const entries: CvBatchUpsertSectionInput[] = [];
  const pushEntry = (type: string, payload: Record<string, unknown>, opts?: { includeWhenEmpty?: boolean }) => {
    if (!opts?.includeWhenEmpty && Object.keys(payload).length === 0) return;
    const row = findSectionByTypeLoose(mutable, type);
    const order = normalizeSectionOrder(row?.order ?? nextOrder(mutable));
    const visible = row ? row.hidden !== true : true;
    const id = row?.id?.trim() || undefined;
    entries.push({
      id,
      type: type.toLowerCase(),
      order,
      visible,
      data: payload,
    });
  };

  pushEntry('summary', { text: data.summary.text });
  pushEntry('experience', { items: stripExpId(data.experience.items) });
  pushEntry('education', { items: stripEduId(data.education.items) });
  pushEntry('skills', {
    categories: data.skills.categories.map(({ name, skills }) => ({ name, skills })),
  });

  if (data.projects.length > 0 || findSectionByTypeLoose(mutable, 'projects')) {
    pushEntry(
      'projects',
      { items: data.projects.map(projectToSectionPayload) },
      { includeWhenEmpty: true },
    );
  }
  if (data.certifications.length > 0 || findSectionByTypeLoose(mutable, 'certifications')) {
    pushEntry(
      'certifications',
      { items: data.certifications.map(({ id: _i, ...p }) => p) },
      { includeWhenEmpty: true },
    );
  }
  if (data.languages.length > 0 || findSectionByTypeLoose(mutable, 'languages')) {
    pushEntry(
      'languages',
      { items: data.languages.map(languageToSectionPayload) },
      { includeWhenEmpty: true },
    );
  }
  if (data.achievements.length > 0 || findSectionByTypeLoose(mutable, 'achievements')) {
    pushEntry(
      'achievements',
      { items: data.achievements.map(achievementToSectionPayload) },
      { includeWhenEmpty: true },
    );
  }
  if (data.references.length > 0 || findSectionByTypeLoose(mutable, 'references')) {
    pushEntry(
      'references',
      { items: filterCvBuilderReferences(data.references).map(({ id: _i, ...r }) => r) },
      { includeWhenEmpty: true },
    );
  }
  const hasCustomSlugRows = mutable.some((s) => s.type.startsWith('custom_'));
  if (data.customSections.length > 0 && !hasCustomSlugRows) {
    pushEntry(
      'custom',
      { items: data.customSections.map(({ id: _i, title, body }) => ({ title, body })) },
      { includeWhenEmpty: true },
    );
  }

  for (const block of data.parsedCustomSections) {
    if (!block.sectionId?.trim()) continue;
    const row = mutable.find((s) => s.id === block.sectionId.trim());
    if (!row?.type) continue;
    const payload = {
      title: block.title,
      items: block.items.map(parsedCustomItemToPayload),
    };
    if (Object.keys(payload).length === 0) continue;
    entries.push({
      id: row.id?.trim() || undefined,
      type: row.type.toLowerCase(),
      order: normalizeSectionOrder(row.order ?? nextOrder(mutable)),
      visible: row.hidden !== true,
      data: payload,
    });
  }

  entries.sort((a, b) => {
    const ao = a.order ?? 0;
    const bo = b.order ?? 0;
    return ao - bo || a.type.localeCompare(b.type);
  });
  return entries;
}

/** Canonical fingerprint of persisted CV builder state (profile patch + section upsert payloads). */
export function computeCvBuilderSaveFingerprint(
  data: CVBuilderData,
  template: CvTemplateId | undefined,
  mutable: CVSectionRecord[],
): string {
  const profilePatch = buildCvProfilePatch(data, template);
  const entries = buildCvBuilderBatchSectionEntries(data, template, mutable);
  return stableStringify({ profilePatch, entries });
}

function isBatchUpsertRouteUnsupportedError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const ax = e as { response?: { status?: number } };
  const st = ax.response?.status;
  return st === 404 || st === 405;
}

async function persistCvBuilderSectionsSequential(
  data: CVBuilderData,
  mutable: CVSectionRecord[],
  cvProfileId?: string,
): Promise<void> {
  await upsertSectionData(mutable, 'summary', { text: data.summary.text }, cvProfileId);
  await upsertSectionData(mutable, 'experience', { items: stripExpId(data.experience.items) }, cvProfileId);
  await upsertSectionData(mutable, 'education', { items: stripEduId(data.education.items) }, cvProfileId);
  await upsertSectionData(
    mutable,
    'skills',
    {
      categories: data.skills.categories.map(({ name, skills }) => ({ name, skills })),
    },
    cvProfileId,
  );

  if (data.projects.length || mutable.some((s) => s.type.toLowerCase() === 'projects')) {
    await upsertSectionData(
      mutable,
      'projects',
      {
        items: data.projects.map(projectToSectionPayload),
      },
      cvProfileId,
    );
  }
  if (data.certifications.length || mutable.some((s) => s.type.toLowerCase() === 'certifications')) {
    await upsertSectionData(
      mutable,
      'certifications',
      {
        items: data.certifications.map(({ id: _i, ...p }) => p),
      },
      cvProfileId,
    );
  }
  if (data.languages.length || mutable.some((s) => s.type.toLowerCase() === 'languages')) {
    await upsertSectionData(
      mutable,
      'languages',
      {
        items: data.languages.map(languageToSectionPayload),
      },
      cvProfileId,
    );
  }
  if (data.achievements.length || mutable.some((s) => s.type.toLowerCase() === 'achievements')) {
    await upsertSectionData(
      mutable,
      'achievements',
      {
        items: data.achievements.map(achievementToSectionPayload),
      },
      cvProfileId,
    );
  }
  if (data.references.length || mutable.some((s) => s.type.toLowerCase() === 'references')) {
    await upsertSectionData(
      mutable,
      'references',
      { items: filterCvBuilderReferences(data.references).map(({ id: _i, ...r }) => r) },
      cvProfileId,
    );
  }
  if (data.customSections.length) {
    await upsertSectionData(
      mutable,
      'custom',
      {
        items: data.customSections.map(({ id: _i, title, body }) => ({ title, body })),
      },
      cvProfileId,
    );
  }

  for (const block of data.parsedCustomSections) {
    if (!block.sectionId?.trim()) continue;
    try {
      await api.cv.updateSection(
        block.sectionId,
        {
          data: {
            title: block.title,
            items: block.items.map(parsedCustomItemToPayload),
          },
        },
        cvProfileId,
      );
    } catch {
      /* section may have been removed server-side */
    }
  }
}

/**
 * Backend POST /cv/sections only creates optional bucket rows.
 * Core sections (summary, experience, …) come from parse / sync-from-structured — never POST those types here.
 */
const SECTION_TYPES_CREATABLE_VIA_POST = new Set(['projects', 'certifications', 'languages']);

async function upsertSectionData(
  mutableSections: CVSectionRecord[],
  type: string,
  sectionPayload: Record<string, unknown>,
  cvProfileId?: string,
): Promise<void> {
  const found = mutableSections.find((s) => s.type.toLowerCase() === type.toLowerCase());
  if (found?.id) {
    await api.cv.updateSection(found.id, { data: sectionPayload }, cvProfileId);
    return;
  }
  if (!SECTION_TYPES_CREATABLE_VIA_POST.has(type.toLowerCase())) {
    return;
  }
  try {
    const created = await api.cv.addSection({ type, order: nextOrder(mutableSections) }, cvProfileId);
    mutableSections.push(created);
    if (created.id) {
      await api.cv.updateSection(created.id, { data: sectionPayload }, cvProfileId);
    }
  } catch (e) {
    /**
     * Backend uses unique (cvProfileId, type) — when a row already exists (often hidden because user
     * deleted it earlier), find it and patch data ONLY. Never auto-unhide here; that would resurrect
     * sections the user intentionally hid.
     */
    if (cvProfileId?.trim()) {
      try {
        const all = await api.cv.getSections(true, cvProfileId);
        const existing = all.find((s) => s.type.toLowerCase() === type.toLowerCase());
        if (existing?.id) {
          mutableSections.push(existing);
          if (existing.hidden !== true) {
            await api.cv.updateSection(existing.id, { data: sectionPayload }, cvProfileId);
          }
          return;
        }
      } catch {
        /* fall through to throw original error */
      }
    }
    throw e;
  }
}

function achievementToSectionPayload(a: CVBuilderAchievement): Record<string, unknown> {
  return {
    title: a.title,
    name: a.title,
    issuer: a.issuer,
    organization: a.issuer,
    date: a.date,
    detail: a.detail,
    note: a.detail,
    description: a.detail,
  };
}

function parsedCustomItemToPayload(i: CVBuilderParsedCustomItem): Record<string, unknown> {
  return {
    id: i.id,
    text: i.text,
    date: i.date,
    subItems: i.subItems,
  };
}

/** One segment of backend spellcheck `fieldPath` (e.g. `items[0].bullets[1]`). */
export type CvSectionFieldPathStep = { key: string; index?: number };

export function parseCvSectionFieldPath(fieldPath: string): CvSectionFieldPathStep[] {
  if (!fieldPath.trim()) return [];
  return fieldPath
    .split('.')
    .map((seg) => {
      const m = seg.match(/^([^[\]]+)(?:\[(\d+)\])?$/);
      if (!m) return null;
      return m[2] !== undefined ? { key: m[1]!, index: Number(m[2]) } : { key: m[1]! };
    })
    .filter((x): x is CvSectionFieldPathStep => x !== null);
}

function getSectionRootPlain(sectionKey: string, data: CVBuilderData): Record<string, unknown> | null {
  switch (sectionKey) {
    case 'summary':
      return { text: data.summary.text };
    case 'experience':
      return JSON.parse(JSON.stringify({ items: data.experience.items })) as Record<string, unknown>;
    case 'education':
      return JSON.parse(JSON.stringify({ items: data.education.items })) as Record<string, unknown>;
    case 'skills':
      return JSON.parse(JSON.stringify({ categories: data.skills.categories })) as Record<string, unknown>;
    case 'projects':
      return JSON.parse(JSON.stringify({ items: data.projects })) as Record<string, unknown>;
    case 'achievements':
      return JSON.parse(JSON.stringify({ items: data.achievements })) as Record<string, unknown>;
    case 'certifications':
      return JSON.parse(JSON.stringify({ items: data.certifications })) as Record<string, unknown>;
    case 'languages':
      return JSON.parse(JSON.stringify({ items: data.languages })) as Record<string, unknown>;
    case 'references':
      return JSON.parse(JSON.stringify({ items: data.references })) as Record<string, unknown>;
    case 'custom-legacy':
      return JSON.parse(JSON.stringify({ items: data.customSections })) as Record<string, unknown>;
    default:
      if (sectionKey.startsWith('parsed-')) {
        const sid = sectionKey.slice('parsed-'.length);
        const block = data.parsedCustomSections.find((b) => b.sectionId === sid);
        return block
          ? (JSON.parse(JSON.stringify({ title: block.title, items: block.items })) as Record<string, unknown>)
          : null;
      }
      return null;
  }
}

function readValueAtSteps(root: unknown, steps: CvSectionFieldPathStep[]): unknown {
  let cur: unknown = root;
  for (const s of steps) {
    if (cur === null || typeof cur !== 'object') return undefined;
    const o = cur as Record<string, unknown>;
    cur = o[s.key];
    if (s.index !== undefined) {
      if (!Array.isArray(cur) || s.index < 0 || s.index >= cur.length) return undefined;
      cur = cur[s.index];
    }
  }
  return cur;
}

function writeValueAtSteps(root: Record<string, unknown>, steps: CvSectionFieldPathStep[], value: string): Record<string, unknown> {
  if (steps.length === 0) return root;
  const [head, ...rest] = steps;
  if (head.index === undefined) {
    if (rest.length === 0) return { ...root, [head.key]: value };
    const child = root[head.key];
    const childObj =
      child && typeof child === 'object' && !Array.isArray(child) ? (child as Record<string, unknown>) : {};
    return { ...root, [head.key]: writeValueAtSteps(childObj, rest, value) };
  }
  const arrRaw = root[head.key];
  const arr = Array.isArray(arrRaw) ? [...arrRaw] : [];
  const idx = head.index;
  if (rest.length === 0) {
    const nextArr = [...arr];
    nextArr[idx] = value;
    return { ...root, [head.key]: nextArr };
  }
  const child = arr[idx];
  const childObj =
    child && typeof child === 'object' && !Array.isArray(child) ? (child as Record<string, unknown>) : {};
  const nextArr = [...arr];
  nextArr[idx] = writeValueAtSteps(childObj, rest, value);
  return { ...root, [head.key]: nextArr };
}

function mergeSectionRootIntoData(data: CVBuilderData, sectionKey: string, nextRoot: Record<string, unknown>): CVBuilderData {
  if (sectionKey === 'summary') {
    return { ...data, summary: { text: normalizeText(nextRoot.text) } };
  }
  if (sectionKey === 'experience') {
    return { ...data, experience: { items: nextRoot.items as CVBuilderData['experience']['items'] } };
  }
  if (sectionKey === 'education') {
    return { ...data, education: { items: nextRoot.items as CVBuilderData['education']['items'] } };
  }
  if (sectionKey === 'skills') {
    return { ...data, skills: { categories: nextRoot.categories as CVBuilderData['skills']['categories'] } };
  }
  if (sectionKey === 'projects') {
    return { ...data, projects: nextRoot.items as CVBuilderData['projects'] };
  }
  if (sectionKey === 'achievements') {
    return { ...data, achievements: nextRoot.items as CVBuilderData['achievements'] };
  }
  if (sectionKey === 'certifications') {
    return { ...data, certifications: nextRoot.items as CVBuilderData['certifications'] };
  }
  if (sectionKey === 'languages') {
    return { ...data, languages: nextRoot.items as CVBuilderData['languages'] };
  }
  if (sectionKey === 'references') {
    return { ...data, references: nextRoot.items as CVBuilderData['references'] };
  }
  if (sectionKey === 'custom-legacy') {
    return { ...data, customSections: nextRoot.items as CVBuilderData['customSections'] };
  }
  if (sectionKey.startsWith('parsed-')) {
    const sid = sectionKey.slice('parsed-'.length);
    return {
      ...data,
      parsedCustomSections: data.parsedCustomSections.map((b) =>
        b.sectionId === sid
          ? {
              ...b,
              title: String(nextRoot.title ?? b.title),
              items: nextRoot.items as CVBuilderParsedCustomSection['items'],
            }
          : b,
      ),
    };
  }
  return data;
}

/** Read the string at `fieldPath` for the section accordion key (matches spellcheck / PATCH section payloads). */
export function getCvBuilderSectionFieldText(data: CVBuilderData, sectionKey: string, fieldPath: string): string {
  const root = getSectionRootPlain(sectionKey, data);
  if (!root) return '';
  const steps = parseCvSectionFieldPath(fieldPath);
  const v = readValueAtSteps(root, steps);
  return typeof v === 'string' ? v : '';
}

/** Immutable update of one string field (same path convention as spellcheck apply). */
export function setCvBuilderSectionFieldText(
  data: CVBuilderData,
  sectionKey: string,
  fieldPath: string,
  value: string,
): CVBuilderData {
  const root = getSectionRootPlain(sectionKey, data);
  if (!root) return data;
  const steps = parseCvSectionFieldPath(fieldPath);
  const nextRoot = writeValueAtSteps(root, steps, value);
  return mergeSectionRootIntoData(data, sectionKey, nextRoot);
}

export async function saveCVBuilderData(
  data: CVBuilderData,
  existingSections: CVSectionRecord[],
  opts?: { template?: CvTemplateId; cvProfileId?: string },
): Promise<SaveCVBuilderDataResult> {
  const result: SaveCVBuilderDataResult = { usedBatch: false, profilePatched: false };
  let mutable = [...existingSections];
  const cvProfileId = opts?.cvProfileId?.trim();

  if (cvProfileId) {
    const coreTypes = ['summary', 'experience', 'education', 'projects', 'skills'] as const;
    const missingCore = coreTypes.some((t) => !mutable.some((s) => s.type.toLowerCase() === t));
    if (missingCore) {
      try {
        await api.cv.syncCoreSectionsFromStructured(cvProfileId);
        mutable = await api.cv.getSections(true, cvProfileId);
      } catch {
        /* keep caller snapshot */
      }
    }
  }

  const profilePatch = buildCvProfilePatch(data, opts?.template);
  result.profilePatched = Object.keys(profilePatch).length > 0;
  if (Object.keys(profilePatch).length > 0) {
    try {
      if (cvProfileId) {
        await api.cv.patchProfilesEntry(
          cvProfileId,
          profilePatch as Parameters<typeof api.cv.patchProfilesEntry>[1],
        );
      } else {
        await api.cv.patchProfile(profilePatch as Parameters<typeof api.cv.patchProfile>[0]);
      }
    } catch (e) {
      if (isPayloadTooLargeError(e)) {
        throw e;
      }
      const minimal: Parameters<typeof api.cv.patchProfile>[0] = {};
      if (profilePatch.headline !== undefined) minimal.headline = profilePatch.headline ?? undefined;
      if (profilePatch.phone !== undefined) minimal.phone = profilePatch.phone ?? undefined;
      if (profilePatch.location !== undefined) minimal.location = profilePatch.location ?? undefined;
      if (profilePatch.website !== undefined) minimal.website = profilePatch.website ?? undefined;
      if (profilePatch.template) minimal.template = profilePatch.template;
      try {
        if (Object.keys(minimal).length > 0) {
          if (cvProfileId) {
            await api.cv.patchProfilesEntry(cvProfileId, minimal);
          } else {
            await api.cv.patchProfile(minimal);
          }
        }
      } catch {
        /* Validation may still fail (e.g. website); sections + PATCH user name still apply. */
      }
    }
  }

  const entries = buildCvBuilderBatchSectionEntries(data, opts?.template, mutable);
  if (entries.length === 0) {
    return result;
  }

  if (cvProfileId) {
    const tBatch = performance.now();
    try {
      const br = await api.cv.batchUpsertProfileSections(cvProfileId, { sections: entries });
      logCvBuilderSavePerfDev('batchUpsert', tBatch, { updated: br.updated, unchanged: br.unchanged });
      result.usedBatch = true;
      result.batch = { updated: br.updated, unchanged: br.unchanged };
      if (br.sections.length > 0) result.sections = br.sections;
      return result;
    } catch (e) {
      if (!isBatchUpsertRouteUnsupportedError(e)) {
        const status = axios.isAxiosError(e) ? e.response?.status : undefined;
        if (status === 409 || status === 500) {
          try {
            mutable = await api.cv.getSections(true, cvProfileId);
            const retryEntries = buildCvBuilderBatchSectionEntries(data, opts?.template, mutable);
            const br = await api.cv.batchUpsertProfileSections(cvProfileId, {
              sections: retryEntries,
            });
            logCvBuilderSavePerfDev('batchUpsert.retry', tBatch, {
              updated: br.updated,
              unchanged: br.unchanged,
            });
            result.usedBatch = true;
            result.batch = { updated: br.updated, unchanged: br.unchanged };
            if (br.sections.length > 0) result.sections = br.sections;
            return result;
          } catch {
            throw e;
          }
        }
        throw e;
      }
      logCvBuilderSavePerfDev('batchUpsert.fallback', tBatch, { reason: 'route_unsupported' });
    }
  }

  const tSeq = performance.now();
  await persistCvBuilderSectionsSequential(data, mutable, cvProfileId);
  logCvBuilderSavePerfDev('sectionsSequential', tSeq, { sections: entries.length });
  return result;
}

export function countFilledSections(data: CVBuilderData): number {
  const personal = data.personal ?? { name: '', email: '' };
  const summaryText = data.summary?.text ?? '';
  const expItems = data.experience?.items;
  const eduItems = data.education?.items;
  const skillCats = data.skills?.categories ?? [];
  const projects = data.projects ?? [];
  const certifications = data.certifications ?? [];
  const languages = data.languages ?? [];
  const achievements = data.achievements ?? [];
  const customSections = data.customSections ?? [];
  const parsedCustom = data.parsedCustomSections ?? [];

  let n = 0;
  if (String(personal.name ?? '').trim() && String(personal.email ?? '').trim()) n++;
  if (String(summaryText).trim().length > 20) n++;
  if (Array.isArray(expItems) && expItems.length) n++;
  if (Array.isArray(eduItems) && eduItems.length) n++;
  if (skillCats.some((c) => Array.isArray(c?.skills) && c.skills.length)) n++;
  n += projects.length > 0 ? 1 : 0;
  n += certifications.length > 0 ? 1 : 0;
  n += languages.length > 0 ? 1 : 0;
  n += achievements.some((a) => String(a?.title ?? '').trim() || String(a?.issuer ?? '').trim()) ? 1 : 0;
  n += customSections.length;
  n += parsedCustom.filter((b) =>
    String(b?.title ?? '').trim() || (Array.isArray(b?.items) && b.items.some((i) => String(i?.text ?? '').trim())),
  ).length;
  return n;
}

const ACCEPT_SECTION_TYPE_TO_BUILDER_KEY: Partial<
  Record<string, keyof CVBuilderData>
> = {
  experience: 'experience',
  education: 'education',
  skills: 'skills',
  summary: 'summary',
  personal: 'personal',
  projects: 'projects',
  certifications: 'certifications',
  languages: 'languages',
  achievements: 'achievements',
  references: 'references',
};

/**
 * Applies accepted section updates directly to CVBuilderData without
 * requiring a full server refetch. Called immediately after accept succeeds.
 */
export function applyAcceptedSectionsToBuilderData(
  current: CVBuilderData,
  updatedSections: CvAcceptUpdatedSection[],
  existingSections: CVSectionRecord[],
): CVBuilderData {
  if (!updatedSections?.length) return current;

  const patchedSections: CVSectionRecord[] = updatedSections.map((s) => {
    const existing = existingSections.find((e) => e.type === s.type);
    return {
      id: existing?.id ?? `accept-patch-${s.type}`,
      type: s.type,
      data: s.data,
      order: s.order,
      hidden: !s.visible,
    };
  });

  const partialUpdate = transformSectionsToCVBuilderData(null, patchedSections, {
    email: current.personal.email,
    name: current.personal.name,
  });

  const updatedTypes = new Set(updatedSections.map((s) => s.type));
  const result: CVBuilderData = { ...current };

  for (const sectionType of updatedTypes) {
    if (sectionType === 'contact') {
      const contactSec = updatedSections.find((s) => s.type === 'contact');
      const headlineRaw =
        contactSec?.data?.headline ??
        contactSec?.data?.title ??
        contactSec?.data?.professionalHeadline;
      if (typeof headlineRaw === 'string' && headlineRaw.trim()) {
        result.personal = {
          ...result.personal,
          headline: normalizeProfessionalHeadlineTitle(normalizeText(headlineRaw)),
        };
      }
      continue;
    }
    const builderKey = ACCEPT_SECTION_TYPE_TO_BUILDER_KEY[sectionType];
    if (builderKey) {
      const key = builderKey as keyof CVBuilderData;
      if (partialUpdate[key] !== undefined) {
        (result as Record<keyof CVBuilderData, unknown>)[key] = partialUpdate[key];
      }
    }
  }

  if (partialUpdate.parsedCustomSections.length > 0) {
    const bySectionId = new Map(
      partialUpdate.parsedCustomSections.map((block) => [block.sectionId, block]),
    );
    const mergedParsed = result.parsedCustomSections.map(
      (block) => bySectionId.get(block.sectionId) ?? block,
    );
    for (const block of partialUpdate.parsedCustomSections) {
      if (!mergedParsed.some((b) => b.sectionId === block.sectionId)) {
        mergedParsed.push(block);
      }
    }
    result.parsedCustomSections = mergedParsed;
  }

  return coerceStructuredTextInCvBuilderData(result);
}

export function scoreBreakdownFromPayload(
  breakdown: Record<string, unknown> | undefined,
): { summary: number; experience: number; skills: number; education: number } {
  const pick = (k: string) => {
    const v = breakdown?.[k];
    if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v);
    if (typeof v === 'object' && v !== null && 'score' in (v as object)) {
      const s = Number((v as { score?: unknown }).score);
      return Number.isFinite(s) ? Math.round(s) : 0;
    }
    return 0;
  };
  return {
    summary: pick('summary'),
    experience: pick('experience'),
    skills: pick('skills'),
    education: pick('education'),
  };
}
