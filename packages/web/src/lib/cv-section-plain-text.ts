/**
 * Convert CV section JSON ↔ plain text so users never edit raw JSON.
 * Parsing is best-effort; we emit shapes compatible with common Batch-2 section payloads.
 */

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function splitListLines(text: string): string[] {
  const parts = text
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set(parts)];
}

/** Skills / tags: one per line, or comma / semicolon separated. */
export function skillsTextToData(
  text: string,
  previous: Record<string, unknown>,
): Record<string, unknown> {
  const items = splitListLines(text);
  const next: Record<string, unknown> = { ...previous };
  delete next.categories;
  next.items = items;
  return next;
}

export function skillsDataToText(data: Record<string, unknown>): string {
  const items = data.items;
  if (Array.isArray(items) && items.length > 0) {
    if (items.every((x) => typeof x === 'string')) {
      return (items as string[]).join('\n');
    }
    if (items.every((x) => x && typeof x === 'object' && !Array.isArray(x))) {
      return (items as Record<string, unknown>[])
        .map((o) => str(o.name ?? o.text ?? o.title ?? o.skill ?? o.label))
        .filter(Boolean)
        .join('\n');
    }
  }
  const cats = data.categories;
  if (Array.isArray(cats)) {
    const lines: string[] = [];
    for (const c of cats) {
      if (!c || typeof c !== 'object' || Array.isArray(c)) continue;
      const o = c as Record<string, unknown>;
      const name = str(o.name ?? o.title);
      const skills = Array.isArray(o.skills)
        ? o.skills.filter((x): x is string => typeof x === 'string')
        : Array.isArray(o.items)
          ? o.items.filter((x): x is string => typeof x === 'string')
          : [];
      if (name && skills.length) {
        lines.push(`${name}\n${skills.join('\n')}`);
      } else if (skills.length) {
        lines.push(skills.join('\n'));
      } else if (name) {
        lines.push(name);
      }
    }
    if (lines.length) return lines.join('\n\n');
  }
  return '';
}

function experienceItemToText(o: Record<string, unknown>): string {
  const title = str(o.title ?? o.role ?? o.position);
  const company = str(o.company ?? o.organization);
  const duration = str(o.duration ?? o.period ?? o.dates);
  const bullets = Array.isArray(o.bullets)
    ? o.bullets.filter((x): x is string => typeof x === 'string')
    : [];
  const extra = str(o.summary ?? o.description ?? o.text);

  /** Category / skills-style block: title with no company (colon heading). */
  if (title && !company) {
    const lines: string[] = [];
    lines.push(bullets.length || extra ? `${title}:` : title);
    if (duration) lines.push(duration);
    for (const b of bullets) {
      lines.push(b.startsWith('-') || b.startsWith('•') ? b : `- ${b}`);
    }
    if (extra && bullets.length === 0) lines.push(extra);
    return lines.join('\n');
  }

  const head = title && company ? `${title} — ${company}` : title || company;
  const lines: string[] = [];
  if (head) lines.push(head);
  if (duration) lines.push(duration);
  for (const b of bullets) {
    lines.push(b.startsWith('-') || b.startsWith('•') ? b : `- ${b}`);
  }
  if (extra && bullets.length === 0) lines.push(extra);
  return lines.join('\n');
}

/** Line looks like "Category label:" (not a job title — company row). */
function tryCategoryHeader(line: string): { title: string; rest: string } | null {
  const m = line.match(/^\s*(?:•\s*)?([^:\n]+?):\s*(.*)$/);
  if (!m) return null;
  const title = m[1]!.trim();
  const rest = (m[2] ?? '').trim();
  if (title.length < 2 || title.length > 78) return null;
  if (/\s[—–]\s/.test(title)) return null;
  if (title.split(/\s+/).length > 14) return null;
  if (!/^[A-Za-z0-9]/.test(title)) return null;
  return { title, rest };
}

/** One line of body → bullets (comma lists, pipes, • segments, sub-labels with colon). */
function splitOneLineBullets(line: string): string[] {
  const raw = line.replace(/\s+/g, ' ').trim();
  if (!raw) return [];

  const subDashSplit = raw.split(/\s+-\s+(?=[A-Za-z][^:\n]{0,42}:\s*)/);
  if (subDashSplit.length > 1) {
    return subDashSplit.map((s) => s.trim()).filter(Boolean);
  }

  const byBullet = raw.split(/\s*•\s*/).map((s) => s.trim()).filter(Boolean);
  if (byBullet.length > 1) return byBullet;

  if (raw.includes('|') && raw.split('|').length >= 2 && !/https?:/i.test(raw)) {
    return raw.split('|').map((s) => s.trim()).filter(Boolean);
  }

  if (raw.includes(',') && raw.split(',').length >= 4) {
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }

  return [raw];
}

