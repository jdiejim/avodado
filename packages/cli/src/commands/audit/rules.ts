/**
 * Recommendation rules — deterministic, evidence-cited.
 *
 * Each rule fires only when its evidence exists, cites real files from that
 * evidence, and writes a one-line rationale with the numbers in it. The menu
 * a consumer builds from these is therefore never a fixed list.
 *
 * Thresholds (from BATCH-B-PLAN.md, do not drift):
 * - architecture-overview: ≥2 packages OR ≥2 compose services OR
 *   ≥3 entrypoints → high; else ≥1 entrypoint AND ≥5 externals → medium.
 * - data-model: any schema file → high.
 * - request-flows: ≥3 routes → high; 1–2 → low.
 * - api-reference: openapi present → high; ≥5 routes → medium.
 * - dependency-map: top import in-degree ≥15 (graphify) or ≥10 (builtin)
 *   → medium.
 * - onboarding-guide: README absent or <30 lines → medium.
 */

import type {
  AuditRecommendation,
  AuditSourceName,
  CollectedEvidence,
} from './types.js';

/** Max citations per recommendation — enough to read, not a dump. */
const CITE_CAP = 8;

/** First `CITE_CAP` unique entries. */
function cite(files: readonly string[]): string[] {
  return [...new Set(files)].slice(0, CITE_CAP);
}

/** Derives the recommendation list from collected evidence. */
export function deriveRecommendations(
  collected: CollectedEvidence,
  source: AuditSourceName,
): AuditRecommendation[] {
  const { evidence, composeServices, readmeLines, readmeFile } = collected;
  const out: AuditRecommendation[] = [];

  // — architecture-overview
  const pkgCount = evidence.packages.length;
  const svcCount = composeServices.length;
  const entryCount = evidence.entrypoints.length;
  const archCites = cite([
    ...evidence.packages.map((p) => (p.dir === '.' ? 'package.json' : `${p.dir}/package.json`)),
    ...composeServices.map((s) => s.file),
    ...evidence.entrypoints.map((e) => e.file),
  ]);
  if (pkgCount >= 2 || svcCount >= 2 || entryCount >= 3) {
    const parts: string[] = [];
    if (pkgCount >= 2) parts.push(`${pkgCount} packages`);
    if (svcCount >= 2) parts.push(`${svcCount} compose services`);
    if (entryCount >= 3) parts.push(`${entryCount} entrypoints`);
    out.push({
      kind: 'architecture-overview',
      title: 'Architecture overview',
      rationale: `The repo has ${parts.join(' and ')}. An overview shows how they connect.`,
      confidence: 'high',
      citations: archCites,
      template: 'system-design',
    });
  } else if (entryCount >= 1 && evidence.externals.length >= 5) {
    out.push({
      kind: 'architecture-overview',
      title: 'Architecture overview',
      rationale: `The code talks to ${evidence.externals.length} external services from ${entryCount} entrypoint(s). An overview maps the boundary.`,
      confidence: 'medium',
      citations: cite([...archCites, ...evidence.externals.map((e) => e.file)]),
      template: 'system-design',
    });
  }

  // — data-model
  if (evidence.schemas.length >= 1) {
    out.push({
      kind: 'data-model',
      title: 'Data model',
      rationale: `The repo defines ${evidence.schemas.length} schema file(s). A data-model doc explains the entities.`,
      confidence: 'high',
      citations: cite(evidence.schemas.map((s) => s.file)),
      template: 'data-model',
    });
  }

  // — request-flows
  const routeCount = evidence.routes.length;
  if (routeCount >= 1) {
    out.push({
      kind: 'request-flows',
      title: 'Request flows',
      rationale: `The audit found ${routeCount} route(s). A flow doc traces each request path.`,
      confidence: routeCount >= 3 ? 'high' : 'low',
      citations: cite(evidence.routes.map((r) => r.file)),
      template: 'service-overview',
    });
  }

  // — api-reference
  const openapi = evidence.schemas.filter((s) => s.kind === 'openapi');
  if (openapi.length >= 1) {
    out.push({
      kind: 'api-reference',
      title: 'API reference',
      rationale: `An OpenAPI spec exists (${openapi[0]?.file}). An API reference doc can stay in sync with it.`,
      confidence: 'high',
      citations: cite(openapi.map((s) => s.file)),
      template: 'api-spec',
    });
  } else if (routeCount >= 5) {
    out.push({
      kind: 'api-reference',
      title: 'API reference',
      rationale: `The audit found ${routeCount} routes and no OpenAPI spec. An API reference documents them.`,
      confidence: 'medium',
      citations: cite(evidence.routes.map((r) => r.file)),
      template: 'api-spec',
    });
  }

  // — dependency-map
  const godThreshold = source === 'graphify' ? 15 : 10;
  const god = evidence.godNodes.find((g) => g.degree >= godThreshold);
  if (god !== undefined) {
    out.push({
      kind: 'dependency-map',
      title: 'Dependency map',
      rationale: `${god.name} has ${god.degree} inbound dependencies. A dependency map shows what breaks when it changes.`,
      confidence: 'medium',
      citations: cite([god.file].filter((f) => f !== '')),
      template: 'system-design',
    });
  }

  // — onboarding-guide
  if (readmeLines === undefined || readmeLines < 30) {
    const rationale =
      readmeLines === undefined
        ? 'The repo has no README. An onboarding guide gives new contributors a start.'
        : `The README has only ${readmeLines} line(s). An onboarding guide gives new contributors a start.`;
    out.push({
      kind: 'onboarding-guide',
      title: 'Onboarding guide',
      rationale,
      confidence: 'medium',
      citations: cite(
        [readmeFile, ...evidence.entrypoints.map((e) => e.file)].filter(
          (f): f is string => f !== undefined,
        ),
      ),
      template: 'onboarding',
    });
  }

  return out;
}
