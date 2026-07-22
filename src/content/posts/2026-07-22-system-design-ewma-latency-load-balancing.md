---
title: "System Design Daily: EWMA Latency Load Balancing"
pubDate: 2026-07-22
description: "Why latency-aware load balancing often beats round robin, and how to use EWMA without creating new failure modes."
tags: ["system-design", "engineering", "distributed-systems", "load-balancing", "performance"]
---

Most teams start with round robin load balancing because it is simple, predictable, and usually good enough. Then reality shows up. One replica is on a noisy node. Another has a hot shard in memory and responds faster. A third is technically healthy but drowning in GC pauses or disk stalls. Round robin keeps feeding all of them equally, which is fair in the human sense and terrible in the systems sense.

That is where EWMA latency load balancing becomes useful.

The idea is straightforward: route more traffic to backends that have been responding quickly, and less traffic to backends that have been slow. The "EWMA" part, exponentially weighted moving average, matters because you do not want to react only to the last request. You want a smoothed signal that notices a trend without thrashing on every blip.

I like this pattern because it is practical. It accepts that not all healthy instances are equally healthy at a given moment.

## The problem

Imagine a service with four replicas behind a load balancer. Under ideal conditions each can handle about 250 requests per second, so the cluster should survive 1,000 RPS. But one replica gets unlucky: CPU steal, a long garbage collection pause, or a slow downstream dependency. It is still returning 200s, just more slowly.

Round robin does this:

```text
client -> LB -> A
             -> B
             -> C  (temporarily slow)
             -> D
```

The slow instance keeps receiving 25 percent of traffic. Its queue grows. Latency gets worse. Timeouts increase. Retries show up and make the situation even uglier. You created a tiny brownout and then helpfully amplified it.

A latency-aware balancer tries to reduce traffic to C before C becomes a crater.

## Core concept: turn recent latency into a routing signal

For each backend, maintain a rolling latency score. A common formula is:

```text
EWMA_new = alpha * latest_latency + (1 - alpha) * EWMA_old
```

Where:

- `alpha` close to 1 reacts quickly
- `alpha` close to 0 reacts slowly

Suppose backend latencies over a few seconds look like this:

| Backend | Recent p50 latency |
|---|---:|
| A | 18 ms |
| B | 21 ms |
| C | 130 ms |
| D | 19 ms |

A round robin balancer still sends each one 25 percent of traffic. An EWMA-based balancer might heavily prefer A, B, and D while only sending a trickle to C until C recovers.

One simple scoring model is inverse latency:

```text
weight = 1 / max(EWMA_latency, floor)
```

If A=20 ms and C=100 ms, A gets roughly 5 times the preference of C. The exact math varies by implementation, but the operating idea is the same: slower instances should attract less traffic.

## Why smoothing matters

If you route based only on the most recent request, your balancer becomes a caffeine-addled squirrel. One unlucky request can make a good host look bad. One lucky request can make a struggling host look great.

EWMA solves that by preserving memory. Recent data matters more than old data, but old data is not discarded instantly.

That creates a useful compromise:

- responsive enough to detect genuine slowdown
- stable enough to avoid flapping

There is also a second reason smoothing matters: measurement noise is unavoidable. Tail latency spikes happen. Network hiccups happen. You do not want your balancing policy to turn ordinary variance into traffic oscillation.

## A small example

Assume a balancer sends 900 RPS across three replicas.

- A EWMA latency: 15 ms
- B EWMA latency: 20 ms
- C EWMA latency: 60 ms

Using weights of `1/latency`, the relative weights are approximately:

- A: 0.0667
- B: 0.0500
- C: 0.0167

Normalize them and you get about:

- A: 50 percent
- B: 37.5 percent
- C: 12.5 percent

So traffic shifts from an even 300/300/300 split to roughly 450/338/112.

That lighter load may be enough for C to drain its queue and recover without being ejected entirely.

That last part matters. You usually do not want zero traffic unless the host is actually unhealthy. A small amount of live traffic helps you learn whether it is improving.

## Tradeoffs

EWMA latency balancing is good, but it is not free.

### 1. It can chase the wrong signal

Latency is an output metric, not a root cause. A backend may be slow because it is overloaded, but it may also be slow because a downstream dependency is sick. If every replica talks to the same dying database, latency-aware balancing cannot save you.

