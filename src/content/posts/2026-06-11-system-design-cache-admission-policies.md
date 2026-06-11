---
title: "System Design Daily: Cache Admission Policies"
pubDate: 2026-06-11
description: "Why deciding what not to cache can matter more than making your cache bigger."
tags: ["system-design", "engineering", "distributed-systems", "caching", "performance", "reliability"]
---

Most cache discussions fixate on eviction.

That makes sense at first. A cache is full, so something has to go. LRU, LFU, FIFO, random, pick your policy.

But many real systems have a more embarrassing problem before eviction even matters: they cache too much garbage.

A one-hit key gets fetched once, stored, never used again, and still consumes memory. A burst of low-value traffic can shove useful entries out of the cache before they have a chance to pay rent. Then the team responds the usual way: make the cache bigger, add more nodes, and act surprised when the hit rate barely moves.

That is the problem **cache admission policies** are meant to solve.

The core idea is simple: **not every miss deserves to become a cache entry**. A cache should be selective. If you admit everything, you are turning expensive memory into a temporary holding area for noise.

## The problem framing

Imagine an API cache with room for 1 million objects.

Normal traffic looks like this:

- 70 percent of requests hit a stable working set of 200,000 hot keys
- 20 percent hit medium-frequency keys
- 10 percent are long-tail lookups that may never repeat

Then a crawler, backfill job, or strange customer workload starts requesting 5 million distinct keys over a few hours.

If your policy is "cache every miss," the long tail pollutes the cache:

- hot entries get evicted sooner than they should
- hit rate drops even though total memory stayed the same
- origin QPS rises
- latency gets worse for your actual users, not just the noisy workload

This is why I think cache admission is one of the most underappreciated system design levers. It addresses a brutally practical question: **which misses are worth betting memory on?**

## Core concepts

### 1. Admission and eviction are different decisions

Eviction answers: "the cache is full, what should leave?"

Admission answers: "this item missed, should it enter at all?"

A lot of systems only implement the first question. That is fine for small, predictable working sets. It breaks down when workloads are skewed, bursty, or adversarial.

### 2. Recency alone is not enough

LRU is popular because it is intuitive: recently used items are likely to be used again.

Sometimes that is true. Sometimes it is not.

A sequential scan can destroy an LRU cache because every new key looks recent exactly once. The cache happily fills up with junk, even though those keys have no future value.

Admission policies help by asking for evidence before promoting a key into the main cache.

### 3. TinyLFU style thinking: estimate frequency cheaply

A strong modern pattern is to keep a tiny approximate history structure, often a count-min sketch or similar frequency estimator, and use it to compare a candidate entry against a current resident.

The rough logic is:

```text
on cache miss for key K:
  record K in frequency sketch
  if cache has room:
    admit K
  else:
    pick victim V from eviction policy
    if estimated_frequency(K) > estimated_frequency(V):
      admit K, evict V
    else:
      reject K
```

This is the spirit behind TinyLFU and systems inspired by it. You do not need a perfect history. You just need a cheap signal that distinguishes repeating demand from one-off noise.

### 4. Windowed caches balance recency and frequency

Pure frequency can also be too stubborn. A newly hot item may not have enough history yet.

That is why practical designs often keep a small "window" region that admits recent misses freely, then promote only the winners into the main protected cache.

A useful mental model is:

| Region | Job |
| --- | --- |
| Admission window | Let new items prove themselves |
| Main cache | Protect entries with demonstrated value |
| Frequency sketch | Remember approximate demand history |

This combination tends to outperform plain LRU on messy production traffic because it handles both flash-new items and repeat-heavy steady state.

## A small example

Suppose you run a metadata service with a 10 GB cache.

- hot working set: 2 GB
- medium set: 3 GB
- long tail during normal traffic: 1 GB effective churn
- scan event from analytics job: 20 million unique keys in one hour

With admit-everything LRU, the scan floods the cache. Even hot keys start missing because the cache keeps rewarding first-time appearances.

