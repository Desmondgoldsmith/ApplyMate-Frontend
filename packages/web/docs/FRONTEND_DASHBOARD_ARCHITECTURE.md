# ApplyMate Web — How the Dashboard & Auth Work (Authoritative Prompt)

This document describes **how the ApplyMate Next.js frontend is structured**, from **authentication through onboarding to every dashboard area**, including **implementation details** you can give to an AI or a new engineer. It reflects the codebase in `packages/web` (the main web app in the monorepo).

**Out of scope here:** marketing/landing page content and visuals (those live under landing components and `/`); this focuses on **app shell, API usage, and dashboard behavior**.

---

## 1. Tech stack (relevant pieces)

- **Framework:** Next.js (App Router) — routes under `src/app/`.
- **State / server cache:** TanStack Query (`QueryClientProvider` in `src/app/providers.tsx`) — default `staleTime` ~60s, retries, refetch on focus.
- **Client auth memory:** Zustand `useAuthStore` — holds `user`, `accessToken`, `isAuthenticated`; persists token to **`localStorage`** key `applymate_token` and sets **`document.cookie`** `applymate_token=...; path=/` so **middleware** can see the session.
- **HTTP:** Single Axios instance `axiosClient` in `src/lib/axios.ts` — **all** backend calls should go through `src/lib/api.ts` (or that client), not raw `fetch` in random components.
- **UI:** Shared components (`GlowCard`, `Button`, `Modal`, `Toast`, etc.), Framer Motion on many pages, teal accent `#00AEAF`.

---

## 2. Environment & API base URL

- **`NEXT_PUBLIC_API_URL`** (e.g. `http://localhost:3000/api/`) resolves **`API_BASE_URL`** in `axios.ts`.
- Requests are relative to that base (`/auth/login`, `/jobs/analyze`, etc.).

---

## 3. Axios pipeline (`src/lib/axios.ts`)

1. **Request:** If `window` exists, read `localStorage.getItem('applymate_token')` and set `Authorization: Bearer <token>`.
2. **Response error:** On **401**, clear `localStorage` token, clear cookie, redirect to **`/login`** (unless already on login).
3. **Envelope errors:** Many endpoints return HTTP 200 with `{ success: false, ... }`. Callers use **`throwIfApiFailureResponse`** after `get`/`post` so failures behave like thrown errors and work with TanStack Query and `getApiErrorMessage`.

---

## 4. API layer (`src/lib/api.ts`)

- **Single export:** `api` object with namespaces: `auth`, `users`, `onboarding`, `cv`, `cvExport`, `jobs`, `applications`, `analytics`.
- **Normalization:** Responses are often unwrapped via **`unwrapApiDataEnvelope`**; lists are normalized with **`ensureArray`** (supports keys like `data`, `items`, `applications`, `sections`, etc.).
- **Jobs — two resources:**
  - **`GET /jobs/:jobId`** → `api.jobs.getJob` — **full analyzed job** (title, company, description, match, skills, etc.) for the Jobs UI.
  - **`GET /jobs/generated/:jobId`** → `api.jobs.getGenerated` — **only** saved cover letter / answers; may be **200 with null/empty**; must not be used as the primary job loader.
- **Applications:** `create`, `getAll`, `updateStatus`, `updateNotes`; items normalized to **`ApplicationItem`** including **`REJECTED`** and **`notes`** where the API provides them.

---

## 5. Authentication flow

### 5.1 Registration (`/register`)

1. User submits email/password (validated with **Zod**).
2. `api.auth.register` then **`api.auth.login`** with same credentials.
3. **`useAuthStore.getState().setAuth(user, accessToken)`** writes token to **localStorage** and **cookie**.
4. **`router.push('/onboarding')`** for new users.

### 5.2 Login (`/login`)

1. **`api.auth.login`** → `setAuth(user, accessToken)`.
2. **`router.push('/dashboard')`** (product choice; onboarding is skipped for returning users unless you add a separate check).

### 5.3 Middleware (`packages/web/middleware.ts`)

