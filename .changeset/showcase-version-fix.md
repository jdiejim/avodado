---
'avodado': patch
---

Stamp the real CLI version into installed skills, and complete the showcase.

`avo init` / `avo claude` matched the package name `@avodado/cli` when reading
the CLI's own version, but the package is named `avodado`. Every installed
`SKILL.md` therefore carried `version: 0.0.0`. The version now comes from the
same resolver as `avo --version` and the studio's `/api/meta`, which accepts
both spellings. The studio fallback page also told the reader to reinstall
`@avodado/cli`; it now names `avodado`.

The showcase (`docs/reference/showcase.md` and the `avo demo` template) claims
one example of every block type but had none for `spans`, `saga`,
`eventcontract`, or `rollout`. All four are added beside their family
neighbours.
