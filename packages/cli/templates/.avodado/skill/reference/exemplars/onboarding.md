```meta
title: Ingest team — week one
subtitle: What a new engineer sets up, reads, and ships in the first five days.
tag: Onboarding
```

Nocturne's ingest tier accepts 2.1M spans per second across three regions.
This team owns the gateway, the sampler, and the Kafka topics between them.
The week has one goal: ship a guarded sampler-config change to staging by
Friday, with your own hands on every step.

## Who to ask

```team
id: ex-onboarding-people
members:
  - { name: Priya Nair, role: Tech lead, focus: "Sampler, capacity planning", accent: navy }
  - { name: Jonas Weber, role: SRE, focus: "Gateway, on-call rotation, staging access", accent: teal }
  - { name: Mel Torres, role: Backend, focus: "Kafka topics, schema registry", accent: purple }
  - { name: "#ingest-help", initials: IH, role: Slack channel, focus: First stop for any question — median answer 11 minutes, accent: green }
```

## Day one — local stack

```steps
id: ex-onboarding-setup
items:
  - title: Clone and bootstrap
    body: Bootstrap installs the pinned toolchain and takes about 15 minutes on first run.
    code: git clone git@github.com:nocturne/ingest.git && make bootstrap
    lang: bash
  - title: Start the local stack
    body: "Gateway, sampler, and a single-broker Kafka run in Docker."
    code: make stack-up
    lang: bash
  - title: Run the smoke test
    body: The test pushes 400 synthetic spans end to end and checks the drop-rate counter.
    code: make smoke
    lang: bash
    note: "A red smoke test on a clean clone is a bug — report it in #ingest-help the same day."
  - title: Request staging access
    body: Request the "ingest-staging-rw" role in the access portal. Jonas approves same day.
```

```callout
id: ex-onboarding-replay
tone: warn
title: Replay targets staging only
body: "`make replay` re-sends captured traffic. A production broker accepts replayed spans as real tenant data, and they land in customer dashboards. Check the `KAFKA_BROKERS` value before every replay."
```

## The week

```timeline
id: ex-onboarding-week
items:
  - "[done] Day 1 · Local stack · Smoke test green; staging access requested"
  - "[done] Day 2 · Read path · Pair with Mel and follow one span from gateway to sampler"
  - "[current] Day 3 · Shadow on-call · Sit in on Jonas's handover; read the two latest incident docs"
  - "[next] Day 4 · First change · Raise tail sampling for the demo tenant behind ingest.sampler.demo_rate"
  - "[next] Day 5 · Ship it · Flag on in staging; watch the drop-rate dashboard for one hour"
```

Day 4's change is deliberately trivial. The point is the path — flag,
review, staging deploy, dashboard — not the diff, so that your first urgent
change is not also your first deploy.

## Vocabulary

```glossary
id: ex-onboarding-terms
terms:
  - Span — one timed operation; the unit everything on this team counts.
  - Drop rate — spans the sampler discards as a share of spans received; the team's headline SLI.
  - Head sampling — keep/drop decided at the gateway, before the trace is complete.
  - Tail sampling — decided in the sampler once the full trace arrives; costs memory, saves storage.
  - Tenant — one customer's isolated stream; every dashboard and quota is per-tenant.
```
