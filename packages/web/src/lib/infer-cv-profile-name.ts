import type { CVProfile } from '@/lib/api';
import type { CVBuilderData } from '@/lib/cvBuilder';
import {
  buildCvNamingFromProfile,
  formatCvProfileDisplayName,
  roleLabelFromCvProfile,
} from '@/lib/cv-profile-naming';

/**
 * Blob fallback: specific signals first; generic role words last.
 * DevOps matches only explicit platform/ops terms (not Docker alone).
 */
const DOMAIN_RULES: Array<{ re: RegExp; label: string }> = [
  {
    re: /\b(React|Next\.js|Vue|Angular|Tailwind|Svelte|Frontend|front-end|front end)\b/i,
    label: 'Frontend',
  },
  {
    re: /\b(React Native|Flutter|Swift|Kotlin|iOS|Android)\b/i,
    label: 'Mobile',
  },
  {
    re: /\b(data scientist|data analyst|data engineer|machine learning|tensorflow|pytorch|pandas)\b/i,
    label: 'Data',
  },
  { re: /\b(fullstack|full-stack|full stack)\b/i, label: 'Full Stack' },
  {
    re: /\b(backend|back-end|back end|node\.js|express|django|laravel|spring boot|nestjs|fastapi)\b/i,
    label: 'Backend',
  },
  { re: /\b(devops|kubernetes|k8s|terraform|ci\s*\/\s*cd|ci\/cd)\b/i, label: 'DevOps' },
  { re: /\b(ui\/ux|ux designer|ui designer|graphic design|product design)\b/i, label: 'Design' },
  { re: /(?:^|[^\w/])ux(?:$|[^\w/])/i, label: 'Design' },
  { re: /\b(qa|quality assurance)\b/i, label: 'QA' },
  { re: /\b(devrel|developer relations)\b/i, label: 'DevRel' },
  { re: /\b(hr|human resources)\b/i, label: 'HR' },
  { re: /\b(product manager|product owner)\b/i, label: 'Product' },
  { re: /\b(ml engineer|deep learning|llm|nlp)\b/i, label: 'ML' },
  { re: /\b(aws|azure|gcp|cloud architect|cloud engineer)\b/i, label: 'Cloud' },
  { re: /\b(security|cyber|infosec|penetration)\b/i, label: 'Security' },
  { re: /\b(etl|snowflake|dbt|warehouse)\b/i, label: 'Data Engineering' },
  { re: /\b(analytics|statistics)\b/i, label: 'Data Science' },
];

function normalizeBlob(parts: Array<string | null | undefined>): string {
  return parts
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .join('\n')
    .slice(0, 12_000);
}

/** Headline / shared keyword pass: fixed priority, case-insensitive. */
function matchRoleLabelFromHeadlineRules(text: string): string | null {
  const lower = text.toLowerCase();
  if (lower.includes('devops')) return 'DevOps';
  if (lower.includes('frontend')) return 'Frontend';
  if (lower.includes('backend')) return 'Backend';
  if (lower.includes('full stack') || lower.includes('fullstack') || lower.includes('full-stack'))
    return 'Full Stack';
  if (lower.includes('mobile')) return 'Mobile';
  if (
    lower.includes('data scientist') ||
    lower.includes('data analyst') ||
    lower.includes('data engineer')
  )
    return 'Data';
  if (lower.includes('design') || lower.includes('ui/ux') || /\bux\b/i.test(text)) return 'Design';
  if (!lower.includes('frontend') && !lower.includes('backend') && lower.includes('product'))
    return 'Product';
  if (/\bhr\b/i.test(text) || lower.includes('human resources')) return 'HR';
  if (/\bqa\b/i.test(text) || lower.includes('quality assurance')) return 'QA';
  if (lower.includes('devrel') || lower.includes('developer relations')) return 'DevRel';
  return null;
}

/** primarySkills / skills: headline rules on the blob, then stack heuristics. */
function matchRoleLabelFromStructuredText(text: string): string | null {
  const fromHeadline = matchRoleLabelFromHeadlineRules(text);
  if (fromHeadline) return fromHeadline;

  if (
    /\b(React|Next\.js|Vue|Angular|Tailwind|Svelte)\b/i.test(text) ||
    /\b(css|html)\b/i.test(text)
  )
    return 'Frontend';
  if (/\b(Node\.js|Express|Django|Laravel|Spring Boot|NestJS|FastAPI)\b/i.test(text))
    return 'Backend';
  if (/\b(React Native|Flutter|Swift|Kotlin|iOS|Android)\b/i.test(text)) return 'Mobile';
  if (
    /\b(Kubernetes|Terraform|CI\s*\/\s*CD|CI\/CD)\b/i.test(text) ||
    /\bdevops\b/i.test(text)
  )
    return 'DevOps';
  if (/\b(Machine Learning|TensorFlow|PyTorch|Pandas)\b/i.test(text)) return 'Data';
  return null;
}

/**
 * Collapse marketing-style headlines to a short professional title (shown in CV header + used for naming signals).
 * Example: "DevOps Engineer focused on Automation, Cloud…" → "DevOps Engineer"
 */
