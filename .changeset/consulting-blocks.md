---
"@avodado/core": minor
"@avodado/render": minor
"@avodado/studio": patch
"@avodado/mcp": patch
"avodado": minor
---

Two blocks a consulting deck opens and closes with, and three fixes to how a
slide handles text. 84 → 86 types.

- **`harvey`** — the rated comparison grid: options across the top, criteria
  down the side, a Harvey ball (0–4) for each judgement. The WEIGHTED footer is
  computed from the balls, so the column marked `recommend` and the arithmetic
  can be seen to agree. A row shorter than `columns` reads as *not assessed*
  rather than as a zero — different claims. Use `benchmark` for measured
  numbers, `harvey` for judgements.
- **`scqa`** — the executive summary in Minto order: situation, complication,
  question, answer. Every field is optional but the order is fixed, which is
  the block's job; `answer` takes the filled card and `because` hangs the
  support beneath it.

**Slides:** a block's `lede` used to vanish on a slide — it lives in the
section head, which the stage hides. It now pins under the slide title as the
supporting line of an action title, at a fixed size so the fitter can't shrink
it with the exhibit. Body copy also moves to presentation sizes (19px prose,
17.5px list items, 19.5px in a `{split}` message column) with the measure still
capped, because long lines are harder to follow on a screen, not easier.
