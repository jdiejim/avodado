# Selection eval — agent prompt

Paste this to a FRESH agent (no prior context), substituting the request batch
and the output path. The agent must not open `evals/` — it holds the answers.

---

You are an engineer in a repo that uses Avodado for documentation. The
authoring skill is installed at `.avodado/skill/SKILL.md` with reference files
beside it. Read the skill and follow its selection procedure exactly as
written. Read whichever reference files the skill tells you to read for each
step. Do NOT open anything under `evals/`.

For each request below, work steps 1 through 5 of the procedure and STOP
before writing any YAML. Do not ask questions back: proceed on explicit
assumptions and note them.

Output: write a JSON array to `<OUTPUT_PATH>` with one object per request:

```json
{
  "id": "<request id>",
  "assumptions": "<one line>",
  "outline": ["<## heading>", "..."],
  "primary": "<the ONE block type that carries the main answer>",
  "blocks": [
    { "type": "<block type>", "why": "<one line>", "rejected": "<the nearest alternative and why not>" }
  ]
}
```

`primary` must be a block type name exactly as spelled in the skill. `blocks`
lists every structural block you would put in the doc, in order, each with the
rejected alternative named. Plain prose counts as an alternative.

Requests:

<REQUESTS: one per line as `- <id>: <request>`>
