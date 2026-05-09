---
title: "System Design Daily: Admission Control"
pubDate: 2026-05-09
description: "Why the healthiest distributed systems decide what not to accept before queues, retries, and overload make the decision for them."
tags: ["system-design", "engineering", "distributed-systems", "reliability", "performance", "capacity-planning"]
---

Most outages do not start with a dramatic explosion. They start with politeness.

A service keeps accepting work a little past the point where it should. Queues grow. Tail latency stretches. Retries pile on. Dependencies get slower. Suddenly the system is not serving more users, it is just holding more pain.

That is why admission control matters.

Admission control is the policy layer that decides whether a request, job, or message is allowed into the system right now. It sits before the expensive part. If backpressure is about slowing producers and load shedding is about dropping work under stress, admission control is the earlier decision point: should this unit of work enter at all?

I think teams underuse it because it feels rude. But a fast, explicit “not now” is usually kinder than a slow, ambiguous failure 12 seconds later.

## The problem admission control solves

Every system has finite bottlenecks:

- database connections
- CPU on a hot tier
- thread pools or async executor slots
- disk IOPS
- downstream rate limits
- human tolerance for spinning loading indicators

Without admission control, the default policy is often “accept everything and hope the internals cope.” That policy works right up until it really does not.

A simple example:

- API tier can process 2,000 requests per second comfortably.
- Average latency is 60 ms at normal load.
- During a spike, demand jumps to 3,500 requests per second.
- The service keeps accepting traffic and queues internally.
- Latency rises to 2 seconds.
- Clients time out at 1 second and retry.
- Effective incoming load jumps above 4,500 requests per second.

At that point, the queue is not a buffer. It is an amplifier.

Admission control says: once the system cannot complete more work within an acceptable SLO, stop admitting more work of that class.

## Core concepts

### 1. Capacity is not throughput alone

A service is “full” before it reaches 100 percent CPU. In practice, your real capacity boundary is often where p95 or p99 latency begins to bend upward sharply. That knee in the curve matters more than theoretical max throughput.

### 2. Admission control is about scarce tokens

The usual mental model is tokens or slots.

A request may need one of these before it starts:

- an in-flight request slot
- a database concurrency permit
- a tenant-specific quota token
- a weighted cost budget for expensive operations

If no token is available, the request waits briefly, gets downgraded, or gets rejected.

### 3. Not all work is equal

Good admission control is rarely one global gate.

You often want separate policies for:

- reads vs writes
- interactive traffic vs batch jobs
- premium tenants vs free-tier tenants
- cheap endpoints vs expensive endpoints

Otherwise one noisy class fills the room and the important work suffocates.

### 4. Rejection is a product decision

