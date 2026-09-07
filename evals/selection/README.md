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
- `structure` counts how many distinct block-type sequences the run produced,
  after stripping the chrome every doc shares (`meta`, `callout`, `prose`,
  `divider`, `takeaways`). Two different requests that yield the same ordered
  block list were templated, not designed; each collision is printed with the
  ids that share it. This is the measure that says whether the agent composes.

  A collision is a **screening result, not a verdict**. Block types are a
  coarse signal: two genuinely similar questions can reach for the same two
  types and still produce different documents. Open both answers and compare
  the outlines and the per-block reasons before calling it templating. On
  2026-09-06, `prod-request-path` and `zones-and-replicas` both came out as
  `block > table` and were cleared on inspection — one drew an `infra` preset
  hop chain with per-hop timeouts, the other a `k8s` preset nested by region
  and zone with a zone-loss table, and they shared no heading.

## Results

| Run | Requests | Score | Traps | Justified | Distinct structures |
|---|---|---|---|---|---|
| `before` (skill pre-split) | 30 | 29/30 | 0 | 30/30 | 29 of 30 |
| `after` (skill split) | 30 | 28.5/30 | 1 | 30/30 | 30 of 30 |
| `sep06` (94 blocks) | 37 | 36.5/37 | 0 | 37/37 | 36 of 37 |

The seven requests added on 2026-09-06 cover the new block types and include
two traps (a request that sounds like a trace but wants `sequence`, one that
sounds like a saga but wants `steps`). All seven were answered correctly.

Keep the request set stable. A changed request invalidates every earlier run.
Add new requests at the end of the file.
