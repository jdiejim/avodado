import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The website is a Next.js app with no vitest setup — keep it out of the
    // root test run (mirrors the build/typecheck filters in package.json).
    projects: ['packages/*', '!packages/website'],
  },
});
