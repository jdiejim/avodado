```meta
title: Skerry API
subtitle: Render any URL to PNG, WebP, or PDF in three calls.
tag: API · v1
```

The base URL is `https://api.skerry.dev/v1`; authenticate every call with
`Authorization: Bearer sk_live_…`. Captures run asynchronously — a POST returns
`202` with an id, and the file arrives seconds later via webhook or polling. A
capture spends one credit only when it succeeds; rate limits are 10 requests
per second with bursts to 50.

## Create a capture

```endpoint
id: ex-api-create
method: POST
path: /captures
auth: Bearer sk_live_…
body:
  - { name: url, type: string, required: true, desc: "Page to render; must be reachable from the public internet" }
  - { name: format, type: string, desc: "png | webp | pdf — default png" }
  - { name: width, type: integer, desc: "Viewport width in px; default 1280" }
  - { name: full_page, type: boolean, desc: Capture the full scroll height }
  - { name: webhook_url, type: string, desc: Receives capture.finished / capture.failed }
responses:
  - { status: 202, desc: Capture queued }
  - { status: 402, desc: Credit balance is zero }
  - { status: 422, desc: URL malformed or scheme not http(s) }
request: |
  { "url": "https://example.com/pricing", "format": "png", "full_page": true }
response: |
  { "id": "cap_8fk2", "status": "queued" }
```

## Fetch a capture

```endpoint
id: ex-api-fetch
method: GET
path: /captures/{id}
description: result_url is a signed link that expires 24 hours after the capture finishes.
params:
  - { name: id, in: path, type: string, required: true, desc: Capture id from the create call }
responses:
  - { status: 200, desc: Capture in any status }
  - { status: 404, desc: Unknown or expired id }
response: |
  { "id": "cap_8fk2", "status": "done",
    "result_url": "https://files.skerry.dev/cap_8fk2.png?sig=…" }
```

## List captures

```endpoint
id: ex-api-list
method: GET
path: /captures
params:
  - { name: cursor, in: query, type: string, desc: Opaque cursor from the previous page }
  - { name: limit, in: query, type: integer, desc: "1–100, default 25" }
  - { name: status, in: query, type: string, desc: "Filter: queued | rendering | done | failed" }
responses:
  - { status: 200, desc: "Newest first, with next_cursor when more exist" }
```

## One capture, end to end

```sequence
id: ex-api-seq
actors:
  - { id: Client, name: Your server }
  - { id: Skerry, name: Skerry API }
  - { id: Hook, name: Your webhook, sub: webhook_url, external: true }
messages:
  - Client -> Skerry: POST /captures
  - Skerry --> Client: 202 · cap_8fk2 queued
  - { from: Skerry, to: Skerry, kind: note, label: "render, 2–8 s typical" }
  - { from: Skerry, to: Hook, label: POST capture.finished, kind: async, summary: "Signed with X-Skerry-Signature; non-2xx responses are redelivered 5 times over 30 minutes." }
  - Hook --> Skerry: 2xx ack
  - Client -> Skerry: GET /captures/cap_8fk2
  - Skerry --> Client: 200 · done + result_url
foot:
  - { label: Webhook delivery, value: at-least-once }
  - { label: result_url TTL, value: 24 h }
```

Webhook delivery is at-least-once, so make the handler idempotent on the
capture id. Polling is the fallback, not a race: `result_url` appears on
`GET /captures/{id}` the moment status is `done`, whether or not any webhook
was delivered.

## Errors

```table
columns: [Status, Meaning, What to do]
rows:
  - [401, Missing or revoked key, "Rotate the key in the dashboard; do not retry."]
  - [402, Credit balance is zero, "Top up; already-queued captures still finish."]
  - [422, URL invalid or scheme not http(s), Retrying identical input fails identically.]
  - [429, Rate limit exceeded, "Back off for Retry-After seconds, then retry."]
  - [500, Skerry fault, "Retry with backoff; the capture id stays valid."]
note: "A render that fails is not an HTTP error: the capture ends as status failed with a failure_reason, and spends no credit."
```

```callout
tone: warn
title: Verify X-Skerry-Signature
body: "Every webhook carries an HMAC-SHA256 of the raw body, keyed with your signing secret, plus a timestamp. Reject anything unsigned or older than five minutes — an unverified handler lets anyone mark your captures done."
```
