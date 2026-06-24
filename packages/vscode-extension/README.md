# Avodado for VS Code

Live preview and inline validation for Avodado documents.

## Features

- **Show preview** — `Avodado: Show Preview to the Side` (or the preview icon
  in the editor title bar) opens a side-by-side preview that updates as you
  type, with full SVG diagrams.
- **Validation underlines** — schema errors, parse errors, and dangling
  `doc#id` references show up as red squiggles with the diagnostic code (e.g.
  `E_SCHEMA`, `E_DANGLING_REF`) in the Problems panel.
- **Theme picker** — `Avodado: Cycle Preview Theme` rotates through
  textbook / minimal / teal / slate. Persists in your VS Code settings.
- **Workspace check** — `Avodado: Validate All Documents` runs validation
  against every file matching the configured glob (default `docs/**/*.md`).

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `avodado.theme` | `"textbook"` | Theme used by the preview (`textbook` / `minimal` / `teal` / `slate`). |
| `avodado.validate.glob` | `"docs/**/*.md"` | Glob for documents validated by `Avodado: Validate All Documents`. |

## Activation

The extension activates when:

- you open a Markdown file, or
- your workspace contains `avodado.config.json`, `avodado.config.yml`, or
  `.avodado/skill/SKILL.md`.

## Local development

```bash
pnpm install
pnpm --filter @avodado/vscode-extension build
# Open this repo in VS Code, press F5
# A new Extension Development Host window launches with the extension loaded.
```

## Build a .vsix (publish-ready)

```bash
pnpm --filter @avodado/vscode-extension build
npx @vscode/vsce package
# produces avodado-0.0.1.vsix
```
