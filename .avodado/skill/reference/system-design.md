# Designing systems — the design method & the architecture blocks

Part of the **avodado-docs** skill (the hub is `SKILL.md`, one folder up). Read
this for any architecture or design ask.

## Designing a system — reason it, don't template it

"Design an X" asks (a notification system, a rate limiter, "how would you build Y
at scale") are where templating shows worst, because every real system's document
is shaped by *its* bottleneck. Do the design reasoning; each step emits the block
that carries it:

1. **Requirements — ask, then pin them down.** Functional (what it does) and
   non-functional (scale, latency, consistency, durability). If the user gave no
   scale or constraints, **ask back** (move 1 of the method in `SKILL.md`; checklists in `intake.md`). Emit `drivers` — each driver a
   real requirement with its consequence, never a platitude.
2. **Envelope math.** Users × actions × fan-out → QPS, storage/day, peak factor.
   Emit `stats` with the numbers that justify the architecture — skip when scale
   genuinely isn't the story.
3. **Contract.** The API surface (`endpoint` per route that matters) and the data
   model (`erd`). These fix the names every later block reuses.
4. **High level, shaped by the dominant motion.** Request/reply system → `c4`;
   things flowing through stages → `event` or `dfd`; deployment/regions/zones →
   `infra`; a k8s estate → `cluster`. One overview diagram of the whole system,
   using the real names from step 3.
5. **Deep-dive the bottleneck — this is where documents differ.** Work out what
   actually breaks at the stated scale, and design *that* section: hot reads →
   caching + invalidation (a `sequence` of the miss path); write spikes → queue +
   backpressure (a `flow` with the shed path); fan-out → push vs pull (`options`,
   then the chosen `sequence`); cross-service consistency → outbox/saga (a
   `state` of the saga); geo-latency → replication + CDN (an `infra` per region).
   One or two deep dives, chosen by the numbers from step 2 — never a fixed list.
6. **Trade-offs on the record.** The genuine alternatives as `options` (with
   `tone: chosen` on the winner), or `proscons` when only one option's tension
   matters. A design doc with no rejected alternative wasn't a decision.
7. **Failure & operations.** What breaks, the blast radius, how it degrades: a
   `table` of failure modes → responses, `kind: error`/`forbidden` edges on the
   diagrams, a `flow` of the degradation path.
8. **Plan.** `timeline` for phasing, `tracker` for the open questions you asked
   in step 1 but didn't get answered.

**Patterns are ingredients, not the meal.** When a named pattern is load-bearing
(pub-sub, saga, circuit breaker, CQRS, …), pull its vetted card + structure
diagram with `avo design <slug>` instead of improvising — then **rename every
node into the user's domain**: a `pattern` card whose participants are still
"ServiceA" was pasted, not designed. Comparing patterns side by side → a
`gallery` with a nested `pattern`/diagram per cell. `avo design` (or `--system` /
`--ai` / `--code`) lists all 106 slugs.

The outline that falls out of steps 1-8 differs per system: a rate limiter's doc
is mostly steps 4-6 with algorithmic depth (`state`, `code`); a social feed's is
dominated by step 5 fan-out math; a payments integration by step 7 failure
semantics. **If two of your design docs share the same section list, you skipped
step 5.**


## Architecture and topology (which one when?)

| If you want to show… | Use | Notes |
|---|---|---|
| Who uses the system + which external systems it depends on | `c4` (level: context) | One node per actor / system |
| Containers inside a system, with optional boundary box | `c4` (level: container) | Use `family` to colour-code (client / service / data / store) |
| Components inside one container | `c4` (level: component) | Same shape, finer granularity |
| Generic boxes-and-arrows architecture | `block` | Grid layout; add `groups` for dashed zones; add `layers` to switch to horizontal-band layout |
| Cloud deployment (CDN, gateway, compute, DB, …) | `infra` | Same engine as `block`; conventionally for cloud topology |
| Pub/sub event topology (producers → topics → consumers) | `event` | Same engine; conventionally for choreography |
| Bounded-context map for DDD | `ddd` | Same engine; conventionally for context maps |
| Security zones with trust boundaries | `network` | Same engine; supports `kind: forbidden` edges (red) |
| Kubernetes-style namespaces with services inside | `cluster` | Has its own nested-box engine; supports `replicas` count |

> `block` / `infra` / `event` / `ddd` / `network` share **one renderer**.
> They differ only by the colored tag pill above the diagram (ARCH / INFRA / EVENT
> / DDD / ZONES). Pick the slug that best signals intent to a reader; the YAML
> grammar is identical.

**Quick mode — no coordinates.** Every architecture diagram can be written as
just nodes + edges: omit `col`/`row` on **all** nodes and the renderer computes a
clean left-to-right layered layout from the edges. This is the default way to
sketch a system fast. Add explicit coordinates only when you want a deliberate
shape — and always when you use `groups` (zones are anchored to grid cells, so
they need placed nodes). If *any* node has coordinates but others don't, the
auto-layout replaces all of them — place all or none.

**Node kinds** (block family; free strings — known ones get a colour + glyph):
`client` · `service`/`microservice`/`compute`/`container` · `worker`/`etl` ·
`db`/`store`/`database` · `bucket`/`blob` · `queue`/`mq`/`broker` · `stream` ·
`cache` · `gateway`/`lb`/`proxy` · `function`/`lambda` · `cdn` · `dns` ·
`waf`/`firewall`/`shield` · `auth`/`idp`/`iam`/`oauth`/`sso` ·
`secrets`/`vault`/`kms` · `monitor`/`metrics`/`logs`/`tracing` ·
`scheduler`/`cron`/`job` · `warehouse`/`lake` · `analytics`/`bi` ·
`search`/`index` · `ml`/`model`/`llm`/`agent` · `vm`/`server`/`host` ·
`user`/`person`/`browser`/`mobile` · `users`/`crowd` · `device`/`iot` ·
`notification`/`webhook` · `email`/`sms` · `ci`/`cicd`/`pipeline` · `git`/`repo`
· `registry` · `config` · `shard`/`sharded` · `replica`/`replicaset` ·
`region`/`geo`/`globe` · `producer`/`topic`/`consumer` · `context` · `external`.
**Vendor names work too**: `postgres`/`mysql`/`mongo`/`dynamo` → db, `s3` →
bucket, `sqs`/`rabbitmq` → queue, `kafka`/`kinesis` → stream,
`redis`/`memcached` → cache, `elasticsearch`/`opensearch` → search. Pick the
closest kind — an unknown kind renders as a neutral box.

**Kinds also pick the shape** (the canonical system-design silhouettes — you get
the right one automatically by choosing the right kind):

| Shape | Kinds |
|---|---|
| cylinder | `db` `database` `store` `postgres` `mysql` `mongo` `dynamo` |
| tiered cylinder | `warehouse` `lake` |
| pail (bucket) | `bucket` `blob` `object` `s3` |
| **sharded trio** (3 small cylinders) | `shard` `shards` `sharded` |
| **replica set** (stacked cylinders) | `replica` `replicas` `replicaset` |
| horizontal cylinder (pipe) | `queue` `topic` `stream` `mq` `broker` `sqs` `rabbitmq` `kafka` `kinesis` |
| cloud | `cdn` `external` |
| hexagon | `gateway` `proxy` |
| octagon | `lb` |
| instance stack (receding cards) | `cache` `redis` `memcached` `worker` `etl` |
| server rack (stacked slabs) | `vm` `server` `host` |
| shield | `waf` `firewall` `shield` |
| actor figure (boxless) | `user` `person` `actor` |
| crowd (overlapping figures) | `users` `crowd` |
| browser window | `browser` `web` |
| phone frame | `mobile` |
| circle with ƒ | `function` `lambda` |
| calendar with clock badge | `scheduler` `cron` `job` |
| padlock | `secrets` `vault` `kms` |
| globe (boxless) | `region` `geo` `globe` |
| clean rounded card + glyph | everything else |

The same silhouettes apply inside `felogic`/`belogic` (db/store → cylinder,
queue/bus/broker → pipe, cache → stack, external/backend/api → cloud), in `c4`
(`kind: store` → cylinder), and in `cluster` (db services → cylinder) — a
database looks like a database in every diagram.

**C4 extras.** Edges take `tech:` — rendered as `label [tech]`, the C4
convention for the protocol. `boundaries[]` draws several named dashed boxes,
each fitted around an explicit `nodes: [ids]` list (optional `color`) — so one
diagram shows your platform and a partner's estate side by side. The single
auto-fit `boundary:` still works for one system.

**Mixing architecture views — one overview + one zoom.** Show the whole system
once (`c4` context, or a `block`/`infra` landscape), then zoom into the one or
two places the doc is actually about: `belogic`/`felogic` for a module's
internals, `infra`/`cluster` for deployment, a `sequence` for the runtime of one
path. Never redraw the same boxes in a second engine — pick one block per level
of zoom and stitch them with prose ("inside the `api` container: …").

## Pattern templates — the `avo design` slug list

> **Don't hand-write a pattern from memory — grab a vetted template.** Avodado
> ships a library of common patterns (system-design building blocks *and* the GoF
> code patterns). Run `avo design` to list them, then `avo design <slug>` to get a
> ready template — a `pattern` card **plus a structure diagram** (`belogic` with
> interface/impl stereotypes for code, `block` with glyphs for system) — to adapt
> (or `avo design <slug> -o docs/x.md`).
> Slugs include: **system design** — `caching` `load-balancing` `cdn` `sharding`
> `replication` `rate-limiting` `message-queue` `pub-sub` `cqrs` `event-sourcing`
> `api-gateway` `circuit-breaker` `consistent-hashing` `idempotency` `saga`
> `leader-election` `bloom-filter` `write-ahead-log` `outbox` `sidecar`
> `service-discovery` `blue-green-deploy` `backpressure` `feed-fanout`
> `distributed-lock` `heartbeat` `quorum` `cdc` `webhooks` `oauth2`
> `cicd-pipeline` `two-phase-commit` `geohashing` `event-driven` `microservices`
> `event-streaming` `service-mesh` `strangler-fig` `bff` `scatter-gather`
> `dead-letter-queue` `database-per-service` `lambda-architecture` `async-write`
> `failover` `indexing` `retry-backoff` `bulkhead` `timeout` `cache-aside`
> `throttling` `actor-model` `producer-consumer` `thread-pool`
> `competing-consumers` `splitter-aggregator`;
> **AI / agents** — `rag` `react` `tool-use` `prompt-chaining` `routing`
> `reflection` `multi-agent` `guardrails` `memory` `evaluator-optimizer`
> `parallelization` `augmented-llm` `plan-and-execute` `human-in-the-loop`
> `agentic-rag` `swarm-handoff` `chain-of-thought` `context-compaction`;
> **code (GoF + architecture)** — `factory-method` `abstract-factory` `builder`
> `prototype` `singleton` `adapter` `bridge` `composite` `decorator` `facade`
> `flyweight` `proxy` `chain-of-responsibility` `command` `iterator` `mediator`
> `memento` `observer` `state` `strategy` `template-method` `visitor`
> `interpreter` `mvc` `mvvm` `dependency-injection` `unit-of-work`
> `active-record` `data-mapper` `event-bus` `specification` `null-object`. Each template is a
> `pattern` card **plus a structure diagram** chosen to fit (UML class diagram
> for code; `block`/`flow`/`state`/`sequence` for system & AI). `avo design -p`
> (or `--system` / `--ai` / `--code`, `-s` for slides) opens the gallery. When the user names a
> known pattern, prefer the template over improvising, then tailor it.
