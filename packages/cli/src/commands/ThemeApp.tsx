/**
 * Interactive theme picker (Ink) behind `avo theme`. Writes `avodado.theme.json`
 * for the chosen built-in theme, copies a saved custom theme from
 * `.avodado/themes/`, or scaffolds a blank custom one to edit.
 */

import React from 'react';
import { writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Box, Text, useApp } from 'ink';
import SelectInput from 'ink-select-input';
import { themeFileContents } from './init.js';
import type { SavedTheme } from '../io/theme.js';

const CUSTOM = '__custom__';
const SAVED_PREFIX = 'saved:';

const BUILTIN_ITEMS: ReadonlyArray<{ label: string; value: string }> = [
  { label: 'Textbook — warm, classic, sans (default)', value: 'textbook' },
  { label: 'Minimal — clean modern white', value: 'minimal' },
  { label: 'Soft — modern light, indigo accent', value: 'soft' },
  { label: 'Dark — full dark mode', value: 'dark' },
  { label: 'Teal — teal + amber', value: 'teal' },
  { label: 'Plum — plum + pink', value: 'plum' },
  { label: 'Slate — slate sans', value: 'slate' },
];

/** What the picker resolved to, for the caller's confirmation message. */
export interface ThemePick {
  readonly label: string;
  readonly kind: 'builtin' | 'saved' | 'custom';
}

interface ThemeAppProps {
  readonly cwd: string;
  readonly saved: ReadonlyArray<SavedTheme>;
  readonly onComplete: (pick: ThemePick) => void;
}

export function ThemeApp({ cwd, saved, onComplete }: ThemeAppProps): React.JSX.Element {
  const { exit } = useApp();
  const items = [
    ...BUILTIN_ITEMS,
    ...saved.map((s) => ({ label: `${s.name} — saved custom`, value: `${SAVED_PREFIX}${s.file}` })),
    { label: 'New blank custom… — scaffold avodado.theme.json to edit', value: CUSTOM },
  ];
  async function pick(value: string): Promise<void> {
    const active = resolve(cwd, 'avodado.theme.json');
    if (value === CUSTOM) {
      await writeFile(active, themeFileContents('textbook', true), 'utf8');
      onComplete({ label: 'custom', kind: 'custom' });
    } else if (value.startsWith(SAVED_PREFIX)) {
      const file = value.slice(SAVED_PREFIX.length);
      await writeFile(active, await readFile(file, 'utf8'), 'utf8');
      const match = saved.find((s) => s.file === file);
      onComplete({ label: match?.name ?? 'custom', kind: 'saved' });
    } else {
      await writeFile(active, themeFileContents(value, false), 'utf8');
      onComplete({ label: value, kind: 'builtin' });
    }
    exit();
  }
  return (
    <Box flexDirection="column">
      <Text bold>Pick a theme:</Text>
      <SelectInput items={items} onSelect={(item) => void pick(item.value)} />
    </Box>
  );
}
