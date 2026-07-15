/**
 * The slash command: a compact, keyboard-first fuzzy list over the same
 * insert engine as the '+' menu (no thumbnails). ↑↓ + Enter inserts after the
 * selected block (or at the end of the doc), Esc closes.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { filterInsertItems, type InsertItem } from '../lib/insertEngine.js';
import { IconImport, IconLibrary, IconSlash } from './Icons.js';

const MAX_VISIBLE = 9;

export function SlashMenu({ onPick, onImport, onLibrary, onClose }: {
  onPick: (item: InsertItem) => void;
  /** The "Import from file…" footer entry (CSV / OpenAPI file picker). */
  onImport: () => void;
  /** The "Browse all blocks" footer entry (opens the Block Library). */
  onLibrary: () => void;
  onClose: () => void;
}): JSX.Element {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const items = useMemo(() => filterInsertItems(query).slice(0, MAX_VISIBLE), [query]);

  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    const el = listRef.current?.children[active];
    if (el instanceof HTMLElement) el.scrollIntoView({ block: 'nearest' });
  }, [active]);

  useEffect(() => {
    const onDown = (e: MouseEvent): void => {
      if (rootRef.current !== null && !rootRef.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [onClose]);

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const item = items[active];
      if (item !== undefined) onPick(item);
    }
  };

  return (
    <div className="stu-slash" ref={rootRef} role="dialog" aria-label="Insert a block">
      <div className="stu-slash-input">
        <span className="stu-slash-glyph">
          <IconSlash size={13} />
        </span>
        <input
          ref={inputRef}
          type="text"
          placeholder="Type a block name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <kbd>esc</kbd>
      </div>
      <ul className="stu-slash-list" ref={listRef} role="listbox">
        {items.map((item, i) => (
          <li key={item.alias ?? item.type}>
            <button
              type="button"
              role="option"
              aria-selected={i === active}
              className={`stu-slash-item ${i === active ? 'stu-slash-item-active' : ''}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => onPick(item)}
            >
              <span className="stu-slash-name">{item.label}</span>
              <span className="stu-slash-type">{item.type}</span>
              <span className="stu-slash-fam">{item.familyLabel}</span>
            </button>
          </li>
        ))}
        {items.length === 0 && <li className="stu-slash-none">No matching blocks</li>}
      </ul>
      <div className="stu-slash-foot">
        <button type="button" className="stu-slash-import" onClick={onImport}>
          <IconImport size={13} />
          Import from file…
          <span className="stu-slash-import-hint">.csv · OpenAPI .yaml/.json</span>
        </button>
        <button type="button" className="stu-slash-import" onClick={onLibrary}>
          <IconLibrary size={13} />
          Browse all blocks
          <span className="stu-slash-import-hint">gallery with previews →</span>
        </button>
      </div>
    </div>
  );
}
