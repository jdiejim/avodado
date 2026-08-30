/**
 * The ONE theme surface — a right-docked panel that starts below the top bar
 * (no scrim; the canvas stays live so a click applies visibly). Two halves:
 *
 * - the swatch grid: built-ins + saved themes as cards. Clicking a card
 *   applies it INSTANTLY through the same session-preview path the old
 *   picker used (`setTheme` — never a disk write; a disk change resyncs
 *   over it). "dark" is a theme like any other.
 * - Customize: the old Theme Generator folded in (name, base, color rows,
 *   fonts), live-previewing via `previewTheme` once touched, ending in one
 *   primary "Save theme" — the only path that writes a file
 *   (`saveTheme` → `applySavedTheme`).
 *
 * Esc closes the panel before the canvas ladder sees it (capture +
 * stopPropagation, like every transient studio surface).
 */

import { useEffect, useMemo, useState } from 'react';
import type { ThemeName } from '@avodado/render';
import { saveTheme } from '../api/client.js';
import { BASE_THEMES, THEME_COLORS, THEME_FONTS } from '../lib/themeFields.js';
import { themeCards } from '../lib/themePanel.js';
import { useStudio } from '../state/store.js';
import { IconClose } from './Icons.js';

function seedColors(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of THEME_COLORS) out[c.key] = c.default;
  return out;
}

/** friendly {colors, fonts} → the CSS-var overrides the renderer consumes. */
function toThemeVars(
  colors: Record<string, string>,
  fonts: Record<string, string>,
): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const c of THEME_COLORS) {
    const v = colors[c.key];
    if (v) vars[c.cssVar] = v;
  }
  for (const f of THEME_FONTS) {
    const v = fonts[f.key]?.trim();
    if (v) vars[f.cssVar] = v;
  }
  return vars;
}

