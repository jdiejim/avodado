---
'@avodado/core': minor
'@avodado/studio': minor
'avodado': minor
---

Templates are finished documents now, and there are eighteen of them.

`avo template adr` used to hand you a form — `ADR-NNN`, `YYYY-MM-DD`, "what
forces a decision here?". It now hands you a real decision record about
idempotency keys on a payments API, with the forces that drove it, the sequence
that shows the mechanism, three options weighed, the architecture, consequences,
risks and a rollout. You edit a document instead of filling in a shape.

**Seven new templates**, all written the same way: `migration-plan` (before/after,
phases, the cutover runbook, rollback, risks), `threat-model` (scope, the data
flow across the trust boundary, STRIDE threats, controls, tests),
`service-overview` (the page you want at 3am — owner, architecture, SLOs,
dependencies, common operations), `release-notes` (highlights, changelog,
breaking changes, upgrade steps, deprecations), `test-plan` (scope, the case
matrix, environments, suite status, exit criteria), `onboarding` (local setup,
the code map, how a request flows, who to ask) and `status-update` (an SCQA
summary, the numbers, workstreams, the decisions being asked for).

Studio's picker gained a filter — searchable by name, description and the block
types a template uses — and the hosted studio understands `?template=<name>`, so
a link opens straight into a prefilled document with no picker in between.
