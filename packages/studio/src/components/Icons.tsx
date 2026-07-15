/**
 * The studio's inline SVG icon set — one tiny stroke-styled component per
 * glyph so toolbars and menus never fall back to emoji or font glyphs.
 */

interface IconProps {
  readonly size?: number;
}

function svgProps(size: number): {
  width: number;
  height: number;
  viewBox: string;
  fill: string;
  stroke: string;
  strokeWidth: number;
  strokeLinecap: 'round';
  strokeLinejoin: 'round';
  'aria-hidden': true;
} {
  return {
    width: size,
    height: size,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };
}

export function IconGrip({ size = 14 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)} stroke="none" fill="currentColor">
      <circle cx="5.5" cy="3.5" r="1.25" />
      <circle cx="10.5" cy="3.5" r="1.25" />
      <circle cx="5.5" cy="8" r="1.25" />
      <circle cx="10.5" cy="8" r="1.25" />
      <circle cx="5.5" cy="12.5" r="1.25" />
      <circle cx="10.5" cy="12.5" r="1.25" />
    </svg>
  );
}

export function IconEdit({ size = 14 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)}>
      <path d="M9.8 3.1 12.9 6.2 6.2 12.9 2.8 13.2 3.1 9.8Z" />
      <path d="M8.6 4.3l3.1 3.1" />
    </svg>
  );
}

export function IconDuplicate({ size = 14 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)}>
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
      <path d="M10.5 3.5v-1a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h1" />
    </svg>
  );
}

export function IconArrowUp({ size = 14 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)}>
      <path d="M8 13V3" />
      <path d="M3.8 7.2 8 3l4.2 4.2" />
    </svg>
  );
}

export function IconArrowDown({ size = 14 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)}>
      <path d="M8 3v10" />
      <path d="M3.8 8.8 8 13l4.2-4.2" />
    </svg>
  );
}

export function IconTrash({ size = 14 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)}>
      <path d="M2.5 4h11" />
      <path d="M5.5 4V2.8a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V4" />
      <path d="M4 4l.7 9a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9L12 4" />
      <path d="M6.6 7v4M9.4 7v4" />
    </svg>
  );
}

export function IconPlus({ size = 14 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)}>
      <path d="M8 3.2v9.6M3.2 8h9.6" />
    </svg>
  );
}

export function IconSearch({ size = 14 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)}>
      <circle cx="7" cy="7" r="4.4" />
      <path d="m10.4 10.4 3.1 3.1" />
    </svg>
  );
}

export function IconClose({ size = 14 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)}>
      <path d="m4 4 8 8M12 4l-8 8" />
    </svg>
  );
}

export function IconChevronDown({ size = 14 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)}>
      <path d="m4 6.2 4 4 4-4" />
    </svg>
  );
}

export function IconChevronRight({ size = 14 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)}>
      <path d="m6.2 4 4 4-4 4" />
    </svg>
  );
}

export function IconCheck({ size = 14 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)}>
      <path d="m3 8.6 3.3 3.4L13 4.6" />
    </svg>
  );
}

export function IconDoc({ size = 14 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)}>
      <path d="M4 1.8h5.2L12 4.6V14.2H4Z" />
      <path d="M9 1.8v3h3" />
      <path d="M6 8h4M6 10.5h4" />
    </svg>
  );
}

export function IconUndo({ size = 15 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)}>
      <path d="M6.5 3 3 6.5 6.5 10" />
      <path d="M3 6.5h6a4 4 0 0 1 0 8H7" />
    </svg>
  );
}

export function IconRedo({ size = 15 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)}>
      <path d="M9.5 3 13 6.5 9.5 10" />
      <path d="M13 6.5H7a4 4 0 0 0 0 8h2" />
    </svg>
  );
}

export function IconSlash({ size = 14 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)}>
      <path d="M10.2 2.5 5.8 13.5" />
    </svg>
  );
}

export function IconLibrary({ size = 14 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)}>
      <rect x="2.3" y="2.3" width="4.9" height="4.9" rx="1.1" />
      <rect x="8.8" y="2.3" width="4.9" height="4.9" rx="1.1" />
      <rect x="2.3" y="8.8" width="4.9" height="4.9" rx="1.1" />
      <rect x="8.8" y="8.8" width="4.9" height="4.9" rx="1.1" />
    </svg>
  );
}

export function IconImport({ size = 14 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)}>
      <path d="M8 2.5v7" />
      <path d="M5.2 6.9 8 9.7l2.8-2.8" />
      <path d="M2.8 10.5v1.8a1.2 1.2 0 0 0 1.2 1.2h8a1.2 1.2 0 0 0 1.2-1.2v-1.8" />
    </svg>
  );
}

export function IconExport({ size = 14 }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size)}>
      <path d="M8 9.7v-7" />
      <path d="M5.2 5.3 8 2.5l2.8 2.8" />
      <path d="M2.8 10.5v1.8a1.2 1.2 0 0 0 1.2 1.2h8a1.2 1.2 0 0 0 1.2-1.2v-1.8" />
    </svg>
  );
}
