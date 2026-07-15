/**
 * The "+ New doc" template picker: a modal with a slug field and a card per
 * starting point — Blank plus the doc templates from core (DOC_TEMPLATES /
 * DOC_TEMPLATE_INFO, the same data behind `avo new`). Picking a template
 * creates the doc through the store's normal PUT path and lands the author
 * in the first content block's Edit Sheet.
 *
 * Keyboard: Tab reaches every card (buttons), Enter/Space selects one,
 * Enter in the slug field creates, Esc closes.
 */

import { useEffect, useRef, useState } from 'react';
import { DOC_TEMPLATES } from '@avodado/core';
import { TEMPLATE_CARDS } from '../lib/docTemplates.js';
import { useStudio } from '../state/store.js';
import { IconDoc } from './Icons.js';

/** How many block-type chips a card shows before collapsing to "+n". */
const MAX_CHIPS = 4;

export function TemplatePicker({ onClose }: { onClose: () => void }): JSX.Element {
  const newDoc = useStudio((s) => s.newDoc);
  const [selected, setSelected] = useState<string>('blank');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const slugRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => slugRef.current?.focus());
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const pickCard = (id: string): void => {
    setSelected(id);
    // An untouched slug field tracks the pick (adr → docs/adr.md); a slug the
    // user typed is theirs.
    if (!slugTouched) setSlug(id === 'blank' ? '' : id);
  };

  const create = (): void => {
    const clean = slug.trim().replace(/\.md$/, '');
    if (clean === '') {
      slugRef.current?.focus();
      return;
    }
    const source = selected === 'blank' ? undefined : DOC_TEMPLATES[selected];
    void newDoc(clean, source);
    onClose();
  };

  return (
    <div
      className="stu-sheet-backdrop"
      onMouseDown={(e) => {
        if (rootRef.current !== null && !rootRef.current.contains(e.target as Node)) onClose();
      }}
    >
      <div
        className="stu-tpl"
        ref={rootRef}
        role="dialog"
        aria-modal="true"
        aria-label="Create a new doc"
      >
        <div className="stu-tpl-head">
          <h2>New doc</h2>
          <input
            ref={slugRef}
            className="stu-tpl-slug"
            type="text"
            placeholder="slug, e.g. guides/onboarding"
            aria-label="Doc slug"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugTouched(e.target.value.trim() !== '');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                create();
              }
            }}
          />
        </div>
        <div className="stu-tpl-body" role="radiogroup" aria-label="Starting point">
          <button
            type="button"
            role="radio"
            aria-checked={selected === 'blank'}
            className={`stu-tpl-card ${selected === 'blank' ? 'stu-tpl-card-active' : ''}`}
            onClick={() => pickCard('blank')}
            onDoubleClick={create}
          >
            <span className="stu-tpl-card-title">
              <IconDoc size={13} />
              Blank
            </span>
            <span className="stu-tpl-card-desc">
              Just the cover — start from nothing and insert blocks with “/”.
            </span>
          </button>
          {TEMPLATE_CARDS.map((card) => (
            <button
              key={card.id}
              type="button"
              role="radio"
              aria-checked={selected === card.id}
              className={`stu-tpl-card ${selected === card.id ? 'stu-tpl-card-active' : ''}`}
              onClick={() => pickCard(card.id)}
              onDoubleClick={create}
            >
              <span className="stu-tpl-card-title">
                <IconDoc size={13} />
                {card.title}
              </span>
              <span className="stu-tpl-card-desc">{card.description}</span>
              <span className="stu-tpl-card-chips" aria-hidden="true">
                {card.blockTypes.slice(0, MAX_CHIPS).map((t) => (
                  <code key={t}>{t}</code>
                ))}
                {card.blockTypes.length > MAX_CHIPS && (
                  <code>+{card.blockTypes.length - MAX_CHIPS}</code>
                )}
              </span>
            </button>
          ))}
        </div>
        <div className="stu-tpl-foot">
          <span className="stu-tpl-hint">
            Enter creates · Esc closes
          </span>
          <button type="button" className="stu-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="stu-btn stu-btn-primary" onClick={create}>
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
