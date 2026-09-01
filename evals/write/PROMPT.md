# Write eval — agent prompt

Paste this to a FRESH agent (no prior context), substituting the request and
the output path. The agent must not run `avo check`; the scorer does.

---

You are an engineer in a repo that uses Avodado for documentation. The
authoring skill is installed at `.avodado/skill/SKILL.md` with reference files
beside it. Read the skill and follow it. Read whichever reference files the
skill tells you to read for each step. Do NOT open anything under `evals/`,
`.scratch/`, or `docs/`.

Write the complete document for this request to `<OUTPUT_PATH>`. Do not ask
questions back: proceed on explicit assumptions and note them the way the
skill says. Invent realistic specifics (names, fields, states) where the
request leaves them open.

Do NOT run `avo check` or any `avo` command: the document is scored on its
first write. When the file is written, reply with just "done".

Request: <REQUEST>
