/**
 * Interactive theme picker (Ink) behind `avo theme`. Writes `avodado.theme.json`
 * for the chosen built-in theme, or scaffolds a custom one to edit.
 */

import React from 'react';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Box, Text, useApp } from 'ink';
import SelectInput from 'ink-select-input';
import { themeFileContents } from './init.js';

const CUSTOM = '__custom__';

const THEME_ITEMS: ReadonlyArray<{ label: string; value: string }> = [
  { label: 'Textbook — warm, classic, sans (default)', value: 'textbook' },
  { label: 'Minimal — clean modern white', value: 'minimal' },
  { label: 'Soft — modern light, indigo accent', value: 'soft' },
  { label: 'Dark — full dark mode', value: 'dark' },
  { label: 'Teal — teal + amber', value: 'teal' },
  { label: 'Plum — plum + pink', value: 'plum' },
  { label: 'Slate — slate sans', value: 'slate' },
  { label: 'Custom… — scaffold avodado.theme.json to edit', value: CUSTOM },
];

interface ThemeAppProps {
  readonly cwd: string;
  readonly onComplete: (theme: string, custom: boolean) => void;
}

export function ThemeApp({ cwd, onComplete }: ThemeAppProps): React.JSX.Element {
  const { exit } = useApp();
  async function pick(value: string): Promise<void> {
    const custom = value === CUSTOM;
    const theme = custom ? 'textbook' : value;
    await writeFile(resolve(cwd, 'avodado.theme.json'), themeFileContents(theme, custom), 'utf8');
    onComplete(theme, custom);
    exit();
  }
  return (
    <Box flexDirection="column">
      <Text bold>Pick a theme:</Text>
      <SelectInput items={[...THEME_ITEMS]} onSelect={(item) => void pick(item.value)} />
    </Box>
  );
}
