# Organizing a documentation set

Part of the **avodado-docs** skill (the hub is `SKILL.md`, one folder up). One
doc is a story; a docs folder is a *library*. Use this when a project outgrows
a single file — or when you're deciding whether it has.

## Where files live

| Path | What it holds |
| --- | --- |
| `docs/` (or the configured `docsDir`) | All docs. One group level: `docs/<area>/<doc>.md`. Deeper nesting is drift. |
| `dist/` (the build default) | Generated output. Never commit it. |
| `.avodado/` | Tooling state — `skill/` is the authoring skill. |
| `avodado.config.json`, `*.theme.json` | Project config and themes, at the root. |
| `resources/` (or any folder outside `docsDir`) | Demo and fixture docs. Not part of the built site. |

Doc filenames are kebab-case slugs: lowercase a-z, 0-9, hyphens, `.md`. The
path is the reference prefix (`doc#id`), so slugs are load-bearing. Put a new
doc at `docs/<area>/<doc>.md` — `avo check` warns (`W_DOC_CONVENTION`) when a
name is not kebab-case or a doc sits deeper than one group level.

## When to split into multiple docs

One document = **one system (or one job) for one audience**. Split when any of
these hold; otherwise stay in one file — a 4-block doc doesn't need a folder.

- **Two audiences.** An integrator reference and a new-joiner explainer about
  the same service are two docs, not two halves of one.
- **Two systems.** The orders service and the notification pipeline each get a
  doc, even if they talk to each other — connect them with refs, not by merging.
- **Two jobs.** "How it works" (overview) and "what to do at 3am" (runbook)
  read at different speeds. A runbook buried in an architecture doc won't be
  found during the incident.
- **The skim breaks.** If reading only the `##` headings no longer tells one
  story (see move 2 in `SKILL.md`), the extra beats want their own doc.

## Slugs — the path *is* the reference prefix

A doc's **slug** is its path under the docs root without `.md`:
`docs/payments/api.md` → slug `payments/api` → its blocks are referenced as
`payments/api#some-id`. Renaming a file renames every ref to it, so:

- **kebab-case** file and folder names (`getting-started.md`, not
  `GettingStarted.md`).
- **Folders are domains**, not types: `docs/payments/`, `docs/identity/` —
  never `docs/diagrams/` or `docs/misc/`.
- Name for the subject, not the format: `orders-api.md`, not `api-doc-v2.md`.
- Avoid ids named like `section-*` — the renderer uses those for its own
  section anchors.

## The index / overview doc

Give a multi-doc set a landing page — `docs/overview.md` (or
`docs/<domain>/overview.md` per domain). It holds a `meta` block, 2-4
sentences of prose on what the set covers, and one big-picture block (`c4`
context or `archmap`). When the set is large, add a `table` or `list` of the
other docs and the job each does. It's the doc a new reader opens first and the
natural home for ids that many docs reference.

## Cross-doc references

- Ids are **repo-global unique** — `id: seq-place-order` can exist once across
  the whole docs tree, so a ref always has exactly one target.
- **Same doc → prefer `#id`** (survives file renames). Other doc →
  `slug#id` (`payments/api#seq-charge`).
- Point stories at the diagrams that realize them
  (`userstory.links[].ref` / `stories.items[].links[].ref` — the ref-bearing
  fields), rather than redrawing the diagram in the second doc.
- Draw each diagram in the doc that *owns* it; every other doc links. When a
  system changes, one block changes.
- `avo check` fails on dangling refs and duplicate ids across the whole set —
  run it after any rename or move.

## How `avo build` and `avo studio` (Site mode) consume the set

The layout above is exactly what the site generator reads:

- **`avo build`** renders every doc under the docs root into a static site.
  `index.html` is a card grid built from each doc's `meta` (title · subtitle ·
  tag — another reason `meta` is never optional). Each doc becomes
  `<slug>.html` (folders keep their nesting), and a sidebar lists every doc
  with the current doc's sections expanded.
- **Refs become links.** A `userstory`/`stories` link chip navigates to its
  target block — same page or `other-doc.html#id` across pages. A dangling ref
  degrades to a plain chip (and `avo check` will name it).
- **`avo studio` Site mode** is the authoring loop: the studio mounts the
  same site from memory under `/site/…` and rebuilds + reloads it on every
  save. Switch the top bar to Site to browse it while you edit.

So the organizing rules pay rent twice: a tidy tree reads well in the repo
*and* ships as a navigable site with no extra configuration.

## Importing instead of transcribing

When a doc's data-table already exists elsewhere, import it rather than
retype it. `avo sync csv <file>` turns a CSV export into a ready-made
`table` / `statustable` / `chart` block (`--out docs/<slug>.md` wraps it in a
new doc). `avo sync openapi <spec> -o docs/api.md` generates a whole API
doc — with `--check` keeping it drift-free in CI. The studio accepts the same
files by drag-drop. The imported result is a normal doc on disk: edit it,
ref it, `avo check` it like anything hand-written.
