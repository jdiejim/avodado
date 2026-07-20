---
"@avodado/render": patch
"avodado": patch
---

Slide layout audit fixes (found by measuring a real 27-slide deck):

- **Flat code blocks weigh in** — a top-level `code:` snippet counted as 2.0
  regardless of height, so two 24-line terminals piled onto one slide at 0.5×.
  Both spellings now count lines; tall snippets get their own slide.
- **Code takes the stage width** — `<pre>` slides no longer shrink-wrap to a
  narrow strip; height is the only fit axis (0.54× → ~0.8× on real content).
- **Short intros ride with their exhibit** — the kicker threshold rises from
  ~180 to ~400 chars, so a two-sentence lede shares the slide with its hero
  block instead of stranding a near-empty prose slide.
- **Statement slides** — prose-only fragments that still end up alone render
  as a deliberate centered statement (larger, measured type) instead of a
  small lost paragraph.
