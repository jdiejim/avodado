---
"avodado": minor
"@avodado/studio": minor
---

Add a **Theme Generator** to Avodado Studio. A "Theme" button in the toolbar
opens a right-docked panel where you pick a base theme and tune the 11 friendly
colors + 3 font slots, with the canvas re-tinting live as you edit. **Install**
writes a `*.theme.json` into the project's `.avodado/themes` (or `~/.avodado/themes`
for a global theme) via a new `POST /api/theme` route on the file bridge, and
activates it — so it immediately appears in the theme picker and in `avo theme`.
