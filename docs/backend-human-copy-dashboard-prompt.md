# Backend prompt — fix leaky dashboard human copy

## Context

The web client renders **exactly what `GET /dashboard/today-plan` returns** for user-visible strings (hero, mission copy, growth snippets). We are **not** duplicating `AssistantCopyService` rules in the browser for headline-grade fixes.

Observed issues in production/UAT:

1. **Hero / narrative headline** showed orchestration-style product language, e.g.  
   **`Build pipeline with intention`**  
   — Reads like internal strategy copy, not user-facing career language.

2. **Mission / daily context line** showed human prose concatenated with machine tails, e.g.  
   **`Pick a single next step and complete it. cv_improvement:cv:`**  
   — The suffix `cv_improvement:cv` is a **structured intent / slug** (`snake_case:value`), not human text.

## Required backend behavior

Apply **`safeHumanText` / `validateHumanExperienceCopy`** (or your canonical equivalents) **before** any dashboard-facing string is serialized into:

- `dashboardExperience.narrative` (`heroStory`, `hero`, `heroSubtitle`, `momentumCopy`, …)
- Phase 3 payloads (`assistantNarrative`, `dailyMission.progressContext`, `impactLabel`, …)
- **`dailyMission.progressContext`** (and any field that concatenates “guidance + debug intent”)
- **`dailyDirection.progressContext`** (growth API if merged into today-plan or separate endpoint)

### Strip / reject patterns

- **UUIDs**, **`kind:slug`** tails, and **`snake_case_intent:slug`** tails (e.g. `cv_improvement:cv`, `foo:bar-baz`).  
  Regex note: patterns that only match `[a-z]+:` **fail** when the left side contains **underscores** — extend stripping to cover `\w+:\w+` style tails after prose.

### Product vocabulary

- Replace or remove **orchestration/product jargon** in user-visible headlines: e.g. “build pipeline”, “pipeline with intention”, “pipeline snapshot” unless intentionally approved copy — prefer calm career language aligned with `AssistantCopyService` tone rules.

### Acceptance checks

- No raw **`cv_improvement`**, **`PIPELINE_*`**, **`workflow:`** fragments, or **`recommendationIntent` / family** strings in any dashboard narrative field.
- **`dailyMission.progressContext`** must be **either** fully human prose **or** empty — never **sentence + machine tail**.

## QA

1. Fixture or integration test: payload where upstream accidentally appends `cv_improvement:cv` → API returns **stripped** or **null** for that field.
2. Snapshot test on polished hero headline: banned jargon rewritten or rejected at serialization.

## Frontend expectation

Once responses are clean, the dashboard will display them without extra headline validators. The frontend retains only lightweight **ID stripping** (`stripTechnicalTokens`) as defense in depth, not as the primary fix.
