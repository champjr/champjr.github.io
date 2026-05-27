---
title: "System Design Daily: Optimistic Concurrency Control with Compare-and-Swap"
pubDate: 2026-05-27
description: "How version checks and conditional writes prevent lost updates without turning every write path into a lock fight."
tags: ["system-design", "engineering", "distributed-systems", "databases", "consistency"]
---

A lot of distributed data bugs come from one deceptively simple problem: two writers both think they are allowed to update the same thing.

One request reads a balance of 100. Another request reads the same balance of 100. Both compute a new value. Both write it back. One of those writes just silently erased the other.

That is the lost update problem, and if you do not design for it explicitly, it shows up everywhere: inventory counts, profile edits, billing state, job claims, quota usage, config changes, and cache invalidation markers.

Optimistic concurrency control, usually shortened to OCC, is one of the cleanest ways to handle it.

The basic idea is simple. Do not lock the record up front. Let concurrent actors proceed, but require each write to prove that the state it read is still the state that exists. If not, reject the write and make the caller retry or reconcile.

In practice, that usually means a compare-and-swap style write: update this row, document, or key **only if** its version is still the one I read earlier.

I like OCC because it is honest. It assumes conflicts are possible, but not constant. When that assumption is true, you get correctness without turning the whole system into a traffic jam.

## The problem

Suppose you run a product catalog service. Two admins edit the same product at nearly the same time.

- Admin A changes the price from 20 to 22.
- Admin B changes the description.

If your update API is effectively “last write wins,” whichever request lands second overwrites the first writer's view of the record. Sometimes that is acceptable. Often it is quietly terrible.

The same pattern shows up in machine-to-machine systems:

- two workers claim the same job
- two API servers decrement the same stock count
- a payment service marks an invoice paid while another service voids it
- one deployment controller updates config while another rolls back to an older snapshot

If the write path has no concurrency contract, success responses can still produce bad state.

## Core concepts

### 1) Read state plus a version

OCC starts by attaching a version to mutable state.

That version might be:

- an integer revision like `version = 42`
- a timestamp, though integer counters are usually safer
- an ETag in HTTP
- a database row version such as PostgreSQL's `xmin` or an explicit revision column

The reader fetches both the data and the version:

```json
{
  "productId": "p123",
  "price": 20,
  "description": "Canvas backpack",
  "version": 7
}
```

### 2) Write only if the version still matches

The client sends back its intended update with the expected version:

```http
PATCH /products/p123
If-Match: "7"
```

Or in a database:

```sql
UPDATE products
SET price = 22, version = version + 1
WHERE product_id = 'p123' AND version = 7;
```

If one row updates, great. If zero rows update, someone else changed the record first, and this write must not pretend it succeeded.

That zero-row update is the whole trick.

### 3) Conflicts are a feature, not a bug

OCC does not eliminate contention. It exposes contention.

That is an important mindset shift. A rejected conditional write is not necessarily a failure of the system. It may be proof that the system prevented silent corruption.

Then you decide what the caller should do:

- re-read and retry automatically
- merge fields if safe
- tell the user the object changed underneath them
- abort and route to manual review

### 4) OCC works best when conflicts are relatively rare

This is why it is called optimistic.

If most writes do not collide, avoiding locks keeps throughput high and latency lower. If the same hot record is constantly being updated, OCC can devolve into a retry treadmill. That is a sign you may need a different design, not just more retries.

## A small example

Imagine an inventory service for a flash sale. Product `sku-9` has 5 units left.

Two checkout requests arrive at the same time.

Both read:

```json
{ "sku": "sku-9", "available": 5, "version": 101 }
```

Both want to reserve 4 units.

A naive design might do this:

```txt
read available=5
compute new available=1
write available=1
```

Both requests succeed, and you have now promised 8 units out of 5.

With OCC, each request attempts:

```sql
UPDATE inventory
SET available = available - 4,
    version = version + 1
WHERE sku = 'sku-9'
  AND version = 101
  AND available >= 4;
```

Now only one request can win.

- First writer updates the row to `available=1, version=102`
- Second writer affects zero rows because the version no longer matches

That second caller can re-read and discover there is not enough stock left.

This is much better than “both got a 200, good luck.”

## Tradeoffs

Here is the compact version:

| Upside | Cost |
| --- | --- |
| prevents lost updates | caller must handle conflicts |
| avoids lock-heavy write paths | retries can add latency |
| scales well when contention is low | hot keys can thrash |
| works across databases, caches, and APIs | version fields and semantics must be designed carefully |

A few practical tradeoffs matter most.

### Lower coordination, more retry logic

OCC pushes complexity away from locks and toward application behavior. That is usually a good trade, but only if the retry path is designed intentionally.

