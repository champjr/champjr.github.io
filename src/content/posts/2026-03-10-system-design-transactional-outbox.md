---
title: "System Design Daily: The Transactional Outbox (Reliable Events Without 2PC)"
pubDate: 2026-03-10
description: "How to publish events exactly once from a database transaction—without pretending distributed transactions are fine."
tags: ["system-design", "engineering", "distributed-systems", "microservices", "databases", "messaging"]
---

When you build systems that react to changes (send emails, update search indexes, trigger workflows, sync to analytics), you eventually hit the same unpleasant edge case:

- You **commit** a database transaction, but the **event** never gets published → downstream never learns.
- You **publish** an event, but the database transaction **rolls back** → downstream learns something that never happened.

In other words: your system becomes a liar under failure.

The *transactional outbox* is a practical pattern that fixes this without requiring distributed transactions (2PC), and it’s one of those “boring” designs that saves you from weeks of incident pain.

## Problem framing: the “DB + message broker” gap

A common architecture is:

- Write business state to Postgres/MySQL
- Publish an event to Kafka/SNS/SQS/RabbitMQ so other services react

Naively, you do something like:

1. `INSERT/UPDATE` the business row(s)
2. Call the broker producer API

But failures don’t respect your step numbers.

### The two classic failure modes

1) **DB commit succeeds, publish fails**

- Network blip, broker throttle, producer crash
- Result: the source of truth says “order paid,” but no “OrderPaid” event exists

2) **Publish succeeds, DB commit fails**

- Deadlock, constraint violation, transaction timeout
- Result: you emitted “OrderPaid,” but the order isn’t actually paid

You can try to “wrap it all in a transaction,” but your database transaction and your message broker transaction are not the same thing.

## Core concept: write the event *into the database* (first)

The outbox pattern says:

- In the **same DB transaction** where you update business state, also write an **outbox row** describing the event you intend to publish.
- A separate **relay** process reads the outbox table and publishes to the broker.

That gives you one atomic unit of work: the database transaction.

### Minimal schema

```sql
CREATE TABLE outbox (
  id            UUID PRIMARY KEY,
  aggregate_type TEXT NOT NULL,
  aggregate_id   TEXT NOT NULL,
  event_type     TEXT NOT NULL,
  payload_json   JSONB NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at   TIMESTAMPTZ,
  publish_attempts INT NOT NULL DEFAULT 0
);

CREATE INDEX outbox_unpublished_idx
  ON outbox (created_at)
  WHERE published_at IS NULL;
```

### Write path (inside your business transaction)

Example: charging an order.

```sql
BEGIN;

UPDATE orders
SET status = 'PAID', paid_at = now()
WHERE id = $1 AND status = 'PENDING';

-- If the update affected 1 row, we’re good; otherwise reject.

INSERT INTO outbox (id, aggregate_type, aggregate_id, event_type, payload_json)
VALUES (
  gen_random_uuid(),
  'order',
  $1,
  'OrderPaid',
  jsonb_build_object('orderId', $1, 'paidAt', now())
);

COMMIT;
```

Now either **both** the business state and the event intent exist, or **neither** does.

### Publish path (outbox relay)

A background worker does:

1. Fetch a batch of unpublished outbox rows
2. Publish each to the broker
3. Mark them published

Pseudo-code:

```text
loop:
  rows = SELECT ... FROM outbox
         WHERE published_at IS NULL
         ORDER BY created_at
         LIMIT 100
         FOR UPDATE SKIP LOCKED

  for row in rows:
    publish_to_broker(key=aggregate_id, value=payload_json)
    UPDATE outbox SET published_at=now() WHERE id=row.id
```

**Key detail:** `FOR UPDATE SKIP LOCKED` lets multiple relay workers share the outbox safely without double-processing the same row.

## Tradeoffs (what you’re paying for)

The outbox pattern is not magic. It’s a trade.

### Pros

- **No lost events** (if DB commit happened, an outbox row exists)
- **No phantom events** (if DB rolled back, outbox row doesn’t exist)
- Uses primitives you already operate: DB transactions + a worker
- Makes failure explicit and observable (you can *see* the backlog)

### Cons

- **Not instant**: events are published asynchronously (usually seconds)
- You must operate a relay (or CDC pipeline)
- Your broker consumers must tolerate **at-least-once delivery**
- The outbox table can grow (needs retention/compaction)

If you truly need synchronous cross-system guarantees, you’re in distributed transaction land. Most teams don’t actually want that; they just want to stop dropping events.

## “Exactly once” reality check

People say “exactly once” a lot. In practice:

- The outbox gives you **exactly-once *intent* persisted** (the DB row)
- The relay + broker + consumers typically provide **at-least-once delivery**

