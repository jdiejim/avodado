/**
 * `avo design` — a library of the most common **design patterns**, both
 * system-design building blocks (caching, sharding, CQRS, …) and the GoF code
 * patterns (Strategy, Observer, Adapter, …). Each entry is structured data that
 * serializes to a ready Avodado `pattern` block, so an agent (or a human) can
 * `avo design <slug>` to grab a correct template and adapt it.
 *
 * Curated from common references:
 *   - System design: https://www.hellointerview.com/learn/system-design/in-a-hurry/introduction
 *   - Code patterns: https://refactoring.guru/design-patterns
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runSingle, type SingleFormat, type SingleResult } from './single.js';

/** A pattern category. The three GoF families plus system design. */
export type DesignCategory =
  | 'System design'
  | 'AI / agents'
  | 'Creational'
  | 'Structural'
  | 'Behavioral';

/** One design pattern, as structured data (serialized to a `pattern` block). */
export interface DesignPattern {
  readonly slug: string;
  readonly name: string;
  readonly category: DesignCategory;
  /** One-liner for the `avo design` list. */
  readonly summary: string;
  readonly intent: string;
  readonly forces: readonly string[];
  readonly participants: ReadonlyArray<{ readonly name: string; readonly role: string }>;
  readonly pros: readonly string[];
  readonly cons: readonly string[];
}

/** True for the GoF code-pattern families. */
const isGof = (c: DesignCategory): boolean =>
  c === 'Creational' || c === 'Structural' || c === 'Behavioral';

// ─── the library ─────────────────────────────────────────────────────────────

const SYSTEM: readonly DesignPattern[] = [
  {
    slug: 'caching',
    name: 'Caching',
    category: 'System design',
    summary: 'Keep hot data in a fast layer to cut latency and database load.',
    intent: 'Serve frequently-read data from a fast store so the origin is hit less often.',
    forces: ['Reads vastly outnumber writes', 'Origin is slow or expensive', 'Some staleness is acceptable'],
    participants: [
      { name: 'Client / Service', role: 'reads through the cache first' },
      { name: 'Cache (e.g. Redis)', role: 'in-memory key/value store with a TTL' },
      { name: 'Origin store', role: 'source of truth on a miss' },
    ],
    pros: ['Big latency + load reduction', 'Cheap horizontal read scaling'],
    cons: ['Staleness + invalidation complexity', 'Thundering herd / cache stampede on miss'],
  },
  {
    slug: 'load-balancing',
    name: 'Load balancing',
    category: 'System design',
    summary: 'Spread incoming traffic across many servers for scale and resilience.',
    intent: 'Distribute requests across a pool so no single instance is overwhelmed.',
    forces: ['Traffic exceeds one box', 'Instances fail', 'Need even utilization'],
    participants: [
      { name: 'Load balancer', role: 'routes by round-robin / least-connections / hashing' },
      { name: 'Server pool', role: 'interchangeable stateless instances' },
      { name: 'Health checks', role: 'remove unhealthy instances from rotation' },
    ],
    pros: ['Horizontal scale', 'Fault tolerance + zero-downtime deploys'],
    cons: ['Another tier to run', 'Sticky sessions complicate statelessness'],
  },
  {
    slug: 'cdn',
    name: 'Content delivery network',
    category: 'System design',
    summary: 'Serve static (and cacheable) content from edge nodes near users.',
    intent: 'Cache assets at the edge so users fetch from a nearby PoP, not the origin.',
    forces: ['Global users', 'Heavy static assets', 'Origin bandwidth is costly'],
    participants: [
      { name: 'Edge PoP', role: 'caches and serves content close to the user' },
      { name: 'Origin', role: 'authoritative source on a miss' },
      { name: 'Cache-Control / TTL', role: 'governs freshness + invalidation' },
    ],
    pros: ['Low global latency', 'Offloads origin bandwidth'],
    cons: ['Invalidation lag', 'Less suited to highly dynamic content'],
  },
  {
    slug: 'sharding',
    name: 'Sharding (partitioning)',
    category: 'System design',
    summary: 'Split a dataset across nodes by a partition key so it scales past one box.',
    intent: 'Horizontally partition data by key so each node owns a slice of the keyspace.',
    forces: ['Data + write volume exceed one node', 'Need parallel throughput'],
    participants: [
      { name: 'Shard key', role: 'determines which node owns a row' },
      { name: 'Router', role: 'maps a key to its shard' },
      { name: 'Shards', role: 'independent stores each holding a subset' },
    ],
    pros: ['Scales writes + storage horizontally', 'Smaller per-node working set'],
    cons: ['Cross-shard queries + transactions are hard', 'Hot keys cause skew; resharding is painful'],
  },
  {
    slug: 'replication',
    name: 'Replication',
    category: 'System design',
    summary: 'Copy data to replicas for read scaling and failover.',
    intent: 'Maintain copies of data on multiple nodes for availability and read throughput.',
    forces: ['Reads dominate', 'Must survive node loss', 'Tolerate some replica lag'],
    participants: [
      { name: 'Primary (leader)', role: 'accepts writes' },
      { name: 'Replicas (followers)', role: 'serve reads, take over on failover' },
      { name: 'Replication stream', role: 'ships changes async or sync' },
    ],
    pros: ['Read scaling', 'High availability + durability'],
    cons: ['Replica lag → stale reads', 'Failover + split-brain handling'],
  },
  {
    slug: 'rate-limiting',
    name: 'Rate limiting',
    category: 'System design',
    summary: 'Cap how many requests a client may make to protect the system.',
    intent: 'Throttle per-client request rate to prevent abuse and overload.',
    forces: ['Abuse / spikes threaten stability', 'Fair sharing across tenants'],
    participants: [
      { name: 'Limiter', role: 'token-bucket / sliding-window counter per client' },
      { name: 'Counter store', role: 'usually Redis, for shared counts' },
      { name: 'Policy', role: 'limits + 429 response with Retry-After' },
    ],
    pros: ['Protects against overload + abuse', 'Enforces fair multi-tenant usage'],
    cons: ['Distributed counting is tricky', 'Too-tight limits hurt legit users'],
  },
  {
    slug: 'message-queue',
    name: 'Message queue',
    category: 'System design',
    summary: 'Decouple producers from consumers with durable async work.',
    intent: 'Buffer work in a queue so producers and consumers scale independently.',
    forces: ['Spiky load', 'Slow / unreliable downstream', 'Work can be deferred'],
    participants: [
      { name: 'Producer', role: 'enqueues a message and moves on' },
      { name: 'Queue (e.g. SQS)', role: 'durably holds messages' },
      { name: 'Consumer / worker', role: 'pulls and processes, acks on success' },
    ],
    pros: ['Absorbs spikes (back-pressure)', 'Decoupling + retry/DLQ resilience'],
    cons: ['Eventual consistency', 'At-least-once → need idempotent consumers'],
  },
  {
    slug: 'pub-sub',
    name: 'Publish / subscribe',
    category: 'System design',
    summary: 'Fan one event out to many independent subscribers.',
    intent: 'Broadcast events to all interested consumers without the producer knowing them.',
    forces: ['Many reactions to one event', 'Producers must not depend on consumers'],
    participants: [
      { name: 'Publisher', role: 'emits events to a topic' },
      { name: 'Topic / broker', role: 'fans out to subscriptions' },
      { name: 'Subscribers', role: 'each receive their own copy' },
    ],
    pros: ['Loose coupling', 'Easy to add new consumers'],
    cons: ['Hard to trace flows', 'Ordering + duplicate delivery concerns'],
  },
  {
    slug: 'cqrs',
    name: 'CQRS',
    category: 'System design',
    summary: 'Separate the write model from the read model.',
    intent: 'Use distinct models for commands (writes) and queries (reads), optimized separately.',
    forces: ['Reads and writes have very different shapes/scale', 'Complex domain writes'],
    participants: [
      { name: 'Command side', role: 'validates + applies writes to the write store' },
      { name: 'Query side', role: 'denormalized read models for fast queries' },
      { name: 'Projector', role: 'updates read models from write events' },
    ],
    pros: ['Independently scalable + tunable read/write', 'Read models fit the UI'],
    cons: ['More moving parts', 'Eventual consistency between sides'],
  },
  {
    slug: 'event-sourcing',
    name: 'Event sourcing',
    category: 'System design',
    summary: 'Persist state as an append-only log of events, not the current row.',
    intent: 'Store every change as an immutable event; rebuild state by replaying them.',
    forces: ['Need a full audit trail', 'Want temporal queries / replay', 'Pairs well with CQRS'],
    participants: [
      { name: 'Event store', role: 'append-only log, the source of truth' },
      { name: 'Aggregate', role: 'folds events into current state' },
      { name: 'Projections', role: 'derive read models from the stream' },
    ],
    pros: ['Complete audit + time travel', 'Rebuild/replay into new models'],
    cons: ['Schema evolution of events is hard', 'Higher complexity; snapshots needed'],
  },
  {
    slug: 'api-gateway',
    name: 'API gateway',
    category: 'System design',
    summary: 'A single entry point handling routing, auth, and rate limiting.',
    intent: 'Front many services with one edge that cross-cuts auth, routing, and limits.',
    forces: ['Many backend services', 'Shared concerns (auth, TLS, limits)', 'Clients want one endpoint'],
    participants: [
      { name: 'Gateway', role: 'routes, authenticates, rate-limits, aggregates' },
      { name: 'Backend services', role: 'focus on business logic' },
      { name: 'Client', role: 'talks to one stable endpoint' },
    ],
    pros: ['Centralizes cross-cutting concerns', 'Decouples clients from topology'],
    cons: ['Potential bottleneck / SPOF', 'Can become a god-object'],
  },
  {
    slug: 'circuit-breaker',
    name: 'Circuit breaker',
    category: 'System design',
    summary: 'Stop calling a failing dependency to prevent cascading failures.',
    intent: 'Trip open after repeated failures so a sick dependency cannot drag the caller down.',
    forces: ['Downstream can fail/slow', 'Retries amplify outages', 'Need fast failure'],
    participants: [
      { name: 'Breaker', role: 'closed → open → half-open state machine' },
      { name: 'Caller', role: 'checks the breaker before each call' },
      { name: 'Fallback', role: 'degraded response while open' },
    ],
    pros: ['Stops cascading failures', 'Fast-fail + automatic recovery probing'],
    cons: ['Tuning thresholds is tricky', 'Fallbacks add complexity'],
  },
  {
    slug: 'consistent-hashing',
    name: 'Consistent hashing',
    category: 'System design',
    summary: 'Map keys to nodes so adding/removing a node reshuffles few keys.',
    intent: 'Place keys and nodes on a hash ring so membership changes move minimal data.',
    forces: ['Cluster membership changes often', 'Avoid mass rehash on resize'],
    participants: [
      { name: 'Hash ring', role: 'positions nodes + keys on the same space' },
      { name: 'Virtual nodes', role: 'even out load per physical node' },
      { name: 'Keys', role: 'go to the next node clockwise' },
    ],
    pros: ['Minimal reshuffling on scale', 'Smooth load with vnodes'],
    cons: ['More complex than modulo hashing', 'Hot keys still need handling'],
  },
  {
    slug: 'idempotency',
    name: 'Idempotency',
    category: 'System design',
    summary: 'Make retried requests safe so duplicates have no extra effect.',
    intent: 'Let a client safely retry by deduplicating on an idempotency key.',
    forces: ['Networks retry', 'At-least-once delivery', 'Double-charge must not happen'],
    participants: [
      { name: 'Idempotency key', role: 'unique per logical operation' },
      { name: 'Key store', role: 'records first result for replays (with TTL)' },
      { name: 'Handler', role: 'returns the stored result on a repeat' },
    ],
    pros: ['Safe retries', 'No duplicate side effects'],
    cons: ['Key storage + TTL to manage', 'Care with concurrent same-key requests'],
  },
  {
    slug: 'saga',
    name: 'Saga (distributed transaction)',
    category: 'System design',
    summary: 'Coordinate a multi-service transaction via compensating actions.',
    intent: 'Run a sequence of local transactions, compensating earlier steps if a later one fails.',
    forces: ['No distributed 2PC across services', 'Must keep services consistent enough'],
    participants: [
      { name: 'Saga steps', role: 'each a local transaction with a compensator' },
      { name: 'Orchestrator / choreography', role: 'drives the sequence' },
      { name: 'Compensations', role: 'undo completed steps on failure' },
    ],
    pros: ['Consistency without 2PC', 'Service autonomy'],
    cons: ['Compensations are hard to design', 'Only eventual consistency'],
  },
];

