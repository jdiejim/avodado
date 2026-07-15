/**
 * Present mode: the CURRENT canvas state — unsaved edits included — rendered
 * client-side as a slide deck into a sandboxless `<iframe srcDoc>` (the deck's
 * own keyboard nav script must run). The deck is a SNAPSHOT: it is generated
 * once when the mode is entered (this component mounts) and not regenerated
 * while presenting — leave and re-enter to pick up newer edits.
 *
 * The iframe is autofocused so arrow keys drive the deck immediately; once
 * focus is inside the frame, Esc can't reach the studio, so an on-screen
 * "Back to editor" pill stays overlaid (studio-side Esc still works whenever
 * the frame isn't focused).
 */

import { useEffect, useMemo, useRef } from 'react';
import { presentDeckHtml } from '../lib/present.js';
import { useStudio } from '../state/store.js';

export function PresentView(): JSX.Element {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const setMode = useStudio((s) => s.setMode);

  // Snapshot semantics: read the store ONCE at mount — deliberately not
  // subscribed, so mid-presentation edits/saves never re-render the deck.
  const deck = useMemo(() => {
    const s = useStudio.getState();
    if (s.currentSlug === null) return { html: null, error: 'No document open.' };
    try {
      return {
        html: presentDeckHtml(s.source, s.currentSlug, s.theme, s.themeVars),
        error: null,
      };
    } catch (err) {
      return { html: null, error: err instanceof Error ? err.message : String(err) };
    }
  }, []);

  useEffect(() => {
    // Focus after the frame paints so arrow-key nav works immediately.
    const t = requestAnimationFrame(() => frameRef.current?.focus());
    return () => cancelAnimationFrame(t);
  }, []);

  return (
    <div className="stu-modearea">
      {deck.html !== null ? (
        <iframe
          ref={frameRef}
          className="stu-modeframe"
          srcDoc={deck.html}
          title="Presentation"
        />
      ) : (
        <div className="stu-present-empty">{deck.error}</div>
      )}
      <button
        type="button"
        className="stu-present-back"
        onClick={() => setMode('edit')}
        title="Back to the editor (Esc)"
      >
        <span aria-hidden="true">←</span> Back to editor
      </button>
    </div>
  );
}
