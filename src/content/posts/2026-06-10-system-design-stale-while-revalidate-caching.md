---
title: "System Design Daily: Stale-While-Revalidate Caching"
pubDate: 2026-06-10
description: "How to keep read latency low during cache expiry without stampedes, user-visible stalls, or lying to yourself about freshness."
tags: ["system-design", "engineering", "distributed-systems", "caching", "performance", "reliability"]
---

Caching gets talked about as if the only choice is simple: either serve fresh data or serve fast data.

Real systems are messier than that. A cache entry expires, 2,000 requests arrive in the same second, and suddenly your “fast path” has turned into a synchronized stampede against the database or origin service. If the origin is already a little slow, you can make it fall over with your own success.

That is the problem **stale-while-revalidate** is built to solve.

The idea is straightforward: when cached data is slightly old, you may still serve it for a bounded window **while** one request refreshes it in the background. Users keep getting fast responses, the origin avoids a thundering herd, and the system degrades more gracefully under bursty read traffic.

I like this pattern because it is practical, but it also punishes sloppy thinking. If you do not define freshness windows, ownership of refreshes, and observability clearly, you can accidentally build a system that is fast, cheap, and quietly wrong.

## The problem

Imagine a product catalog API where each item page is cached for 60 seconds.

- average traffic: 500 requests/sec
- hot item traffic: 80 requests/sec for a few popular SKUs
- origin read latency: 25 ms normally, 400 ms during a DB hiccup

At `12:00:00`, the cached entry for a hot SKU expires.

If your cache strategy is “hard TTL then miss,” every request after expiration tries to refill the cache. Even if only 40 requests pile up before the first refresh completes, you just turned one expired key into 40 origin reads. Multiply that across a few hot keys and you get:

- latency spikes for users
- avoidable load on the database
- lower cache hit rate at exactly the worst moment
- retry pressure if the origin slows down further

Stale-while-revalidate changes the behavior:

1. the first request notices the item is stale
2. that request triggers a refresh
3. other requests still receive the last cached value for a bounded stale window
4. once refresh completes, new requests get the updated value

That tiny policy change often matters more than squeezing another 5 percent out of your cache hit rate.

## Core concepts

### 1. Fresh, stale, and too stale are different states

A good stale-while-revalidate design does **not** treat the cache as binary.

You usually want at least three states:

- **fresh**: safe to serve normally
- **stale but acceptable**: safe to serve temporarily while refresh happens
- **expired beyond tolerance**: no longer safe to serve

That means one TTL is often not enough. In practice you may want:

- `fresh_ttl = 60s`
- `stale_ttl = 300s`

For the first minute, serve as fresh. For the next four minutes, serve stale only if a refresh is in progress or can be initiated. After five minutes total, fail closed and fetch from origin before serving.

If you skip this distinction, “stale-while-revalidate” becomes “serve old stuff forever when the backend is sad,” which is not a reliability feature. It is just hiding a bug.

### 2. Only one actor should refresh a key

The pattern works best when stale serving is paired with **request coalescing** or a per-key lock.

Pseudo-flow:

```text
GET /products/sku-123
  -> cache lookup
  -> value found, age = 75s
  -> within stale window
  -> try acquire refresh lock for key product:sku-123
     -> winner triggers background refresh
     -> losers serve stale response immediately
```

If 100 requests all decide to refresh, you have not solved the herd problem, you have just delayed it by a minute.

### 3. Freshness is a product decision, not just an infrastructure default

Some data tolerates brief staleness well:

- product descriptions
- blog pages
- feature documentation
- follower counts on profile cards

Some data does not:

- bank balances
- seat inventory during checkout
- authorization decisions
- “has this coupon already been redeemed?”

A lot of engineering pain comes from using the same cache policy for both categories. My bias is simple: **use stale-while-revalidate for read-heavy data where slight staleness is cheaper than synchronous misses**. Do not use it where correctness depends on immediate visibility.

## A small example

Suppose a pricing metadata service has these settings for a cache key:

| Parameter | Value |
| --- | --- |
| Fresh TTL | 30 seconds |
| Stale window | 120 seconds |
| Refresh lock timeout | 2 seconds |
| Origin p95 | 90 ms |

At `t=0`, the cache is filled.

At `t=35s`, 300 requests arrive over 5 seconds. The object is stale, but still within the stale window.

