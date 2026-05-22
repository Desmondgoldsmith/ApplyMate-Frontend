# Backend handoff — Interview interviewer voice not playing

## Summary for backend

**User-visible bug:** When a candidate starts an interview prep session, the interviewer does not speak. Greeting / intro / questions may appear as text on screen, but there is no audio.

**Frontend expectation:** All interviewer speech goes through **`POST /interviews/:sessionId/speech`** (ElevenLabs or equivalent). If that endpoint fails, returns empty audio, or sets `disabled: true`, the UI falls back to browser `speechSynthesis` — which is unreliable and often silent in production. **A working `/speech` response is required for a good experience.**

Please verify the full path: auth → session ownership → persona → ElevenLabs (or TTS provider) → response shape.

---

## How to reproduce (from frontend)

1. Log in to the web app (local: `http://localhost:3000` or staging).
2. Dashboard → Interview prep → configure session → click **Start interview**.
3. Land on `/dashboard/interview/:sessionId`.
4. **Expected:** Interviewer speaks the greeting, then the “introduce yourself” prompt, then the first question after the candidate’s intro.
5. **Actual (reported):** No audio at any stage; text may still render.

Capture **`POST /interviews/{sessionId}/speech`** in Network for the first ~30 seconds of the session.

---

## Endpoint contract (what the frontend calls)

### `POST /interviews/:sessionId/speech`

**When it is called**

| Phase | Example `text` (trimmed) | Notes |
|-------|--------------------------|--------|
| Intro greeting | Personality greeting, e.g. *"Hi! I'm Desmond Goldsmith…"* | Fired once per session start |
| Intro prompt | *"Before we start, could you please introduce yourself?…"* | Chained after greeting `onEnd` |
| Each question | Turn `questionText` or question bank text | After intro and between turns |
| Feedback (classic flow) | Encouragement + transition phrase | Optional |
| Submitting | Post-interview thank-you | Optional |

**Request body (JSON)**

```json
{
  "text": "Hi! I'm Desmond Goldsmith, and I'm really looking forward…",
  "interviewPersona": "alex",
  "speakingSpeed": 1
}
```

| Field | Type | Frontend source |
|-------|------|-----------------|
| `text` | string, required | Text to synthesize (greeting, question, etc.) |
| `interviewPersona` | string, optional | **Legacy avatar / voice id** — see below |
| `speakingSpeed` | number, optional | Session slider, typically `0.75`–`1.25` |

**Important — `interviewPersona` values**

The frontend now sends **legacy personality ids** used at session creation, **not** UX persona slugs:

| Value | Maps to (UI) |
|-------|----------------|
| `alex` | Friendly coach / Desmond |
| `sarah` | HR interviewer / Amara |
| `marcus` | Strict interviewer / Isaac |
| `zoe` | Technical interviewer / Priya |
| `jordan` | Silent observer (if used) |

Session create already sends `personality: "alex" | "sarah" | …` on `POST /interviews`. The `/speech` body should accept the **same** ids.

Previously the frontend mistakenly sent UX ids like `friendly_coach` / `hr_interviewer`; that was fixed, but **backend must still accept the legacy ids** and map them to ElevenLabs voice IDs.

**Expected success response**

Frontend unwraps `{ success, data }` or raw `data`:

```json
{
  "success": true,
  "data": {
    "audioBase64": "<non-empty base64>",
    "contentType": "audio/mpeg",
    "voiceId": "<elevenlabs-voice-id>",
    "cacheHit": false
  }
}
```

**Frontend treats these as “no server audio” (silent unless browser TTS works):**

```json
{
  "success": true,
  "data": {
    "disabled": true,
    "audioBase64": "",
    "contentType": "audio/mpeg",
    "voiceId": "",
    "cacheHit": false
  }
}
```

Or: HTTP 4xx/5xx, missing `audioBase64`, empty `audioBase64`, or `success: false`.

**Client playback:** `audioBase64` → `Blob` → `URL.createObjectURL` → `new Audio(url).play()`. `contentType` should be a valid audio MIME type (e.g. `audio/mpeg`).

---

## Related endpoints (for context)

| Endpoint | Purpose |
|----------|---------|
| `POST /interviews` | Creates session; body includes `personality`, `interviewPersona`, `speakingSpeed`, `prepMode`, etc. |
| `GET /interviews/:sessionId` | Session + `turns[]` for prep flow |
| `POST /interviews/:sessionId/turns/:turnId/audio` | Whisper STT for answers (separate from TTS) |

