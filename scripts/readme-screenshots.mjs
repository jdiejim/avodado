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
  ['sequence', 'docs/examples/checkout-design.md', 'sequence'],
  ['data-model', 'docs/examples/checkout-design.md', 'erd'],
  ['rollout', 'docs/examples/checkout-design.md', 'rollout'],
  ['pipeline', 'docs/examples/chiltepin-pipeline.md', 'block'],
  ['deployment', 'docs/examples/deployment-topology.md', 'block'],
  ['platform', 'docs/examples/platform-architecture.md', 'block'],
  ['agent', 'docs/examples/research-agent.md', 'agentloop'],
  ['agent-context', 'docs/examples/research-agent.md', 'context'],
  ['transport', 'docs/examples/transport-network.md', 'c4'],
  ['graph', 'docs/examples/transport-network.md', 'graph'],
  ['document', 'docs/examples/checkout-design.md', null],
  ['agent-document', 'docs/examples/research-agent.md', null],
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
    const content = type
      ? source.match(new RegExp('^```' + type + '\\r?\\n[\\s\\S]*?^```(?=\\r?$)', 'm'))?.[0]
      : source;
    if (!content) throw new Error(`No ${type} block in ${file}`);
    const doc = parseDocument(content, name);
    const errors = validateDocument(doc, file).filter((d) => d.level === 'error');
    if (errors.length) throw new Error(JSON.stringify(errors));
    await page.setContent(renderDocument(doc), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => window.scrollTo(0, 0));
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
    if (type) {
      await page.locator('.section-block').first().screenshot({
        path: resolve(output, `${name}.png`), animations: 'disabled',
      });
    } else {
      await page.screenshot({ path: resolve(output, `${name}.png`), fullPage: true, animations: 'disabled' });
      // The cover includes the real document header, prose, and first diagram.
      // Clip at its section boundary rather than cutting through the next figure.
      const first = await page.locator('.section-block').first().boundingBox();
      if (!first) throw new Error(`${file}: no first section to capture`);
      const clip = { x: 0, y: 0, width: page.viewportSize().width, height: Math.ceil(first.y + first.height + 32) };
      // Playwright intersects a clip with the viewport unless fullPage is set.
      // Size the viewport to the cover so its top and diagram footer both fit.
      await page.setViewportSize({ width: clip.width, height: clip.height });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: resolve(output, `${name}-cover.png`), clip, animations: 'disabled' });
      await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
      await page.screenshot({ path: resolve(output, `${name}-light.png`), clip, animations: 'disabled' });
    }
    console.log(`${file} (${type ?? 'full document + dark/light covers'}) → assets/examples/${name}.png`);
  }
} finally {
  await browser.close();
}
