---
title: "System Design Daily: Hot Keys and Load Skew (and How to Survive Them)"
pubDate: 2026-03-19
description: "Even ‘perfect’ sharding falls apart when one key gets famous—here’s how to detect, mitigate, and test hot spots."
tags: ["system-design", "engineering", "distributed-systems", "databases", "performance", "observability"]
---

Most scaling conversations start with *distribution*: “We’ll shard by userId” or “Kafka partitions by customerId.” That’s usually correct—until reality shows up with a celebrity user, a single tenant doing 40% of your writes, or a “today” timestamp prefix that routes every request to the same partition.

That’s **load skew**: when traffic is not evenly distributed across partitions/nodes *even if data size is*. The usual villain is the **hot key**—a single key (or small set of keys) that attracts a disproportionate amount of reads/writes.

This post is about one focused skill: **designing systems that degrade gracefully when one key gets hot**.

## Problem framing: why hot keys hurt more than you think

A hot key doesn’t just “make one shard slow.” It creates a cascade:

- The hot partition hits CPU/network limits → latency spikes.
- Queues build up behind it → timeouts → retries.
- Retries amplify load → you’ve invented a denial-of-service loop.
- Autoscaling often can’t help because the bottleneck is *one partition*, not the fleet.

Even worse: the system can look “healthy” at the aggregate level (50% fleet CPU), while one partition is melting.

## Core concepts (what to have in your mental model)

### 1) Partitioning distributes *keys*, not *work*

If you partition by `key`, you’re implicitly betting that work per key is roughly uniform.

Common partitioning functions:

- **Hash partitioning**: `shard = hash(key) % N` (great for uniformity, bad for range queries)
- **Range partitioning**: `shard = range(key)` (great for scans/locality, prone to hot ranges)

Hot keys break both.

### 2) “Hotness” can be reads, writes, or coordination

Hotness comes in flavors:

- **Write hot key**: one key hammered with writes (counters, likes, clickstream for a single entity)
- **Read hot key**: one key hammered with reads (profile of a famous user, config blob)
- **Coordination hot key**: one key that forces locks/leader work (single partition leader, single mutex)

The mitigations differ.

### 3) You can’t eliminate skew—only manage it

There’s no free lunch: if you need strict per-key ordering, or single-writer semantics, you are *choosing* to concentrate work.

The trick is to:

1) detect skew early,
2) contain blast radius,
3) have a playbook for “this key is on fire.”

## A small example (with numbers)

Say you run a multi-tenant event ingestion API:

```http
POST /v1/events
{
  "tenantId": "acme",
  "eventType": "purchase",
  "payload": { ... }
}
```

You partition the stream by `tenantId` to preserve tenant-local ordering and make debugging easy.

- Total load: **50k events/sec**
- “Normal” tenants: ~100 events/sec each
- One tenant (“acme”): **20k events/sec** during a promotion

Even if you have 200 partitions, **all of acme’s events land in one partition** (or a small set) because the key is the tenant.

Result: one partition is at 200x the median. Your overall cluster metrics look fine, but that partition’s consumer lags, retention fills, and producers start timing out.

## Tradeoffs: what you can do about it

Think of mitigations in layers, from cheapest to most invasive.

### Option A: Admit it and put a governor on the hot key

If you must keep per-key ordering, you may need to rate limit *per key*:

- Per-tenant token buckets
- Per-tenant quotas and burst rules
- “Fair queueing” scheduling (serve many tenants, not one tenant fully)

Tradeoff: you’re explicitly choosing to shed load for the hot tenant to protect everyone else.

### Option B: **Key salting / write sharding** (split the hot key)

You keep a logical key, but physically spread it across sub-keys.

Example:

- Original: `tenantId = acme`
- Salted: `acme#00 ... acme#31` (32 shards)

Write path:

- Choose salt: `salt = hash(requestId) % 32`
- Write to partition key `acme#salt`

Read path depends on the query:

- For “latest N events,” you may need scatter/gather across 32 shards.
- For aggregates, you can maintain rollups.

