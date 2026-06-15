# @avodado/playground

Live-preview web app for Avodado documents.

## Run locally

```bash
pnpm install
pnpm --filter @avodado/playground dev
# opens http://localhost:5173
```

## Build for hosting

```bash
pnpm --filter @avodado/playground build
# output: packages/playground/dist/  (deploy to Vercel / Netlify / GitHub Pages)
```

## Features

- **Live preview** — edit Markdown in the left pane, see the rendered HTML in
  the right pane (debounced 200 ms).
- **Theme picker** — switch between the four built-in themes (navy / teal /
  plum / slate).
- **Sample picker** — load `orders-api`, `blocks-demo` (all 37 blocks), or the
  Avodado roadmap.
- **Share link** — gzip-compresses the source, base64-encodes, puts it in the
  URL hash. Click "Share link" to copy a self-contained URL to the clipboard.
- **Diagnostics** — schema / parse errors show in a footer pane in the preview
  panel so you can see what's wrong without leaving the editor.

## How it works

The renderer (`@avodado/render`) is pure TypeScript that returns an HTML
string — no DOM, no browser APIs. The playground just calls it on every
keystroke (debounced) and stuffs the output into an `<iframe srcDoc={html}>`
so the renderer's `.docskin` CSS stays isolated from the playground chrome.

Sharing uses the browser-native `CompressionStream('gzip')` API + base64url —
no extra deps and no server needed.
