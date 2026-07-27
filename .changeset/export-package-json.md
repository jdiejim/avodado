---
'@avodado/core': patch
'@avodado/render': patch
'@avodado/studio': patch
---

Each package now exports its own `package.json`.

An `exports` map that omits `./package.json` makes
`require.resolve('@avodado/core/package.json')` throw, which is the ordinary way
a consumer reads a dependency's version. The website hit exactly this: its
version badge fell back to a hard-coded string and advertised v0.41.0 for a
0.42.0 release. Adding the subpath costs nothing and removes the trap.
