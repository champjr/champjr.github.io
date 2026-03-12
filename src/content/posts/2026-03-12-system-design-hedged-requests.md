---
title: "System Design Daily: Hedged Requests (Cutting p99 Without Lying to Yourself)"
pubDate: 2026-03-12
description: "Hedged requests can tame tail latency, but only if you cap them, cancel them, and measure the blast radius."
tags: ["system-design", "engineering", "distributed-systems", "reliability", "performance"]
---

If you’ve ever stared at a latency graph and thought, “p50 looks great… why does p99 look like it fell off a cliff?”, welcome to distributed systems.

Most production services don’t fail by being *slow all the time*. They fail by being *slow sometimes*—and those “sometimes” show up as tail latency. Hedged requests are one of the few techniques that can materially improve p95/p99 without rewriting your entire architecture.

They’re also a great way to DDoS yourself if you implement them casually.

This post is about using hedged requests responsibly: what they are, when they help, how to cap the cost, failure modes, and what to watch in production.

## Problem framing: the tail is where users live

Imagine a simple request path:

Client → API → Storage

Your API does a single RPC to storage per user request.

- Storage median latency: **20 ms**
- Storage p99 latency: **300 ms** (GC pauses, noisy neighbors, occasional compaction)

Even if p99 is “only” 1%, that 1% becomes *visible* quickly at scale. If you do 10 RPCs per page load, your chance of hitting at least one slow RPC in that page load is roughly:

- `1 - (0.99^10) ≈ 9.6%`

So about 1 in 10 page loads includes a p99-ish hiccup. Users don’t remember your p50.

## Core concept: hedging = a second chance, not a retry

A **hedged request** is a duplicate request that you send *before* the original has timed out.

- You send the primary request.
- If it hasn’t completed by a short delay (the **hedge delay**), you send a duplicate to an alternate backend (or the same backend pool).
- You take the first successful response.
- You **cancel** the slower in-flight request(s) as soon as you have a winner.

A simple timeline:

```text
T=0ms     send req A to node-1
T=40ms    if no response yet, send req A' to node-7 (hedge)
T=55ms    A' returns OK → respond to client
T=56ms    cancel original A (if possible)
```

This is not the same as “retry on failure”. Retries happen after an error/timeout. Hedging is about beating *variance*.

### Why it works

Tail latency is often caused by transient per-host issues:

- GC pause
- CPU steal / noisy neighbor
- brief packet loss
- lock contention
- compaction / flush

If those issues aren’t correlated across hosts, sending a second request to a different host gives you a good chance to avoid the unlucky one.

For the classic analysis, see “The Tail at Scale” by Dean & Barroso:
- https://research.google/pubs/the-tail-at-scale/

## Where hedging fits (and where it absolutely doesn’t)

Hedging is best when:

- **Requests are idempotent** (or can be made idempotent)
- **Backends are replicated** (multiple equivalent nodes can serve the request)
- **Tail latency is driven by per-node variance**, not a global bottleneck
- You can **cancel** in-flight work (or at least ensure duplicates are cheap)

Hedging is a bad idea when:

- The bottleneck is shared (one database, one shard, one global lock)
- The system is already under load (hedging amplifies load)
- Side effects are hard to dedupe (charging a card, sending an email)

If you’re in that last bucket, fix idempotency first. (Idempotency keys are worth their own religion.)

## A practical hedge policy (with numbers)

Let’s say you’re calling `UserProfileService.GetUser(user_id)`.

You measure:

- p50: 15 ms
- p95: 45 ms
- p99: 180 ms

A reasonable starting hedge policy:

1. **Hedge delay**: around p95 (or slightly below), e.g. **40–50 ms**
2. **Max hedges**: **1** (two total attempts: primary + one hedge)
3. **Hedge budget**: at most **1–5%** of requests may hedge, enforced via a token bucket (separate from user-facing rate limits)
4. **Prefer alternate host/zone** if you can (to reduce correlation)

Pseudo-config:

```yaml
hedging:
  enabled: true
  delay_ms: 45
  max_additional_attempts: 1
  max_hedged_fraction: 0.02
  cancel_on_success: true
  route_policy: "different-host"  # or different-zone if safe
```

gRPC has first-class support for hedging policies; it’s a useful reference even if you don’t use gRPC:
- https://grpc.io/docs/guides/retry/

## Tradeoffs: you’re buying latency with load

Hedging improves tail latency by spending extra work. The real question is whether you can afford it.

Costs you pay:

- **Extra QPS** to backends (even if only occasionally)
- **Extra concurrency** (in-flight requests) and connection pressure
- Potentially **extra cache misses** or queueing if your hedge routing is naive

Benefits you get:

- Lower **p95/p99** latency
- Fewer timeout cascades (users and upstream services stop giving up)
- Better perceived reliability (fast failures and fast successes feel “stable”)

The key is *bounded* hedging. Unlimited hedging is indistinguishable from panic.

## Common failure modes (how hedging goes wrong)

### 1) Hedging during overload (self-inflicted thundering herd)
If you hedge while the backend is saturated, you increase load, which increases queueing, which increases tail latency, which triggers more hedges. Congratulations: you built a positive feedback loop.

Mitigation:

- Disable hedging when backend utilization is high (CPU, queue depth, rejection rate)
- Use a strict **hedge budget** (token bucket) that can’t be exceeded
- Consider combining with **load shedding** (admit fewer requests rather than duplicating more)

### 2) No cancellation: duplicates do full work anyway
If your system can’t cancel in-flight work, hedged requests can double compute with little latency gain.

Mitigation:

- Propagate cancellation (HTTP/2 cancel, gRPC cancel, context cancellation)
- Make backend handlers periodically check cancellation
- If you can’t cancel, hedge only *reads* that are cheap (e.g., cacheable) and cap hard

### 3) Non-idempotent side effects
Hedging a “create order” call without idempotency is how you ship two orders.

Mitigation:

- Hedge only idempotent operations
- Or require an idempotency token at the boundary and dedupe server-side

### 4) Correlated slowness (hedging doesn’t help)
If p99 is caused by a shared database, a single shard, or a global lock, duplicating work won’t fix it.

Mitigation:

- Measure where time is spent (client, network, server queue, DB)
- Hedge only at layers where variance is host-local

### 5) Silent cost: skewed metrics and “lying” percentiles
If you record latency at the *attempt* level instead of the *user request* level, hedging can make graphs look better while backend work doubles.

Mitigation:

- Track both:
  - **end-to-end request latency** (what users see)
  - **attempt latency** per backend call
  - **attempts per request** (critical)

## How to test it before you ship it

You can—and should—test hedging like a feature flag with failure injection.

### Load test with a synthetic tail
In a staging environment, introduce a controlled “slow node” behavior (e.g., 1% of requests sleep 300 ms on a subset of instances) and compare:

- p95/p99 end-to-end latency
- backend QPS
- backend CPU / queue depth
- error rate

You want to see latency improve without runaway load.

### Chaos test: packet loss and jitter
If your infrastructure supports it (tc/netem, service mesh fault injection), simulate:

- 0.1–1% packet loss
- 50–200 ms jitter bursts

Hedging can help a lot here, but only if routing chooses a genuinely different path.

### Correctness test: dedupe guarantees
If any hedged path can touch side effects, write a test that fires duplicates and verifies:

- exactly-once behavior at the business level
- idempotency keys are enforced
- auditing/ledger entries don’t double-write

## Observability: what to watch in production

If you enable hedging, add dashboards *before* you flip the flag.

Minimum useful signals:

- **Hedged fraction**: `% of requests that triggered a hedge`
- **Attempts per request**: average and p95
- **Winner distribution**: primary won vs hedge won
- **Cancellation effectiveness**: `% of hedged attempts canceled before completion`
- **Backend saturation**: CPU, queue depth, connection counts
- **Tail latency**: p95/p99 end-to-end (not per-attempt)

A practical rule: if “hedge won” starts climbing rapidly, you may have a real degradation in the primary path. Hedging is a band-aid, but it’s also an alarm.

Also read the Amazon Builders’ Library guidance on timeouts/retries/backoff (hedging is adjacent):
- https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/

## A tiny architecture example

Here’s a simple service-to-service setup with hedging at the client side:

```text
           +-------------------+
Client --> |  API Service      |  -- primary -->  ProfileSvc node A
           | (hedging client)  |  -- hedge ---->  ProfileSvc node B
           +-------------------+
                 |   ^
                 |   |
                 +---+  cancel loser (HTTP/2 / gRPC)
```

Implementation notes that matter:

- Use **deadline propagation**: the hedge must respect the original overall timeout.
- Choose hedge delay from measured percentiles, not vibes.
- Route hedges to a different host (or zone) to avoid correlated slowness.

## Opinionated guidance (what I’d do first)

1. Fix **timeouts** first. If you don’t have sane deadlines, hedging will behave unpredictably.
2. Ensure **idempotency** for anything that can be retried/hedged.
3. Start with **one hedge max**, and a tight hedge budget (1–2%).
4. Roll out slowly with a feature flag, watch backend saturation like a hawk.
5. If hedging “works” but backend load jumps, prioritize cancellation and routing.

Hedged requests are a scalpel. Used well, they make systems feel dramatically more reliable. Used poorly, they are just retries in a trench coat.