### 2. It can create herd behavior

If one host becomes slightly faster, the balancer may send it more work, which can make it slower, which then shifts traffic again. With aggressive tuning, the cluster can oscillate.

### 3. Fast does not always mean healthy

A replica serving error responses in 2 ms is "fast" in the dumbest possible sense. If you only score by latency, you risk preferring a broken backend.

That is why production implementations usually combine latency with health checks, error rate, outlier detection, or concurrency limits.

### 4. Uneven traffic can hurt cache locality or warmup

Sometimes equal traffic distribution is useful. If you shift too hard away from a cold node, it may stay cold forever. If a node just restarted, you may need a controlled warmup instead of pure latency competition.

## Common failure modes

This is the part teams usually learn the hard way.

### Measuring latency at the wrong layer

If you measure only TCP connect time, you miss application slowness. If you measure end-to-end latency including client retries, you may punish the wrong backend. Measure the request path you actually care about.

### Letting timeout values poison the score

A backend that times out at 2 seconds should not merely look "a bit slower" than one serving in 40 ms. Timeouts and transport errors often need stronger penalties than normal latency samples.

### No floor, no ceiling, no cooldown

Without a minimum traffic floor, a slow instance may receive almost no requests and never prove it has recovered. Without a cooldown period, traffic may bounce too quickly. Without score caps, one pathological sample can distort routing for too long.

### Ignoring queue depth and concurrency

Latency often rises after concurrency is already too high. If you wait for latency to spike before reacting, you are late. Stronger systems combine EWMA with active request counts or queue depth. "Least outstanding requests" plus latency signals is often more robust than either alone.

### Mixing heterogeneous backends

If one backend type is naturally slower because it serves larger objects or runs in another region, a single latency ranking can bias traffic in unfair ways. Compare like with like.

## How to test it before production

Do not trust the whiteboard version.

### Load test with partial degradation

The useful test is not "everything healthy at 1,000 RPS." The useful test is:

- one instance slowed by 3x
- one instance returning 2 percent 500s
- downstream latency increased for only part of the fleet

Watch whether traffic shifts gradually and whether total user-facing latency improves.

### Simulate recovery

A lot of load-balancing policies look clever during failure and terrible during recovery. Slow one instance for five minutes, then restore it. Does it get traffic again at a sane pace, or stay starved forever?

### Test retry interaction

Retries can erase your gains. If the client retries too aggressively, the slow host may still trigger a retry storm. Validate the balancer together with timeouts, retry budgets, and circuit breaking.

## What to observe in production

If you deploy EWMA balancing, instrument the policy itself, not just the service behind it.

Track at least:

- per-backend EWMA latency score
- per-backend request volume share
- per-backend error rate and timeout rate
- outstanding requests or queue depth
- rebalance frequency, score changes, or host selection churn
- end-user p50, p95, and p99 latency

A simple dashboard question is: "When one backend got slower, did the balancer reduce traffic before user p99 exploded?"

That is the whole game.

## Practical advice

My bias is that EWMA latency balancing is best used as a middle layer, not a silver bullet.

Good stack:

1. health checks to remove truly bad instances
2. sane timeouts and retry budgets
3. EWMA latency or least-outstanding-request balancing among healthy instances
4. outlier detection to quarantine pathological nodes
5. connection draining and warmup for deploys

Bad stack:

1. round robin
2. hope

## Final thought

Round robin assumes all healthy replicas are equivalent. Real systems rarely deserve that assumption.

EWMA latency balancing is a pragmatic improvement because it reacts to what the system is actually doing right now. Just do not confuse a useful routing signal with a full resilience strategy. Latency-aware balancing can reduce damage, but it works best when paired with timeout discipline, observability, and a willingness to treat "healthy" as more than a binary checkbox.

Further reading:

- [NGINX documentation on load balancing methods](https://docs.nginx.com/nginx/admin-guide/load-balancer/http-load-balancer/)
- [Envoy load balancing overview](https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/upstream/load_balancing/load_balancers)
- [HAProxy load-balancing algorithms](https://www.haproxy.com/documentation/haproxy-configuration-tutorials/proxying-essentials/load-balancing/)
- [The Tail at Scale](https://research.google/pubs/the-tail-at-scale/)