Now assume an admission policy rejects most one-hit scan keys unless they appear again.

If 95 percent of scan keys are truly one-and-done, then only 5 percent meaningfully compete for residency. The hot 2 GB working set stays resident, hit rate stays much closer to normal, and origin load does not spike nearly as hard.

This is one of those cases where the best cache optimization is not a faster cache. It is better taste.

## Tradeoffs

Admission policies are not free.

### Better hit rates under skewed traffic

This is the main upside. They are especially valuable when you have:

- large long tails
- periodic scans
- multi-tenant traffic with uneven quality
- workloads where memory is expensive and origin misses hurt

### More complexity

Now you have another decision layer to tune and observe. That includes sketch sizing, reset behavior, admission thresholds, and interaction with eviction.

### Approximation errors

Frequency estimators are approximate by design. That is usually fine, but it means some good entries will be rejected and some mediocre ones will sneak in.

That sounds scary until you compare it to the baseline, which is often "admit everything and hope." Approximate and selective usually beats precise and naive.

### Risk of under-admitting new hot items

If you make admission too strict, newly important content may struggle to enter the cache quickly. That is why a small admission window matters. Systems need a way to discover fresh winners.

## Common failure modes

### Using hit rate alone as the success metric

A cache can show a decent aggregate hit rate while still failing the workload that matters. Split metrics by tenant, endpoint, or key class when possible. The whole point of admission control is protecting valuable traffic from noisy traffic.

### Ignoring scans and batch jobs

Teams often benchmark caches with friendly replay traffic, then get blindsided by reindexers, migrations, or analytics sweeps. Admission policies earn their keep on ugly days, not easy ones.

### Oversizing the frequency sketch incorrectly

Too small, and your history becomes noisy. Too large, and you waste memory that should have gone to actual cache entries. The metadata for clever caching can become its own tax.

### Forgetting that application semantics still matter

A key might be frequently requested and still be a bad cache candidate if it is huge, highly volatile, or correctness-sensitive. Admission should complement domain rules, not replace them.

## How to test and observe in production

I would test cache admission with workload shape changes, not just steady-state load.

At minimum:

- replay a normal hot-set workload
- inject a large one-time scan
- inject a burst where a formerly cold key becomes hot
- compare LRU-only versus admission-enabled behavior
- measure what happens during deploys and warmups

The production signals I care about most are:

- hit rate by endpoint or tenant
- origin QPS during scan-like traffic
- eviction rate of hot keys
- cache churn, meaning writes/inserts per second
- percentage of misses admitted versus rejected
- latency of the protected working set
- memory overhead of the admission metadata

A simple but useful dashboard chart is **admission rejects over time next to origin QPS and hot-key miss rate**. If rejects go up during a scan while hot-key misses stay flat, that is often the policy doing exactly what you wanted.

For canary testing, run the new policy on a slice of traffic and compare:

- same memory budget
- same key population
- same time window
- different admission strategy

If the only win is a prettier benchmark and not lower origin pressure or better tail latency, I would be skeptical.

## Practical guidance

If your cache workload is tiny and predictable, plain LRU may be enough. Do not add machinery just to feel sophisticated.

But if you have multi-tenant traffic, scan-heavy patterns, or long-tail request distributions, admission policy deserves a seat at the table. In those systems, the question is not "what should we evict?" It is "why are we caching this nonsense in the first place?"

My opinionated takeaway is this: **a cache should be allowed to say no**.

That one design choice often separates a cache that protects your backend from a cache that just burns RAM while looking busy.

## Further reading

- [TinyLFU: A Highly Efficient Cache Admission Policy](https://arxiv.org/abs/1512.00727)
- [Caffeine Cache wiki](https://github.com/ben-manes/caffeine/wiki)
- [Redis blog: LFU vs LRU, how to choose the right cache eviction policy](https://redis.io/blog/lfu-vs-lru-how-to-choose-the-right-cache-eviction-policy/)
