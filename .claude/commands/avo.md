---
description: Avodado docs — audit the repo for doc gaps, author one doc, or validate all docs.
---

# /avo — Avodado documentation

The first word of $ARGUMENTS selects the mode: `audit`, `doc`, or `check`.
For any other word, or for no word, print this usage block and stop:

```
/avo audit [path] [--full]   audit the codebase; pick docs from a menu; author them
/avo doc <target>            author one doc about a path, module, or feature
/avo check                   validate all docs; fix errors; explain open warnings
```

## audit [path] [--full]

### Step 1 — run the audit

Run `avo audit <path> --json`. Omit `<path>` when the user gave none.
If `avo` is not on PATH, run `npx -y avodado audit <path> --json`.
The JSON carries `recommendations`, `evidence`, and sometimes a `notice`.
If the JSON has a `notice`, show it to the user verbatim.

### Step 2 — present the menu

The menu comes from the JSON only. Never invent a recommendation the audit
did not emit. If `recommendations` is empty, report that and stop.

Present the recommendations with AskUserQuestion as a multi-select menu:

- Label: the recommendation's `title`.
- Description: the `rationale`, the `confidence`, and the top `citations`.

If the user passed `--full`, preselect every recommendation. Still confirm
the selection with the picker.

### Step 3 — author each selected doc

Follow the avodado-docs skill's seven-step selection procedure for each doc.
The recommendation's `citations` are the mandatory reading list: read every
cited file before you write. Never guess what an evidence file contains.
Place each doc under `docs/`, where the skill's organizing rules say.

### Step 4 — validate

Run `avo check` on everything you wrote. Fix every diagnostic.
Repeat the check until it passes.

### Step 5 — report

List the docs you wrote. Give one summary line for each doc.

## doc <target>

`<target>` is a path, a module, or a feature name.

1. Read the target's code first.
2. Author one doc about the target. Follow the avodado-docs skill's
   seven-step selection procedure.
3. Run `avo check` before you finish. Fix every diagnostic.

## check

1. Run `avo check`.
2. Fix every error.
3. For each warning you do not fix, explain why you left it.