So you still need a strategy for duplicates.

The normal solution: make consumers **idempotent**.

- Include a stable `event_id` (the outbox `id`) in the message
- Have consumers store processed IDs (or use upsert semantics)

If you’re on Kafka, you can also leverage keys/partitions + consumer group behavior, but duplicates can still happen during retries and producer errors.

## Common failure modes (and how to not get surprised)

### 1) Relay publishes but crashes before marking `published_at`

Result: the same event may be published again on restart.

Mitigation:

- Accept at-least-once and make consumers idempotent.
- If your broker supports producer idempotence (Kafka idempotent producer), use it, but still don’t assume perfect.

### 2) Relay falls behind (outbox backlog grows)

Result: downstream systems lag (emails delayed, projections stale).

Mitigation:

- Monitor backlog age (p99 event age)
- Autoscale relay workers (or increase batch size)
- Make sure `outbox_unpublished_idx` exists

### 3) Hot partitions / ordering assumptions

If you publish with a key (like `orderId`) to preserve ordering per aggregate, one “busy” order/customer can dominate a partition.

Mitigation:

- Key by aggregate when ordering is truly required; otherwise key by a broader distribution (or random)
- Split event types into separate topics if one stream is noisier

### 4) Payload drift / schema evolution

Your outbox payload becomes a long-lived contract.

Mitigation:

- Version your event schema (`event_version` column)
- Use forward-compatible changes (additive fields)
- Keep payloads minimal; downstream can fetch details if needed

### 5) Outbox table growth and vacuum pain

If you keep every outbox row forever, you’ll eventually regret it.

Mitigation:

- Delete/archive published rows older than N days
- Partition the table by time if volume is high

## A concrete example (with numbers)

Suppose you run an e-commerce API that peaks at **300 orders/sec**.

You publish two events per order:

- `OrderCreated`
- `OrderPaid`

That’s **600 outbox rows/sec** at peak.

If your relay can publish **2,000 events/sec** sustained, you’re fine *until* the broker is slow for 10 minutes.

Backlog created during the incident:

- 600 rows/sec × 600 sec = **360,000 rows**

After recovery, drain time:

- 360,000 / (2,000 - 600) ≈ **257 seconds** (~4.3 minutes)

This is why the outbox is operationally nice: you can do the math, set SLOs (“outbox age < 2 minutes”), and scale the relay deliberately.

## Implementation options

### Option A: Polling relay (simple, good enough)

- Relay polls the outbox table every N ms
- Uses locking to avoid duplicate work

This is easiest to ship.

### Option B: CDC (Change Data Capture) relay (more moving parts)

Instead of polling, you stream DB changes (e.g., Debezium reading the binlog/WAL) and publish outbox inserts.

Pros:

- Lower DB query load
- Near real-time

Cons:

- More infrastructure
- More failure modes

For many teams, start with polling; move to CDC if scale demands it.

## How to test and observe it in production

### Tests (what to automate)

1) **Crash tests** for the relay

- Publish, kill the relay mid-flight, restart
- Assert: event is eventually delivered (possibly twice)

2) **Database rollback tests**

- Force a failure after writing business state but before commit
- Assert: no outbox row exists

3) **Broker outage simulation**

- Blackhole broker connectivity for 5–10 minutes
- Assert: outbox backlog grows, then drains; downstream recovers

4) **Duplicate delivery tests**

- Force relay to retry the same row
- Assert: consumer side-effects happen once (idempotency)

### Observability (what to graph)

- **Outbox lag (age):** `now() - min(created_at where published_at is null)`
- **Outbox depth:** count of unpublished rows
- **Publish success rate / retries** (`publish_attempts`)
- **Relay throughput:** events/sec published
- **Dead letter lane:** rows stuck too long (e.g., > 1 hour)

A nice operational pattern is to mark “poison” rows after N attempts and page humans with the event ID and payload summary.

## Recommended reading

- Transactional Outbox (pattern write-up): https://microservices.io/patterns/data/transactional-outbox.html
- Debezium Outbox Event Router (CDC approach): https://debezium.io/documentation/reference/stable/transformations/outbox-event-router.html
- Martin Kleppmann on exactly-once myths (great perspective): https://www.confluent.io/blog/exactly-once-semantics-are-possible-heres-how-kafka-does-it/

## Bottom line

If you’re updating a database and emitting events, you need a plan for failure. The transactional outbox is the cleanest “no heroics” approach I know:

- **Make the database transaction the source of truth.**
- **Persist event intent.**
- **Publish asynchronously.**
- **Design consumers for duplicates.**

It’s not glamorous, but it’s the difference between “our systems are eventually consistent” and “our systems occasionally hallucinate.”