export function normalizeProfessionalHeadlineTitle(raw: string | null | undefined): string {
  let s = (raw ?? '').trim();
  if (!s) return '';
  const commaIdx = s.indexOf(',');
  if (commaIdx > 0 && commaIdx < s.length - 1) {
    s = s.slice(0, commaIdx).trim();
  }
  const lowered = s.toLowerCase();
  const focusedIdx = lowered.search(/\bfocused\b/);
  if (focusedIdx > 4) {
    s = s.slice(0, focusedIdx).trim();
  }
  const specIdx = lowered.search(/\bspecializ/);
  if (specIdx > 4) {
    s = s.slice(0, specIdx).trim();
  }
  const dashSplit = s.split(/\s[—–-]\s/);
  if (dashSplit[0]?.trim()) s = dashSplit[0].trim();
  return s.slice(0, 120).trim();
}

export type InferCvProfileNameOptions = {
  /** First target role from onboarding discovery (or similar), e.g. "DevOps Engineer, SRE" */
  roleHint?: string | null;
};

function sanitizeRoleHintLabel(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  const first = t.split(/[,;/]/)[0]?.trim() ?? t;
  return first.replace(/\s+/g, ' ').slice(0, 80).trim();
}

export function inferCvProfileNameFromTextBlob(blob: string): string {
  const text = blob.trim();
  if (!text) return 'My CV';
  for (const { re, label } of DOMAIN_RULES) {
    if (re.test(text)) return `My ${label} CV`;
  }
  return 'My CV';
}

function inferCvProfileNameFromProfileCore(profile: CVProfile | null | undefined): string {
  if (!profile) return 'My CV';

  const named = formatCvProfileDisplayName(
    buildCvNamingFromProfile(profile, { role: roleLabelFromCvProfile(profile) }),
  );
  if (named && named !== 'My CV' && !isGenericCvProfileName(named)) {
    return named;
  }

  const headline = profile.headline?.trim();
  if (headline) {
    const shortHeadline = normalizeProfessionalHeadlineTitle(headline);
    const fromShort = shortHeadline ? matchRoleLabelFromHeadlineRules(shortHeadline) : null;
    if (fromShort) return `My ${fromShort} CV`;
    const fromFull = matchRoleLabelFromHeadlineRules(headline);
    if (fromFull) return `My ${fromFull} CV`;
    if (shortHeadline && shortHeadline.length >= 3 && shortHeadline.length <= 56 && !/\.\s/.test(shortHeadline)) {
      return `My ${shortHeadline.slice(0, 56)} CV`;
    }
  }

  const st = profile.structured;
  const primaryJoined = Array.isArray(st?.primarySkills)
    ? st.primarySkills.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).join('\n')
    : '';
  if (primaryJoined.trim()) {
    const m = matchRoleLabelFromStructuredText(primaryJoined);
    if (m) return `My ${m} CV`;
  }

  const skillsJoined = Array.isArray(st?.skills)
    ? st.skills.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).join('\n')
    : '';
  if (skillsJoined.trim()) {
    const m = matchRoleLabelFromStructuredText(skillsJoined);
    if (m) return `My ${m} CV`;
  }

  const parts: string[] = [];
  if (profile.headline) parts.push(profile.headline);
  if (profile.rawText) parts.push(profile.rawText);
  if (st?.summary) parts.push(st.summary);
  if (Array.isArray(st?.skills)) parts.push(...st.skills);
  if (Array.isArray(st?.primarySkills)) parts.push(...st.primarySkills);
  if (Array.isArray(st?.experience)) {
    for (const ex of st.experience) {
      if (ex?.title) parts.push(ex.title);
      if (ex?.company) parts.push(ex.company);
      if (Array.isArray(ex?.bullets)) parts.push(...ex.bullets);
    }
  }
  return inferCvProfileNameFromTextBlob(normalizeBlob(parts));
}

export function inferCvProfileNameFromProfile(
  profile: CVProfile | null | undefined,
  opts?: InferCvProfileNameOptions,
): string {
  const core = inferCvProfileNameFromProfileCore(profile);
  const hint = sanitizeRoleHintLabel(opts?.roleHint ?? '');
  if (hint.length >= 2 && isGenericCvProfileName(core)) {
    return `My ${hint} CV`;
  }
  return core;
}

export function inferCvProfileNameFromBuilderData(
  data: CVBuilderData,
  opts?: InferCvProfileNameOptions,
): string {
  const parts: string[] = [];
  parts.push(data.personal.headline);
  parts.push(data.summary.text);
  for (const ex of data.experience.items) {
    parts.push(ex.title, ex.company, ...ex.bullets);
  }
  for (const cat of data.skills.categories) {
    parts.push(cat.name, ...cat.skills);
  }
  for (const p of data.projects) {
    parts.push(p.name, p.description, ...p.technologies);
  }
  const blobName = inferCvProfileNameFromTextBlob(normalizeBlob(parts));
  const hint = sanitizeRoleHintLabel(opts?.roleHint ?? '');
  if (hint.length >= 2 && isGenericCvProfileName(blobName)) {
    return `My ${hint} CV`;
  }
  return blobName;
}

export function isGenericCvProfileName(name: string | null | undefined): boolean {
  const n = (name ?? '').trim().toLowerCase();
  return n === '' || n === 'my cv' || n === 'cv' || n === 'untitled' || n === 'untitled cv' || n === 'new cv';
}
