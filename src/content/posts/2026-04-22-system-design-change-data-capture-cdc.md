---
title: "System Design Daily: Change Data Capture (CDC)"
pubDate: 2026-04-22
description: How to turn database changes into reliable downstream events without teaching every app team to poll.
tags: ["system-design", "engineering", "distributed-systems", "data", "reliability"]
---

If two systems need to react to the same data change, someone eventually suggests polling.

That works for a week, maybe a month, and then it turns into a quiet tax on the whole architecture. The polling job is late, or expensive, or inconsistent, or it misses deletes, or it double-processes updates because someone forgot where the last cursor lived.

This is the problem space where Change Data Capture, usually shortened to CDC, earns its keep.

CDC is a focused system design technique: instead of repeatedly asking a database what changed, you capture changes as they happen and stream them to downstream consumers. Done well, it lets search indexes, caches, analytics pipelines, and other services stay in sync without putting even more logic into the request path.

My bias is simple: if many downstream systems care about changes to operational data, CDC is usually cleaner than app-level polling and often safer than hand-rolled event publishing.

## The problem framing

Imagine an orders table in your primary database:

```sql
orders(id, user_id, status, total_cents, updated_at)
```

Every time an order changes, several other systems care:

- a search index wants fresh order state
- a warehouse system wants new shipment requests
- analytics wants a fact stream
- fraud detection wants status transitions
- a cache invalidator wants to evict stale entries

The naive design is to let each downstream system query the database every minute:

- `SELECT * FROM orders WHERE updated_at > last_seen`
- do some work
- remember the new cursor

That design looks easy because each consumer is "independent." In production, it is usually a mess:

- every consumer re-implements change tracking
- polling frequency becomes a tradeoff between staleness and database load
- deletes are awkward
- clocks and cursors get weird during retries
- the source database becomes an integration bus by accident

CDC flips the model. The database change is the source of truth, and downstream consumers subscribe to that stream of changes.

## Core concepts

### Log-based capture vs query-based capture

There are two broad ways to do CDC.

**Query-based CDC** polls tables and infers changes from columns like `updated_at` or an incrementing ID. It is easy to start and easy to outgrow.

**Log-based CDC** reads the database's write-ahead log, binlog, or equivalent commit log. Instead of guessing what changed, it observes the committed changes directly.

That distinction matters a lot.

| Approach | Good at | Weak at |
| --- | --- | --- |
| Query-based CDC | simple setup, one-off syncs | misses edge cases, adds source DB load, handles deletes poorly |
| Log-based CDC | accurate change stream, lower query load, ordered commits | more infra, connector complexity, schema evolution headaches |

For serious systems, log-based CDC is the interesting one.

### CDC events are derived from database commits

A typical log-based CDC pipeline looks like this:

```text
App writes to DB
   -> DB commit log records insert/update/delete
   -> CDC connector reads log
   -> connector emits change events to a stream
   -> consumers update their own views
```

The important point is that the event is attached to the committed write, not to whether an application developer remembered to publish a message after saving a row.

That is why CDC is often used to avoid the classic dual-write problem.

### Ordering is local, not magical

CDC gives you useful ordering, but not infinite ordering.

Usually you can rely on strong ordering **within a partition, table shard, or source log position**. You should not casually assume a total global order across every table in a big distributed estate.

That matters when consumers join data from multiple sources. "Read the stream in order" is not enough unless you are precise about whose order you mean.

## A small example

Say an order service updates one row:

```http
PATCH /orders/123
{
  "status": "shipped"
}
```

The row changes from:

```json
{"id":123,"status":"paid","total_cents":4599}
```

to:

```json
{"id":123,"status":"shipped","total_cents":4599}
```

A CDC connector might emit something like:

```json
{
  "source": "orders-db",
  "table": "orders",
  "op": "update",
  "ts": "2026-04-22T18:00:07Z",
  "before": {"id":123,"status":"paid","total_cents":4599},
  "after": {"id":123,"status":"shipped","total_cents":4599},
  "lsn": "16/B374D848"
}
```

A shipping consumer might create a fulfillment task. A cache consumer might invalidate `order:123`. An analytics consumer might record the status transition.

None of them need to hit the primary database to discover the change.

## Why teams adopt CDC

### 1. It removes polling tax

Polling turns every downstream consumer into a tiny sync engine. CDC centralizes that work and usually cuts wasted database reads.

### 2. It reduces dual-write risk

If your app updates the database and publishes an event separately, failures between those steps create inconsistency. CDC derives the event from the commit itself, which is often more trustworthy.

### 3. It decouples read models from operational writes

Search indexes, materialized views, feature stores, and audit systems can evolve independently without bloating the write path.

### 4. It improves recovery