Blind retries are not enough. If the update is not commutative, the caller may need to recompute against fresh state, not simply resend the same write.

### Better concurrency, weaker fairness

Pessimistic locking can be unfair too, but OCC especially favors whichever writer keeps arriving at the right moment. Under heavy contention, one aggressive client can repeatedly win while others starve unless you back off or serialize elsewhere.

### Simpler than distributed locking, but not a magic wand

People sometimes reach for distributed locks when a conditional write would do. I think that is often overengineering.

If the invariant is scoped to one logical record or one partition key, conditional writes are usually the cheaper and safer first move. Save distributed locks for cases where the invariant truly spans multiple mutable resources and cannot be expressed atomically.

## Common failure modes

### 1) Last-write-wins hidden behind a friendly API

An API that accepts full-object `PUT` requests without any version precondition is a conflict machine. It looks harmless because every request returns success.

That is the worst kind of bug: the kind your monitoring may call healthy.

### 2) Auto-retrying writes that should be re-evaluated

Suppose a discount engine reads an order total, applies a rule, and writes a new total conditionally. If the write conflicts, simply replaying the stale update may be wrong. The order contents may have changed. Re-read, recompute, then attempt again.

### 3) Using timestamps as versions without clear guarantees

Timestamps can work, but they are surprisingly easy to misuse. Clock skew, coarse precision, and multiple writes within the same tick can break assumptions. Monotonic integer versions are usually less slippery.

### 4) Hot rows causing retry storms

Think quotas, counters, or a global “current state” row. If thousands of writers compete on one item, OCC can produce a lot of failed attempts.

At that point, the design problem is often the hot spot itself. Consider sharded counters, escrow techniques, partitioning, or queueing updates through a single owner.

### 5) Pretending cross-record invariants are solved

OCC on one row does not automatically protect a multi-row business rule.

If you need “user cannot have more than three active sessions across all devices” or “sum of allocations across child records must stay below a limit,” you need to think carefully about transaction boundaries, materialized ownership records, or serialized coordinators.

Conditional writes are powerful, but they only guard the thing they actually compare.

## How to test it before production

Test the conflict path as a first-class behavior, not as an edge case nobody ever sees.

### Test 1: simultaneous writers

Start two clients from the same snapshot and race them. Verify that only one conditional write succeeds and the loser gets a typed conflict result, not a generic 500.

### Test 2: stale retry behavior

Force a conflict, then confirm the caller re-reads before retrying when recomputation is required.

### Test 3: hot-key load

Hammer one record with a few hundred concurrent updates. Measure:

- conditional write success rate
- retry count per successful mutation
- end-to-end latency
- whether a subset of clients dominates success

This tells you whether OCC is still efficient at your expected contention level.

### Test 4: partial update semantics

If your API allows field-level edits, verify that safe merges stay safe and unsafe merges fail loudly. “Price changed” and “description changed” might be mergeable. “Available credit changed” probably is not.

### Test 5: observability contract

Make sure conflict responses are distinguishable from true system errors. A `409 Conflict`, `412 Precondition Failed`, or explicit conditional-check-failed error is far more useful than a vague “write failed.”

## What to observe in production

If you deploy OCC, watch both correctness and contention.

At minimum, instrument:

- conditional write failure rate
- retry rate and retry depth
- latency added by conflict resolution
- hot keys or partitions by conflict count
- successful writes versus attempted writes
- user-visible conflict responses

A very useful derived metric is **conflicts per logical object**. Global conflict rate can look fine while one tenant, one SKU, or one account is getting absolutely hammered.

I also like traces that split mutation time into:

```txt
read current state -> compute update -> conditional write -> conflict? -> reread/retry
```

That makes it obvious whether pain lives in storage latency or in application-level recomputation loops.

## When to use it, and when not to

Use OCC when:

- writes usually target different records
- conflicts are possible but not constant
- you need to prevent lost updates cleanly
- your datastore supports conditional writes or atomic compare-and-set operations

Be cautious when:

- one key is extremely hot
- every failed attempt is expensive to recompute
- the invariant spans many objects and cannot be atomically checked together

My opinionated rule of thumb: if your first instinct is “we need a lock,” stop and ask whether a version check would solve the real problem with less operational drama.

A lot of the time, it will.

## Further reading

- [Martin Kleppmann, *Designing Data-Intensive Applications*](https://dataintensive.net/)
- [Amazon DynamoDB condition expressions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.ConditionExpressions.html)
- [MDN: HTTP ETag](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag)
- [PostgreSQL explicit locking docs, useful contrast with lock-based approaches](https://www.postgresql.org/docs/current/explicit-locking.html)
