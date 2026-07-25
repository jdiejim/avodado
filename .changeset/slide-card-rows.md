---
"@avodado/render": minor
"@avodado/studio": patch
"avodado": minor
---

Card and list blocks stop presenting at page width on a slide. Shrink-wrapped
to their natural width, they sat where the fitter's text ceiling (1.06×) left
them: a checklist covered 30% of the stage, a status board 52%, a set of KPI
cards 64%. They now take the stage the way tables do — 20 blocks move to full
width, including `list`, `cvt`, `kanban`, `stories`, `spec`, `anatomy`,
`changelog`, `prompt`, `team`, `stats`, `proscons`, `dodont` and `userstory`.

Stacked cards go **across** the stage rather than down it: `slo`, `okr`,
`stories`, `envelope` and `trace` lay their cards out with `auto-fit`, so as
many fit as stay readable and the rest wrap — the same mechanism `drivers` and
`options` already used. Three SLOs side by side instead of a column took that
block from 24% of the stage to 98%, and its labels from 7.2px to 12.3px.

`pullquote` and `bignumber` are deliberately excluded: they are hero text, not
card stacks, so they keep the shrink-wrap that lets the fitter enlarge them —
and a pull quote now reads at statement size (22px) on the stage.

Across the library this takes blocks that land clean on a slide from 34 of 77
to 59, with no slide clipping at 1120×630. What remains is diagram labels
(their wrap widths are baked into the viewBox) and four blocks that need a
different drawing on a slide rather than a bigger one.
