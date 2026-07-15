/**
 * Site mode: the built docs site (mounted by the studio server under
 * `/site/…`) in a full-height iframe. The pages carry their own live-reload
 * script pointing at `/__events`, so EXTERNAL changes reload the frame by
 * themselves; the studio's own saves are filtered from that stream, so the
 * frame is additionally keyed on `baseHash` — a ⌘S remounts it and the new
 * saved state shows. Site pages render from disk: a dirty doc gets a slim
 * notice instead of a stale-looking preview.
 */

import { useStudio } from '../state/store.js';

export function SiteView(): JSX.Element {
  const currentSlug = useStudio((s) => s.currentSlug);
  const dirty = useStudio((s) => s.dirty);
  const baseHash = useStudio((s) => s.baseHash);
  // Fall back to the site index when no doc is open.
  const src = currentSlug !== null ? `/site/${currentSlug}.html` : '/site/';
  return (
    <div className="stu-modearea">
      {dirty && (
        <div className="stu-modenotice" role="note">
          Site shows the last saved state — <kbd>⌘S</kbd> to update
        </div>
      )}
      <iframe
        // Remount on doc switch AND on save (baseHash moves): the SSE stream
        // deliberately skips the studio's own writes, so the key is what
        // brings a just-saved doc into view.
        key={`${currentSlug ?? ''}·${baseHash ?? ''}`}
        className="stu-modeframe"
        src={src}
        title="Docs site preview"
      />
    </div>
  );
}
