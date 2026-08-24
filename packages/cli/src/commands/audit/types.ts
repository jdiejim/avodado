/**
 * Types for `avo audit` — the evidence report + recommendation contract.
 *
 * The JSON shape here is **schema version 1** (see BATCH-B-PLAN.md). The
 * `/avo` slash command and other consumers code against it; do not remove or
 * rename fields without bumping `version`.
 */

/** Where the evidence came from. */
export type AuditSourceName = 'graphify' | 'builtin';

/** File/language counts for the audited tree. */
export interface AuditStats {
  /** Number of files the source saw (builtin walks are capped). */
  readonly files: number;
  /** Files per normalized extension, e.g. `{ ts: 120, md: 14 }`. */
  readonly languages: Readonly<Record<string, number>>;
}

/** A file that starts the program (package.json main/bin, src/index.*, …). */
export interface EntrypointEvidence {
  readonly file: string;
  readonly why: string;
}

/** One HTTP route found by regex extraction. */
export interface RouteEvidence {
  readonly method: string;
  readonly path: string;
  readonly file: string;
}

/** A schema definition file. */
export interface SchemaEvidence {
  readonly file: string;
  readonly kind: 'sql' | 'prisma' | 'openapi' | 'proto' | 'other';
}

/** A workspace package (any package.json with a name). */
export interface PackageEvidence {
  readonly name: string;
  readonly dir: string;
}

/** An external service or SDK the code talks to. */
export interface ExternalEvidence {
  readonly name: string;
  readonly file: string;
}

/** A module many other modules depend on. */
export interface GodNodeEvidence {
  readonly name: string;
  readonly degree: number;
  readonly file: string;
}

/** Everything countable the audit found. */
export interface AuditEvidence {
  readonly entrypoints: readonly EntrypointEvidence[];
  readonly routes: readonly RouteEvidence[];
  readonly schemas: readonly SchemaEvidence[];
  readonly packages: readonly PackageEvidence[];
  readonly externals: readonly ExternalEvidence[];
  readonly godNodes: readonly GodNodeEvidence[];
}

/** The document kinds the rules can recommend. */
export type RecommendationKind =
  | 'architecture-overview'
  | 'data-model'
  | 'request-flows'
  | 'api-reference'
  | 'dependency-map'
  | 'onboarding-guide';

/** One rule-derived recommendation, with the evidence files that justify it. */
export interface AuditRecommendation {
  readonly kind: RecommendationKind;
  readonly title: string;
  /** One line; cites the numbers. */
  readonly rationale: string;
  readonly confidence: 'high' | 'medium' | 'low';
  /** Real files from the evidence. */
  readonly citations: readonly string[];
  /** Nearest `avo new` template name, when one fits. */
  readonly template?: string;
}

/** The full `avo audit --json` payload — schema version 1. */
export interface AuditReport {
  readonly version: 1;
  readonly source: AuditSourceName;
  /** Fallback reason or graphify hint, when there is one. */
  readonly notice?: string;
  readonly stats: AuditStats;
  readonly evidence: AuditEvidence;
  readonly recommendations: readonly AuditRecommendation[];
}

/**
 * Internal collector output. Compose-service names feed the rules but stay
 * out of the version-1 JSON evidence (the contract has no field for them).
 */
export interface CollectedEvidence {
  readonly stats: AuditStats;
  readonly evidence: AuditEvidence;
  /** docker-compose service names + the compose file that declares them. */
  readonly composeServices: readonly { readonly name: string; readonly file: string }[];
  /** Root README line count; undefined when no README exists. */
  readonly readmeLines: number | undefined;
  /** README path relative to the root, when one exists. */
  readonly readmeFile: string | undefined;
  /** True when the builtin walk hit its file cap. */
  readonly truncated: boolean;
}
