# Design patterns — which blocks document them

Part of the **avodado** skill (the hub is `SKILL.md`, one folder up). Read
this when the request names a design pattern or asks "how is X structured".
Every pattern here is the same stack, in this order:

1. `pattern` — the card: intent, forces, participants, consequences. One
   per pattern, always first.
2. `uml` — the structure: participants as classes, the relation `kind`
   carrying the meaning (`implements` for the interface, `composition` for
   ownership, `dependency` for a call).
3. `sequence` — the behaviour, only when the order of calls IS the pattern.
4. `code` — the smallest real example, when the doc is for implementers.

Fields: `avo block pattern`, `avo block uml`. Never draw a pattern as a
`flow`: a pattern is a set of roles and their relations, not a procedure.

## Gang of Four

| Pattern | The structural fact `uml` must show | Add |
|---|---|---|
| Singleton | one class, a private constructor, a static `instance()` | — |
| Factory Method | creator ↔ product interfaces, concrete pairs `implements` | — |
| Abstract Factory | one factory interface, one family per concrete factory | `table` of families × products |
| Builder | director `dependency` builder; builder `implements`; product built | `sequence` (build steps) |
| Prototype | `clone()` on the interface, concretes `implements` | — |
| Adapter | client → target interface; adapter `implements` target, `composition` adaptee | — |
| Bridge | abstraction `composition` implementor; both have hierarchies | — |
| Composite | component interface; leaf and composite `implements`; composite `composition` component (the self-reference) | `tree` of a real instance |
| Decorator | decorator `implements` component AND `composition` component | `sequence` (the wrapping chain) |
| Facade | facade `dependency` on each subsystem class; client sees one | `c4` component when it is a service boundary |
| Flyweight | factory returns shared intrinsic state; extrinsic passed in | `envelope` (memory saved) |
| Proxy | proxy `implements` subject, `composition` real subject | `sequence` (lazy load / access check) |
| Chain of Responsibility | handler `composition` next handler (self) | `sequence` (one request through the chain) |
| Command | command interface; invoker `composition` command; receiver | `sequence` (undo) |
| Interpreter | expression interface; terminal / non-terminal `implements` | `tree` (a parsed expression) |
| Iterator | iterator interface; aggregate creates it | — |
| Mediator | colleagues `dependency` mediator, never each other | `sequence` |
| Memento | originator creates memento; caretaker `composition` memento | `sequence` (save / restore) |
| Observer | subject `composition` observers; `notify()` | `sequence` (one change, N updates); at system scale → `reference/patterns.md` pub/sub |
| State | context `composition` state; concretes `implements` | `state` (the machine itself) |
| Strategy | context `composition` strategy interface; concretes `implements` | `options` when the choice of strategy is the decision |
| Template Method | abstract class with the skeleton; hooks overridden in subclasses | `steps` (the fixed order) |
| Visitor | visitor interface with one `visit` per element; elements `accept` | `matrix` of visitors × elements |

## Architectural and distributed

| Pattern | Stack | Trap |
|---|---|---|
| Layered / Clean / Hexagonal | `pkg` (allowed `deps` between layers, `dependency` arrows only inward) → `block` for the runtime | `c4` alone hides the dependency rule |
| Repository / Unit of Work | `uml` (interface + implementation) → `sequence` for one transaction | `erd` (that is the data, not the pattern) |
| CQRS, Event sourcing, Saga, Outbox | `reference/patterns.md` | — |
| Circuit breaker, Retry, Bulkhead | `state` (closed → open → half-open) or `timing` (breaker vs downstream over time) → `spec` for the numbers | prose only |
| Cache-aside / Read-through | `sequence` with an `alt` (hit / miss) → `spec` for TTL and invalidation | `flow` |
| Sidecar / Ambassador | `cluster` or `block` (`preset: k8s`) with the sidecar in the pod | — |
| Strangler fig | `block` (facade in front of legacy + new) → `roadmap` for the migration by theme | `timeline` |
| BFF (backend for frontend) | `c4` container view with one BFF per client → `endpoint` per BFF | — |
| Microkernel / Plugin | `pkg` (core + plugin packages, `deps` inward) → `uml` for the plugin interface | — |
| Pipes and filters | `flow` (`variant: dag`) → `dfd` when data shape matters | `sequence` |
