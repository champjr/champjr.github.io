---
title: "System Design Daily: Negative Caching"
pubDate: 2026-04-10
description: "Why caching failures and misses, carefully, can protect your origin and smooth out noisy traffic."
tags: ["system-design", "engineering", "distributed-systems", "caching", "performance"]
---

Most engineers learn to cache successful responses first.

That is reasonable. Successful responses are easy to reason about, they have obvious reuse, and they usually make dashboards look better fast.

But a lot of production pain comes from the opposite path: repeated **misses**, repeated **not founds**, repeated **permission denials**, and repeated **temporary upstream failures**. If you do not cache any of that, your system can end up doing expensive work over and over just to rediscover the same bad answer.

That is where **negative caching** helps.

Negative caching means storing some form of “the answer is absent or currently unusable” for a short period, so the next request does not hammer the origin again. Done well, it is one of the most practical ways to reduce waste. Done badly, it turns transient problems into fake truth.

## The problem

Imagine a service that serves user profile images.

- Existing avatar: return `200 OK`
- User has never uploaded one: return `404 Not Found`
- Storage backend is flaky: return `503 Service Unavailable`

Without negative caching, a popular client can repeatedly ask for the same missing avatar every page load. Ten thousand clients requesting `/avatars/u_123.png` every minute can easily become ten thousand pointless storage lookups per minute.

Worse, when an upstream system is already degraded, retries and fan-out can amplify the traffic. A cache that only stores positive responses will happily absorb the easy path while letting the failure path pound the backend to dust.

Negative caching exists to break that loop.

## Core concepts

### 1. Not every negative result is equal

There are at least three useful categories:

| Result type | Example | Cacheable? | Typical TTL |
| --- | --- | --- | --- |
| **Permanent-ish absence** | `404 user not found` | Usually yes | seconds to minutes |
| **Policy denial** | `403 not allowed` | Sometimes, carefully | very short |
| **Temporary failure** | `503 upstream unavailable` | Sometimes, with caution | very short, often a few seconds |

The biggest mistake is treating all of these as equally trustworthy.

A `404` for a user ID that has never existed is often a good candidate for short caching. A `503` might be useful to cache for a couple of seconds during a brownout, but caching it for a minute can make recovery look slower than it really is.

### 2. Negative caching is about protecting the origin, not winning arguments

The goal is not to prove that a resource is absent forever. The goal is to avoid repeating expensive work faster than reality is likely to change.

That means negative cache TTLs should usually be:

- **shorter than positive cache TTLs**
- tied to how quickly reality may change
- different by status code or error class

If your positive cache lasts 10 minutes, your negative cache for `404` might last 30 seconds. Your negative cache for `503` might last 2 seconds. Same mechanism, very different trust level.

### 3. Cache the normalized failure, not the whole accident

If your backend returns a 500 with a stack trace, that is not something you want echoed back from cache. Usually you should cache a normalized internal representation, for example:

```json
{
  "kind": "not_found",
  "status": 404,
  "expires_at": "2026-04-10T18:00:30Z"
}
```

Then your edge or service can render an appropriate response without storing noisy internal details.

### 4. Key design matters more than people expect

If you cache negative results on the wrong key, you can deny legitimate traffic.

A few examples:

- `GET /document/123` returning `403` may depend on **user identity**
- `GET /search?q=chair` returning “no results” may depend on **region** or **inventory freshness**
- `GET /feature-x` returning `404` may depend on **deployment version**

Negative caching is safe only when the cache key includes every dimension needed to make the result valid.

## A small example

Suppose a product API receives 2,000 requests per second for item pages.

- 92% are hot, valid products
- 7% are for products that were deleted or never existed
- 1% hit an image metadata service that intermittently times out

If each miss costs a 15 ms database lookup, then the 7% invalid traffic alone is:

- 140 requests/sec of misses
- 140 × 15 ms = 2,100 ms of DB work per second

That is more than **two full CPU-seconds of lookup work every second** on bad requests alone, before you count connection overhead or retries.

Now add a 30-second negative cache for stable `404` misses. The first miss still hits origin, but repeated requests for the same bad key get absorbed by cache. If most of those invalid requests are concentrated on a few thousand bad IDs, origin load drops sharply.

