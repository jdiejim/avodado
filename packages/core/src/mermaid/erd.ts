/**
 * `erDiagram` → `erd` block data.
 *
 * Supported: relations `A ||--o{ B : label` with every crow's-foot end
 * (`||` `|o` `}o` `}|` on the left; `||` `o|` `o{` `|{` on the right) and
 * both `--` (identifying) and `..` (non-identifying) bodies, mapped to `card`
 * by which side is "many" (a `..` body sets `identifying: false`); entity
 * blocks `A { type name PK "comment" }` with `PK` / `FK` / `UK` flags (`UK` →
 * `unique`, the comment → `note`); quoted entity names. Entities named only
 * in relations are added with no columns. `direction` lines and `%%`
 * comments are ignored.
 */

import { bodyLines, fail, startsWithWord, unquote, type MermaidResult } from './lines.js';

const NAME = '("[^"]+"|[\\w-]+)';
const RELATION_RE = new RegExp(
  `^${NAME}\\s+(\\|o|\\|\\||\\}o|\\}\\|)(--|\\.\\.)(o\\||\\|\\||o\\{|\\|\\{)\\s+${NAME}\\s*(?::\\s*(.*))?$`,
);
const ENTITY_OPEN_RE = new RegExp(`^${NAME}\\s*\\{\\s*(\\})?$`);
const COLUMN_RE = /^(\S+)\s+(\S+)((?:[\s,]+(?:PK|FK|UK))*)\s*("[^"]*")?\s*$/;

interface Column {
  readonly name: string;
  readonly type: string;
  readonly pk?: true;
  readonly fk?: true;
  readonly unique?: true;
  readonly note?: string;
}

interface Entity {
  readonly name: string;
  columns?: Column[];
}

export function convertErd(text: string): MermaidResult {
  const lines = bodyLines(text);
  const entities = new Map<string, Entity>();
  const relations: Record<string, unknown>[] = [];
  let open: Entity | undefined;

  const touch = (name: string): Entity => {
    const e = entities.get(name);
    if (e !== undefined) return e;
    const created: Entity = { name };
    entities.set(name, created);
    return created;
  };

  for (const { text: t, line } of lines) {
    if (line === lines[0]?.line && startsWithWord(t, 'erDiagram')) continue;

    if (open !== undefined) {
      if (t === '}') {
        open = undefined;
        continue;
      }
      const c = COLUMN_RE.exec(t);
      if (c === null) {
        return fail(`cannot read column in ${open.name}: "${t}" (expected \`type name [PK|FK]\`)`, line);
      }
      const keys = (c[3] ?? '').split(/[\s,]+/).filter((k) => k.length > 0);
      const note = c[4] !== undefined ? unquote(c[4]) : '';
      const col: Column = {
        name: c[2] ?? '',
        type: c[1] ?? '',
        ...(keys.includes('PK') ? { pk: true as const } : {}),
        ...(keys.includes('FK') ? { fk: true as const } : {}),
        ...(keys.includes('UK') ? { unique: true as const } : {}),
        ...(note.length > 0 ? { note } : {}),
      };
      open.columns = [...(open.columns ?? []), col];
      continue;
    }

    if (startsWithWord(t, 'direction')) continue;

    const eo = ENTITY_OPEN_RE.exec(t);
    if (eo !== null) {
      const e = touch(unquote(eo[1] ?? ''));
      if (eo[2] === undefined) open = e;
      continue;
    }

    const r = RELATION_RE.exec(t);
    if (r !== null) {
      const from = unquote(r[1] ?? '');
      const to = unquote(r[5] ?? '');
      const leftMany = (r[2] ?? '').startsWith('}');
      const rightMany = (r[4] ?? '').endsWith('{');
      const card = leftMany ? (rightMany ? 'N:M' : 'N:1') : rightMany ? '1:N' : '1:1';
      const nonIdentifying = r[3] === '..';
      const label = r[6] !== undefined ? unquote(r[6]) : '';
      touch(from);
      touch(to);
      relations.push({
        from,
        to,
        ...(label.length > 0 ? { label } : {}),
        card,
        ...(nonIdentifying ? { identifying: false } : {}),
      });
      continue;
    }

    return fail(
      `cannot read erDiagram line: "${t}" (expected \`A ||--o{ B : label\` or an entity block \`A {\`)`,
      line,
    );
  }

  if (open !== undefined) return fail(`entity ${open.name} is missing its closing \`}\``, lines[lines.length - 1]?.line ?? 1);

  const outEntities = [...entities.values()].map((e) => ({
    name: e.name,
    ...(e.columns !== undefined ? { columns: e.columns } : {}),
  }));

  return {
    ok: true,
    data: {
      ...(outEntities.length > 0 ? { entities: outEntities } : {}),
      ...(relations.length > 0 ? { relations } : {}),
    },
  };
}
