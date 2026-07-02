/**
 * Interactive family picker for bare `avo demo` in a TTY (Ink) — mirrors the
 * `avo theme` picker. "Everything" (the full showcase) comes first, then the
 * 12 block families; `q`/escape cancels without rendering.
 */

import React from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import { BLOCK_TYPES } from '@avodado/core';
import { DEMO_FAMILIES, familyBlocks, type DemoFamily } from './catalog.js';

const EVERYTHING = '__all__';

/** What the picker resolved to: a family, or `undefined` for the full showcase. */
export interface DemoPick {
  readonly family?: DemoFamily;
}

interface DemoAppProps {
  /** Called once on selection; not called when the user cancels. */
  readonly onPick: (pick: DemoPick) => void;
}

export function DemoApp({ onPick }: DemoAppProps): React.JSX.Element {
  const { exit } = useApp();

  useInput((input, key) => {
    if (input === 'q' || key.escape) exit();
  });

  const items = [
    { label: `Everything — the full showcase, all ${BLOCK_TYPES.length} blocks`, value: EVERYTHING },
    ...DEMO_FAMILIES.map((f) => ({
      label: `${f.label} — ${familyBlocks(f.id).length} blocks`,
      value: f.id as string,
    })),
  ];

  function pick(value: string): void {
    onPick(value === EVERYTHING ? {} : { family: value as DemoFamily });
    exit();
  }

  return (
    <Box flexDirection="column">
      <Text bold>
        What do you want to see? <Text dimColor>(↑↓ move · enter to render · q to quit)</Text>
      </Text>
      <SelectInput items={items} onSelect={(item) => pick(item.value)} />
    </Box>
  );
}
