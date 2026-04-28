---
title: "System Design Daily: Write-Through vs. Write-Back Caches"
pubDate: 2026-04-28
description: "Choosing where writes land first is one of the most important and least glamorous cache design decisions."
tags: ["system-design", "engineering", "distributed-systems", "caching", "performance", "reliability"]
---

A lot of caching advice is really read-path advice: cache the hot thing, expire it eventually, try not to stampede the database. That is useful, but it hides one of the bigger design choices in the system: **what happens on writes**.

When a user updates a profile, a service changes inventory, or a worker records a counter, you have to decide whether the cache is just a read accelerator or part of the write path itself.

That choice usually turns into two families of designs:

- **write-through**: write to the cache and the backing store as part of the same request path
- **write-back** (sometimes called write-behind): write to the cache first and flush to the backing store later

I think teams underestimate how different these are operationally. On a whiteboard they can both look like “faster writes with a cache.” In production, they fail in completely different ways.

## The problem framing

Suppose you run a product catalog service. Each product record is about 2 KB. During a sale, you might see:

- 40,000 reads per second for product pages
- 2,000 writes per second for price and inventory updates
- an underlying database that is durable, but not happy about sudden write spikes

You add a cache because reads are hot and repetitive. Fine. But the moment writes matter, you have a design question:

**Should the database remain the first durable home of truth, or can the cache absorb writes and settle them later?**

That is not a performance tweak. That is a correctness decision.

## Core concepts

### Write-through

In a write-through design, the application treats the cache as part of a synchronous write path.

A simplified flow looks like this:

```text
client
  |
  v
service
  |
  +--> write database
  |
  +--> update cache
  |
  v
response after both succeed
```

Some implementations reverse the exact order internally, but the important property is the same: the request is not “done” until both layers are updated according to the system's contract.

That gives you a nice property: when the write returns success, the next read is very likely to see the new value from cache.

### Write-back

In a write-back design, the cache accepts the write immediately and pushes it to durable storage later, usually asynchronously.

```text
client
  |
  v
service
  |
  +--> write cache
  |
  +--> enqueue flush / async persist
  |
  v
fast response before database commit

later...
cache/worker --> database
```

This can make writes look extremely fast and smooth out bursts, because the backing store is no longer on the critical path for every request.

The catch is obvious and important: there is now a window where the newest state exists in cache but is not yet durable.

## A concrete example

Say an inventory key gets updated 5 times in one second:

```text
SKU-42 inventory:
100 -> 99 -> 98 -> 97 -> 96
```

With **write-through**, the database sees each update before the request completes. If the cache dies after the fifth write, the durable store still has `96`.

With **write-back**, the cache may hold `96` immediately while the database still says `100` for a short period. If the cache node crashes before flushing, you can lose some or all of those updates unless you have a durable log or queue behind the cache.

That is why I do not like hearing write-back described as “just faster caching.” It is really a mini buffering system that needs durability semantics of its own.

## Tradeoffs

A compact comparison:

| Dimension | Write-through | Write-back |
| --- | --- | --- |
| Write latency | Higher, because backing store is in path | Lower, because backing store is deferred |
| Durability at ack time | Usually strong | Weaker unless flush pipeline is durable |
| Read freshness from cache | Usually high after successful write | High from cache, but backing store may lag |
| Burst absorption | Limited by backing store | Strong, can smooth spikes |
| Failure complexity | Moderate | High |
| Operational debugging | Usually simpler | Often much messier |

My bias: if the data matters more than the benchmark, start with write-through. Use write-back when you have a real need for absorption or aggregation, not because the latency graph looked prettier in a demo.

## When write-through is the better fit

Write-through is a good default when:

- you care about read-after-write behavior
- losing acknowledged writes is unacceptable
- the write rate is moderate enough for the database to handle
- your team wants simpler failure semantics

Typical examples:

- user profile updates
- account settings
- product metadata
- configuration state

A write-through API might look like:

```http
PUT /products/sku-42
{
  "price_cents": 1299,
  "inventory": 96
}
```

If that returns `200`, the contract is effectively: the durable store has it, and the cache has been updated or invalidated accordingly.

## When write-back is worth considering

