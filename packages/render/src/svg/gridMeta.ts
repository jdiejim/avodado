/**
 * Grid metadata attributes for the coordinate-grid diagram SVGs (block, flow,
 * dfd, state, c4): inert `data-*` attributes mirroring each renderer's layout
 * constants, plus each node's EFFECTIVE cell — crucial in quick mode, where
 * the placements only exist post-auto-layout.
 *
 * Editors (Avodado Studio) read them to map pointer positions back to grid
 * cells (drag-to-move, drag-to-connect). They change no visual output.
 */

/** The layout constants a grid renderer advertises on its `<svg>`. */
export interface GridMeta {
  /** True when the layout was auto-derived (some node lacked `col`/`row`). */
  readonly quick: boolean;
  readonly cols: number;
  readonly rows: number;
  readonly cellW: number;
  readonly cellH: number;
  readonly gapX: number;
  readonly gapY: number;
  readonly padX: number;
  readonly padTop: number;
}

/** ` data-grid="1" … data-pad-top="…"` — the SVG-level grid geometry attrs. */
export function gridMetaAttrs(m: GridMeta): string {
  return (
    ` data-grid="1"${m.quick ? ' data-grid-auto="1"' : ''} data-cols="${m.cols}" data-rows="${m.rows}"` +
    ` data-cell-w="${m.cellW}" data-cell-h="${m.cellH}" data-gap-x="${m.gapX}" data-gap-y="${m.gapY}"` +
    ` data-pad-x="${m.padX}" data-pad-top="${m.padTop}"`
  );
}

/** ` data-col="…" data-row="…"` (+ ` data-w="…"`) — a node's effective cell. */
export function nodeCellAttrs(col: number, row: number, w?: number): string {
  return ` data-col="${col}" data-row="${row}"${w !== undefined ? ` data-w="${w}"` : ''}`;
}
