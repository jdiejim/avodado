/**
 * Server-sent events from `/__events`. Native `EventSource` auto-reconnects,
 * so the hook is a thin subscribe/parse layer; the handler is kept in a ref so
 * resubscribing never tears the socket down on re-render.
 */

import { useEffect, useRef } from 'react';

/** An event pushed by the studio server. */
export type ServerEvent =
  | { readonly type: 'fs'; readonly slug?: string; readonly hash?: string }
  | { readonly type: 'meta' };

/** Parses one SSE `data:` payload; returns `null` for anything malformed. */
export function parseServerEvent(data: string): ServerEvent | null {
  try {
    const raw = JSON.parse(data) as { type?: unknown; slug?: unknown; hash?: unknown };
    if (raw.type === 'meta') return { type: 'meta' };
    if (raw.type === 'fs') {
      return {
        type: 'fs',
        ...(typeof raw.slug === 'string' ? { slug: raw.slug } : {}),
        ...(typeof raw.hash === 'string' ? { hash: raw.hash } : {}),
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Subscribes to `/__events` for the lifetime of the component.
 *
 * @param onEvent - Called for every parsed server event.
 * @param onConnect - Called on every (re)connect of the stream — the moment
 *   to re-check server state that may have changed while disconnected (e.g.
 *   the studio version, for the stale-tab guard).
 */
export function useServerEvents(
  onEvent: (ev: ServerEvent) => void,
  onConnect?: () => void,
): void {
  const handler = useRef(onEvent);
  handler.current = onEvent;
  const connect = useRef(onConnect);
  connect.current = onConnect;
  useEffect(() => {
    const es = new EventSource('/__events');
    es.onopen = () => connect.current?.();
    es.onmessage = (msg: MessageEvent<string>) => {
      const ev = parseServerEvent(msg.data);
      if (ev !== null) handler.current(ev);
    };
    return () => es.close();
  }, []);
}
