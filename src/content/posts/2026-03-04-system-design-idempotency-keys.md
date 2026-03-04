---
title: "System Design Daily: Idempotency Keys for Safe Retries"
pubDate: 2026-03-04
description: "How to make write APIs retry-safe without pretending you have true exactly-once delivery."
tags: ["system-design", "engineering", "distributed-systems", "apis", "reliability"]
---

If you operate anything over a network, you’re operating in a world where **retries are inevitable**.

Clients retry because:

- the request timed out (but maybe your server actually processed it),
- the client lost connectivity after sending,
- a load balancer reset the connection,
- the server returned a transient error,
- or a user double-tapped the “Buy” button.

If a retry turns one intended action into *two* actions, you’ll eventually ship the worst kind of bug: **money moved twice, inventory decremented twice, emails sent twice, or accounts created twice**.

The system design concept that keeps you sane here is **idempotency**—specifically, **idempotency keys** for write operations.

This post is about building “exactly-once-ish” behavior on top of the reality: most systems are *at-least-once*.

## Problem framing: “I sent it once” is not a guarantee

From a distributed systems perspective, a client can’t distinguish between:

1) “the server never saw my request” and
2) “the server processed it, but I never saw the response.”

Both look like a timeout.

If your API is a write (create order, charge card, book reservation), the naive behavior on retry is **duplicate side effects**.

You want a property like:

> If the client repeats the *same* logical request, the server performs the side effect at most once.

That’s idempotency.

## Core concepts

### Idempotent vs non-idempotent operations

An operation is **idempotent** if applying it multiple times has the same effect as applying it once.

- Good: `PUT /users/123` with the *full desired state* (set name to “Chris”) can be idempotent.
- Risky: `POST /orders` (create a new order) is usually not idempotent by default.

HTTP tries to encode some of this (GET/PUT/DELETE are intended to be idempotent; POST typically isn’t), but that’s only a convention. Real systems still need explicit protection because networks retry regardless of verb.

### Idempotency key: “this is the same request as before”

An **idempotency key** is a client-provided unique token that identifies *one logical operation*.

Example header:

```http
POST /v1/orders
Idempotency-Key: 0f3d9e2b-9ad2-4f9f-bc54-2a47a3b0e8f2
Content-Type: application/json

{"userId":"u_123","sku":"SKU-9","qty":1,"priceCents":1299}
```

Server behavior:

- If it has never seen that key, process the request and **store the outcome**.
- If it has seen that key before, **return the stored outcome** (same order id, same status), without redoing side effects.

This converts an at-least-once request channel into an effectively *at-most-once side effect*—for that operation.

### What exactly do you store?

At minimum, store:

- `idempotency_key`
- a **request fingerprint** (more on this in a second)
- `status` (in-progress/succeeded/failed)
- the response payload (or a pointer to it)
- timestamps + TTL/expiration

And critically, store it in a place that’s **consistent with the side effect**.

If you store the idempotency record in cache but the side effect happens in a database, you can still double-execute on cache loss.

## A small example: creating an order safely

Let’s make the failure concrete.

Assume:

- p99 network latency: 800ms
- client timeout: 500ms
- server processing: 300–700ms

A normal timeline:

1) client sends `POST /orders`
2) server creates an order row and charges the payment processor
3) server responds `201 {orderId: "o_789"}`

Now the bad timeline:

1) client sends request
2) server completes the charge and creates `o_789`
3) response is lost; client times out at 500ms
4) client retries the same request
5) server creates **another** order `o_790` and charges **again**

With idempotency keys:

- Request 1 creates idempotency record `key → o_789`
- Request 2 hits the record and returns `o_789` without charging again

### The request fingerprint rule (don’t skip this)

You should detect clients accidentally reusing a key for a *different* request.

So store a fingerprint like:

- `hash(method + path + canonical_json(body) + user_id)`

On a repeated key:

- if fingerprint matches: return stored response
- if fingerprint differs: return **409 Conflict** (or 422) because the client is mixing operations under one key

That one check prevents a whole class of “why did I get someone else’s order id?” horror stories.

## Implementation patterns (and where they bite you)

### Pattern A: Idempotency table with a unique constraint

Create a table:

```sql
CREATE TABLE idempotency_keys (
  key TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  status TEXT NOT NULL,        -- in_progress | succeeded | failed
  response_json TEXT,          -- or response_blob pointer
  created_at TIMESTAMP NOT NULL,
  expires_at TIMESTAMP NOT NULL
);
```

Flow:

1) Begin transaction
2) Insert `(key, user_id, request_hash, status='in_progress')`
   - if insert fails due to duplicate key, fetch existing row
3) If existing is `succeeded`, return stored response
4) If existing is `in_progress`, either:
   - block/wait briefly, or
   - return `409 In Progress` / `202 Accepted` and let the client poll
