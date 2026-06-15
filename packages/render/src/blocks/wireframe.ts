/**
 * Renders UI mockups — low-fidelity wireframes inside device frames
 * (desktop window, browser, or phone). Each screen is a vertical stack of
 * UI elements (header, button, list, card, …) drawn as neutral placeholders,
 * Excalidraw-flavoured.
 *
 * Screens lay out left-to-right in a row. Element heights are fixed per type;
 * the frame grows to fit its content (phones keep a minimum height).
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { wrapText } from '../svg/wrapText.js';
import { diagramFrame } from './frame.js';

type Screen = NonNullable<BlockDataMap['wireframe']['screens']>[number];
type Element = NonNullable<Screen['elements']>[number];

/** Inner content width per device (the drawable area inside the frame chrome). */
function contentWidth(device: string): number {
  if (device === 'phone') return 200;
  return 380; // desktop / browser
}

/** Vertical space one element consumes (its drawn height + the gap below). */
function elementHeight(el: Element): number {
  const rows = Math.max(1, el.rows ?? 1);
  switch (el.type) {
    case 'header':
      return 34;
    case 'subheader':
      return 26;
    case 'text':
      return 16 + (rows - 1) * 12;
    case 'button':
      return 42;
    case 'input':
    case 'search':
      return 42;
    case 'image':
      return 96;
    case 'avatar':
      return 52;
    case 'card':
      return rows * 64 + (rows - 1) * 10;
    case 'list':
      return rows * 40;
    case 'nav':
      return 34;
    case 'tabs':
      return 52;
    case 'divider':
      return 14;
    case 'badge':
      return 26;
    case 'toggle':
      return 30;
    case 'spacer':
      return 18 * rows;
    default:
      return 24;
  }
}

const PH = 'fill="var(--light-gray)" stroke="var(--rule)" stroke-width="1"';

