```meta
title: An agent you can reason about
subtitle: Tools, memory, evidence, and a clear stopping point. A worked design for a research assistant.
tag: AI SYSTEM · EXAMPLE
```

The agent gathers evidence before it writes an answer. It returns source links and marks unresolved claims when its tool budget runs out.

```agentloop
id: research-agent-loop
title: Research. Verify. Answer.
agent:
  name: Research agent
  model: Tool-calling LLM
  note: "Build a cited answer. Keep uncertainty visible."
env: Researcher
tools:
  - { name: search_sources, desc: "Find relevant sources" }
  - { name: read_source, desc: "Read the original text" }
  - { name: compare_claims, desc: "Find gaps and conflicts" }
memory:
  - research question
  - source links + excerpts
  - unresolved claims
stop: "Return a cited answer after verification, or report gaps after eight tool rounds."
```

The application enforces the tool budget and retains the evidence for review. Source links let a reader inspect the material behind each claim.

```c4
id: research-agent-context
title: Keep the model behind an application boundary
level: container
boundaries:
  - { label: Research workspace, nodes: [app, evidence] }
nodes:
  - { id: user, kind: person, name: Researcher, col: 1, row: 1 }
  - { id: app, kind: container, name: Agent runtime, tech: TypeScript, col: 2, row: 1 }
  - { id: model, kind: external, name: Model API, tech: Tool calling, col: 3, row: 1 }
  - { id: evidence, kind: store, name: Evidence store, tech: SQLite, col: 2, row: 2 }
  - { id: sources, kind: external, name: Source tools, tech: Search + fetch, col: 3, row: 2 }
edges:
  - { from: user, to: app, label: asks a question, tech: HTTPS }
  - { from: app, to: model, label: requests next action, tech: HTTPS }
  - { from: app, to: evidence, label: records evidence, tech: SQL }
  - { from: app, to: sources, label: gathers sources, tech: HTTPS }
```

Reserve room for tool results before the next call. This illustrative budget leaves 24,000 tokens free in a 64,000-token window.

```context
id: research-agent-context-budget
title: Give the next tool result room to fit
window: 64000
segments:
  - { label: Instructions, tokens: 4000, accent: navy }
  - { label: Tool schemas, tokens: 4000, accent: teal }
  - { label: Source excerpts, tokens: 20000, accent: amber }
  - { label: Conversation, tokens: 12000, accent: purple }
```
