# Question for backend: CV profile PATCH + AI improve endpoints

Hi — the web app calls a few CV endpoints that either **400**, **404**, or need a **confirmed contract**. Can you confirm or implement the following?

---

## 1. `PATCH /cv/profile` (extended fields)

**Observed:** `PATCH` with a JSON body sometimes returns **400 Bad Request** when saving the CV builder (e.g. onboarding “Finish & continue”).

**Frontend currently sends** (only keys with non-empty values):

- `headline` (optional — omitted if blank)
- `phone`, `location`, `website` (optional)
- `linkedin`, `github` (optional)

**Questions:**

1. What is the **exact** allowed body for `PATCH /cv/profile`? (field names, types, max lengths, URL validation rules.)
2. Are `linkedin` and `github` supported on this route, or should those live elsewhere (e.g. nested under `structured`)?
3. If `headline` is omitted when empty, is that OK, or does the API require `headline` to always be present (even `""`)?

Once the DTO is confirmed, we’ll align `buildCvProfilePatch` in `packages/web/src/lib/cvBuilder.ts` exactly to it.

---

## 2. `POST /cv/improve/bullet`

**Observed:** Request to `POST /api/cv/improve/bullet` returns **400 Bad Request** (when the API base is the same host as the Next app, e.g. `http://localhost:3000/api`).

**Frontend sends:**

```json
{ "bullet": "<string>", "context": "<optional string>" }
```

**Questions:**

1. Does this route exist on the real API? If yes, what is the **exact** request schema and a **sample success response**?
2. What should the response shape be so the client can read improved text? (We currently accept: `suggestions[]`, `options[]`, `variants[]`, or `improved` / `text` inside the standard `{ success, data }` envelope.)

---

## 3. `POST /cv/improve/summary` (optional)

**Observed:** **404 Not Found** — the web client tries this first for “Generate summary with AI”, then falls back to `improve/bullet`.

**Desired behaviour (if you can add it):**

- **Method:** `POST /cv/improve/summary`
- **Body:** e.g. `{ "context": "<long string with title, skills, experience facts>" }`  
  (or whatever shape you prefer; we’ll match it.)
- **Response:** `{ "summary": "<2–3 sentence first-person CV summary>" }` (or under your usual `data` envelope).

If you prefer **not** to add a separate route, please confirm that **`POST /cv/improve/bullet`** is the **only** supported AI rewrite entry point and the expected payload for “full summary” style prompts.

---

## 4. Base URL reminder

The browser client uses `NEXT_PUBLIC_API_URL` (see `packages/web/src/lib/axios.ts`), defaulting to `http://localhost:3000/api/`.  
If AI routes only exist on another service or path, share the **canonical** paths so we can update env or route mapping.

Thanks — once the above is clarified or implemented, we can remove defensive fallbacks and show clearer errors when AI is unavailable.
