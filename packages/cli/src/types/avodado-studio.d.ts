/**
 * Ambient contract for the optional `@avodado/studio` package.
 *
 * `avo studio` imports it lazily at runtime (and degrades gracefully when the
 * package is absent); the real dependency is wired up in a later workstream.
 * This declaration lets the CLI typecheck without the package installed —
 * keep it in sync with `@avodado/studio`'s public API.
 */
declare module '@avodado/studio' {
  /** Absolute path to the built studio web-app assets (index.html & friends). */
  export function assetsPath(): string;
}
