---
title: "System Design Daily: Adaptive Concurrency Limits (Stop Queueing Yourself to Death)"
pubDate: 2026-03-24
description: "How to cap in-flight work dynamically using latency signals (AIMD/gradient) so overload fails fast instead of melting down."
tags: ["system-design", "engineering", "distributed-systems", "reliability", "performance"]
---

If you’ve ever watched a service “kind of work” under load—latency climbing, CPU not pegged, error rate slowly rising—there’s a good chance you weren’t *running out of compute*. You were running out of **queueing headroom**.

The uncomfortable truth: **most overload incidents are queueing incidents**. When in-flight work exceeds what the system can complete promptly, requests pile up, tail latency explodes, timeouts trigger retries, and the whole thing feedback-loops into a self-inflicted DDoS.

Today’s topic is **adaptive concurrency limits**: a practical technique to keep systems stable by dynamically controlling how many requests are allowed to be in-flight at once.

## Problem framing: overload is usually “too many in-flight”

There are a bunch of ways a service can be overloaded:

- CPU saturation
- thread pool exhaustion
- database connection pool exhaustion
- downstream dependency slowdown
- GC pauses / stop-the-world hiccups

But the common shape is this:

1. Work arrives faster than it can be completed.
2. The service queues requests (explicitly or implicitly).
3. Response time increases (especially p95/p99).
4. Clients time out and retry.
5. Now the arrival rate is even higher.

A *static* max concurrency (say, “allow 500 in-flight requests”) helps, but it’s brittle:

- A safe limit depends on hardware, deploy shape, request mix, and downstream behavior.
- The “right” limit at 2pm is wrong at 2:05pm when a database starts running slow.

**Adaptive** limits try to solve this with feedback control.

## Core concept: cap in-flight requests, adjust the cap using latency

At a high level, you put a gate in front of a handler (or in a proxy sidecar) that does:

- If `in_flight < limit`: accept and increment `in_flight`.
- Else: reject quickly (typically `429` or `503`) so callers can back off.

When a request completes, you decrement `in_flight`.

The “adaptive” part is how you compute `limit`. Good controllers use **latency as a proxy for queueing**.

### Why latency?

Throughput metrics can look fine while you’re dying. CPU can be under 80% and you can still be in trouble if the bottleneck is a mutex, a connection pool, or a slow downstream.

But latency—especially relative to a baseline—captures queueing quickly. When queueing starts, latency rises even before you see a big error spike.

### A simple mental model

Think of your service as having an effective capacity of **C concurrent requests** for your current mix and dependency health.

- If `in_flight <= C`, most requests are doing real work.
- If `in_flight > C`, extra requests mostly wait (in queues), bloating tail latency.

Adaptive concurrency limits try to keep you operating near `C` without knowing `C` ahead of time.

## Two common controllers: AIMD and gradient

You’ll see two families of controllers in the wild.

### 1) AIMD (Additive Increase, Multiplicative Decrease)

This is the same idea that made TCP congestion control work:

- If things look healthy, increase the limit slowly.
- If things look unhealthy, decrease it quickly.

One simple variant:

- Every update interval (e.g., 100ms–1s), if `p90_latency <= target` then `limit += 1`.
- If `p90_latency > target` then `limit *= 0.9` (or similar).

This is surprisingly effective because it’s stable: it explores upward cautiously, but backs off aggressively when you hit pain.

### 2) Gradient-based controllers (latency “slope”)

Instead of comparing latency to a fixed target, you compare observed latency to an estimate of **minimum RTT** (a baseline for “no queueing”).

If `observed_rtt / min_rtt` grows, you’re queueing. The controller reduces concurrency until that ratio returns toward 1.

This approach is good when you don’t have a clean “target latency” across all endpoints, or when absolute latency varies but *relative inflation* is the signal you care about.

## A tiny example with numbers

Imagine an endpoint `POST /checkout`.

- Normal (no queueing) service time: ~40ms.
- Under load, your DB starts slowing down; service time drifts to ~80ms.

If you keep max concurrency fixed at 400, you can easily create large queues:

- With 400 in-flight and 80ms average service time, you’re effectively trying to sustain ~5,000 req/s (400 / 0.08).
- If arrival bursts to 6,000 req/s, the “extra” 1,000 req/s must wait somewhere. Latency balloons, then timeouts/retries show up.

With an adaptive limiter:

- You might find that once p90 crosses (say) 150ms, the limiter backs off from 400 → 250.
- At 250 in-flight and 80ms service time, you’re around ~3,125 req/s, but crucially you’re keeping **queues short**, so tail latency stabilizes.

