# ApplyMate Chrome Extension

Manifest V3 extension with a React side panel, floating job-page icon, and extension JWT auth.

## Load in Chrome (important)

**Load the built `dist/` folder — not this source folder.**

1. Build first:
   ```bash
   cd packages/extension
   npm install
   npm run build
   ```
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked**
5. Select: **`packages/extension/dist`** (the `dist` folder inside this package)

If you select `packages/extension` (the parent folder), Chrome will fail with missing icons / manifest errors.

## Setup

```bash
cd packages/extension
npm install
npm run build
```

Load **`dist/`** in Chrome → `chrome://extensions` → **Load unpacked** → choose the **`dist`** folder.

Set in `packages/web/.env.local`:

```env
NEXT_PUBLIC_EXTENSION_ID=<your-extension-id-from-chrome>
NEXT_PUBLIC_API_URL=http://localhost:3000/api/
```

Do **not** put `NEXT_PUBLIC_EXTENSION_ID` in `packages/extension/.env` — the web app reads it at build time.

## Dev

```bash
npm run dev   # vite build --watch — reload extension after changes
```

## Auth flow

The extension connects automatically when you are logged into the web app in the same browser:

1. **On sidebar open / Refresh connection** — `GET /auth/extension/sync` (API refresh cookie), then fallback: read `applymate_token` from an open dashboard tab and mint an extension JWT.
2. **Proactive handoff** — while the dashboard is open, the web app pushes a fresh extension token via `chrome.runtime.sendMessage` (`ExtensionAuthBridge`).
3. **Manual login** — **Log in to ApplyMate** opens `/login?source=extension` for first-time connect.

### Required web app env (`packages/web/.env.local`)

```env
NEXT_PUBLIC_EXTENSION_ID=<your-id-from-chrome://extensions>
NEXT_PUBLIC_API_URL=http://localhost:3000/api/
```

Restart the Next.js dev server after changing env vars.

### Required extension env (`packages/extension/.env`)

```env
VITE_API_URL=http://localhost:3000/api
VITE_WEB_APP_URL=http://localhost:3001
VITE_WEB_LOGIN_URL=http://localhost:3001/login?source=extension
```

After `npm run build`, reload the extension at `chrome://extensions` (load **`dist/`**).

**Production / Vercel web:** set the three `VITE_*` vars to your Vercel URL and API URL, rebuild, and reload the extension. The content script announces the extension id to open dashboard tabs so login sync works without a shared `NEXT_PUBLIC_EXTENSION_ID`. You still need `https://your-vercel-app/*` in `manifest.json` → `externally_connectable`.

## Env

| Variable | Default |
|----------|---------|
| `VITE_API_URL` | `http://localhost:3000/api` |
| `VITE_WEB_LOGIN_URL` | `http://localhost:3001/login?source=extension` |
