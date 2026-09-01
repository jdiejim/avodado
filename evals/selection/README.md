# Block-selection eval

Measures whether an agent that follows the authoring skill picks the block by
the reader's question or by keyword. Thirty requests in `requests.yaml`, none
naming a block type, each with the expected shapes and the tempting wrong
picks.

## Run

1. Split `requests.yaml` into batches of five.
2. For each batch, start a fresh agent with `PROMPT.md`, the batch, and an
   output path under a run directory (for example
   `.scratch/evals/<run-name>/batch-1.json`).
3. Score:

```
node evals/selection/score.mjs .scratch/evals/<run-name>
node evals/selection/score.mjs .scratch/evals/before .scratch/evals/after
```

## Read the score

- `score` is the sum over requests: 1 for an expected shape, 0.5 for an
  acceptable one, 0 otherwise.
- `traps` counts primaries that landed on a tempting wrong pick. This is the
  keyword-matching signal. A skill change that raises `score` but also raises
  `traps` made the model more confident, not better.
- `justified` counts requests where every chosen block named its rejected
  alternative. The skill makes this mandatory.

Keep the request set stable. A changed request invalidates every earlier run.
Add new requests at the end of the file.
