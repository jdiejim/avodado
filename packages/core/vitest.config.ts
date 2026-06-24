import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: '@avodado/core',
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
