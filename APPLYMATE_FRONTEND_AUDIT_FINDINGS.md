# ApplyMate Frontend Audit Report

## Executive Summary

ApplyMate’s frontend is **much more than a stub**: the dashboard experience, CV clinic (editing + scoring + improvements), job analyzer (match score + tailoring + cover letter), and interview setup/simulation surfaces are present and wired through React Query hooks and a typed `api` client. The product is **not yet “global SaaS ready”** mainly due to **flow fragmentation (alias routes + multiple legacy paths), heavy client-side complexity in single files, and incomplete evidence of durable subscription gating + lifecycle reliability** (auth/session expiry handling is not obviously centralized in the pieces reviewed). With focused hardening, it could launch to a small beta; for a $1M+ revenue run-rate, the top needs are **(1) workflow polish + consistency across CV↔Jobs↔Interview loop, (2) reliability/observability for errors + session expiry, (3) clear plan gating + upgrade moments at “value peaks.”**

Top 3 must-fix items before a serious launch:
- **Stabilize core loop UX** (CV → analyze job → tailor CV → generate cover letter → job hub tracking → interview practice) so it feels like one coherent product, not separate “zones.”
- **Make error + auth/session expiry handling explicit and consistent** (currently a lot of complex client pages depend on async data; ensure user-facing failures are actionable).
- **Move high-complexity UI logic out of mega-pages** (e.g. `dashboard/page.tsx`, `cv/page.tsx`, `JobsAnalyzeContent.tsx`) to reduce regressions and enable team scaling.

---

## Feature Scorecard

| Feature | Status | Quality (1-10) | User Value (1-10) | Critical Gaps |
|---|---|---:|---:|---|
| CV Builder | **Partially built (strong base)** | 7 | 8 | Confirm all “9 templates”; export formats (DOCX) not evidenced; needs stronger autosave guarantees + robustness |
| AI CV Creation | **Partially built** | 6 | 7 | Chat + upload parsing present; unclear breadth (summary/bullet rewrite coverage) without deeper endpoint scan |
| CV Tailoring | **Partially built (job-driven)** | 7 | 8 | Tailoring is strongly integrated into job analysis; need clearer diff UX and durable “save as new profile” confirmations |
| Job Analyzer | **Built (core)** | 7 | 8 | Salary estimate + skill gap depth not confirmed; depends heavily on AI usage limit behavior |
| Job Board / Discovery | **Partially built** | 6 | 6 | Job board shell exists; need confirm AI discovery + bookmarks + pipeline completeness |
| Interview Preparation | **Partially built (strong UI surface)** | 7 | 7 | Setup stepper exists; voice + adaptive + STAR scoring require deeper verification of runtime wiring |
| Smart Dashboard | **Built (ambitious)** | 7 | 7 | Sophisticated orchestration; risk of “too complex / too AI-written” without strong determinism + caching |
| Onboarding Flow | **Built (multi-path)** | 7 | 7 | Strong: upload/chat/paste/manual paths; needs clearer “aha” + fewer choices upfront |
| Browser Extension Integration | **Present (repo-level)** | 5 | 5 | Extension package exists per repo README; dashboard connection paths not verified in this pass |
| Authentication & User Management | **Partially built** | 6 | 6 | NextAuth routes exist; need verify session expiry UX + protected routing |

---

## How Each Feature Works (What Users Can Do) + How Features Connect

This section explains the **actual user capabilities** and the **cross-feature links** the frontend implements (by route + component), so it’s clear how ApplyMate behaves as a system.

---

## UI Simplicity & “Make It Easier” Recommendations (Feature-by-Feature)

ApplyMate’s frontend already contains many powerful surfaces (CV clinic, analyzer, hub detail tabs, coaching panels). The main UI risk is **cognitive load**: users can feel like they’re in a complex “control room” rather than a guided workflow. Below are concrete techniques to simplify the experience while increasing usefulness.

### Global simplicity principles (apply everywhere)

- **Default to “one obvious next action”**: every page should have one primary CTA that advances the core loop (build CV → analyze job → tailor → apply → follow up → interview practice).
- **Progressive disclosure**: hide advanced knobs (templates, deep coaching, extra tabs) behind “More” or collapsibles until the user has basic momentum.
- **Make the state visible**: always show “where you are” and “what’s next” (e.g., pipeline stage + last saved + next reminder).
- **Keep user artifacts near the action**: job description, tailored resume variant, cover letter, notes, and reminders should feel like one connected workspace.
- **Consistency**: use the same patterns for “generate/edit/save/copy/download” across CV bullets, cover letters, and follow-ups.

### Onboarding (`/onboarding`): reduce choice overload, increase “aha”

- **Current risk**: too many resume-entry paths at once (upload/chat/paste/manual) can delay activation.
- **Make it simpler**
  - Start with a single question: “Do you already have a resume?” → (Upload) or (Build with AI) as the only two primary choices.
  - Move “paste” and “manual” into secondary options (“Other ways”) after the user picks a primary path.
  - Add a clear progress bar that ties onboarding steps to outcomes: “Resume ready → Match score → First follow-up reminder.”
- **Helpful additions**
  - “Skip for now” should still end with a default CV shell and a concrete next action (“Paste a job to get your first match score”).

### CV Clinic (`/dashboard/cv`): turn power tools into a guided workflow