- **Protected:** `/dashboard/*`, `/onboarding/*` — require **`applymate_token`** cookie **or** `Authorization` header (usually cookie after login).
- **Public auth pages:** `/login`, `/register` — if **already** has auth cookie/header, redirect to **`/dashboard`**.
- **Important:** API calls use **localStorage** Bearer token; **route access** for SSR/navigation is gated by **cookie**. `setAuth` keeps both in sync.

### 5.4 Session on dashboard

- **`useCurrentUser()`** — TanStack Query `queryKey: ['me']`, `queryFn: api.users.me` — hydrates server truth and AI usage fields when present.
- **Sidebar / Header** combine **`useCurrentUser`** with **`useAuthStore`** fallback and **`useCVProfile`** for display name helpers (`getDisplayName`, `getDisplayInitials`).

### 5.5 Logout

- Typically **`api.auth.logout`** + **`clearAuth()`** + redirect (see `Sidebar`).

---

## 6. Root layout & providers (`src/app/layout.tsx`)

- Global **`PageBackground`** (landing-style grid/noise/orbs) behind everything.
- **`Providers`** wraps children: **React Query**, **SessionProvider** (next-auth present in tree), **SmoothScrollProvider**, **`ToastViewport`** for toasts.
- **Landing is untouchable** in the sense of product scope; the **dashboard** adds its own **`AppShellBackdrop`** inside `(dashboard)/layout.tsx` for teal/black depth without replacing the global background.

---

## 7. Onboarding (`/onboarding`)

- **Layout:** Full-screen onboarding shell (no dashboard sidebar).
- **Flow (simplified):** Step 1 — CV upload via **`CVUploadStep`** / **`CVUploadZone`** → `api.cv.parse` on file; Step 2 — completion screen.
- **Batch API integration:** **`useOnboardingStatus`** (`GET /onboarding/status`) — if **`completed`**, **`router.replace('/dashboard')`**.
- **`useSaveOnboardingProgress`** (`POST /onboarding`) — called when uploading, continuing, skipping, and finishing so the backend can store **step / hasCV / completed**.

---

## 8. Dashboard shell (`src/app/(dashboard)/layout.tsx`)

Structure:

1. **`AppShellBackdrop`** — fixed teal/black gradient layer (hero-aligned).
2. **`Sidebar`** — desktop navigation; collapsible via **`useUIStore`** (`sidebarCollapsed`, `toggleSidebar`).
3. **Column:** **`Header`** (title from route map) + **scrollable `<main>`** + **`MobileBottomNav`** (md:hidden).

**Header** maps pathname → title (Overview, Analyses, Jobs, My CV, Applications, Interviews, Profile).

**Mobile bottom nav** is a **subset** of routes (e.g. Overview, Jobs, Applications, Profile) — not every sidebar link is duplicated on mobile.

---

## 9. Dashboard routes & behavior

### 9.1 Overview (`/dashboard`)

- **`useAnalytics`**, **`useCurrentUser`**, **`useCVProfile`**, **`useJobHistory`**, **`useApplications`**.
- Bento-style tiles: weekly stats, CV snippet / upload, quick actions, recent analyses (links to **`/dashboard/jobs?jobId=`**), avg match, application counts by status (including **Rejected** when status is returned).

### 9.2 Analyses (`/dashboard/analyses`)

- Lists **`useJobHistory()`** (same cache key **`['job-history']`** when unpaginated).
- Rows link into Jobs with **`jobId`** query param.

### 9.3 Jobs (`/dashboard/jobs`) — core product loop

**State:**

- Form: title, company, description; **`analysis`** (`JobAnalysis`); **`generated`** cover letter text; **`viewingSavedAnalysis`** disables re-running **Analyze** when loading a saved analyzed job or restoring session.

**Loading a job:**

1. Prefer **`api.jobs.getJob(jobId)`** for full detail.
2. On failure, fallback to **history list** + **`jobHistoryItemToDetail`**.
3. Then **`api.jobs.getGenerated(jobId)`** — **only** for cover letter / answers; empty 200 is OK.

**Deep link / extension:** URL **`?jobId=`** or **`useUIStore`** `activeJobId` triggers **`loadJobById`**.

**Analyze:** **`useAnalyzeJob`** → `POST /jobs/analyze` → normalized **`JobAnalysis`**; invalidates analytics & job history.

