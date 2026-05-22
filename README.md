# ApplyMate monorepo

Production-oriented workspace for **ApplyMate**: a Next.js marketing/product web app, a Chrome extension, and shared TypeScript packages.

## Layout

```
.
├── packages/
│   ├── web/           # Next.js (App Router) — landing + app shell
│   └── extension/     # Chrome MV3 extension (TypeScript + esbuild)
├── shared/            # @applymate/shared — types, cn(), cross-app hooks/components
├── package.json       # npm workspaces + root scripts
├── tsconfig.base.json # shared TS defaults (packages extend this)
└── eslint.config.mjs  # ESLint flat config (web + extension + shared)
```

| Package | Description |
| ------- | ----------- |
| **@applymate/web** | Next.js, Tailwind v4, shadcn/ui (configured), React Query, Zustand, Axios, Zod, NextAuth placeholder, Sentry + PostHog stubs. |
| **@applymate/extension** | TypeScript + esbuild build → `dist/` (content script, background, side panel, popup). |
| **@applymate/shared** | Shared `User` type, `cn()` utility, and future hooks/components. |

Absolute imports:

- In **web**: `@/*` → `packages/web/src/*`; import shared code with `@applymate/shared`.
- In **extension**: `@/*` → `packages/extension/*` (package root); shared the same as web.

## Setup

```bash
npm install
cp .env.example packages/web/.env.local
cp .env.example packages/extension/.env.local
```

Edit env files with real URLs and secrets. See `packages/web/.env.example` and `packages/extension/.env.example`.

## Scripts (run from repo root)

| Script | Purpose |
| ------ | ------- |
| `npm run dev` | Next.js dev server (`@applymate/web`) |
| `npm run dev:extension` | esbuild watch for the extension |
| `npm run build:web` | Production Next.js build |
| `npm run build:extension` | esbuild-based build → `packages/extension/dist` |
| `npm run build` | All workspace `build` scripts |
| `npm run lint` | ESLint (`packages/**` + `shared/`) |
| `npm run format` | Prettier |

**Extension**: after `npm run build:extension`, load **unpacked** from `packages/extension/dist` in Chrome (`chrome://extensions` → Developer mode → Load unpacked).

## Tooling

- **ESLint** + **Prettier** at the repo root  
- **Husky** + **lint-staged** on commit (`eslint --fix` + `prettier --write`)

## Conventions

- **No product/business logic** in this scaffold beyond stubs — implement features inside `packages/web/src/features/*` and `packages/extension/content|ui/*`.
- Prefer **`@applymate/shared`** for anything used in both web and extension to avoid drift.