A durable change stream gives consumers a replay story. If a downstream system falls over, it can often resume from its last offset instead of begging the source system for a custom backfill.

## Tradeoffs you should be honest about

CDC is powerful, but it is not free.

### Event shape is an infrastructure contract

Once multiple consumers depend on your CDC stream, schema evolution gets real. Renaming a column is no longer just a migration, it is an event contract change.

### You move complexity, not remove it

Polling complexity becomes stream-processing complexity:

- offsets
- replay behavior
- idempotent consumers
- backfills
- schema changes
- operational monitoring

That is usually a better trade, but it is still a trade.

### Source tables are not always domain events

A row update is not automatically a business event.

If `status` changes from `pending` to `paid`, that may map nicely to an "OrderPaid" concept. But many table changes are low-level implementation details. If consumers bind directly to raw table mutations, they inherit all your internal churn.

A practical pattern is to use CDC as a transport primitive, while still having a normalization step that produces cleaner downstream events.

### Large transactions can create bursty streams

A batch update touching 500,000 rows can dump a lot of change events at once. That is great for fidelity and rough on downstream systems that were sized for steady traffic.

## Common failure modes

### Consumers assume exactly-once semantics

Most CDC pipelines are at-least-once in practice. Replays, connector restarts, and downstream retries happen. If a consumer cannot safely handle duplicates, it is fragile.

Use stable primary keys, version fields, or dedupe stores. "The stream only sends one event" is not a real guarantee.

### Deletes disappear from downstream views

Polling systems often miss deletes. CDC can represent deletes cleanly, but only if consumers actually implement tombstone handling or removal logic.

A search index that processes inserts and updates but ignores deletes is basically a liar with good uptime.

### Snapshot and live-stream boundaries get muddled

Many CDC tools start with an initial snapshot, then switch to live changes. If you do not understand that handoff, you can get duplicates, gaps, or weird ordering assumptions during bootstrap.

### Schema changes break consumers quietly

Adding a nullable column is usually fine. Changing data types, dropping columns, or reinterpreting field meaning is where downstream systems start failing in slower, harder-to-debug ways.

### One hot table becomes everyone else's problem

If a single table changes at very high volume, every consumer feels it. CDC does not eliminate hot spots. It broadcasts them.

## How to test and observe CDC in production

First, test the ugly parts, not just the happy path.

### Test scenarios

- insert, update, and delete handling
- duplicate delivery after consumer restart
- connector downtime followed by catch-up replay
- large backfill or batch update bursts
- schema migration during live traffic
- consumer lag crossing your freshness SLO

A good tabletop question is: "If the connector is down for 45 minutes, what breaks first, and how do we recover?"

### Metrics that matter

Track at least these:

| Metric | Why it matters |
| --- | --- |
| source-log position or LSN/binlog offset | tells you where the connector really is |
| end-to-end lag | shows how stale downstream systems are |
| consumer lag per topic/partition | reveals who is falling behind |
| events per second and bytes per second | capacity and burst planning |
| replay/restart counts | catches flapping connectors or consumers |
| DLQ volume or parse failures | surfaces schema and processing breakage |

### Observability habits

- stamp events with source commit metadata when possible
- expose last applied offset in consumers
- alert on freshness, not just process liveness
- sample full event payloads carefully for debugging, with privacy review

The freshness alert is the big one. A connector process being "up" does not mean your search index is current.

## When CDC is the right tool

CDC is a strong fit when:

- one source of truth feeds many downstream systems
- you need lower staleness than coarse polling provides
- you want replayable change history
- you do not trust every application team to publish events correctly

It is a weaker fit when:

- a single consumer just needs a periodic export
- the source system cannot expose a reliable log or connector path
- domain-level events matter much more than row-level mutations and you already publish them well

In practice, many mature systems use both: domain events for explicit business workflows, CDC for synchronization, indexing, auditing, and data movement.

## The practical takeaway

CDC is not "streaming because streaming is cool." It is a way to make data changes observable without turning every dependent system into a polling loop or every app write into a dual-write gamble.

The trick is to stay honest about what it gives you.

It gives you a faithful stream of committed changes. It does **not** give you automatic exactly-once delivery, perfectly stable schemas, or business semantics for free.

If you design for replay, duplicates, deletes, and lag from day one, CDC can become one of the cleanest seams in your architecture.

If you treat it like magic, it will become one more mysterious pipeline that everyone is afraid to touch.

## Further reading

- [Debezium documentation](https://debezium.io/documentation/reference/stable/)
- [PostgreSQL logical decoding concepts](https://www.postgresql.org/docs/current/logicaldecoding-explanation.html)
- [Kafka Connect documentation](https://kafka.apache.org/documentation/#connect)
- [Designing Data-Intensive Applications, Chapter 11](https://dataintensive.net/)