/** Draws one element at (x, y) within a content column of width w. Returns SVG. */
function drawElement(el: Element, x: number, y: number, w: number): string {
  const rows = Math.max(1, el.rows ?? 1);
  const label = el.label ?? '';
  const accent =
    el.tone === 'danger'
      ? 'var(--negative)'
      : el.tone === 'muted'
        ? 'var(--gray)'
        : 'var(--navy)';
  const anchorX = el.align === 'c' ? x + w / 2 : el.align === 'r' ? x + w : x;
  const anchor = el.align === 'c' ? 'middle' : el.align === 'r' ? 'end' : 'start';

  switch (el.type) {
    case 'header':
      return `<text x="${anchorX}" y="${y + 22}" class="wf-h" fill="var(--charcoal)" text-anchor="${anchor}">${escapeHtml(label || 'Heading')}</text>`;
    case 'subheader':
      return `<text x="${anchorX}" y="${y + 17}" class="wf-sub" fill="var(--gray)" text-anchor="${anchor}">${escapeHtml(label || 'Subheading')}</text>`;
    case 'text': {
      let s = '';
      for (let i = 0; i < rows; i++) {
        const lw = i === rows - 1 ? w * 0.66 : w;
        s += `<rect x="${x}" y="${y + i * 12}" width="${lw}" height="6" rx="3" fill="var(--rule)"/>`;
      }
      return s;
    }
    case 'button':
      return (
        `<rect x="${x}" y="${y}" width="${w}" height="34" rx="8" fill="${accent}"/>` +
        `<text x="${x + w / 2}" y="${y + 22}" class="wf-btn" text-anchor="middle">${escapeHtml(label || 'Button')}</text>`
      );
    case 'input':
    case 'search': {
      const icon =
        el.type === 'search'
          ? `<circle cx="${x + 16}" cy="${y + 17}" r="5" fill="none" stroke="var(--gray)" stroke-width="1.4"/><path d="M${x + 20} ${y + 21} l4 4" stroke="var(--gray)" stroke-width="1.4"/>`
          : '';
      const tx = el.type === 'search' ? x + 30 : x + 12;
      return (
        `<rect x="${x}" y="${y}" width="${w}" height="34" rx="8" fill="var(--white)" stroke="var(--rule)" stroke-width="1.2"/>` +
        icon +
        `<text x="${tx}" y="${y + 21}" class="wf-ph-text">${escapeHtml(label || 'Type here…')}</text>`
      );
    }
    case 'image':
      return (
        `<rect x="${x}" y="${y}" width="${w}" height="88" rx="8" ${PH}/>` +
        `<path d="M${x} ${y + 88} L${x + w * 0.4} ${y + 40} L${x + w * 0.62} ${y + 66} L${x + w * 0.78} ${y + 50} L${x + w} ${y + 88}" fill="none" stroke="var(--gray)" stroke-width="1.3"/>` +
        `<circle cx="${x + w * 0.74} " cy="${y + 26}" r="7" fill="none" stroke="var(--gray)" stroke-width="1.3"/>`
      );
    case 'avatar':
      return (
        `<circle cx="${x + 22}" cy="${y + 22}" r="20" ${PH}/>` +
        `<circle cx="${x + 22}" cy="${y + 17}" r="7" fill="var(--gray)"/>` +
        `<path d="M${x + 9} ${y + 40} a13 11 0 0 1 26 0" fill="var(--gray)"/>` +
        (label
          ? `<text x="${x + 52}" y="${y + 27}" class="wf-sub" fill="var(--charcoal)">${escapeHtml(label)}</text>`
          : '')
      );
    case 'card': {
      let s = '';
      for (let i = 0; i < rows; i++) {
        const cy = y + i * 74;
        s +=
          `<rect x="${x}" y="${cy}" width="${w}" height="64" rx="10" fill="var(--white)" stroke="var(--rule)" stroke-width="1.2"/>` +
          `<rect x="${x + 12}" y="${cy + 12}" width="40" height="40" rx="8" ${PH}/>` +
          `<rect x="${x + 64}" y="${cy + 16}" width="${w - 92}" height="7" rx="3.5" fill="var(--rule)"/>` +
          `<rect x="${x + 64}" y="${cy + 34}" width="${(w - 92) * 0.6}" height="6" rx="3" fill="var(--rule)"/>`;
      }
      const cap = label
        ? `<text x="${x + 64}" y="${y + 30}" class="wf-ph-text"></text>`
        : '';
      return s + cap;
    }
    case 'list': {
      let s = '';
      for (let i = 0; i < rows; i++) {
        const ly = y + i * 40;
        s +=
          `<circle cx="${x + 16}" cy="${ly + 20}" r="12" ${PH}/>` +
          `<rect x="${x + 38}" y="${ly + 12}" width="${w - 76}" height="6" rx="3" fill="var(--rule)"/>` +
          `<rect x="${x + 38}" y="${ly + 24}" width="${(w - 76) * 0.55}" height="5" rx="2.5" fill="var(--rule)"/>` +
          `<path d="M${x + w - 14} ${ly + 15} l5 5 l-5 5" fill="none" stroke="var(--gray)" stroke-width="1.4"/>` +
          (i < rows - 1
            ? `<line x1="${x + 38}" y1="${ly + 40}" x2="${x + w}" y2="${ly + 40}" stroke="var(--light-gray)" stroke-width="1"/>`
            : '');
      }
      return s;
    }
    case 'nav': {
      // a row of pill items; label is comma-separated item names.
      const items = (label || 'Home, Docs, Pricing, About').split(',').map((t) => t.trim());
      let s = '';
      let nx = x;
      for (const it of items) {
        const pw = 16 + it.length * 6.2;
        s +=
          `<rect x="${nx}" y="${y + 4}" width="${pw}" height="22" rx="11" fill="var(--light-gray)"/>` +
          `<text x="${nx + pw / 2}" y="${y + 19}" class="wf-ph-text" text-anchor="middle">${escapeHtml(it)}</text>`;
        nx += pw + 8;
      }
      return s;
    }
    case 'tabs': {
      const items = (label || 'Home, Search, Bell, Profile').split(',').map((t) => t.trim());
      const seg = w / items.length;
      let s = `<line x1="${x}" y1="${y}" x2="${x + w}" y2="${y}" stroke="var(--rule)" stroke-width="1"/>`;
      items.forEach((it, i) => {
        const cx = x + seg * i + seg / 2;
        s +=
          `<circle cx="${cx}" cy="${y + 18}" r="8" fill="none" stroke="${i === 0 ? accent : 'var(--gray)'}" stroke-width="1.6"/>` +
          `<text x="${cx}" y="${y + 42}" class="wf-tab" text-anchor="middle" fill="${i === 0 ? accent : 'var(--gray)'}">${escapeHtml(it)}</text>`;
      });
      return s;
    }
    case 'divider':
      return `<line x1="${x}" y1="${y + 7}" x2="${x + w}" y2="${y + 7}" stroke="var(--rule)" stroke-width="1"/>`;
    case 'badge': {
      const pw = 22 + label.length * 6.4;
      return (
        `<rect x="${anchorX - (anchor === 'middle' ? pw / 2 : anchor === 'end' ? pw : 0)}" y="${y}" width="${pw}" height="22" rx="11" fill="${accent}"/>` +
        `<text x="${anchorX - (anchor === 'middle' ? 0 : anchor === 'end' ? pw / 2 : -pw / 2)}" y="${y + 15}" class="wf-btn" text-anchor="middle">${escapeHtml(label || 'New')}</text>`
      );
    }
    case 'toggle':
      return (
        (label
          ? `<text x="${x}" y="${y + 19}" class="wf-sub" fill="var(--charcoal)">${escapeHtml(label)}</text>`
          : '') +
        `<rect x="${x + w - 44}" y="${y + 6}" width="44" height="22" rx="11" fill="${accent}"/>` +
        `<circle cx="${x + w - 16}" cy="${y + 17}" r="8" fill="#fff"/>`
      );
    case 'spacer':
      return '';
    default:
      return '';
  }
}

