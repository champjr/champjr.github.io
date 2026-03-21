---
title: "System Design Daily: Request Coalescing (SingleFlight) and Cache Stampedes"
pubDate: 2026-03-21
description: "How to collapse duplicate work, protect downstreams, and make misses boring."
tags: ["system-design", "engineering", "distributed-systems", "caching", "reliability", "performance"]
---

If you’ve ever watched a perfectly healthy system fall over right after a cache expires, you’ve met the **cache stampede**.

The bug isn’t “the cache missed.” The bug is that **10,000 identical misses triggered 10,000 identical expensive computations**.

Today’s topic is a simple, underused pattern that turns that chaos into one controlled request: **request coalescing**, often implemented as **singleflight**.

## Problem framing: when identical work becomes a DoS

Caches (and other accelerators like precomputed materialized views) are great until they’re not.

A typical read path:

```text
Client -> API -> Cache -> (miss) -> DB / downstream service -> Cache set -> respond
```

What happens at scale:

- A popular key expires (or is evicted).
- A burst of traffic hits that key.
- Every request misses and independently recomputes/fetches.
- The DB/downstream saturates.
- Latency spikes, retries amplify traffic, timeouts trigger circuit breakers, and the blast radius grows.

This can happen even without a cache:

- Generating thumbnails
- Building a “top N feed”
- Fetching and enriching a user profile from multiple services
- Doing an expensive search query
- Calling a third-party API with strict rate limits

The system isn’t failing because it can’t do the work; it’s failing because it’s doing the **same** work **too many times concurrently**.

## Core concept: collapse duplicates into one in-flight operation

**Request coalescing** means: for a given *dedupe key* (cache key, user ID, query signature), allow only **one** in-flight computation at a time. Everyone else waits for that result and reuses it.

A canonical implementation is Go’s `singleflight` (the name became shorthand for the pattern):

- Create a map: `dedupeKey -> inFlightPromise`
- If a request arrives and the key is already in-flight:
  - Subscribe to that promise/future and wait
- If not in-flight:
  - Start the work, store the promise
  - On completion, resolve promise and remove from map

### ASCII diagram

```text
            (key = "product:123")

R1 ----> miss ----> start DB fetch ----------------> result
R2 ----> miss ----> join in-flight ----------------> same result
R3 ----> miss ----> join in-flight ----------------> same result
R4 ----> miss ----> join in-flight ----------------> same result

Without coalescing: 4 DB calls.
With coalescing:     1 DB call + 3 waits.
```

### A minimal pseudo-API

Imagine you serve `GET /price?sku=123`.

- Cache key: `price:sku:123`
- Dedupe key: same as cache key (most common)

Pseudo-code:

```text
function getPrice(sku):
  key = "price:sku:" + sku

  if cache.has(key):
    return cache.get(key)

  return singleflight.do(key, () => {
    # Double-check inside the coalesced function.
    # Another request may have filled the cache while we waited.
    if cache.has(key):
      return cache.get(key)

    value = db.query("SELECT price FROM prices WHERE sku=?", sku)
    cache.set(key, value, ttl=60s)
    return value
  })
```

That inner “double-check” is not pedantry; it prevents redundant work when the first request populates the cache while others are queued.

## A small example with numbers

Suppose:

- One hot key gets **2,000 RPS** during peak.
- Cache TTL is **60s**.
- The underlying DB query takes **40ms** and costs ~**5ms CPU** on the DB (plus IO).

When the key expires, in the worst case you can easily trigger:

- Roughly **2,000 concurrent misses** within one second.
- That’s ~2,000 DB calls *for the same data*.

With request coalescing, that becomes:

- **1 DB call** per key per “miss window”
- plus waiting time for the other 1,999 requests (which is usually acceptable because you’re trading DB meltdown for a bounded wait).

You’re converting a multiplicative spike into something closer to:

```text
DB load ≈ unique keys per second that miss
```

That’s a much more predictable system.

## Tradeoffs: nothing is free

Request coalescing is powerful, but you should understand what you’re buying.

### 1) Tail latency vs. backend protection

Coalescing increases latency for the “joiners” because they wait for the leader request to finish.

- If the backend call is 40ms, joiners might see +40ms (instead of failing later due to saturation).
- This is usually a good trade, but it changes the shape of your latency distribution.

Practical take: coalescing is often a **reliability feature** more than a pure performance feature.

### 2) Head-of-line blocking

If your coalesced work becomes slow (DB degradation, GC pause, network issues), everyone waiting on that key stacks up.

Mitigations:

- Put strict **timeouts** around the coalesced work.
- Prefer **fast-fail** + stale data in some domains (“show a slightly old price rather than 500s”).
- Ensure you have **bulkheads** (don’t let one key consume all worker threads).

### 3) Key choice matters

Too broad (e.g., dedupe by endpoint only) and you serialize unrelated work.

Too narrow (e.g., include random request IDs in the key) and you dedupe nothing.

Good dedupe keys typically match:

- A cache key (object ID, SKU, user ID)
- A query signature (normalized params, sorted filters)

### 4) Memory and cleanup

You’re storing in-flight state.

- If you forget to remove entries on error, you leak memory.
- If you allow unbounded unique keys, you can create a new DOS vector.

Mitigations:

- Cap the number of concurrent in-flight keys.
- Evict old promises.
- Use per-process or per-shard coalescing to keep scope bounded.

### 5) Multi-instance reality

Coalescing inside one process only dedupes within that process.

If you run 50 API instances behind a load balancer, you can still have 50 concurrent misses for the same key.

That might still be fine (50x reduction is not as good as 2000x, but it’s something). If you need cross-cluster coalescing, it gets harder:

- Distributed locks
- “Dogpile” prevention using cache primitives (like `SETNX` / lease keys)
- Dedicated compute services

Distributed coalescing is possible, but the complexity increases fast. Start local; measure; then decide.

## Common failure modes (and how people accidentally make it worse)

### Failure mode 1: no timeout → request pile-ups

If the leader request hangs, joiners hang.

Fix:

- Set a timeout for the coalesced call (and return a fallback).
- Treat timeouts as first-class signals.

### Failure mode 2: leader fails → everyone fails

If the leader errors, everyone gets the same error.

Sometimes that’s correct, but if the error is transient, you can create synchronized retry storms.

Fixes:

- Apply **retry budgets** and jitter.
- Consider returning stale data on leader failure.
- Add **negative caching** for known-missing keys (404s) to avoid repeated expensive misses.

### Failure mode 3: cache fill stampede (write amplification)

If every joiner writes the cache on completion, you get extra load.

Fix:

- Only the leader should write to the cache.
- Joiners should use the shared result.

### Failure mode 4: bad key normalization

Example: queries that differ only in parameter ordering:

- `?tag=a&tag=b`
- `?tag=b&tag=a`

If you don’t normalize, you create multiple keys for identical work.

Fix:

- Canonicalize requests: sort params, trim defaults, normalize casing where appropriate.

### Failure mode 5: stampedes caused by synchronized TTLs

Even with coalescing, many different hot keys can expire at the same moment (e.g., everything set at deploy time with a 60s TTL).

Fix:

- Add **TTL jitter** (e.g., 60s ± 10%).
- Use **stale-while-revalidate** where possible.

## How to test and observe it in production

This is one of those patterns that *looks* correct in code review but fails under real concurrency. Treat it like a performance feature: test it.

### Load test scenarios to run

1) **Hot-key expiry test**

- Warm cache for one key.
- Fire 1k–10k RPS at that key.
- Force expiry/eviction.
- Verify backend QPS stays near 1 (per instance) during the miss window.

2) **Backend slowness test**

- Inject 200ms latency in the DB/downstream.
- Verify joiners wait (bounded by timeout) and the system stays stable.

3) **Error storm test**

- Make the backend return 500s intermittently.
- Verify you don’t amplify with synchronized retries.

### Metrics that make this visible

Track these per endpoint and per key family (avoid high-cardinality metrics by hashing/bucketing keys):

- `singleflight_leader_total` vs `singleflight_joiner_total`
- `singleflight_wait_ms` (distribution)
- Backend QPS for the expensive dependency
- Cache hit rate *and* cache miss concurrency
- 429/5xx rates and timeouts

A good coalescing implementation will show:

- A spike in joiners during a miss
- Minimal increase in backend QPS
- Controlled increase in latency (not a cascading failure)

### Logging / tracing

If you have distributed tracing, add spans/tags like:

- `coalesced=true|false`
- `coalesce_role=leader|joiner`
- `dedupe_key_hash=<short hash>`

This helps you debug “why did latency spike?” without logging raw keys.

## Practical extensions (when the basic pattern isn’t enough)

- **Stale-while-revalidate:** serve stale cached data immediately, refresh in the background (still coalesced).
- **Soft TTL + hard TTL:** refresh after soft TTL, but allow stale until hard TTL.
- **Lease keys (dogpile prevention):** use a short-lived “I am recomputing” marker in the cache layer itself.
- **Request hedging:** for slow backends, the leader might hedge after a threshold (careful: this can undo the backend protection you wanted).

## Opinionated take

If you already have caching and you don’t have request coalescing, you’re leaving a reliability footgun loaded.

Caches turn latency into throughput… until they turn throughput into synchronized failure. Coalescing is one of the cleanest ways to make misses boring.

## Further reading

- Go `singleflight` package (reference implementation): <https://pkg.go.dev/golang.org/x/sync/singleflight>
- “Cache Stampede” / “Dogpile effect” overview (concept and mitigations): <https://en.wikipedia.org/wiki/Cache_stampede>
- AWS Builders’ Library on caching (practical guidance and failure modes): <https://aws.amazon.com/builders-library/> (search within for caching patterns)
- NGINX `proxy_cache_lock` (a concrete “one request populates cache” mechanism): <https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_cache_lock>