Analytics (fixed on frontend): `POST /analytics/events` with `eventName: "interview_started"` on session load — unrelated to audio but was previously 400 due to invalid event names.

---

## Debugging checklist (please confirm each)

### 1. Is `/speech` being hit?

- [ ] Request reaches the API (access logs / APM).
- [ ] `sessionId` exists and belongs to the authenticated user.
- [ ] No 401/403/404 on `/speech`.

### 2. HTTP status and error body

For a failing session, report:

- Status code
- Full JSON body (`success`, `error`, `message`, `requestId`)
- Server logs for that `requestId`

### 3. Response shape

- [ ] `data.audioBase64` is present and decodes to valid MP3/audio bytes (not empty string).
- [ ] `data.disabled` is **not** `true` when TTS should be enabled in this environment.
- [ ] `contentType` matches the encoded bytes.

### 4. ElevenLabs / TTS configuration

- [ ] `ELEVENLABS_API_KEY` (or equivalent) set in the environment used for local/staging.
- [ ] Voice mapping exists for each `interviewPersona` (`alex`, `sarah`, `marcus`, `zoe`).
- [ ] Quota / billing not exhausted (common cause of empty failures).
- [ ] Text length within provider limits (greeting + questions are usually &lt; 500 chars each).

### 5. Persona validation

- [ ] Backend does **not** reject `interviewPersona: "alex"` (or returns 400 with a clear message).
- [ ] If backend only knows UX persona ids (`friendly_coach`, etc.), add mapping **or** document required values so frontend can align.

### 6. Session flags

- [ ] No feature flag disabling TTS for prep / simulation modes without setting `disabled: true` in the response.
- [ ] `speakingSpeed` extreme values do not cause provider errors.

### 7. Manual smoke test (curl)

Replace `SESSION_ID`, `TOKEN`, and base URL:

```bash
curl -s -X POST "http://localhost:3001/interviews/SESSION_ID/speech" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello, this is a voice test.","interviewPersona":"alex","speakingSpeed":1}' \
  | jq '{ success, disabled: .data.disabled, hasAudio: (.data.audioBase64 | length > 100), contentType: .data.contentType, voiceId: .data.voiceId }'
```

**Pass criteria:** `success: true`, `hasAudio: true`, `disabled` not true. Decode `audioBase64` and confirm playable audio.

---

## What we need back from backend

1. **Root cause** — config, validation, provider error, or wrong response contract.
2. **Sample failing response** — status + JSON for one `POST .../speech` from a repro session (redact token).
3. **Fix or env steps** — e.g. enable ElevenLabs in dev, map personas, stop returning `disabled: true` without reason.
4. **Contract confirmation** — canonical list of allowed `interviewPersona` values and whether `disabled: true` is intentional in local dev.

---

## Frontend behavior (for your awareness)

- Errors from `/speech` are **swallowed** in `useInterviewTTS` (returns `null` → browser TTS fallback). Users see **no error toast** — only silence. Please check server logs; do not assume the UI will surface API errors.
- Intro speaks **two** `/speech` calls in sequence (greeting, then intro prompt). Failures on the first call block the second.
- Mute toggle skips all TTS (by design).
- Browser autoplay may block `Audio.play()` until user gesture; frontend sets a gesture flag when the user clicks **Start interview**. If `/speech` returns valid audio but play is blocked, that is a separate frontend/browser issue — still, **`/speech` must return audio first**.

---

## Suggested acceptance criteria (backend)

- [ ] `POST /interviews/:id/speech` returns playable `audioBase64` for `interviewPersona` in `alex|sarah|marcus|zoe` in local dev.
- [ ] Documented behavior when TTS is intentionally off (`disabled: true` + reason in logs or response).
- [ ] No 400 on valid persona + non-empty `text` for an owned session.
- [ ] p95 latency acceptable for UX (&lt; 3s for typical question length) or streaming documented if added later.

---

## Contact / references (frontend repo)

- API client: `packages/web/src/lib/interview-voice-api.ts`
- TTS hook: `packages/web/src/hooks/useInterviewTTS.ts`
- Session UI: `packages/web/src/app/(dashboard)/dashboard/interview/[sessionId]/page.tsx`
- Session create: `packages/web/src/components/interview/InterviewSetupStepper.tsx` (`personality: selectedPersona.legacyAvatar`)

If the backend team fixes `/speech`, no frontend deploy may be required beyond what is already merged (persona id + analytics). If the contract changes (e.g. new field names), tell us and we will update the client.
