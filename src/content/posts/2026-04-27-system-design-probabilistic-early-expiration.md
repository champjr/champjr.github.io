---
title: "System Design Daily: Probabilistic Early Expiration"
pubDate: 2026-04-27
description: "How to stop synchronized cache expiry from turning one hot key into a thundering herd on your origin."
tags: ["system-design", "engineering", "distributed-systems", "caching", "performance", "reliability"]
---

Caches fail in a very specific and very annoying way: they work brilliantly right up until a popular key expires, and then everybody rediscovers the database at the same time.

That failure mode is the cache stampede, sometimes called the thundering herd. One product page, one feature flag blob, one homepage query, or one pricing object expires, and suddenly hundreds or thousands of requests all decide it is time to regenerate the same value.

If the value is expensive, the cache is no longer protecting your origin. It is acting like a synchronized alarm clock.

Probabilistic early expiration is one of the more elegant ways to reduce that risk. Instead of letting every request treat the TTL as a hard cliff, you give some requests permission to refresh a little early, based on probability. That spreads regeneration work over time instead of concentrating it at one exact second.

I like this technique because it is practical. It does not require magical exactly-once behavior, and it does not pretend every hot key can be solved with a lock.

## The problem

Suppose a hot cache key has:

- TTL = 300 seconds
- request rate = 2,000 requests per second
- regeneration cost = 250 ms of database work

If that key expires exactly at `12:00:00`, then a large fraction of those 2,000 requests may miss together. Even if only 5 percent race through before the new value is written back, that is still 100 expensive origin requests for one object.

Now multiply that across several hot keys and a mildly overloaded database. This is how a cache layer that looked healthy at 11:59 becomes part of the outage at 12:00.

A naive TTL creates synchronized behavior:

```text
all requests trust cache
        |
        v
   item expires
        |
        v
 many requests regenerate together
        |
        v
 origin spikes, latency rises, retries begin
```

The core design goal is simple: **de-correlate refreshes**.

## Core idea

Probabilistic early expiration means a cached item can be treated as "effectively expired" before its actual TTL, but not by every request.

Instead, each request near the end of the TTL window has some chance of volunteering to refresh the item.

Early in the item life, that probability is near zero.
As the item gets older, the probability increases.
By the time the hard TTL arrives, refresh is mandatory.

That turns one cliff into a slope.

A simplified decision rule might look like this:

```text
if age < 240s:
  serve from cache
elif 240s <= age < 300s:
  with increasing probability, refresh in background
else:
  refresh now
```

The exact function varies. Some systems use a random draw against remaining TTL. Some use formulas derived from expected recomputation cost. The important part is not the math cosplay. The important part is that **refresh attempts become staggered instead of synchronized**.

## A small example

Let us say a key lives for 5 minutes, and you start allowing probabilistic refreshes in the last 60 seconds.

A rough policy:

| Age of cached value | Chance this request refreshes |
| --- | --- |
| 0 to 239s | 0% |
| 240 to 269s | 1% |
| 270 to 289s | 5% |
| 290 to 299s | 20% |
| 300s+ | 100% |

If the key is getting 2,000 requests per second, you do not need all 2,000 to refresh it. You need one of them to do it before the hard expiry becomes a dogpile.

At 20 percent probability in the final 10 seconds, a refresh is very likely to happen before the TTL cliff. Most callers still get a cached answer. One or a few callers pay the regeneration cost. The origin sees a controlled trickle instead of a stampede.

## How it compares to other anti-stampede techniques

Probabilistic early expiration is not the only move.

- **Single-flight/request coalescing** collapses duplicate concurrent misses in one process or service instance.
- **Distributed locks or leases** try to guarantee only one refresher across the fleet.
- **Stale-while-revalidate** serves stale data while refresh happens in the background.
- **Jittered TTLs** reduce many keys expiring at the same instant.

These are complementary, not mutually exclusive.

My opinion: probabilistic early expiration is especially useful when the fleet is large, the key is hot, and you cannot rely on perfect global coordination. Distributed locks can help, but they add failure modes of their own. Probability is often a cheaper, more robust first line of defense.

## Tradeoffs

### What you gain

- Smoother origin load for hot keys
- Fewer synchronized cache misses
- Better tail latency during refresh windows
- Less dependence on a single global lock service

### What you pay

