'use client';

import { formatCvDateLabel, formatCvPeriod } from '@/lib/cvDate';
import { normalizeBullets, type CVBuilderData, type CVBuilderLanguage } from '@/lib/cvBuilder';
import { Fragment, type ReactNode } from 'react';

import { CvDiffActionPair } from '@/components/cv/cvDiffImprovementActions';
import { cn } from '@/lib/utils';

type CVSectionVisibilityMap = Record<string, boolean>;

type ChangedField = {
  field?: string;
  fieldPath?: string;
  fieldLabel?: string;
  before: string;
  after: string;
  type: 'added' | 'removed' | 'changed';
};

type IntlDocBaseProps = {
  data: CVBuilderData;
  activeSection?: string | null;
  sectionVisibility?: CVSectionVisibilityMap | null;
  diffSection?: string | null;
  diffChangedFields?: ChangedField[] | null;
  onAcceptDiff?: (changeIndex?: number) => void;
  onRejectDiff?: (changeIndex?: number) => void;
  optionalSectionPresence?: Set<string>;
};

const CV_PREVIEW_ITEM_SEP = '::';

function isCvSectionVisible(sectionKey: string, map?: CVSectionVisibilityMap | null): boolean {
  if (!map) return true;
  return map[sectionKey] !== false;
}

function experienceOuterSectionActive(activeSection: string | null | undefined): boolean {
  return activeSection === 'experience';
}

function experienceItemWrapClass(activeSection: string | null | undefined, jobId: string) {
  const itemKey = `experience${CV_PREVIEW_ITEM_SEP}${jobId}`;
  const itemActive = activeSection === itemKey;
  return cn(
    'relative rounded-[4px] transition-all duration-300',
    itemActive ? 'ring-1 ring-inset ring-[rgba(0,201,177,0.35)]' : '',
  );
}

