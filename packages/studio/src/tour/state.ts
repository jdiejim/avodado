/**
 * Tour store: the pure reducer from `script.ts` wired to zustand, plus the
 * side-effectful verbs — `start` creates/opens the scratch playground doc,
 * `skip`/`finish` record the localStorage flag, `addFarewell` leaves the
 * goodbye callout in the doc (the studio server has no doc-DELETE endpoint,
 * so the tour never destroys files — files are the source of truth).
 */

import { create } from 'zustand';
import { insertBlock } from '@avodado/core';
import { useStudio } from '../state/store.js';
import { onTourAction } from './bus.js';
import {
  tourReducer,
  TOUR_DOC_SLUG,
  TOUR_DOC_SOURCE,
  TOUR_IDLE,
  type TourEvent,
  type TourState,
} from './script.js';

const TOUR_KEY = 'avodado-studio-tour';

/** True once the user has finished OR dismissed the tour (hint-bar copy). */
export function tourSeen(): boolean {
  try {
    return window.localStorage.getItem(TOUR_KEY) !== null;
  } catch {
    return true;
  }
}

function markTour(value: 'done' | 'dismissed'): void {
  try {
    window.localStorage.setItem(TOUR_KEY, value);
  } catch {
    /* private mode — the tour simply stays offerable */
  }
}

interface TourStore {
  readonly state: TourState;
  dispatch: (event: TourEvent) => void;
  /** Opens (or creates) the playground doc, then starts the tour at step 0. */
  start: () => Promise<void>;
  /** Skips out of the tour (records the dismissal). */
  skip: () => void;
  /** Appends the farewell callout to the playground doc. */
  addFarewell: () => void;
}

const FAREWELL_BODY =
  'tone: success\n' +
  'title: Tour complete 🎉\n' +
  'body: >-\n' +
  '  This scratch doc is a real file — docs/tutorial-playground.md — and it is\n' +
  '  yours. The studio deliberately has no delete button (files are the source\n' +
  '  of truth), so remove the file from disk whenever you are done with it.\n';

let unsubscribeBus: (() => void) | null = null;

export const useTour = create<TourStore>()((set, get) => {
  const dispatch = (event: TourEvent): void => {
    const before = get().state;
    const after = tourReducer(before, event);
    if (after === before) return;
    set({ state: after });
    // Listen for real actions only while the tour is alive.
    const active = after.status === 'running' || after.status === 'interrupted';
    if (active && unsubscribeBus === null) {
      unsubscribeBus = onTourAction((action) => get().dispatch({ type: 'action', action }));
    } else if (!active && unsubscribeBus !== null) {
      unsubscribeBus();
      unsubscribeBus = null;
    }
    if (after.status === 'finished') markTour('done');
    if (event.type === 'skip') markTour('dismissed');
  };

  return {
    state: TOUR_IDLE,
    dispatch,

    start: async () => {
      const studio = useStudio.getState();
      // The tour teaches the editing canvas — leave Site/Present first.
      studio.setMode('edit');
      if (studio.currentSlug !== TOUR_DOC_SLUG) {
        const exists = studio.docs.some((d) => d.slug === TOUR_DOC_SLUG);
        if (exists) await studio.openDoc(TOUR_DOC_SLUG);
        else await studio.newDoc(TOUR_DOC_SLUG, TOUR_DOC_SOURCE);
      }
      // newDoc lands in the cover sheet — the tour starts on the canvas.
      useStudio.getState().closeSheet();
      dispatch({ type: 'start' });
    },

    skip: () => dispatch({ type: 'skip' }),

    addFarewell: () => {
      const studio = useStudio.getState();
      if (studio.currentSlug !== TOUR_DOC_SLUG) return;
      studio.applyOp(
        (src, doc) => insertBlock(src, doc, doc.segments.length, 'callout', FAREWELL_BODY),
        null,
      );
    },
  };
});
