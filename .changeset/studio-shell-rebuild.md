---
'@avodado/studio': minor
'avodado': patch
---

feat(studio): shell rebuild — rail navigation, one top bar, unified insert picker, surfaced validation, one theme panel, narrow layout

- **Rail navigation**: a persistent left rail replaces the doc switcher and the
  Home "mode" — brand, doc search (⌘K), New doc, an "All documents" root view,
  docs grouped by folder with per-doc error dots, and a footer with Site ↗ and
  Settings (autosave lives there now). Narrow windows collapse it to a 52px
  icon strip; search opens the full rail as a drawer.
- **Doc table**: "All documents" is a table (name · folder · edited · check
  status), most recently edited first, with a template-picker empty state.
- **One top bar**: crumb · check chip · Library · Share ▾ (link, exports,
  site) · Theme · Present · one Save button with a plain status text.
- **One insert picker**: the `/` command, the gap `+`, and the Library button
  open the same component (compact ↔ browse faces, one search, one footer).
- **Docked block inspector**: the Edit Sheet presents as a right-docked panel
  at wide widths — the canvas stays visible and scrolls beside it, the
  selected card keeps its ring, and the in-panel preview is a toggle (the
  live document is the preview; the block updates on Done). All sheet
  semantics (draft, tabs, Cancel/Done, ⌘⏎, Esc) are unchanged.
- **Validation surfaced**: per-block error badges + red rings on the canvas,
  the check chip opens a results popover whose rows deep-link to the block and
  field ("checked live" — diagnostics re-run on every edit), the review dialog
  shows an error-count line, the doc list / rail show per-doc status from the
  server's `errorCount`, and the All-documents view gets an aggregate chip
  whose popover lists the failing docs.
- **One theme panel**: the Theme button opens a right-docked panel — theme
  cards (apply instantly) plus the customize form (the old generator), ending
  in one "Save theme" write.
- **Narrow layout (≤820px)**: icon-strip rail with a drawer, a ⋯ overflow
  menu folding Library / Share / Theme / Present (check chip and Save stay on
  the bar), and the Edit Sheet presented as a bottom sheet (full width,
  rounded top, drag-handle affordance — same component and behavior).
- **Kill list applied**: DocSwitcher, HomeView-as-mode, Site mode chrome, the
  HintBar and the one-time direct-edit hint (the contextual keybar + `?`
  overlay are THE hint surface, one dismissal key, legacy keys migrated), the
  gap-drop "new block" DnD branch, and stale `?`-overlay content (Site-mode
  claims removed; the `n` annotate chord and the current shell documented).

`avodado` (the studio server) is patched for the shell: `/api/docs` now
carries a per-doc `errorCount` (mtime-cached), which the doc table and rail
status read.
