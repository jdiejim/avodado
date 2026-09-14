import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { bin: 'src/bin.ts' },
  format: ['esm'],
  dts: false,
  sourcemap: true,
  clean: true,
  target: 'node20',
  treeshake: true,
  splitting: false,
  banner: { js: '#!/usr/bin/env node' },
  external: [
    'chiltepin-core',
    'chiltepin-render',
    'chiltepin-studio', // optional at runtime — `chiltepin studio` imports it lazily
    'ink',
    'ink-select-input',
    'react',
    'commander',
    'fast-glob',
    'jiti',
    'open',
    'picocolors',
    'yaml',
    'playwright',
  ],
});
