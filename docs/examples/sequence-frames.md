```meta
title: Access-token refresh
subtitle: How a client trades a refresh token for a new access token, and what happens when the token is expired or reused.
tag: Auth · example
```

## The refresh flow

The client sends its refresh token to the gateway. The auth service reads the token family from the store. Then it takes one of three paths: the token is valid and unused, the token was used before (reuse), or the token is expired. Each refresh token is single-use. A second use revokes the whole family.

The diagram uses frames for the branches, explicit activation bars, a self-message for the rate-limit check, and a note over two actors.

```sequence
id: seq-token-refresh
title: Refresh with rotation and reuse detection
endpoint: { method: POST, path: /oauth/token }
actors:
  - { id: App, name: Mobile app, sub: client, external: true }
  - { id: Gateway, name: API gateway, sub: edge }
  - { id: Auth, name: Auth service, sub: token issuer }
  - { id: Store, name: Token store, sub: postgres }
messages:
  - { from: App, to: Gateway, label: POST /oauth/token, activate: true, summary: "grant_type=refresh_token with the current refresh token." }
  - Gateway -> Gateway: rate-limit check
  - { from: Gateway, to: Auth, label: refresh(token), activate: true, summary: "The gateway forwards the token to the auth service." }
  - Auth -> +Store: SELECT family, used_at
  - Store --> -Auth: row
  - alt: token valid
  - alt: reuse detected
  - { from: Auth, to: Store, label: revoke family, summary: "A used token came back. Every token in the family is revoked." }
  - Auth -x-> Gateway: 401 invalid_grant (reuse)
  - else: first use
  - { from: Auth, to: Store, label: rotate → new pair, summary: "The old refresh token is marked used; a new access + refresh pair is issued." }
  - Auth --> Gateway: 200 access + refresh
  - end
  - else: expired
  - { from: Auth, to: Gateway, label: 401 invalid_grant, kind: error, deactivate: true, summary: "The client must sign in again." }
  - end
  - opt: telemetry enabled
  - Auth -> Auth: emit token.refreshed
  - end
  - Gateway --> -App: response
  - { from: App, to: Auth, kind: note, label: The refresh token rotates on every use. A second use of an old token revokes the whole family. }
foot:
  - { label: Access TTL, value: 15 min }
  - { label: Refresh TTL, value: "30 days, rotating" }
```

## The grammar in one place

```table
title: Frame markers and activation signs
columns: [Item, Terse form, Object form]
rows:
  - [Open a frame, "alt: guard · opt · loop: guard · par · break · critical", "{ frame: alt, label: guard }"]
  - [Next branch, "else: guard", "{ else: guard }"]
  - [Close the frame, end, "{ end: true }"]
  - [Open a bar on the target, "A -> +B: call", "{ from: A, to: B, activate: true }"]
  - [Close the sender's bar, "B --> -A: reply", "{ from: B, to: A, deactivate: true }"]
```

```callout
tone: tip
title: When to write the sign
body: Put the `-` on the reply that leaves the bar. In an `alt`, put it on the last branch only — the bar then spans every branch, which is what the reader expects.
```
