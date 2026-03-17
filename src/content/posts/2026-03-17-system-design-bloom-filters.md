---
title: "System Design Daily: Bloom Filters (Stop Paying for Cache Misses)"
pubDate: 2026-03-17
description: "Use Bloom filters to prevent expensive lookups for things that definitely don’t exist—without pretending they’re perfect."
tags: ["system-design", "engineering", "distributed-systems", "data-structures", "performance"]
---

Sometimes the slowest part of your system isn’t a “hard problem” like consensus or sharding.

It’s the death-by-a-thousand-cuts cost of asking an expensive backend the same doomed question over and over:

- “Does user 918273 exist?” (No.)
- “Is product SKU `X9Q-DOESNT-EXIST` real?” (No.)
- “Have we seen this event ID before?” (Probably no.)

When that question is asked at high QPS, *negative lookups* become a tax on your database and your tail latency.

A Bloom filter is a simple, brutally effective tool for that tax: **a compact in-memory set membership structure that can tell you “definitely not present”** and (sometimes) “maybe present”.

The trick is knowing where “maybe” is acceptable, how to size it, and what can go wrong.

## Problem framing: expensive misses and “cache penetration”

You usually add caches to speed up hits. But many real systems are dominated by misses:

- **Bots / attackers** probing random IDs
- **Typos / bad clients** sending malformed identifiers
- **Skewed popularity** where the long tail is mostly absent
- **Deletion-heavy domains** (a miss today might have been a hit yesterday)

This is often called **cache penetration**: the cache doesn’t help because the key isn’t there, and every request falls through to your database/search index/service.

If your DB can handle 10k QPS but your edge can accept 100k QPS, you don’t need an exotic design. You just need a cheap “nope.”

## Core concept: “definitely no” beats “maybe”

A Bloom filter represents a set using a bit array and *k* hash functions.

- To **add** an element: hash it *k* ways and set those *k* bit positions to 1.
- To **query** membership: hash it *k* ways; if *any* bit is 0 → **definitely not in the set**.
- If *all* bits are 1 → **maybe in the set**.

That “maybe” is the false positive: an element that wasn’t inserted but happens to map onto bits that were set by other elements.

Two crucial properties:

1. **No false negatives** (for a classic Bloom filter): if you added it, it will always be “maybe present”.
2. **False positives are tunable**: with enough bits and a good *k*, you can make “maybe” rare.

### A tiny diagram

```text
Request key: K

          +---------------------+
          | Bloom filter (RAM)  |
          +----------+----------+
                     |
      query(K) => 0? | yes  -> DEFINITELY NOT PRESENT -> fast reject / skip DB
                     |
                     no
                     v
            MAYBE PRESENT -> do the normal lookup (cache/DB)
```

This makes Bloom filters perfect as a **front-door guard** before something expensive.

## Where Bloom filters shine (and where they don’t)

Good fits:

- **Existence checks**: user IDs, order IDs, object keys
- **Negative caching** when you can’t store every miss
- **Protecting a database** from random-key traffic
- **Deduplication assist** (as a cheap first pass)

Bad fits:

- You need to **enumerate** members (you can’t)
- You need to **delete** entries accurately (classic Bloom filters can’t delete; see “counting” below)
- “Maybe” is unacceptable and would break correctness (Bloom filters are not a source of truth)

## Sizing it: a practical back-of-the-napkin example

The most common mistake is hand-waving the false positive rate.

A useful sizing approximation:

- `m` = number of bits
- `n` = number of inserted items
- `p` = desired false positive probability

A standard formula:

- **m ≈ - (n * ln(p)) / (ln(2)^2)**
- **k ≈ (m/n) * ln(2)**

Let’s say you have **100 million** user IDs (`n = 1e8`) and you’re okay with **1%** false positives (`p = 0.01`).

- ln(0.01) ≈ -4.605
- ln(2)^2 ≈ 0.480

So:

- m ≈ -(1e8 * -4.605) / 0.480 ≈ 9.59e8 bits ≈ 120 MB
- k ≈ (9.59e8 / 1e8) * 0.693 ≈ 6.64 → **7 hashes**

120 MB to avoid hammering your DB with random-ID probes is usually a good deal.

If 120 MB feels big, raise `p` a bit (e.g., 2–5%), shard by tenant, or use a layered approach (next section).

## A concrete system design example: “user profile lookup”

Imagine this endpoint:

```http
GET /v1/users/{userId}
```

Traffic profile:

- 40k QPS steady, 120k QPS bursts
- 30% of requests are for non-existent IDs (bots + clients guessing IDs)
- DB lookup cost (including index, network, serialization): ~8–15 ms

### Without a Bloom filter

Every miss goes to the DB.

At 40k QPS, 30% misses → **12k QPS** of useless DB queries. That’s a lot of read IOPS and a lot of p99 pain.

### With a Bloom filter

Workflow:

1. Query Bloom filter for `userId`.
2. If definitely not present → return `404` immediately.
3. If maybe present → go to cache/DB as usual.

If you set `p = 1%`, then of the 12k QPS misses:

- 99% (11,880 QPS) are rejected in-memory
- 1% (120 QPS) still fall through (false positives)

That turns “DB is melting” into “DB shrugs.”

## Tradeoffs (the part people skip)

### 1) False positives = wasted work, not wrong answers

