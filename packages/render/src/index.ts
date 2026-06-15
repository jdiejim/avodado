/**
 * Avodado HTML renderer.
 *
 * Pure function: takes a parsed {@link Document}, returns a standalone HTML
 * string. No DOM, no browser, no I/O.
 *
 * @packageDocumentation
 */

export { houseCss } from './css.js';
export { escapeHtml } from './escape.js';
export { safeColor, safeUrl } from './sanitize.js';
export { renderProse } from './markdown.js';
export { renderDocument, type RenderOptions } from './document.js';
export {
  renderDocumentParts,
  buildThemeVars,
  type RenderPartsOptions,
  type DocumentParts,
  type DocumentSection,
} from './parts.js';
export {
  htmlRenderers,
  type HtmlRenderer,
  type HtmlRendererRegistry,
} from './registry.js';
export {
  themes,
  themeStyle,
  DEFAULT_THEME,
  type ThemeName,
} from './themes.js';

// Re-export shared SVG utilities for downstream block renderers.
export {
  globalDefsSvg,
  ortho,
  wrapText,
  edgePill,
  type Box,
  type Route,
  type PillPoint,
} from './svg/index.js';