const CODE: readonly DesignPattern[] = [
  // Creational
  {
    slug: 'factory-method',
    name: 'Factory Method',
    category: 'Creational',
    summary: 'Let subclasses decide which concrete product to instantiate.',
    intent: 'Define an interface for creating an object, but let subclasses choose the class.',
    forces: ['Class can’t anticipate the concrete type', 'Want to avoid new in business code'],
    participants: [
      { name: 'Creator', role: 'declares the factory method' },
      { name: 'ConcreteCreator', role: 'returns a specific product' },
      { name: 'Product', role: 'the interface the creator returns' },
    ],
    pros: ['Decouples creation from use', 'Open/closed for new products'],
    cons: ['More subclasses'],
  },
  {
    slug: 'abstract-factory',
    name: 'Abstract Factory',
    category: 'Creational',
    summary: 'Create families of related objects without naming concrete classes.',
    intent: 'Provide an interface for creating families of related products.',
    forces: ['Products come in compatible families', 'Must stay consistent across a family'],
    participants: [
      { name: 'AbstractFactory', role: 'declares create-X methods per product' },
      { name: 'ConcreteFactory', role: 'produces one consistent family' },
      { name: 'Products', role: 'related product interfaces' },
    ],
    pros: ['Guarantees compatible families', 'Swaps a whole family at once'],
    cons: ['Adding a new product means changing every factory'],
  },
  {
    slug: 'builder',
    name: 'Builder',
    category: 'Creational',
    summary: 'Construct a complex object step by step.',
    intent: 'Separate construction of a complex object from its representation.',
    forces: ['Many optional parts', 'Telescoping constructors are unwieldy'],
    participants: [
      { name: 'Builder', role: 'step methods returning itself' },
      { name: 'Director (optional)', role: 'encodes a build recipe' },
      { name: 'Product', role: 'the assembled object' },
    ],
    pros: ['Readable step-by-step construction', 'Same steps, different representations'],
    cons: ['More code for simple objects'],
  },
  {
    slug: 'prototype',
    name: 'Prototype',
    category: 'Creational',
    summary: 'Create new objects by cloning an existing instance.',
    intent: 'Produce new objects by copying a prototype instead of newing from scratch.',
    forces: ['Construction is expensive', 'Want copies independent of concrete class'],
    participants: [
      { name: 'Prototype', role: 'declares clone()' },
      { name: 'ConcretePrototype', role: 'implements a copy of itself' },
      { name: 'Client', role: 'clones rather than constructs' },
    ],
    pros: ['Avoids costly construction', 'Adds/removes products at runtime'],
    cons: ['Deep-copying graphs is tricky'],
  },
  {
    slug: 'singleton',
    name: 'Singleton',
    category: 'Creational',
    summary: 'Guarantee one instance with a global access point.',
    intent: 'Ensure a class has only one instance and provide global access to it.',
    forces: ['Exactly one is needed (config, pool)', 'Need a single coordination point'],
    participants: [
      { name: 'Singleton', role: 'holds the lone instance + accessor' },
      { name: 'Client', role: 'uses the shared accessor' },
    ],
    pros: ['Single shared instance', 'Lazy initialization'],
    cons: ['Global state hurts testability', 'Hidden coupling; concurrency care'],
  },
  // Structural
  {
    slug: 'adapter',
    name: 'Adapter',
    category: 'Structural',
    summary: 'Make an incompatible interface usable by wrapping it.',
    intent: 'Convert one interface into another the client expects.',
    forces: ['Reuse a class with the wrong interface', 'Can’t change the third-party code'],
    participants: [
      { name: 'Target', role: 'interface the client wants' },
      { name: 'Adapter', role: 'translates Target calls to the Adaptee' },
      { name: 'Adaptee', role: 'existing class with a different interface' },
    ],
    pros: ['Reuse incompatible code', 'Separates conversion from logic'],
    cons: ['Extra indirection layer'],
  },
  {
    slug: 'bridge',
    name: 'Bridge',
    category: 'Structural',
    summary: 'Split an abstraction from its implementation so both vary independently.',
    intent: 'Decouple an abstraction from its implementation so they can change separately.',
    forces: ['A class explodes into a class-per-combination', 'Two dimensions vary'],
    participants: [
      { name: 'Abstraction', role: 'holds a reference to an Implementor' },
      { name: 'Implementor', role: 'interface for the implementation side' },
      { name: 'ConcreteImplementor', role: 'a specific implementation' },
    ],
    pros: ['Combines dimensions without N×M classes', 'Swap implementation at runtime'],
    cons: ['Upfront indirection'],
  },
  {
    slug: 'composite',
    name: 'Composite',
    category: 'Structural',
    summary: 'Treat individual objects and compositions uniformly via a tree.',
    intent: 'Compose objects into trees and treat leaves and branches the same way.',
    forces: ['Part-whole hierarchies', 'Client should ignore leaf vs. branch'],
    participants: [
      { name: 'Component', role: 'common interface for leaves + composites' },
      { name: 'Leaf', role: 'a primitive with no children' },
      { name: 'Composite', role: 'holds children, delegates to them' },
    ],
    pros: ['Uniform treatment of trees', 'Easy to add new node types'],
    cons: ['Can over-generalize the interface'],
  },
  {
    slug: 'decorator',
    name: 'Decorator',
    category: 'Structural',
    summary: 'Add behavior to an object by wrapping it, without subclassing.',
    intent: 'Attach responsibilities to an object dynamically by wrapping it.',
    forces: ['Subclass explosion for feature combos', 'Add behavior at runtime'],
    participants: [
      { name: 'Component', role: 'shared interface' },
      { name: 'ConcreteComponent', role: 'the base object' },
      { name: 'Decorator', role: 'wraps a component and adds behavior' },
    ],
    pros: ['Compose behaviors at runtime', 'Single-responsibility per decorator'],
    cons: ['Many small wrapper objects; order matters'],
  },
  {
    slug: 'facade',
    name: 'Facade',
    category: 'Structural',
    summary: 'Offer a simple front to a complex subsystem.',
    intent: 'Provide a unified, simple interface over a set of subsystem interfaces.',
    forces: ['Subsystem is complex', 'Clients need only common tasks'],
    participants: [
      { name: 'Facade', role: 'simple entry point delegating inward' },
      { name: 'Subsystem classes', role: 'do the real work' },
      { name: 'Client', role: 'uses the facade, not the internals' },
    ],
    pros: ['Simplifies usage', 'Decouples clients from the subsystem'],
    cons: ['Risk of becoming a god-object'],
  },
  {
    slug: 'flyweight',
    name: 'Flyweight',
    category: 'Structural',
    summary: 'Share common state across many objects to save memory.',
    intent: 'Share intrinsic state among many fine-grained objects to fit more in memory.',
    forces: ['Huge numbers of similar objects', 'Memory is the bottleneck'],
    participants: [
      { name: 'Flyweight', role: 'holds shared intrinsic state' },
      { name: 'Factory', role: 'pools + reuses flyweights' },
      { name: 'Client', role: 'supplies extrinsic state per use' },
    ],
    pros: ['Large memory savings'],
    cons: ['Code complexity; CPU for extrinsic state'],
  },
  {
    slug: 'proxy',
    name: 'Proxy',
    category: 'Structural',
    summary: 'Stand in for another object to control access to it.',
    intent: 'Provide a surrogate that controls access to a real subject.',
    forces: ['Lazy loading, caching, access control, or remoting needed'],
    participants: [
      { name: 'Subject', role: 'shared interface' },
      { name: 'Proxy', role: 'controls access to the real subject' },
      { name: 'RealSubject', role: 'the actual object' },
    ],
    pros: ['Adds control without changing the subject', 'Lazy/remote/caching variants'],
    cons: ['Extra indirection; possible latency'],
  },
  // Behavioral
  {
    slug: 'chain-of-responsibility',
    name: 'Chain of Responsibility',
    category: 'Behavioral',
    summary: 'Pass a request along a chain until a handler takes it.',
    intent: 'Decouple sender from receiver by giving several objects a chance to handle a request.',
    forces: ['Multiple possible handlers', 'Handler set varies at runtime'],
    participants: [
      { name: 'Handler', role: 'declares handle() + a next link' },
      { name: 'ConcreteHandler', role: 'handles or forwards' },
      { name: 'Client', role: 'sends to the head of the chain' },
    ],
    pros: ['Decouples sender + receiver', 'Reorder/insert handlers freely'],
    cons: ['No guarantee of handling; harder to debug'],
  },
  {
    slug: 'command',
    name: 'Command',
    category: 'Behavioral',
    summary: 'Wrap a request as an object — queue, log, and undo it.',
    intent: 'Encapsulate a request as an object to parameterize, queue, and undo operations.',
    forces: ['Need undo/redo, queuing, or logging of actions'],
    participants: [
      { name: 'Command', role: 'execute() (and undo())' },
      { name: 'Invoker', role: 'triggers commands' },
      { name: 'Receiver', role: 'does the actual work' },
    ],
    pros: ['Undo/redo + queuing + logging', 'Decouples invoker from receiver'],
    cons: ['Many small command classes'],
  },
  {
    slug: 'iterator',
    name: 'Iterator',
    category: 'Behavioral',
    summary: 'Traverse a collection without exposing its internals.',
    intent: 'Access elements of an aggregate sequentially without revealing its representation.',
    forces: ['Multiple traversal strategies', 'Hide collection internals'],
    participants: [
      { name: 'Iterator', role: 'next() / hasNext()' },
      { name: 'Aggregate', role: 'creates an iterator' },
      { name: 'Client', role: 'iterates via the interface' },
    ],
    pros: ['Uniform traversal', 'Multiple concurrent iterations'],
    cons: ['Overkill for simple collections'],
  },
  {
    slug: 'mediator',
    name: 'Mediator',
    category: 'Behavioral',
    summary: 'Centralize how a set of objects interact.',
    intent: 'Define an object that encapsulates how a set of objects communicate.',
    forces: ['Many-to-many object coupling', 'Interaction logic is tangled'],
    participants: [
      { name: 'Mediator', role: 'coordinates colleagues' },
      { name: 'Colleagues', role: 'talk via the mediator, not each other' },
    ],
    pros: ['Reduces coupling to one hub', 'Centralizes interaction logic'],
    cons: ['Mediator can become a god-object'],
  },
  {
    slug: 'memento',
    name: 'Memento',
    category: 'Behavioral',
    summary: 'Capture and restore an object’s state without breaking encapsulation.',
    intent: 'Externalize an object’s internal state so it can be restored later.',
    forces: ['Need snapshots / undo', 'Must not expose internals'],
    participants: [
      { name: 'Originator', role: 'creates + restores mementos' },
      { name: 'Memento', role: 'opaque snapshot of state' },
      { name: 'Caretaker', role: 'stores mementos' },
    ],
    pros: ['Undo without exposing internals'],
    cons: ['Memory cost of snapshots'],
  },
  {
    slug: 'observer',
    name: 'Observer',
    category: 'Behavioral',
    summary: 'Notify dependents automatically when a subject changes.',
    intent: 'Define a one-to-many dependency so observers update when the subject changes.',
    forces: ['Many objects react to one’s state', 'Subject must not know observers'],
    participants: [
      { name: 'Subject', role: 'registers observers, emits notifications' },
      { name: 'Observer', role: 'update() on change' },
      { name: 'ConcreteObserver', role: 'reacts to the new state' },
    ],
    pros: ['Loose coupling', 'Dynamic subscribe/unsubscribe'],
    cons: ['Update storms; ordering not guaranteed'],
  },
  {
    slug: 'state',
    name: 'State',
    category: 'Behavioral',
    summary: 'Let an object change behavior when its internal state changes.',
    intent: 'Allow an object to alter its behavior when its state changes — it appears to change class.',
    forces: ['Big conditionals on a state field', 'Per-state behavior differs'],
    participants: [
      { name: 'Context', role: 'holds the current State' },
      { name: 'State', role: 'interface for state-specific behavior' },
      { name: 'ConcreteState', role: 'behavior + transitions for one state' },
    ],
    pros: ['Removes big switch statements', 'Localizes per-state behavior'],
    cons: ['More classes for simple machines'],
  },
  {
    slug: 'strategy',
    name: 'Strategy',
    category: 'Behavioral',
    summary: 'Swap interchangeable algorithms behind one interface.',
    intent: 'Define a family of algorithms, encapsulate each, and make them interchangeable.',
    forces: ['Multiple variants of an algorithm', 'Choose behavior at runtime'],
    participants: [
      { name: 'Strategy', role: 'common algorithm interface' },
      { name: 'ConcreteStrategy', role: 'one algorithm implementation' },
      { name: 'Context', role: 'delegates to the current strategy' },
    ],
    pros: ['Swap algorithms at runtime', 'Replaces conditionals; easy to test'],
    cons: ['Clients must know the strategies'],
  },
  {
    slug: 'template-method',
    name: 'Template Method',
    category: 'Behavioral',
    summary: 'Fix an algorithm’s skeleton, let subclasses fill in steps.',
    intent: 'Define the skeleton of an algorithm, deferring some steps to subclasses.',
    forces: ['Shared algorithm shape', 'Steps differ per subclass'],
    participants: [
      { name: 'AbstractClass', role: 'template method calling step hooks' },
      { name: 'ConcreteClass', role: 'overrides the variable steps' },
    ],
    pros: ['Reuse the invariant skeleton', 'Control extension points'],
    cons: ['Inheritance-bound; can be rigid'],
  },
  {
    slug: 'visitor',
    name: 'Visitor',
    category: 'Behavioral',
    summary: 'Add operations to a structure without changing its classes.',
    intent: 'Represent an operation over elements of an object structure as a separate visitor.',
    forces: ['Many unrelated ops over a stable structure', 'Avoid polluting element classes'],
    participants: [
      { name: 'Visitor', role: 'visit method per element type' },
      { name: 'Element', role: 'accept(visitor)' },
      { name: 'ObjectStructure', role: 'iterates + dispatches elements' },
    ],
    pros: ['Add operations without touching elements', 'Gathers related ops together'],
    cons: ['Adding an element type changes every visitor'],
  },
];