Without stale-while-revalidate:

- many requests block on origin
- origin sees a burst of duplicate reads
- client p95 may jump from 15 ms to 100+ ms

With stale-while-revalidate plus single-flight refresh:

- 1 request performs the refresh
- roughly 299 requests get the previous value in 10 to 20 ms
- origin sees 1 refill instead of 300
- once refresh completes, the key is fresh again

That is a major reduction in backend load and tail latency, bought by tolerating 5 to 6 extra seconds of data age.

## Tradeoffs

The big tradeoff is obvious: **availability and latency improve by spending freshness budget**.

That trade can be very good, but only when the budget is explicit.

| Choice | Upside | Downside |
| --- | --- | --- |
| Short stale window | tighter freshness | more synchronous misses during bursts |
| Long stale window | fewer origin spikes | greater risk of serving misleading data |
| Background refresh | stable user latency | extra implementation complexity |
| Synchronous refresh on expiry | simpler semantics | worse tail latency and herd risk |

A few subtler tradeoffs matter too.

### Hidden inconsistency

If two users read the same object seconds apart, one may see a refreshed version and the other may see the stale one. That is usually acceptable for content-ish data, but it can confuse teams if they expect strict read-after-write behavior.

### Origin outages can stretch stale serving

This pattern often pairs well with “stale-if-error” behavior, where stale data is served when refresh fails. That can be a lifesaver during outages, but it needs hard caps. Otherwise you can end up serving yesterday’s truth as if it were current reality.

### Hot keys need extra protection

The hotter the key, the more carefully you should control refresh ownership. A single missing lock or race in your refresh path can make hot-key behavior much worse than a normal cache miss.

## Common failure modes

### Treating all stale data as equally safe

Teams sometimes enable stale serving globally because it looks like a free latency win. It is not. Price display data, cart totals, and inventory status often need different policies even inside the same product.

### Refreshing inline instead of in the background

If the request that sees staleness must wait for the origin before returning, you are closer to “cache miss with a lock” than true stale-while-revalidate. Sometimes that is fine. But it does not deliver the main user-facing benefit of the pattern.

### No jitter on expiration boundaries

Even with stale serving, if thousands of keys expire at exactly the same second, your refresh traffic can become spiky. Add TTL jitter so expirations spread out over time.

### No visibility into age served

If you do not measure how old the returned data was, you can fool yourself badly. A 99 percent hit rate can still hide a poor user experience if half those hits are very stale during incidents.

## How to test and observe it in production

Start with controlled load tests around expiry boundaries.

I would test at least these scenarios:

- one hot key expires under bursty traffic
- origin latency jumps from 20 ms to 500 ms during refresh
- refresh lock holder crashes mid-refresh
- origin returns errors for 2 minutes
- many keys expire in the same minute

The metrics I care about most are:

- cache hit rate split into **fresh hits** and **stale hits**
- refresh requests per key
- refresh lock contention
- age of data served at response time
- origin QPS before and after expiry boundaries
- p95 and p99 latency for hot reads
- fraction of requests forced to bypass stale serving because the object became too old

A useful alert is not just “cache hit rate dropped.” It is “stale-hit ratio spiked and refresh success fell,” because that tells you the system is leaning on the stale window harder than intended.

Also log refresh outcomes separately from ordinary cache misses. If you blend them together, debugging becomes much harder.

## The practical takeaway

Stale-while-revalidate is one of the best patterns for read-heavy systems with uneven traffic, because it turns expiry from a cliff into a slope.

Used well, it gives you:

- lower tail latency
- fewer origin stampedes
- better resilience during transient slowdowns

Used badly, it gives you a polite-looking lie.

The rule I like is simple: **serve stale on purpose, not by accident**. Define the freshness budget, limit who can refresh, measure the age you actually serve, and be honest about which data should never use the pattern.

## Further reading

- [RFC 5861: HTTP Cache-Control Extensions for Stale Content](https://datatracker.ietf.org/doc/html/rfc5861)
- [web.dev: Keeping things fresh with stale-while-revalidate](https://web.dev/articles/stale-while-revalidate)
- [Cloudflare Docs: Origin Cache Control](https://developers.cloudflare.com/cache/concepts/cache-control/#stale-while-revalidate)
- [RFC 9111: HTTP Caching](https://www.rfc-editor.org/rfc/rfc9111)
