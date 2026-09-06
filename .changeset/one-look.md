---
'avodado': minor
'@avodado/studio': minor
'@avodado/render': patch
'@avodado/mcp': patch
---

One look. Theme presets are gone: the editorial skin is the single look for every export, and it follows the reader's OS light/dark setting. Removed: `avo theme` (and `avodado.theme.json`, `.avodado/themes/`, `~/.avodado/themes/`), the theme step in `avo init`, the `theme` line in the bare `avo` status, the Studio theme panel with its `/api/theme` route and `/api/meta` theme fields, and the `theme` parameter of the MCP `render_document` tool. A leftover `theme` key in `avodado.config.json` is ignored silently. `@avodado/render` keeps `ThemeName` as the single name `textbook` (label `Editorial`), `themeStyle()` returns `''`, rendered pages no longer stamp `data-theme` on `<html>` (the `[data-theme="dark"]` CSS stays so a host page can force dark), and `themeVars` remains an internal `:root` override with no user surface.
