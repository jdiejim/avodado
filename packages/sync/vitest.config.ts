import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: '@avodado/sync',
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
