---
title: "System Design Daily: Token Bucket Rate Limiting (Burst-Friendly Quotas)"
pubDate: 2026-03-06
description: "How token buckets let you enforce steady-state quotas while still allowing short bursts—plus what goes wrong in real systems."
tags: ["system-design", "engineering", "distributed-systems", "reliability", "performance", "rate-limiting"]
---

Rate limiting sounds simple: “don’t let clients send too many requests.” In practice, most production rate limiting is less about being punitive and more about **keeping the system stable under uneven load**.

The token bucket algorithm is one of the most useful tools here because it matches reality:

- traffic is bursty
- clients retry
- your backend capacity isn’t a single number
- you often want **fairness** and **predictability**, not perfection

This post teaches token buckets in a system design context: when to use them, what they *actually* guarantee, how they fail, and how to observe them in production.

## Problem framing: “steady-state limits” vs “bursts”

Imagine you operate an API that can comfortably sustain **1,000 requests/second** (RPS) across your fleet, but:

- traffic arrives in spikes (deploys, cron jobs, user behavior)
- some endpoints are expensive
- you have noisy neighbors (one customer can accidentally DDoS you)

A naive fixed-window limit like “max 60 requests per minute” creates annoying edge behavior:

- clients can send 60 requests at `12:00:59` and another 60 at `12:01:00` → *effectively 120 in 1 second*
- clients learn to “game the boundary”

Token bucket gives you a better mental model: **earn capacity continuously; spend it in bursts when needed**.

## Core concept: the bucket, the refill rate, and the burst size

A token bucket has two parameters:

- **Refill rate (r):** tokens added per second (your long-term rate)
- **Bucket capacity (b):** maximum tokens held (your burst allowance)

Each request costs tokens (often 1 token per request, but it can be weighted).

- If the bucket has enough tokens → allow the request and subtract tokens.
- If not → reject, delay, or shed.

### A tiny example (with numbers)

Say you set:

- `r = 10 tokens/second`
- `b = 50 tokens`
- cost = `1 token/request`

Then:

- A client can burst up to **50 requests immediately** (if the bucket is full).
- Over time, the client averages **10 RPS**.
- If they empty the bucket, they’ll need to wait ~5 seconds to “earn” 50 tokens again.

This is the key: token bucket enforces a *long-term average* while allowing controlled bursts.

### ASCII picture

```
Tokens
 50 |########### (bucket full)
    |
 25 |#####
    |
  0 |____________________________ time
        ^ burst drains tokens
             ^ refill adds tokens steadily
```

## What token bucket guarantees (and what it doesn’t)

**Token bucket guarantees:**

- A bounded burst of size `b` (in tokens)
- A long-term average rate close to `r`

**Token bucket does NOT guarantee:**

- Smoothness (clients can still burst)
- Fairness across users (fairness depends on how you key the bucket)
- Global enforcement in a distributed system (unless your state is coordinated)

That last bullet is where system design gets interesting.

## Where to place the limiter: edge, service, or shared

There are three common placements:

1. **At the edge (API gateway / CDN / load balancer)**
   - Pros: protects everything behind it; central point of control
   - Cons: may lack endpoint-specific cost awareness; can become a bottleneck if it needs coordination

2. **In each service instance (local limiter)**
   - Pros: cheap, no extra network hops
   - Cons: enforcement becomes “per-instance,” not global (clients can spray across instances)

3. **As a shared component (distributed limiter / rate limit service)**
   - Pros: global correctness; consistent behavior
   - Cons: extra latency; needs high availability; becomes part of the critical path

A practical pattern: **enforce coarse limits at the edge**, and **fine-grained limits locally** in services.

## Tradeoffs and design choices you’ll actually debate

### 1) Keying strategy: what is “a client”?

Token buckets are usually keyed by something like:

- API key / customer ID
- user ID
- IP (dangerous behind NATs and mobile carriers)
- (user ID, endpoint) pairs

If you key too broadly, you punish innocent users. Too narrowly, you invite abuse (attackers can rotate identifiers).

### 2) Weighted costs: expensive endpoints should cost more

If your API has:

- `GET /status` (cheap)
- `POST /render` (expensive)

then “1 token per request” is the wrong abstraction. You can assign costs:

- `GET /status` costs 1 token
- `POST /render` costs 20 tokens

Now your limiter approximates backend load, not request count.

### 3) Reject vs delay: 429 or queue?

When a bucket is empty, you can:

- **Reject** (HTTP 429 + `Retry-After`) — best for interactive APIs and protecting latency
- **Delay** (leaky-bucket-like behavior) — best when you can tolerate queuing and want a smoother output rate

Opinion: for most public APIs, **reject early** is kinder to your fleet (and makes client behavior explicit).

### 4) Fixed “global RPS” is a lie; make limits elastic

