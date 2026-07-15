import { defineConfig } from 'tsup';

export default defineConfig({
  // Node-only entry: exposes the built app's asset directory to the CLI.
  // `clean` MUST stay false — `vite build` has already written dist/app and
  // runs first in the package's build script.
  entry: { index: 'src/node/index.ts' },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: false,
  target: 'node20',
  treeshake: true,
  splitting: false,
});