The key trade: **you may reject more requests**, but you stop turning your whole system into a waiting room.

## Where to put the limiter

You can implement concurrency limiting:

- **In the service itself** (middleware / interceptor)
- **In a sidecar or edge proxy** (Envoy, etc.)
- **Per downstream** (limit calls from service A → service B separately)

A practical pattern is per-*upstream→downstream* limiting:

```
Client
  |
  v
Service A
  |  (concurrency limiter for calls to B)
  v
Service B
```

Because often your service is fine—until a single dependency slows down.

## Tradeoffs (and what people get wrong)

### Fast fail is a feature, not a bug

Rejecting requests when you’re overloaded feels bad… until you realize the alternative is:

- accept everything,
- time out everything,
- and amplify traffic with retries.

A quick `503` is honest. A slow timeout is cruelty.

### You need caller behavior that doesn’t panic

If clients blindly retry immediately, you just moved the problem.

Adaptive concurrency works best paired with:

- timeouts that are shorter than the user’s patience, but long enough to avoid spurious failure
- exponential backoff + jitter
- retry budgets (cap retries per unit time)

### “Global” limits can be unfair

A single concurrency budget can let one noisy endpoint starve everything else.

Mitigations:

- separate limiters per route/class (interactive vs batch)
- weighted fairness (reserve some capacity)
- per-tenant bucketing if you’re multi-tenant

### Limits can oscillate if you pick bad signals

If you update too frequently or react to noisy percentiles, the system can “hunt.”

Good defaults:

- smooth latency samples (rolling window)
- update on modest intervals (100ms–1s depending on traffic)
- use p50/p90 and ratios-to-minRTT instead of p99-only (p99 is spiky)

## Common failure modes

1. **Limiter placed after the queue.**
   If requests already piled up in a thread pool queue, rejecting at the handler doesn’t save you. You want the gate *before* significant queueing.

2. **No differentiation between endpoints.**
   A heavy endpoint can consume concurrency and cause light endpoints to fail.

3. **Latency baseline is wrong.**
   If your “min RTT” estimate includes queueing (because you learned it during an incident), the controller won’t back off when it should.

4. **Retries negate the benefit.**
   The limiter rejects, callers retry instantly, load stays high, and you get churn.

5. **Downstream timeouts too long.**
   If calls hang for seconds, concurrency gets stuck in-flight and you effectively deadlock your own capacity.

## How to test and observe it in production

### What to instrument

At minimum, export:

- `concurrency_limit_current` (gauge)
- `in_flight_requests` (gauge)
- `rejected_requests_total` (counter) + reason label
- latency histograms (ideally per route)
- upstream/downstream timeouts and retry counts

If you can, also track:

- `min_rtt_estimate` (if using gradient controllers)
- queue depth / threadpool wait time

### Dashboards that actually help

A useful panel set:

- **in_flight vs limit** (are we riding the limit constantly?)
- **p50/p90 latency vs limit** (does backing off reduce tail?)
- **rejections vs success** (are we rejecting to preserve latency, or just failing?)
- **retries per request** (feedback loop detector)

### Load testing approach

Don’t just run a steady RPS test. Do a scenario:

1. Warm steady traffic at normal dependency health.
2. Inject a downstream slowdown (e.g., add 100ms latency to DB calls).
3. Add a burst (2–3× traffic) for 60–120 seconds.

What you want to see:

- limit drops quickly when slowdown hits
- tail latency stays bounded (or at least doesn’t explode)
- fast failures increase, but timeouts don’t dominate
- recovery: limit climbs back up once the system stabilizes

## Practical guidance (slightly opinionated)

- If you’re choosing between “let it queue” and “fail fast,” pick **fail fast**.
- Put concurrency limits closest to where queueing starts.
- Prefer per-dependency limiters for services with many downstream calls.
- Treat retries as a first-class part of the design, not a client-side afterthought.

Adaptive concurrency limiting isn’t magic. It won’t create capacity you don’t have. But it *will* stop your system from lying to you with “successfully accepted” requests that were doomed the moment they entered the queue.

## Further reading

- Netflix Tech Blog — *Performance Under Load: Adaptive Concurrency Limits @ Netflix*: https://netflixtechblog.medium.com/performance-under-load-3e6fa9a60581
- Netflix/concurrency-limits (library + algorithms): https://github.com/Netflix/concurrency-limits
- Envoy Proxy — Adaptive Concurrency filter docs: https://www.envoyproxy.io/docs/envoy/latest/configuration/http/http_filters/adaptive_concurrency_filter
- Google SRE Book — *Handling Overload*: https://sre.google/sre-book/handling-overload/
