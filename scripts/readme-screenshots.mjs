// Regenerate the README gallery from real source blocks and the current renderer.
// Run `pnpm build`, then `pnpm screenshots`. Uses the CLI's optional Playwright.
import { readFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(new URL('../packages/cli/package.json', import.meta.url));
const { chromium } = require('playwright');
const { parseDocument, validateDocument } = await import('../packages/core/dist/index.js');
const { renderDocument } = await import('../packages/render/dist/index.js');
const output = resolve(root, 'assets/examples');
mkdirSync(output, { recursive: true });

const examples = [
  ['architecture', 'docs/examples/system-overview.md', 'c4'],
  ['sequence', 'README.md', 'sequence'],
  ['data-model', 'docs/examples/api.md', 'erd'],
  ['rollout', 'docs/examples/canary-rollout.md', 'rollout'],
];

const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1080, height: 800 },
    deviceScaleFactor: 1.5,
    colorScheme: 'dark',
  });
  for (const [name, file, type] of examples) {
    await page.setViewportSize({ width: 1080, height: 800 });
    const source = readFileSync(resolve(root, file), 'utf8');
    const fence = source.match(new RegExp('^```' + type + '\\r?\\n[\\s\\S]*?^```(?=\\r?$)', 'm'))?.[0];
    if (!fence) throw new Error(`No ${type} block in ${file}`);
    const doc = parseDocument(fence, name);
    const errors = validateDocument(doc, file).filter((d) => d.level === 'error');
    if (errors.length) throw new Error(JSON.stringify(errors));
    await page.setContent(renderDocument(doc), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    // Match a wide page export when the renderer uses horizontal scrolling.
    const overflow = await page.locator('.diagram-stage--wide, .ro-strip').evaluateAll((stages) =>
      Math.max(0, ...stages.map((el) => el.scrollWidth - el.clientWidth)),
    );
    if (overflow > 0) {
      const width = 1080 + overflow + 32;
      await page.setViewportSize({ width, height: 800 });
      await page.addStyleTag({ content: `:root { --page-max: ${width}px; }` });
    }
    const clipped = await page.locator('.diagram-stage--wide, .ro-strip').evaluateAll((stages) =>
      stages.some((el) => el.scrollWidth > el.clientWidth + 1),
    );
    if (clipped) throw new Error(`${name}: screenshot would crop a scrollable diagram`);
    const section = page.locator('.section-block').first();
    await section.screenshot({ path: resolve(output, `${name}.png`), animations: 'disabled' });
    console.log(`${file} (${type}) → assets/examples/${name}.png`);
  }
} finally {
  await browser.close();
}
