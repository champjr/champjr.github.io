---
title: "System Design Daily: Materialized Views and Async View Maintenance"
pubDate: 2026-05-25
description: "How to keep read models fast without turning freshness, retries, and backfills into a mess."
tags: ["system-design", "engineering", "distributed-systems", "databases", "performance"]
---

A lot of systems have the same awkward shape: writes are simple, reads are expensive.

Orders live in one table, payments in another, shipments in a third, and the dashboard wants a neat answer like "show me every delayed order for tenant 42 in the last 24 hours." You can absolutely answer that with joins, filters, and aggregations on demand. Right up until traffic grows, product asks for more dimensions, and your "one query" becomes the slowest part of the request path.

This is where materialized views earn their keep.

I like to describe a materialized view as a precomputed answer you are willing to maintain. You spend extra work on the write side so the read side stops doing heroics.

The catch is that view maintenance is a system design problem, not a SQL checkbox.

## The problem

Suppose you run a commerce platform with these read requirements:

- customer support needs an order timeline page under 150 ms
- finance needs daily revenue by region
- merchants want a live-ish dashboard of order counts by status

The source of truth may be normalized and operationally healthy, but those read patterns are terrible fits for repeated heavy joins and aggregations. If every page view recomputes everything from raw tables, your database becomes a reporting engine by accident.

Materialized views let you shift that cost forward. Instead of computing on every read, you precompute and store the result in a read-optimized shape.

That sounds easy until reality shows up:

- how fresh does the view need to be?
- what happens when updates arrive out of order?
- how do you repair drift after bugs or missed events?
- what does "correct" mean during retries and partial failures?

## Core concepts

### 1) A materialized view is a read model, not the source of truth

This distinction matters.

The base tables or event log own correctness. The view owns speed and convenience. Once you accept that, the design gets cleaner because you stop pretending the view is magical. It is derivative data, and derivative data needs rebuild paths.

### 2) Sync maintenance buys freshness, async maintenance buys resilience

There are two broad ways to keep a view updated.

**Synchronous maintenance:** update the view in the same transaction as the write.

Pros:

- strongest freshness
- simple mental model for small systems
- no lag between write and read model

Cons:

- increases write latency
- couples write path to read-model complexity
- can create lock contention and large fan-out writes

**Asynchronous maintenance:** commit the source-of-truth write first, then update the view later from CDC, an outbox, or a stream.

Pros:

- keeps the primary write path simpler
- isolates failures better
- scales to multiple downstream views

Cons:

- introduces lag
- requires idempotency and replay handling
- needs operational tooling for drift and backfills

For most systems beyond toy scale, async maintenance is the more honest choice.

### 3) The unit of maintenance matters

You can maintain views by:

- recomputing full snapshots on a schedule
- applying incremental deltas per event
- using a hybrid, incremental updates plus periodic rebuilds

Full refresh is operationally simple but often too expensive. Incremental maintenance is efficient but brittle if your update logic is wrong. Hybrid designs are common because they give you both fast steady-state behavior and a safety net.

## A small example

Say an order service emits events:

```json
{ "type": "OrderPlaced", "orderId": "o1", "tenantId": "t9", "amount": 120 }
{ "type": "PaymentCaptured", "orderId": "o1", "capturedAt": "2026-05-25T13:02:00Z" }
{ "type": "OrderShipped", "orderId": "o1", "warehouse": "dfw-2" }
```

You want a read model called `merchant_order_summary`:

```txt
(order_id, tenant_id, amount, payment_state, shipping_state, last_updated_at)
```

A consumer reads events and upserts the row.

```txt
on OrderPlaced      -> insert row if absent
on PaymentCaptured  -> set payment_state = 'captured'
on OrderShipped     -> set shipping_state = 'shipped'
```

Now the merchant dashboard can fetch a tenant's recent orders with a cheap indexed query instead of runtime joins across several operational tables.

The important design question is not "can I upsert a row?" It is "what happens if `OrderShipped` arrives twice, or before `PaymentCaptured`, or after a consumer restart that replays yesterday's events?"

