/**
 * Theme Generator — a right-docked panel that builds a custom theme (a base
 * theme + friendly color/font overrides) and installs it as a `*.theme.json`
 * file through the file bridge. It live-previews on the canvas by feeding the
 * store's `previewTheme` on every change; Install writes the file (the server
 * watcher then surfaces it in the picker) and activates it. Cancel/Esc restores
 * the theme that was active when it opened.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ThemeName } from '@avodado/render';
import { saveTheme } from '../api/client.js';
import { BASE_THEMES, THEME_COLORS, THEME_FONTS } from '../lib/themeFields.js';
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

export function ThemeGenerator({ onClose }: { onClose: () => void }): JSX.Element {
  const previewTheme = useStudio((s) => s.previewTheme);
  const applySavedTheme = useStudio((s) => s.applySavedTheme);
  const setTheme = useStudio((s) => s.setTheme);
  const toast = useStudio((s) => s.toast);
  // What was active when we opened — restored on cancel.
  const priorChoice = useRef(useStudio.getState().themeChoice);

  const [name, setName] = useState('');
  const [base, setBase] = useState<string>('textbook');
  const [colors, setColors] = useState<Record<string, string>>(seedColors);
  const [fonts, setFonts] = useState<Record<string, string>>({});
  const [scope, setScope] = useState<'project' | 'global'>('project');
  const [busy, setBusy] = useState(false);

  const vars = useMemo(() => toThemeVars(colors, fonts), [colors, fonts]);

  // Live preview: retint the canvas on every base/color/font change.
  useEffect(() => {
    previewTheme(base as ThemeName, Object.keys(vars).length > 0 ? vars : undefined);
  }, [base, vars, previewTheme]);

  // Esc closes (and restores). Restore on unmount too, unless install swapped it.
  const restored = useRef(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      if (!restored.current) setTheme(priorChoice.current);
    };
  }, [setTheme]);

  const close = (): void => {
    restored.current = true;
    setTheme(priorChoice.current);
    onClose();
  };

  const install = async (): Promise<void> => {
    if (name.trim() === '') {
      toast('Give the theme a name first', 'error');
      return;
    }
    setBusy(true);
    try {
      const { slug } = await saveTheme({ name: name.trim(), base, colors, fonts, scope });
      await applySavedTheme(slug); // refetch meta + activate the new theme
      restored.current = true; // keep the new theme; don't restore on unmount
      toast(`Installed theme "${name.trim()}" (${scope})`, 'info');
      onClose();
    } catch (err) {
      toast(`Theme install failed: ${(err as Error).message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="stu-themegen" role="dialog" aria-label="Theme generator">
      <header className="stu-themegen-hd">
        <span>Theme generator</span>
        <button type="button" className="stu-themegen-x" aria-label="Close" onClick={close}>
          <IconClose size={14} />
        </button>
      </header>

      <div className="stu-themegen-body">
        <label className="stu-themegen-field">
          <span>Name</span>
          <input
            type="text"
            value={name}
            placeholder="My theme"
            autoFocus
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label className="stu-themegen-field">
          <span>Base theme</span>
          <select value={base} onChange={(e) => setBase(e.target.value)}>
            {BASE_THEMES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <div className="stu-themegen-section">Colors</div>
        {THEME_COLORS.map((c) => (
          <div key={c.key} className="stu-themegen-color">
            <input
              type="color"
              value={colors[c.key] ?? '#000000'}
              aria-label={c.label}
              onChange={(e) => setColors((p) => ({ ...p, [c.key]: e.target.value }))}
            />
            <div className="stu-themegen-color-meta">
              <span className="stu-themegen-color-label">{c.label}</span>
              <span className="stu-themegen-color-hint">{c.hint}</span>
            </div>
            <input
              type="text"
              className="stu-themegen-hex"
              value={colors[c.key] ?? ''}
              spellCheck={false}
              onChange={(e) => setColors((p) => ({ ...p, [c.key]: e.target.value }))}
            />
          </div>
        ))}

        <div className="stu-themegen-section">Fonts (optional)</div>
        {THEME_FONTS.map((f) => (
          <label key={f.key} className="stu-themegen-field">
            <span>{f.label}</span>
            <input
              type="text"
              value={fonts[f.key] ?? ''}
              placeholder={f.placeholder}
              spellCheck={false}
              onChange={(e) => setFonts((p) => ({ ...p, [f.key]: e.target.value }))}
            />
          </label>
        ))}
      </div>

      <footer className="stu-themegen-ft">
        <div className="stu-themegen-scope" role="radiogroup" aria-label="Install location">
          <label>
            <input type="radio" checked={scope === 'project'} onChange={() => setScope('project')} />
            Project
          </label>
          <label>
            <input type="radio" checked={scope === 'global'} onChange={() => setScope('global')} />
            Global
          </label>
        </div>
        <div className="stu-themegen-actions">
          <button type="button" className="stu-btn" onClick={close}>
            Cancel
          </button>
          <button
            type="button"
            className="stu-btn stu-btn-primary"
            disabled={busy}
            onClick={() => void install()}
          >
            {busy ? 'Installing…' : 'Install theme'}
          </button>
        </div>
      </footer>
    </aside>
  );
}