const AI: readonly DesignPattern[] = [
  {
    slug: 'rag',
    name: 'Retrieval-Augmented Generation',
    category: 'AI / agents',
    summary: 'Ground an LLM in retrieved documents to cut hallucination.',
    intent: 'Retrieve relevant context and inject it into the prompt so answers are grounded in your data.',
    forces: ['Model lacks private/fresh knowledge', 'Hallucination must be reduced', 'Answers need citations'],
    participants: [
      { name: 'Retriever', role: 'embeds the query and searches' },
      { name: 'Vector store', role: 'holds document embeddings' },
      { name: 'LLM', role: 'answers from query + retrieved context' },
    ],
    pros: ['Grounded, current answers', 'No retraining'],
    cons: ['Retrieval quality caps answers', 'Chunking + indexing to tune'],
  },
  {
    slug: 'react',
    name: 'ReAct (reason + act)',
    category: 'AI / agents',
    summary: 'Interleave reasoning and tool actions in a loop.',
    intent: 'Let the model alternate Thought → Action → Observation until it can answer.',
    forces: ['Task needs external info/tools', 'Multi-step reasoning', 'Steps unknown upfront'],
    participants: [
      { name: 'LLM', role: 'emits a thought + next action' },
      { name: 'Tools', role: 'execute actions, return observations' },
      { name: 'Loop', role: 'feeds observations back until done' },
    ],
    pros: ['Handles multi-step tasks', 'Transparent reasoning trace'],
    cons: ['Can loop or wander', 'More tokens + latency'],
  },
  {
    slug: 'tool-use',
    name: 'Tool use (function calling)',
    category: 'AI / agents',
    summary: 'Give the LLM typed functions it can call to act.',
    intent: 'Expose typed tools the model can invoke; run them and feed results back.',
    forces: ['Model must act, not just talk', 'Calls must be structured/typed'],
    participants: [
      { name: 'LLM', role: 'chooses a tool + arguments' },
      { name: 'Tool registry', role: 'typed function schemas' },
      { name: 'Executor', role: 'runs the call, returns the result' },
    ],
    pros: ['Extends the model with real actions', 'Structured + verifiable'],
    cons: ['Tool errors + validation', 'Prompt-injection risk'],
  },
  {
    slug: 'prompt-chaining',
    name: 'Prompt chaining',
    category: 'AI / agents',
    summary: 'Decompose a task into a fixed pipeline of LLM steps.',
    intent: 'Break a complex task into ordered sub-prompts, each feeding the next.',
    forces: ['Task decomposes cleanly', 'Each step is simpler than the whole'],
    participants: [
      { name: 'Steps 1..N', role: 'each a focused LLM call' },
      { name: 'Gate', role: 'optional check between steps' },
    ],
    pros: ['Higher accuracy per step', 'Easy to test + trace'],
    cons: ['Higher latency', 'Rigid for dynamic tasks'],
  },
  {
    slug: 'routing',
    name: 'Routing',
    category: 'AI / agents',
    summary: 'Classify the input, then dispatch to a specialized handler.',
    intent: 'Route each request to the prompt/model/tool best suited to it.',
    forces: ['Distinct categories of input', 'One prompt cannot serve all well'],
    participants: [
      { name: 'Router', role: 'classifies the request' },
      { name: 'Handlers', role: 'specialized chains per category' },
    ],
    pros: ['Specialized quality', 'Cost control (cheap router)'],
    cons: ['Misroutes cascade', 'Another component to maintain'],
  },
  {
    slug: 'reflection',
    name: 'Reflection (self-critique)',
    category: 'AI / agents',
    summary: 'Have the model critique and revise its own output.',
    intent: 'Generate, then self-critique against criteria, then improve.',
    forces: ['First drafts have fixable errors', 'Quality matters more than latency'],
    participants: [
      { name: 'Generator', role: 'produces a draft' },
      { name: 'Critic', role: 'evaluates against criteria' },
      { name: 'Reviser', role: 'applies the feedback' },
    ],
    pros: ['Higher quality', 'Catches its own mistakes'],
    cons: ['More tokens + latency', 'Can over-revise'],
  },
  {
    slug: 'multi-agent',
    name: 'Orchestrator–workers',
    category: 'AI / agents',
    summary: 'A lead agent delegates subtasks to specialized workers.',
    intent: 'Split a goal across specialized agents coordinated by an orchestrator.',
    forces: ['Task spans skills/contexts', 'One context window is not enough'],
    participants: [
      { name: 'Orchestrator', role: 'decomposes, assigns, assembles' },
      { name: 'Workers', role: 'specialized sub-agents' },
      { name: 'Shared state', role: 'passes typed results' },
    ],
    pros: ['Parallelism + specialization', 'Scales to big tasks'],
    cons: ['Coordination overhead', 'Harder to debug'],
  },
  {
    slug: 'guardrails',
    name: 'Guardrails',
    category: 'AI / agents',
    summary: 'Validate and filter model input and output.',
    intent: 'Wrap the model with checks that block unsafe or invalid input/output.',
    forces: ['Untrusted input', 'Outputs must meet policy/schema'],
    participants: [
      { name: 'Input guard', role: 'blocks injection / PII' },
      { name: 'LLM', role: 'the wrapped model' },
      { name: 'Output guard', role: 'validates schema + safety' },
    ],
    pros: ['Safety + compliance', 'Catches malformed output'],
    cons: ['False positives', 'Added latency'],
  },
  {
    slug: 'memory',
    name: 'Agent memory',
    category: 'AI / agents',
    summary: 'Persist context across turns — short and long term.',
    intent: 'Give an agent recall beyond the context window via stored memory.',
    forces: ['Conversations exceed the window', 'Recall facts across sessions'],
    participants: [
      { name: 'Short-term', role: 'recent turns in-context' },
      { name: 'Long-term store', role: 'vector / DB memory' },
      { name: 'Retriever', role: 'pulls relevant memories in' },
    ],
    pros: ['Continuity + personalization'],
    cons: ['Stale/conflicting memories', 'Privacy + storage'],
  },
  {
    slug: 'evaluator-optimizer',
    name: 'Evaluator–optimizer',
    category: 'AI / agents',
    summary: 'A generator loops against an evaluator until it passes.',
    intent: 'One model proposes; another scores; iterate until criteria are met.',
    forces: ['Clear success criteria exist', 'Quality worth extra iterations'],
    participants: [
      { name: 'Generator', role: 'proposes a candidate' },
      { name: 'Evaluator', role: 'scores against criteria' },
      { name: 'Loop', role: 'feeds feedback until pass' },
    ],
    pros: ['Converges to quality', 'Objective stop condition'],
    cons: ['Cost of iterations', 'Needs a good evaluator'],
  },
];