/** Renders one device frame and its stacked content. Returns {svg, width, height}. */
function drawScreen(screen: Screen, idx: number): { svg: string; width: number; height: number } {
  const device = screen.device ?? 'browser';
  const cw = contentWidth(device);
  const pad = 16;
  const els = screen.elements ?? [];
  let contentH = 0;
  for (const el of els) contentH += elementHeight(el) + 10;
  contentH = Math.max(contentH, 80);

  // chrome heights
  const isPhone = device === 'phone';
  const isBrowser = device === 'browser';
  const titleBarH = 30;
  const addressBarH = isBrowser ? 26 : 0;
  const chromeTop = titleBarH + addressBarH;
  const homeBarH = isPhone ? 24 : 0;

  const frameW = cw + pad * 2;
  const screenH = contentH + pad;
  const frameH = chromeTop + screenH + homeBarH;
  const rx = isPhone ? 30 : 14;
  const sw = isPhone ? 2.4 : 1.8;
  const clip = `wfclip${idx}`;

  // Inner chrome + content, drawn first and clipped to the rounded frame so
  // nothing spills the corners. The border stroke is drawn LAST, on top, so the
  // outline is always crisp and visible above the fills.
  let inner = '';
  if (isPhone) {
    inner += `<rect x="0" y="0" width="${frameW}" height="${titleBarH}" fill="var(--light-gray)"/>`;
    inner += `<rect x="${frameW / 2 - 26}" y="6" width="52" height="9" rx="4.5" fill="var(--charcoal)"/>`;
    if (screen.title)
      inner += `<text x="16" y="20" class="wf-status">${escapeHtml(screen.title)}</text>`;
    inner += `<text x="${frameW - 16}" y="20" class="wf-status" text-anchor="end">100%</text>`;
  } else {
    inner += `<rect x="0" y="0" width="${frameW}" height="${titleBarH}" fill="var(--light-gray)"/>`;
    inner += `<line x1="0" y1="${titleBarH}" x2="${frameW}" y2="${titleBarH}" stroke="var(--rule)" stroke-width="1"/>`;
    inner += `<circle cx="18" cy="15" r="5" fill="var(--negative)"/><circle cx="34" cy="15" r="5" fill="var(--highlight)"/><circle cx="50" cy="15" r="5" fill="var(--positive)"/>`;
    if (screen.title && !isBrowser)
      inner += `<text x="${frameW / 2}" y="20" class="wf-status" text-anchor="middle">${escapeHtml(screen.title)}</text>`;
    if (isBrowser) {
      const url = screen.url ?? screen.title ?? 'example.com';
      inner += `<rect x="68" y="${titleBarH + 5}" width="${frameW - 84}" height="16" rx="8" fill="var(--white)" stroke="var(--rule)" stroke-width="1"/>`;
      inner += `<text x="78" y="${titleBarH + 16}" class="wf-url">${escapeHtml(url)}</text>`;
    }
  }

  let cy = chromeTop + pad;
  for (const el of els) {
    inner += drawElement(el, pad, cy, cw);
    cy += elementHeight(el) + 10;
  }
  if (isPhone) {
    inner += `<rect x="${frameW / 2 - 30}" y="${frameH - 15}" width="60" height="5" rx="2.5" fill="var(--charcoal)" opacity="0.55"/>`;
  }

  const s =
    `<g filter="url(#gshadow)">` +
    `<defs><clipPath id="${clip}"><rect x="0" y="0" width="${frameW}" height="${frameH}" rx="${rx}"/></clipPath></defs>` +
    // solid backing so the drop shadow reads against any page colour
    `<rect x="0" y="0" width="${frameW}" height="${frameH}" rx="${rx}" fill="var(--white)"/>` +
    `<g clip-path="url(#${clip})">${inner}</g>` +
    // border on top — always visible above the fills
    `<rect x="0" y="0" width="${frameW}" height="${frameH}" rx="${rx}" fill="none" stroke="var(--charcoal)" stroke-width="${sw}"/>` +
    `</g>`;
  return { svg: s, width: frameW, height: frameH };
}

