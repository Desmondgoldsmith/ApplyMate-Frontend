import type { CVProfile } from '@/lib/api';
import {
  isGenericCvProfileName,
  normalizeProfessionalHeadlineTitle,
} from '@/lib/infer-cv-profile-name';

export type CvProfileNamingInput = {
  userName: string;
  company?: string | null;
  role?: string | null;
  tailored?: boolean;
};

function cleanPart(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ');
}

function slugPart(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

/** Display label: `[user] — [Company] — [Role] (Tailored)` */
export function formatCvProfileDisplayName(input: CvProfileNamingInput): string {
  const user = cleanPart(input.userName) || 'My CV';
  const company = cleanPart(input.company);
  const role = cleanPart(input.role);
  const segments = [user];
  if (company) segments.push(company);
  if (role) segments.push(role);
  let label = segments.join(' — ');
  if (input.tailored) label += ' (Tailored)';
  return label.slice(0, 160);
}

/** Download slug: `desmond-goldsmith-cv_google_frontend-engineer_tailored.pdf` */
export function formatCvProfileDownloadBasename(input: CvProfileNamingInput): string {
  const userSlug = slugPart(cleanPart(input.userName) || 'cv') || 'cv';
  const companySlug = slugPart(cleanPart(input.company));
  const roleSlug = slugPart(cleanPart(input.role));
  const parts = [`${userSlug}-cv`];
  if (companySlug) parts.push(companySlug);
  if (roleSlug) parts.push(roleSlug);
  if (input.tailored) parts.push('tailored');
  return parts.join('_').slice(0, 180);
}

export function formatCvProfileDownloadFilename(
  input: CvProfileNamingInput,
  format: 'pdf' | 'docx',
): string {
  return `${formatCvProfileDownloadBasename(input)}.${format}`;
}

function titleSlugPart(value: string | null | undefined): string {
  const words = cleanPart(value)
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, ''))
    .filter(Boolean);
  return words.join('-');
}

/** Mirrors backend export names when response headers are unavailable (CORS). */
export function formatCvBackendExportFilename(
  input: CvProfileNamingInput,
  format: 'pdf' | 'docx',
): string {
  const person = titleSlugPart(input.userName) || 'CV';
  if (input.tailored) {
    const company = titleSlugPart(input.company);
    const job = titleSlugPart(input.role);
    if (company && job) return `${person}-${company}-${job}-CV-Tailored.${format}`;
    if (company) return `${person}-${company}-CV-Tailored.${format}`;
    if (job) return `${person}-${job}-CV-Tailored.${format}`;
    return `${person}-CV-Tailored.${format}`;
  }
  const role = titleSlugPart(input.role);
  if (role) return `${person}-${role}-CV.${format}`;
  return `${person}-CV.${format}`;
}

export function isGenericCvExportFilename(filename: string): boolean {
  const base = filename.trim().toLowerCase();
  return base === 'cv.pdf' || base === 'cv.docx' || base === 'applymate-cv.pdf' || base === 'applymate-cv.docx';
}

export function candidateNameFromCvProfile(profile: CVProfile | null | undefined): string {
  const st = profile?.structured as Record<string, unknown> | undefined;
  const fromStructured =
    (typeof st?.fullName === 'string' && st.fullName.trim()) ||
    (typeof st?.name === 'string' && st.name.trim()) ||
    (typeof st?.displayName === 'string' && st.displayName.trim()) ||
    (typeof st?.candidateName === 'string' && st.candidateName.trim()) ||
    '';
  if (fromStructured && !isGenericCvProfileName(fromStructured)) return fromStructured.trim();

  const personal = st?.personal as { name?: string } | undefined;
  if (personal?.name?.trim() && !isGenericCvProfileName(personal.name)) {
    return personal.name.trim();
  }

  const apiName = profile?.name?.trim();
  if (apiName && !isGenericCvProfileName(apiName)) {
    const firstSegment = apiName.split(/\s[—–-]\s/)[0]?.trim();
    if (firstSegment && !isGenericCvProfileName(firstSegment)) return firstSegment;
  }

  const headline = profile?.headline?.trim();
  if (headline) {
    const short = normalizeProfessionalHeadlineTitle(headline);
    if (short && short.length <= 48 && !/\b(engineer|developer|designer|manager)\b/i.test(short)) {
      return short;
    }
  }
  return '';
}

/** Parse in-app CV label (e.g. `Desmond Goldsmith — DevOps Engineer`) into person + role. */
export function parseCvDisplayLabelParts(displayLabel: string): { userName: string; role: string } {
  const label = cleanPart(displayLabel).replace(/\s*\(Tailored\)\s*$/i, '');
  if (!label) return { userName: '', role: '' };

  const dashParts = label.split(/\s[—–-]\s/).map((p) => p.trim()).filter(Boolean);
  if (dashParts.length >= 2) {
    return {
      userName: dashParts[0]!,
      role: dashParts.slice(1).join(' — '),
    };
  }

  const myRoleCv = label.match(/^My\s+(.+?)\s+CV$/i);
  if (myRoleCv?.[1]) {
    return { userName: '', role: myRoleCv[1].trim() };
  }

  return { userName: label, role: '' };
}

export function roleLabelFromCvProfile(profile: CVProfile | null | undefined): string {
  const headline = normalizeProfessionalHeadlineTitle(profile?.headline);
  if (headline) return headline;
  const exp = profile?.structured?.experience?.[0];
  const title = typeof exp?.title === 'string' ? exp.title.trim() : '';
  return title;
}

/** Prefer server `name` from GET /cv/profiles when it is already a display label. */
export function preferApiCvProfileName(apiName: string | null | undefined, fallback: string): string {
  const n = apiName?.trim();
  if (n && !isGenericCvProfileName(n)) return n;
  return fallback;
}

export function buildCvNamingFromProfile(
  profile: CVProfile | null | undefined,
  opts?: { userName?: string; company?: string | null; role?: string | null; tailored?: boolean },
): CvProfileNamingInput {
  return {
    userName: cleanPart(opts?.userName) || candidateNameFromCvProfile(profile) || 'My CV',
    company: opts?.company ?? null,
    role: opts?.role ?? roleLabelFromCvProfile(profile) ?? null,
    tailored: opts?.tailored === true,
  };
}

/** Align export filename with the label shown in the CV picker / clinic. */
export function buildCvNamingForExport(
  profile: CVProfile | null | undefined,
  displayLabel?: string | null,
  opts?: { company?: string | null; role?: string | null; tailored?: boolean },
): CvProfileNamingInput {
  const parsed = parseCvDisplayLabelParts(displayLabel ?? '');
  const fromProfile = buildCvNamingFromProfile(profile, opts);
  const userName =
    parsed.userName ||
    fromProfile.userName ||
    candidateNameFromCvProfile(profile) ||
    'My CV';
  const role = opts?.role ?? parsed.role ?? fromProfile.role ?? roleLabelFromCvProfile(profile) ?? null;
  return {
    userName: isGenericCvProfileName(userName) ? candidateNameFromCvProfile(profile) || userName : userName,
    company: opts?.company ?? fromProfile.company ?? null,
    role,
    tailored: opts?.tailored === true,
  };
}
