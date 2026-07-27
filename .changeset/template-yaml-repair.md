---
'@avodado/core': patch
---

Repaired flow-mapping values in the new templates that swallowed the keys after them.

An unquoted YAML flow value containing a comma absorbs everything up to the
closing brace, so `mitigation: Rehearsed twice, owner: Orders` parsed as one
long `mitigation` string with no owner and no status. Every field involved is
optional, so it validated cleanly and only showed up in the rendered document —
a sequence message losing its `kind`, a risk row losing its owner.

Twenty-six rows across seven templates are fixed, and a test now rejects the
pattern at the source rather than waiting for someone to notice the render.