export function renderWireframe(data: BlockDataMap['wireframe']): string {
  const screens = data.screens ?? [];
  const gap = 36;
  const capH = 22;
  const padX = 8;
  const padY = 8;

  const drawn = screens.map((screen, i) => drawScreen(screen, i));
  const totalW = drawn.reduce((a, d) => a + d.width, 0) + gap * Math.max(0, drawn.length - 1);
  const maxH = drawn.reduce((a, d) => Math.max(a, d.height), 0);
  const width = totalW + padX * 2;
  const height = maxH + capH + padY * 2;

  let s = `<svg viewBox="0 0 ${width} ${height}" role="img"><title>${escapeHtml(data.title ?? 'UI mockup')}</title>`;
  let x = padX;
  drawn.forEach((d, i) => {
    const screen = screens[i];
    s += `<g transform="translate(${x}, ${padY})">${d.svg}</g>`;
    const cap = screen?.label;
    if (cap !== undefined && cap.length > 0) {
      const lines = wrapText(cap, Math.floor(d.width / 6), 2);
      lines.forEach((ln, j) => {
        s += `<text x="${x + d.width / 2}" y="${padY + maxH + 16 + j * 12}" class="wf-caption" text-anchor="middle">${escapeHtml(ln)}</text>`;
      });
    }
    x += d.width + gap;
  });
  s += `</svg>`;

  return diagramFrame(
    {
      tag: 'UI',
      tagBg: '#6b21a8',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
    },
    s,
  );
}