- **Current risk**: rich surfaces (builder + improvements + score + assistants) can feel like multiple products in one page.
- **Make it simpler**
  - Add a “CV Health Checklist” summary at the top (3–5 items) that maps directly to actions (e.g., “Add quantified impact in Experience”).
  - Treat template switching as a **late-stage** action: hide behind “Export settings” rather than front-and-center.
  - Make improvements review more bite-sized: “Fix 3 high-impact items” instead of a long queue.
- **Helpful features / techniques**
  - “Focus mode” editing: when the user opens an improvement, automatically scroll/spotlight the exact field in `CVBuilder`.
  - “Before/after” inline diff for each accepted improvement (reuse the diff language used in tailoring).
  - “Job-targeted editing”: if opened with `jobAnalysisId`, show a pinned “Top 3 missing skills for this job” panel that links to the exact CV section.

### Job Board (`/dashboard/job-board`): unify discovery → analysis → tracking

- **Current risk**: job browsing is valuable only if it smoothly funnels into analysis and Job Hub tracking.
- **Make it simpler**
  - Every listing should have two consistent CTAs: **Analyze** and **Track**.
  - After analyze completes, show a single modal: “Save to Job Hub?” with default “Yes.”
- **Helpful features**
  - “Quick compare” on listings (match score estimate + top 3 missing skills) so users don’t have to analyze every job.

### Job Analyzer (`/dashboard/jobs/analyze`): reduce friction in the “analyze → tailor → cover letter” triangle

- **Current risk**: the analyzer is doing many jobs (analysis, tailoring, cover letter editor, apply URL handling). Users can lose the thread.
- **Make it simpler**
  - Turn the page into a 3-step guided layout:
    - Step 1: Analyze (JD + match score)
    - Step 2: Tailor (suggestions + accept/reject + save as new resume variant)
    - Step 3: Apply assets (cover letter + follow-up templates + apply link)
  - Keep a fixed “Job context header” (title/company + last analyzed + current match score).
- **Helpful features**
  - When AI limit is reached (`DAILY_AI_LIMIT_REACHED_MESSAGE`), show a “graceful continuation panel”:
    - Save what’s done
    - Continue manually (open CV clinic in job context)
    - Upgrade (clear, value-based)

### Job Hub (`/dashboard/jobs`): make it the “single source of truth”

- **Current strength**: the detail panel already supports tabs for analysis/cover/notes/email/resumes.
- **Make it simpler**
  - Default to one “workspace” view per job: a single scroll page with anchored sections instead of many tabs (tabs become quick-jumps).
  - Treat reminders as first-class: show the **next reminder** inline in the list row and in the detail header.
  - Notes should have two modes:
    - “Quick note” (one-liner, fast save)
    - “Log entry” (append-only entries for call notes)
- **Helpful features**
  - “One-click follow-up”: from a due reminder, open the email template already prefilled with context and mark reminder complete.
  - “Next action autoprompt”: after moving stage to “Interview scheduled,” offer “Start interview practice” with one click.

### Interview Prep (`/dashboard/interview` + sessions/history): focus on repeatable practice

- **Current risk**: coaching components are rich; the UX needs to make practice feel lightweight and repeatable.
- **Make it simpler**
  - Single “Start practice” CTA with minimal setup (role + difficulty + persona), advanced options hidden.
  - After each session, show 3 concrete takeaways and 1 targeted drill for tomorrow.
- **Helpful features**
  - Integrate with Job Hub: “Practice for this job” should set the job context and store session links back on the job.

### Onboarding (`/onboarding`)

- **What users can do**
  - Pick their goals / focus areas (e.g., hired vs student) and progress through a 3-step wizard (`OnboardingStep = 1 | 2 | 3`).
  - Create a CV profile if one doesn’t exist yet (default “My resume”), choosing a template.
  - Enter resume data via multiple paths: **template/manual**, **upload**, **chat-based CV creation**, and **paste** flows (states like `cvEntryPhase`, `completionSource`).
- **How it works (flow)**
  - On load, it ensures a default CV profile exists (`onboardingCvProfileQuery`) and invalidates `['cv-profiles']` when creating one.
  - Resume clinic + score surfaces are already present inside onboarding (`OnboardingResumeClinic`, `CVScoreCard`, `CVUploadZone`, `CVChatInterface`, `TemplatePicker`).
- **How it connects**
  - Produces/ensures a CV profile that becomes the shared “resume context” for:
    - **CV Clinic** (`/dashboard/cv`)
    - **Job Analyzer** (`/dashboard/jobs/analyze`) match scoring + tailoring
    - **Job Hub** (`/dashboard/jobs`) where analyzed/bookmarked/tracked jobs live

### Smart Dashboard (`/dashboard`)

- **What users can do**
  - See “today plan” / growth guidance and be routed into next best actions (CV setup → job analysis → follow-ups → interview prep).
- **How it works (flow)**
  - Dashboard composes multiple sections driven by hooks like `useTodayPlan`, `useDailyAiUsage`, `useGrowth*`, plus orchestration utilities (`buildDashboardViewModel`).
  - It personalizes the hero / next steps based on user state (e.g., 0 CV profiles, 0 analyzed jobs).
- **How it connects**
  - Acts as the “mission control” that pushes users into **CV Clinic**, **Jobs Analyze**, **Job Hub**, and **Interview** flows.

### CV Clinic / CV Builder (`/dashboard/cv`)

