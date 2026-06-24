import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: '@avodado/cli',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
  },
});