/** The full library: system design, AI/agent patterns, then the GoF code patterns. */
export const DESIGN_PATTERNS: readonly DesignPattern[] = [...SYSTEM, ...AI, ...CODE];

/** Wraps a YAML body in a fenced block of the given type. */
const fence = (type: string, body: string): string => '```' + type + '\n' + body + '\n```';

/**
 * Hand-authored structure diagram per pattern, keyed by slug. Code patterns use
 * a `uml` class diagram (proper inheritance / implementation / aggregation
 * markers); system patterns use whichever shape fits — a `block` topology
 * (fan-out / layers), a `flow` decision, a `state` machine, or a `sequence`.
 * Each is tailored, so no two look alike.
 */
const DIAGRAMS: Record<string, string> = {
  // ── system design ──────────────────────────────────────────────────────────
  caching: fence(
    'block',
    `title: Read-through cache
nodes:
  - { id: app, col: 1, row: 1, kind: client, name: Service }
  - { id: cache, col: 2, row: 1, kind: cache, name: Cache }
  - { id: db, col: 3, row: 1, kind: store, name: Origin DB }
edges:
  - { from: app, to: cache, label: read }
  - { from: cache, to: db, label: miss }
  - { from: db, to: cache, label: fill, kind: dashed }`,
  ),
  'load-balancing': fence(
    'block',
    `title: Spread across servers
nodes:
  - { id: c, col: 1, row: 2, kind: client, name: Clients }
  - { id: lb, col: 2, row: 2, kind: gateway, name: Load balancer }
  - { id: s1, col: 3, row: 1, kind: service, name: Server 1 }
  - { id: s2, col: 3, row: 2, kind: service, name: Server 2 }
  - { id: s3, col: 3, row: 3, kind: service, name: Server 3 }
edges:
  - { from: c, to: lb }
  - { from: lb, to: s1 }
  - { from: lb, to: s2 }
  - { from: lb, to: s3 }`,
  ),
  cdn: fence(
    'block',
    `title: Serve from the edge
nodes:
  - { id: u1, col: 1, row: 1, kind: client, name: User EU }
  - { id: u2, col: 1, row: 2, kind: client, name: User US }
  - { id: e1, col: 2, row: 1, kind: cdn, name: Edge EU }
  - { id: e2, col: 2, row: 2, kind: cdn, name: Edge US }
  - { id: origin, col: 3, row: 1, kind: store, name: Origin }
edges:
  - { from: u1, to: e1 }
  - { from: u2, to: e2 }
  - { from: e1, to: origin, label: miss, kind: dashed }
  - { from: e2, to: origin, label: miss, kind: dashed }`,
  ),
  sharding: fence(
    'block',
    `title: Partition by key
nodes:
  - { id: app, col: 1, row: 2, kind: client, name: App }
  - { id: router, col: 2, row: 2, kind: gateway, name: Shard router }
  - { id: s1, col: 3, row: 1, kind: store, name: Shard A }
  - { id: s2, col: 3, row: 2, kind: store, name: Shard B }
  - { id: s3, col: 3, row: 3, kind: store, name: Shard C }
edges:
  - { from: app, to: router, label: key }
  - { from: router, to: s1 }
  - { from: router, to: s2 }
  - { from: router, to: s3 }`,
  ),
  replication: fence(
    'block',
    `title: Primary and replicas
nodes:
  - { id: w, col: 1, row: 1, kind: client, name: Writers }
  - { id: p, col: 2, row: 1, kind: store, name: Primary }
  - { id: r1, col: 3, row: 1, kind: store, name: Replica 1 }
  - { id: r2, col: 3, row: 2, kind: store, name: Replica 2 }
  - { id: rd, col: 1, row: 2, kind: client, name: Readers }
edges:
  - { from: w, to: p, label: writes }
  - { from: p, to: r1, label: replicate, kind: dashed }
  - { from: p, to: r2, label: replicate, kind: dashed }
  - { from: rd, to: r1, label: reads }
  - { from: rd, to: r2, label: reads }`,
  ),
  'rate-limiting': fence(
    'flow',
    `title: Token-bucket check
nodes:
  - { id: req, col: 1, row: 1, kind: start, label: Request }
  - { id: chk, col: 2, row: 1, kind: decision, label: "Tokens left?" }
  - { id: ok, col: 3, row: 1, kind: end, label: Forward }
  - { id: no, col: 2, row: 2, kind: end, label: "429" }
edges:
  - { from: req, to: chk }
  - { from: chk, to: ok, label: "yes" }
  - { from: chk, to: no, label: "no", kind: error }`,
  ),
  'message-queue': fence(
    'sequence',
    `title: Async work
actors:
  - { id: P, name: Producer }
  - { id: Q, name: Queue }
  - { id: W, name: Worker }
messages:
  - { from: P, to: Q, label: enqueue, kind: sync }
  - { from: W, to: Q, label: poll, kind: sync }
  - { from: Q, to: W, label: message, kind: response }
  - { from: W, to: Q, label: ack, kind: async }`,
  ),
  'pub-sub': fence(
    'block',
    `title: Fan-out to subscribers
nodes:
  - { id: pub, col: 1, row: 2, kind: producer, name: Publisher }
  - { id: t, col: 2, row: 2, kind: topic, name: Topic }
  - { id: s1, col: 3, row: 1, kind: consumer, name: Email }
  - { id: s2, col: 3, row: 2, kind: consumer, name: Search }
  - { id: s3, col: 3, row: 3, kind: consumer, name: Audit }
edges:
  - { from: pub, to: t, label: publish }
  - { from: t, to: s1 }
  - { from: t, to: s2 }
  - { from: t, to: s3 }`,
  ),
  cqrs: fence(
    'block',
    `title: Split read and write
nodes:
  - { id: cmd, col: 1, row: 1, kind: client, name: Commands }
  - { id: ws, col: 2, row: 1, kind: store, name: Write store }
  - { id: proj, col: 2, row: 2, kind: service, name: Projector }
  - { id: rs, col: 3, row: 2, kind: store, name: Read store }
  - { id: qry, col: 3, row: 1, kind: client, name: Queries }
edges:
  - { from: cmd, to: ws, label: write }
  - { from: ws, to: proj, label: events, kind: dashed }
  - { from: proj, to: rs, label: update }
  - { from: qry, to: rs, label: read }`,
  ),
  'event-sourcing': fence(
    'block',
    `title: Append-only log
nodes:
  - { id: cmd, col: 1, row: 1, kind: client, name: Commands }
  - { id: agg, col: 2, row: 1, kind: service, name: Aggregate }
  - { id: log, col: 3, row: 1, kind: store, name: Event store }
  - { id: proj, col: 3, row: 2, kind: service, name: Projections }
edges:
  - { from: cmd, to: agg }
  - { from: agg, to: log, label: append }
  - { from: log, to: agg, label: replay, kind: dashed }
  - { from: log, to: proj, label: subscribe }`,
  ),
  'api-gateway': fence(
    'block',
    `title: One entry point
nodes:
  - { id: cl, col: 1, row: 2, kind: client, name: Clients }
  - { id: gw, col: 2, row: 2, kind: gateway, name: API gateway }
  - { id: s1, col: 3, row: 1, kind: service, name: Orders }
  - { id: s2, col: 3, row: 2, kind: service, name: Users }
  - { id: s3, col: 3, row: 3, kind: service, name: Billing }
edges:
  - { from: cl, to: gw, label: route }
  - { from: gw, to: s1 }
  - { from: gw, to: s2 }
  - { from: gw, to: s3 }`,
  ),
  'circuit-breaker': fence(
    'state',
    `title: Breaker states
states:
  - { id: closed, col: 1, row: 1, kind: active, name: CLOSED }
  - { id: open, col: 2, row: 1, kind: wait, name: OPEN }
  - { id: half, col: 3, row: 1, kind: active, name: HALF-OPEN }
transitions:
  - { from: closed, to: open, event: "failures > N" }
  - { from: open, to: half, event: cooldown }
  - { from: half, to: closed, event: success }
  - { from: half, to: open, event: failure }`,
  ),
  'consistent-hashing': fence(
    'block',
    `title: Keys on a ring
nodes:
  - { id: k, col: 1, row: 2, kind: client, name: Key }
  - { id: ring, col: 2, row: 2, kind: gateway, name: Hash ring }
  - { id: n1, col: 3, row: 1, kind: store, name: Node A }
  - { id: n2, col: 3, row: 2, kind: store, name: Node B }
  - { id: n3, col: 3, row: 3, kind: store, name: Node C }
edges:
  - { from: k, to: ring, label: hash }
  - { from: ring, to: n1, label: clockwise }
  - { from: ring, to: n2 }
  - { from: ring, to: n3 }`,
  ),
  idempotency: fence(
    'sequence',
    `title: Safe retry
actors:
  - { id: C, name: Client }
  - { id: S, name: Service }
  - { id: K, name: Key store }
messages:
  - { from: C, to: S, label: "POST + key", kind: sync }
  - { from: S, to: K, label: "seen key?", kind: sync }
  - { from: K, to: S, label: "no, process", kind: response }
  - { from: C, to: S, label: "retry, same key", kind: sync }
  - { from: S, to: C, label: stored result, kind: response }`,
  ),
  saga: fence(
    'sequence',
    `title: Orchestrated saga
actors:
  - { id: O, name: Orchestrator }
  - { id: A, name: Order svc }
  - { id: B, name: Payment svc }
messages:
  - { from: O, to: A, label: create order, kind: sync }
  - { from: O, to: B, label: charge, kind: sync }
  - { from: B, to: O, label: failed, kind: error }
  - { from: O, to: A, label: "compensate, cancel", kind: async }`,
  ),
  // ── AI / agents ────────────────────────────────────────────────────────────
  rag: fence(
    'sequence',
    `title: Retrieval-augmented answer
actors:
  - { id: U, name: User }
  - { id: R, name: Retriever }
  - { id: V, name: Vector store }
  - { id: L, name: LLM }
messages:
  - { from: U, to: R, label: query, kind: sync }
  - { from: R, to: V, label: similarity search, kind: sync }
  - { from: V, to: R, label: top-k chunks, kind: response }
  - { from: R, to: L, label: "query + context", kind: sync }
  - { from: L, to: U, label: grounded answer, kind: response }`,
  ),
  react: fence(
    'flow',
    `title: Reason + act loop
nodes:
  - { id: think, col: 1, row: 1, kind: process, label: Thought }
  - { id: act, col: 2, row: 1, kind: process, label: Action }
  - { id: obs, col: 3, row: 1, kind: process, label: Observation }
  - { id: done, col: 2, row: 2, kind: decision, label: "Answer ready?" }
  - { id: end, col: 3, row: 2, kind: end, label: Final answer }
edges:
  - { from: think, to: act }
  - { from: act, to: obs }
  - { from: obs, to: done }
  - { from: done, to: think, label: "no" }
  - { from: done, to: end, label: "yes" }`,
  ),
  'tool-use': fence(
    'sequence',
    `title: Function call
actors:
  - { id: L, name: LLM }
  - { id: E, name: Executor }
  - { id: T, name: Tool }
messages:
  - { from: L, to: E, label: "call(args)", kind: sync }
  - { from: E, to: T, label: invoke, kind: sync }
  - { from: T, to: E, label: result, kind: response }
  - { from: E, to: L, label: observation, kind: response }`,
  ),
  'prompt-chaining': fence(
    'flow',
    `title: Prompt pipeline
nodes:
  - { id: in, col: 1, row: 1, kind: start, label: Input }
  - { id: s1, col: 2, row: 1, kind: process, label: Step 1 }
  - { id: s2, col: 3, row: 1, kind: process, label: Step 2 }
  - { id: s3, col: 4, row: 1, kind: process, label: Step 3 }
  - { id: out, col: 5, row: 1, kind: end, label: Output }
edges:
  - { from: in, to: s1 }
  - { from: s1, to: s2 }
  - { from: s2, to: s3 }
  - { from: s3, to: out }`,
  ),
  routing: fence(
    'flow',
    `title: Classify then dispatch
nodes:
  - { id: in, col: 1, row: 2, kind: start, label: Request }
  - { id: r, col: 2, row: 2, kind: decision, label: Router }
  - { id: a, col: 3, row: 1, kind: end, label: Billing chain }
  - { id: b, col: 3, row: 2, kind: end, label: Support chain }
  - { id: c, col: 3, row: 3, kind: end, label: Sales chain }
edges:
  - { from: in, to: r }
  - { from: r, to: a, label: billing }
  - { from: r, to: b, label: support }
  - { from: r, to: c, label: sales }`,
  ),
  reflection: fence(
    'flow',
    `title: Generate then self-critique
nodes:
  - { id: gen, col: 1, row: 1, kind: process, label: Generate }
  - { id: crit, col: 2, row: 1, kind: process, label: Critique }
  - { id: ok, col: 3, row: 1, kind: decision, label: "Good enough?" }
  - { id: rev, col: 2, row: 2, kind: process, label: Revise }
  - { id: end, col: 4, row: 1, kind: end, label: Output }
edges:
  - { from: gen, to: crit }
  - { from: crit, to: ok }
  - { from: ok, to: end, label: "yes" }
  - { from: ok, to: rev, label: "no" }
  - { from: rev, to: crit }`,
  ),
  'multi-agent': fence(
    'block',
    `title: Orchestrator and workers
nodes:
  - { id: g, col: 1, row: 2, kind: client, name: Goal }
  - { id: orch, col: 2, row: 2, kind: service, name: Orchestrator }
  - { id: w1, col: 3, row: 1, kind: service, name: Research }
  - { id: w2, col: 3, row: 2, kind: service, name: Code }
  - { id: w3, col: 3, row: 3, kind: service, name: Review }
edges:
  - { from: g, to: orch }
  - { from: orch, to: w1 }
  - { from: orch, to: w2 }
  - { from: orch, to: w3 }`,
  ),
  guardrails: fence(
    'block',
    `title: Wrap the model in checks
nodes:
  - { id: in, col: 1, row: 1, kind: client, name: Input }
  - { id: ig, col: 2, row: 1, kind: firewall, name: Input guard }
  - { id: llm, col: 3, row: 1, kind: service, name: LLM }
  - { id: og, col: 4, row: 1, kind: firewall, name: Output guard }
  - { id: out, col: 5, row: 1, kind: client, name: Output }
edges:
  - { from: in, to: ig }
  - { from: ig, to: llm }
  - { from: llm, to: og }
  - { from: og, to: out }`,
  ),
  memory: fence(
    'block',
    `title: Short and long-term memory
nodes:
  - { id: st, col: 1, row: 1, kind: cache, name: Short-term }
  - { id: lt, col: 1, row: 2, kind: store, name: Long-term store }
  - { id: ret, col: 2, row: 2, kind: service, name: Retriever }
  - { id: llm, col: 3, row: 1, kind: service, name: LLM }
edges:
  - { from: lt, to: ret, label: recall }
  - { from: ret, to: llm, label: inject }
  - { from: st, to: llm, label: recent turns }`,
  ),
  'evaluator-optimizer': fence(
    'flow',
    `title: Generate then evaluate
nodes:
  - { id: gen, col: 1, row: 1, kind: process, label: Generator }
  - { id: ev, col: 2, row: 1, kind: process, label: Evaluator }
  - { id: ok, col: 3, row: 1, kind: decision, label: "Passes?" }
  - { id: end, col: 4, row: 1, kind: end, label: Accept }
edges:
  - { from: gen, to: ev }
  - { from: ev, to: ok }
  - { from: ok, to: end, label: "yes" }
  - { from: ok, to: gen, label: "no, feedback" }`,
  ),
  // ── creational (uml) ───────────────────────────────────────────────────────
  'factory-method': fence(
    'uml',
    `title: Factory Method
classes:
  - { id: creator, col: 1, row: 1, name: Creator, stereotype: abstract, methods: ["factoryMethod()", "operation()"] }
  - { id: cc, col: 1, row: 2, name: ConcreteCreator, methods: ["factoryMethod()"] }
  - { id: product, col: 3, row: 1, name: Product, stereotype: interface }
  - { id: cp, col: 3, row: 2, name: ConcreteProduct }
rels:
  - { from: cc, to: creator, kind: inheritance }
  - { from: cp, to: product, kind: implementation }
  - { from: cc, to: cp, kind: dependency, label: creates }`,
  ),
  'abstract-factory': fence(
    'uml',
    `title: Abstract Factory
classes:
  - { id: af, col: 1, row: 1, name: AbstractFactory, stereotype: interface, methods: ["createA()", "createB()"] }
  - { id: cf, col: 1, row: 2, name: ConcreteFactory, methods: ["createA()", "createB()"] }
  - { id: pa, col: 3, row: 1, name: ProductA, stereotype: interface }
  - { id: pb, col: 3, row: 2, name: ProductB, stereotype: interface }
rels:
  - { from: cf, to: af, kind: implementation }
  - { from: cf, to: pa, kind: dependency, label: creates }
  - { from: cf, to: pb, kind: dependency, label: creates }`,
  ),
  builder: fence(
    'uml',
    `title: Builder
classes:
  - { id: dir, col: 1, row: 1, name: Director, methods: ["construct()"] }
  - { id: b, col: 3, row: 1, name: Builder, stereotype: interface, methods: ["buildPart()", "getResult()"] }
  - { id: cb, col: 3, row: 2, name: ConcreteBuilder }
  - { id: prod, col: 3, row: 3, name: Product }
rels:
  - { from: dir, to: b, kind: aggregation, label: uses }
  - { from: cb, to: b, kind: implementation }
  - { from: cb, to: prod, kind: dependency, label: builds }`,
  ),
  prototype: fence(
    'uml',
    `title: Prototype
classes:
  - { id: client, col: 1, row: 1, name: Client }
  - { id: proto, col: 2, row: 1, name: Prototype, stereotype: interface, methods: ["clone()"] }
  - { id: cp, col: 2, row: 2, name: ConcretePrototype, methods: ["clone()"] }
rels:
  - { from: cp, to: proto, kind: implementation }
  - { from: client, to: proto, kind: association, label: clones }`,
  ),
  singleton: fence(
    'uml',
    `title: Singleton
classes:
  - { id: s, col: 1, row: 1, name: Singleton, attrs: ["- instance"], methods: ["+ getInstance()"] }
  - { id: client, col: 1, row: 2, name: Client }
rels:
  - { from: client, to: s, kind: dependency, label: getInstance }`,
  ),
  // ── structural (uml) ───────────────────────────────────────────────────────
  adapter: fence(
    'uml',
    `title: Adapter
classes:
  - { id: client, col: 1, row: 1, name: Client }
  - { id: target, col: 2, row: 1, name: Target, stereotype: interface, methods: ["request()"] }
  - { id: adapter, col: 2, row: 2, name: Adapter, methods: ["request()"] }
  - { id: adaptee, col: 3, row: 2, name: Adaptee, methods: ["specificRequest()"] }
rels:
  - { from: client, to: target, kind: association }
  - { from: adapter, to: target, kind: implementation }
  - { from: adapter, to: adaptee, kind: aggregation, label: adapts }`,
  ),
  bridge: fence(
    'uml',
    `title: Bridge
classes:
  - { id: abs, col: 1, row: 1, name: Abstraction, methods: ["operation()"] }
  - { id: ref, col: 1, row: 2, name: RefinedAbstraction }
  - { id: impl, col: 3, row: 1, name: Implementor, stereotype: interface, methods: ["operationImpl()"] }
  - { id: ci, col: 3, row: 2, name: ConcreteImplementor }
rels:
  - { from: ref, to: abs, kind: inheritance }
  - { from: abs, to: impl, kind: aggregation, label: has-a }
  - { from: ci, to: impl, kind: implementation }`,
  ),
  composite: fence(
    'uml',
    `title: Composite
classes:
  - { id: comp, col: 2, row: 1, name: Component, stereotype: interface, methods: ["operation()"] }
  - { id: leaf, col: 1, row: 2, name: Leaf }
  - { id: composite, col: 3, row: 2, name: Composite, methods: ["add()", "operation()"] }
rels:
  - { from: leaf, to: comp, kind: implementation }
  - { from: composite, to: comp, kind: implementation }
  - { from: composite, to: comp, kind: aggregation, label: children }`,
  ),
  decorator: fence(
    'uml',
    `title: Decorator
classes:
  - { id: comp, col: 2, row: 1, name: Component, stereotype: interface, methods: ["operation()"] }
  - { id: concrete, col: 1, row: 2, name: ConcreteComponent }
  - { id: dec, col: 3, row: 2, name: Decorator, methods: ["operation()"] }
rels:
  - { from: concrete, to: comp, kind: implementation }
  - { from: dec, to: comp, kind: implementation }
  - { from: dec, to: comp, kind: aggregation, label: wraps }`,
  ),
  facade: fence(
    'uml',
    `title: Facade
classes:
  - { id: client, col: 1, row: 1, name: Client }
  - { id: facade, col: 2, row: 1, name: Facade, methods: ["doWork()"] }
  - { id: a, col: 3, row: 1, name: SubsystemA }
  - { id: b, col: 3, row: 2, name: SubsystemB }
rels:
  - { from: client, to: facade, kind: dependency }
  - { from: facade, to: a, kind: dependency }
  - { from: facade, to: b, kind: dependency }`,
  ),
  flyweight: fence(
    'uml',
    `title: Flyweight
classes:
  - { id: factory, col: 1, row: 1, name: FlyweightFactory, methods: ["get(key)"] }
  - { id: fly, col: 2, row: 1, name: Flyweight, stereotype: interface, methods: ["op(extrinsic)"] }
  - { id: cf, col: 2, row: 2, name: ConcreteFlyweight, attrs: ["intrinsic"] }
  - { id: client, col: 1, row: 2, name: Client }
rels:
  - { from: factory, to: fly, kind: aggregation, label: pool }
  - { from: cf, to: fly, kind: implementation }
  - { from: client, to: factory, kind: dependency }`,
  ),
  proxy: fence(
    'uml',
    `title: Proxy
classes:
  - { id: subject, col: 2, row: 1, name: Subject, stereotype: interface, methods: ["request()"] }
  - { id: proxy, col: 1, row: 2, name: Proxy, methods: ["request()"] }
  - { id: real, col: 3, row: 2, name: RealSubject, methods: ["request()"] }
rels:
  - { from: proxy, to: subject, kind: implementation }
  - { from: real, to: subject, kind: implementation }
  - { from: proxy, to: real, kind: aggregation, label: controls }`,
  ),
  // ── behavioral (uml) ───────────────────────────────────────────────────────
  'chain-of-responsibility': fence(
    'uml',
    `title: Chain of Responsibility
classes:
  - { id: client, col: 1, row: 1, name: Client }
  - { id: handler, col: 2, row: 1, name: Handler, stereotype: interface, methods: ["handle()", "setNext()"] }
  - { id: h1, col: 2, row: 2, name: ConcreteHandlerA }
  - { id: h2, col: 3, row: 2, name: ConcreteHandlerB }
rels:
  - { from: client, to: handler, kind: association }
  - { from: h1, to: handler, kind: implementation }
  - { from: h2, to: handler, kind: implementation }
  - { from: h1, to: h2, kind: association, label: next }`,
  ),
  command: fence(
    'uml',
    `title: Command
classes:
  - { id: invoker, col: 1, row: 1, name: Invoker, attrs: ["command"] }
  - { id: cmd, col: 2, row: 1, name: Command, stereotype: interface, methods: ["execute()"] }
  - { id: cc, col: 2, row: 2, name: ConcreteCommand, methods: ["execute()"] }
  - { id: rcv, col: 3, row: 2, name: Receiver, methods: ["action()"] }
rels:
  - { from: invoker, to: cmd, kind: aggregation }
  - { from: cc, to: cmd, kind: implementation }
  - { from: cc, to: rcv, kind: association, label: calls }`,
  ),
  iterator: fence(
    'uml',
    `title: Iterator
classes:
  - { id: agg, col: 1, row: 1, name: Aggregate, stereotype: interface, methods: ["createIterator()"] }
  - { id: ca, col: 1, row: 2, name: ConcreteAggregate }
  - { id: it, col: 3, row: 1, name: Iterator, stereotype: interface, methods: ["next()", "hasNext()"] }
  - { id: ci, col: 3, row: 2, name: ConcreteIterator }
rels:
  - { from: ca, to: agg, kind: implementation }
  - { from: ci, to: it, kind: implementation }
  - { from: ca, to: ci, kind: dependency, label: creates }`,
  ),
  mediator: fence(
    'uml',
    `title: Mediator
classes:
  - { id: c1, col: 1, row: 1, name: ColleagueA }
  - { id: med, col: 2, row: 1, name: Mediator, stereotype: interface, methods: ["notify()"] }
  - { id: c2, col: 3, row: 1, name: ColleagueB }
  - { id: cm, col: 2, row: 2, name: ConcreteMediator }
rels:
  - { from: cm, to: med, kind: implementation }
  - { from: c1, to: med, kind: association }
  - { from: c2, to: med, kind: association }`,
  ),
  memento: fence(
    'uml',
    `title: Memento
classes:
  - { id: orig, col: 1, row: 1, name: Originator, methods: ["save()", "restore()"] }
  - { id: mem, col: 2, row: 1, name: Memento, attrs: ["state"] }
  - { id: care, col: 3, row: 1, name: Caretaker }
rels:
  - { from: orig, to: mem, kind: dependency, label: creates }
  - { from: care, to: mem, kind: aggregation, label: stores }`,
  ),
  observer: fence(
    'uml',
    `title: Observer
classes:
  - { id: subj, col: 1, row: 1, name: Subject, methods: ["attach()", "notify()"] }
  - { id: obs, col: 3, row: 1, name: Observer, stereotype: interface, methods: ["update()"] }
  - { id: co, col: 3, row: 2, name: ConcreteObserver }
rels:
  - { from: subj, to: obs, kind: aggregation, label: observers }
  - { from: co, to: obs, kind: implementation }`,
  ),
  state: fence(
    'uml',
    `title: State
classes:
  - { id: ctx, col: 1, row: 1, name: Context, attrs: ["state"], methods: ["request()"] }
  - { id: st, col: 3, row: 1, name: State, stereotype: interface, methods: ["handle()"] }
  - { id: s1, col: 3, row: 2, name: ConcreteStateA }
  - { id: s2, col: 4, row: 2, name: ConcreteStateB }
rels:
  - { from: ctx, to: st, kind: aggregation }
  - { from: s1, to: st, kind: implementation }
  - { from: s2, to: st, kind: implementation }`,
  ),
  strategy: fence(
    'uml',
    `title: Strategy
classes:
  - { id: ctx, col: 1, row: 1, name: Context, attrs: ["strategy"], methods: ["execute()"] }
  - { id: st, col: 3, row: 1, name: Strategy, stereotype: interface, methods: ["algorithm()"] }
  - { id: s1, col: 3, row: 2, name: ConcreteStrategyA }
  - { id: s2, col: 4, row: 2, name: ConcreteStrategyB }
rels:
  - { from: ctx, to: st, kind: aggregation, label: uses }
  - { from: s1, to: st, kind: implementation }
  - { from: s2, to: st, kind: implementation }`,
  ),
  'template-method': fence(
    'uml',
    `title: Template Method
classes:
  - { id: abs, col: 1, row: 1, name: AbstractClass, methods: ["templateMethod()", "step1()", "step2()"] }
  - { id: c1, col: 1, row: 2, name: ConcreteClass, methods: ["step1()", "step2()"] }
rels:
  - { from: c1, to: abs, kind: inheritance }`,
  ),
  visitor: fence(
    'uml',
    `title: Visitor
classes:
  - { id: el, col: 1, row: 1, name: Element, stereotype: interface, methods: ["accept(v)"] }
  - { id: ea, col: 1, row: 2, name: ConcreteElement }
  - { id: vis, col: 3, row: 1, name: Visitor, stereotype: interface, methods: ["visit(e)"] }
  - { id: cv, col: 3, row: 2, name: ConcreteVisitor }
rels:
  - { from: ea, to: el, kind: implementation }
  - { from: cv, to: vis, kind: implementation }
  - { from: ea, to: vis, kind: dependency, label: accept }`,
  ),
};