- More complex cache metadata, because you need age or creation time
- Possible extra refreshes before strict expiry
- Slightly less cache efficiency, since some values are recomputed early
- Harder reasoning if teams expect TTL to mean one exact thing

That last point matters. TTL stops being a pure "drop dead at second 300" rule and becomes a freshness policy with a soft zone and a hard boundary.

For most high-traffic systems, that is a good trade. A little wasted work is cheaper than synchronized panic.

## Common failure modes

### 1. Refreshing too aggressively

Teams hear "early refresh" and accidentally build "constant refresh."

If your probability curve is too eager, hot keys regenerate far more often than needed. You reduce stampedes, sure, but you quietly erase the economic value of caching.

Watch regeneration rate, not just hit rate.

### 2. No stale serving path

If refreshes happen early but requests block on the refresh anyway, you still create latency spikes.

The usual happy path is:

1. serve cached value if still acceptable
2. let one request or background worker refresh
3. swap in the new value when ready

If the data truly cannot be served stale for even a few seconds, you need a stricter strategy and stronger coordination.

### 3. Ignoring multi-instance duplication

A probabilistic policy reduces synchronization, but several hosts may still decide to refresh around the same time.

That is normal. The goal is not mathematical purity. The goal is to turn 500 simultaneous refreshes into maybe 2 or 5.

For extremely expensive regenerations, combine this with leases or single-flight.

### 4. Using it on cold keys

This technique matters most for hot keys. A key that gets one request every ten minutes does not have a stampede problem.

Do not complicate every cache path equally. Spend design energy where traffic concentration is real.

### 5. Forgetting origin backpressure

If refresh cost is high, even a reduced number of refreshers can still hurt an already struggling dependency.

Your cache strategy should cooperate with timeouts, concurrency limits, and load shedding. The cache is not exempt from the rest of system design.

## How to test it

Before production, simulate three scenarios:

1. **Hard TTL baseline**: many requests hit the same key and all refresh only after expiration.
2. **Probabilistic early expiration**: same traffic, but with a soft refresh window.
3. **Origin slowdown**: repeat both tests while regeneration latency doubles or triples.

Measure:

- cache hit rate
- regeneration rate
- concurrent refresh count per key
- origin QPS during refresh windows
- p95 and p99 request latency

A good result does not mean zero refresh duplication. A good result means the origin spike is much smaller and user-facing latency is flatter.

A simple pseudo-API for implementation might look like this:

```ts
const result = cache.getWithPolicy("product:123", {
  ttlSeconds: 300,
  earlyRefreshWindowSeconds: 60,
  shouldRefreshEarly: (ageSeconds, rand) => {
    if (ageSeconds < 240) return false
    if (ageSeconds < 270) return rand < 0.01
    if (ageSeconds < 290) return rand < 0.05
    if (ageSeconds < 300) return rand < 0.20
    return true
  }
})
```

You can start with something this boring. It does not need a PhD-shaped formula on day one.

## What to observe in production

If you deploy this, do not stop at global cache hit rate. That metric is too flattering.

Observe per-key and per-class behavior:

- top hot keys by request volume
- refresh attempts per key
- concurrent refresh count
- stale-served count
- origin latency during refresh windows
- error rate for regeneration path
- percentage of refreshes that happen before hard TTL

Also watch for refresh amplification during deploys or instance churn. If every host loses local state and makes the same decision badly, you may still get mini-herds.

## When to use it

Probabilistic early expiration is a good fit when:

- you have a small number of very hot keys
- regeneration is moderately expensive
- serving slightly stale data is acceptable for a short window
- global locking is undesirable or too fragile

It is a worse fit when every read must reflect the freshest possible write, or when cache regeneration has external side effects that make duplicate refreshes unacceptable.

The practical lesson is this: **a TTL should not behave like a landmine**. If a key is important and heavily shared, refreshing it should be a gradual, observable process, not a synchronized surprise.

That is what probabilistic early expiration buys you. Not perfection, just a calmer system.

Further reading:

- [Caching at Scale with Redis](https://redis.io/blog/caches-promises-locks/)
- [HTTP Stale-While-Revalidate](https://web.dev/articles/stale-while-revalidate)
- [The Memcached FAQ](https://github.com/memcached/memcached/wiki/FAQ)
- [Avoiding Thundering Herds in Distributed Caches](https://www.evanjones.ca/preventing-thundering-herd-problems.html)
