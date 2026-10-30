---
name: applymate-ui
description: ApplyMate web UI conventions — dark teal design tokens, typography, motion, copy rules and UX patterns for onboarding, dashboard and CV screens. Use when building or restyling any ApplyMate page or component, writing user-facing copy, or adding animations in packages/web.
---

# ApplyMate UI

## Design tokens

| Token                   | Value                                                                    | Use                                                 |
| ----------------------- | ------------------------------------------------------------------------ | --------------------------------------------------- |
| Brand teal              | `#00C9B1`                                                                | Primary actions, focus rings, progress, key numbers |
| Teal soft               | `rgba(0,201,177,0.12)` bg, `0.35` border                                 | Selected states, chips, icon wells                  |
| Page bg                 | `#0A0A0A` (app shell `#080A0A`)                                          | Full-page backgrounds                               |
| Card                    | `#0C0F0F` via `GlowCard`, or `bg-white/[0.04]` + `border-white/[0.08]`   | Surfaces                                            |
| Text                    | `text-white` / `white/70` body / `white/50` secondary / `white/35` hints | Never below `white/35` for readable text            |
| Success / warn / danger | `#22C55E` / `#F59E0B` / `#EF4444`                                        | Status only, never decoration                       |

- Radius: cards `rounded-2xl` (20px via GlowCard), controls `rounded-xl`, chips `rounded-full`.
- Primary button: `Button` (`components/ui/Button`) — teal bg, dark text `#080A0A`. One primary per screen.
- Brand mark: use `BrandMark` (`components/brand/BrandMark`). The product name is always **ApplyMate**.

## Typography

- Screen title: `ONBOARDING_TITLE_CLASS` (26px → 32px, bold). One per screen.
- Eyebrow above titles: 11px uppercase, `tracking-[0.12em]`, teal.
- Body 14–15px, line-height 1.6. Hints 12px.

## Motion (framer-motion)

- Screen transitions: fade + 16–20px slide, 0.2–0.3s, `ease: [0.22, 1, 0.36, 1]`.
- Lists: stagger children 0.04–0.06s.
- Celebrations: spring (`stiffness ~200, damping ~20`), confetti via `canvas-confetti` once per milestone.
- Always respect `useReducedMotion()`: no infinite loops, no confetti, instant transitions.
- Never animate layout of large editors; animate opacity/transform only.

## Copy rules

- Say **CV** (not resume) in onboarding and new UI.
- Plain words, no internal jargon (no "blend weights", "heuristic", "cached", "core/optional" tags, "orchestrated").
- Titles are questions or outcomes ("Check what we found", "Choose a design"), buttons are verbs ("Upload my CV", "Use this design").
- Show time cost on choices ("About 1 min"). Never promise numbers the UI can't back up.
- Errors say what happened and what to do next.

## UX patterns

- Value first: upload → see real results → then preferences.
- Progressive disclosure: one score + top 3 actions; methodology behind "How is this calculated?".
- Preview with the user's own data (templates render their CV via `transformSectionsToCVBuilderData`).
- Optional questions are skippable and come after value.
- Empty and loading states: say what is happening and roughly how long ("Usually 15–30 seconds").
- Accessibility: every input has a `<label>` (visually hidden is fine, placeholder alone is not); errors are linked with `aria-describedby`; every icon-only control has `aria-label`; selectable cards use `aria-pressed` or `role="radio"`; touch targets ≥ 44px.
- Infinite animation is only for loaders; decorative motion plays once (ambient page backdrops excepted, and only without reduced motion).
- For wider UX research (palettes, guidelines by domain), the local `ui-ux-pro-max` skill has a searchable database if installed.

## Performance

- Lazy-load heavy panels (`next/dynamic`) that are not on the first screen.
- Prefetch the next route and its main queries while the user reads the current screen.
- Don't fetch the same resource twice on one screen; reuse React Query keys.
