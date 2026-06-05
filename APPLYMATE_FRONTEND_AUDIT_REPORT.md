# ApplyMate — Frontend Product & Technical Audit
# Role: Senior Product Manager + Frontend Architect
# Objective: Full audit report — product quality, feature completeness,
#             UX effectiveness, code quality, scalability readiness

---

## CONTEXT

You are acting as a Senior Product Manager and Frontend Architect
conducting a comprehensive audit of ApplyMate — an AI-powered career
acceleration platform. Your job is to assess whether this product:

1. Delivers on its core promise to users
2. Is built to global SaaS standards
3. Can retain users and generate significant revenue
4. Is technically sound and scalable

This is a READ-ONLY audit. Do not change any code.
Read every file. Report everything you find honestly.

---

## PART 1 — READ THE ENTIRE CODEBASE FIRST

Before writing any findings, read ALL of the following:

### Application entry points
```
packages/web/src/app/
packages/web/src/components/
packages/web/src/lib/
packages/web/src/hooks/
packages/web/src/types/
packages/web/src/context/
packages/web/src/utils/
```

### Every page in the dashboard
```
packages/web/src/app/(dashboard)/dashboard/page.tsx
packages/web/src/app/(dashboard)/dashboard/overview/
packages/web/src/app/(dashboard)/dashboard/cv/
packages/web/src/app/(dashboard)/dashboard/job-analyzer/
packages/web/src/app/(dashboard)/dashboard/job-board/
packages/web/src/app/(dashboard)/dashboard/interviews/
packages/web/src/app/(dashboard)/dashboard/job-hub/
packages/web/src/app/(dashboard)/dashboard/cv-profiles/
packages/web/src/app/(dashboard)/dashboard/settings/
```

### Every major component
```
packages/web/src/components/cv/
packages/web/src/components/dashboard/
packages/web/src/components/interviews/
packages/web/src/components/job/
packages/web/src/components/ui/
packages/web/src/components/onboarding/
```

### Config and infrastructure files
```
packages/web/package.json
packages/web/next.config.js (or .ts)
packages/web/tailwind.config.js (or .ts)
packages/web/tsconfig.json
packages/web/.env.example (if exists)
```

---

## PART 2 — WHAT TO AUDIT AND REPORT

Generate a structured report with the following sections.
Be specific. Use evidence from the actual code.
Do not give generic advice — reference real file names, component names,
function names, and patterns you found.

---

### SECTION A — FEATURE COMPLETENESS AUDIT

For each feature below, report:
- **Status**: Fully built / Partially built / Stubbed / Missing
- **How it works**: Step-by-step flow from user action to result
- **Quality**: Does it meet global SaaS standards? (compare to tools like
  Teal, Enhancv, LinkedIn, Notion, Linear)
- **Gaps**: What is missing or broken?
- **User value score**: 1-10 — how much value does this actually deliver?

**Features to audit:**

1. **CV Builder (inline editor)**
   - Click-to-edit on all 9 templates
   - Auto-save mechanism
   - Section add/remove/reorder
   - Photo upload
   - Inline spell check
   - ATS score panel
   - Improvements panel with accept/reject
   - PDF and DOCX export
   - Template switching

2. **AI CV Creation**
   - Build with AI (chat-based CV creation)
   - CV parsing from PDF upload
   - AI summary rewrite
   - AI bullet rewrite
   - AI section assistant

3. **CV Tailoring**
   - Tailor CV to job description
   - Before/after diff review
   - Accept/reject individual changes
   - Tailored CV saved as new profile

4. **Job Analyzer**
   - Job description input + analysis
   - Match score calculation
   - Skill gap identification
   - Salary estimation
   - Cover letter generation
   - "Apply with CV tailoring" flow

5. **Job Board / Discovery**
   - AI job discovery based on CV + location
   - Match scoring per job
   - Bookmarking and saving jobs
   - Job Hub pipeline tracker
   - Follow-up intelligence

6. **Interview Preparation**
   - 4-step setup wizard
   - Multiple interviewer personalities
   - Adaptive mode
   - Live session with voice/text
   - Live feedback scoring (STAR, Clarity, Confidence)
   - Session history
   - Progress coach

