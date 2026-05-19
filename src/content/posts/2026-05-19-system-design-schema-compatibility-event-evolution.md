---
title: "System Design Daily: Schema Compatibility for Event Evolution"
pubDate: 2026-05-19
description: "How to change event and API schemas without turning one deploy into a distributed outage."
tags: ["system-design", "engineering", "distributed-systems", "data-engineering", "reliability"]
---

One of the easiest ways to break a distributed system is to change a payload that “should have been fine.”

A producer adds a field. A consumer assumes field order. A backfill replays old events. A mobile client stays on an old version for three weeks. Suddenly a simple schema change turns into a production incident with the usual postmortem phrase: *works in staging*.

Today’s topic is **schema compatibility for event evolution**: how to change messages and APIs over time without requiring the whole fleet to deploy in lockstep.

## The problem

Distributed systems do not upgrade all at once.

That matters for every interface boundary:

- events in Kafka, Pulsar, or Kinesis
- JSON over HTTP APIs
- gRPC or Protobuf service contracts
- CDC pipelines and warehouse ingestion
- background jobs reading historical records

A schema is not just a data shape. It is a **compatibility contract across time**.

Here is the common failure pattern:

```text
Day 1: producer emits {order_id, total_cents}
Day 30: producer changes to {order_id, amount}
Day 31: one old consumer still expects total_cents
Day 31: production starts dropping or mis-parsing events
```

Nobody intended to create a breaking change. But the system did not care about intent.

## Core concepts

### Forward, backward, and full compatibility

These terms sound academic until they save you from a bad deploy.

| Compatibility type | What it means | Why it matters |
| --- | --- | --- |
| Backward | New consumers can read old data | Needed for replay, backfills, and old records in storage |
| Forward | Old consumers can read new data | Needed when producers deploy before all consumers |
| Full | Both directions are safe | Useful when upgrade order is unpredictable |

In event systems, **backward compatibility** is usually the minimum bar, because old messages do not disappear just because your code changed.

In multi-team environments, I think **full compatibility** is the healthier default unless you have a very controlled migration plan.

### Additive changes are cheap, renames are not

Some changes are naturally safe:

- adding an optional field
- adding a new enum value, if readers handle unknowns safely
- widening a numeric type in a controlled format

Some changes are dangerous:

- renaming a field
- changing units, like dollars to cents
- changing semantics without changing the field name
- making an optional field required
- reusing a deleted field number in Protobuf

The trap is that humans see “rename” as cosmetic, but consumers see it as “field disappeared and another unrelated one appeared.”

### Defaults are part of the design

If a new field arrives, what should older readers do?

- ignore it
- use a default
- reject the payload
- route to a dead-letter queue

You should decide that intentionally, not discover it in production.

A good compatibility strategy includes:

- explicit defaults
- tolerant readers
- producer discipline
- version-aware validation

### Versioning is not enough by itself

Adding `v2` to a schema name can help, but version numbers do not magically create compatibility.

A bad v2 is still bad.

The real question is whether mixed-version readers and writers can coexist while:

- old data remains readable
- new writes remain consumable
- rollback stays possible
- replay does not corrupt state

## A small example

Suppose an order service emits this event:

```json
{
  "event_type": "order.created",
  "order_id": "ord_123",
  "total_cents": 2599,
  "currency": "USD"
}
```

A team wants to support taxes and discounts, so they switch to:

```json
{
  "event_type": "order.created",
  "order_id": "ord_123",
  "subtotal_cents": 2200,
  "tax_cents": 399,
  "currency": "USD"
}
```

This looks reasonable, but it breaks every consumer that still needs `total_cents`.

A safer migration looks like this:

```json
{
  "event_type": "order.created",
  "order_id": "ord_123",
  "total_cents": 2599,
  "subtotal_cents": 2200,
  "tax_cents": 399,
  "currency": "USD"
}
```

Then:

1. producers emit both old and new fields
2. consumers migrate to the new fields
3. dashboards confirm no readers depend on the old field
4. only then is `total_cents` removed, ideally after a long deprecation window

Yes, that is a little messier. It is also much safer.

## Tradeoffs

### Strict contracts reduce chaos, but slow teams down

Schema registries, compatibility checks, and contract tests add friction. Good. Some friction is cheaper than an outage.

