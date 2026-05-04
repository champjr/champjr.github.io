---
title: "System Design Daily: Secondary Indexes"
pubDate: 2026-05-04
description: "Secondary indexes make flexible queries possible, but they quietly turn every write into a fan-out consistency problem."
tags: ["system-design", "engineering", "distributed-systems", "databases", "search", "performance"]
---

Primary keys get all the architectural attention, but most product features are powered by something less glamorous: **secondary indexes**.

The moment a product team asks for “find orders by customer email,” “list invoices by due date,” or “show all jobs in status=queued,” your neat key-value model stops being enough. You need another path into the same data.

That is what a secondary index is: an alternate lookup structure that lets you query records by attributes other than the primary key.

Sounds simple. It is not. The hard part is that every extra index turns a single logical write into **multiple physical writes** that now have to stay coherent enough for the product to work.

My opinionated take: teams often treat indexes like a database feature toggle, when they should treat them like part of the write path design.

## The problem framing

Suppose your `orders` table is keyed by `order_id`.

```text
orders[
  order_id -> { customer_id, status, created_at, total_cents }
]
```

That is great if your application always knows the `order_id`. But real systems need queries like:

- all orders for `customer_id = 42`
- all orders with `status = "pending"`
- the next 100 orders by `created_at`

Without a secondary index, you are stuck doing full scans, which are fine for toy datasets and terrible for production.

A secondary index solves this by maintaining another structure, for example:

```text
primary: order_id -> row
index_customer: customer_id -> [order_id, order_id, ...]
index_status_created: (status, created_at) -> [order_id, ...]
```

Now reads get much better. But writes get heavier, because inserting or updating one order may require touching several index entries too.

## Core concepts

### 1. Local vs global indexes

In a partitioned system, indexes are either **local** or **global**.

- **Local index**: stays aligned with the same partitioning scheme as the base data.
- **Global index**: repartitions data by the indexed attribute instead of the primary key.

If your base table is sharded by `order_id` but you want to query by `customer_id`, a global index usually means the index lives on different shards than the base row.

That is powerful, but it means a write may become a cross-shard operation.

### 2. Covering vs non-covering indexes

A **covering index** stores enough columns to answer a query without going back to the base row.
A **non-covering index** only stores the lookup key plus a pointer to the primary record.

Covering indexes improve read latency, but they increase storage and write amplification.

### 3. Synchronous vs asynchronous maintenance

There are two broad ways to keep indexes updated.

| Strategy | What happens on write | Upside | Downside |
| --- | --- | --- | --- |
| Synchronous | Base row and index update happen before success | Stronger consistency for reads | Higher write latency, harder cross-shard coordination |
| Asynchronous | Base row commits first, index catches up later | Faster writes, simpler scaling | Stale or missing query results for a while |

This is the real design choice. Not “should we have an index,” but “what consistency contract does this index need?”

## A small example

Imagine an order service doing 5,000 writes per second.
Each order is 1 KB, and you add two indexes:

- `customer_id -> order_id`
- `(status, created_at) -> order_id`

A single insert is no longer one write. It is roughly:

1. write base row
2. write customer index entry
3. write status/timestamp index entry

If each index entry is 100 bytes, your storage write volume is not 5 MB/s anymore. It is closer to:

- base rows: `5,000 * 1 KB = 5 MB/s`
- index entries: `5,000 * 2 * 100 B = 1 MB/s`

So before replication or WAL overhead, you already added about 20 percent more raw write traffic. In practice the operational cost is often higher because compaction, replication, caching, and repair all have to carry that extra state too.

That is why “just add an index” can become a very expensive sentence.

## Tradeoffs

Secondary indexes buy query flexibility, but they charge you in other currencies.

| Benefit | Cost |
| --- | --- |
| Fast alternate lookups | More write amplification |
| Better product features and filtering | More storage overhead |
| Lower read-time scanning cost | More consistency edge cases |
| Simpler application queries | More operational complexity during reindexing and migrations |

A few practical tradeoffs matter most.

### Read optimization vs write pain

Indexes usually make reads cheaper and writes more expensive. That is obvious, but teams still underestimate it. If your workload is write-heavy, every extra index needs a very strong reason to exist.

### Fresh results vs simpler architecture

Synchronous index maintenance gives cleaner query semantics, but it can drag p95 write latency upward, especially when the index is global and cross-partition.

Asynchronous maintenance scales better, but now your API contract needs to admit that newly written data may not appear in index-backed queries immediately.

### Product simplicity vs reindexing risk

Adding an index later sounds easy until you backfill a billion rows. Reindexing can saturate storage, trigger compaction storms, and compete with live traffic.

## Common failure modes

### 1. Missing index updates on partial failure

The base row write succeeds, but an index write times out or is dropped during a retry bug. Now the record exists, but queries through the index do not find it.

This is one reason transactional coupling or durable async pipelines matter.

### 2. Ghost entries after updates or deletes

If a row changes from `status=pending` to `status=paid`, you must remove the old index entry and add the new one. If delete logic is sloppy, old entries linger and queries return records that no longer match.

### 3. Hot partitions in the index

The base table may shard nicely by `order_id`, but the index on `status` can pile huge traffic onto a tiny number of values like `pending` or `queued`. You solved one access pattern and created another hotspot.

### 4. Backfill incidents

Building a new index over historical data is often where systems reveal their real limits. Disk throughput spikes, caches churn, replication lag grows, and query latency gets weird.

### 5. Query semantics nobody wrote down

If an asynchronously maintained index is 8 seconds behind, is that acceptable? For search, maybe yes. For fraud review queues, maybe absolutely not. If the answer lives only in tribal knowledge, you are going to have a bad incident.

## How to test it

Unit tests are not enough here. You want system-level tests that prove index correctness under failure.

A good checklist:

- insert a row, then verify it is readable via primary key and index
- update an indexed field, then verify the old index entry disappears
- delete a row, then verify the index tombstone behavior
- inject partial failures between base write and index update
- load test hot key values like `status=pending`
- rehearse index backfills on production-like data volumes

For asynchronous indexes, explicitly test freshness behavior:

```text
write order -> query by order_id succeeds immediately
write order -> query by customer_id may lag by N seconds
alert if lag exceeds the product contract
```

If you cannot state that contract in plain language, the design is still fuzzy.

## How to observe it in production

At minimum, I would want these metrics:

- index update latency
- index lag, if updates are asynchronous
- write amplification per logical write
- query hit rate per index
- stale or inconsistent read detections
- reindex/backfill throughput and error rate
- hottest index keys or partitions

Logs and traces should help answer a simple incident question: **did the base write happen, and did every required index mutation happen too?**

A useful trace shape looks like:

```text
create_order
  -> write_base_row ok
  -> update_customer_index ok
  -> update_status_index retry=1 ok
```

Or, during async maintenance:

```text
create_order
  -> append_event ok
indexer_consumer
  -> apply_customer_index ok
  -> apply_status_index lag=2.3s
```

That is the difference between a debuggable system and a mystery.

## The practical takeaway

Secondary indexes are not just query accelerators. They are distributed data structures with their own scaling, consistency, and failure behavior.

Use them when they make the product meaningfully better. Be stingy when the workload is write-heavy. And always ask the unglamorous question up front: *what happens if the base row and the index disagree for a while?*

That answer is the real system design.

## Further reading

- [Amazon DynamoDB: Global Secondary Indexes](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/GSI.html)
- [CockroachDB docs: Secondary indexes](https://www.cockroachlabs.com/docs/stable/indexes)
- [Martin Kleppmann, Designing Data-Intensive Applications](https://dataintensive.net/)