function sectionBox(
  id: string,
  activeSection: string | null | undefined,
  className: string,
  children: ReactNode,
  diffSection?: string | null,
  changedFields?: ChangedField[] | null,
  onAccept?: (changeIndex?: number) => void,
  onReject?: (changeIndex?: number) => void,
  isOuterSectionActive?: (active: string | null | undefined) => boolean,
) {
  const isActive = isOuterSectionActive ? isOuterSectionActive(activeSection) : activeSection === id;
  const isDiff = diffSection === id;
  const hasChanges = isDiff && changedFields && changedFields.length > 0;
  const formatDiffTitle = (field: string) => {
    const base = field.trim().replace(/\s*[-/]\s*/g, ' · ');
    const bulletMatch = base.match(/(.*?)(?:\s*[·|]\s*)?bullet\s*(\d+)/i);
    if (bulletMatch) {
      const left = bulletMatch[1]?.trim() || 'Experience';
      const idx = bulletMatch[2];
      return `${left} · Bullet ${idx}`;
    }
    return base || 'AI suggested update';
  };

  return (
    <div
      id={`cv-preview-${id}`}
      style={{ breakInside: 'avoid-page', pageBreakInside: 'avoid' }}
      className={cn(
        'relative transition-all duration-300',
        isActive && !isDiff ? 'rounded-[4px] ring-1 ring-inset ring-[rgba(0,201,177,0.35)]' : '',
        isDiff ? 'rounded-[4px] pb-1' : '',
        className,
      )}
    >
      {isDiff && (
        <div className="absolute -top-5 right-0 z-10 flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
          AI suggested change
        </div>
      )}
      {children}
      {hasChanges && (
        <div className="mx-1 mt-2 rounded-xl border border-[#10B981]/35 bg-white p-3 text-[10px] leading-relaxed shadow-[0_1px_0_rgba(16,185,129,0.08)]">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#047857]">
            AI Suggested Changes
          </p>
          {changedFields!.map((cf, i) => (
            <div key={i} className="mb-2.5 rounded-lg border border-[#22C55E]/35 bg-[#ECFDF5] p-2.5 last:mb-0">
              <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.08em] text-[#065F46]">
                {formatDiffTitle((cf.fieldLabel ?? cf.fieldPath ?? cf.field ?? '').trim())}
              </span>
              {cf.before ? (
                <div className="mb-2 rounded-md border border-rose-300 bg-rose-50 px-2 py-1.5 text-[10px] leading-snug text-rose-700">
                  <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-rose-500">Current version</p>
                  <p>{cf.before}</p>
                </div>
              ) : null}
              {cf.after ? (
                <div className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1.5 text-[10px] leading-snug text-emerald-800">
                  <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-emerald-600">AI suggestion</p>
                  <p>{cf.after}</p>
                </div>
              ) : null}
              <CvDiffActionPair
                className="mt-2 flex items-center justify-end gap-1.5"
                rejectLabel="✕ Reject"
                acceptLabel="✓ Accept"
                onReject={() => onReject?.(i)}
                onAccept={() => onAccept?.(i)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatEduRange(startYear: string, endYear: string): string {
  const a = formatCvDateLabel(startYear) || startYear;
  const b = formatCvDateLabel(endYear) || endYear;
  if (!a && !b) return '';
  return `${a || '—'} – ${b || '—'}`;
}

function formatGermanMonthYear(raw: string): string {
  const s = raw.trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}$/.test(s)) {
    const [y, m] = s.split('-');
    return `${m}/${y}`;
  }
  return formatCvDateLabel(raw);
}

function formatGermanCvPeriod(start: string, end: string, current: boolean): string {
  const a = formatGermanMonthYear(start);
  const b = current ? 'heute' : formatGermanMonthYear(end);
  if (!a && !b) return '';
  return `${a || '—'} – ${b || '—'}`;
}

function normalizePersonalUrlKey(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  try {
    const href = t.startsWith('http') ? t : `https://${t}`;
    const u = new URL(href);
    const path = u.pathname.replace(/\/+$/, '') || '/';
    return `${u.protocol}//${u.host}${path}`.toLowerCase();
  } catch {
    return t.toLowerCase();
  }
}

function websitePortfolioRowVisibility(p: CVBuilderData['personal']): { showWebsite: boolean; showPortfolio: boolean } {
  const w = p.website?.trim() ?? '';
  const po = p.portfolio?.trim() ?? '';
  if (!po) return { showWebsite: Boolean(w), showPortfolio: false };
  if (!w) return { showWebsite: false, showPortfolio: true };
  return {
    showWebsite: true,
    showPortfolio: normalizePersonalUrlKey(w) !== normalizePersonalUrlKey(po),
  };
}

function languageCefrRow(l: CVBuilderLanguage): [string, string, string, string, string] | null {
  const a = l.listening?.trim();
  const b = l.reading?.trim();
  const c = l.spokenInteraction?.trim();
  const d = l.spokenProduction?.trim();
  const e = l.writing?.trim();
  if (a || b || c || d || e) return [a || '—', b || '—', c || '—', d || '—', e || '—'];
  return null;
}

function intlExpBulletList(bullets: unknown) {
  const lines = normalizeBullets(bullets as string | string[] | null | undefined);
  if (!lines.length) return null;
  return (
    <ul
      style={{
        margin: '4px 0 0 0',
        paddingLeft: '18px',
        listStyleType: 'disc',
        listStylePosition: 'outside',
      }}
    >
      {lines.map((bullet, i) => (
        <li
          key={i}
          style={{
            fontSize: '8.5pt',
            lineHeight: '1.6',
            marginBottom: '2px',
            color: '#1a1a1a',
            display: 'list-item',
          }}
        >
          {bullet}
        </li>
      ))}
    </ul>
  );
}

function intlProjBulletList(bullets: string | undefined) {
  return intlExpBulletList(bullets);
}

function intlCertNameBlock(
  c: { name: string; issuer: string; date: string; url: string },
  linkColor: string,
) {
  const u = c.url?.trim();
  const nameEl = u ? (
    <a
      href={u.startsWith('http') ? u : `https://${u}`}
      style={{ fontWeight: 'bold', color: linkColor }}
      target="_blank"
      rel="noreferrer"
    >
      {c.name}
    </a>
  ) : (
    <span style={{ fontWeight: 'bold' }}>{c.name}</span>
  );
  return (
    <div style={{ fontSize: '8.5pt' }}>
      {nameEl}
      {c.issuer?.trim() ? <span> · {c.issuer.trim()}</span> : null}
      {c.date?.trim() ? <span> · {c.date.trim()}</span> : null}
    </div>
  );
}

function personalExtrasBlock(
  extras: CVBuilderData['personal']['extras'],
  opts?: { textColor?: string; linkColor?: string },
) {
  const textColor = opts?.textColor ?? '#333';
  const linkColor = opts?.linkColor ?? textColor;
  const rows = extras.filter((x) => x.label.trim() || x.value.trim());
  if (!rows.length) return null;
  return (
    <>
      {rows.map((x, i) => {
        const v = x.value.trim();
        const isUrl = /^https?:\/\//i.test(v);
        return (
          <div key={i} style={{ fontSize: '8.5pt', marginTop: i ? 4 : 2, color: textColor }}>
            {x.label.trim() ? <strong>{x.label.trim()}: </strong> : null}
            {isUrl ? (
              <a href={v} style={{ color: linkColor }} target="_blank" rel="noreferrer">
                {v}
              </a>
            ) : (
              <span>{v || '—'}</span>
            )}
          </div>
        );
      })}
    </>
  );
}

function ukProfileLines(text: string, maxLines = 4): string {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length <= maxLines) return lines.join('\n');
  return lines.slice(0, maxLines).join('\n');
}

const EU_NAVY = '#003399';
const EU_FOOTER = '© European Union, 2002–2024 | europass.europa.eu';

function formatEuroDate(dateStr: string): string {
  const s = dateStr.trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}$/.test(s)) {
    const [y, m] = s.split('-');
    const mi = Number(m) - 1;
    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${names[mi] ?? m} ${y}`;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

function formatFrDate(dateStr: string): string {
  const s = dateStr.trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}$/.test(s)) {
    const [y, m] = s.split('-');
    const d = new Date(Number(y), Number(m) - 1, 1);
    if (Number.isNaN(d.getTime())) return s;
    return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

function formatDeDate(dateStr: string): string {
  const s = dateStr.trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}$/.test(s)) {
    const [y, m] = s.split('-');
    return `${String(m).padStart(2, '0')}/${y}`;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function formatUkDate(dateStr: string): string {
  return formatEuroDate(dateStr);
}

function EuSectionHeader({ title }: { title: string }) {
  return (
    <div
      style={{
        background: EU_NAVY,
        color: 'white',
        padding: '3px 8px',
        fontSize: '8.5pt',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginTop: '14px',
        marginBottom: '6px',
      }}
    >
      {title}
    </div>
  );
}

function FrSectionHeader({ title }: { title: string }) {
  const c = '#1a3c5e';
  return (
    <div style={{ marginTop: '14px', marginBottom: '6px' }}>
      <div style={{ fontSize: '9.5pt', fontWeight: 700, textTransform: 'uppercase', color: c, letterSpacing: '0.12em' }}>
        {title}
      </div>
      <div style={{ borderBottom: `1.5px solid ${c}`, marginTop: '2px' }} />
    </div>
  );
}

function DeSectionHeader({ title }: { title: string }) {
  const c = '#1c1c1c';
  return (
    <div style={{ marginTop: '16px', marginBottom: '8px' }}>
      <div style={{ fontSize: '10pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: c }}>
        {title}
      </div>
      <div style={{ borderBottom: `2px solid ${c}`, marginTop: '3px' }} />
    </div>
  );
}

function UkSectionHeader({ title }: { title: string }) {
  const c = '#1f3a4a';
  return (
    <div style={{ marginTop: '14px', marginBottom: '6px' }}>
      <div style={{ fontSize: '9.5pt', fontWeight: 700, textTransform: 'uppercase', color: c, letterSpacing: '0.1em' }}>{title}</div>
      <div style={{ borderBottom: `1px solid ${c}`, marginTop: '2px' }} />
    </div>
  );
}

function EuropassCefrTable({ lang }: { lang: CVBuilderLanguage }) {
  const heads = ['Listening', 'Reading', 'Spoken interaction', 'Spoken production', 'Writing'];
  const vals = [lang.listening, lang.reading, lang.spokenInteraction, lang.spokenProduction, lang.writing].map((v) =>
    v?.trim() ? v.trim() : '—',
  );
  return (
    <table
      style={{
        borderCollapse: 'collapse',
        marginTop: '4px',
        marginBottom: '8px',
        width: '100%',
        maxWidth: '400px',
      }}
    >
      <thead>
        <tr>
          {heads.map((h) => (
            <th
              key={h}
              style={{
                background: EU_NAVY,
                color: 'white',
                fontSize: '7pt',
                padding: '3px 6px',
                textAlign: 'center',
                border: `1px solid ${EU_NAVY}`,
                fontWeight: 'normal',
              }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          {vals.map((v, i) => (
            <td
              key={i}
              style={{
                border: `1px solid ${EU_NAVY}`,
                textAlign: 'center',
                fontSize: '8pt',
                padding: '3px 6px',
                fontWeight: 'bold',
                color: v !== '—' ? EU_NAVY : '#999',
              }}
            >
              {v}
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

/** Europass Classic — single column, EU navy */
export function EuropassClassicDoc({
  data,
  activeSection,
  sectionVisibility,
  diffSection,
  diffChangedFields,
  onAcceptDiff,
  onRejectDiff,
}: IntlDocBaseProps) {
  const v = sectionVisibility;
  const vis = (key: string) => isCvSectionVisible(key, v);
  const p = data.personal;
  const { showWebsite, showPortfolio } = websitePortfolioRowVisibility(p);
  const displayName = (p.name || '').trim() || 'Your Name';

  const contactBits: ReactNode[] = [];
  if (p.location?.trim()) contactBits.push(<span key="loc">Location: {p.location.trim()}</span>);
  if (p.phone?.trim()) contactBits.push(<span key="ph">Tel: {p.phone.trim()}</span>);
  if (p.email?.trim())
    contactBits.push(
      <span key="em">
        Email:{' '}
        <a href={`mailto:${p.email.trim()}`} style={{ color: EU_NAVY }}>
          {p.email.trim()}
        </a>
      </span>,
    );
  if (p.linkedin?.trim()) {
    const href = p.linkedin.trim().startsWith('http') ? p.linkedin.trim() : `https://${p.linkedin.trim()}`;
    contactBits.push(
      <a key="li" href={href} style={{ color: EU_NAVY }} target="_blank" rel="noreferrer">
        LinkedIn
      </a>,
    );
  }
  if (p.github?.trim()) {
    const href = p.github.trim().startsWith('http') ? p.github.trim() : `https://${p.github.trim()}`;
    contactBits.push(
      <a key="gh" href={href} style={{ color: EU_NAVY }} target="_blank" rel="noreferrer">
        GitHub
      </a>,
    );
  }
  if (showWebsite && p.website?.trim()) {
    const href = p.website.trim().startsWith('http') ? p.website.trim() : `https://${p.website.trim()}`;
    contactBits.push(
      <a key="w" href={href} style={{ color: EU_NAVY }} target="_blank" rel="noreferrer">
        Portfolio
      </a>,
    );
  }
  if (showPortfolio && p.portfolio?.trim()) {
    const href = p.portfolio.trim().startsWith('http') ? p.portfolio.trim() : `https://${p.portfolio.trim()}`;
    contactBits.push(
      <a key="pf" href={href} style={{ color: EU_NAVY }} target="_blank" rel="noreferrer">
        Portfolio
      </a>,
    );
  }

  const personalInner = (
    <div style={{ borderBottom: '2.5px solid #003399', paddingBottom: '10px', marginBottom: '12px' }}>
      <h1 style={{ fontSize: '18pt', fontWeight: 'bold', color: EU_NAVY, margin: 0, letterSpacing: '0.5px' }}>{displayName}</h1>
      <p style={{ fontSize: '7.5pt', color: '#666', fontStyle: 'italic', margin: '1px 0 6px' }}>Curriculum Vitae</p>
      <div
        style={{
          fontSize: '8.5pt',
          color: '#333',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0 12px',
          alignItems: 'center',
        }}
      >
        {contactBits.map((bit, i) => (
          <Fragment key={i}>
            {i > 0 ? <span style={{ color: '#ccc' }}>|</span> : null}
            {bit}
          </Fragment>
        ))}
      </div>
      {personalExtrasBlock(p.extras, { textColor: '#333', linkColor: EU_NAVY })}
    </div>
  );

  const experienceInner = (
    <>
      <EuSectionHeader title="Work experience" />
      <div style={{ fontSize: '8.5pt', color: '#1a1a1a' }}>
        {data.experience.items.length ? (
          data.experience.items.map((x) => (
            <div
              key={x.id}
              id={`cv-preview-experience-item-${x.id}`}
              className={experienceItemWrapClass(activeSection, x.id)}
              style={{ display: 'flex', gap: '12px', marginBottom: '10px', paddingBottom: '10px', borderBottom: '0.5px solid #ddd' }}
            >
              <div
                style={{
                  width: '110px',
                  flexShrink: 0,
                  fontSize: '8.5pt',
                  color: EU_NAVY,
                  fontWeight: 'bold',
                  paddingTop: '1px',
                }}
              >
                {formatEuroDate(x.startDate)}
                <br />–<br />
                {x.current ? 'Present' : formatEuroDate(x.endDate)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 'bold', fontSize: '9pt' }}>{x.title || 'Job title'}</div>
                <div style={{ fontSize: '8.5pt', color: '#444', fontStyle: 'italic', marginBottom: '4px' }}>
                  {x.company}
                  {x.location?.trim() ? `, ${x.location.trim()}` : ''}
                </div>
                {intlExpBulletList(x.bullets)}
              </div>
            </div>
          ))
        ) : (
          <p>Add your experience in the editor.</p>
        )}
      </div>
    </>
  );

  const projectsInnerClassic =
    data.projects.length > 0 ? (
      <>
        <EuSectionHeader title="Projects" />
        <div style={{ fontSize: '8.5pt', color: '#1a1a1a' }}>
          {data.projects.map((proj) => (
            <div key={proj.id} style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 'bold', fontSize: '9pt' }}>{proj.name || 'Project'}</div>
              {proj.description?.trim() ? <p style={{ marginTop: 4 }}>{proj.description.trim()}</p> : null}
              {proj.url?.trim() ? (
                <p style={{ marginTop: 4 }}>
                  <a
                    href={proj.url.trim().startsWith('http') ? proj.url.trim() : `https://${proj.url.trim()}`}
                    style={{ color: EU_NAVY }}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {proj.url.trim()}
                  </a>
                </p>
              ) : null}
              {intlProjBulletList(proj.bullets)}
            </div>
          ))}
        </div>
      </>
    ) : null;

  const educationInner = (
    <>
      <EuSectionHeader title="Education and training" />
      <div style={{ fontSize: '8.5pt', color: '#1a1a1a' }}>
        {data.education.items.length ? (
          data.education.items.map((e) => (
            <div
              key={e.id}
              style={{ display: 'flex', gap: '12px', marginBottom: '10px', paddingBottom: '10px', borderBottom: '0.5px solid #ddd' }}
            >
              <div
                style={{
                  width: '110px',
                  flexShrink: 0,
                  fontWeight: 'bold',
                  color: EU_NAVY,
                  fontSize: '8.5pt',
                  paddingTop: '1px',
                }}
              >
                {formatEduRange(e.startYear, e.endYear)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 'bold', fontSize: '9pt' }}>{[e.degree, e.field].filter(Boolean).join(' — ')}</div>
                <div style={{ fontStyle: 'italic', color: '#444', fontSize: '8.5pt' }}>{e.school}</div>
                {e.grade?.trim() ? <div style={{ fontSize: '8.5pt', marginTop: 2 }}>{e.grade.trim()}</div> : null}
              </div>
            </div>
          ))
        ) : (
          <p>Add your education in the editor.</p>
        )}
      </div>
    </>
  );

  const natives = data.languages.filter((l) => l.proficiency === 'Native' && l.language.trim());
  const others = data.languages.filter((l) => l.proficiency !== 'Native' && l.language.trim());

  const skillsInner = (
    <>
      <EuSectionHeader title="Personal skills" />
      <div style={{ fontSize: '8.5pt', color: '#1a1a1a' }}>
        <div style={{ fontWeight: 'bold', fontSize: '8.5pt', marginTop: '8px', marginBottom: '3px', color: EU_NAVY }}>
          Mother tongue(s):
        </div>
        <p style={{ marginBottom: 8 }}>{natives.length ? natives.map((n) => n.language.trim()).join(', ') : '—'}</p>
        {others.length > 0 ? (
          <>
            <div style={{ fontWeight: 'bold', fontSize: '8.5pt', marginTop: 6, marginBottom: '3px', color: EU_NAVY }}>
              Other language(s):
            </div>
            {others.map((l) => (
              <div key={l.id} style={{ marginBottom: 10 }}>
                <p style={{ fontWeight: 'bold' }}>{l.language.trim()}</p>
                <EuropassCefrTable lang={l} />
                {!languageCefrRow(l) ? (
                  <p style={{ fontStyle: 'italic', fontSize: '8pt', marginTop: 2 }}>{l.proficiency}</p>
                ) : null}
              </div>
            ))}
            <p style={{ fontSize: '7pt', color: '#777', fontStyle: 'italic', margin: '0 0 6px' }}>
              Levels: A1/A2 Basic · B1/B2 Independent · C1/C2 Proficient
            </p>
          </>
        ) : null}
        <div style={{ fontWeight: 'bold', fontSize: '8.5pt', marginTop: 10, marginBottom: '3px', color: EU_NAVY }}>
          Digital / technical skills
        </div>
        {data.skills.categories.map((c) => (
          <div key={c.id} style={{ marginBottom: '4px', fontSize: '8.5pt' }}>
            <span style={{ fontWeight: 'bold' }}>{c.name || 'Skills'}:</span> {c.skills.length ? c.skills.join(', ') : '—'}
          </div>
        ))}
      </div>
    </>
  );

  const hasAdditional =
    data.certifications.some((c) => c.name.trim() || c.issuer.trim() || c.date.trim() || c.url.trim()) ||
    data.achievements.some((a) => a.title.trim() || a.issuer.trim() || Boolean(a.detail?.trim())) ||
    Boolean(p.drivingLicence?.trim());

  const additionalInner = hasAdditional ? (
    <>
      <EuSectionHeader title="Additional information" />
      <div style={{ fontSize: '8.5pt' }}>
        {data.certifications
          .filter((c) => c.name.trim() || c.issuer.trim() || c.date.trim() || c.url.trim())
          .map((c) => (
            <div key={c.id} className="mb-1">
              {intlCertNameBlock(c, EU_NAVY)}
            </div>
          ))}
        {data.achievements
          .filter((a) => a.title.trim() || a.issuer.trim() || a.detail?.trim())
          .map((a) => (
            <div key={a.id} className="mb-2">
              <div className="flex justify-between gap-2">
                <span style={{ fontWeight: 'bold' }}>{a.title}</span>
                <span className="shrink-0 text-right">{[a.issuer, a.date].filter(Boolean).join(' · ')}</span>
              </div>
              {a.detail?.trim() ? (
                <p style={{ fontSize: '8.5pt', color: '#444', marginTop: 4, marginBottom: 0 }}>{a.detail.trim()}</p>
              ) : null}
            </div>
          ))}
        {p.drivingLicence?.trim() ? (
          <p style={{ marginTop: 6 }}>Driving licence: {p.drivingLicence.trim()}</p>
        ) : null}
      </div>
    </>
  ) : null;

  return (
    <div
      className="box-border min-w-0 w-full bg-white antialiased"
      style={{
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '9pt',
        color: '#1a1a1a',
        background: '#fff',
        padding: '24px 30px',
        maxWidth: '794px',
        margin: '0 auto',
        lineHeight: '1.4',
      }}
    >
      {vis('personal')
        ? sectionBox('personal', activeSection, 'mb-2', personalInner, diffSection, diffChangedFields, onAcceptDiff, onRejectDiff)
        : null}
      {vis('experience')
        ? sectionBox(
            'experience',
            activeSection,
            'mb-2',
            experienceInner,
            diffSection,
            diffChangedFields,
            onAcceptDiff,
            onRejectDiff,
            experienceOuterSectionActive,
          )
        : null}
      {vis('education')
        ? sectionBox('education', activeSection, 'mb-2', educationInner, diffSection, diffChangedFields, onAcceptDiff, onRejectDiff)
        : null}
      {vis('projects') && projectsInnerClassic
        ? sectionBox(
            'projects',
            activeSection,
            'mb-2',
            projectsInnerClassic,
            diffSection,
            diffChangedFields,
            onAcceptDiff,
            onRejectDiff,
          )
        : null}
      {vis('skills')
        ? sectionBox('skills', activeSection, 'mb-2', skillsInner, diffSection, diffChangedFields, onAcceptDiff, onRejectDiff)
        : null}
      {additionalInner
        ? sectionBox(
            'certifications',
            activeSection,
            'mb-2',
            additionalInner,
            diffSection,
            diffChangedFields,
            onAcceptDiff,
            onRejectDiff,
          )
        : null}
      <div
        style={{
          borderTop: `1px solid ${EU_NAVY}`,
          marginTop: '16px',
          paddingTop: '6px',
          textAlign: 'center',
          fontSize: '7pt',
          color: '#888',
          fontStyle: 'italic',
        }}
      >
        {EU_FOOTER}
      </div>
    </div>
  );
}

function SidebarLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: EU_NAVY,
        color: 'white',
        padding: '3px 12px',
        fontSize: '7.5pt',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        margin: '10px -12px 6px',
      }}
    >
      {children}
    </div>
  );
}

/** Europass Modern — header + sidebar */
export function EuropassModernDoc({
  data,
  activeSection,
  sectionVisibility,
  diffSection,
  diffChangedFields,
  onAcceptDiff,
  onRejectDiff,
}: IntlDocBaseProps) {
  const v = sectionVisibility;
  const vis = (key: string) => isCvSectionVisible(key, v);
  const p = data.personal;
  const { showWebsite, showPortfolio } = websitePortfolioRowVisibility(p);
  const name = (p.name || '').trim() || 'Your Name';
  const natives = data.languages.filter((l) => l.proficiency === 'Native' && l.language.trim());
  const others = data.languages.filter((l) => l.proficiency !== 'Native' && l.language.trim());

  const linkify = (raw: string) => {
    const t = raw.trim();
    if (!t) return null;
    const href = t.startsWith('http') ? t : `https://${t}`;
    return (
      <a href={href} style={{ color: EU_NAVY }} target="_blank" rel="noreferrer">
        {t.replace(/^https?:\/\//i, '')}
      </a>
    );
  };

  const sidebarPersonal = (
    <div style={{ fontSize: '8.5pt', color: '#1a1a1a' }}>
      <SidebarLabel>Personal information</SidebarLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {p.location?.trim() ? (
          <div>
            <div style={{ fontSize: '7pt', color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Location</div>
            <div style={{ fontSize: '8.5pt', color: '#1a1a1a' }}>{p.location.trim()}</div>
          </div>
        ) : null}
        {p.phone?.trim() ? (
          <div>
            <div style={{ fontSize: '7pt', color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Telephone</div>
            <div style={{ fontSize: '8.5pt', color: '#1a1a1a' }}>{p.phone.trim()}</div>
          </div>
        ) : null}
        {p.email?.trim() ? (
          <div>
            <div style={{ fontSize: '7pt', color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</div>
            <div style={{ fontSize: '8.5pt', color: '#1a1a1a' }}>{linkify(p.email)}</div>
          </div>
        ) : null}
        {p.linkedin?.trim() ? (
          <div>
            <div style={{ fontSize: '7pt', color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em' }}>LinkedIn</div>
            <div style={{ fontSize: '8.5pt', color: '#1a1a1a' }}>{linkify(p.linkedin)}</div>
          </div>
        ) : null}
        {p.github?.trim() ? (
          <div>
            <div style={{ fontSize: '7pt', color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em' }}>GitHub</div>
            <div style={{ fontSize: '8.5pt', color: '#1a1a1a' }}>{linkify(p.github)}</div>
          </div>
        ) : null}
        {showWebsite && p.website?.trim() ? (
          <div>
            <div style={{ fontSize: '7pt', color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Website</div>
            <div style={{ fontSize: '8.5pt', color: '#1a1a1a' }}>{linkify(p.website)}</div>
          </div>
        ) : null}
        {showPortfolio && p.portfolio?.trim() ? (
          <div>
            <div style={{ fontSize: '7pt', color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Portfolio</div>
            <div style={{ fontSize: '8.5pt', color: '#1a1a1a' }}>{linkify(p.portfolio)}</div>
          </div>
        ) : null}
        {personalExtrasBlock(p.extras, { textColor: '#1a1a1a', linkColor: EU_NAVY })}
      </div>
      <SidebarLabel>Languages</SidebarLabel>
      <p style={{ fontWeight: 'bold', fontSize: '8.5pt' }}>
        Mother tongue: {natives.length ? natives.map((n) => n.language.trim()).join(', ') : '—'}
      </p>
      {others.map((l) => (
        <div key={l.id} style={{ marginBottom: 8 }}>
          <p style={{ fontWeight: 'bold' }}>{l.language.trim()}</p>
          <div style={{ maxWidth: '100%' }}>
            <EuropassCefrTable lang={l} />
          </div>
          {!languageCefrRow(l) ? (
            <p style={{ fontSize: '8pt', fontStyle: 'italic' }}>
              {l.language.trim()} — {l.proficiency}
            </p>
          ) : null}
        </div>
      ))}
      <SidebarLabel>Digital skills</SidebarLabel>
      <div>
        {data.skills.categories.map((c) => (
          <div key={c.id} style={{ marginBottom: 6, borderLeft: `2px solid ${EU_NAVY}`, paddingLeft: 8 }}>
            <p style={{ fontWeight: 'bold', fontSize: '8.5pt' }}>{c.name || 'Skills'}</p>
            <p style={{ fontSize: '8pt', color: '#333' }}>{c.skills.length ? c.skills.join(', ') : '—'}</p>
          </div>
        ))}
      </div>
      <SidebarLabel>Additional</SidebarLabel>
      <div style={{ fontSize: '8pt' }}>
        {data.certifications
          .filter((c) => c.name.trim() || c.issuer.trim() || c.date.trim() || c.url.trim())
          .map((c) => (
            <div key={c.id} className="mb-1">
              {intlCertNameBlock(c, EU_NAVY)}
            </div>
          ))}
        {data.achievements
          .filter((a) => a.title.trim() || a.issuer.trim() || a.detail?.trim())
          .map((a) => (
            <div key={a.id} className="mb-1">
              <div style={{ fontWeight: 'bold' }}>{a.title}</div>
              {[a.issuer, a.date].filter(Boolean).length ? (
                <div style={{ fontSize: '7.5pt', color: '#555' }}>{[a.issuer, a.date].filter(Boolean).join(' · ')}</div>
              ) : null}
              {a.detail?.trim() ? <div style={{ fontSize: '7.5pt', color: '#444', marginTop: 2 }}>{a.detail.trim()}</div> : null}
            </div>
          ))}
        {p.drivingLicence?.trim() ? <p>Driving licence: {p.drivingLicence.trim()}</p> : null}
      </div>
    </div>
  );

  const mainSummary =
    data.summary.text.trim() && vis('summary') ? (
      <>
        <EuSectionHeader title="Personal statement" />
        <p style={{ fontSize: '8.8pt', lineHeight: 1.38, marginBottom: 8 }}>{data.summary.text.trim()}</p>
      </>
    ) : null;

  const mainExp = (
    <>
      <EuSectionHeader title="Work experience" />
      <div style={{ fontSize: '8.5pt' }}>
        {data.experience.items.length ? (
          data.experience.items.map((x) => (
            <div
              key={x.id}
              id={`cv-preview-experience-item-${x.id}`}
              className={experienceItemWrapClass(activeSection, x.id)}
              style={{ display: 'flex', gap: '12px', marginBottom: '10px', paddingBottom: '10px', borderBottom: '0.5px solid #ddd' }}
            >
              <div
                style={{
                  width: '110px',
                  flexShrink: 0,
                  fontWeight: 'bold',
                  color: EU_NAVY,
                  fontSize: '8.5pt',
                  paddingTop: '1px',
                }}
              >
                {formatEuroDate(x.startDate)}
                <br />–<br />
                {x.current ? 'Present' : formatEuroDate(x.endDate)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 'bold', fontSize: '9pt' }}>{x.title}</div>
                <div style={{ fontStyle: 'italic', color: '#444', fontSize: '8.5pt', marginBottom: '4px' }}>
                  {x.company}
                  {x.location?.trim() ? ` · ${x.location.trim()}` : ''}
                </div>
                {intlExpBulletList(x.bullets)}
              </div>
            </div>
          ))
        ) : (
          <p>Add your experience in the editor.</p>
        )}
      </div>
    </>
  );

  const mainEdu = (
    <>
      <EuSectionHeader title="Education and training" />
      <div style={{ fontSize: '8.5pt' }}>
        {data.education.items.length ? (
          data.education.items.map((e) => (
            <div key={e.id} style={{ display: 'flex', gap: '12px', marginBottom: '10px', paddingBottom: '10px', borderBottom: '0.5px solid #ddd' }}>
              <div style={{ width: '110px', flexShrink: 0, fontWeight: 'bold', color: EU_NAVY, fontSize: '8.5pt' }}>
                {formatEduRange(e.startYear, e.endYear)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 'bold', fontSize: '9pt' }}>
                  {[e.degree, e.field].filter(Boolean).join(' — ')}
                  {e.grade?.trim() ? ` (${e.grade})` : ''}
                </div>
                <div style={{ fontStyle: 'italic', color: '#444', fontSize: '8.5pt' }}>{e.school}</div>
              </div>
            </div>
          ))
        ) : (
          <p>Add your education in the editor.</p>
        )}
      </div>
    </>
  );

  const mainProjects =
    data.projects.length > 0 ? (
      <>
        <EuSectionHeader title="Projects" />
        <div style={{ fontSize: '8.5pt' }}>
          {data.projects.map((proj) => (
            <div key={proj.id} style={{ display: 'flex', marginBottom: 8 }}>
              <div style={{ width: '22%', color: EU_NAVY, fontWeight: 'bold' }}>—</div>
              <div style={{ width: '78%' }}>
                <p style={{ fontWeight: 'bold' }}>{proj.name || 'Project'}</p>
                {proj.description?.trim() ? <p style={{ marginTop: 4 }}>{proj.description.trim()}</p> : null}
                {proj.url?.trim() ? (
                  <p style={{ marginTop: 4 }}>
                    <a
                      href={proj.url.trim().startsWith('http') ? proj.url.trim() : `https://${proj.url.trim()}`}
                      style={{ color: EU_NAVY }}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {proj.url.trim()}
                    </a>
                  </p>
                ) : null}
                {intlProjBulletList(proj.bullets)}
              </div>
            </div>
          ))}
        </div>
      </>
    ) : null;

  return (
    <div
      className="box-border min-w-0 w-full bg-white"
      style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '9pt', color: '#1a1a1a' }}
    >
      <div style={{ background: EU_NAVY, padding: '14px 18px', color: 'white', marginBottom: 0 }}>
        <div style={{ fontSize: '17pt', fontWeight: 'bold', letterSpacing: '0.5px' }}>{name}</div>
        {p.headline?.trim() ? (
          <div style={{ fontSize: '9.5pt', fontWeight: 'normal', marginTop: '2px', opacity: 0.85 }}>{p.headline.trim()}</div>
        ) : null}
      </div>
      <div className="flex w-full" style={{ alignItems: 'stretch', minHeight: '600px' }}>
        <aside style={{ width: '30%', background: '#e8edf7', padding: '14px 12px', alignSelf: 'stretch', flexShrink: 0 }}>
          {vis('personal')
            ? sectionBox(
                'personal',
                activeSection,
                '',
                sidebarPersonal,
                diffSection,
                diffChangedFields,
                onAcceptDiff,
                onRejectDiff,
              )
            : null}
        </aside>
        <div style={{ flex: 1, background: 'white', padding: '14px 16px', alignSelf: 'stretch', minWidth: 0 }}>
          {vis('summary') && mainSummary
            ? sectionBox('summary', activeSection, 'mb-2', mainSummary, diffSection, diffChangedFields, onAcceptDiff, onRejectDiff)
            : null}
          {vis('experience')
            ? sectionBox(
                'experience',
                activeSection,
                'mb-2',
                mainExp,
                diffSection,
                diffChangedFields,
                onAcceptDiff,
                onRejectDiff,
                experienceOuterSectionActive,
              )
            : null}
          {vis('education')
            ? sectionBox('education', activeSection, 'mb-2', mainEdu, diffSection, diffChangedFields, onAcceptDiff, onRejectDiff)
            : null}
          {vis('projects')
            ? sectionBox('projects', activeSection, 'mb-2', mainProjects, diffSection, diffChangedFields, onAcceptDiff, onRejectDiff)
            : null}
        </div>
      </div>
      <div
        style={{
          borderTop: `1px solid ${EU_NAVY}`,
          marginTop: '16px',
          paddingTop: '6px',
          textAlign: 'center',
          fontSize: '7pt',
          color: '#888',
          fontStyle: 'italic',
        }}
      >
        {EU_FOOTER}
      </div>
    </div>
  );
}

const FRENCH_NAVY = '#1a3c5e';

/** French CV */
export function FrenchDoc({
  data,
  activeSection,
  sectionVisibility,
  diffSection,
  diffChangedFields,
  onAcceptDiff,
  onRejectDiff,
}: IntlDocBaseProps) {
  const v = sectionVisibility;
  const vis = (key: string) => isCvSectionVisible(key, v);
  const p = data.personal;
  const { showWebsite, showPortfolio } = websitePortfolioRowVisibility(p);
  const name = (p.name || '').trim() || 'Your Name';

  const contactParts: ReactNode[] = [];
  if (p.location?.trim()) contactParts.push(<span key="loc">{p.location.trim()}</span>);
  if (p.phone?.trim()) contactParts.push(<span key="ph">{p.phone.trim()}</span>);
  if (p.email?.trim())
    contactParts.push(
      <a key="em" href={`mailto:${p.email.trim()}`} style={{ color: FRENCH_NAVY }}>
        {p.email.trim()}
      </a>,
    );
  if (p.linkedin?.trim()) {
    const href = p.linkedin.trim().startsWith('http') ? p.linkedin.trim() : `https://${p.linkedin.trim()}`;
    contactParts.push(
      <a key="li" href={href} style={{ color: FRENCH_NAVY }} target="_blank" rel="noreferrer">
        LinkedIn
      </a>,
    );
  }
  if (p.github?.trim()) {
    const href = p.github.trim().startsWith('http') ? p.github.trim() : `https://${p.github.trim()}`;
    contactParts.push(
      <a key="gh" href={href} style={{ color: FRENCH_NAVY }} target="_blank" rel="noreferrer">
        GitHub
      </a>,
    );
  }
  if (showWebsite && p.website?.trim()) {
    const href = p.website.trim().startsWith('http') ? p.website.trim() : `https://${p.website.trim()}`;
    contactParts.push(
      <a key="w" href={href} style={{ color: FRENCH_NAVY }} target="_blank" rel="noreferrer">
        Site web
      </a>,
    );
  }
  if (showPortfolio && p.portfolio?.trim()) {
    const href = p.portfolio.trim().startsWith('http') ? p.portfolio.trim() : `https://${p.portfolio.trim()}`;
    contactParts.push(
      <a key="pf" href={href} style={{ color: FRENCH_NAVY }} target="_blank" rel="noreferrer">
        Portfolio
      </a>,
    );
  }

  const header = (
    <div className="flex justify-between gap-4" style={{ alignItems: 'flex-start' }}>
      <div className="min-w-0 flex-1">
        <h1 style={{ fontSize: '20pt', fontWeight: 300, color: FRENCH_NAVY, letterSpacing: '1.5px', margin: 0 }}>{name}</h1>
        {p.headline?.trim() ? (
          <p style={{ fontSize: '10pt', color: '#666', fontStyle: 'italic', fontWeight: 400, marginTop: '3px' }}>{p.headline.trim()}</p>
        ) : null}
        <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '4px 0', fontSize: '8.5pt', color: '#555' }}>
          {contactParts.map((c, i) => (
            <Fragment key={i}>
              {i > 0 ? <span style={{ margin: '0 6px', color: '#aaa' }}>·</span> : null}
              {c}
            </Fragment>
          ))}
        </div>
        {personalExtrasBlock(p.extras, { textColor: '#555', linkColor: FRENCH_NAVY })}
      </div>
      <div className="shrink-0">
        {p.photoUrl?.trim() ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.photoUrl.trim()}
            alt="Profile photo"
            width={82}
            height={100}
            style={{
              objectFit: 'cover',
              objectPosition: 'center top',
              border: `2px solid ${FRENCH_NAVY}`,
              display: 'block',
            }}
          />
        ) : (
          <div
            style={{
              width: 82,
              height: 100,
              background: '#edf0f4',
              border: '2px dashed #9aafc5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <span style={{ fontSize: '7pt', color: '#9aafc5', textAlign: 'center' }}>Photo</span>
          </div>
        )}
      </div>
    </div>
  );

  const profil =
    data.summary.text.trim() && vis('summary') ? (
      <>
        <FrSectionHeader title="Profil" />
        <p style={{ fontSize: '9pt', color: '#2c2c2c', lineHeight: '1.7', margin: 0 }}>{data.summary.text.trim()}</p>
      </>
    ) : null;

  const exp = (
    <>
      <FrSectionHeader title="Expérience professionnelle" />
      <div style={{ fontSize: '8.5pt', color: '#2c2c2c' }}>
        {data.experience.items.length ? (
          data.experience.items.map((x) => (
            <div key={x.id} id={`cv-preview-experience-item-${x.id}`} className={cn('mb-3', experienceItemWrapClass(activeSection, x.id))} style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
                <div>
                  <span style={{ fontWeight: 'bold', fontSize: '9.5pt', color: FRENCH_NAVY }}>{x.company || 'Entreprise'}</span>
                  {x.location?.trim() ? (
                    <span style={{ fontSize: '8.5pt', color: '#666' }}> — {x.location.trim()}</span>
                  ) : null}
                </div>
                <div className="shrink-0 text-right" style={{ fontSize: '8.5pt', color: '#666', fontStyle: 'italic' }}>
                  {formatFrDate(x.startDate)} – {x.current ? 'présent' : formatFrDate(x.endDate)}
                </div>
              </div>
              <div style={{ fontSize: '9pt', color: '#444', fontStyle: 'italic', marginBottom: '4px' }}>{x.title || 'Poste'}</div>
              {intlExpBulletList(x.bullets)}
            </div>
          ))
        ) : (
          <p>Ajoutez votre expérience dans l&apos;éditeur.</p>
        )}
      </div>
    </>
  );

  const edu = (
    <>
      <FrSectionHeader title="Formation" />
      <div style={{ fontSize: '8.5pt' }}>
        {data.education.items.map((e) => (
          <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '9pt' }}>{[e.degree, e.field].filter(Boolean).join(', ')}</div>
              <div style={{ fontSize: '8.5pt', color: '#555', fontStyle: 'italic' }}>{e.school}</div>
              {e.grade?.trim() ? <div style={{ fontSize: '8pt', color: '#777' }}>{e.grade.trim()}</div> : null}
            </div>
            <div style={{ fontSize: '8.5pt', color: '#666', flexShrink: 0, textAlign: 'right' }}>
              {e.startYear && e.endYear ? `${e.startYear} – ${e.endYear}` : e.endYear || e.startYear}
            </div>
          </div>
        ))}
      </div>
    </>
  );

  const skills = (
    <>
      <FrSectionHeader title="Compétences" />
      <div style={{ fontSize: '8.5pt' }}>
        {data.skills.categories.map((c) => (
          <div key={c.id} style={{ marginBottom: '5px', fontSize: '8.5pt' }}>
            <span style={{ fontWeight: 'bold', color: FRENCH_NAVY }}>{c.name || 'Compétences'} :</span> {c.skills.join(', ')}
          </div>
        ))}
      </div>
    </>
  );

  const langs = data.languages.length ? (
    <>
      <FrSectionHeader title="Langues" />
      <div style={{ fontSize: '8.5pt' }}>
        {data.languages.map((l) => (
          <div key={l.id} style={{ fontSize: '8.5pt', marginBottom: '3px' }}>
            <span style={{ fontWeight: 'bold' }}>{l.language.trim()}</span>
            {' — '}
            {l.listening?.trim() || l.reading?.trim()
              ? `Niveau ${l.reading?.trim() || l.listening?.trim()}`
              : l.proficiency}
          </div>
        ))}
      </div>
    </>
  ) : null;

  const projectsFr =
    data.projects.length > 0 && vis('projects') ? (
      <>
        <FrSectionHeader title="Projets" />
        <div style={{ fontSize: '8.5pt', color: '#2c2c2c' }}>
          {data.projects.map((proj) => (
            <div key={proj.id} style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 'bold', fontSize: '9.5pt', color: FRENCH_NAVY }}>{proj.name || 'Projet'}</div>
              {proj.description?.trim() ? <p style={{ marginTop: 4, marginBottom: 0 }}>{proj.description.trim()}</p> : null}
              {proj.url?.trim() ? (
                <p style={{ marginTop: 4, marginBottom: 0 }}>
                  <a
                    href={proj.url.trim().startsWith('http') ? proj.url.trim() : `https://${proj.url.trim()}`}
                    style={{ color: FRENCH_NAVY }}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {proj.url.trim()}
                  </a>
                </p>
              ) : null}
              {intlProjBulletList(proj.bullets)}
            </div>
          ))}
        </div>
      </>
    ) : null;

  const certificationsFr =
    data.certifications.some((c) => c.name.trim() || c.issuer.trim() || c.date.trim() || c.url.trim()) && vis('certifications') ? (
      <>
        <FrSectionHeader title="Certifications" />
        <div style={{ fontSize: '8.5pt', color: '#2c2c2c' }}>
          {data.certifications
            .filter((c) => c.name.trim() || c.issuer.trim() || c.date.trim() || c.url.trim())
            .map((c) => (
              <div key={c.id} style={{ marginBottom: 8 }}>
                {intlCertNameBlock(c, FRENCH_NAVY)}
              </div>
            ))}
        </div>
      </>
    ) : null;

  const achievementsFr =
    data.achievements.some((a) => a.title.trim() || a.issuer.trim() || a.date.trim() || a.detail?.trim()) && vis('achievements') ? (
      <>
        <FrSectionHeader title="Réalisations" />
        <div style={{ fontSize: '8.5pt', color: '#2c2c2c' }}>
          {data.achievements
            .filter((a) => a.title.trim() || a.issuer.trim() || a.date.trim() || a.detail?.trim())
            .map((a) => (
              <div key={a.id} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontWeight: 'bold' }}>{a.title}</span>
                  <span style={{ flexShrink: 0, color: '#666' }}>{[a.issuer, a.date].filter(Boolean).join(' · ')}</span>
                </div>
                {a.detail?.trim() ? <p style={{ marginTop: 4, marginBottom: 0, lineHeight: 1.6 }}>{a.detail.trim()}</p> : null}
              </div>
            ))}
        </div>
      </>
    ) : null;

  const hobbies = p.hobbies?.trim() ? (
    <>
      <FrSectionHeader title="Centres d'intérêt" />
      <p style={{ fontSize: '8.5pt', color: '#2c2c2c', lineHeight: '1.6', margin: 0 }}>{p.hobbies.trim()}</p>
    </>
  ) : null;

  const persoFooter =
    p.dateOfBirth?.trim() ||
    p.placeOfBirth?.trim() ||
    p.nationality?.trim() ||
    p.maritalStatus?.trim() ||
    p.drivingLicence?.trim() ? (
      <div className="mt-2">
        <FrSectionHeader title="Informations personnelles" />
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px 24px',
            fontSize: '8.5pt',
            padding: '8px 10px',
            background: '#f5f7fa',
            borderRadius: '2px',
            marginTop: '12px',
          }}
        >
          {p.dateOfBirth?.trim() ? (
            <span>
              <strong>Date de naissance :</strong> {p.dateOfBirth.trim()}
            </span>
          ) : null}
          {p.placeOfBirth?.trim() ? (
            <span>
              <strong>Lieu de naissance :</strong> {p.placeOfBirth.trim()}
            </span>
          ) : null}
          {p.nationality?.trim() ? (
            <span>
              <strong>Nationalité :</strong> {p.nationality.trim()}
            </span>
          ) : null}
          {p.maritalStatus?.trim() ? (
            <span>
              <strong>Situation familiale :</strong> {p.maritalStatus.trim()}
            </span>
          ) : null}
          {p.drivingLicence?.trim() ? (
            <span>
              <strong>Permis :</strong> {p.drivingLicence.trim()}
            </span>
          ) : null}
        </div>
      </div>
    ) : null;

  const headerBlock = (
    <div style={{ borderBottom: `2px solid ${FRENCH_NAVY}`, marginTop: '14px', marginBottom: '16px', paddingBottom: 12 }}>
      {header}
    </div>
  );

  return (
    <div
      className="box-border min-w-0 w-full bg-white antialiased"
      style={{
        fontFamily: '"Lato", "Helvetica Neue", Helvetica, Arial, sans-serif',
        fontSize: '9pt',
        color: '#2c2c2c',
        background: '#fff',
        padding: '26px 32px',
        maxWidth: '794px',
        margin: '0 auto',
        lineHeight: '1.5',
      }}
    >
      {vis('personal')
        ? sectionBox('personal', activeSection, 'mb-2', headerBlock, diffSection, diffChangedFields, onAcceptDiff, onRejectDiff)
        : null}
      {vis('summary') && profil
        ? sectionBox('summary', activeSection, 'mb-2', profil, diffSection, diffChangedFields, onAcceptDiff, onRejectDiff)
        : null}
      {vis('experience')
        ? sectionBox(
            'experience',
            activeSection,
            'mb-2',
            exp,
            diffSection,
            diffChangedFields,
            onAcceptDiff,
            onRejectDiff,
            experienceOuterSectionActive,
          )
        : null}
      {vis('education') ? sectionBox('education', activeSection, 'mb-2', edu, diffSection, diffChangedFields, onAcceptDiff, onRejectDiff) : null}
      {vis('skills') ? sectionBox('skills', activeSection, 'mb-2', skills, diffSection, diffChangedFields, onAcceptDiff, onRejectDiff) : null}
      {vis('languages') && langs
        ? sectionBox('languages', activeSection, 'mb-2', langs, diffSection, diffChangedFields, onAcceptDiff, onRejectDiff)
        : null}
      {projectsFr
        ? sectionBox('projects', activeSection, 'mb-2', projectsFr, diffSection, diffChangedFields, onAcceptDiff, onRejectDiff)
        : null}
      {certificationsFr
        ? sectionBox('certifications', activeSection, 'mb-2', certificationsFr, diffSection, diffChangedFields, onAcceptDiff, onRejectDiff)
        : null}
      {achievementsFr
        ? sectionBox('achievements', activeSection, 'mb-2', achievementsFr, diffSection, diffChangedFields, onAcceptDiff, onRejectDiff)
        : null}
      {hobbies ? (
        <div className="mb-2" id="cv-preview-intl-hobbies">
          {hobbies}
        </div>
      ) : null}
      {persoFooter}
    </div>
  );
}

/** German Lebenslauf */
export function GermanDoc({
  data,
  activeSection,
  sectionVisibility,
  diffSection,
  diffChangedFields,
  onAcceptDiff,
  onRejectDiff,
}: IntlDocBaseProps) {
  const v = sectionVisibility;
  const vis = (key: string) => isCvSectionVisible(key, v);
  const p = data.personal;
  const ink = '#1c1c1c';
  const { showWebsite, showPortfolio } = websitePortfolioRowVisibility(p);

  const labelRow = (label: string, value: string | undefined) =>
    value?.trim() ? (
      <div style={{ fontSize: '8.5pt', lineHeight: 1.6 }}>
        <span style={{ fontWeight: 'bold', display: 'inline-block', minWidth: 130 }}>{label}</span>
        <span>{value.trim()}</span>
      </div>
    ) : null;

  const header = (
    <div className="flex justify-between gap-4" style={{ borderBottom: `2px solid ${ink}`, marginTop: '16px', marginBottom: '16px', paddingBottom: 16 }}>
      <div className="min-w-0 flex-1">
        <h1 style={{ fontSize: '22pt', fontWeight: 600, color: ink, letterSpacing: '0.5px' }}>
          {(p.name || '').trim() || 'Ihr Name'}
        </h1>
        {p.headline?.trim() ? <p style={{ fontSize: '10pt', color: '#555', marginTop: 4 }}>{p.headline.trim()}</p> : null}
        <div style={{ marginTop: 8 }}>
          {labelRow('Adresse:', p.location)}
          {labelRow('Telefon:', p.phone)}
          {p.email?.trim() ? (
            <div style={{ fontSize: '8.5pt', lineHeight: 1.6 }}>
              <span style={{ fontWeight: 'bold', display: 'inline-block', minWidth: 130 }}>E-Mail:</span>
              <a href={`mailto:${p.email.trim()}`} style={{ color: ink }}>
                {p.email.trim()}
              </a>
            </div>
          ) : null}
          {p.linkedin?.trim() ? (
            <div style={{ fontSize: '8.5pt', lineHeight: 1.6 }}>
              <span style={{ fontWeight: 'bold', display: 'inline-block', minWidth: 130 }}>LinkedIn:</span>
              <a
                href={p.linkedin.trim().startsWith('http') ? p.linkedin.trim() : `https://${p.linkedin.trim()}`}
                style={{ color: ink }}
                target="_blank"
                rel="noreferrer"
              >
                {p.linkedin.trim()}
              </a>
            </div>
          ) : null}
          {p.github?.trim() ? (
            <div style={{ fontSize: '8.5pt', lineHeight: 1.6 }}>
              <span style={{ fontWeight: 'bold', display: 'inline-block', minWidth: 130 }}>GitHub:</span>
              <a
                href={p.github.trim().startsWith('http') ? p.github.trim() : `https://${p.github.trim()}`}
                style={{ color: ink }}
                target="_blank"
                rel="noreferrer"
              >
                {p.github.trim()}
              </a>
            </div>
          ) : null}
          {showWebsite && p.website?.trim() ? (
            <div style={{ fontSize: '8.5pt', lineHeight: 1.6 }}>
              <span style={{ fontWeight: 'bold', display: 'inline-block', minWidth: 130 }}>Website:</span>
              <a
                href={p.website.trim().startsWith('http') ? p.website.trim() : `https://${p.website.trim()}`}
                style={{ color: ink }}
                target="_blank"
                rel="noreferrer"
              >
                {p.website.trim()}
              </a>
            </div>
          ) : null}
          {showPortfolio && p.portfolio?.trim() ? (
            <div style={{ fontSize: '8.5pt', lineHeight: 1.6 }}>
              <span style={{ fontWeight: 'bold', display: 'inline-block', minWidth: 130 }}>Portfolio:</span>
              <a
                href={p.portfolio.trim().startsWith('http') ? p.portfolio.trim() : `https://${p.portfolio.trim()}`}
                style={{ color: ink }}
                target="_blank"
                rel="noreferrer"
              >
                {p.portfolio.trim()}
              </a>
            </div>
          ) : null}
          {labelRow('Geburtsdatum:', p.dateOfBirth)}
          {labelRow('Geburtsort:', p.placeOfBirth)}
          {labelRow('Staatsangehörigkeit:', p.nationality)}
          {labelRow('Familienstand:', p.maritalStatus)}
          {labelRow('Führerschein:', p.drivingLicence)}
          {personalExtrasBlock(p.extras, { textColor: ink, linkColor: ink })}
        </div>
      </div>
      <div className="shrink-0">
        {p.photoUrl?.trim() ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.photoUrl.trim()}
            alt=""
            width={90}
            height={120}
            style={{ objectFit: 'cover', objectPosition: 'top center', border: '1px solid #ccc', display: 'block' }}
          />
        ) : (
          <div
            style={{
              width: 90,
              height: 120,
              background: '#f0f0f0',
              border: '1px solid #ccc',
              textAlign: 'center',
              fontSize: '7.5pt',
              color: '#888',
              paddingTop: 50,
            }}
          >
            Bewerbungsfoto
          </div>
        )}
      </div>
    </div>
  );

  const beruf = (
    <>
      <DeSectionHeader title="Berufserfahrung" />
      <div style={{ fontSize: '9.5pt', color: ink }}>
        {data.experience.items.map((x) => (
          <div
            key={x.id}
            id={`cv-preview-experience-item-${x.id}`}
            className={cn('mb-3 pb-3', experienceItemWrapClass(activeSection, x.id))}
            style={{
              display: 'flex',
              gap: '16px',
              marginBottom: '12px',
              paddingBottom: '12px',
              borderBottom: '1px solid #e8e8e8',
            }}
          >
            <div
              style={{
                width: '110px',
                flexShrink: 0,
                fontSize: '8.5pt',
                color: '#555',
                paddingTop: '1px',
                lineHeight: '1.4',
              }}
            >
              {formatDeDate(x.startDate)}
              <br />–<br />
              {x.current ? 'heute' : formatDeDate(x.endDate)}
            </div>
            <div className="min-w-0 flex-1">
              <div style={{ fontWeight: '600', fontSize: '9.5pt' }}>{x.title}</div>
              <div style={{ fontSize: '8.5pt', color: '#555', fontStyle: 'italic', marginBottom: '4px' }}>
                {x.company}
                {x.location?.trim() ? `, ${x.location.trim()}` : ''}
              </div>
              {intlExpBulletList(x.bullets)}
            </div>
          </div>
        ))}
      </div>
    </>
  );

  const ausbildung = (
    <>
      <DeSectionHeader title="Ausbildung" />
      <div>
        {data.education.items.map((e) => (
          <div key={e.id} className="mb-3 flex" style={{ borderBottom: '1px solid #e0e0e0', paddingBottom: 8 }}>
            <div style={{ width: 120, fontSize: '8.5pt', color: '#555' }}>{formatEduRange(e.startYear, e.endYear)}</div>
            <div className="flex-1">
              <p style={{ fontWeight: 'bold' }}>{e.degree}</p>
              <p style={{ fontStyle: 'italic', color: '#444' }}>{e.school}</p>
              {e.field?.trim() ? <p>{e.field}</p> : null}
              {e.grade?.trim() ? <p>{e.grade}</p> : null}
            </div>
          </div>
        ))}
      </div>
    </>
  );

  const kennt = (
    <>
      <DeSectionHeader title="Kenntnisse" />
      {data.skills.categories.map((c) => (
        <div key={c.id} style={{ marginBottom: '5px', fontSize: '8.5pt' }}>
          <span style={{ fontWeight: '600' }}>{c.name}:</span> {c.skills.join(', ')}
        </div>
      ))}
    </>
  );

  const sprachen = (
    <>
      <DeSectionHeader title="Sprachen" />
      {data.languages.map((l) => (
        <div key={l.id} style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '3px', fontSize: '8.5pt' }}>
          <span style={{ fontWeight: '600', width: '100px' }}>{l.language.trim()}:</span>
          <span>
            {l.listening?.trim() || l.reading?.trim()
              ? `${l.reading?.trim() || l.listening?.trim()} (CEFR)`
              : l.proficiency === 'Native'
                ? 'Muttersprache'
                : l.proficiency}
          </span>
        </div>
      ))}
    </>
  );

  const projDe =
    data.projects.length > 0 ? (
      <>
        <DeSectionHeader title="Projekte" />
        <div style={{ fontSize: '9.5pt', color: ink }}>
          {data.projects.map((proj) => (
            <div key={proj.id} style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: '600' }}>{proj.name || 'Projekt'}</div>
              {proj.description?.trim() ? <p style={{ marginTop: 4, marginBottom: 0 }}>{proj.description.trim()}</p> : null}
              {proj.url?.trim() ? (
                <p style={{ marginTop: 4, marginBottom: 0 }}>
                  <a
                    href={proj.url.trim().startsWith('http') ? proj.url.trim() : `https://${proj.url.trim()}`}
                    style={{ color: ink }}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {proj.url.trim()}
                  </a>
                </p>
              ) : null}
              {intlProjBulletList(proj.bullets)}
            </div>
          ))}
        </div>
      </>
    ) : null;

  const achDe =
    data.achievements.some((a) => a.title.trim() || a.issuer.trim() || a.date.trim() || a.detail?.trim()) ? (
      <>
        <DeSectionHeader title="Auszeichnungen" />
        <div style={{ fontSize: '9.5pt', color: ink }}>
          {data.achievements
            .filter((a) => a.title.trim() || a.issuer.trim() || a.date.trim() || a.detail?.trim())
            .map((a) => (
              <div key={a.id} style={{ marginBottom: 10 }}>
                <div style={{ fontWeight: '600' }}>{a.title}</div>
                <div style={{ fontSize: '8.5pt', color: '#555' }}>{[a.issuer, a.date].filter(Boolean).join(' · ')}</div>
                {a.detail?.trim() ? <p style={{ marginTop: 4, marginBottom: 0 }}>{a.detail.trim()}</p> : null}
              </div>
            ))}
        </div>
      </>
    ) : null;

  const zert = data.certifications.some((c) => c.name.trim() || c.url.trim()) ? (
    <>
      <DeSectionHeader title="Zertifikate" />
      {data.certifications
        .filter((c) => c.name.trim() || c.issuer.trim() || c.date.trim() || c.url.trim())
        .map((c) => (
          <div key={c.id} style={{ marginBottom: 6 }}>
            {intlCertNameBlock(c, ink)}
          </div>
        ))}
    </>
  ) : null;

  const hobb = p.hobbies?.trim() ? (
    <>
      <DeSectionHeader title="Hobbys & Interessen" />
      <p style={{ fontSize: '9pt' }}>{p.hobbies.trim()}</p>
    </>
  ) : null;

  const refs =
    data.references.length > 0 ? (
      <>
        <DeSectionHeader title="Referenzen" />
        {data.references.map((r) => (
          <div key={r.id} className="mb-3" style={{ fontSize: '8.5pt' }}>
            <p style={{ fontWeight: 'bold' }}>{r.name}</p>
            <p>
              {r.title}
              {r.company ? `, ${r.company}` : ''}
            </p>
            {r.email?.trim() ? (
              <p>
                <a href={`mailto:${r.email}`}>{r.email}</a>
              </p>
            ) : null}
            {r.phone?.trim() ? <p>{r.phone}</p> : null}
          </div>
        ))}
      </>
    ) : (
      <>
        <DeSectionHeader title="Referenzen" />
        <p style={{ fontStyle: 'italic', fontSize: '8.5pt', color: '#555' }}>Referenzen auf Anfrage erhältlich.</p>
      </>
    );

  const sign = (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginTop: '24px',
        paddingTop: '12px',
        borderTop: '1px solid #e0e0e0',
        fontSize: '8.5pt',
        color: '#555',
      }}
    >
      <div>{p.location?.trim() ? `${p.location.trim()}, ` : ''}_______________</div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ borderTop: '1px solid #888', paddingTop: '4px', marginTop: '24px', fontSize: '7.5pt', color: '#888', fontStyle: 'italic' }}>
          Unterschrift
        </div>
      </div>
    </div>
  );

  return (
    <div
      className="box-border min-w-0 w-full bg-white antialiased"
      style={{
        fontFamily: '"Source Sans 3", "Segoe UI", Arial, sans-serif',
        fontSize: '9.5pt',
        color: ink,
        background: '#fff',
        padding: '28px 34px',
        maxWidth: '794px',
        margin: '0 auto',
        lineHeight: '1.5',
      }}
    >
      {vis('personal')
        ? sectionBox('personal', activeSection, 'mb-2', header, diffSection, diffChangedFields, onAcceptDiff, onRejectDiff)
        : null}
      {vis('experience')
        ? sectionBox(
            'experience',
            activeSection,
            'mb-2',
            beruf,
            diffSection,
            diffChangedFields,
            onAcceptDiff,
            onRejectDiff,
            experienceOuterSectionActive,
          )
        : null}
      {vis('education')
        ? sectionBox('education', activeSection, 'mb-2', ausbildung, diffSection, diffChangedFields, onAcceptDiff, onRejectDiff)
        : null}
      {vis('skills') ? sectionBox('skills', activeSection, 'mb-2', kennt, diffSection, diffChangedFields, onAcceptDiff, onRejectDiff) : null}
      {vis('languages')
        ? sectionBox('languages', activeSection, 'mb-2', sprachen, diffSection, diffChangedFields, onAcceptDiff, onRejectDiff)
        : null}
      {vis('projects') && projDe
        ? sectionBox('projects', activeSection, 'mb-2', projDe, diffSection, diffChangedFields, onAcceptDiff, onRejectDiff)
        : null}
      {vis('achievements') && achDe
        ? sectionBox('achievements', activeSection, 'mb-2', achDe, diffSection, diffChangedFields, onAcceptDiff, onRejectDiff)
        : null}
      {zert ? sectionBox('certifications', activeSection, 'mb-2', zert, diffSection, diffChangedFields, onAcceptDiff, onRejectDiff) : null}
      {hobb ? <div className="mb-2">{hobb}</div> : null}
      {sectionBox('references', activeSection, 'mb-2', refs, diffSection, diffChangedFields, onAcceptDiff, onRejectDiff)}
      {sign}
    </div>
  );
}

