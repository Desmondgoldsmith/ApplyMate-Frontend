# @applymate/extension

Chrome extension (Manifest V3) built with **TypeScript + esbuild** (no Vite, no React).

| Path | Role |
| ---- | ---- |
| `background/` | Service worker entry (`assets/background.js`). |
| `content/` | Content scripts + site parsers (`assets/content.js`). |
| `ui/sidepanel/` | Side panel HTML + vanilla JS. |
| `ui/popup/` | Toolbar popup HTML + vanilla JS. |
| `lib/` | `chrome.storage` helpers, Axios client. |
| `hooks/` | Extension-only hooks; shared hooks live in `@applymate/shared`. |
| `public/manifest.json` | Copied to `dist/` by `scripts/build.mjs`. |

## Dev / build

```bash
# from repo root
npm run build:extension
```

Build is handled by `scripts/build.mjs`:
- bundles `background/index.ts` and `content/index.ts` with esbuild
- copies `manifest.json`, popup/sidepanel HTML+JS, and shared CSS into `dist/`

Load **unpacked** extension from `packages/extension/dist` in `chrome://extensions` (Developer mode).

## Env

Create `packages/extension/.env.local`:

```bash
EXTENSION_API_URL=https://api.example.com
```