A simple API sketch:

```http
GET /products/sku_8472
```

Possible cache policy:

```text
200 -> cache 300s
404 -> cache 30s
429 -> do not cache globally
503 -> cache 2s, service-local only
```

That last line matters. Some failures are safe to cache only in a local process cache, not in a shared CDN or global Redis tier.

## Tradeoffs

### Better protection vs. stale absence

The upside is obvious: fewer useless origin calls, smoother latency during noisy misses, and less collapse during failure storms.

The downside is **stale absence**.

If a record appears just after you cached a `404`, clients may continue seeing “not found” until the negative TTL expires. In many systems that is acceptable for a few seconds. In others, like account creation followed by immediate login, it is a terrible user experience.

This is why I like a blunt rule: **the faster something can legitimately appear, the shorter your negative TTL should be**.

### Shared cache vs. local cache

A shared cache gives larger origin protection, but also spreads mistakes farther. A local in-process negative cache limits blast radius, but each instance relearns the same negatives.

My default preference:

- stable `404` on public immutable-ish resources, shared cache is fine
- auth or policy-sensitive negatives, local or identity-scoped only
- temporary upstream failures, very short local cache first

### Simplicity vs. status-specific policy

One TTL for all negative results is easy. It is also usually wrong.

A small policy table by error class is more work, but it avoids the common failure mode where your system accidentally treats `404`, `403`, and `503` as morally equivalent.

## Common failure modes

### 1. Caching transient errors too long

This is the classic footgun. The backend recovers, but users keep getting cached `503` responses because your cache outlived the incident.

### 2. Caching permission failures on a shared key

If a `403` generated for one caller gets reused for others, you can create phantom authorization bugs that are miserable to debug.

### 3. Caching “not found” before replication catches up

In eventually consistent systems, a fresh write may not be visible everywhere immediately. Negative caching can widen that inconsistency window.

### 4. Letting negative cache entries crowd out useful data

If your cache is limited and flooded with random bad keys, negative entries can evict hot positive entries. That is sometimes worse than not caching negatives at all.

A few mitigations:

- cap memory used by negative entries
- use shorter TTLs for low-confidence negatives
- avoid caching one-off random misses with no repeat pattern
- sample before promoting to shared cache

## How to test and observe it in production

Negative caching deserves explicit observability. If you cannot tell whether it is helping or lying, you do not really control it.

I would track at least:

- negative cache hit rate by result type (`404`, `403`, `503`)
- origin requests avoided
- stale-negative corrections, where a formerly negative key later becomes valid within a short window
- latency percentiles for miss-heavy endpoints
- backend load during incident conditions

A useful production drill is to simulate three scenarios:

1. **Hot missing key**: one absent resource gets requested at high QPS
2. **Random miss flood**: many unique invalid keys appear once each
3. **Transient dependency outage**: upstream returns `503` for 10 to 20 seconds

You want to confirm three things:

- hot misses get absorbed well
- random garbage does not poison the cache
- recovery is quick once the upstream is healthy again

If you can, add structured reason codes to logs and metrics, such as `negative_cache_reason=not_found` or `negative_cache_reason=upstream_timeout`. It makes incident review much less hand-wavy.

## The practical takeaway

Negative caching is one of those ideas that sounds minor until a traffic spike or partial outage reminds you how much useless work your system repeats.

Used carefully, it reduces load, smooths tail latency, and gives fragile dependencies some breathing room. Used carelessly, it turns a momentary glitch into a distributed rumor.

My bias is simple: cache stable absence confidently, cache temporary failure skeptically, and never forget that “no” ages faster than “yes.”

Further reading:

- [RFC 9111: HTTP Caching](https://www.rfc-editor.org/rfc/rfc9111)
- [Google Cloud CDN negative caching docs](https://cloud.google.com/cdn/docs/using-negative-caching)
- [Cloudflare cache responses and status codes](https://developers.cloudflare.com/cache/how-to/configure-cache-status-code/)
- [Caching at Netflix scale, via the Netflix Tech Blog](https://netflixtechblog.com/caching-for-a-global-netflix-7bcc457012f1)
