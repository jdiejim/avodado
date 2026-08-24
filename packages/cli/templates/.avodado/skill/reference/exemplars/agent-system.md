```meta
title: Reconciliation agent
subtitle: How Caravel Freight's agent matches carrier invoices to shipments — the loop, the window, one real run.
tag: Agent system · v2
```

Caravel Freight books about 9,000 ocean and air shipments a month. Carriers
invoice 1,400 line items a week, and roughly 30% disagree with the quoted
rate. The agent proposes a match and a verdict per line; a billing clerk
approves every proposal. The agent has no path to the ledger.

## The loop

```agentloop
id: ex-agent-system-loop
agent:
  name: Reconciliation agent
  model: claude-sonnet-4-6
  note: One invoice line per episode.
env: Invoice queue
tools:
  - { name: get_shipment, desc: "Booking, lane, and quoted rate" }
  - { name: search_rate_card, desc: Contract rate for a lane and sail date }
  - { name: get_invoice_history, desc: "The carrier's past corrections" }
  - { name: post_proposal, desc: Write match + verdict to the review queue }
  - { name: escalate, desc: Send the line to a clerk with a reason }
memory:
  - carrier correction history
  - verdicts on earlier lines
stop: proposal posted or line escalated
```

Three conditions force `escalate` instead of a proposal: no booking
reference resolves, the rate delta exceeds $400, or the invoice currency
differs from the contract currency. Everything else — 68% of lines — ends in
a posted proposal.

## Window budget

```context
id: ex-agent-system-window
window: 100000
segments:
  - { label: system prompt, tokens: 3500, accent: navy }
  - { label: tool schemas, tokens: 4500, accent: teal }
  - { label: invoice line + OCR text, tokens: 9000, accent: amber }
  - { label: shipment record, tokens: 6000, accent: blue }
  - { label: rate-card excerpt, tokens: 12000, accent: purple, desc: top-3 matching lanes only }
  - { label: carrier history, tokens: 15000, accent: green }
```

The free 50,000 tokens are the episode's working room — tool results and
retries append there. Carrier history is evicted first when a long episode
fills the window. That is safe because history only tunes the verdict
wording; the match depends on the shipment record and the rate card, which
are never evicted.

## One real run

```trace
id: ex-agent-system-run
turns:
  - role: user
    text: "Invoice CMA-88231-04 · Shanghai → Rotterdam · 2 × 40HC · $4,120"
  - role: assistant
    thinking: The quoted rate lives on the booking. Fetch the shipment before touching the rate card.
    text: Resolving booking CV-59107 for this line.
  - role: tool
    tool: get_shipment
    args: '{ "booking": "CV-59107" }'
    result: "2 × 40HC · lane CNSHA→NLRTM · quoted $3,890 all-in · sailed 2026-07-14"
  - role: tool
    tool: search_rate_card
    args: '{ "lane": "CNSHA-NLRTM", "date": "2026-07-14" }'
    result: "timeout after 10s"
  - role: assistant
    thinking: One retry is allowed on timeout; escalating on a transient error wastes a clerk's time.
    text: Rate-card lookup timed out — retrying once.
  - role: tool
    tool: search_rate_card
    args: '{ "lane": "CNSHA-NLRTM", "date": "2026-07-14" }'
    result: "contract $3,890 per pair · valid through 2026-09-30 · no peak surcharge clause"
  - role: assistant
    text: "Invoice exceeds contract by $230 with no surcharge clause in force. Proposing: match to CV-59107, dispute $230."
  - role: tool
    tool: post_proposal
    args: '{ "booking": "CV-59107", "verdict": "dispute", "amount": 230 }'
    result: "queued for review · PR-20441"
```

## Eight weeks in production

```stats
id: ex-agent-system-outcomes
stats:
  - { value: 68%, label: Lines auto-proposed, delta: "+68pp vs manual", trend: up }
  - { value: 45s, label: Clerk time per line, delta: "-87%", trend: down }
  - { value: 0.4%, label: Proposals reversed after approval, trend: flat }
  - { value: $18k, label: Disputed overcharges recovered / month, trend: up }
```

Reversals are the number to watch: each one means a clerk approved a wrong
verdict. That makes 0.4% the agent's real error rate as the business sees
it.

## The boundary

```callout
id: ex-agent-system-boundary
tone: danger
title: Propose, never post
body: "`post_proposal` writes to the review queue only. Ledger writes require a clerk's approval click, and the agent's service account holds no ledger credential — the boundary is IAM, not prompt text."
```
