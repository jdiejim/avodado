/**
 * One document on the home grid: a thumbnail of its first structural block,
 * the title, folder, edited-ago, and check status. The source is fetched only
 * when the card scrolls into view, then rendered through the real pipeline
 * (lib/thumbs docThumbnailHtml, memoised per slug + mtime).
 */

import { useEffect, useRef, useState } from 'react';
import type { DocListItem } from '../api/backend.js';
import { fetchDoc } from '../api/client.js';
import type { DocCheckStatus } from '../lib/checkView.js';
import { docThumbnailHtml } from '../lib/thumbs.js';
import { IconDoc } from './Icons.js';

/** Native docskin content is laid out at this width, then scaled into the card. */
const NATIVE_W = 820;
const SCALE = 0.3;

function StatusChip({ status }: { status: DocCheckStatus }): JSX.Element | null {
  if (status.kind === 'unknown') return null;
  if (status.kind === 'errors') {
    return (
      <span className="stu-doclist-status stu-doclist-status-err">
        {status.count} error{status.count === 1 ? '' : 's'}
      </span>
    );
  }
  return <span className="stu-doclist-status stu-doclist-status-ok">✓ pass</span>;
}

export function DocCard({
  doc,
  folder,
  edited,
  status,
  onOpen,
}: {
  doc: DocListItem;
  folder: string;
  edited: string;
  status: DocCheckStatus;
  onOpen: () => void;
}): JSX.Element {
  const [html, setHtml] = useState<string | null>(null);
  const ref = useRef<HTMLButtonElement>(null);
  const key = `${doc.slug}@${String(doc.mtimeMs)}`;

  useEffect(() => {
    const el = ref.current;
    if (el === null) return;
    let cancelled = false;
    const load = (): void => {
      void fetchDoc(doc.slug)
        .then((payload) => {
          if (!cancelled) setHtml(docThumbnailHtml(key, payload.source, doc.slug));
        })
        .catch(() => {
          if (!cancelled) setHtml('');
        });
    };
    if (typeof IntersectionObserver === 'undefined') {
      load();
      return () => {
        cancelled = true;
      };
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          load();
          io.disconnect();
        }
      },
      { rootMargin: '160px' },
    );
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
    };
  }, [doc.slug, key]);

  return (
    <button ref={ref} type="button" className="stu-doccard" title={doc.slug} onClick={onOpen}>
      <div className="stu-doccard-thumb" aria-hidden="true">
        {html !== null && html !== '' ? (
          <div
            className="docskin stu-thumb-doc"
            style={{ width: NATIVE_W, transform: `scale(${String(SCALE)})` }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <div className="stu-doccard-blank">
            <IconDoc size={22} />
          </div>
        )}
      </div>
      <div className="stu-doccard-body">
        <span className="stu-doccard-title">{doc.title}</span>
        <span className="stu-doccard-meta">
          <span className="stu-doccard-folder">{folder}</span>
          <span className="stu-doccard-edited stu-num">{edited}</span>
          <StatusChip status={status} />
        </span>
      </div>
    </button>
  );
}