5) If inserted successfully, execute side effect(s)
6) Update row to `succeeded` with response
7) Commit

**Tradeoff:** you now have an extra write per idempotent call, and you need to decide retention/TTL.

### Pattern B: “Outbox + idempotency” for message-driven side effects

If your endpoint produces an event (e.g., `OrderCreated`) that downstream services consume, use:

- idempotency key to protect the “create order + enqueue event” step
- and **a consumer-side dedupe** (because consumers also retry)

A classic approach is the transactional outbox (write to `orders` and `outbox` in one DB transaction), then a relay publishes the outbox row to Kafka/SQS/etc.

This avoids “order exists but event lost” and makes retries much safer.

## Tradeoffs: what you gain vs what you pay

### What you gain

- **Retry safety** for write endpoints
- Cleaner client behavior (clients can retry aggressively without fear)
- Better user experience (no duplicate “thank you” emails, no double charges)

### What you pay

- Additional storage + writes
- Complexity around TTLs and status transitions
- Subtle edge cases (in-progress requests, partial failures)

### TTL: how long should you remember?

There’s no universal answer, but you should align with:

- the client’s retry behavior (minutes? hours?)
- the business risk (payments might warrant 24–72 hours)
- compliance/logging needs

A practical baseline:

- **24 hours** for high-risk side effects (payments, reservations)
- **1–6 hours** for medium risk (creating an internal job)

## Common failure modes (learn these before prod teaches you)

### 1) “In-progress” stuck forever

If you write `in_progress` and crash before marking success/failure, subsequent retries will see a key that never resolves.

Mitigations:

- store `created_at` and treat very old `in_progress` as retryable
- have a background reaper that marks stale in-progress as failed
- or store a lease/owner id so only one worker can complete it

### 2) Non-atomic side effects

If your flow is:

- write idempotency record in DB
- call payment processor
- write order row

…then a crash between those steps can produce inconsistent state.

Mitigations:

- wrap what you can in a DB transaction
- make external calls idempotent too (many payment APIs support their own idempotency keys)
- design compensations (refund) when you can’t guarantee atomicity

### 3) Dedupe scoped incorrectly

If you dedupe only on `key` but keys are only unique *per user* (or per client), you can accidentally collide.

Pick a scope and enforce it:

- simplest: keys are globally unique (UUID) and you still store `user_id` for authorization checks

### 4) Reusing keys across “similar but not identical” requests

This happens in real client code when developers cache the key too aggressively.

That’s why the request fingerprint check matters.

### 5) Returning the wrong kind of response

When a retry hits a stored response, the server should ideally return:

- the same status code (e.g., 201)
- the same response body

If you return 200 sometimes and 201 other times, clients will build weird conditional logic.

Consistency is a feature.

## How to test and observe this in production

### Testing: simulate the failures you *actually* get

Do more than “unit test the happy path.”

1) **Timeout + retry test**
   - Force the server to sleep past the client timeout.
   - Ensure the retry returns the same `orderId` and does not double-execute side effects.

2) **Crash between steps**
   - Kill the server after inserting `in_progress`.
   - Restart and retry. Verify the system un-sticks (via TTL or recovery logic).

3) **Concurrent duplicate requests**
   - Fire 10 requests with the same key concurrently.
   - Verify exactly one executes the side effect; the rest are served from stored result or blocked.

4) **Key reuse with different payload**
   - Same key, different JSON body → expect 409/422.

If you have a staging environment, add a chaos test that drops responses at the load balancer layer (or injects 5–10% response loss).

### Observability: metrics and logs that make duplicates obvious

At minimum, emit:

- `idempotency.hit` (served from stored outcome)
- `idempotency.miss` (new key)
- `idempotency.in_progress` (duplicate while processing)
- `idempotency.conflict` (same key, different fingerprint)
- `idempotency.stale_in_progress` (if you implement reaping)

And tie them to:

- endpoint name
- client id / SDK version (if you have it)
- error class

A healthy system often has a *non-zero* hit rate—because retries are normal. A sudden spike in hits or conflicts is a client regression warning.

## A slightly opinionated take

If your API performs a side effect that users will notice (or finance will notice), **require idempotency keys**.

Don’t make it “optional but recommended.” Optional becomes “nobody does it.”

You can enforce it incrementally:

- warn and log when missing
- then block for high-risk endpoints

It’s one of those boring design choices that feels like bureaucracy—right up until the day it saves your company from a painful incident.

## Further reading

- Stripe: Idempotent Requests (clear, practical guidance): https://stripe.com/docs/idempotency
- HTTP Semantics (idempotent methods and retry behavior): https://www.rfc-editor.org/rfc/rfc9110
- Transactional Outbox pattern (for reliable event publication): https://microservices.io/patterns/data/transactional-outbox.html

