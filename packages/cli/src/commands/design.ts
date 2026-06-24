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
export type DesignCategory = 'System design' | 'Creational' | 'Structural' | 'Behavioral';

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
const isCode = (c: DesignCategory): boolean => c !== 'System design';

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

/** The full library, system-design first then the GoF code patterns. */
export const DESIGN_PATTERNS: readonly DesignPattern[] = [...SYSTEM, ...CODE];

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

/** Renders a full standalone doc (meta cover + pattern block) for one pattern. */
export function patternDoc(p: DesignPattern): string {
  const meta = [
    '```meta',
    `title: ${q(p.name)}`,
    `subtitle: ${q(p.summary)}`,
    `tag: ${q(`${p.category.toUpperCase()} · PATTERN`)}`,
    '```',
  ].join('\n');
  return `${meta}\n\n${patternBlock(p)}\n`;
}

/** Builds a gallery doc of many patterns — one `## <name>` section each. */
export function buildDesignDoc(filter?: 'system' | 'code'): string {
  const picked = DESIGN_PATTERNS.filter((p) =>
    filter === 'system' ? p.category === 'System design' : filter === 'code' ? isCode(p.category) : true,
  );
  const title =
    filter === 'system' ? 'System design patterns' : filter === 'code' ? 'Code design patterns' : 'Design patterns';
  const cover = [
    '```meta',
    `title: ${q(title)}`,
    `subtitle: ${q('A gallery of common patterns — grab one with `avo design <slug>` and adapt it.')}`,
    `tag: ${q(`DESIGN · ${picked.length} PATTERNS`)}`,
    '```',
  ].join('\n');
  const sections = picked.map((p) => `## ${p.name}\n\n${patternBlock(p)}`);
  return `${cover}\n\n${sections.join('\n\n')}\n`;
}

/** Renders the gallery to html/slides and opens it (or writes to `output`). */
export async function runDesignGallery(opts: {
  readonly filter?: 'system' | 'code';
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
