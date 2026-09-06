---
'@avodado/render': patch
'@avodado/studio': patch
---

Editorial skin, rollout C: every HTML-rendered block now follows `DESIGN.md`.

- `css.ts` carries hex only inside the `:root` / dark token blocks; every rule names a role. New tokens: `--series-1…5` (chart series ramp, light + dark), `--ink-2` / `--ink-3` (tone steps for the heatmap ramp), and `--code-*` for the one deliberate dark surface (code, diff, terminal, gallery cards).
- Tables (`table`, `matrix`, `statustable`, `tracker`, `scorecard`, `harvey`, `scenarios`, `benchmark`, state transition tables): a `paper-2` header band with eyebrow text in `muted`, hairline rows, 50 % `paper-2` zebra, 6 px radius, no shadows. The featured / winning / base column is the one accent (accent underline in the header, `accent-tint` down the column).
- One status-chip encoding for every status, priority, tone and kind pill (statustable, kanban, tracker, changelog, okr, risk, inventory, endpoint status, trace roles, options verdicts): a word plus ink outline · `paper-2` fill (done) · accent outline (current / recommended) · negative outline (blocked / error) · dashed outline (todo / future). No hue per status.
- Callouts: tone by left rule only (note hairline, tip accent, warn / danger negative, info link, success ink on paper-2); text is always ink.
- Cards (options, drivers, composition, spec, list, stories, pattern, gallery, figure, envelope, slo, okr, persona, team, dodont, trace, prompt, changelog, risk, faq, palette, swot): paper surface, `rule-solid` hairline, 6 px radius, no shadow, no coloured top bars. Avatars are `paper-2` with ink initials; ✓ is ink, ✗ is negative; bignumber, pullquote, scqa and the envelope result are ink with at most one accent rule.
- Diagram-like HTML (layers, archmap, storymap, composition, anatomy, agentloop, context, packet, wireframe): paper / paper-2 fills, ink strokes, `.t-eyebrow` chips for kinds. Storymap: the slice label column no longer clips, activity headers are paper cards with a `STEP n` eyebrow and `.t-name`, and only the first release slice carries the 3 px accent rule. Agentloop: the agent card is the one accent; tools and memory are paper-2. Context: segments use the series ramp and labels sit on a paper mask. Packet: fields alternate paper / paper-2 with ink strokes. Wireframe: ink / negative / paper-2 buttons, no drop shadow.
- `okr` renders each key result's status as a word chip next to the bar, so the bar tone never carries the status alone.
- Contrast: every text element in these blocks clears WCAG AA (4.5:1). `--soft` moves to `#5f6876` (4.8:1 on paper-2). The contrast audit script now scrolls instantly so elements below the fold are measured against their real background.
