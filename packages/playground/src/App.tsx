/**
 * Playground top-level component.
 *
 * Layout: title bar (theme picker + sample picker + share button) over a
 * two-pane split (markdown source textarea / live-rendered iframe).
 * Diagnostics from `validateDocument` show in a footer when present.
 *
 * The render call runs in the browser — `@avodado/core` + `@avodado/render`
 * are both pure-TS and ESM, so they bundle into the Vite output cleanly.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { parseDocument, validateDocument, type Diagnostic } from '@avodado/core';
import { renderDocument, type ThemeName } from '@avodado/render';
import { DEFAULT_SAMPLE, samples } from './samples.js';
import { decodeShare, encodeShare } from './share.js';

const THEMES: ReadonlyArray<{ id: ThemeName; label: string }> = [
  { id: 'minimal', label: 'Minimal' },
  { id: 'teal', label: 'Teal' },
  { id: 'plum', label: 'Plum' },
  { id: 'slate', label: 'Slate sans' },
];

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function App(): JSX.Element {
  const [source, setSource] = useState<string>(DEFAULT_SAMPLE.source);
  const [theme, setTheme] = useState<ThemeName>('minimal');
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const debounced = useDebounced(source, 200);

  // Decode share-link on first load.
  useEffect(() => {
    void (async () => {
      const decoded = await decodeShare(window.location.hash);
      if (decoded !== null) setSource(decoded);
    })();
  }, []);

  const { html, diagnostics } = useMemo(() => {
    let doc, diags: readonly Diagnostic[] = [];
    try {
      doc = parseDocument(debounced, 'playground');
      diags = validateDocument(doc, 'playground');
    } catch (err) {
      return {
        html: '',
        diagnostics: [
          {
            file: 'playground',
            level: 'error' as const,
            code: 'E_PARSE_YAML' as const,
            message: (err as Error).message,
          },
        ] as readonly Diagnostic[],
      };
    }
    try {
      return { html: renderDocument(doc, { theme }), diagnostics: diags };
    } catch (err) {
      return {
        html: '',
        diagnostics: [
          ...diags,
          {
            file: 'playground',
            level: 'error' as const,
            code: 'E_SCHEMA' as const,
            message: `Render failed: ${(err as Error).message}`,
          },
        ] as readonly Diagnostic[],
      };
    }
  }, [debounced, theme]);

  const onSample = (id: string): void => {
    const s = samples.find((x) => x.id === id);
    if (s !== undefined) {
      setSource(s.source);
      window.location.hash = '';
    }
  };

  const onShare = useCallback(async () => {
    setSharing(true);
    try {
      const hash = await encodeShare(source);
      window.location.hash = hash;
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard failed (Safari private mode etc.); the URL is still updated.
    } finally {
      setSharing(false);
    }
  }, [source]);

  const errorCount = diagnostics.filter((d) => d.level === 'error').length;
  const warnCount = diagnostics.filter((d) => d.level === 'warn').length;

  return (
    <div className="app">
      <header className="bar">
        <h1>Avodado playground</h1>
        <span className="sub">markdown + typed blocks → live preview</span>
        <span className="spacer" />
        <label>
          Theme:{' '}
          <select value={theme} onChange={(e) => setTheme(e.target.value as ThemeName)}>
            {THEMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Sample:{' '}
          <select onChange={(e) => onSample(e.target.value)} defaultValue="">
            <option value="" disabled>
              Load a sample…
            </option>
            {samples.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => void onShare()}
          disabled={sharing}
          className={copied ? 'copied' : ''}
        >
          {copied ? '✓ Link copied' : sharing ? 'Sharing…' : 'Share link'}
        </button>
      </header>

      <div className="split">
        <section className="pane source">
          <div className="pane-head">
            <span>Source</span>
            <span>{source.length.toLocaleString()} chars</span>
          </div>
          <textarea
            spellCheck={false}
            value={source}
            onChange={(e) => setSource(e.target.value)}
          />
        </section>

        <section className="pane preview">
          <div className="pane-head">
            <span>Preview</span>
            <span>
              {errorCount > 0 ? `${errorCount} error${errorCount === 1 ? '' : 's'}` : 'OK'}
              {warnCount > 0 ? ` · ${warnCount} warn` : ''}
            </span>
          </div>
          <iframe title="Preview" srcDoc={html} sandbox="allow-same-origin" />
          {diagnostics.length > 0 && (
            <div className="diagnostics">
              {diagnostics.map((d, i) => (
                <div key={i} className={`row ${d.level}`}>
                  <span className="level">{d.level === 'error' ? 'ERROR' : 'WARN'}</span>
                  {d.line !== undefined ? `:${d.line} ` : ' '}
                  <strong>{d.code}</strong> {d.message}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