7. **Smart Dashboard**
   - Today's Plan / AI daily directive
   - Career Momentum score
   - Predictive Outlook (interview/offer probability)
   - Goal Alignment
   - Consistency streak
   - Achievements/badges
   - Follow-up intelligence
   - Jobs to revisit
   - Priority intelligence
   - Recent analyses

8. **Onboarding Flow**
   - 3-part onboarding (Goals, Resume, Setup)
   - First-time user tour
   - New user empty states

9. **Browser Extension Integration**
   - Is the extension frontend code present?
   - How does it connect to the dashboard?
   - Auto-fill flow

10. **Authentication & User Management**
    - Sign up / sign in flow
    - Session management
    - Profile settings

---

### SECTION B — USER EXPERIENCE AUDIT

For each area, rate 1-10 and explain with specific evidence:

1. **Onboarding clarity**: Does a new user immediately understand
   what to do? How long before they get their first "aha moment"?

2. **Navigation efficiency**: Can a user move between CV editing,
   job analysis, and interview prep in under 3 clicks?

3. **Error handling**: What happens when API calls fail? When AI
   returns unexpected results? When the user's session expires?
   Find every try/catch, every error boundary, every toast notification.
   Are errors communicated clearly or do they silently fail?

4. **Loading states**: Does every async operation have a loading state?
   Are there skeleton loaders or spinners? Are they consistent?

5. **Empty states**: When a user has no data (no CVs, no analyses, no
   sessions), are the empty states helpful and action-oriented?

6. **Mobile experience**: Read the responsive CSS and breakpoints.
   Which pages are mobile-optimised and which are not? List each page.

7. **Accessibility**: Are there aria-labels on interactive elements?
   Is keyboard navigation supported? Are color contrasts adequate?

8. **Performance**: Find any large bundle imports, unoptimised images,
   blocking renders, or missing `loading="lazy"`. Check if React Query
   stale times are appropriate. Are there any obvious re-render issues
   (missing memo, missing deps in useEffect)?

---

### SECTION C — CODE QUALITY & ARCHITECTURE AUDIT

1. **Technology stack assessment**
   List every major dependency from package.json with version numbers.
   Assess if the choices are appropriate for a production SaaS:
   - Framework (Next.js version, App Router vs Pages Router)
   - State management approach
   - Data fetching (React Query — version, usage patterns)
   - Styling (Tailwind version, design system consistency)
   - TypeScript strictness (read tsconfig.json)
   - Testing setup (what test framework is present, if any)

2. **Component architecture**
   - Are components properly decomposed or are there god components
     doing too much? (Flag any component over 500 lines)
   - Is there a consistent pattern for props/types?
   - Are there prop drilling issues?
   - Is context used appropriately?
   - Count and list any component over 1000 lines

3. **Data fetching patterns**
   - List all React Query query keys and their stale times
   - Are there any data fetching inconsistencies?
   - Are mutations handled optimistically or with refetch?
   - Are there any N+1 fetch patterns on the frontend?

4. **Type safety**
   - Are API responses fully typed?
   - Are there any `any` types in critical paths?
   - Are there shared types between frontend and backend?

5. **Error boundaries**
   - Are React error boundaries implemented?
   - What happens when a component crashes?

6. **Bundle and build**
   - Check next.config for any performance configurations
   - Are images optimised through next/image?
   - Is code splitting happening correctly?
   - Any obviously large packages that could be lazy-loaded?

---

### SECTION D — FEATURE INTEGRATION & WORKFLOW AUDIT

This is about how features work TOGETHER, not individually.

1. **The core loop**: Can a user realistically go from:
   "I have no CV" → built CV → analyzed 3 jobs → tailored CV for best
   match → generated cover letter → scheduled interview prep →
   completed interview practice → applied to job
   ...all within ApplyMate without leaving the app?
   Trace this exact journey through the code. What breaks? What is missing?

2. **Data consistency**: When a user updates their CV, does the job
   match score update? When they accept a tailoring suggestion, does
   the new score reflect the change? Trace the data invalidation chain.

3. **AI limit handling**: The app has a 5/day free AI limit.
   What happens when a user hits this limit mid-workflow?
   Are they gracefully redirected or does it break the flow?

