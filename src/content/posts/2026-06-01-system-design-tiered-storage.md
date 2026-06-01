---
title: "System Design Daily: Tiered Storage"
pubDate: 2026-06-01
description: "How hot, warm, and cold storage tiers help systems stay fast without paying premium prices for every byte forever."
tags: ["system-design", "engineering", "distributed-systems", "storage", "performance"]
---

Storage systems get expensive when we pretend every byte is equally important forever.

It usually is not. The last 24 hours of logs matter more than the last 24 months. The most recent user messages need low latency reads, but old attachments can tolerate a slower trip. Event streams often need blazing fast writes for fresh data and much cheaper retention for older segments.

That is why **tiered storage** keeps showing up in real systems. The idea is simple: keep hot data on fast, expensive media, move cooler data to slower, cheaper media, and expose it all through one logical system.

My opinionated take is that tiered storage is one of the most practical cost-performance tools in system design, but teams often underestimate the operational sharp edges. It is not just a billing trick. It changes latency, failure modes, caching behavior, and observability.

## The problem

Suppose you run an analytics platform that ingests **2 TB of logs per day**.

Your users mostly query:

- the last 6 hours for incident response
- the last 7 days for normal troubleshooting
- the last 90 days for compliance or trend analysis

If you store all 180 TB for a 90-day window on premium SSD-backed nodes, you will get great performance and a painful cloud bill. If you throw everything into object storage, cost improves, but your "show me the last 15 minutes" dashboard becomes miserable.

Tiered storage exists to avoid that bad binary choice.

A common shape looks like this:

```text
Hot tier   -> SSD / local NVMe / high-IOPS disks, low latency, expensive
Warm tier  -> larger general-purpose disks or remote block storage, moderate cost
Cold tier  -> object storage, high latency, very cheap, huge capacity
```

The system decides where data lives based on age, access frequency, or business importance.

## Core concepts

### 1. Temperature is about access patterns, not sentiment

Hot data is data that is read or written often, or has strict latency requirements.

Cold data is data that is rarely accessed and can tolerate slower retrieval.

That sounds obvious, but teams get burned when they define tiers only by age. Age is a useful proxy, not the truth.

Examples:

- Yesterday's application logs are usually hot.
- A six-month-old customer invoice might still be warm if support agents open it every day.
- A newly uploaded archive that no one reads after ingest might be cold almost immediately.

Good tiering policies usually combine:

- **data age**
- **read frequency**
- **write activity**
- **retrieval SLOs**
- **regulatory retention rules**

### 2. Logical storage and physical storage are different things

Users should not have to know where the bytes live.

A healthy design exposes one logical dataset while the storage engine handles placement and movement underneath. That means your query layer, metadata layer, or index must answer questions like:

- which tier holds this object or segment?
- is the data partially cached in a hotter tier?
- can we serve a degraded but acceptable result while colder data is fetched?

This is why metadata becomes critical. If your catalog is wrong, tiered storage turns into a treasure hunt.

### 3. Movement policy matters as much as the tiers themselves

The real design question is not "should we have hot and cold storage?" It is "when do we move data, and who pays the migration cost?"

Typical movement strategies:

| Strategy | How it works | Good for | Risk |
| --- | --- | --- | --- |
| Time-based | Move after N hours or days | Logs, metrics, immutable events | Simple, but can misclassify important old data |
| Access-based | Promote or demote based on reads | User content, document stores | Needs reliable access telemetry |
| Size-based | Keep only a fixed working set hot | Cache-like workloads | Can thrash under bursty access |
| Policy-based | Pin data by tenant or class | Compliance, premium plans | More knobs, more mistakes |

My bias is to start with time-based rules plus a small read-through cache, then add smarter policies only when you have evidence.

### 4. Cold does not mean free

Object storage looks cheap until you remember request costs, retrieval delays, transfer fees, and cache misses.

A system that constantly drags old data back into the hot path can create the worst of both worlds:

- hot-tier infrastructure that is too small
- cold-tier retrieval bills that spike
- user-facing latency that is wildly inconsistent

Tiered storage works best when the access pattern actually has a shape. If everything is equally random, your tiers are fighting reality.

## A small example

Imagine a Kafka-like event platform storing 30 days of topic data.

