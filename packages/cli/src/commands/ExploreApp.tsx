/**
 * Interactive picker for bare `avo explore` in a TTY (Ink) — mirrors the
 * `avo demo` picker. Four entries (demo, catalog, design, tour) with one-line
 * blurbs; `q`/escape cancels without running anything.
 */

import React from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import SelectInput from 'ink-select-input';

/** What `avo explore` can front. */
export type ExplorePick = 'demo' | 'catalog' | 'design' | 'tour';

/** The four entries, in display order, with their picker blurbs. */
export const EXPLORE_ENTRIES: ReadonlyArray<{ readonly id: ExplorePick; readonly blurb: string }> = [
  { id: 'demo', blurb: 'Render the built-in showcase — every block, or one family' },
  { id: 'catalog', blurb: 'Every block type + what it is for (live HTML gallery with -p)' },
  { id: 'design', blurb: 'Ready design-pattern templates — system, AI / agents, GoF' },
  { id: 'tour', blurb: 'A guided, hands-on walkthrough in 7 short chapters' },
];

interface ExploreAppProps {
  /** Called once on selection; not called when the user cancels. */
  readonly onPick: (pick: ExplorePick) => void;
}

export function ExploreApp({ onPick }: ExploreAppProps): React.JSX.Element {
  const { exit } = useApp();

  useInput((input, key) => {
    if (input === 'q' || key.escape) exit();
  });

  const items = EXPLORE_ENTRIES.map((e) => ({
    label: `${e.id.padEnd(8)} — ${e.blurb}`,
    value: e.id as string,
  }));

  function pick(value: string): void {
    onPick(value as ExplorePick);
    exit();
  }

  return (
    <Box flexDirection="column">
      <Text bold>
        Explore Avodado <Text dimColor>(↑↓ move · enter to run · q to quit)</Text>
      </Text>
      <SelectInput items={items} onSelect={(item) => pick(item.value)} />
    </Box>
  );
}