- **What users can do**
  - Edit a CV using the clinic UI (`CVBuilder`) with supporting surfaces:
    - Scoring (`CVScoreCard`)
    - Improvements queue/panel (`ImprovementsPanel`)
    - AI chat assistance (`AIChatDrawer`)
    - AI section assistant (`AISectionAssistantPanel`)
    - Add sections (`AddSectionModal`)
    - Rename profiles / manage multiple profiles (`useCVProfiles`, `useRenameCVProfile`)
    - Switch templates (`TemplatePickerModal`; session storage remembers per-profile template selection)
    - Export (hook present: `useExportCV`)
- **How it works (flow)**
  - Reads query params to support cross-feature deep links:
    - `cvMode` (including tailor mode)
    - `jobAnalysisId` to load job context alongside editing
    - `tailorDraftId` for tailoring review mode
  - Fetches linked job context with `staleTime: 60_000` when `jobAnalysisId` is present.
- **How it connects**
  - **From Job Analyzer → CV Clinic**: the CV page accepts `jobAnalysisId`/tailor params so a user can jump into editing while keeping job context.
  - **From CV Clinic → Job Analyzer**: editing is intended to improve match scores; the ecosystem includes CV score invalidations and job rematch flows (via shared query invalidation patterns and “tailor mode” in CV route).

### Job Board / Discovery (`/dashboard/job-board`)

- **What users can do**
  - Browse discovered jobs and (likely) open details / analyze / bookmark them (UI lives in `JobBoardContent`).
- **How it works (flow)**
  - The page wraps `JobBoardContent` in a Suspense boundary with a two-column skeleton fallback.
- **How it connects**
  - The downstream destinations for any job listing are typically:
    - **Analyze**: `/dashboard/jobs/analyze` (via listing id / deep links)
    - **Track**: `/dashboard/jobs` (Job Hub) via bookmarks/applications

### Job Analyzer (`/dashboard/jobs/analyze` with aliases)

- **What users can do**
  - Paste a job description, analyze it, see match score and guidance.
  - Generate and manage a **cover letter**:
    - Generated letter displayed
    - Edit mode + save update
    - Copy to clipboard
    - Download PDF (cover-letter PDF helper is used)
    - Persist draft in `localStorage` per job (`applymate:cover-letter:${jobId}`)
  - Start **CV tailoring** from job context (tailor sidebar, tailor draft state), and refresh match score after changes.
  - Continue the workflow into Job Hub tracking (when saved/created entries exist).
- **How it works (flow)**
  - Legacy routes redirect here:
    - `/dashboard/job-analyzer` → `/dashboard/jobs/analyze`
    - `/dashboard/job-hub?focus=tailor&jobId=...` can redirect into analyzer with `openTailor=1`
  - Tailoring state is fingerprinted against the job + selected CV so the app can reset drafts when the context changes (prevents applying stale suggestions).
  - AI usage limit is enforced at the UI decision points via `useDailyAiUsage` + `canUseAiFromDailyAiUsage` + `DAILY_AI_LIMIT_REACHED_MESSAGE`.
- **How it connects**
  - **Analyzer → CV Clinic**: user can pivot from analysis into CV editing (CV route accepts `jobAnalysisId`).
  - **Analyzer → Job Hub**: analyzed jobs become trackable entities; match score and generated content can surface in Job Hub detail tabs.

### Job Hub / Pipeline Tracker (`/dashboard/jobs` with aliases)

- **What users can do**
  - View tracked jobs in **board** or **list** layouts (`JobHubKanban`, `JobHubTable`) and drill into a detailed side panel (`JobHubDetailPanel`).
  - Update pipeline stage (mutations patch pipeline/bookmark stages; invalidates queries like `['job-history']`, `['applications']`, `['hub-reminders']`).
  - Open detail tabs that cover the workflow artifacts:
    - **Match & gaps** tab (`analysis`)
    - **Description**
    - **Cover letter**
    - **Notes**
    - **Email templates**
    - **Resumes**
  - Add **notes** that are persisted as:
    - A primary local notes draft (`applymate:job-hub:notes-local:${jobKey}`)
    - A list of timestamped note entries (`applymate:job-hub:notes-entries:${jobKey}`) with de-duplication and max history
  - Set **reminders**:
    - Stored in `localStorage` under `applymate:job-hub:local-reminders`
    - The hub periodically checks and can trigger browser notifications when due (`notifyDueLocalReminders()` requires Notification permission)
  - Use **follow-up email templates** and generate/edit content (email tab + template options; types like `FollowUpEmailDraft` are present).
- **How it works (flow)**
  - Alias route `/dashboard/job-hub` redirects into `/dashboard/jobs`, and supports deep link routing for:
    - follow-ups: redirects to `/dashboard/follow-up-jobs`
    - tailor focus: redirects to `/dashboard/jobs/analyze?openTailor=1`
  - Background reminder checking runs on an interval (8 seconds) and on focus/visibility changes to surface due items promptly.
- **How it connects**
  - **Job Hub ↔ Job Analyzer**: `prefillJobAnalyzerInStorage` is imported in both Hub and Hub Detail Panel, enabling “re-open analyze with context” flows.
  - **Job Hub ↔ Dashboard**: pipeline changes invalidate growth/today-plan queries so the dashboard stays consistent.

### Interview Preparation (`/dashboard/interview` with aliases + history/session pages)

