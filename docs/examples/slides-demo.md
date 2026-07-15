```meta
title: Slides demo
subtitle: A quick deck to test header-based slides — each # heading is a new slide.
tag: DEMO · DECK
```

# Why slides changed

Each `#`/`##` heading now starts a new slide and is its title. Everything under
it — prose **and** blocks — stays on that slide.

```drivers
items:
  - { title: Header-driven, body: "A new slide at each heading.", tag: "NEW", icon: layers, accent: blue }
  - { title: Real titles, body: "The heading sits at the top.", tag: "NICE", icon: flag, accent: green }
  - { title: Multi-block, body: "Stack blocks under one heading.", tag: "FLEXIBLE", icon: grid, accent: amber }
```

# Two blocks, one slide

No heading until the next one — so this prose, these numbers, and the callout all
share the slide.

```stats
stats:
  - { value: "1", label: Slide, trend: flat }
  - { value: "3", label: Blocks here, trend: up }
  - { value: "0", label: Manual breaks needed, trend: down }
```

```callout
tone: success
body: Everything until the next heading lands on the same slide.
```

# How access is decided

```composition
result: 200 OK
gates:
  - { kicker: "L1 · Identity", label: Valid token, desc: "A signed-in user.", source: "Source: JWT" }
  - { kicker: "L2 · Scope", label: In range, desc: "Request site is allowed.", source: "Source: lookup" }
  - { kicker: "L3 · Permission", label: Allowed, desc: "Action is granted.", source: "Source: app DB" }
```

# Where to invest

```quadrant
xAxis: { label: Effort, low: Low, high: High }
yAxis: { label: Impact, low: Low, high: High }
items:
  - { x: 0.25, y: 0.85, label: Ship slides }
  - { x: 0.7, y: 0.6, label: More themes }
  - { x: 0.3, y: 0.3, label: Docs }
```

# The plan

```timeline
items:
  - { label: "Now — header slides", date: Now, status: current }
  - { label: "Next — polish", date: Next, status: next }
  - { label: "Later — more blocks", date: Later, status: future }
```
