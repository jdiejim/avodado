import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const RESOURCES = resolve(import.meta.dirname, '../../../../resources');

export function readFixture(name: string): string {
  return readFileSync(resolve(RESOURCES, name), 'utf8');
}

export const roadmap = (): string => readFixture('avodado-roadmap.md');
export const ordersApi = (): string => readFixture('orders-api.md');
