import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'chiltepin-studio',
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
