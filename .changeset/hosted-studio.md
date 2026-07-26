---
'@avodado/studio': minor
---

Studio can now run with no server behind it, and every document is shareable as a link.

Storage sits behind one interface (`StudioBackend`) with two implementations: the
file bridge `avo studio` already used, and an in-tab vault for a hosted studio.
The package ships both builds — `dist/app` for the CLI and `dist/web` for a
static host — so `avo studio` is unchanged: same file bridge, same `docs/*.md`
as the source of truth, same PDF and PowerPoint export.

The hosted build hides what needs a server (PDF, PowerPoint, the built site,
file-change events) rather than offering buttons that fail, and keeps everything
the browser does on its own: editing, validation, rendering and presenting.

**Share** copies a link that carries the whole document, deflated into the URL
fragment — nothing is uploaded and nothing expires. Hold ⇧ for a link that opens
straight into the deck.
