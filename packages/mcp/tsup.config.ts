import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  dts: false,
  sourcemap: true,
  clean: true,
  target: 'node20',
  banner: { js: '#!/usr/bin/env node' },
  // @avodado/* and the SDK are normal deps (published); not bundled.
  external: ['@avodado/core', '@avodado/render', '@avodado/sync', '@modelcontextprotocol/sdk', 'zod', 'zod-to-json-schema'],
});
