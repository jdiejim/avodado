/**
 * Interactive prompt picker (Ink) behind `avo prompt`. Lists built-in + saved
 * prompts; selecting one resolves its text, which the caller prints for copying.
 */

import React from 'react';
import { Box, Text, useApp } from 'ink';
import SelectInput from 'ink-select-input';
import { BUILTIN_PROMPTS, readSavedPrompt, type SavedPrompt } from './prompts.js';

const SAVED_PREFIX = 'saved:';

interface PromptAppProps {
  readonly saved: ReadonlyArray<SavedPrompt>;
  readonly onPick: (label: string, text: string) => void;
}

export function PromptApp({ saved, onPick }: PromptAppProps): React.JSX.Element {
  const { exit } = useApp();
  const items = [
    ...BUILTIN_PROMPTS.map((p) => ({ label: p.label, value: p.slug })),
    ...saved.map((s) => ({ label: `${s.label} — saved`, value: `${SAVED_PREFIX}${s.file}` })),
  ];
  function pick(value: string): void {
    if (value.startsWith(SAVED_PREFIX)) {
      const file = value.slice(SAVED_PREFIX.length);
      const match = saved.find((s) => s.file === file);
      onPick(match?.label ?? 'prompt', readSavedPrompt(file));
    } else {
      const def = BUILTIN_PROMPTS.find((p) => p.slug === value);
      if (def !== undefined) onPick(def.label, def.text);
    }
    exit();
  }
  return (
    <Box flexDirection="column">
      <Text bold>Pick a prompt to copy:</Text>
      <SelectInput items={items} onSelect={(item) => pick(item.value)} />
    </Box>
  );
}