/** Split body into clean bullets (multiline-friendly). */
function splitBulletish(body: string): string[] {
  const raw = body.replace(/\r/g, '').trim();
  if (!raw) return [];

  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  const out: string[] = [];
  for (const line of lines) {
    out.push(...splitOneLineBullets(line));
  }
  return out.filter(Boolean);
}

function buildCategoryItem(title: string, body: string): Record<string, unknown> {
  const bullets = splitBulletish(body);
  if (bullets.length === 0) {
    return { title, company: '', description: body };
  }
  if (bullets.length === 1 && bullets[0]!.length > 280) {
    return { title, company: '', description: bullets[0] };
  }
  return { title, company: '', bullets };
}

function looksLikeJobBlock(chunk: string): boolean {
  const first = chunk.split('\n')[0]?.trim() ?? '';
  if (!first || first.includes(':')) return false;
  if (!/\s[—–]\s/.test(first)) return false;
  const parts = first.split(/\s[—–]\s/);
  if (parts.length < 2) return false;
  const a = parts[0]?.trim() ?? '';
  const b = parts.slice(1).join(' — ').trim();
  return a.length > 0 && a.length < 72 && b.length > 0 && b.length < 96;
}

/** Multi-line paste with "Label:" sections (skills, competencies, etc.). */
function parseAsCategoryStyle(lines: string[]): Record<string, unknown>[] {
  const items: Record<string, unknown>[] = [];
  let section: { title: string; parts: string[] } | null = null;
  const pending: string[] = [];

  const flushSection = () => {
    if (!section) return;
    const body = section.parts.join('\n').trim();
    items.push(buildCategoryItem(section.title, body));
    section = null;
  };

  for (const line of lines) {
    const hdr = tryCategoryHeader(line);
    if (hdr) {
      if (pending.length && !section) {
        items.push(parseExperienceChunk(pending.join('\n')));
        pending.length = 0;
      }
      flushSection();
      section = { title: hdr.title, parts: hdr.rest ? [hdr.rest] : [] };
    } else if (section) {
      section.parts.push(line);
    } else {
      pending.push(line);
    }
  }
  flushSection();
  if (pending.length) {
    items.push(parseExperienceChunk(pending.join('\n')));
  }
  return items.filter((it) => Object.keys(it).length > 0);
}

