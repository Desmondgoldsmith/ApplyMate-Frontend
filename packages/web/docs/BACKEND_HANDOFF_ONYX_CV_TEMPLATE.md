# Backend handoff — Onyx CV template (PDF / download)

**Audience:** Backend team  
**Frontend status:** Implemented in web preview (`OnyxCvDocument.tsx`). Live editing works in Resume Clinic.  
**Your task:** Remove deprecated international templates from PDF/export pipeline and implement **Onyx** to match the frontend design below. Attach the reference screenshot (`onyx-preview-reference.png` in `packages/web/public/cv-templates/`) when sharing this doc.

---

## 1. Templates to remove

Remove PDF/export support for these template IDs (frontend no longer offers them):

| Template ID (legacy) | Notes |
|----------------------|--------|
| `europass_classic` / `europass-classic` | Europass Classic |
| `europass_modern` / `europass-modern` | Europass Modern |
| `french_cv` / `french-cv` | French CV |
| `german_cv` / `german-cv` | German CV |
| `uk_cv` / `uk-cv` | UK CV |

**Migration:** Existing profiles saved with a removed template should fall back to `classic` (or prompt the user to pick a new template). Do not silently render with a broken layout.

**Current supported template IDs (keep + add Onyx):**

```
classic | modern | creative | professional | onyx
```

Frontend source of truth: `packages/web/src/lib/cvBuilder.ts` → `CvTemplateId`, `CV_TEMPLATE_IDS`.

---

## 2. New template: `onyx`

### Design reference

Two-column A4 résumé:

- **Left sidebar (~35% width):** dark charcoal background, white text, circular profile photo, About Me (summary + contact), Education, Skills.
- **Right column (~65% width):** light gray name header band, then white body with Experience, References (2-column grid), and optional sections.

Match the attached screenshot pixel-for-pixel where possible (spacing, weights, rules/lines, uppercase headers).

---

## 3. Page & layout dimensions

| Property | Value |
|----------|--------|
| Page size | **A4** — 210 × 297 mm |
| Frontend preview canvas | **794 × 1123 px** (96 DPI equivalent) |
| Sidebar width | **35%** of content width |
| Main column width | **65%** (flex remainder) |
| Min page height | Full A4 (1123 px in preview) |
| Outer max width | 794 px centered |

### Column padding

| Area | Padding |
|------|---------|
| Sidebar | `px-5 py-6` → **~20 px** horizontal, **~24 px** vertical |
| Main header band | `px-6 py-5` → **~24 px** horizontal, **~20 px** vertical |
| Main body sections | `px-6 py-5` → **~24 px** horizontal, **~20 px** vertical |

### Section spacing

- Between sections in a column: **~20 px** (`mb-5`)
- Between experience entries: **~14 px** (`space-y-3.5`)
- References grid gap: **16 px** horizontal, **12 px** vertical

---

## 4. Colors

| Token | Hex | Usage |
|-------|-----|--------|
| `ONYX_SIDEBAR` | `#313131` | Left sidebar background |
| `ONYX_HEADER` | `#EBEBEB` | Name / headline header band (right column top) |
| `ONYX_TEXT` | `#333333` | Primary body text (main column) |
| Sidebar text | `#FFFFFF` | All sidebar copy |
| Sidebar muted text | `white @ 95% opacity` | Summary body |
| Sidebar contact text | `white @ 90% opacity` | Phone / email / location rows |
| Sidebar rules | `white @ 40% opacity` | Under section titles |
| Main column rules | `#333 @ 30% opacity` | Under section titles |
| Hyperlinks | `#1D4ED8` | Underlined links in rich text |
| Photo border | `white @ 20% opacity` | Circle photo ring |

---

## 5. Typography

