import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/extension.ts'],
  // VS Code's extension host loads CommonJS modules.
  format: ['cjs'],
  target: 'node20',
  platform: 'node',
  sourcemap: true,
  clean: true,
  dts: false,
  splitting: false,
  // Bundle the workspace + core deps into the extension so the .vsix is self-contained.
  noExternal: [/@avodado\//, 'marked', 'yaml', 'zod'],
  // `vscode` is provided by the host at runtime; never bundle it.
  external: ['vscode'],
});
