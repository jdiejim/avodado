/**
 * The '+' popover: a searchable visual gallery of every insertable block —
 * a Popular row, then collapsible family sections. Each card carries a real
 * mini-rendered thumbnail (template → pipeline → scaled down), rendered
 * lazily and memoised globally in lib/thumbs.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { insertBlockAt } from '../lib/actions.js';
import { openImportFilePicker } from '../lib/importActions.js';
import {
  filterInsertItems,
  INSERT_ITEMS,
  insertBodyFor,
  itemsByFamily,
  popularItems,
  type InsertItem,
} from '../lib/insertEngine.js';
import { useStudio } from '../state/store.js';
import { IconChevronRight, IconImport, IconLibrary, IconSearch } from './Icons.js';
import { Thumb } from './Thumb.js';

/** Where the menu was summoned from: gap index + viewport point. */
export interface InsertAnchor {
  readonly index: number;
  readonly x: number;
  readonly y: number;
}

const MENU_W = 620;
const MENU_H = 460;

function BlockCard({ item, onPick }: {
  item: InsertItem;
  onPick: (item: InsertItem) => void;
}): JSX.Element {
  return (
    <button type="button" className="stu-card" onClick={() => onPick(item)}>
      <Thumb type={item.type} />
      <span className="stu-card-head">
        <span className="stu-card-name">{item.label}</span>
        <span className="stu-card-type">{item.type}</span>
      </span>
      <span className="stu-card-desc">{item.description}</span>
    </button>
  );
}

export function InsertMenu({ anchor, onClose }: {
  anchor: InsertAnchor;
  onClose: () => void;
}): JSX.Element {
  const [query, setQuery] = useState('');
  const [openFamilies, setOpenFamilies] = useState<ReadonlySet<string>>(new Set());
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => searchRef.current?.focus());
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent): void => {
      if (rootRef.current !== null && !rootRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [onClose]);

  const pick = (item: InsertItem): void => {
    onClose();
    insertBlockAt(anchor.index, item.type, insertBodyFor(item));
  };

  const results = useMemo(() => (query.trim() === '' ? null : filterInsertItems(query)), [query]);
  const families = useMemo(() => itemsByFamily(), []);
  const popular = useMemo(() => popularItems(), []);

  const toggleFamily = (id: string): void => {
    setOpenFamilies((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Clamp the popover into the viewport.
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = Math.min(Math.max(anchor.x - MENU_W / 2, 12), Math.max(12, vw - MENU_W - 12));
  const below = anchor.y + 10;
  const top = below + MENU_H > vh - 12 ? Math.max(12, anchor.y - MENU_H - 14) : below;

  return (
    <div className="stu-insert" ref={rootRef} style={{ left, top }} role="dialog" aria-label="Insert a block">
      <div className="stu-insert-search">
        <IconSearch size={14} />
        <input
          ref={searchRef}
          type="text"
          placeholder={`Search ${INSERT_ITEMS.length} block types…`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && results !== null && results[0] !== undefined) {
              e.preventDefault();
              pick(results[0]);
            }
          }}
        />
      </div>
      <div className="stu-insert-body">
        {results !== null ? (
          results.length > 0 ? (
            <div className="stu-cardgrid">
              {results.map((item) => (
                <BlockCard key={item.alias ?? item.type} item={item} onPick={pick} />
              ))}
            </div>
          ) : (
            <div className="stu-insert-none">Nothing matches “{query.trim()}”</div>
          )
        ) : (
          <>
            <div className="stu-insert-label">Popular</div>
            <div className="stu-cardgrid">
              {popular.map((item) => (
                <BlockCard key={item.type} item={item} onPick={pick} />
              ))}
            </div>
            {families.map((fam) => {
              const open = openFamilies.has(fam.family);
              return (
                <div key={fam.family} className="stu-insert-fam">
                  <button
                    type="button"
                    className="stu-insert-famhead"
                    onClick={() => toggleFamily(fam.family)}
                    aria-expanded={open}
                  >
                    <span className={`stu-insert-caret ${open ? 'stu-insert-caret-open' : ''}`}>
                      <IconChevronRight size={12} />
                    </span>
                    {fam.label}
                    <span className="stu-insert-count">{fam.items.length}</span>
                  </button>
                  {open && (
                    <div className="stu-cardgrid">
                      {fam.items.map((item) => (
                        <BlockCard key={item.type} item={item} onPick={pick} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
      <div className="stu-insert-foot">
        <button
          type="button"
          className="stu-insert-import"
          onClick={() => {
            onClose();
            openImportFilePicker(anchor.index);
          }}
        >
          <IconImport size={13} />
          Import from file…
          <span className="stu-insert-import-hint">.csv → block · OpenAPI .yaml/.json → new doc</span>
        </button>
        <button
          type="button"
          className="stu-insert-import"
          onClick={() => {
            onClose();
            useStudio.getState().openLibrary();
          }}
        >
          <IconLibrary size={13} />
          Browse all blocks
          <span className="stu-insert-import-hint">gallery with previews →</span>
        </button>
      </div>
    </div>
  );
}