4. **Cross-feature navigation**: From a job analysis result, can the
   user directly open their CV for editing? From the dashboard, can
   they jump directly to a specific improvement? Trace these paths.

---

### SECTION E — RETENTION & REVENUE READINESS AUDIT

As a Product Manager, assess:

1. **Activation**: What is the minimum path to the first meaningful
   value moment? How many steps does it take? What % of new users
   likely complete it based on the UX?

2. **Retention hooks**: List every mechanism in the code that brings
   users back:
   - Email notifications (is there notification logic?)
   - Daily plan (how fresh is it? does it actually change day to day?)
   - Streak/gamification (how is the streak calculated?)
   - Achievements (how many achievements exist? are they meaningful?)
   - Follow-up nudges (how are stale applications detected?)

3. **Upgrade triggers**: Where in the app does the user see the upgrade
   prompt? Is it well-timed (at the moment of value) or intrusive?
   List every place the Pro upsell appears.

4. **Pricing implementation**: Is there actual subscription/payment
   logic in the frontend? What plan tiers are referenced in the code?
   Are features actually gated by plan?

5. **Trust signals**: Does the app communicate security, reliability,
   and professionalism? Are there any trust-breaking moments in the UX?

---

### SECTION F — SCALABILITY READINESS (FRONTEND)

1. **State management at scale**: As the user accumulates 50+ CVs,
   100+ job analyses, and 200+ interview sessions, will the current
   state management hold up? Find any patterns that will break at scale.

2. **API call efficiency**: Are there any endpoints called too
   frequently? Any polling patterns? Any waterfall API calls that
   could be parallelised?

3. **Real-time readiness**: Is the frontend built to support WebSockets
   or SSE for real-time features? Are there any patterns that assume
   polling will always be sufficient?

4. **Internationalisation**: Is there any i18n setup? Given the app
   has international CV templates (French, German, UK, Europass), is
   multi-language support planned anywhere?

5. **Analytics and observability**: Is there any error tracking
   (Sentry, etc.)? Analytics (Mixpanel, Amplitude, PostHog)?
   Without these, how will the team know what's breaking in production?

---

### SECTION G — COMPETITIVE BENCHMARKING

Compare ApplyMate's feature set against these competitors.
For each competitor, list features they have that ApplyMate is missing,
and features ApplyMate has that competitors don't.

Competitors to benchmark against:
- **Teal HQ** (job tracker + AI resume builder)
- **Enhancv** (CV builder with analytics)
- **Kickresume** (AI CV builder)
- **LinkedIn** (job search + profile as CV)
- **Jobscan** (ATS optimisation)

For each gap identified, assess: Is this a critical gap that would
cause user churn, or a nice-to-have?

---

## PART 3 — DELIVERABLE FORMAT

Present your findings as a structured report with this format:

---

# ApplyMate Frontend Audit Report

## Executive Summary
3-5 sentences. Overall assessment. Is this ready for launch? Can it
make $1M+ in revenue? What are the top 3 things that must be fixed?

## Feature Scorecard
| Feature | Status | Quality (1-10) | User Value (1-10) | Critical Gaps |
|---|---|---|---|---|
| CV Builder | | | | |
| AI CV Creation | | | | |
| ... | | | | |

## Top 5 Strengths
What this product does genuinely well that would delight users and
differentiate from competitors.

## Top 10 Issues (Priority Ordered)
For each issue:
- **Severity**: Critical / High / Medium / Low
- **What is broken/missing**
- **Evidence** (file name, line, component)
- **User impact**
- **Estimated fix complexity**: Hours / Days / Weeks

## UX Score Summary
| Area | Score (1-10) | Key Finding |
|---|---|---|
| Onboarding | | |
| Navigation | | |
| Error handling | | |
| ... | | |

## Code Quality Assessment
Overall grade: A / B / C / D
Key findings with file-level evidence.

## Scalability Assessment
Can this handle 10,000 concurrent users? 100,000? 1,000,000?
What breaks first?

## Revenue Readiness Score: X/10
What would push this to 10/10?

## Recommended Action Plan
Prioritised list of improvements needed before this product can
confidently acquire, retain, and monetise users at scale.

---

Be brutally honest. This audit is for internal use to improve the product.
Sugarcoating findings is not helpful. Every finding must have evidence.
