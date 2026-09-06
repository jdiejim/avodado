---
'@avodado/core': minor
'@avodado/render': minor
'avodado': patch
'@avodado/mcp': patch
'@avodado/studio': patch
---

`block` learns deployment topology. Groups nest by declaration: `groups[].parent: <id>` places a zone inside a region and a subnet inside the zone; the renderer draws parents first and steps each child in 8px with its own eyebrow tab (three levels read), and `avo check` warns (`W_GROUP_NESTING`) when a child's cells fall outside its parent or the `parent` id resolves to nothing. Nodes take `replicas: N` — from 2 up the node draws as a stacked card (two offset paper cards behind) with a `×N` chip, and the legend names it. `preset: k8s` frames a Kubernetes namespace map: `ingress` (the entry, so the accent), `service`, `deployment`, `pod`, `configmap`, `secret`, `job` / `cronjob`, `node` and `namespace` get chips, shapes and glyphs. A new cloud glyph set (`svg/glyphs.ts`) draws one 14px single-stroke `muted` path per kind — function, bucket, queue, topic, cache, db, cdn, lb, gateway, pod, cluster, user, browser, mobile, cron, ml, secret, config — with a generic box for everything else. `cluster` follows the family's accent rule: the single `gateway`-kind service, when exactly one exists. Documents without `parent` or `replicas` render byte-for-byte as before.