- **What users can do**
  - Go through an interview setup wizard (`InterviewSetupStepper`) and proceed into live sessions (`/dashboard/interview/[sessionId]`) and review history (`/dashboard/interview/history`).
  - Use coaching/feedback UI surfaces (multiple components exist for live feedback, scoring visuals, coaching panels, personas).
- **How it connects**
  - Dashboard guidance and job progress (Job Hub pipeline) can logically drive users into interview prep next; the routing structure supports quick entry via aliases:
    - `/dashboard/interviews` → `/dashboard/interview`
    - `/dashboard/interview-prep` → `/dashboard/interview`

---

## Detailed End-to-End User Story (Onboarding → “Applied” Loop Completion)

This user story is written as a concrete, end-to-end workflow that exercises **everything a user can do** across ApplyMate’s main features, using the actual routes/components the frontend exposes.

### Persona

**User**: Alex, actively job searching, starting with an older CV and no job tracker.

### Story

1. **Alex signs up / logs in**
   - Alex lands on auth routes (`/login`, `/register`) and enters the app.
   - After authentication, Alex is routed into onboarding and/or dashboard depending on account state.

2. **Onboarding: Alex sets goals and creates a CV profile** (`/onboarding`)
   - Alex selects their focus (e.g., “I’m actively applying”) and advances through the onboarding wizard (`OnboardingStep` state).
   - ApplyMate ensures Alex has a default CV profile (creating “My resume” if needed via `api.cv.createProfile`).
   - Alex chooses a template (via `TemplatePicker`) and proceeds to build their resume using one of these paths:
     - **Upload** a PDF/Doc resume (via `CVUploadZone`) to parse into sections and get an initial score (`CVScoreCard`).
     - Or **chat-build** a resume (via `CVChatInterface`) to generate structured CV content.
     - Or **paste** experience text and let ApplyMate structure it (paste processing states + progress messages).
     - Or **manual** editing via the resume clinic UI.

3. **CV Clinic: Alex edits and improves their CV** (`/dashboard/cv`)
   - Alex opens the CV clinic and selects the CV profile they want to edit (multi-profile support via `useCVProfiles`).
   - Alex edits content in the main builder surface (`CVBuilder`), adds or reorganizes sections (`AddSectionModal`), and uses inline assistance panels:
     - Reviews the CV score (`CVScoreCard`) and iterates to raise it.
     - Opens the improvements panel (`ImprovementsPanel`) to accept/reject suggestions and see progress.
     - Uses AI chat (`AIChatDrawer`) and the section assistant (`AISectionAssistantPanel`) to refine bullets and sections.
   - Alex switches templates to see what reads better (template picker + per-profile template memory via session storage helpers).
   - When ready, Alex exports their resume (export capability is wired through `useExportCV`; PDF-style export is also used elsewhere in the product).

4. **Job Board: Alex searches/browses roles to pursue** (`/dashboard/job-board`)
   - Alex opens the job board page, which loads the main browsing UI (`JobBoardContent`) with a skeleton fallback while data loads.
   - Alex browses roles, filters/opens a listing, and chooses to analyze it (the expected next action is to jump to the analyzer).

5. **Job Analyzer: Alex analyzes a role and gets a match score** (`/dashboard/jobs/analyze`)
   - Alex pastes the job description into the analyzer form (state persisted under `applymate:dashboard:jobs:analyze-form`).
   - ApplyMate calculates a match score and surfaces guidance (match score is part of the `analysis` object; UI includes “Refresh match score” and empty-state copy prompting analysis).
   - If Alex has free AI uses left, the analyzer allows AI-driven generation; if Alex hits the limit, the UI can block and show `DAILY_AI_LIMIT_REACHED_MESSAGE`.

6. **Job Analyzer: Alex tailors their CV to the job**
   - Alex clicks into tailoring (URL can include `openTailor=1` to open directly).
   - ApplyMate creates/loads a tailor draft (`tailorDraft`) and tracks tailoring completion with a fingerprint so changes aren’t applied to the wrong job/CV context.
   - Alex reviews suggested changes and refines the tailored version.
   - After tailoring, Alex refreshes match score to verify improvement (analyzer includes logic to merge scores and keep a baseline during tailoring).

7. **Job Analyzer: Alex generates and edits a cover letter**
   - Alex clicks “Generate cover letter.”
   - ApplyMate renders the letter, stores it in `localStorage` per job (`applymate:cover-letter:${jobId}`), and provides actions:
     - **Edit cover letter** (toggle edit mode, update saved content)
     - **Copy cover letter** to clipboard
     - **Download cover letter PDF** (via `downloadCoverLetterPdf`)
     - Optionally open a mail draft using the cover letter body

8. **Job Hub: Alex tracks the job and manages follow-ups** (`/dashboard/jobs`)
   - Alex opens the Job Hub (board or list view) and sees the analyzed job in their pipeline (`JobHubKanban` / `JobHubTable`).
   - Alex clicks the job to open the detail panel (`JobHubDetailPanel`) and navigates through tabs:
     - **Match & gaps**: revisit analysis and guidance
     - **Description**: keep the JD on hand
     - **Cover letter**: view/download/copy the generated letter for this job
     - **Notes**: capture recruiter calls, interview feedback, pros/cons  
       - Notes are saved locally and appended into a dated notes history (`jobHubNotesEntries.ts`)
     - **Email templates**: generate follow-up emails using templates
     - **Resumes**: keep resume variants associated with the job
   - Alex sets a reminder for the job (e.g., “Follow up in 3 days”):
     - Reminders are stored locally (`jobHubLocalReminders.ts`)
     - If browser notifications are allowed, ApplyMate can show a “due reminder” notification while the hub is open (periodic `notifyDueLocalReminders()` checks).
   - Alex updates pipeline stage as they progress (applied → screening → interview → offer), which triggers query invalidations so dashboard/growth views stay accurate.