A rejected request should be intentional, observable, and recoverable. That usually means a clear status code or queue response:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 2
```

or

```http
HTTP/1.1 503 Service Unavailable
Retry-After: 1
```

429 usually means policy or quota. 503 usually means temporary capacity exhaustion. The distinction matters because clients behave differently.

## A concrete example

Imagine an image-resizing API with two endpoint classes:

- `/thumbnail` costs about 1 unit
- `/poster` costs about 8 units

If you cap only raw request count, 100 poster requests can wreck the service more than 500 thumbnail requests.

A better admission controller uses weighted permits:

```text
cluster budget per second: 200 cost units
thumbnail request: 1 unit
poster request: 8 units
```

If 20 poster requests are already running, the next poster request may be rejected while thumbnails continue to flow. That feels opinionated because it is. Healthy systems make value judgments.

## Common admission control patterns

| Pattern | How it works | Good for | Risk |
| --- | --- | --- | --- |
| Fixed concurrency limit | Cap in-flight work | Simple APIs, workers | Too rigid if traffic mix changes |
| Queue length gate | Reject when queue exceeds threshold | Worker pools | Lets latency get bad before acting |
| Token bucket at ingress | Spend tokens per request | Bursty external traffic | Weak if request cost varies a lot |
| Weighted permits | Expensive requests consume more budget | Mixed-cost operations | Requires decent cost modeling |
| Per-tenant quotas | Isolate noisy customers | Multi-tenant systems | Underutilization if limits are too static |
| Priority admission | Reserve capacity for critical traffic | Control planes, payments | Lower tiers may starve |

My bias: start with concurrency limits plus a tiny queue, then add weights or per-class budgets once you know which traffic actually hurts you.

## Tradeoffs

Admission control sounds clean, but it comes with real choices.

First, you may reject work that could have succeeded if the spike passed quickly. That is acceptable if the alternative is broader collapse. Reliability is often about sacrificing some requests to save the rest.

Second, thresholds drift. A limit that was safe last month may be wrong after a new feature, a slower dependency, or a larger instance type. Static numbers age badly.

Third, client behavior can undo your work. If clients turn every rejection into an immediate retry storm, your elegant gate just moved the overload problem one hop outward.

Finally, fairness is hard. A single global pool is easy to implement but often unfair. Too many pools, on the other hand, lead to stranded capacity. There is no perfect split, only better tradeoffs for your business.

## Common failure modes

### Queueing before gating

Teams sometimes add admission control after a large internal queue. That is late. If users can already spend seconds waiting in line, you are protecting utilization more than experience.

### Rejecting without signaling

If you drop TCP connections, time out silently, or return generic 500s, clients cannot distinguish overload from random failure. They often retry aggressively, which makes everything worse.

### One limit for wildly different work

A search query, a cache hit, and a report-generation request should not all consume the same budget. Treating them equally hides real cost.

### Ignoring downstream bottlenecks

Your API tier may look healthy while the database is drowning. Admission control has to reflect the narrowest shared constraint, not just local process metrics.

### No protection for critical traffic

During incidents, login, checkout, health checks, and internal control-plane calls often need reserved capacity. If everything shares one pool, your recovery path gets crowded out by normal traffic.

## How to test it

Do not wait for production traffic to discover whether your gate works.

1. **Load-test the latency knee.** Find the point where p95 and p99 start curving upward, not just where errors begin.
2. **Inject slow dependencies.** Add 200 ms to the database or one downstream call and watch whether admission starts earlier.
3. **Test retrying clients.** Simulate good and bad client behavior. A system that survives polite clients but dies under naive retries is not finished.
4. **Verify class isolation.** Flood low-priority traffic and confirm high-priority requests still meet SLOs.
5. **Test recovery.** Overload is only half the story. Make sure the service recovers quickly after pressure falls instead of staying stuck in a rejected state.

A simple game day is useful here: pin one dependency slow, ramp traffic up 20 percent every few minutes, and inspect where the system starts saying “no.” If the answer is “after user-visible timeouts,” the gate is too deep.

## What to observe in production

Admission control needs first-class telemetry. At minimum, track:

- admitted requests per class
- rejected requests per class
- in-flight concurrency
- queue depth and queue wait time
- downstream saturation signals like DB pool exhaustion
- retry rate after rejection
- latency split by admitted vs rejected paths

Two graphs are especially revealing:

1. **Rejection rate vs p99 latency**: if p99 is already terrible before rejections begin, you are acting too late.
2. **Accepted throughput vs offered load**: a healthy curve flattens gracefully under overload rather than collapsing chaotically.

If you can, annotate deploys and autoscaling events alongside these graphs. Admission bugs often appear after a harmless-looking change in request cost.

## The practical takeaway

Admission control is not pessimism. It is a way to keep promises.

A system that explicitly refuses excess work can remain predictable, recover faster, and protect the requests that matter most. A system that accepts everything under stress is often just lying about capacity.

If you only do one thing, do this: put a small, explicit gate close to the front door, tie it to an actual bottleneck, and measure whether it triggers before users feel the pain. That one move is often the difference between a rough spike and a real outage.

Further reading:

- [Google SRE Book: Handling Overload](https://sre.google/sre-book/handling-overload/)
- [Amazon Builders Library: Using Load Shedding to Avoid Overload](https://aws.amazon.com/builders-library/using-load-shedding-to-avoid-overload/)
- [Envoy Documentation: Adaptive Concurrency Filter](https://www.envoyproxy.io/docs/envoy/latest/configuration/http/http_filters/adaptive_concurrency_filter)
- [Stripe Engineering: Scaling Your API with Rate Limiters](https://stripe.com/blog/rate-limiters)
