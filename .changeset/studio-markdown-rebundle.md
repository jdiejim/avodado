---
"@avodado/studio": patch
"avodado": patch
---

Rebuild Studio's browser bundle with @avodado/render 0.26.1 so the Studio
canvas highlights `lang: markdown` snippets like the CLI exports do. (Studio
bundles the renderer at its own publish time — the previous release shipped
the new renderer to the CLI but not to the Studio canvas.)