The tradeoff is deployment speed. Teams used to shipping “just one small field change” may resent the extra process.

My opinion: for shared interfaces, **slower and boring beats fast and ambiguous**.

### Tolerant readers improve resilience, but can hide bugs

A tolerant reader pattern says consumers should ignore fields they do not understand and avoid assuming exact payload shape.

That is great for additive evolution.

But if you get too tolerant, you can silently accept malformed data and notice only when downstream metrics drift. Compatibility should not mean “accept anything forever.” It should mean “reject intentionally, not accidentally.”

### Dual-writing fields is safer, but creates cleanup debt

Temporary overlap fields make migrations survivable, but they also create:

- extra producer logic
- duplicate semantics in analytics
- confusion about the canonical field
- forgotten cleanup work

If you choose additive migration, also choose an explicit retirement date.

## Common failure modes

### 1. Semantic changes hidden behind the same field name

This is nastier than a rename.

If `timeout_ms` suddenly means “server processing timeout” instead of “end-to-end deadline,” the payload still validates while the system behavior changes under your feet.

Compatibility is about meaning, not just syntax.

### 2. Replays against code that only understands the latest schema

Backfills and reprocessing are where weak compatibility discipline gets exposed.

If a consumer cannot read six-month-old messages, then your recovery story is weaker than you think.

### 3. One-way migrations with no rollback path

A producer deploys a breaking change, half the fleet fails, and rollback does not help because new-format data is already in the log.

That is why producer-first breaking changes are so dangerous. Logs remember everything.

### 4. Enum expansion without unknown handling

You add `status = PARTIALLY_REFUNDED`, and an older consumer crashes because it hardcoded a closed switch statement.

Unknown enum values should usually degrade gracefully, surface a metric, and avoid taking down the whole pipeline.

### 5. JSON consumers depending on field order or presence quirks

JSON is especially vulnerable to accidental coupling:

- treating missing and null as the same thing
- assuming field order matters
- failing open on type mismatches
- parsing numbers inconsistently across languages

“Schemaless” usually means “the schema moved into application bugs.”

## How to test it

Do not rely on unit tests for the current schema only.

Test compatibility as a matrix:

- new reader against old payloads
- old reader against new payloads
- replay of historical samples
- rollback after partial deployment

A simple test set might include:

```text
producer v1 -> consumer v2  (should pass)
producer v2 -> consumer v1  (should pass or fail in a controlled, expected way)
historical payload corpus -> current consumer  (should pass)
```

If you use a schema registry, enforce compatibility checks in CI before merge.

Also test weird cases:

- missing optional fields
- unknown enum values
- nulls where defaults are expected
- oversized payloads after additive growth

## How to observe it in production

Schema incidents often show up indirectly. Watch for:

- deserialization failure rate
- dead-letter queue volume
- unknown-field or unknown-enum counters
- consumer lag spikes right after producer deploys
- replay job failure rate
- contract check failures in CI

If possible, tag metrics by schema version or producer build.

That lets you answer the important question fast: *did this break because traffic changed, or because the contract changed?*

A practical production pattern is:

```text
1. register schema or contract change
2. deploy producer emitting both old and new fields
3. watch parse-error and lag metrics
4. migrate consumers
5. verify old-field usage drops to zero
6. remove deprecated fields later, not immediately
```

That sequence is less glamorous than “ship the cleanup now,” but it is how you avoid turning distributed systems into synchronized deployment theater.

## Closing thought

Schema evolution is one of those topics that looks bureaucratic until you have to replay data, roll back a deploy, or integrate with a team that upgrades slower than yours.

The durable rule is simple: **design messages so old and new software can coexist longer than you wish they had to**.

Because they will.

## Further reading

- [Confluent docs: Schema Evolution and Compatibility](https://docs.confluent.io/platform/current/schema-registry/fundamentals/schema-evolution.html)
- [Protocol Buffers: Updating a Message Type](https://protobuf.dev/programming-guides/proto3/#updating)
- [Martin Fowler: Tolerant Reader](https://martinfowler.com/bliki/TolerantReader.html)
- [Apache Avro Specification: Schema Resolution](https://avro.apache.org/docs/current/specification/#schema-resolution)
