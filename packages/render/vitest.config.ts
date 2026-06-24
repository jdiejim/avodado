import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: '@avodado/render',
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
