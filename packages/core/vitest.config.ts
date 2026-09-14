import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'chiltepin-core',
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