**Font family:** [Montserrat](https://fonts.google.com/specimen/Montserrat) (Google Fonts)

| Weight | CSS | Used for |
|--------|-----|----------|
| 300 | Light | First name part in header |
| 400 | Regular | Headline, company names, body |
| 500 | Medium | — |
| 600 | Semibold | Section titles, school names |
| 700 | Bold | Last name, job titles, reference names, bold labels |

### Type scale (pt → use same ratios in PDF)

| Element | Size | Weight | Case | Notes |
|---------|------|--------|------|-------|
| Full name | **18 pt** | 300 + 700 split | UPPERCASE | First word(s) light, last word bold |
| Headline / job title (header) | **10 pt** | 400 | Sentence | Below name in gray band |
| Sidebar section titles | **11 pt** | 600 | UPPERCASE | White + bottom border |
| Main section titles | **11 pt** | 600 | UPPERCASE | `#333` + bottom border |
| Sidebar summary | **9 pt** | 400 | — | Line-height ~1.625 |
| Sidebar contact rows | **8.5 pt** | 400 | — | Icon + text, 12 px icon |
| Sidebar education / skills | **9 pt** | 400–600 | — | School bold, dates regular |
| Experience job title | **9 pt** | 700 | — | Left on row 1 |
| Experience dates | **9 pt** | 400 italic | — | Right-aligned on row 1 |
| Experience company | **9 pt** | 400 | — | Row 2 |
| Experience bullets | **9 pt** | 400 | — | Disc list, outside marker |
| References | **9 pt** | 400 / 700 | — | Name bold; “Phone:” / “Email:” labels bold |
| Default body | **9.5 pt** | 400 | — | Base document size |

**Letter-spacing:** Section titles use slight tracking (`tracking-wide` / ~0.05 em).

---

## 6. Section structure & data mapping

### Sidebar (fixed default order)

1. **Profile photo** (optional, circular 96 × 96 px / `h-24 w-24`)
2. **About Me** → `summary.text`
   - Below summary: contact rows when enabled in header settings:
     - Phone → `personal.phone`
     - Email → `personal.email`
     - Location → `personal.location`
     - LinkedIn → `personal.linkedin`
     - GitHub → `personal.github`
     - Website → `personal.website`
     - Portfolio → `personal.portfolio`
     - Nationality → `personal.nationality`
     - Date of birth → `personal.dateOfBirth`
   - Icons: phone, mail, map-pin, link, git-branch, globe, flag, calendar (simple line icons, white, 12 px)
3. **Education** → `education.items[]`
   - School name: **bold white**
   - Degree line: degree + field + grade (comma-separated)
   - Dates: `startYear – endYear` (en dash), lighter white
4. **Skills** → flatten all `skills.categories[].skills[]` into a **single flat bullet list** (no category headings in Onyx)

### Main column header band

- **Name** → `personal.name` — split on last space: all but last word = light weight, last word = bold; all uppercase
- **Headline** → `personal.headline` (e.g. “Business Consultant”)

Header visibility flags come from profile header settings (`showTitle`, `showHeadline`, `showPhone`, `showEmail`, `showLocation`, `showPhoto`, `photoStyle: circle`).

### Main column body (default order)

1. **Experience** → `experience.items[]`
   - Row 1: **Job title** (bold, left) + **Date range** (italic, right) — e.g. `Mar 2025 – Feb 2026` or `2020 – Present`
   - Row 2: **Company** (regular)
   - Row 3+: **Bullets** — render `items[].bullets` as a **disc bullet list** (one bullet per line / array entry). Support rich text (bold, links).
2. **References** → `references[]` in a **2-column grid**
   - Each cell: Name (bold), Title · Company, Phone: …, Email: …
3. **Optional sections** (same data as other templates): Projects, Certifications, Languages, Achievements, custom / parsed sections
   - **Projects:** project name bold; bullet list from `bullets` field, else split `description` by newlines
   - **Achievements:** title bold; detail as bullet list (split by newlines)

---

## 7. Lists & bullets (important)

These sections **must render as visible bullet lists**, not plain paragraphs:

- Experience accomplishments (`experience.items[].bullets`)
- Project highlights (`projects[].bullets` or multiline `description`)
- Achievement details (`achievements[].detail`, newline-separated)
- Sidebar skills (flat `ul` with disc markers, white bullets)

**Bullet styling (main column):**

```
list-style: disc outside
padding-left: 16 px (pl-4)
font-size: 9 pt
line-height: ~1.625
marker color: #333333
```

---

## 8. References grid

```
display: grid
grid-template-columns: 1fr 1fr
column-gap: 16 px
row-gap: 12 px
```

Each reference block:

```
{Name}          (bold)
{Title} · {Company}
Phone: {phone}
Email: {email}
```

Omit empty fields gracefully; show em dash or skip line if blank.

---

## 9. Photo

- Shown only when `showPhoto` header toggle is **on** and `personal.photoUrl` is set
- When `showPhoto` is off, **do not render** photo or placeholder in PDF/export
- **Shape:** circle (`border-radius: 50%`)
- **Size:** 96 × 96 px
- **Position:** centered at top of sidebar
- **Object-fit:** cover
- Border: 1 px solid `rgba(255,255,255,0.2)`

### Photo upload persistence (required)

The frontend stores the uploaded image in `personal.photoUrl` on the CV profile’s **personal** section payload (may be a `data:` URL or hosted URL after compression). **Backend must persist and return this field** on:

- `GET` CV profile / sections (personal section)
- `PATCH` / batch upsert when the user uploads or changes a photo
- PDF/export pipeline (resolve `data:` URLs or re-host to durable storage)

If the backend drops `photoUrl`, users lose their photo on refresh. Recommended approach:

1. Accept `photoUrl` on personal section save (same as other `personal.*` fields).
2. For large base64 payloads, optionally upload to object storage and store the CDN URL instead of inline base64.
3. Include `photoUrl` in export rendering when `showPhoto` is true.

Frontend reference: `CVBuilder.tsx` (photo upload), `HeaderFloatingControls.tsx`, `OnyxCvDocument.tsx` (`EditableHeaderPhoto`), `cvBuilder.ts` → `structured.photoUrl` in section payload builder.

---

## 10. Rich text

Summary, experience bullets, project text, and custom bodies may contain HTML from the editor. Support at minimum:

- `<strong>` / `<b>`
- `<em>` / `<i>`
- `<a href="…">` (render as `#1D4ED8` underlined)
- Line breaks

Strip unsafe tags server-side as you do for other templates.

---

## 11. Section title styling

**Sidebar titles (e.g. ABOUT ME, EDUCATION, SKILLS):**

```
font-size: 11 pt
font-weight: 600
text-transform: uppercase
color: #FFFFFF
border-bottom: 1 px solid rgba(255,255,255,0.4)
padding-bottom: 4 px
margin-bottom: 12 px
```

**Main column titles (e.g. EXPERIENCE, REFERENCES):**

```
font-size: 11 pt
font-weight: 600
text-transform: uppercase
color: #333333
border-bottom: 1 px solid rgba(51,51,51,0.3)
padding-bottom: 4 px
margin-bottom: 12 px
```

Default English labels: About Me, Education, Skills, Experience, References. Users can rename section titles in the editor; respect stored overrides if you persist them, else use defaults.

---

## 12. Frontend implementation reference

| File | Purpose |
|------|---------|
| `packages/web/src/components/cv/templates/OnyxCvDocument.tsx` | Full layout + styling constants (`ONYX_SIDEBAR`, `ONYX_HEADER`, `ONYX_TEXT`) |
| `packages/web/src/lib/cvBuilder.ts` | Template ID `onyx`, sample data `cvOnyxTemplatePreviewSampleData()` |
| `packages/web/public/cv-templates/onyx-preview-reference.png` | Visual reference screenshot |

Export constants for PDF engine:

```typescript
ONYX_SIDEBAR = '#313131'
ONYX_HEADER = '#EBEBEB'
ONYX_TEXT   = '#333333'
FONT        = 'Montserrat'
SIDEBAR_WIDTH_RATIO = 0.35
PAGE_WIDTH_PX = 794
PAGE_HEIGHT_PX = 1123
```

---

## 13. QA checklist (backend)

- [ ] Removed templates no longer appear in export API / template enum
- [ ] `onyx` PDF matches frontend preview (colors, fonts, column split)
- [ ] Name renders with light first + bold last, uppercase
- [ ] Sidebar: photo, About Me + contacts, education, flat skills list
- [ ] Experience: title/date row, company, **bulleted** accomplishments
- [ ] References: 2 columns, Phone/Email labels bold
- [ ] Optional sections render when present (projects, certifications, languages, achievements)
- [ ] Rich text links and bold render correctly
- [ ] Sidebar contact toggles: LinkedIn, GitHub, Website, Portfolio, Nationality, DOB render when enabled
- [ ] Photo hidden when `showPhoto` toggle is off
- [ ] `personal.photoUrl` persists across save/load and appears in PDF when photo toggle is on

---

## 14. Questions / coordination

- Confirm exact legacy template ID strings in your DB before deleting enum values.
- If you need a rendered HTML snapshot for regression tests, use frontend preview at `/dashboard/cv` with template `onyx` and sample data from `cvOnyxTemplatePreviewSampleData()`.
- PDF font embedding: include Montserrat weights 300, 400, 600, 700.
