# Check and fix — step 7 of the procedure

After you create or edit any doc, run the CLI and fix everything it reports.
**A change is not done until `avo check` passes.**

```
avo check                       # validate all docs: schema + dangling refs + dup ids
avo check docs/orders-api.md    # validate one file
avo check --json                # machine-readable, for CI
avo check --strict-prose        # prose warnings become errors
avo preview docs/orders-api.md  # render and open it
avo studio                      # visual Edit, live Site preview, Present
avo build                       # static site (index + nav + cross-doc links) → dist/
avo pdf docs/x.md               # one doc → PDF
avo block <type>                # scaffold a single block
avo template <name>             # scaffold a whole doc (--list for names)
avo demo [family]               # render the built-in block showcase
avo sync openapi spec.yaml --out docs/api.md   # doc from an OpenAPI spec
```

`avo check` exits non-zero on any error and names the file, line, and
offending value. Warnings never fail the check, but read each one: most name a
real problem.

## Error codes

Every diagnostic carries a stable code. Apply the matching fix:

| Code | Meaning | First check |
|---|---|---|
| `E_PARSE_YAML` | YAML body failed to parse. | Re-read *YAML pitfalls* in `writing.md`. Unquoted `,`/`:`/`#` in a `desc` is the usual cause. |
| `E_PARSE_MERMAID` | A ` ```mermaid ` body has a line outside the supported subset; the message names the line. | Compare against `mermaid.md`. Fix the line, or write the block as typed YAML. |
| `E_SCHEMA` | A field is missing, wrong-typed, or unknown; the message contains the path. | Compare against `blocks/contract.md` and the family file. Do not add undocumented fields — the schema is strict. |
| `E_DANGLING_REF` | A `ref` points at an id that exists nowhere. | Fix the ref string, or add the missing `id:` to the target block. |
| `E_DUP_ID` | The same `id:` in two blocks; the message names both. | Ids are repo-global. Rename one. |
| `E_BAD_REF_FORMAT` | A `ref:` is not `doc#id` or `#id` shape. | Match the format; the id slug is `[\w-]+`. |
| `E_UNKNOWN_BLOCK` | A segment claims an unknown block type (rare — unknown fences normally fall through to plain code). | Use exactly one of the documented types (`blocks/INDEX.md`). |

Common `E_SCHEMA` shapes: `Expected string, received number` → quote the
value (`tech: "16"`). `Invalid enum value` → use the documented enum only.
`Unrecognized key(s)` → you added an undocumented field, or an unquoted comma
in a flow-style mapping split a phrase into keys. `meta` fails → it must be
the first block in the file.

## Warning codes

| Code | Meaning | What to do |
|---|---|---|
| `W_EMPTY_BLOCK` | A typed block had an empty body. | Add fields or remove the block. |
| `W_SUSPECT_BLOCK` | A fence tag is within typo distance of a real type (e.g. ` ```sequnce `); it rendered as plain text. | Rename the fence to the suggested type. |
| `W_ALIAS_TYPE` | The fence uses one of the 12 old merged names. It parsed and rendered fine. | Nothing — both spellings work forever. Use the canonical name in new blocks; do not churn existing fences. |
| `W_DENSE_BLOCK` | A diagram is past its density budget. | Split it into two focused blocks. A diagram past its budget reads worse than two. |
| `W_PROSE_*` | A prose rule broke: a paragraph too long, a banned opener, a sentence that restates the block. | Apply the prose rules in `SKILL.md` and `style-ste.md`. Block text fields are exempt from the length cap. |
| `W_DOC_CONVENTION` | The file path breaks the on-disk convention. | See `organizing.md`. Never rename a file only to silence this. |

## The final read

After the check passes, reread only the headings and block titles. The skim
must still tell the story from step 1. Cut any section that reads as filler.