9. **Interview Prep: Alex prepares for the interview** (`/dashboard/interview`)
   - Alex starts at the interview setup wizard (`InterviewSetupStepper`) to configure the interview session.
   - Alex runs practice sessions (session routes exist at `/dashboard/interview/[sessionId]`) and later reviews history (`/dashboard/interview/history`).
   - During sessions, Alex receives structured feedback and coaching visuals (live feedback/scoring/coaching components are present in the codebase).

10. **Back to the dashboard: Alex sees updated momentum and next steps** (`/dashboard`)
   - Because Job Hub mutations invalidate growth/today-plan queries, Alex’s dashboard updates:
     - Momentum/progress indicators reflect pipeline movement.
     - The next directive can steer Alex to: tailor the next job, send follow-ups, or continue interview practice.

Outcome: Alex completes the full loop **inside ApplyMate**: onboarding → CV creation/editing → job discovery → analysis → tailoring → cover letter → tracking + notes + reminders → interview prep + session history.

## Evidence-Backed Findings by Feature

### 1) Smart Dashboard

- **Status**: Fully built (complex client page)
- **How it works (high level)**:
  - Dashboard is a client route (`'use client'`) and composes many “growth” / “plan” / “pipeline” sections. Evidence: imports include `useTodayPlan`, `useDailyAiUsage`, `useGrowth*`, orchestration helpers like `buildDashboardViewModel`.  
  - Personalised hero copy changes based on CV/profile + job analysis counts. Evidence: `getPersonalisedSubtext()` in `packages/web/src/app/(dashboard)/dashboard/page.tsx` lines 202-213.
- **Quality**: High ambition; comparable to “coach dashboards” but risks being over-orchestrated and hard to maintain.
- **Gaps**:
  - **God component risk**: `packages/web/src/app/(dashboard)/dashboard/page.tsx` is extremely large (read shows “...2695 lines not shown...”), which raises regression and performance risk.
  - Needs explicit proof of deterministic caching strategy; current approach mixes many derived view-model utilities.
- **User value score**: 7/10 (could be 9/10 if it reliably drives users into the core loop with clear next actions).

Key evidence:

