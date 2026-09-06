/**
 * The context menu: a fixed-position popover anchored at the pointer (or at
 * the focused part for ⇧F10 / the Menu key), rendering a {@link MenuItem}
 * tree with hover/ArrowRight submenus, arrow-key navigation, ⏎ to pick, Esc
 * to close (a submenu first), and first-letter type-ahead. Outside pointer
 * down, scroll, blur, or resize close it. The CONTENT comes from `menu.ts`;
 * this component only draws and routes.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { MenuItem } from './menu.js';

const EDGE = 8;

/** Where the menu opens (viewport coordinates). */
export interface MenuAnchor {
  readonly x: number;
  readonly y: number;
}

function enabled(items: readonly MenuItem[]): number[] {
  const out: number[] = [];
  items.forEach((it, i) => {
    if (it.separator !== true && it.disabled !== true) out.push(i);
  });
  return out;
}

function Panel({ items, at, depth, onPick, onClose, autoFocus }: {
  items: readonly MenuItem[];
  at: MenuAnchor;
  depth: number;
  onPick: (item: MenuItem) => void;
  /** Closes THIS panel (a submenu pops back to its parent). */
  onClose: () => void;
  autoFocus: boolean;
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<MenuAnchor | null>(null);
  const [active, setActive] = useState<number>(-1);
  const [open, setOpen] = useState<{ index: number; at: MenuAnchor } | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clamp into the viewport; submenus flip left when there is no room right.
  useLayoutEffect(() => {
    const el = ref.current;
    if (el === null) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let left = at.x;
    let top = at.y;
    if (left + w > window.innerWidth - EDGE) left = depth > 0 ? Math.max(EDGE, at.x - w - 4 - 180) : Math.max(EDGE, window.innerWidth - w - EDGE);
    if (top + h > window.innerHeight - EDGE) top = Math.max(EDGE, window.innerHeight - h - EDGE);
    setPos({ x: left, y: top });
  }, [at.x, at.y, depth]);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  useEffect(
    () => () => {
      if (hoverTimer.current !== null) clearTimeout(hoverTimer.current);
    },
    [],
  );

  const openSub = (index: number): void => {
    const it = items[index];
    const row = ref.current?.querySelector<HTMLElement>(`[data-mi="${index}"]`);
    if (it === undefined || it.children === undefined || row === undefined || row === null) return;
    const r = row.getBoundingClientRect();
    setOpen({ index, at: { x: r.right + 2, y: r.top - 5 } });
  };

  const activate = (index: number, viaKeyboard: boolean): void => {
    setActive(index);
    const it = items[index];
    if (hoverTimer.current !== null) clearTimeout(hoverTimer.current);
    if (it !== undefined && it.children !== undefined && it.disabled !== true) {
      if (viaKeyboard) return; // ArrowRight/⏎ open explicitly
      hoverTimer.current = setTimeout(() => openSub(index), 90);
    } else {
      hoverTimer.current = setTimeout(() => setOpen(null), 120);
    }
  };

  const pick = (index: number): void => {
    const it = items[index];
    if (it === undefined || it.disabled === true || it.separator === true) return;
    if (it.children !== undefined) {
      openSub(index);
      return;
    }
    onPick(it);
  };

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (open !== null) return; // the submenu owns the keys while open
    const ids = enabled(items);
    if (ids.length === 0) return;
    const cur = ids.indexOf(active);
    const move = (d: number): void => {
      const n = ids.length;
      const next = cur < 0 ? (d > 0 ? 0 : n - 1) : (cur + d + n) % n;
      setActive(ids[next] as number);
    };
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        e.stopPropagation();
        move(1);
        return;
      case 'ArrowUp':
        e.preventDefault();
        e.stopPropagation();
        move(-1);
        return;
      case 'Home':
        e.preventDefault();
        setActive(ids[0] as number);
        return;
      case 'End':
        e.preventDefault();
        setActive(ids[ids.length - 1] as number);
        return;
      case 'ArrowRight':
        e.preventDefault();
        e.stopPropagation();
        if (active >= 0 && items[active]?.children !== undefined) openSub(active);
        return;
      case 'ArrowLeft':
        e.preventDefault();
        e.stopPropagation();
        if (depth > 0) onClose();
        return;
      case 'Enter':
      case ' ':
        e.preventDefault();
        e.stopPropagation();
        if (active >= 0) pick(active);
        return;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      default:
        break;
    }
    // First-letter type-ahead: the next enabled item starting with the key.
    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const ch = e.key.toLowerCase();
      const order = cur < 0 ? ids : [...ids.slice(cur + 1), ...ids.slice(0, cur + 1)];
      const hit = order.find((i) => (items[i]?.label ?? '').toLowerCase().startsWith(ch));
      if (hit !== undefined) {
        e.preventDefault();
        setActive(hit);
      }
    }
  };

  // A submenu that closed hands the keyboard back to this panel.
  useEffect(() => {
    if (open === null && autoFocus) ref.current?.focus();
  }, [open, autoFocus]);

  return (
    <>
      <div
        ref={ref}
        className="stu-menu"
        role="menu"
        tabIndex={-1}
        data-depth={depth}
        style={{ left: pos?.x ?? at.x, top: pos?.y ?? at.y, visibility: pos === null ? 'hidden' : 'visible' }}
        onKeyDown={onKeyDown}
        onPointerDown={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        {items.map((it, i) =>
          it.separator === true ? (
            <div key={`s${i}`} className="stu-menu-sep" role="separator" />
          ) : (
            <button
              key={`${it.label}${i}`}
              type="button"
              role={it.checked !== undefined ? 'menuitemcheckbox' : 'menuitem'}
              aria-checked={it.checked}
              aria-haspopup={it.children !== undefined ? 'menu' : undefined}
              aria-expanded={it.children !== undefined ? open?.index === i : undefined}
              aria-disabled={it.disabled === true}
              data-mi={i}
              tabIndex={-1}
              className={[
                'stu-menu-item',
                it.danger === true ? 'stu-menu-item-danger' : '',
                it.disabled === true ? 'stu-menu-item-disabled' : '',
                active === i ? 'stu-menu-item-active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onPointerEnter={() => activate(i, false)}
              onClick={(e) => {
                e.stopPropagation();
                pick(i);
              }}
            >
              <span className="stu-menu-check" aria-hidden="true">
                {it.checked === true ? '✓' : ''}
              </span>
              <span className="stu-menu-label">{it.label}</span>
              {it.shortcut !== undefined && it.children === undefined && (
                <span className="stu-menu-key">{it.shortcut}</span>
              )}
              {it.children !== undefined && (
                <span className="stu-menu-chev" aria-hidden="true">
                  ▸
                </span>
              )}
            </button>
          ),
        )}
      </div>
      {open !== null && items[open.index]?.children !== undefined && (
        <Panel
          items={items[open.index]?.children ?? []}
          at={open.at}
          depth={depth + 1}
          onPick={onPick}
          onClose={() => setOpen(null)}
          autoFocus
        />
      )}
    </>
  );
}

export function ContextMenu({ items, at, onPick, onClose }: {
  items: readonly MenuItem[];
  at: MenuAnchor;
  /** A leaf was chosen — the caller commits it and closes the menu. */
  onPick: (item: MenuItem) => void;
  onClose: () => void;
}): JSX.Element | null {
  // Outside pointer down, scroll, blur, or resize close the whole menu. The
  // listeners are capture-phase so a click on a diagram part never reaches
  // the layer's own select/edit handlers while the menu is up.
  useEffect(() => {
    const onDown = (e: PointerEvent): void => {
      if (e.target instanceof Element && e.target.closest('.stu-menu') !== null) return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
    };
    const onScroll = (): void => onClose();
    const onKey = (e: KeyboardEvent): void => {
      // Esc anywhere (the panels handle their own Esc when focused).
      if (e.key === 'Escape' && !(e.target instanceof Element && e.target.closest('.stu-menu') !== null)) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    window.addEventListener('blur', onScroll);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('blur', onScroll);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [onClose]);

  if (items.length === 0) return null;
  return <Panel items={items} at={at} depth={0} onPick={onPick} onClose={onClose} autoFocus />;
}
