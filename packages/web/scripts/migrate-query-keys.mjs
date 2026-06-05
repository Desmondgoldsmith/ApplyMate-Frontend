import fs from 'node:fs';
import path from 'node:path';

const srcRoot = path.resolve('src');
const skip = new Set([path.normalize(path.join(srcRoot, 'lib', 'queryKeys.ts'))]);

const replacements = [
  [/\['cv-profiles'\]/g, 'queryKeys.cv.profiles()'],
  [/\['cv-profile',\s*([^\]]+)\]/g, 'queryKeys.cv.profile($1)'],
  [/\['cv-profile'\]/g, 'queryKeys.cv.profileDefault()'],
  [/\['cv-sections',\s*true,\s*([^\]]+)\]/g, 'queryKeys.cv.sections($1)'],
  [/\['cv-sections',\s*false\]/g, 'queryKeys.cv.sectionsActive(false)'],
  [/\['cv-sections',\s*true\]/g, 'queryKeys.cv.sectionsActive(true)'],
  [/\['cv-sections',\s*([^\]]+)\]/g, 'queryKeys.cv.sections($1)'],
  [/\['cv-sections'\]/g, 'queryKeys.cv.sectionsRoot()'],
  [/\['cv',\s*'score',\s*([^\]]+)\]/g, 'queryKeys.cv.score($1)'],
  [/\['cv',\s*'score'\]/g, 'queryKeys.cv.scoreRoot()'],
  [/\['cv-section-order-suggest',\s*([^\]]+)\]/g, 'queryKeys.cv.sectionOrderSuggest($1)'],

  [/\['job-analyses',\s*'listing',\s*([^\]]+)\]/g, 'queryKeys.jobs.analysesListing($1)'],
  [/\['job-analyses'\]/g, 'queryKeys.jobs.analyses()'],
  [/\['job-analysis-current'\]/g, 'queryKeys.jobs.analysisCurrent()'],
  [/\['job-history',\s*'page',\s*([^,]+),\s*([^\]]+)\]/g, 'queryKeys.jobs.historyPage($1, $2)'],
  [/\['job-history',\s*([^,]+),\s*([^,]+),\s*([^\]]+)\]/g, 'queryKeys.jobs.historyWithPagination($1, $2, $3)'],
  [/\['job-history',\s*true\]/g, 'queryKeys.jobs.history(true)'],
  [/\['job-history',\s*false\]/g, 'queryKeys.jobs.history(false)'],
  [/\['job-history'\]/g, 'queryKeys.jobs.history()'],
  [/\['job-generated',\s*([^\]]+)\]/g, 'queryKeys.jobs.generated($1)'],
  [/\['job-apply-url',\s*([^\]]+)\]/g, 'queryKeys.jobs.applyUrl($1)'],
  [/\['job-discovery-detail',\s*([^\]]+)\]/g, 'queryKeys.jobs.discoveryDetail($1)'],
  [/\['job-discovery',\s*([^\]]+)\]/g, 'queryKeys.jobs.discovery($1)'],
  [/\['job-discovery'\]/g, "queryKeys.jobs.discovery({})"],
  [/\['job-board-over-quota-reuse',\s*([^,]+),\s*([^\]]+)\]/g, 'queryKeys.jobs.boardOverQuotaReuse($1, $2)'],
  [/\['job-board-quota-fit',\s*([^,]+),\s*([^,]+),\s*([^\]]+)\]/g, 'queryKeys.jobs.boardQuotaFit($1, $2, $3)'],
  [/\['job-board-ai-match',\s*([^,]+),\s*([^\]]+)\]/g, 'queryKeys.jobs.boardAiMatch($1, $2)'],
  [/\['job',\s*([^\]]+)\]/g, 'queryKeys.jobs.analysis($1)'],

  [/\['applications'\]/g, 'queryKeys.applications.root()'],
  [/\['hub-bookmarks'\]/g, 'queryKeys.hub.bookmarks()'],
  [/\['hub-reminders'\]/g, 'queryKeys.hub.remindersRoot()'],
  [/\['hub-notes'\]/g, 'queryKeys.hub.notesRoot()'],
  [/\['hub-notes',\s*'application',\s*([^\]]+)\]/g, 'queryKeys.hub.notesApplication($1)'],
  [/\['hub-notes',\s*'job-analysis',\s*([^\]]+)\]/g, 'queryKeys.hub.notesJobAnalysis($1)'],
  [/\['hub-notes',\s*'bookmark',\s*([^\]]+)\]/g, 'queryKeys.hub.notesBookmark($1)'],
  [/\['hub-notes',\s*'global',\s*([^\]]+)\]/g, 'queryKeys.hub.notesGlobal($1)'],

  [/\['me',\s*([^\]]+)\]/g, 'queryKeys.auth.me($1)'],
  [/\['me'\]/g, 'queryKeys.auth.me()'],
  [/\['analytics',\s*([^\]]+)\]/g, 'queryKeys.analytics.root($1)'],
  [/\['analytics'\]/g, 'queryKeys.analytics.root()'],
  [/\['career',\s*'dashboard'\]/g, 'queryKeys.career.dashboard()'],
  [/\['career-goals'\]/g, 'queryKeys.career.goals()'],

  [/\['growth',\s*'daily-direction'\]/g, 'queryKeys.growth.dailyDirection()'],
  [/\['growth',\s*'progress',\s*([^\]]+)\]/g, 'queryKeys.growth.progress($1)'],
  [/\['growth',\s*'momentum-nudges'\]/g, 'queryKeys.growth.momentumNudges()'],
  [/\['growth',\s*'achievements'\]/g, 'queryKeys.growth.achievements()'],
  [/\['growth'\]/g, 'queryKeys.growth.root()'],

  [/\['interview-sessions'\]/g, 'queryKeys.interview.sessions()'],
  [/\['interview-session',\s*([^\]]+)\]/g, 'queryKeys.interview.session($1)'],
  [/\['interview-result',\s*([^\]]+)\]/g, 'queryKeys.interview.result($1)'],
  [/\['interview-prep',\s*'progress'\]/g, 'queryKeys.interviewPrep.progress()'],
  [/\['interview-prep',\s*'quota'\]/g, 'queryKeys.interviewPrep.quota()'],
  [/\['interview-prep',\s*'adaptive-profile'\]/g, 'queryKeys.interviewPrep.adaptiveProfile()'],
  [/\['interview-prep',\s*'skill-profile'\]/g, 'queryKeys.interviewPrep.skillProfile()'],
  [/\['interview-prep',\s*'session',\s*([^\]]+)\]/g, 'queryKeys.interviewPrep.session($1)'],
  [/\['interview-prep',\s*'turns',\s*([^\]]+)\]/g, 'queryKeys.interviewPrep.turns($1)'],
  [/\['interview-prep',\s*'plan',\s*([^\]]+)\]/g, 'queryKeys.interviewPrep.plan($1)'],
  [/\['interview-prep',\s*'simulation-state',\s*([^\]]+)\]/g, 'queryKeys.interviewPrep.simulationState($1)'],

  [/\['onboarding',\s*'status',\s*([^\]]+)\]/g, 'queryKeys.onboarding.status($1)'],
  [/\['onboarding',\s*'cv-default-profile',\s*([^\]]+)\]/g, 'queryKeys.onboarding.cvDefaultProfile($1)'],

  [/\['cv',\s*'profile',\s*([^,]+),\s*'sections'\]/g, 'queryKeys.cv.sections($1)'],
  [/\['cv',\s*'profile',\s*([^\]]+)\]/g, 'queryKeys.cv.profile($1)'],
];

function walk(dir, files = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) {
      if (name === 'node_modules' || name === '.next') continue;
      walk(p, files);
    } else if (/\.(ts|tsx)$/.test(name)) {
      files.push(p);
    }
  }
  return files;
}

function ensureImport(text) {
  if (text.includes("from '@/lib/queryKeys'")) return text;
  const line = "import { queryKeys } from '@/lib/queryKeys';\n";
  const m = text.match(/^'use client';\r?\n\r?\n/);
  if (m) return text.replace(m[0], `${m[0]}${line}`);
  return line + text;
}

let n = 0;
for (const file of walk(srcRoot)) {
  if (skip.has(path.normalize(file))) continue;
  let text = fs.readFileSync(file, 'utf8');
  if (!/\['(?:cv|job|hub|me|analytics|growth|interview|applications|onboarding)/.test(text)) {
    continue;
  }
  const before = text;
  for (const [re, rep] of replacements) {
    text = text.replace(re, rep);
  }
  if (text === before) continue;
  text = ensureImport(text);
  fs.writeFileSync(file, text);
  n++;
}
console.log('Updated', n, 'files');