```1:120:packages/web/src/app/(dashboard)/dashboard/page.tsx
'use client';
import { useTodayPlan } from '@/hooks/useTodayPlan';
import { useDailyAiUsage } from '@/hooks/useDailyAiUsage';
import {
  useGrowthAchievements,
  useGrowthDailyDirection,
  useGrowthMomentumNudges,
  useGrowthProgress,
} from '@/hooks/useGrowth';
import { buildDashboardViewModel } from '@/lib/dashboardViewModel';
// ...
function getPersonalisedSubtext(cvProfileCount: number, totalJobsAnalyzed: number): string {
  if (cvProfileCount === 0) {
    return "Let's get your CV set up — it takes less than 2 minutes.";
  }
  if (totalJobsAnalyzed === 0) {
    return 'Your CV is ready. Paste a job description to see how well you match.';
  }
  return `You've analyzed ${totalJobsAnalyzed} jobs. Keep going.`;
}
```

---

### 2) Onboarding Flow (Goals + Resume + Setup)

- **Status**: Built (multi-path resume intake)
- **How it works (observed)**:
  - Onboarding page is a client route and contains step logic (`OnboardingStep = 1 | 2 | 3`) plus multiple CV entry phases (template/upload/chat/paste/manual). Evidence: `packages/web/src/app/(onboarding)/onboarding/page.tsx` lines 91-105 and 169-195.
  - Creates or selects a default CV profile using React Query, then invalidates `['cv-profiles']` when creating a new profile. Evidence: `onboardingCvProfileQuery` in `onboarding/page.tsx` lines 222-238.
- **Quality**: Strong breadth; likely “powerful but heavy” for first-time users because there are many choices.
- **Gaps**:
  - Needs strict guardrails around user confusion: too many branches can delay the “aha moment.”
  - No clear evidence (in this pass) of a guided first-time tour enforcement, although Driver.js is in dependencies.
- **User value score**: 7/10.

Key evidence:

```143:240:packages/web/src/app/(onboarding)/onboarding/page.tsx
type OnboardingStep = 1 | 2 | 3;
// ...
const [cvEntryPhase, setCvEntryPhase] = useState<CvEntryPhase>('template');
const [selectedTemplate, setSelectedTemplate] = useState<CvTemplateId>('modern');
// ...
const onboardingCvProfileQuery = useQuery({
  queryKey: ['onboarding', 'cv-default-profile', accessToken ?? ''],
  queryFn: async () => {
    const profiles = await api.cv.listProfiles();
    const pick = profiles.find((p) => p.isDefault) ?? profiles[0];
    if (pick) return pick.id;
    const row = await api.cv.createProfile({ name: 'My resume', template: tpl });
    void queryClient.invalidateQueries({ queryKey: ['cv-profiles'] });
    return row.id;
  },
  enabled: Boolean(accessToken),
});
```

---

### 3) CV Builder (inline editor + templates + improvements + scoring)

- **Status**: Partially built (feature-rich clinic UI is present)
- **How it works (observed)**:
  - Main CV route is client-rendered and mounts a large CV clinic surface: `CVBuilder`, `ImprovementsPanel`, `CVScoreCard`, `TemplatePickerModal`, `AIChatDrawer`, `AISectionAssistantPanel`, section editing modal, etc. Evidence: imports in `packages/web/src/app/(dashboard)/dashboard/cv/page.tsx` lines 28-46.
  - Supports a “tailor mode” and deep-linking from job analysis via search params: `cvMode`, `tailorDraftId`, `jobAnalysisId`. Evidence: `CVPageContent()` in `cv/page.tsx` lines 221-227.
  - Fetches linked job context with a bounded stale time (1 minute) when `jobAnalysisId` is present. Evidence: `linkedJobQ` in `cv/page.tsx` lines 228-233.
  - Implements template switching persisted in session storage per-profile. Evidence: `readCvDashboardTemplate()` / `writeCvDashboardTemplate()` in `cv/page.tsx` lines 145-167.
- **Quality**: Strong UI scope; comparable “CV clinic” feel, but currently centralized in a huge client page which is risky.
- **Gaps vs your checklist** (evidence-based):
  - **Template switching**: present (session storage + TemplatePickerModal import).
  - **Auto-save**: likely present via `saveCVBuilderData` and save status state (`CvBuilderSaveStatus`), but full autosave mechanism needs deeper read of `cvBuilder` + `CVBuilder` internals.
  - **Export**: `useExportCV` hook is imported, but DOCX export is not evidenced in the snippets read (PDF is implied via `jspdf` dependency and job cover-letter PDF helper exists).
  - **Inline spell check / ATS score**: types `CvSpellIssue` and `CVScoreCard` suggest these exist, but the actual implementation depth requires reading `CVScoreCard` + score hooks.
- **User value score**: 8/10 (if export + autosave reliability are solid, this becomes a core retention driver).

Key evidence:

```28:90:packages/web/src/app/(dashboard)/dashboard/cv/page.tsx
import { CVBuilder } from '@/components/cv/CVBuilder';
import { ImprovementsPanel } from '@/components/cv/ImprovementsPanel';
import { CVScoreCard } from '@/components/cv/CVScoreCard';
import { TemplatePickerModal } from '@/components/cv/TemplatePickerModal';
import { AIChatDrawer } from '@/components/cv/AIChatDrawer';
import { AISectionAssistantPanel } from '@/components/cv/AISectionAssistantPanel';
// ...
const cvMode = parseCvMode(searchParams.get('cvMode'));
const tailorDraftIdParam = searchParams.get('tailorDraftId')?.trim() ?? '';
const jobAnalysisIdParam = searchParams.get('jobAnalysisId')?.trim() ?? '';
const isTailorMode = cvMode === 'tailor';
```

---

### 4) Job Analyzer (match score + tailoring + cover letter)

- **Status**: Built (core experience lives under `/dashboard/jobs/analyze`)
- **How it works (step-by-step from UI → result, as observed)**:
  - Legacy/alias route `/dashboard/job-analyzer` forwards query params to `/dashboard/jobs/analyze`. Evidence: `packages/web/src/app/(dashboard)/dashboard/job-analyzer/page.tsx` lines 5-40.
  - The main analyzer UI is `JobsAnalyzeContent` (client component) mounted with Suspense. Evidence: `packages/web/src/app/(dashboard)/dashboard/jobs/analyze/page.tsx` lines 1-18 and `JobsAnalyzeContent.tsx` `'use client'` line 1.
  - Match score is displayed and refreshed; match score is stored as part of `analysis` and has UI copy like “Paste a job description to see your match score.” Evidence: grep results show matchScore logic around lines ~679-710 and UI copy at ~2275 in `JobsAnalyzeContent.tsx`.
  - Tailoring is a first-class state machine: `tailorDraft`, `tailorSidebarOpen`, fingerprinting to reset when JD/CV changes, and URL flag `openTailor=1`. Evidence: `JobsAnalyzeContent.tsx` lines ~424-446 and the tailor fingerprint comment.
  - AI limit handling is explicitly referenced: `canUseAiFromDailyAiUsage` + `DAILY_AI_LIMIT_REACHED_MESSAGE`. Evidence: `JobsAnalyzeContent.tsx` lines 63-67.
  - Cover letter is generated, persisted to `localStorage`, and supports copy/edit/download workflows. Evidence: cover letter storage helpers at `JobsAnalyzeContent.tsx` lines 101-120 and cover letter UI refs in grep output.
- **Quality**: Very strong for “job analysis + next actions,” comparable to Teal/Jobscan style flows, but risk is heavy client complexity in a single file.
- **Gaps**:
  - Salary estimation not evidenced in the segments read.
  - Skill gap identification likely exists but needs verification in `AiRecruiterReportSection` and analysis payload.
- **User value score**: 8/10.

Key evidence:

```5:41:packages/web/src/app/(dashboard)/dashboard/job-analyzer/page.tsx
/**
 * Backend Phase 6A links use `/dashboard/job-analyzer?...`.
 * The real analyzer UI lives at `/dashboard/jobs/analyze` (JobsAnalyzeContent).
 */
