---
"avodado": minor
"@avodado/render": patch
"@avodado/studio": patch
---

Export size presets and accessibility fixes.

`avo html` and `avo pdf` accept `--size sm|md|lg|xl` (720 / 960 / 1280 / 1600 px page width). Without the option, output keeps the default width (1180 px content column; A4 PDF page). For PDF, the preset sets the page width with portrait A-series proportions.

Accessibility: harvey rating balls now carry `role="img"` and an `aria-label` ("N of 4"). Theme tokens that failed WCAG AA text contrast were darkened: the muted-text gray in the base palette (`#8a8475` → `#6f695b`), `minimal` (`#888888` → `#6e6e6e`), and `soft` (`#8b93a7` → `#646c7e`); the accent in `teal`/`soft` (`#f59e0b` → `#b45309`) and `slate` (`#0d9488` → `#0d6d66`).
