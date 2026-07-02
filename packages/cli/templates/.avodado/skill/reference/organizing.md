# Organizing a documentation set

Part of the **avodado-docs** skill (the hub is `SKILL.md`, one folder up). One
doc is a story; a docs folder is a *library*. Use this when a project outgrows
a single file — or when you're deciding whether it has.

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
`docs/<domain>/overview.md` per domain): a `meta` block, 2-4 sentences of
prose on what the set covers, one big-picture block (`c4` context or
`archmap`), and — when the set is large — a `table` or `list` of the other
docs and the job each does. It's the doc a new reader opens first and the
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

## How `avo build` and `avo serve` consume the set

The layout above is exactly what the site generator reads:

- **`avo build`** renders every doc under the docs root into a static site:
  `index.html` is a card grid built from each doc's `meta` (title · subtitle ·
  tag — another reason `meta` is never optional), each doc becomes
  `<slug>.html` (folders keep their nesting), and a sidebar lists every doc
  with the current doc's sections expanded.
- **Refs become links.** A `userstory`/`stories` link chip navigates to its
  target block — same page or `other-doc.html#id` across pages. A dangling ref
  degrades to a plain chip (and `avo check` will name it).
- **`avo serve`** is the authoring loop: it serves the same site from memory
  and rebuilds + reloads the browser on every save, showing diagnostics as an
  in-page banner instead of crashing.

So the organizing rules pay rent twice: a tidy tree reads well in the repo
*and* ships as a navigable site with no extra configuration.
