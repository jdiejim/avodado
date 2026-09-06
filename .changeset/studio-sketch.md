---
'@avodado/studio': minor
---

Pen mode — draw a rough shape on a diagram and get the right node. Press `D`
on a selected diagram block (or hit the pen in its floating toolbar), and the
block becomes a drawing surface: strokes leave an ink trail, and on release
the stroke's bounding-box centre snaps to a grid cell, the cell flashes, and
the node commits and pops. A rectangle is a process (flow) or a service
(block, c4, dfd, felogic); a diamond is a decision or a gateway; a pill or an
ellipse is the start of a flow, then its end; a cylinder is a database or a
store; a hexagon is a gateway, then a queue; a triangle is an error exit, or a
k8s ingress. A LINE between two nodes becomes an edge in the direction it was
drawn; from a node into empty space it adds a node there and connects it. A
scribble over a node deletes it. Esc leaves pen mode; touch and stylus work
(`touch-action: none` while drawing), and `prefers-reduced-motion` skips the
flash.

Recognition is a $1 unistroke recognizer (`direct/sketch.ts`, pure) with
programmatically generated templates. It is tuned for PRECISION over recall:
a stroke is only committed when it beats the runner-up shape by a margin, so
a genuinely ambiguous read (a stadium and an ellipse are close under hand
noise) opens the existing kind picker at that cell with the near-miss kinds
listed first, instead of inserting the wrong node. A shape with no meaning on
the block — a cylinder on a state machine — opens the picker too. Studio
still writes only DATA to the `.md`: node kind, `col`/`row`, and edges.
