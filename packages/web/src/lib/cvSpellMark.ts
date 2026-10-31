import type { CvSpellIssue } from '@/lib/api';

/** Red wavy underline under just the flagged word, like a word processor. */
export const SPELL_MARK_CLASS =
  'underline decoration-wavy decoration-[#F04438] decoration-[1.5px] underline-offset-[3px] rounded-[2px]';
const SPELL_MARK_FLASH_CLASS = 'bg-[rgba(240,68,56,0.3)]';
const MARK_ATTR = 'data-cv-spell-mark';

/** The word the checker flagged. */
export function spellIssueWord(issue: CvSpellIssue): string {
  return String(issue.original ?? issue.originalText ?? '').trim();
}

/** Stable key shared by the underline in the CV and the issue in the panel. */
export function spellIssueMarkKey(issue: CvSpellIssue): string {
  const id = String(issue.issueId ?? issue.id ?? '').trim();
  if (id) return id;
  return `${issue.sectionId ?? ''}::${issue.fieldPath ?? 'text'}::${spellIssueWord(issue).toLowerCase()}`;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function unwrapMarks(root: HTMLElement): void {
  for (const mark of Array.from(root.querySelectorAll(`[${MARK_ATTR}]`))) {
    mark.replaceWith(...Array.from(mark.childNodes));
  }
  root.normalize();
}

/** Underlines the first whole-word match of each issue inside `root` (re-run safe). */
export function markSpellIssues(
  root: HTMLElement,
  issues: Array<{ key: string; word: string }>,
): void {
  unwrapMarks(root);
  for (const { key, word } of issues) {
    if (!word) continue;
    const re = new RegExp(
      `(^|[^\\p{L}\\p{N}])(${escapeRegExp(word)})(?=$|[^\\p{L}\\p{N}])`,
      'iu',
    );
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (
      let node = walker.nextNode() as Text | null;
      node;
      node = walker.nextNode() as Text | null
    ) {
      if (node.parentElement?.closest(`[${MARK_ATTR}]`)) continue;
      const m = re.exec(node.data);
      if (!m) continue;
      const start = m.index + m[1]!.length;
      const target = node.splitText(start);
      target.splitText(m[2]!.length);
      const mark = document.createElement('span');
      mark.setAttribute(MARK_ATTR, key);
      mark.className = SPELL_MARK_CLASS;
      target.replaceWith(mark);
      mark.appendChild(target);
      break;
    }
  }
}

/** Scrolls to the underlined word and flashes it. Returns false when it is not on screen. */
export function revealSpellIssue(issue: CvSpellIssue): boolean {
  if (typeof document === 'undefined') return false;
  const key = spellIssueMarkKey(issue);
  const mark = Array.from(
    document.querySelectorAll<HTMLElement>(`[${MARK_ATTR}]`),
  ).find((el) => el.getAttribute(MARK_ATTR) === key);
  if (!mark) return false;
  mark.scrollIntoView({ block: 'center', behavior: 'smooth' });
  mark.classList.add(SPELL_MARK_FLASH_CLASS);
  window.setTimeout(() => mark.classList.remove(SPELL_MARK_FLASH_CLASS), 1800);
  return true;
}