That is why view maintenance logic must be idempotent and order-aware where necessary.

## Tradeoffs

| Design choice | Good at | Painful when |
| --- | --- | --- |
| Sync view update | immediate consistency | writes are high-volume or touch many projections |
| Async via event stream | decoupling and scale | readers need exact freshness right now |
| Full rebuilds | correctness recovery | dataset is large or rebuild windows are tight |
| Incremental updates | efficiency | event semantics are messy or incomplete |

A practical rule: if the business can tolerate seconds of lag, buy yourself the operational advantages of async maintenance.

Another opinionated rule: never adopt materialized views just because a query is ugly. Use them when a read pattern is important enough to deserve its own maintained shape.

## Common failure modes

### 1) Treating lag as a surprise

Teams ship an async read model and only later discover users notice stale numbers.

That is not a bug in the database. That is a product contract you failed to define. Every view should have an explicit freshness target, like p95 lag under 5 seconds.

### 2) Non-idempotent consumers

If replaying the same event increments counters again or duplicates rows, you do not have a recoverable system. You have a one-shot demo.

Track event IDs, versions, or sequence numbers. Make reprocessing boring.

### 3) Missing delete semantics

Inserts and updates get attention. Deletes get forgotten.

If a source record is removed, redacted, merged, or expires by TTL, your view needs a corresponding rule. Otherwise the read model becomes a graveyard of ghosts.

### 4) Schema evolution without projection evolution

A new source event field lands, producers change behavior, and the view code quietly keeps using old assumptions. The projection does not crash, but it becomes wrong.

Views are code. They need versioning, tests, and rollout discipline just like APIs do.

### 5) No rebuild path

Eventually a bad deploy, skipped message, or logic bug will corrupt a projection. If your only repair strategy is "hope future events fix it," you are operating on vibes.

Every serious projection should support one of these:

- replay from an event log
- backfill from CDC history
- full recomputation from source tables

## How to test it before production

First, test projection logic like application code.

Given an ordered event sequence, does the row end in the right state? Given duplicate delivery, does it stay correct? Given out-of-order delivery, do you reject, reorder, or safely merge?

Then test system behavior.

### Test 1: Replay test

Run the same event batch twice. The projection should converge to the same result.

### Test 2: Lag test

Artificially slow the consumer and measure end-to-end staleness. Confirm your SLO still makes sense.

### Test 3: Backfill test

Rebuild a subset of the view from scratch and compare it with the live projection. This catches drift before users do.

### Test 4: Failure injection

Crash the consumer after committing offset progress but before writing the view, and vice versa. Make sure your recovery story is real, not implied.

## What to observe in production

At minimum, watch:

- projection lag, event time to view update time
- consumer throughput
- replay and dead-letter counts
- projection write failures
- rebuild duration
- row-count or checksum mismatches between source and view samples

I also like a simple canary query: periodically recompute a tiny random sample from source-of-truth tables and compare it to the materialized view. It is cheap insurance against silent drift.

A useful mental model is this:

```txt
source of truth -> change stream/outbox -> projection worker -> materialized view -> read API
```

Every arrow can fail. Good designs make each failure visible and recoverable.

## The real lesson

Materialized views are not just a database feature. They are a promise that some expensive read is important enough to deserve dedicated maintenance.

That promise is worth making when the read path matters, but only if you also budget for the unglamorous parts: lag, replays, schema changes, deletes, and rebuilds.

If you do that well, you get something wonderful: operational data modeled for writes, user-facing data modeled for reads, and a system that does not force one side to pretend it is the other.

## Further reading

- [PostgreSQL materialized views documentation](https://www.postgresql.org/docs/current/rules-materializedviews.html)
- [Designing Data-Intensive Applications, data integration and derived data chapter](https://dataintensive.net/)
- [Martin Fowler on CQRS](https://martinfowler.com/bliki/CQRS.html)
- [Debezium documentation on change data capture](https://debezium.io/documentation/)
