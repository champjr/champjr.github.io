---
title: "System Design Daily: Online Backfills for Large Data Migrations"
pubDate: 2026-05-29
description: "How to migrate huge datasets in production without turning a routine backfill into an outage."
tags: ["system-design", "engineering", "distributed-systems", "data-migrations", "operations"]
---

Most migration plans look clean on a whiteboard. Add a new column, create a new table, write a backfill job, flip reads, delete the old path. Easy.

Then production shows up.

The dataset is larger than you guessed. The database is already running hot. Replicas lag. Retries multiply load. One malformed record wedges the worker pool. By the time the backfill is 60% complete, you are no longer doing a migration. You are doing incident response with better branding.

That is why online backfills deserve to be treated as a system design topic, not a scripting chore.

This post is about one focused idea: how to design a backfill so it can run against a live production system without stealing all the oxygen from user traffic.

## The problem

A backfill is just a bulk rewrite of existing truth. You are taking data that already exists and making it conform to a new schema, index, storage layout, or serving path.

Common examples:

- populating a newly added denormalized column
- copying data from one table or cluster to another
- generating derived records for a new feature
- moving from one ID format to another
- rebuilding a search index or analytics dimension

The hard part is that the system is live while you do it.

User writes are still arriving. Reads still need low latency. Retries and failovers still happen. If your backfill behaves like a batch job with infinite entitlement, it will compete with foreground traffic and usually win in the worst possible way.

My opinionated rule is simple: **a production backfill is a background tenant, not the owner of the database.** Design it that way.

## Core concepts

### 1. Separate the migration into phases

Good backfills are rarely a single step. They usually follow a phased rollout:

1. **Expand**: add the new schema or destination safely.
2. **Dual write or capture changes**: make new writes land in both old and new representations, or record changes so the new store can catch up.
3. **Backfill history**: migrate old data in the background.
4. **Verify**: compare counts, checksums, or sampled records.
5. **Flip reads**: move read traffic once confidence is high.
6. **Contract**: remove the old path later, not immediately.

This matters because a backfill alone cannot solve correctness if new writes keep arriving during the job.

### 2. Use stable chunking

Never say “scan the whole table and process rows.” That is how you get duplicate work, skipped rows, or an impossible restart story.

Chunk by a stable cursor such as:

- primary key ranges
- time windows on immutable timestamps
- precomputed shard IDs
- partitions from the storage engine

The chunk boundary should be deterministic so a worker can resume after failure.

Example:

```text
users table: ids 1..500,000,000
worker 1: 1..999,999
worker 2: 1,000,000..1,999,999
...
```

A job checkpoint like `last_processed_id=184200000` is much easier to reason about than “we were somewhere around page 9200.”

### 3. Make writes idempotent

Your backfill worker will retry. It will be restarted. It may race with live traffic.

So each migrated record should be safe to write multiple times.

That can mean:

- `UPSERT` instead of blind insert
- version checks like `update if source_version >= current_version`
- deterministic derived values
- idempotency markers in a side table

If replay is unsafe, the job is fragile by design.

### 4. Rate-limit against real system health

A fixed worker count is not enough. Backfills should respond to the system they are consuming.

Useful control inputs include:

- database CPU
- replica lag
- p95 read latency
- lock wait time
- queue depth
- error rate

A simple policy works well: speed up when the system is healthy, slow down when it is stressed, and pause when safety thresholds are crossed.

That is better than finishing 30 minutes earlier at the cost of an outage.

### 5. Plan for correctness verification

“Job completed successfully” is not proof of migration correctness.

You want multiple verification layers:

- row counts by partition
- checksums or hashes on selected fields
- sample record diffing
- shadow reads from old and new paths
- business metric comparison after cutover

The safest migrations assume the job can lie and build a way to catch it.

## A small example

Suppose an orders service stores tax totals inline on the `orders` table, but now you want a new `order_totals` table for cleaner reporting.

New writes will dual write:

```text
POST /orders
  -> write orders row
  -> write order_totals row
```

Historical data still needs to be migrated.

You create a backfill job that processes 50,000 order IDs per chunk:

```text
for id_range in chunked_ranges:
  rows = SELECT * FROM orders WHERE id BETWEEN start AND end
  for row in rows:
    INSERT INTO order_totals(order_id, subtotal_cents, tax_cents, total_cents, source_version)
    VALUES (...)
    ON CONFLICT (order_id)
    DO UPDATE SET
      subtotal_cents = EXCLUDED.subtotal_cents,
      tax_cents = EXCLUDED.tax_cents,
      total_cents = EXCLUDED.total_cents,
      source_version = EXCLUDED.source_version
    WHERE order_totals.source_version <= EXCLUDED.source_version
```

Then you throttle the job if replica lag exceeds, say, 5 seconds.

That is already much safer than a naive “copy every row as fast as possible” script.

## Tradeoffs

| Choice | Benefit | Cost |
| --- | --- | --- |
| Small chunks | Better pause/resume and less lock pressure | More scheduler overhead |
| Large chunks | Higher throughput | Bigger retries and noisier failures |
| Dual writes | Keeps new data current during migration | More application complexity |
| CDC-based catch-up | Decouples app logic from migration | More infra and operational moving parts |
| Aggressive throttling | Protects production | Longer migration time |
| Strict verification | Higher confidence before cutover | Extra implementation time |

The usual mistake is optimizing for migration duration instead of blast radius. In production, the second one matters more.

## Common failure modes

### Hot partitions

Even if total throughput looks safe, one partition may get hammered. Backfills often concentrate on sequential key ranges, and storage systems do not always distribute that evenly.

Mitigation: interleave ranges, randomize chunk order, or schedule per-shard quotas.

### Replica lag and read regressions

The primary may survive the load while replicas quietly drown. Then read traffic starts seeing stale data or latency spikes.

Mitigation: use replica lag as a first-class throttle signal, not just primary CPU.

### Lock amplification

A “simple update” repeated millions of times can cause lock contention, vacuum pressure, or compaction debt.

Mitigation: prefer append-friendly writes where possible, keep transactions small, and test on production-like volumes.

### Silent data drift

If live writes update a record while the backfill is working from an old snapshot, the migrated copy may be stale.

Mitigation: dual writes, CDC catch-up, version fencing, or a final reconciliation pass before read cutover.

### Poison records

One malformed row should not stall a 12-hour job.

Mitigation: isolate failures per record or per chunk, emit them to a repair queue, and keep the main job moving.

## How to test it before production

A backfill test that only checks happy-path correctness is not enough. You want to simulate stress and ugliness.

Test these explicitly:

- restart workers mid-chunk
- retry the same chunk several times
- inject malformed records
- slow down the destination store
- add concurrent live writes during the backfill
- validate that throttling reacts to lag and latency signals

If possible, run a dress rehearsal on a recent production snapshot with realistic cardinality. Many migration plans look fine at 10,000 rows and fall apart at 400 million.

## What to observe in production

At minimum, put these on a dashboard:

- chunks completed per minute
- records migrated per minute
- retry rate
- per-chunk duration
- database CPU and IOPS
- replica lag
- lock wait time
- error rate by failure class
- verification mismatch count
- percentage of total data migrated

And set explicit pause conditions. For example:

```text
pause if:
- replica lag > 10s for 5 minutes
- read p95 > 2x baseline
- error rate > 2%
```

A migration with no pause policy is basically saying “we will notice manually.” That is not a real control loop.

## The practical takeaway

Online backfills are not about moving data fast. They are about moving data safely while the system keeps serving users.

That changes the design priority stack:

1. correctness under retries and concurrent writes
2. bounded impact on live traffic
3. observability and safe pause/resume
4. only then, raw throughput

If you treat backfills as first-class production workloads, they become boring. And boring is exactly what you want from a migration.

## Further reading

- Martin Kleppmann, *Designing Data-Intensive Applications* section on dataflow and evolution: https://dataintensive.net/
- GitHub Engineering on large-scale MySQL schema changes with gh-ost: https://github.blog/2017-05-19-gh-ost-github-s-online-migration-tool-for-mysql/
- Shopify engineering on large table migrations with minimal downtime: https://shopify.engineering/search?type=article&q=migration
- PostgreSQL documentation on `INSERT ... ON CONFLICT`: https://www.postgresql.org/docs/current/sql-insert.html
