/**
 * The tour overlay: anchored coach-marks over the REAL, fully interactive UI.
 *
 * - A spotlight ring + page-dimming cutout (one fixed div whose 9999px
 *   box-shadow shades everything around the target; `pointer-events: none`,
 *   so the app underneath stays clickable/typeable);
 * - a card beside the target with title / body / key hints / step dots /
 *   Back / Next / Skip — viewport-aware placement (below → above → beside →
 *   centered);
 * - ACTION steps advance on the real user action (via `bus.ts`); Next always
 *   works as a fallback — the tour never traps;
 * - Esc is gentle: running → the resume-or-skip card; there → skip for real;
 * - wandering off (closing the sheet mid-step, switching docs, deleting the
 *   playground block) parks the tour in the same resume-or-skip card;
 * - finishing offers to leave a farewell note in the playground doc (the
 *   file bridge has no DELETE endpoint — files are the source of truth, so
 *   the tour never destroys them).
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { isEditableTarget } from '../lib/dom.js';
import { useStudio } from '../state/store.js';
import { resumeStepFor, TOUR_DOC_SLUG, TOUR_STEPS } from './script.js';
import { useTour } from './state.js';

interface Rect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

const CARD_W = 316;
const MARGIN = 12;
const POLL_MS = 250;
/** Polls a missing target survives before the step is considered broken. */
const MISS_LIMIT = 4;

function sameRect(a: Rect | null, b: Rect | null): boolean {
  if (a === null || b === null) return a === b;
  return a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height;
}

/** Card position beside a target rect: below → above → beside → centered. */
function placeCard(target: Rect, cardH: number): { left: number; top: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // A huge target (the whole canvas) leaves no "beside" — park the card in
  // the bottom-right corner, clear of the centered slash menu / document.
  if (target.width * target.height > 0.55 * vw * vh) {
    return { left: vw - CARD_W - MARGIN * 2, top: vh - cardH - 56 };
  }
  const left = Math.max(MARGIN, Math.min(target.left, vw - CARD_W - MARGIN));
  const below = target.top + target.height + MARGIN;
  if (below + cardH <= vh - MARGIN) return { left, top: below };
  if (target.top - cardH - MARGIN >= MARGIN) return { left, top: target.top - cardH - MARGIN };
  const beside = target.left + target.width + MARGIN;
  const top = Math.max(MARGIN, Math.min(target.top, vh - cardH - MARGIN));
  if (beside + CARD_W <= vw - MARGIN) return { left: beside, top };
  if (target.left - CARD_W - MARGIN >= MARGIN) return { left: target.left - CARD_W - MARGIN, top };
  return { left: (vw - CARD_W) / 2, top: Math.max(MARGIN, (vh - cardH) / 2) };
}

