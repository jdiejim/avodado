```meta
title: Plot transfer & waitlist
subtitle: How a Loamly garden plot moves from a leaving member to the next person in line.
tag: Spec · v1
```

Loamly manages 140 community gardens, and the median waitlist is 23 people
deep. Today a plot changes hands by email between the coordinator and
whoever answers first — position in line is a suggestion. This feature makes
the handover self-serve for the member and automatic for the waitlist, with
the coordinator as an approval gate only.

## The story

```userstory
id: ex-product-spec-story
role: plot holder who is moving away
want: hand my plot back without emailing the coordinator
soThat: the next person in line gets it before planting season
priority: High
points: 5
criteria:
  - { given: I hold an active plot, when: I start a transfer, then: the plot enters the offer flow and I keep access for up to 14 days }
  - { given: I am first on the waitlist, when: I receive an offer, then: I have 72 hours to accept before it moves on }
  - { given: I decline an offer, when: the next offer round starts, then: my waitlist position is unchanged }
links:
  - { ref: "#ex-product-spec-flow", mode: flow, label: Offer flow }
```

## Offer flow

```flow
id: ex-product-spec-flow
nodes:
  - { id: start, col: 1, row: 1, kind: start, label: Transfer started }
  - { id: approve, col: 2, row: 1, kind: decision, label: Coordinator approves? }
  - { id: keep, col: 2, row: 2, kind: end, label: Plot stays with holder }
  - { id: offer, col: 3, row: 1, kind: process, label: Offer to next in line }
  - { id: accept, col: 4, row: 1, kind: decision, label: "Accepted within 72 h?" }
  - { id: assign, col: 5, row: 1, kind: end, label: Plot assigned }
  - { id: more, col: 4, row: 2, kind: decision, label: More on waitlist? }
  - { id: dormant, col: 5, row: 2, kind: end, label: Dormant — coordinator review }
edges:
  - start -> approve
  - approve -x-> keep: "no"
  - approve -> offer: "yes"
  - offer -> accept
  - accept -> assign: "yes"
  - accept -> more: "no / expired"
  - more -> offer: "yes"
  - more -x-> dormant: "no, or 3 offers made"
```

The 72-hour window and the three-offer cap exist for the same reason. A
transfer that drags past two weeks straddles planting season, and a plot
idle in April is the outcome every party loses on.

## Invariants

```spec
id: ex-product-spec-invariants
accent: green
rows:
  - { label: One plot per member, value: "A member holds at most one active plot per garden. A transfer that would create a second is refused at start, not at assignment." }
  - { label: Sticky position, value: "Declining an offer keeps your waitlist position. Only accepting a plot removes the entry." }
  - { label: Offer window, value: "72 hours per offer, at most 3 offers per transfer, then the plot goes dormant for coordinator review." }
  - { label: Access overlap, steps: [Transfer starts, "Holder keeps access ≤ 14 days", Access ends at assignment] }
```

## Scope edges

```table
id: ex-product-spec-scope
columns: [Capability, v1, Why]
rows:
  - [Member-initiated transfer, { v: In, tone: pos }, The core loop above]
  - [Coordinator-forced reassignment, { v: In, tone: pos }, "Abandoned plots exist; coordinators need the same flow without the member"]
  - [Plot swaps between two members, { v: Out, tone: muted }, "2% of requests — stays manual"]
  - ["Priority rules (seniority, household size)", { v: Out, tone: muted }, "FIFO only in v1; priority differs per garden's bylaws and needs its own spec"]
  - [Plot fees and payments, { v: Out, tone: muted }, Handled off-platform today and out of this feature's blast radius]
```
