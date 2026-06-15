/**
 * Diagnostics rendering for `avo check`.
 *
 * - {@link DiagnosticsTable} is the interactive (TTY) Ink view.
 * - {@link formatDiagnosticsPlain} is the CI / non-TTY text view.
 *
 * Both show a code frame (the offending line with a caret) plus the one-line
 * `hint` and help URL, so an error teaches the fix in place.
 */

import { Box, Text } from 'ink';
import { helpUrl, type Diagnostic } from '@avodado/core';
import React from 'react';
import { renderCodeFrame } from './codeFrame.js';

type Sources = ReadonlyMap<string, readonly string[]>;

interface Props {
  readonly diagnostics: readonly Diagnostic[];
  readonly fileCount: number;
  readonly sources: Sources;
}

const COLOR: Record<Diagnostic['level'], string> = {
  error: 'red',
  warn: 'yellow',
};

function frameFor(d: Diagnostic, sources: Sources): string {
  if (d.line === undefined) return '';
  const lines = sources.get(d.file);
  if (lines === undefined) return '';
  return renderCodeFrame({
    lines,
    line: d.line,
    ...(d.column !== undefined ? { column: d.column } : {}),
    ...(d.endColumn !== undefined ? { endColumn: d.endColumn } : {}),
    level: d.level,
  });
}

export function DiagnosticsTable({ diagnostics, fileCount, sources }: Props): React.ReactElement {
  const errorCount = diagnostics.filter((d) => d.level === 'error').length;
  const warnCount = diagnostics.filter((d) => d.level === 'warn').length;

  if (diagnostics.length === 0) {
    return (
      <Box flexDirection="column">
        <Text color="green">
          ✓ {fileCount} {fileCount === 1 ? 'file' : 'files'} checked — no diagnostics
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {diagnostics.map((d, i) => {
        const frame = frameFor(d, sources);
        return (
          <Box key={`${d.file}:${d.line ?? '-'}:${i}`} flexDirection="column" marginBottom={1}>
            <Box>
              <Text color={COLOR[d.level]} bold>
                {d.level === 'error' ? '✖' : '⚠'}{' '}
              </Text>
              <Text dimColor>
                {d.file}
                {d.line !== undefined ? `:${d.line}` : ''}
                {d.column !== undefined ? `:${d.column}` : ''}{' '}
              </Text>
              <Text color={COLOR[d.level]}>{d.code} </Text>
              <Text>{d.message}</Text>
            </Box>
            {frame.length > 0 ? <Text>{frame}</Text> : null}
            {d.hint !== undefined ? (
              <Text>
                {'  '}
                <Text color="cyan">hint:</Text> {d.hint}
              </Text>
            ) : null}
            <Text dimColor>
              {'  '}
              {helpUrl(d.code)}
            </Text>
          </Box>
        );
      })}
      <Box>
        <Text bold color={errorCount > 0 ? 'red' : warnCount > 0 ? 'yellow' : 'green'}>
          {errorCount} {errorCount === 1 ? 'error' : 'errors'}, {warnCount}{' '}
          {warnCount === 1 ? 'warning' : 'warnings'} across {fileCount}{' '}
          {fileCount === 1 ? 'file' : 'files'}
        </Text>
      </Box>
    </Box>
  );
}

/** Formats diagnostics for plain (non-TTY / CI) output. */
export function formatDiagnosticsPlain(
  diagnostics: readonly Diagnostic[],
  fileCount: number,
  sources: Sources,
): string {
  if (diagnostics.length === 0) {
    return `OK: ${fileCount} ${fileCount === 1 ? 'file' : 'files'} checked, no diagnostics\n`;
  }
  const blocks = diagnostics.map((d) => {
    const loc =
      d.line !== undefined
        ? `${d.file}:${d.line}${d.column !== undefined ? `:${d.column}` : ''}`
        : d.file;
    const parts = [`${loc}  ${d.level}  ${d.code}  ${d.message}`];
    const frame = frameFor(d, sources);
    if (frame.length > 0) parts.push(frame);
    if (d.hint !== undefined) parts.push(`  hint: ${d.hint}`);
    return parts.join('\n');
  });
  const errors = diagnostics.filter((d) => d.level === 'error').length;
  const warns = diagnostics.filter((d) => d.level === 'warn').length;
  blocks.push(`${errors} error(s), ${warns} warning(s) across ${fileCount} file(s)`);
  return blocks.join('\n\n') + '\n';
}
