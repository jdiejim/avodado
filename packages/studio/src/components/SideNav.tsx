/**
 * The doc sidebar — site-style navigation while editing: a "‹ Home" link, the
 * project's docs as a selectable list (the open one highlighted, like the
 * built site's sidebar), and a New-doc entry. Collapses away on narrow
 * windows (CSS) where the top-bar doc switcher covers the same ground.
 */

import { useMemo, useState } from 'react';
import { useStudio } from '../state/store.js';
import { IconDoc, IconPlus } from './Icons.js';
import { TemplatePicker } from './TemplatePicker.js';

export function SideNav(): JSX.Element {
  const docs = useStudio((s) => s.docs);
  const currentSlug = useStudio((s) => s.currentSlug);
  const openDoc = useStudio((s) => s.openDoc);
  const setMode = useStudio((s) => s.setMode);
  const [pickerOpen, setPickerOpen] = useState(false);

  const sorted = useMemo(() => [...docs].sort((a, b) => a.title.localeCompare(b.title)), [docs]);

  return (
    <nav className="stu-sidenav" aria-label="Documents">
      <button type="button" className="stu-sidenav-home" onClick={() => setMode('home')}>
        ‹ Home
      </button>
      <div className="stu-sidenav-label">Documents</div>
      <ul className="stu-sidenav-list">
        {sorted.map((d) => (
          <li key={d.slug}>
            <button
              type="button"
              className={`stu-sidenav-item ${d.slug === currentSlug ? 'stu-sidenav-active' : ''}`}
              title={d.slug}
              onClick={() => void openDoc(d.slug)}
            >
              <IconDoc size={13} />
              <span>{d.title}</span>
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="stu-sidenav-new" onClick={() => setPickerOpen(true)}>
        <IconPlus size={13} />
        New doc
      </button>
      {pickerOpen && <TemplatePicker onClose={() => setPickerOpen(false)} />}
    </nav>
  );
}