redirect(`/dashboard/jobs/analyze${suffix ? `?${suffix}` : ''}`);
```

```1:90:packages/web/src/app/(dashboard)/dashboard/jobs/JobsAnalyzeContent.tsx
'use client';
import { useDailyAiUsage } from '@/hooks/useDailyAiUsage';
import {
  canUseAiFromDailyAiUsage,
  DAILY_AI_LIMIT_REACHED_MESSAGE,
} from '@/lib/ai-daily-usage';
import { downloadCoverLetterPdf } from '@/lib/cover-letter-pdf';
// ...
const STORAGE_FORM_KEY = 'applymate:dashboard:jobs:analyze-form';
```

---

### 5) Job Hub / Pipeline Tracker

- **Status**: Built (canonical route `/dashboard/jobs`; legacy `/dashboard/job-hub` redirects)
- **How it works**:
  - `/dashboard/jobs` mounts `JobHub` behind Suspense. Evidence: `packages/web/src/app/(dashboard)/dashboard/jobs/page.tsx` lines 1-20.
  - `/dashboard/job-hub` is an alias redirector: forwards `jobAnalysisId → jobId`, supports follow-up redirect, and can deep-link into tailoring mode by redirecting to `/dashboard/jobs/analyze?openTailor=1`. Evidence: `packages/web/src/app/(dashboard)/dashboard/job-hub/page.tsx` lines 11-57.
- **Quality**: Routing compatibility is thoughtful; the need for so many aliases implies evolving backend routes and can confuse users.
- **Gaps**:
  - Need to confirm actual “pipeline tracker” affordances (kanban/table, follow-ups, bookmarking) in `packages/web/src/app/(dashboard)/dashboard/jobs/*` and `components/job-hub/*`.
- **User value score**: 7/10 (pipeline tracking is sticky; could be 9/10 with strong reminders + follow-up intelligence).

---

### 6) Job Board / Discovery

- **Status**: Partially built (page is a shell around `JobBoardContent`)
- **How it works**:
  - `/dashboard/job-board` mounts `JobBoardContent` with a two-column skeleton fallback. Evidence: `packages/web/src/app/(dashboard)/dashboard/job-board/page.tsx` lines 1-20.
- **Gaps**:
  - AI discovery based on CV/location needs verification in `JobBoardContent` + `useJobDiscovery`/`useJobBoardAiMatch` hooks.
- **User value score**: 6/10 (likely valuable if discovery quality is good).

---

### 7) Interview Preparation

- **Status**: Partially built (setup route exists; simulation appears in components)
- **How it works (entry)**:
  - `/dashboard/interviews` is just a redirect to `/dashboard/interview`. Evidence: `packages/web/src/app/(dashboard)/dashboard/interviews/page.tsx` lines 1-14.
  - `/dashboard/interview` mounts `InterviewSetupStepper` under Suspense. Evidence: `packages/web/src/app/(dashboard)/dashboard/interview/page.tsx` lines 1-18.
  - `/dashboard/interview-prep` is an alias redirect to `/dashboard/interview`. Evidence: `packages/web/src/app/(dashboard)/dashboard/interview-prep/page.tsx` lines 11-24.
- **Quality**: Good routing hygiene; suggests an intentional “wizard-first” flow.
- **Gaps**:
  - Voice/live scoring/adaptive mode appear in components (`LiveFeedbackPanel`, `AdaptiveDifficultyBadge`, etc.), but end-to-end wiring needs deeper runtime verification.
- **User value score**: 7/10.

---

### 8) Authentication & User Management

- **Status**: Partially built
- **Evidence**:
  - Auth pages exist: `packages/web/src/app/(auth)/login/page.tsx`, `packages/web/src/app/(auth)/register/page.tsx` (found in app glob list).
  - NextAuth route handler exists: `packages/web/src/app/api/auth/[...nextauth]/route.ts` (found in app glob list).
- **Gap**: Need to verify protected route enforcement and session expiry UX; in the snippets read, I see `useAuthStore` usage in onboarding and CV pages, indicating a custom auth store plus NextAuth scaffolding.

---

### 9) Browser Extension Integration

- **Status**: Present at repo level; dashboard integration not verified in this pass
- **Evidence**:
  - Repo README indicates `packages/extension/` exists and is MV3 with content/background/side panel/popup. Evidence: `README.md` lines 10-22.
- **Gap**: To fully audit, we’d trace any shared auth tokens, deep links, and “autofill” surfaces in the web app.

---

## UX Score Summary (Evidence-based, limited to reviewed surfaces)

| Area | Score (1-10) | Key Finding |
|---|---:|---|
| Onboarding | 7 | Strong multi-path intake, but high cognitive load (many branches) (`onboarding/page.tsx`) |
| Navigation | 6 | Alias routes (`job-analyzer`, `job-hub`, `interview-prep`) suggest evolving IA; can confuse users |
| Error handling | 6 | Global error boundary sends to Sentry (`global-error.tsx`), but user-facing error UX varies by page |
| Loading states | 8 | Consistent Suspense fallbacks + dashboard route-level skeleton (`dashboard/loading.tsx`) |
| Empty states | 7 | Dashboard has personalized empty copy (e.g. “Let’s get your CV set up…”) |
| Mobile experience | 6 | Some mobile-specific components exist (`MobileExperienceBanner`, `MobileDockFab`) but full coverage unverified |
| Accessibility | 6 | Some aria-labels exist (cover letter editor), but overall coverage unknown without deeper scan |
| Performance | 6 | Risk: mega client pages; some bounded stale times (e.g. 60s) but overall re-render risk needs profiling |

Key evidence for loading state quality:

```1:78:packages/web/src/app/(dashboard)/dashboard/loading.tsx
/**
 * Route-level loading UI (server-rendered).
 * This prevents a "blank screen" while the dashboard client bundle hydrates.
 */