Tradeoff: you buy throughput at the cost of more complex reads and weaker ordering guarantees.

### Option C: Two-tier design: isolate hot keys

Sometimes the best answer is: “This tenant is special.”

- Put very large tenants on their own partitions / dedicated clusters
- Use separate queues or topics per large tenant
- Use a “hot key tier” cache/shard group

Tradeoff: operational complexity and an implicit “enterprise tier,” but you regain predictability.

### Option D: Change the data model to avoid a single contended item

Classic example: counters.

Instead of one row:

- `views(postId) = 1,234,567`

Use **striped counters**:

- `views(postId, stripeId)`, where `stripeId` is 0..127
- Increment a random stripe
- Read by summing stripes (or read from a periodically computed total)

Tradeoff: reads are more expensive unless you add rollups.

## Common failure modes (aka how teams get surprised)

1) **Aggregate dashboards hide hotspots**
   - “Average CPU 40%” while one partition leader is at 100%.

2) **Retries amplify skew**
   - One hot shard slows down → timeouts → client retries → shard gets hotter.

3) **Range keys + time prefixes create write hotspots**
   - If your primary key starts with a timestamp (especially increasing), “the newest range” becomes the hottest range.

4) **Cache makes it worse when a key expires**
   - A famous key’s cache entry expires → thundering herd to the backend.
   - (Mitigate with request coalescing, stale-while-revalidate, and TTL jitter.)

5) **Rebalancing doesn’t fix a hot key**
   - Moving partitions helps when load is uneven across partitions.
   - It does *not* help when one key dominates one partition.

## How to test and observe this in production

### Observability checklist

You want to be able to answer, quickly:

- What are the **top N keys by QPS** (reads and writes)?
- What are the **top N partitions by utilization/latency/queue lag**?
- Is latency correlated with **a single key** or **a subset of keys**?

Practical techniques:

- **Heavy-hitter tracking**: maintain approximate top-k keys per service (count-min sketch, space-saving). Emit periodically.
- **Per-partition metrics**: consumer lag per partition, leader CPU, request latency by shard.
- **Cardinality-safe logging**: log “hot key fingerprints” (e.g., hash of key) to avoid exploding logs.

### Load testing: include skew, not just volume

Most load tests are uniform. Real traffic isn’t.

Add a skew scenario:

- 80/20: 20% of keys get 80% of traffic
- Single-key spike: 1 key gets 30–50% of traffic for 10 minutes

Success criteria should include:

- Tail latency for *non-hot* keys stays acceptable
- The system sheds load predictably (429s / backpressure), not via timeouts
- No retry storms (track retry rate and retry budget consumption)

### Runbook: what to do when it happens at 2 AM

Have a playbook:

- Identify hot key (or partition) from dashboards
- Apply temporary per-key rate limits / quotas
- Increase salt factor (if supported) or move tenant to a dedicated tier
- Enable protective caching / coalescing for read hotspots

If you can’t do *any* of those quickly, you don’t have a hot-key strategy—you have hope.

## A tiny diagram (what’s happening)

```text
Uniform keys:
  clients -> hash(key) -> [P0][P1][P2][P3]   (each ~25%)

Hot key "acme":
  clients -> hash("acme") -> [P2]            (P2 ~60%, others ~13%)

Key salting (32-way):
  clients -> hash("acme#s") -> [P0][P1][P2][P3]   (acme spread out)
```

## Links worth your time

- AWS DynamoDB: Best practices for designing partition keys (hot partitions, write sharding)
  - https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-partition-key-design.html
- Google Cloud Bigtable: Schema design best practices (hotspot avoidance)
  - https://cloud.google.com/bigtable/docs/schema-design
- Paper: *Dynamo: Amazon’s Highly Available Key-value Store* (consistent hashing, partitioning realities)
  - https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf

## Opinionated takeaway

Sharding is not “set it and forget it.” It’s a bet on traffic shape.

If your design requires strict per-key ordering, or if your product can create “celebrity keys,” you should assume hot keys are inevitable and build for containment: per-key limits, a salting strategy, and dashboards that make hotspots impossible to ignore.