const UK_SLATE = '#1f3a4a';

/** UK CV — no photo, no sensitive personal fields */
export function UkDoc({
  data,
  activeSection,
  sectionVisibility,
  diffSection,
  diffChangedFields,
  onAcceptDiff,
  onRejectDiff,
}: IntlDocBaseProps) {
  const v = sectionVisibility;
  const vis = (key: string) => isCvSectionVisible(key, v);
  const p = data.personal;
  const { showWebsite, showPortfolio } = websitePortfolioRowVisibility(p);

  const header = (
    <div style={{ borderBottom: `2px solid ${UK_SLATE}`, paddingBottom: '10px', marginBottom: '12px' }}>
      <h1 style={{ fontSize: '20pt', fontWeight: 700, color: UK_SLATE, margin: 0, letterSpacing: '0.3px' }}>
        {(p.name || '').trim() || 'Your Name'}
      </h1>
      {p.headline?.trim() ? (
        <div style={{ fontSize: '10pt', color: '#555', fontStyle: 'italic', marginTop: '3px' }}>{p.headline.trim()}</div>
      ) : null}
      <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', fontSize: '8.5pt', color: '#444', gap: '0' }}>
        {[
          p.location?.trim(),
          p.phone?.trim(),
          p.email?.trim() ? (
            <a key="em" href={`mailto:${p.email.trim()}`} style={{ color: UK_SLATE }}>
              {p.email.trim()}
            </a>
          ) : null,
          p.linkedin?.trim() ? (
            <a
              key="li"
              href={p.linkedin.trim().startsWith('http') ? p.linkedin.trim() : `https://${p.linkedin.trim()}`}
              style={{ color: UK_SLATE }}
              target="_blank"
              rel="noreferrer"
            >
              LinkedIn
            </a>
          ) : null,
          p.github?.trim() ? (
            <a
              key="gh"
              href={p.github.trim().startsWith('http') ? p.github.trim() : `https://${p.github.trim()}`}
              style={{ color: UK_SLATE }}
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
          ) : null,
          showWebsite && p.website?.trim() ? (
            <a
              key="web"
              href={p.website.trim().startsWith('http') ? p.website.trim() : `https://${p.website.trim()}`}
              style={{ color: UK_SLATE }}
              target="_blank"
              rel="noreferrer"
            >
              Website
            </a>
          ) : null,
          showPortfolio && p.portfolio?.trim() ? (
            <a
              key="pf"
              href={p.portfolio.trim().startsWith('http') ? p.portfolio.trim() : `https://${p.portfolio.trim()}`}
              style={{ color: UK_SLATE }}
              target="_blank"
              rel="noreferrer"
            >
              Portfolio
            </a>
          ) : null,
        ]
          .filter(Boolean)
          .map((bit, i, arr) => (
            <Fragment key={i}>
              {i > 0 ? <span style={{ margin: '0 6px', color: '#999' }}>|</span> : null}
              {bit}
            </Fragment>
          ))}
      </div>
      {personalExtrasBlock(p.extras, { textColor: '#444', linkColor: UK_SLATE })}
    </div>
  );

  const profile =
    data.summary.text.trim() && vis('summary') ? (
      <>
        <UkSectionHeader title="Personal profile" />
        <p style={{ fontSize: '9.5pt', lineHeight: '1.75', color: '#1a1a1a', margin: 0 }}>{ukProfileLines(data.summary.text.trim())}</p>
      </>
    ) : null;

  const keySkills = (
    <>
      <UkSectionHeader title="Key skills" />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 24px' }}>
        {data.skills.categories.map((c) => (
          <div key={c.id} style={{ flex: '1 1 45%', minWidth: '180px', marginBottom: '6px', fontSize: '8.5pt' }}>
            <div style={{ fontWeight: 'bold', color: UK_SLATE, marginBottom: '2px' }}>{c.name}</div>
            <div style={{ color: '#333' }}>{c.skills.join(', ')}</div>
          </div>
        ))}
      </div>
    </>
  );

  const exp = (
    <>
      <UkSectionHeader title="Work experience" />
      {data.experience.items.map((x) => (
        <div
          key={x.id}
          id={`cv-preview-experience-item-${x.id}`}
          className={experienceItemWrapClass(activeSection, x.id)}
          style={{ marginBottom: '14px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontWeight: 'bold', fontSize: '9.5pt', color: '#1a1a1a' }}>{x.title}</div>
            <div style={{ fontSize: '8.5pt', color: '#555', flexShrink: 0 }}>
              {formatUkDate(x.startDate)} – {x.current ? 'Present' : formatUkDate(x.endDate)}
            </div>
          </div>
          <div style={{ fontSize: '9pt', color: UK_SLATE, fontStyle: 'italic', marginBottom: '4px' }}>
            {x.company}
            {x.location?.trim() ? `, ${x.location.trim()}` : ''}
          </div>
          {intlExpBulletList(x.bullets)}
        </div>
      ))}
    </>
  );

  const projectsUk =
    data.projects.length > 0 && vis('projects') ? (
      <>
        <UkSectionHeader title="Projects" />
        <div style={{ fontSize: '8.5pt', color: '#1a1a1a' }}>
          {data.projects.map((proj) => (
            <div key={proj.id} style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 'bold', color: UK_SLATE }}>{proj.name || 'Project'}</div>
              {proj.description?.trim() ? <p style={{ marginTop: 4, marginBottom: 0 }}>{proj.description.trim()}</p> : null}
              {proj.url?.trim() ? (
                <p style={{ marginTop: 4, marginBottom: 0 }}>
                  <a
                    href={proj.url.trim().startsWith('http') ? proj.url.trim() : `https://${proj.url.trim()}`}
                    style={{ color: UK_SLATE }}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {proj.url.trim()}
                  </a>
                </p>
              ) : null}
              {intlProjBulletList(proj.bullets)}
            </div>
          ))}
        </div>
      </>
    ) : null;

  const edu = (
    <>
      <UkSectionHeader title="Education" />
      {data.education.items.map((e) => (
        <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '9pt' }}>{e.school}</div>
            <div style={{ fontSize: '8.5pt', color: '#444', fontStyle: 'italic' }}>
              {[e.degree, e.field].filter(Boolean).join(', ')}
              {e.grade?.trim() ? ` · ${e.grade.trim()}` : ''}
            </div>
          </div>
          <div style={{ fontSize: '8.5pt', color: '#555', flexShrink: 0, textAlign: 'right' }}>
            {e.startYear && e.endYear ? `${e.startYear} – ${e.endYear}` : e.endYear || e.startYear}
          </div>
        </div>
      ))}
    </>
  );

  const ach =
    data.achievements.some((a) => a.title.trim() || a.issuer.trim() || a.date.trim() || a.detail?.trim()) && vis('achievements') ? (
      <>
        <UkSectionHeader title="Achievements & awards" />
        {data.achievements
          .filter((a) => a.title.trim() || a.issuer.trim() || a.date.trim() || a.detail?.trim())
          .map((a) => (
            <div key={a.id} style={{ fontSize: '8.5pt', marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontWeight: 'bold' }}>{a.title}</span>
                <span style={{ flexShrink: 0, color: '#555' }}>{[a.issuer, a.date].filter(Boolean).join(' · ')}</span>
              </div>
              {a.detail?.trim() ? <p style={{ marginTop: 4, marginBottom: 0, lineHeight: 1.65 }}>{a.detail.trim()}</p> : null}
            </div>
          ))}
      </>
    ) : null;

  const certs =
    data.certifications.some((c) => c.name.trim() || c.issuer.trim() || c.date.trim() || c.url.trim()) && vis('certifications') ? (
      <>
        <UkSectionHeader title="Certifications & professional development" />
        {data.certifications
          .filter((c) => c.name.trim() || c.issuer.trim() || c.date.trim() || c.url.trim())
          .map((c) => (
            <div key={c.id} style={{ fontSize: '8.5pt', marginBottom: 8 }}>
              {intlCertNameBlock(c, UK_SLATE)}
            </div>
          ))}
      </>
    ) : null;

  const langs =
    data.languages.length > 0 && vis('languages') ? (
      <>
        <UkSectionHeader title="Languages" />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 20px' }}>
          {data.languages.map((l) => (
            <span key={l.id} style={{ fontSize: '8.5pt' }}>
              <strong>{l.language.trim()}</strong> ({l.proficiency})
            </span>
          ))}
        </div>
      </>
    ) : null;

  const refs =
    data.references.length > 0 ? (
      <>
        <UkSectionHeader title="References" />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 32px' }}>
          {data.references.map((r) => (
            <div key={r.id} style={{ flex: '1 1 200px', minWidth: '180px', fontSize: '8.5pt', marginBottom: '8px' }}>
              <div style={{ fontWeight: 'bold', fontSize: '9pt', color: UK_SLATE }}>{r.name}</div>
              <div style={{ color: '#444' }}>{r.title}</div>
              <div style={{ color: '#444' }}>{r.company}</div>
              {r.email?.trim() ? (
                <div style={{ color: UK_SLATE }}>
                  <a href={`mailto:${r.email}`}>{r.email}</a>
                </div>
              ) : null}
              {r.phone?.trim() ? <div style={{ color: '#555' }}>{r.phone}</div> : null}
            </div>
          ))}
        </div>
      </>
    ) : (
      <>
        <UkSectionHeader title="References" />
        <p style={{ fontStyle: 'italic', fontSize: '8.5pt', color: '#555', margin: 0 }}>References available upon request.</p>
      </>
    );

  return (
    <div
      className="box-border min-w-0 w-full bg-white antialiased"
      style={{
        fontFamily: '"Libre Baskerville", Georgia, "Times New Roman", serif',
        fontSize: '9.5pt',
        color: '#1a1a1a',
        background: '#fff',
        padding: '26px 34px',
        maxWidth: '794px',
        margin: '0 auto',
        lineHeight: '1.5',
      }}
    >
      {vis('personal')
        ? sectionBox('personal', activeSection, 'mb-2', header, diffSection, diffChangedFields, onAcceptDiff, onRejectDiff)
        : null}
      {vis('summary') && profile
        ? sectionBox('summary', activeSection, 'mb-2', profile, diffSection, diffChangedFields, onAcceptDiff, onRejectDiff)
        : null}
      {vis('skills') ? sectionBox('skills', activeSection, 'mb-2', keySkills, diffSection, diffChangedFields, onAcceptDiff, onRejectDiff) : null}
      {vis('experience')
        ? sectionBox(
            'experience',
            activeSection,
            'mb-2',
            exp,
            diffSection,
            diffChangedFields,
            onAcceptDiff,
            onRejectDiff,
            experienceOuterSectionActive,
          )
        : null}
      {projectsUk ? sectionBox('projects', activeSection, 'mb-2', projectsUk, diffSection, diffChangedFields, onAcceptDiff, onRejectDiff) : null}
      {vis('education')
        ? sectionBox('education', activeSection, 'mb-2', edu, diffSection, diffChangedFields, onAcceptDiff, onRejectDiff)
        : null}
      {ach ? sectionBox('achievements', activeSection, 'mb-2', ach, diffSection, diffChangedFields, onAcceptDiff, onRejectDiff) : null}
      {certs ? sectionBox('certifications', activeSection, 'mb-2', certs, diffSection, diffChangedFields, onAcceptDiff, onRejectDiff) : null}
      {langs ? sectionBox('languages', activeSection, 'mb-2', langs, diffSection, diffChangedFields, onAcceptDiff, onRejectDiff) : null}
      {sectionBox('references', activeSection, 'mb-2', refs, diffSection, diffChangedFields, onAcceptDiff, onRejectDiff)}
    </div>
  );
}
