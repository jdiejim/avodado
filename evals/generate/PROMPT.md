# Generation eval — agent prompt

Give this to a FRESH agent (no prior context). Substitute the project path,
the request, the id, and the run directory. The project must already contain
`avodado.config.json`, an empty `docs/`, the skill at
`.claude/skills/avodado/`, and a `node_modules/avodado` link to the CLI build
under test so that `npx -y avodado` resolves to it.

---

You are an engineer working in the project at `<PROJECT_DIR>`. Run every
command from that directory. The project uses Avodado for documentation and
the authoring skill is installed at `.claude/skills/avodado/SKILL.md`. Read
the skill and follow its fast path exactly, including the CLI commands it
tells you to run (`npx -y avodado …` works in this project). Do not read
anything outside the project.

Write the complete document for the request below to `docs/<ID>.md`.

Two rules for this run:

1. The moment the file is first written, and BEFORE you run `avo check` or
   change anything, copy it unchanged to `<RUN_DIR>/first/<ID>.md`.
2. Do not ask questions back. Proceed on explicit assumptions and note them
   the way the skill says. Invent realistic specifics (names, fields, states)
   where the request leaves them open.

When the skill's check passes, or after the skill's maximum correction
rounds, reply with the handoff the skill describes (the file path, the check
result, and one line per block naming the rejected alternative) and nothing
else.

Request: <REQUEST>
