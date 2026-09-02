# Avodado vs diagram-design — one complex sequence diagram

Run on 1 Sep 2026. Four fresh agents, same model, identical brief: an
access-token refresh with rotation, reuse detection, one retry, and async
audit across six participants. Two wrote an Avodado `sequence` block; two
wrote a self-contained HTML+SVG file with the
[diagram-design](https://github.com/cathrynlavery/diagram-design) skill,
where the model draws every coordinate. Each side ran its own validation.

| Measure | Avodado A | Avodado B | diagram-design A | diagram-design B |
|---|---:|---:|---:|---:|
| Tokens (whole run) | 83,403 | 82,466 | 139,609 | 140,574 |
| Tool calls | 15 | 15 | 21 | 18 |
| Wall time | 2m 33s | 2m 15s | 11m 14s | 8m 21s |
| Bytes the model wrote | 4,158 | 4,533 | 29,388 | 27,454 |
| Arrows drawn | 20 + 4 notes | 24 | 20 | 20 |
| Content dropped to fit | none | none | one hop folded | two events merged |
| Validation | 0 diagnostics | 0 diagnostics | OK, 0 findings | OK, 0 findings |
| Branch frames | notes | notes | ALT frames | ALT frames |

Tokens are the harness total per run, including the cold read of each
skill. n = 2 per side: differences under 10% are noise.

**Run C**, after sequence frames shipped the same day (fresh agent, updated
skill, identical brief): 84,920 tokens, 15 tool calls, 2m 01s, 2,369 bytes
written, 24 arrows inside two nested `alt` frames and one `loop`, nothing
dropped, 0 diagnostics.

## What it says

- The model writes about 7x less and the run costs 40% fewer tokens,
  because the renderer owns layout.
- Both diagram-design runs footnoted that the flow "exceeds the sequence
  budget" and simplified it. Neither Avodado run dropped content. A budget
  in prose makes the model cut; a budget in the renderer makes it split.
- `avo check` validates the data. The geometry scripts validate the
  drawing. Only the first can say the diagram is wrong.
- diagram-design wins on combined-fragment frames (`alt` / `else`) and an
  on-canvas annotation. `sequence.frames` is the next feature this points
  at.

## Reproduce

1. Copy `.avodado/skill` into an empty project with `docs/` and
   `avodado.config.json`; clone diagram-design beside it.
2. Give each fresh agent the brief in `evals/compare/brief.md`, pointing at
   its skill, and let it validate with its own tooling.
3. Record tokens, tool calls, and time from the task notification; count
   bytes written; run `avo check` or the diagram-design scripts.