export function ThemePanel({ onClose }: { onClose: () => void }): JSX.Element {
  const meta = useStudio((s) => s.meta);
  const themeChoice = useStudio((s) => s.themeChoice);
  const setTheme = useStudio((s) => s.setTheme);
  const previewTheme = useStudio((s) => s.previewTheme);
  const applySavedTheme = useStudio((s) => s.applySavedTheme);
  const toast = useStudio((s) => s.toast);

  // Customize draft — the old generator's state, unchanged.
  const [name, setName] = useState('');
  const [base, setBase] = useState<string>('textbook');
  const [colors, setColors] = useState<Record<string, string>>(seedColors);
  const [fonts, setFonts] = useState<Record<string, string>>({});
  const [scope, setScope] = useState<'project' | 'global'>('project');
  const [busy, setBusy] = useState(false);
  // The draft previews only once touched — opening the panel must not retint
  // the canvas with the seeded defaults.
  const [touched, setTouched] = useState(false);

  const cards = useMemo(() => themeCards(meta, themeChoice), [meta, themeChoice]);
  const vars = useMemo(() => toThemeVars(colors, fonts), [colors, fonts]);

  useEffect(() => {
    if (!touched) return;
    previewTheme(base as ThemeName, Object.keys(vars).length > 0 ? vars : undefined);
  }, [touched, base, vars, previewTheme]);

  // Esc closes the panel — before block deselect (App's bubble listener).
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

  // On unmount, clear any dangling Customize preview by re-resolving the
  // current choice (idempotent when nothing was previewed).
  useEffect(
    () => () => {
      const s = useStudio.getState();
      s.setTheme(s.themeChoice);
    },
    [],
  );

  const apply = (choice: string): void => {
    setTheme(choice);
    setTouched(false); // the card wins over a half-built draft
  };

  const save = async (): Promise<void> => {
    if (name.trim() === '') {
      toast('Give the theme a name first', 'error');
      return;
    }
    setBusy(true);
    try {
      const { slug } = await saveTheme({ name: name.trim(), base, colors, fonts, scope });
      await applySavedTheme(slug); // refetch meta + activate — its card appears active
      setTouched(false);
      toast(`Saved theme "${name.trim()}" (${scope})`, 'info');
    } catch (err) {
      toast(`Theme save failed: ${(err as Error).message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="stu-themepanel" role="dialog" aria-label="Theme">
      <header className="stu-themepanel-hd">
        <span>Theme</span>
        <button type="button" className="stu-themepanel-x" aria-label="Close" onClick={onClose}>
          <IconClose size={14} />
        </button>
      </header>

      <div className="stu-themepanel-body">
        <div className="stu-themepanel-grid">
          {cards.map((c) => (
            <button
              key={c.choice}
              type="button"
              className={`stu-themecard ${c.active ? 'stu-themecard-on' : ''}`}
              aria-pressed={c.active}
              onClick={() => apply(c.choice)}
            >
              <span className="stu-themecard-strips" aria-hidden="true">
                <span style={{ background: c.swatch.paper }} />
                <span style={{ background: c.swatch.primary }} />
                <span style={{ background: c.swatch.accent }} />
              </span>
              <span className="stu-themecard-name">
                {c.label}
                {c.active && ' · active'}
              </span>
            </button>
          ))}
        </div>
        <p className="stu-themepanel-hint">Click a theme to apply it.</p>

        <div className="stu-themepanel-custom">
          <div className="stu-themepanel-section">Customize</div>

          <label className="stu-themepanel-field">
            <span>Name</span>
            <input
              type="text"
              value={name}
              placeholder="My theme"
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <label className="stu-themepanel-field">
            <span>Base theme</span>
            <select
              value={base}
              onChange={(e) => {
                setBase(e.target.value);
                setTouched(true);
              }}
            >
              {BASE_THEMES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <div className="stu-themepanel-section">Colors</div>
          {THEME_COLORS.map((c) => (
            <div key={c.key} className="stu-themepanel-color">
              <input
                type="color"
                value={colors[c.key] ?? '#000000'}
                aria-label={c.label}
                onChange={(e) => {
                  setColors((p) => ({ ...p, [c.key]: e.target.value }));
                  setTouched(true);
                }}
              />
              <div className="stu-themepanel-color-meta">
                <span className="stu-themepanel-color-label">{c.label}</span>
                <span className="stu-themepanel-color-hint">{c.hint}</span>
              </div>
              <input
                type="text"
                className="stu-themepanel-hex"
                value={colors[c.key] ?? ''}
                spellCheck={false}
                onChange={(e) => {
                  setColors((p) => ({ ...p, [c.key]: e.target.value }));
                  setTouched(true);
                }}
              />
            </div>
          ))}

          <div className="stu-themepanel-section">Fonts (optional)</div>
          {THEME_FONTS.map((f) => (
            <label key={f.key} className="stu-themepanel-field">
              <span>{f.label}</span>
              <input
                type="text"
                value={fonts[f.key] ?? ''}
                placeholder={f.placeholder}
                spellCheck={false}
                onChange={(e) => {
                  setFonts((p) => ({ ...p, [f.key]: e.target.value }));
                  setTouched(true);
                }}
              />
            </label>
          ))}

          <div className="stu-themepanel-scope" role="radiogroup" aria-label="Save location">
            <label>
              <input
                type="radio"
                checked={scope === 'project'}
                onChange={() => setScope('project')}
              />
              Project
            </label>
            <label>
              <input
                type="radio"
                checked={scope === 'global'}
                onChange={() => setScope('global')}
              />
              Global
            </label>
          </div>
          <button
            type="button"
            className="stu-btn stu-btn-primary stu-themepanel-save"
            disabled={busy}
            onClick={() => void save()}
          >
            {busy ? 'Saving…' : 'Save theme'}
          </button>
        </div>
      </div>

      <footer className="stu-themepanel-ft">
        Writes avodado.theme.json — the file is the theme.
      </footer>
    </aside>
  );
}