If your capacity changes (autoscaling, incidents, regional failover), static `r` values will be wrong.

Better approaches:

- tie limits to current capacity (or error budget)
- have “normal” vs “degraded mode” presets
- lower the burst size `b` during incidents to avoid thundering herds

## Common failure modes (the stuff that hurts)

### Failure mode A: distributed enforcement drift

If each instance keeps its own bucket and a client’s requests are load-balanced across 10 instances, the client can get ~10× the effective limit.

Mitigations:

- enforce at a shared gateway
- use consistent hashing to keep a client sticky to one limiter shard
- use a shared store (Redis) with careful atomic updates

### Failure mode B: “token bucket on Redis” becomes your hottest dependency

A centralized rate limiter often means a hot keyspace and lots of atomic ops.

Symptoms:

- increased latency due to limiter round-trips
- cascading failures when Redis slows down

Mitigations:

- local “shadow buckets” with periodic synchronization
- hierarchical limits (edge coarse, local fine)
- in-Redis Lua scripts (single round-trip), or purpose-built rate limiting components

### Failure mode C: retries amplify load

Clients often retry on 429, timeouts, and 5xx. If your limiter doesn’t return clear guidance, you get:

- synchronized retries
- bursts aligned on second boundaries

Mitigations:

- return `Retry-After`
- document exponential backoff + jitter
- consider separate buckets for “retry budget” vs normal traffic

### Failure mode D: “fairness” surprises

If you key by IP:

- one corporate NAT can appear as one IP and get unfairly throttled
- attackers can rotate IPs to evade limits

Key by API key / auth identity whenever possible.

## How to implement token bucket (simplified)

The state you need per key:

- `tokens` (float or integer)
- `last_refill_timestamp`

On each request at time `now`:

1. Refill: `tokens = min(b, tokens + (now - last) * r)`
2. If `tokens >= cost`: allow; `tokens -= cost`
3. Else: reject or delay

If you use floats, beware of precision drift. Many implementations use fixed-point arithmetic.

### Small pseudo-API example

Assume you’re building a SaaS API. You want:

- Free tier: 2 RPS, burst 10
- Pro tier: 20 RPS, burst 100

You could expose headers:

- `X-RateLimit-Limit: 20` (rate)
- `X-RateLimit-Burst: 100`
- `X-RateLimit-Remaining: <approx>`
- `Retry-After: <seconds>` (when rejected)

That makes client behavior predictable and reduces support tickets.

## Testing and production observability

Rate limiting is a control system. If you don’t observe it, you’ll “solve” overload by quietly degrading user experience.

### What to measure

At minimum, track:

- **allowed_requests_total** by limiter key type (user, API key, endpoint)
- **rate_limited_requests_total** (429s) by endpoint and customer
- **p50/p95/p99 latency** before vs after limiting (did we protect tail latency?)
- **backend saturation signals** (CPU, queue depth, thread pool exhaustion)

If you have weighted costs, also measure:

- **tokens_spent_total** and **tokens_refilled_total**

Those two together tell you whether the limiter is doing real work or just adding noise.

### Load testing strategy

1. **Burst test:** send 5× normal traffic for 2–5 seconds
   - confirm the burst is partially allowed (up to `b`) then limited
2. **Sustained overload:** hold 2× traffic for several minutes
   - confirm the average allowed rate converges near `r`
3. **Retry storm:** simulate clients retrying 429s
   - confirm you don’t get synchronized spikes (jitter matters)
4. **Partial outage:** reduce backend capacity
   - confirm limits tighten (if you have adaptive limits) and tail latency improves

### Operational playbook (what you do at 2am)

- If 429s spike *and* backend latency drops: limiter is likely protecting you.
- If 429s spike *and* backend is still melting: limits are too high, or enforced too late.
- If a single customer triggers most 429s: adjust per-customer limits or investigate misuse.
- If limiter dependency is failing: prefer **fail-open** for internal traffic, **fail-closed** for abusive public edges (this depends on risk tolerance).

## Links worth reading

- RFC 2697: A Single Rate Three Color Marker (srTCM) — token bucket policing basics: https://www.rfc-editor.org/rfc/rfc2697
- Envoy Rate Limit service (real-world gateway integration): https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/other_features/global_rate_limiting
- Google SRE Book — Handling Overload (great practical framing): https://sre.google/sre-book/handling-overload/

## Closing opinion

Token bucket is popular because it’s honest: systems need limits, but users need bursts. If you pair token buckets with good client guidance (`Retry-After`, backoff with jitter) and you instrument the limiter like any other critical control plane, you get a system that stays upright *and* feels fair.

The biggest mistake is treating rate limiting as a one-time config knob. It’s a living design decision, tied to capacity, product expectations, and incident response.
