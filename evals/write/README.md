# Write eval

Measures the writing surface: a fresh agent writes a complete doc for a
request, and `avo check` scores it. Pairs with `evals/selection` (which
scores only the block choice).

Six requests from the selection set, chosen because their primary block is a
diagram (`sequence`, `state`, `erd`, `flow`, `dfd`, `c4`/`block`):

| id | request |
|---|---|
| webhook-twice | Document what happens when a Stripe payment webhook arrives twice for the same order. |
| order-lifecycle | Show how an order moves from cart to delivered and what can go wrong at each stage. |
| billing-model | Explain the data model behind subscriptions, plans, invoices, and payments. |
| login-flow | How the login flow works across the SPA, the auth service, and Google. |
| pii-flow | Where do PII fields flow through the system, from ingestion to the warehouse? |
| platform-shape | Explain the shape of the platform to a new backend engineer: services, databases, third parties. |

## Run

1. For each request, start a fresh agent with `PROMPT.md`, the request, and
   an output path `<run-dir>/<id>.md`. Record the agent's token count and
   tool-call count from the task notification into `<run-dir>/usage.json`
   as `{ "<id>": { "tokens": N, "tools": N } }`.
2. Score:

```
node evals/write/score.mjs .scratch/evals/write-before .scratch/evals/write-after
```

## Read the score

Per doc: errors and warnings from `avo check` on the agent's FIRST write
(the agent may not run `avo check` itself, so the number is the raw
first-try quality), block count, `mermaid` fence count, and tokens. A good
change lowers errors and tokens without lowering block count.
