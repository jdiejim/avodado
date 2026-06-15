/**
 * Interactive `avo init` wizard (Ink).
 *
 * Two steps: a multi-select for AI-tool adapters (space toggles, enter confirms)
 * and a single-select theme picker (with a "Custom…" option that scaffolds
 * `avodado.theme.json`). It then runs {@link runInit} and hands the result back
 * via `onComplete` so the CLI can print the summary after Ink unmounts.
 */

import React, { useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import { runInit, AI_TOOLS, type AiTool, type InitResult } from './init.js';

const CUSTOM = '__custom__';

const THEME_ITEMS: ReadonlyArray<{ label: string; value: string }> = [
  { label: 'Minimal — clean modern white (default)', value: 'minimal' },
  { label: 'Soft — modern light, indigo accent', value: 'soft' },
  { label: 'Dark — full dark mode', value: 'dark' },
  { label: 'Teal — teal + amber', value: 'teal' },
  { label: 'Plum — plum + pink', value: 'plum' },
  { label: 'Slate — slate sans', value: 'slate' },
  { label: 'Custom… — scaffold avodado.theme.json to edit', value: CUSTOM },
];

interface InitAppProps {
  readonly cwd: string;
  readonly force?: boolean;
  readonly onComplete: (result: InitResult, theme: string) => void;
}

export function InitApp({ cwd, force, onComplete }: InitAppProps): React.JSX.Element {
  const { exit } = useApp();
  const [step, setStep] = useState<'tools' | 'theme' | 'working'>('tools');
  const [cursor, setCursor] = useState(0);
  const [selected, setSelected] = useState<Set<AiTool>>(new Set(AI_TOOLS.map((t) => t.id)));

  useInput((input, key) => {
    if (step !== 'tools') return;
    if (key.upArrow) setCursor((c) => (c - 1 + AI_TOOLS.length) % AI_TOOLS.length);
    else if (key.downArrow) setCursor((c) => (c + 1) % AI_TOOLS.length);
    else if (input === ' ') {
      const tool = AI_TOOLS[cursor];
      if (tool === undefined) return;
      const id = tool.id;
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    } else if (key.return) {
      setStep('theme');
    }
  });

  async function finish(themeValue: string): Promise<void> {
    setStep('working');
    const custom = themeValue === CUSTOM;
    const theme = custom ? 'minimal' : themeValue;
    const result = await runInit({
      cwd,
      ...(force === true ? { force: true } : {}),
      tools: AI_TOOLS.map((t) => t.id).filter((id) => selected.has(id)),
      theme,
      ...(custom ? { customTheme: true } : {}),
    });
    onComplete(result, theme);
    exit();
  }

  if (step === 'tools') {
    return (
      <Box flexDirection="column">
        <Text bold>
          Which AI tools do you use?{' '}
          <Text dimColor>(↑↓ move · space toggle · enter continue)</Text>
        </Text>
        {AI_TOOLS.map((t, i) => {
          const on = selected.has(t.id);
          return (
            <Text key={t.id} {...(i === cursor ? { color: 'green' } : {})}>
              {i === cursor ? '❯ ' : '  '}
              {on ? <Text color="green">◉</Text> : <Text dimColor>◯</Text>} {t.label}{' '}
              <Text dimColor>→ {t.file}</Text>
            </Text>
          );
        })}
      </Box>
    );
  }

  if (step === 'theme') {
    return (
      <Box flexDirection="column">
        <Text bold>Pick a theme:</Text>
        <SelectInput items={[...THEME_ITEMS]} onSelect={(item) => void finish(item.value)} />
      </Box>
    );
  }

  return <Text dimColor>Scaffolding…</Text>;
}
