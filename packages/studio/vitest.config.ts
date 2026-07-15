import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: '@avodado/studio',
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
