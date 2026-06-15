# @avodado/export

HTML and PDF export for Avodado documents. Browser concerns are isolated here, not in `@avodado/core` or `@avodado/render`.

## Install

```
pnpm add @avodado/export @avodado/core
npx playwright install chromium      # one-time, only if you need PDF
```

`playwright` is an `optionalDependency` so installing without Chromium stays light for HTML-only consumers. For PDF you can also let it self-provision: call `toPdf(doc, { autoInstallBrowser: true })` (or use `installChromium()`) to download the matching Chromium on first use — this is what the `avo` CLI does, so versions never drift.

## Usage

```ts
import { parseDocument } from '@avodado/core';
import { toHtml, toPdf } from '@avodado/export';

const doc = parseDocument(markdown, 'orders');
const html = toHtml(doc);             // string
const pdf = await toPdf(doc, { format: 'A4' });  // Uint8Array
await writeFile('orders.pdf', pdf);
```

## API

- **`toHtml(doc)`** — delegates to `@avodado/render`. Returns a standalone HTML string.
- **`toPdf(input, opts?)`** — `input` is a Document or pre-rendered HTML string. Launches headless Chromium via Playwright, sets the HTML, prints to PDF. Browser closed in `finally`.
- **`isChromiumAvailable()`** — `Promise<boolean>`. True only if `playwright` is installed AND the Chromium binary exists on disk. Use to gate optional PDF code paths.

## PDF options

```ts
toPdf(doc, {
  format: 'A4' | 'Letter',           // default A4
  margin: { top, right, bottom, left },
});
```
