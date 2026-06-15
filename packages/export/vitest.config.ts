import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: '@avodado/export',
    include: ['src/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30000,
  },
});