export default function DashboardLoading() { /* ... skeleton layout ... */ }
```

Key evidence for error boundary:

```1:27:packages/web/src/app/global-error.tsx
'use client';
import * as Sentry from '@sentry/nextjs';
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (/* NextError */);
}
```

---

## Code Quality Assessment

Overall grade: **B-**

### Technology stack assessment (from `packages/web/package.json`)

- **Framework**: Next.js **16.2.2** (App Router), React **19.2.4**.
- **State**: Zustand **5.0.12** (plus React Query for server state).
- **Data fetching**: `@tanstack/react-query` **5.96.2**, Axios **1.14.0**.
- **Styling**: Tailwind **v4**, `tailwind-merge` **3.5.0**, `tailwindcss-animate` **1.0.7**; Radix slot present (suggests shadcn-style).
- **Validation**: Zod **4.3.6**.
- **Observability**: Sentry Next.js **10.47.0**, PostHog **1.365.3**.
- **Testing**: Vitest **4.1.5**, Testing Library, Playwright **1.60.0**.

Evidence:

```1:62:packages/web/package.json
"next": "16.2.2",
"react": "19.2.4",
"@tanstack/react-query": "^5.96.2",
"zustand": "^5.0.12",
"@sentry/nextjs": "^10.47.0",
"posthog-js": "^1.365.3",
"vitest": "^4.1.5",
"@playwright/test": "^1.60.0"
```

### Architecture highlights / risks

- **Strength**: Clear separation of concerns via hooks (`packages/web/src/hooks/*`) and lib utilities (`packages/web/src/lib/*`), with typed `api` types used across UI (`type CvTailorDraft`, `JobAnalysis`, etc. in `JobsAnalyzeContent.tsx`).
- **Risk**: Very large client routes act as “god components”:
  - `packages/web/src/app/(dashboard)/dashboard/page.tsx` is huge (thousands of lines).
  - `packages/web/src/app/(dashboard)/dashboard/cv/page.tsx` is huge (thousands of lines).
  - `packages/web/src/app/(dashboard)/dashboard/jobs/JobsAnalyzeContent.tsx` is huge (thousands of lines).
  This is a scalability risk for the team and increases bug surface.

- **React Query consistency**: Query keys are present and invalidation is used, but naming is inconsistent (`['cv-profile']` vs `['cv-profile', id]` vs `['cv', 'profile', id]` etc.) which can cause cache misses and stale UI. Evidence: `AddSectionModal.tsx` invalidates many variants.

---

## Scalability Assessment (Frontend)

### Can it handle 10,000 concurrent users? 100,000? 1,000,000?

- **10,000 concurrent**: Likely yes from a pure frontend standpoint if API + CDN are solid; biggest risk is **client bundle weight** and **runtime complexity** on dashboard/analyzer pages.
- **100,000 concurrent**: Depends heavily on API efficiency and caching; frontend would need stronger code-splitting and more aggressive memoization/derivation boundaries.
- **1,000,000 concurrent**: Requires excellent infra + observability + strict performance discipline; current mega-pages and rich animation libraries (`framer-motion`, lots of dashboard logic) will need optimization.

Early breakpoints (most likely):
- **Bundle / hydration cost** on dashboard and CV clinic pages (very large client components).
- **Cache invalidation drift** due to inconsistent query keys.
- **Workflow state persistence** reliance on `localStorage` (e.g. cover letter drafts) which can get messy across devices.

---

## Revenue Readiness Score: 6/10

What would push to 10/10:
- **Clear plan gating** at the moments of maximum value (tailor, cover letter generation, export), with consistent “why upgrade” messaging.
- **Upgrade prompts** that are contextual (not generic), tied to AI usage limit and success outcomes.
- **Billing integration evidence** (Stripe, plan tiers, feature flags) visible in code; not confirmed in this pass.

---

## Recommended Action Plan (Priority Ordered)

1. **Unify the core loop navigation and naming**
   - Reduce reliance on alias redirects (`/job-analyzer`, `/job-hub`, `/interview-prep`) and make a single canonical IA with consistent labels.
2. **Break up mega client pages**
   - Extract state machines (tailoring, cover letter editor, CV clinic) into feature modules/components; add integration tests around the loop.
3. **Standardize React Query cache keys**
   - Create a single query-key factory for CV, jobs, interviews to avoid invalidation bugs.
4. **Harden error + session expiry UX**
   - Add clear user-facing errors (not just Sentry capture), and handle auth expiry centrally (redirect + toast + resume where you left off).
5. **Make AI-limit behavior a first-class UX**
   - `DAILY_AI_LIMIT_REACHED_MESSAGE` exists; ensure the UI offers “save draft / continue manually / upgrade” paths mid-flow.

