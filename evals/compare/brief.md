# Brief — access-token refresh

Draw a sequence diagram for this flow.

Participants: the SPA (browser), the API gateway, the Resource API, the
Auth service, the Token store (Redis), and the Audit topic (Kafka).

1. The SPA calls GET /orders with a bearer access token, through the API
   gateway.
2. The gateway validates the token with the Auth service, which checks the
   Token store.
3. If the token is valid: the gateway forwards the call to the Resource API,
   which returns 200 with the body; the gateway returns it to the SPA.
4. If the token is expired: the Auth service answers 401, the gateway
   returns 401 to the SPA.
5. The SPA then calls POST /token with its refresh token. The Auth service
   looks the refresh token up in the Token store.
6. If that refresh token was already rotated (reuse detected): the Auth
   service revokes the whole token family, writes the revocation to the
   Token store, returns 401 invalid_grant, and the SPA redirects to the
   login page.
7. Otherwise: the Auth service rotates the refresh token, persists the new
   access + refresh pair in the Token store, returns 200 with the new pair,
   and the SPA retries GET /orders, which now succeeds through the gateway
   and Resource API with 200.
8. After either outcome of the refresh, the Auth service emits an
   asynchronous audit event to the Audit topic: `token.refreshed` or
   `token.reuse_detected`.
9. Make it clear that the retry is attempted at most once.