Write-back gets interesting when the system benefits from **temporarily decoupling producer speed from storage speed**.

Examples:

- metrics or counters aggregated every few seconds
- ad impression tallies
- analytics events
- leaderboard score updates
- IoT telemetry bursts

Imagine 200,000 devices each sending one small reading per minute. The average rate is manageable, but the traffic is bursty because many devices report on the minute boundary. A write-back layer can absorb that spike in memory, batch flushes, and turn random writes into more storage-friendly sequential work.

That can be a huge win. It can also become a disaster if the cache is the only place those writes existed.

## Common failure modes

### 1. Acknowledging data that is not actually durable

This is the classic write-back trap.

If the cache accepts a write and returns success, but the async flush path later fails, what exactly did “success” mean?

If you cannot answer that in one sentence, the system contract is too vague.

### 2. Flush backlog growth

Write-back systems often look healthy until the flush workers fall behind.

Then you get:

- rising lag between cache state and database state
- growing memory pressure in the cache tier
- larger replay storms after recovery
- weird read inconsistencies if some readers hit the database directly

A backlog is not just an ops metric. It is correctness debt accumulating over time.

### 3. Out-of-order persistence

If the same key is updated repeatedly, the flush pipeline must preserve the right ordering or apply version checks.

Otherwise you can persist:

```text
96, then 99
```

and accidentally resurrect stale state.

Version numbers, sequence IDs, or compare-and-swap conditions matter a lot here.

### 4. Split read paths

Write-back gets dangerous when one service reads from cache while another reads directly from the database and assumes it is current.

Now both services are “correct” according to their local view and globally inconsistent.

If the database is allowed to lag, that lag must be a first-class part of the architecture, not an accidental surprise.

### 5. Cache eviction before flush

This is the quiet killer.

If dirty entries can be evicted under memory pressure before they are persisted, your cache is no longer just eventually consistent. It is eventually forgetful.

Write-back designs need explicit dirty-entry management, not generic cache eviction and a prayer.

## How to test it before production

For **write-through**, test the boring but important cases:

- database succeeds, cache update fails
- cache succeeds, database write times out
- retries on partial failure
- read-after-write under concurrency

You want a crisp policy for each one, usually preferring durable success over cache convenience.

For **write-back**, test much harsher scenarios:

1. accept writes for 10 minutes while the database is slowed 5x
2. crash a cache node with unflushed entries
3. restart flush workers and measure replay rate
4. inject out-of-order delivery in the persistence pipeline
5. force memory pressure and verify dirty data is protected

A small numeric test is useful. If the system accepts 20,000 writes per second and the database can only sustain 12,000 flushes per second, then backlog grows by 8,000 writes per second. In five minutes, that is 2.4 million pending writes.

That single number tells you whether your “temporary buffer” is a safety valve or the start of an outage.

## What to observe in production

For write-through, watch:

- write latency p95 and p99
- cache update/invalidation failures
- database saturation during write bursts
- read-after-write error reports

For write-back, add a much stricter dashboard:

- dirty entry count
- oldest unflushed age
- flush throughput versus ingest throughput
- replay rate after worker restarts
- eviction of dirty entries, ideally always zero
- divergence sampling between cache value and persisted value

If you only monitor cache hit rate, you are missing the real risk entirely.

## A practical rule of thumb

Use **write-through** when correctness is user-visible and acknowledged writes must survive. Use **write-back** when the workload is naturally bufferable, slight durability delay is acceptable, and you are willing to build the machinery to make deferred persistence trustworthy.

That machinery usually includes batching, versioning, durable queues or logs, backpressure, and explicit lag observability. At that point you are not just “using a cache.” You are building a storage pipeline.

That is fine. Just be honest about it.

## Further reading

- [Martin Kleppmann, *Designing Data-Intensive Applications*](https://dataintensive.net/)
- [Redis docs on cache patterns](https://redis.io/learn/howtos/solutions/caching)
- [Amazon DynamoDB Developer Guide on write sharding and high-throughput design](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-partition-key-sharding.html)
- [Meta Engineering, Cache made consistent](https://engineering.fb.com/2022/06/08/core-infra/cache-made-consistent/)
