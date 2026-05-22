# Dashboard confidence and scores

This document is the **source of truth** for how the frontend labels and explains numeric fields that are all named `confidence` (or similar) in the API but measure **different things**. Copy in the app should match this so users do not read one percentage as another (for example, follow-up priority as job match %).

## Scores vs confidence-style fields

- **Scores** (momentum index, CV score, job match, outlook indexes) describe strength, fit, or a modeled index.
- **Confidence-style fields** (still often `confidence` in JSON) describe **how strongly to trust or prioritize** a specific insight or CTA—not pass/fail odds and not the same as another card’s score.

---

## Field reference

### `upcomingInterviews[].confidence`

| UI label | **Prep priority** |
| Meaning | How much we suggest prioritizing prep for this interview soon (timing, proximity, context). |
| Not | Job match %, interview pass probability, or “how good” your profile is. |

---

### `careerMomentum.confidence`

| UI label | **Momentum clarity** |
| Meaning | How reliable the **momentum index** is from the data we currently have (richness / stability of the read). |
| Not | CV quality. CV quality stays on **CV score** / **CV clinic** paths—not this bar. |

---

### `predictiveOutlook.confidence`

| UI label | **Outlook data strength** |
| Meaning | How much recent activity we had to build the outlook row—not a verdict on you. |
| Not | Chance of interview or offer. The interview/offer **indexes** are separate fields with their own labels and tooltips. |

---

### `followUpIntelligence.confidence`

| UI label | **Follow-up priority** |
| Meaning | How strongly we suggest prioritizing this follow-up in the dashboard right now. |
| Not | Job match %, application quality, or pass/fail odds. |

---

### `opportunityDetection.confidence`

| UI label | **Opportunity priority** |
| Meaning | How strongly we suggest surfacing this opportunity nudge now. |
| Not | Your overall job-search grade or job match for a specific role (unless that role’s match is shown elsewhere as **Match score**). |

---

### `strategicRecommendation.confidence` and command strip / “Best strategic move”

| UI label | **Move priority** (card) / **Priority signal** (command strip when applicable) |
| Meaning | How strongly we suggest this strategic move or strip CTA versus alternatives we could show. |
| Not | Job match % or a second momentum/CV score. |

---

### `goalStrategicCoaching.confidence`

| UI label | **Goal coaching priority** |
| Meaning | How well this goals & strategy coaching block fits what we know to highlight now. |
| Not | Progress toward your goal as a percentage or job match. |

---

### `strategicCoaching.confidence` (standalone Strategic Coaching card)

| UI label | **Strategic coaching priority** |
| Meaning | Same family as goal coaching priority: how well this coaching card fits what to highlight now. |
| Not | Job match % or a momentum/CV score. |

---

### `strategicWeeklyCoaching.confidence`

| UI label | **Weekly coaching fit** |
| Meaning | How well this week’s coaching theme fits the signals we saw. |
| Not | Your worth or guaranteed outcomes for the week. |

---

### Weekly briefing `confidence` (briefing card)

| UI label | **Week signal strength** |
| Meaning | How much real activity we had to base the summary on (data richness for the week). |
| Not | How “good” you were this week or job match %. |

---

### `commandBar.confidence` (resolved strip)

| UI label | **Priority signal** |
| Meaning | Same family as the winning card’s confidence: how strongly we’re surfacing **this** strip CTA. Depends on `commandBar.source` (priority intelligence, follow-up, opportunity, CV clinic, continuation). |
| Not | Job match % or interview odds. Tooltip text is chosen **per source** in the app. |

---

### Continuation queue items `confidence`

| UI label | **Resume signal** |
| Meaning | How confident we are that this is the right task to resume in the queue—not a grade on the work. |
| Not | Job match % or CV score. |

---

### Next best action `confidence`

| UI label | **Action signal** |
| Meaning | How strongly this action was picked as the single “next” step from competing options. |
| Not | Job match % or interview probability. |

---

## Deterministic index `confidenceBand` (predictive / index payloads)

Optional copy from the API may still use the word “confidence” internally; in UI we prefer phrasing like **signal band** or use the API’s own `label` / `description` when present (`deterministicIndexTooltipText`).
