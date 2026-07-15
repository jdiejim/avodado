/**
 * A block card's mini-rendered thumbnail: the type's starter template through
 * the real pipeline (lib/thumbs memo), rendered lazily when the card scrolls
 * into view. Shared by the '+' Insert Menu and the Block Library gallery.
 */

import { useEffect, useRef, useState } from 'react';
import type { BlockType } from '@avodado/core';
import { thumbnailHtml } from '../lib/thumbs.js';
import { useStudio } from '../state/store.js';

/** Native docskin content is laid out at this width, then scaled into the card. */
export const THUMB_NATIVE_W = 760;
export const THUMB_SCALE = 0.235;

/** A block card thumbnail — renders lazily (when scrolled into view) via the global memo. */
export function Thumb({ type }: { type: BlockType }): JSX.Element {
  const theme = useStudio((s) => s.theme);
  const [html, setHtml] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el === null) return;
    if (typeof IntersectionObserver === 'undefined') {
      setHtml(thumbnailHtml(type, theme));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setHtml(thumbnailHtml(type, theme));
          io.disconnect();
        }
      },
      { rootMargin: '120px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [type, theme]);

  return (
    <div ref={ref} className="stu-thumb" aria-hidden="true">
      {html !== null && html !== '' ? (
        <div
          className="docskin stu-thumb-doc"
          style={{
            width: THUMB_NATIVE_W,
            transform: `scale(${THUMB_SCALE})`,
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <div className="stu-thumb-blank">{type}</div>
      )}
    </div>
  );
}