function parseExperienceChunk(chunk: string): Record<string, unknown> {
  const lines = chunk.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { title: '', company: '' };
  const first = lines[0]!;
  let title = '';
  let company = '';
  const splitHead = first.split(/\s[—–-]\s/).map((s) => s.trim());
  if (splitHead.length >= 2) {
    title = splitHead[0] ?? '';
    company = splitHead.slice(1).join(' — ') ?? '';
  } else if (first.includes('@')) {
    const [a, b] = first.split('@').map((s) => s.trim());
    title = a ?? '';
    company = b ?? '';
  } else {
    title = first;
  }

  const rest = lines.slice(1);
  let duration: string | undefined;
  let bodyStart = 0;
  if (rest[0] && /(\d{4}|present|current|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(rest[0]!)) {
    duration = rest[0];
    bodyStart = 1;
  }
  const body = rest.slice(bodyStart);
  const bullets = body
    .filter((l) => l.startsWith('-') || l.startsWith('•') || /^\d+\.\s/.test(l))
    .map((l) => l.replace(/^[-•]\s*/, '').replace(/^\d+\.\s*/, '').trim())
    .filter(Boolean);
  const narrative = body
    .filter((l) => !l.startsWith('-') && !l.startsWith('•') && !/^\d+\.\s/.test(l))
    .join('\n')
    .trim();

  const out: Record<string, unknown> = { title, company: company || '' };
  if (duration) out.duration = duration;
  if (bullets.length) out.bullets = bullets;
  else if (narrative) out.description = narrative;

  return out;
}

export function experienceTextToData(
  text: string,
  previous: Record<string, unknown>,
): Record<string, unknown> {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return { ...previous, items: [] };

  const lines = normalized
    .split('\n')
    .map((l) => l.trimEnd().trim())
    .filter((l) => l.length > 0);

  const chunks = normalized
    .split(/\n\s*\n/)
    .map((c) => c.trim())
    .filter(Boolean);

  const jobChunks = chunks.filter(looksLikeJobBlock);
  if (chunks.length >= 2 && jobChunks.length >= Math.ceil(chunks.length / 2)) {
    return { ...previous, items: chunks.map(parseExperienceChunk) };
  }
  if (chunks.length === 1 && looksLikeJobBlock(chunks[0]!)) {
    return { ...previous, items: [parseExperienceChunk(chunks[0]!)] };
  }

  const categoryItems = parseAsCategoryStyle(lines);
  if (categoryItems.length > 0) {
    return { ...previous, items: categoryItems };
  }

  const fallback = normalized ? [parseExperienceChunk(normalized)] : [];
  return { ...previous, items: fallback };
}

export function experienceDataToText(data: Record<string, unknown>): string {
  const items = data.items;
  if (!Array.isArray(items)) return '';
  if (items.every((x) => typeof x === 'string')) {
    return (items as string[]).join('\n');
  }
  if (items.every((x) => x && typeof x === 'object' && !Array.isArray(x))) {
    return (items as Record<string, unknown>[]).map(experienceItemToText).join('\n\n');
  }
  return '';
}

function educationItemToText(o: Record<string, unknown>): string {
  const degree = str(o.degree ?? o.qualification ?? o.title);
  const school = str(o.school ?? o.institution ?? o.university ?? o.company);
  const year = str(o.year ?? o.graduationYear ?? o.endDate);
  const head = degree && school ? `${degree} — ${school}` : degree || school;
  const lines: string[] = [];
  if (head) lines.push(head);
  if (year) lines.push(year);
  const extra = str(o.description ?? o.details ?? o.text);
  if (extra) lines.push(extra);
  return lines.join('\n');
}

function parseEducationChunk(chunk: string): Record<string, unknown> {
  const lines = chunk.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { degree: '', school: '' };
  const first = lines[0]!;
  let degree = '';
  let school = '';
  const splitHead = first.split(/\s[—–-]\s/).map((s) => s.trim());
  if (splitHead.length >= 2) {
    degree = splitHead[0] ?? '';
    school = splitHead.slice(1).join(' — ') ?? '';
  } else {
    degree = first;
  }
  const rest = lines.slice(1);
  const yearLine = rest.find((l) => /^\d{4}|class of|expected/i.test(l));
  const year = yearLine ?? '';
  const other = rest.filter((l) => l !== yearLine).join('\n').trim();

  const out: Record<string, unknown> = {
    degree: degree || first,
    school: school || '',
  };
  if (year) out.year = year.replace(/^Class of\s*/i, '').trim();
  if (other) out.description = other;
  return out;
}

export function educationTextToData(
  text: string,
  previous: Record<string, unknown>,
): Record<string, unknown> {
  const chunks = text
    .split(/\n\s*\n/)
    .map((c) => c.trim())
    .filter(Boolean);
  const items =
    chunks.length > 0 ? chunks.map(parseEducationChunk) : text.trim() ? [parseEducationChunk(text)] : [];
  return { ...previous, items };
}

export function educationDataToText(data: Record<string, unknown>): string {
  const items = data.items;
  if (!Array.isArray(items)) return '';
  if (items.every((x) => typeof x === 'string')) {
    return (items as string[]).join('\n');
  }
  if (items.every((x) => x && typeof x === 'object' && !Array.isArray(x))) {
    return (items as Record<string, unknown>[]).map(educationItemToText).join('\n\n');
  }
  return '';
}

/** Map section.type to plain-text strategy. */
export function structuredDataToPlainText(data: Record<string, unknown>, sectionType: string): string {
  const t = sectionType.toLowerCase();
  if (t.includes('skill')) {
    return skillsDataToText(data);
  }
  if (t.includes('experience') || t.includes('employment') || t.includes('work')) {
    return experienceDataToText(data);
  }
  if (t.includes('education') || t.includes('academic')) {
    return educationDataToText(data);
  }
  const items = data.items;
  if (Array.isArray(items)) {
    if (items.every((x) => typeof x === 'string')) {
      return (items as string[]).join('\n');
    }
    if (items.every((x) => x && typeof x === 'object' && !Array.isArray(x))) {
      return (items as Record<string, unknown>[]).map((o) => experienceItemToText(o)).join('\n\n');
    }
  }
  if (data.categories) {
    return skillsDataToText(data);
  }
  return '';
}

export function plainTextToStructuredData(
  text: string,
  sectionType: string,
  previous: Record<string, unknown>,
): Record<string, unknown> {
  const normalized = text.replace(/\r\n/g, '\n');
  const t = sectionType.toLowerCase();
  if (t.includes('skill')) {
    return skillsTextToData(normalized, previous);
  }
  if (t.includes('experience') || t.includes('employment') || t.includes('work')) {
    return experienceTextToData(normalized, previous);
  }
  if (t.includes('education') || t.includes('academic')) {
    return educationTextToData(normalized, previous);
  }
  const items = splitListLines(normalized);
  const next: Record<string, unknown> = { ...previous };
  delete next.categories;
  next.items = items;
  return next;
}

export function structuredSectionHint(sectionType: string): string {
  const t = sectionType.toLowerCase();
  if (t.includes('skill')) {
    return 'One skill per line (or separate with commas). Saves automatically.';
  }
  if (t.includes('experience') || t.includes('employment') || t.includes('work')) {
    return 'Jobs: title — company on one line, optional dates, then bullets. Or paste skill groups as Category: details (one heading per block). Saves after you edit.';
  }
  if (t.includes('education') || t.includes('academic')) {
    return 'Each school: degree — school, then year on the next line. Separate entries with a blank line.';
  }
  return 'One entry per line (or comma-separated). Saves automatically.';
}