Bloom filters are safe *only* if your system treats them as a hint:

- **Definitely not present** → you can safely skip the DB.
- **Maybe present** → you *must* verify.

If you ever return “exists” purely because Bloom says “maybe”, you will be wrong.

### 2) Staleness and deletions

Classic Bloom filters don’t support deletion. If your domain has deletions (users can be deleted, objects can expire), you have options:

- **Rebuild periodically** (nightly/weekly), acceptable if staleness is okay.
- Use a **counting Bloom filter** (stores small counters instead of bits) to decrement on delete.
- Use a **stable Bloom filter** (for streaming / bounded memory, probabilistic aging).

Each option has costs (memory, complexity, operational risk).

### 3) CPU cost vs memory cost

Bloom filters trade memory for CPU (hashing) and vice versa.

- Too many hashes (*k* large) → CPU overhead on every request
- Too few hashes → higher false positive rate for the same memory

In practice, many implementations use fast non-cryptographic hashing and derive multiple hash values from two base hashes (Kirsch–Mitzenmacher optimization).

### 4) Multi-layering can be better than one big filter

A practical pattern:

- **Small hot Bloom** for the most recent/hottest IDs
- **Bigger cold Bloom** for the full set

Or per-shard/per-tenant filters to reduce `n` and keep rebuilds manageable.

## Common failure modes (and how they show up)

1. **You under-size the filter**
   - Symptom: false positive rate climbs over time, DB traffic creeps up.
   - Cause: `n` grew beyond planned capacity.

2. **Bad hash choice / inconsistent hashing across services**
   - Symptom: unexpectedly high false positives, or “definitely not present” for keys that do exist (this can happen if you build the filter with a different normalization than you query).
   - Cause: different canonicalization (string case, encoding, prefixes), or different hash seeds.

3. **Stale filter after deletes or backfills**
   - Symptom: too many “maybe present” for recently deleted keys; or “definitely not present” for newly created keys if you forgot to insert.
   - Cause: async update pipeline lag or missing write path.

4. **Filter becomes a single point of failure**
   - Symptom: filter service outage causes your edge to thundering-herd the DB.
   - Cause: you put the filter behind a network hop without good fallback.

5. **“Optimizing” correctness away**
   - Symptom: user-facing bugs (“I created an account but it says it doesn’t exist”) when the filter path is treated as truth.
   - Cause: someone used “definitely not present” as a *hard* reject in cases where keys can be created concurrently and visibility is eventual.

## How to test and observe in production

You can (and should) treat a Bloom filter like any other production component: instrument it.

### Key metrics

- **Bloom queries / sec** and **p50/p95/p99 latency** (should be tiny)
- **Definite-negative rate**: fraction of requests rejected by Bloom
- **False positive rate (estimated)**:
  - For requests that Bloom says “maybe”, measure what fraction are *actually* absent in DB
- **DB fallthrough rate**: how often you still hit DB after Bloom check
- **Filter saturation / fill ratio**: fraction of bits set (or a proxy metric)
- **Update lag**: time from entity creation to Bloom insertion (if async)

### Practical testing approach

1. **Shadow mode first**
   - Run Bloom checks but don’t change behavior.
   - Log decisions and compare against DB truth.

2. **Canary enablement**
   - Enable “definitely not present → 404” for 1% of traffic.
   - Watch error rates and DB load.

3. **Chaos and rollback**
   - Simulate Bloom unavailability and confirm you degrade gracefully.
   - Ensure you have a feature flag to bypass Bloom instantly.

### A correctness note that matters

If new keys can be created concurrently, consider a tiny safety valve:

- For operations where “not found” is suspicious (e.g., immediately after a write), **bypass Bloom** or add a short grace period.

Design-wise: Bloom filters are great for *steady-state reads*, less great in the “just wrote, now read” edge cases unless your update path is tight.

## Implementation options (don’t reinvent unless you must)

- In-process libraries (fastest, simplest for single service): e.g., **Guava** BloomFilter
- Embedded/shared with your cache layer: e.g., **RedisBloom** module
- Built into storage engines: e.g., **Cassandra SSTable Bloom filters** (internal, but the concept is the same)

Pick the option that matches your update model:

- If membership changes on every write and needs low lag, in-process is attractive.
- If many services need the same filter, a shared store can reduce duplication (but adds network dependencies).

## The opinionated takeaway

If your system is getting bullied by random keys, *stop paying for misses*.

A Bloom filter in front of your expensive lookup path is one of the highest ROI “system design” moves you can make:

- Cheap, fast, memory-efficient
- Predictable tradeoffs
- Easy to validate with metrics

Just don’t confuse “maybe” with “yes,” and don’t let the filter quietly drift out of spec.

## References (worth your time)

- Burton H. Bloom, 1970: *Space/Time Trade-offs in Hash Coding with Allowable Errors* (original paper)
  - https://dl.acm.org/doi/10.1145/362686.362692
- Guava BloomFilter documentation
  - https://guava.dev/releases/23.0/api/docs/com/google/common/hash/BloomFilter.html
- RedisBloom (Bloom filters for Redis)
  - https://redis.io/docs/latest/develop/data-types/probabilistic/bloom-filter/
- Apache Cassandra: Bloom filters in SSTables (overview)
  - https://cassandra.apache.org/doc/latest/cassandra/operating/bloom_filters.html
