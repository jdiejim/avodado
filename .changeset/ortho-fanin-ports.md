---
'@avodado/render': patch
'@avodado/studio': patch
'@avodado/mcp': patch
---

Fan-in entry ports in the shared `ortho` edge router: when two or more edges terminate on the same side of the same node, each gets its own entry port along that side (centered spread, 8px apart, capped to the side's length, ordered by source node id), so their final segments and arrowheads no longer stack. A side with a single incoming edge keeps the previous geometry byte-for-byte. Applies to every block-diagram renderer that routes with `ortho` (block, flow, graph, dfd, state, c4, cluster, swimlane, felogic and their aliases). Studio and MCP are patched because they bundle the renderer.
