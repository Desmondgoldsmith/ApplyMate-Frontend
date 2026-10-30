---
name: careerkite-ui
description: CareerKite web UI conventions — light/dark theme tokens, brand mark, typography, motion, 3D, copy rules and UX patterns for auth, onboarding, dashboard and CV screens. Use when building or restyling any CareerKite page or component, writing user-facing copy, or adding animations in packages/web.
---

# CareerKite UI

The product is **CareerKite** (formerly ApplyMate). The landing page stays dark by design; every other screen follows the user's theme.

## Theme tokens (light + dark)

Colours live in `src/app/globals.css` as `--ck-*` variables per `[data-theme]`, exposed as Tailwind utilities. Components use **only** these role utilities, never hex, `white/…` or teal literals:

| Role          | Utilities                                                                                                                                             |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Surfaces      | `bg-bg-page`, `bg-bg-surface`, `bg-bg-raised`, `bg-bg-sunken` (inputs, wells), `bg-bg-hover`, `bg-bg-overlay`                                         |
| Text          | `text-text-primary`, `text-text-secondary`, `text-text-tertiary` (hints), `text-text-disabled`, `text-text-inverse`, `text-text-on-accent`            |
| Borders       | `border-border-subtle` (separators), `border-border-default`, `border-border-strong` (input outlines), `border-border-focus` / `outline-border-focus` |
| Accent (lime) | `bg-accent-solid` + `text-text-on-accent`, `hover:bg-accent-solid-hover`, `bg-accent-subtle`, `border-accent-border`, `text-accent-text` (links)      |
| Status        | `success-*`, `danger-*`, `warning-*` (`subtle` bg + `text`; danger also `solid`, `border`)                                                            |
| Elevation     | `shadow-raised`, `shadow-overlay`                                                                                                                     |
| Brand moment  | `bg-brand-gradient` (lime → emerald), once per screen at most                                                                                         |

- Every text/background pair is measured to WCAG AA (4.5:1 text, 3:1 UI). Changing a value means re-measuring both themes.
- Lime is never text on a light background (≈1.3:1). On light, accent text is `text-accent-text` (olive); lime is a fill behind dark text.
- Don't borrow a token outside its role (no `bg-border-*`, no `bg-text-*`). Missing role → add a token.
- No alpha on anything carrying text; use solid tokens.

### Unconverted screens

Screens still built on hard-coded dark colours are wrapped in `LegacyDarkScope` (pins `data-theme="dark"` + the old teal background). Currently: landing (permanent) and the dashboard (until converted). Auth and onboarding are fully on tokens. When converting an area: replace literals with tokens, remove its `LegacyDarkScope`, check both themes in the browser.

- `ForcedThemeScope theme="dark"` pins a smaller island (e.g. the shared CV editor or `CVScoreCard` inside onboarding) and tells portals about it.
- `Modal` and `InfoHint` wrap their portal content in `PortalThemeScope`, so a dialog opened from a dark-pinned area stays dark. New portals must do the same.

### Theme runtime

- `ThemeProvider` / `useTheme()` — `preference` (`light | dark | system`), `resolvedTheme`, `setPreference`.
- The choice is stored locally (`careerkite:theme`) and on the account (`uiPrefs.theme` via PATCH `/users/me`); the account value wins at sign-in.
- `THEME_INIT_SCRIPT` in the root layout sets the theme before first paint. Don't read the theme during SSR.
- `ThemeToggle` is the standard switch.

## Brand

- `BrandMark` = mark + "CareerKite" wordmark. `CareerKiteMark` alone; `variant="auto"` switches to the compact mark (no string / dot) below 40px.
- The C uses `currentColor`; the kite gradients are fixed; the "you" dot uses `--ck-mark-dot`.
- Static assets: `public/brand/careerkite-mark.svg`, `careerkite-app-icon.svg`; `app/icon.svg`, `app/apple-icon.tsx`.

## Typography

- Headings: `font-display` (Bricolage Grotesque), bold, tight tracking (`tracking-[-0.03em]`). Body: Plus Jakarta Sans (default `font-sans`).
- Auth/page titles 34–40px; section titles 20–24px; body 15px, line-height ~1.6; hints 13px.
- No all-caps eyebrow labels, no single accented word in a headline, no `→` glued onto button text.

## Forms

- Visible label above every field (`AuthTextInput` / `AuthPasswordInput` pattern), placeholder only as an example.
- Inputs: `h-12 rounded-xl bg-bg-sunken border-border-strong`, focus `border-border-focus` + soft accent ring.
- Errors under the field in `text-danger-text`, linked with `aria-describedby`; clear the error as the user edits.
- Primary action: `Button variant="accent"`; secondary: `variant="outline"`. One primary per view.

## Motion and 3D

- Screen transitions: fade + 16–20px slide, 0.2–0.3s, `ease: [0.22, 1, 0.36, 1]`. Respect `useReducedMotion()`.
- Infinite animation only for loaders and ambient backdrops (and never under reduced motion).
- 3D: use `KiteHero` (give it a height). It lazy-loads `Kite3D` only on large screens with WebGL2 and motion allowed, and shows the static mark otherwise. One hero moment per screen. When editing `Kite3D`: mutate objects in `useFrame` through refs, reuse vectors, cap `dpr` at 1.75; `<threeLine>` is not supported by the installed fiber, use `<primitive>`. See the `threejs-*` skills.
- `SkyBackdrop` is the shared glow + wind background (auth panel, onboarding page).
- Selected states use `border-border-focus` (lime alone is too faint on light backgrounds).

## Copy rules

- Say **CV** (not resume).
- Plain words; titles are questions or outcomes, buttons are verbs ("Create account", "Use this design").
- Show time cost on choices ("About 1 min"). Errors say what happened and what to do next.

## UX patterns

- Value first: upload → see real results → then preferences. Optional questions come after value.
- Progressive disclosure: one score + top 3 actions; methodology behind "How is this calculated?".
- Preview with the user's own data.
- Accessibility: labels on every input, `aria-label` on icon-only controls, `role="radio"`/`aria-checked` for single-choice groups, touch targets ≥ 44px, visible focus.

## Performance

- Lazy-load heavy panels that are not on the first screen; prefetch the next route and its main queries.
- Reuse React Query keys; never fetch the same resource twice on one screen.

## Related skills

`frontend-design` (aesthetic direction), `better-colors`, `better-accessibility`, `better-typography`, `better-ui`, `threejs-*`, and `ui-ux-pro-max` if installed locally.