/** Finds a pattern by slug. */
export function findPattern(slug: string): DesignPattern | undefined {
  return DESIGN_PATTERNS.find((p) => p.slug === slug);
}

// ─── serialization (structured data → a valid Avodado `pattern` block) ───────

/** Double-quotes + escapes a YAML scalar so any punctuation is safe. */
function q(s: string): string {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function bullets(items: readonly string[], indent: string): string {
  return items.map((i) => `${indent}- ${q(i)}`).join('\n');
}

/** Renders just the fenced `pattern` block for a pattern. */
export function patternBlock(p: DesignPattern): string {
  return [
    '```pattern',
    `name: ${q(p.name)}`,
    `category: ${q(p.category)}`,
    `intent: ${q(p.intent)}`,
    'forces:',
    bullets(p.forces, '  '),
    'participants:',
    p.participants.map((x) => `  - name: ${q(x.name)}\n    role: ${q(x.role)}`).join('\n'),
    'consequences:',
    '  pros:',
    bullets(p.pros, '    '),
    '  cons:',
    bullets(p.cons, '    '),
    '```',
  ].join('\n');
}

/** The hand-authored structure diagram for a pattern, or `''` if none. */
export function structureBlock(p: DesignPattern): string {
  return DIAGRAMS[p.slug] ?? '';
}

/** Renders a full standalone doc (meta cover + pattern block + structure) for one pattern. */
export function patternDoc(p: DesignPattern): string {
  const meta = [
    '```meta',
    `title: ${q(p.name)}`,
    `subtitle: ${q(p.summary)}`,
    `tag: ${q(`${p.category.toUpperCase()} · PATTERN`)}`,
    '```',
  ].join('\n');
  const structure = structureBlock(p);
  return `${meta}\n\n${patternBlock(p)}\n${structure !== '' ? `\n${structure}\n` : ''}`;
}

/** Gallery / list filter. */
export type DesignFilter = 'system' | 'ai' | 'code';

/** Builds a gallery doc of many patterns — one `## <name>` section each. */
export function buildDesignDoc(filter?: DesignFilter): string {
  const inFilter = (p: DesignPattern): boolean =>
    filter === 'system'
      ? p.category === 'System design'
      : filter === 'ai'
        ? p.category === 'AI / agents'
        : filter === 'code'
          ? isGof(p.category)
          : true;
  const picked = DESIGN_PATTERNS.filter(inFilter);
  const title =
    filter === 'system'
      ? 'System design patterns'
      : filter === 'ai'
        ? 'AI & agent patterns'
        : filter === 'code'
          ? 'Code design patterns'
          : 'Design patterns';
  const cover = [
    '```meta',
    `title: ${q(title)}`,
    `subtitle: ${q('A gallery of common patterns — grab one with `avo design <slug>` and adapt it.')}`,
    `tag: ${q(`DESIGN · ${picked.length} PATTERNS`)}`,
    '```',
  ].join('\n');
  const sections = picked.map((p) => {
    const structure = structureBlock(p);
    return `## ${p.name}\n\n${patternBlock(p)}${structure !== '' ? `\n\n${structure}` : ''}`;
  });
  return `${cover}\n\n${sections.join('\n\n')}\n`;
}

/** Renders the gallery to html/slides and opens it (or writes to `output`). */
export async function runDesignGallery(opts: {
  readonly filter?: DesignFilter;
  readonly format?: SingleFormat;
  readonly output?: string;
  readonly preview?: boolean;
}): Promise<SingleResult> {
  const format = opts.format ?? 'html';
  const dir = join(tmpdir(), 'avodado-design');
  await mkdir(dir, { recursive: true });
  const input = join(dir, 'design.md');
  await writeFile(input, buildDesignDoc(opts.filter), 'utf8');
  return runSingle({
    cwd: dir,
    input,
    format,
    ...(opts.output !== undefined ? { output: opts.output } : { preview: opts.preview ?? true }),
  });
}