- Days 0 to 2 live on local NVMe for fast consumer catch-up.
- Days 3 to 10 live on network-attached block storage.
- Days 11 to 30 live in object storage.

A consumer that falls behind by 20 days now pays a penalty.

```text
Read latest events:        8 ms p95
Read 5-day-old events:    35 ms p95
Read 20-day-old events:  300 ms p95 plus prefetch time
```

That may be perfectly fine if the product promise is "real-time for fresh data, eventual access for historical replay." It is a disaster if you promised uniform latency and forgot to say otherwise.

## Tradeoffs

### Cost versus predictability

The big win is obvious: you stop paying premium storage prices for stale data.

The hidden cost is **latency variance**. Queries that cross tiers can become hard to reason about. Your median may look great while your p95 turns ugly whenever historical data is involved.

### Simplicity versus efficiency

A single storage class is conceptually clean. Tiered storage adds:

- lifecycle jobs
- metadata/state tracking
- promotion and eviction logic
- backfill and repair behavior
- more complicated capacity planning

You are trading architectural simplicity for economic efficiency.

### Write amplification versus read amplification

Moving data between tiers is work. Reformatting segments, compacting files, copying objects, or rebuilding indexes can create background I/O pressure.

If you delay movement too long, reads suffer because too much old data stays expensive. If you move too aggressively, background churn eats your savings.

## Common failure modes

### 1. Metadata says data is somewhere it is not

This is the nightmare scenario. The pointer says a segment has been archived, but the object write failed or the index update never landed.

Defenses:

- make movement jobs idempotent
- verify durability before flipping metadata
- keep audit trails for placement changes
- run periodic reconciliation scans

### 2. Cold-tier fetch storms

A dashboard, incident, or backfill suddenly requests thousands of old objects. Your cheap tier becomes a surprise bottleneck.

Defenses:

- rate limit historical fetches
- prefetch sequential ranges
- cache recently thawed objects
- isolate background replay from interactive queries

### 3. Thrashing between tiers

Data gets promoted to hot, demoted to warm, then promoted again hours later.

That usually means your policy is too twitchy.

Defenses:

- use hysteresis, not one-threshold rules
- set minimum residence times per tier
- promote only after repeated reads, not one read

### 4. Capacity planning that ignores transitions

Teams size hot storage for steady-state data volume and forget migration overlap. During compaction, repair, or re-tiering, you may temporarily need space in both locations.

That is how a tidy lifecycle policy turns into an out-of-disk incident.

## How to test and observe it in production

Tiered storage should be tested like a latency feature and like a data durability feature.

### Test it

- **Policy simulation:** replay 7 to 30 days of access logs and ask where each object would land.
- **Promotion tests:** verify that a cold read can repopulate warm or hot caches without duplicate fetch storms.
- **Failure injection:** kill movement workers after the cold copy succeeds but before metadata flips.
- **Query-mix tests:** benchmark fresh-only queries, historical-only queries, and cross-tier queries separately.
- **Recovery drills:** restore access when an archive bucket, warm volume, or metadata service is degraded.

### Observe it

Track at least these metrics:

- bytes stored per tier
- reads and writes per tier
- promotion and demotion rates
- archive job success/failure counts
- fetch latency by data age
- cache hit rate after cold reads
- retrieval cost and transfer cost over time
- percentage of queries that span multiple tiers

One metric I especially like is **latency by age bucket**. If p95 for 0 to 1 day data is 20 ms and p95 for 8 to 30 day data is 900 ms, that is not automatically bad. It is bad only if nobody expected it.

## Closing thought

Tiered storage is really a design statement about what your system values. It says fresh data and old data do not deserve identical treatment, and that is usually true.

The trick is to make that asymmetry explicit. Define which data must stay fast, which data may get cheaper, and what user experience is acceptable when colder data comes back into the path. If you do that well, tiered storage feels like leverage. If you do it poorly, it feels like a haunted attic full of missing files and mystery latency.

A few good references if you want to go deeper:

- [Apache Kafka Tiered Storage Overview](https://kafka.apache.org/documentation/#tiered_storage)
- [Amazon S3 Storage Classes](https://aws.amazon.com/s3/storage-classes/)
- [Designing Data-Intensive Applications, Chapter 3 and Chapter 11](https://dataintensive.net/)
- [RocksDB Overview](https://github.com/facebook/rocksdb/wiki/RocksDB-Overview)