function StepDots({ current }: { current: number }): JSX.Element {
  return (
    <div className="stu-tour-dots" aria-label={`Step ${current + 1} of ${TOUR_STEPS.length}`}>
      {TOUR_STEPS.map((s, i) => (
        <span
          key={s.id}
          className={`stu-tour-dot ${i === current ? 'stu-tour-dot-active' : ''} ${i < current ? 'stu-tour-dot-done' : ''}`}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

/** The centered card used by the interrupted and finished states. */
function CenterCard({ title, children }: {
  title: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <>
      <div className="stu-tour-dim" aria-hidden="true" />
      <div className="stu-tour-card stu-tour-card-center" role="dialog" aria-label={title}>
        <h3 className="stu-tour-title">{title}</h3>
        {children}
      </div>
    </>
  );
}

export function TourOverlay(): JSX.Element | null {
  const state = useTour((t) => t.state);
  const dispatch = useTour((t) => t.dispatch);
  const skip = useTour((t) => t.skip);
  const addFarewell = useTour((t) => t.addFarewell);
  const currentSlug = useStudio((s) => s.currentSlug);
  const sheetOpen = useStudio((s) => s.sheet !== null);

  const running = state.status === 'running';
  const step = TOUR_STEPS[state.step] ?? null;

  const [rect, setRect] = useState<Rect | null>(null);
  const [cardPos, setCardPos] = useState<{ left: number; top: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const missCount = useRef(0);

  /* ---- track the target element (it moves, scrolls, re-renders) ---- */
  useEffect(() => {
    if (!running || step === null) {
      setRect(null);
      return;
    }
    missCount.current = 0;
    const measure = (): void => {
      const el = document.querySelector(step.target);
      if (el === null) {
        missCount.current += 1;
        if (missCount.current >= MISS_LIMIT) dispatch({ type: 'break' });
        else setRect(null);
        return;
      }
      missCount.current = 0;
      const r = el.getBoundingClientRect();
      const next = { left: r.left, top: r.top, width: r.width, height: r.height };
      setRect((prev) => (sameRect(prev, next) ? prev : next));
    };
    measure();
    const timer = window.setInterval(measure, POLL_MS);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [running, state.step, step, dispatch]);

  /* ---- place the card once its height is known ---- */
  useLayoutEffect(() => {
    if (rect === null) {
      setCardPos(null);
      return;
    }
    const h = cardRef.current?.offsetHeight ?? 220;
    setCardPos(placeCard(rect, h));
  }, [rect, state.step]);

  /* ---- break detection: the step's premise vanished ---- */
  useEffect(() => {
    if (!running || step === null) return;
    if (currentSlug !== null && currentSlug !== TOUR_DOC_SLUG) {
      dispatch({ type: 'break' });
      return;
    }
    if (step.needsSheet === true && !sheetOpen) dispatch({ type: 'break' });
  }, [running, step, currentSlug, sheetOpen, dispatch]);

  /* ---- Esc: gentle two-stage skip; ⏎/→/← navigate on Next-only steps ---- */
  useEffect(() => {
    if (state.status === 'idle') return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        // Modals above us (sheet, micro-editor, comboboxes) stop propagation
        // in their capture handlers — reaching here means the tour owns Esc.
        if (state.status === 'running') dispatch({ type: 'break' });
        else if (state.status === 'interrupted') skip();
        else dispatch({ type: 'close' });
        return;
      }
      if (state.status === 'running' && !isEditableTarget(e.target)) {
        if (e.key === 'ArrowRight' && step?.advance === null) {
          e.preventDefault();
          dispatch({ type: 'next' });
        } else if (e.key === 'ArrowLeft' && state.step > 0 && step?.advance === null) {
          e.preventDefault();
          dispatch({ type: 'back' });
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, step, dispatch, skip]);

  /* ---- Next-only steps: land focus on Next so ⏎ advances ---- */
  useEffect(() => {
    if (!running || step === null || step.advance !== null) return;
    const t = setTimeout(() => {
      cardRef.current?.querySelector<HTMLElement>('.stu-tour-next')?.focus();
    }, 80);
    return () => clearTimeout(t);
  }, [running, state.step, step]);

  if (state.status === 'idle') return null;

  /* ---- interrupted: resume or skip ---- */
  if (state.status === 'interrupted') {
    const resume = (): void => {
      const studio = useStudio.getState();
      const go = (): void => {
        const doc = useStudio.getState();
        const hasBlock =
          document.querySelector('[data-seg="1"]') !== null && doc.currentSlug === TOUR_DOC_SLUG;
        dispatch({
          type: 'resume',
          step: resumeStepFor({
            current: state.step,
            sheetOpen: useStudio.getState().sheet !== null,
            hasBlock,
          }),
        });
      };
      if (studio.currentSlug !== TOUR_DOC_SLUG) {
        void studio.openDoc(TOUR_DOC_SLUG).then(() => setTimeout(go, 120));
      } else {
        go();
      }
    };
    return (
      <CenterCard title="Paused — you wandered off the path">
        <p className="stu-tour-body">
          No harm done: everything you just did was real. Pick the tour back up where it makes
          sense, or skip it — you can restart it anytime from the <kbd>?</kbd> shortcuts card.
        </p>
        <div className="stu-tour-actions">
          <button type="button" className="stu-btn" onClick={skip}>
            Skip tour
          </button>
          <button type="button" className="stu-btn stu-btn-primary stu-tour-next" autoFocus onClick={resume}>
            Resume tour
          </button>
        </div>
      </CenterCard>
    );
  }

  /* ---- finished ---- */
  if (state.status === 'finished') {
    return (
      <CenterCard title="That's the studio — 2 minutes, no YAML">
        <p className="stu-tour-body">
          Your playground doc is a real file (<code>docs/{TOUR_DOC_SLUG}.md</code>) and it stays
          on disk — the studio never deletes files, because the files are the source of truth.
          Leave a note in it, or just get back to your own docs.
        </p>
        <div className="stu-tour-actions">
          <button
            type="button"
            className="stu-btn"
            onClick={() => {
              addFarewell();
              dispatch({ type: 'close' });
            }}
          >
            Leave a farewell note
          </button>
          <button
            type="button"
            className="stu-btn stu-btn-primary stu-tour-next"
            autoFocus
            onClick={() => dispatch({ type: 'close' })}
          >
            Done
          </button>
        </div>
      </CenterCard>
    );
  }

  /* ---- running ---- */
  if (step === null) return null;
  const last = state.step === TOUR_STEPS.length - 1;
  return (
    <>
      {rect !== null && (
        <div
          className="stu-tour-spot"
          aria-hidden="true"
          style={{
            left: rect.left - 6,
            top: rect.top - 6,
            width: rect.width + 12,
            height: rect.height + 12,
          }}
        />
      )}
      <div
        ref={cardRef}
        className="stu-tour-card"
        role="dialog"
        aria-label={`Tour step ${state.step + 1}: ${step.title}`}
        style={{
          left: cardPos?.left ?? (window.innerWidth - CARD_W) / 2,
          top: cardPos?.top ?? window.innerHeight - 280,
          visibility: rect === null || cardPos === null ? 'hidden' : 'visible',
        }}
      >
        <StepDots current={state.step} />
        <h3 className="stu-tour-title">{step.title}</h3>
        <p className="stu-tour-body">{step.body}</p>
        {step.keys !== undefined && (
          <div className="stu-tour-keys">
            {step.keys.map((k) => (
              <kbd key={k}>{k}</kbd>
            ))}
          </div>
        )}
        {step.advance !== null && (
          <div className="stu-tour-wait">
            <span className="stu-tour-pulse" aria-hidden="true" />
            try it for real — it advances by itself
          </div>
        )}
        <div className="stu-tour-actions">
          <button type="button" className="stu-linkbtn stu-tour-skip" onClick={skip}>
            Skip tour
          </button>
          <span className="stu-tour-spacer" />
          <button
            type="button"
            className="stu-btn"
            disabled={state.step === 0}
            onClick={() => dispatch({ type: 'back' })}
          >
            Back
          </button>
          <button
            type="button"
            className={`stu-btn stu-tour-next ${step.advance === null ? 'stu-btn-primary' : ''}`}
            onClick={() => dispatch({ type: 'next' })}
          >
            {last ? 'Finish' : step.advance === null ? 'Next' : 'Skip step'}
          </button>
        </div>
      </div>
    </>
  );
}