**Generate cover letter:** **`useGenerateContent`** → `POST /jobs/generate`; on success:
- Sets local cover letter text.
- **`api.applications.create`** (tracker row: title, company, match score, etc.).
- Placeholder substitution for **`[Candidate Name]`** via **`substituteCoverLetterCandidateName`** + **`getDisplayName`** for display/copy/PDF.

**UX guards:** Generate disabled when a cover letter already exists; copy/PDF helpers; auto-save to applications (not a separate “Record” button).

### 9.4 My CV (`/dashboard/cv`)

- If no profile: upload zone + **`api.cv.create`** (“blank CV”).
- If profile: **`useCVSections`**, **`useCVScore`**, **`useCVImprovements`**, **`useRunCvDetailedScore`**, **`useExportCV`** (PDF/DOCX blobs).
- Section editors: **`useUpdateCVSection`** — PATCH section payload; text fields detected by keys like `text`, `summary`, `content`.

### 9.5 Applications (`/dashboard/applications`)

- **`useApplications`** + **`useUpdateApplicationStatus`** + **`useUpdateApplicationNotes`**.
- Kanban-style columns by status + full table; **Add application** modal → **`api.applications.create`**.

### 9.6 Profile (`/dashboard/profile`)

- Account card, **`EditProfileModal`**, CV **`CVUploadZone`**, replace/delete CV flows, **`api.cv.deleteProfile`**, etc.

### 9.7 Interviews (`/dashboard/interviews`)

- **Placeholder UI** (mock list empty); “Start Interview” not wired to a Batch API in this snapshot — safe to treat as **future feature** unless extended.

---

## 10. TanStack Query — important keys

| Key | Typical use |
|-----|----------------|
| `['me']` | Current user |
| `['cv-profile']` | CV profile |
| `['job-history']` | Job list / history (default `useJobHistory()`) |
| `['applications']` | Application tracker |
| `['analytics']` | Overview metrics |
| `['cv-sections', …]` | CV sections |
| `['cv', 'score']` / `['cv', 'improvements']` | CV scoring |
| `['onboarding', 'status']` | Onboarding |

Mutations (analyze, generate, applications create, CV updates) **invalidate** relevant keys — see individual hooks (`useAnalyzeJob`, etc.).

---

## 11. Extension / external triggers

- **`useUIStore`** can set **`activeJobId`** so the Jobs page loads that job without `?jobId=` (e.g. browser extension flow).

---

## 12. Design implementation notes (dashboard)

- **`GlowCard`** — uses **`AnimatedBorderCard`** (mouse-following teal glow + rotating border CSS from `globals.css`).
- **`AppShellBackdrop`** — shared hero-aligned gradients for auth + dashboard shell.
- **Auth forms** use **`AuthFormCard`** (gradient + radial accents).

---

## 13. What to tell an AI assistant (“prompt” summary)

> ApplyMate’s **`packages/web`** app uses **Next.js App Router**, **TanStack Query**, and **Zustand** for auth tokens. **All HTTP** goes through **`axiosClient`** in **`lib/axios.ts`** (Bearer token from **`localStorage`**) and **`lib/api.ts`** (typed `api.*` methods, envelope handling, list normalization). **Middleware** protects **`/dashboard`** and **`/onboarding`** using the **`applymate_token` cookie**; login/register sync token to **localStorage + cookie**. After **register**, users go to **`/onboarding`**; **`/login`** goes to **`/dashboard`**. Onboarding calls **`/onboarding`** and **`/onboarding/status`**. The dashboard uses a **sidebar + header + main** layout with **`AppShellBackdrop`**. The **Jobs** page loads full job data via **`GET /jobs/:id`**, cover letter via **`GET /jobs/generated/:id`**, analyzes via **`POST /jobs/analyze`**, generates via **`POST /jobs/generate`**, and saves tracker rows via **`POST /applications`**. **CV** and **Applications** pages use the Batch CV and applications endpoints as wrapped in **`api.cv.*`**, **`api.cvExport.*`**, and **`api.applications.*`**.

---

*Last aligned with the repo structure: dashboard routes, `api` export, hooks under `src/hooks`, and layouts as described above.*
