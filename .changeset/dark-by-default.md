---
"@avodado/render": minor
"avodado": minor
"@avodado/studio": minor
---

Dark is the look.

- The render skin's bare `:root` now carries the dark set — deeper surfaces (`paper #15171d`, `paper-2 #1d2028`), the rust accent lifted, and a new drawing **well**: every diagram stage paints a step below its frame with the dot grid and a faint centre glow inside a hairline inset. Light is the explicit choice (`data-theme="light"`) and the print look, always.
- New `colorScheme` in `avodado.config.json`: `dark` (default), `light`, or `system` (the reader's OS chooses). `avo html`, `avo slides`, `avo build`, `avo serve`, and Studio's site mount honour it; `renderDocument`, `toSlides`, and `buildSite` take a `colorScheme` option.
- Studio's chrome is dark-first too and follows the same setting, so the canvas and the app never disagree. `/api/meta` reports the scheme.
- `LIGHT_SET`, `DARK_SET`, and `systemSchemeCss` are exported from `@avodado/render` for hosts that compose their own page.
