import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'chiltepin-render',
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
