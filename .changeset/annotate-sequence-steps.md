---
"@avodado/studio": minor
"@avodado/render": patch
"avodado": patch
---

**Annotate sequence steps from the canvas.** Select a message in a sequence
diagram and a "＋ add note ②" button (and an `n` shortcut, taught in the hint
chip) opens the editor focused on that message's `summary` — the annotation
appears automatically in the Step-by-step list under the diagram with the SAME
reference number as the diagram badge (the list now shows real message numbers,
so a note on step 4 reads ④ even when steps 1–3 have none). Structured edits on
terse sugar items (arrow messages, string cards…) now materialize the item to
its object form first instead of failing silently — annotating a one-liner
message just works, and untouched siblings keep their terse spelling.
