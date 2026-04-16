---
title: "System Design Daily: Bulkheads and Failure Isolation"
pubDate: 2026-04-16
description: How bulkheads keep one overloaded dependency from dragging your whole system underwater.
tags: ["system-design", "engineering", "distributed-systems", "reliability", "resilience", "architecture"]
---

When people say a system is “resilient,” they often mean it survives bad days without turning one local problem into a platform-wide incident.

Bulkheads are one of the simplest ways to get there.

The name comes from ships. If one compartment floods, the walls around it keep the whole vessel from filling with water. In software, the idea is the same: isolate resources so one failing dependency, customer workload, or code path cannot consume everything.

I like bulkheads because they are not a vibes-based reliability pattern. They are concrete. You draw a line, reserve a budget, and decide what is allowed to fail together.

## The problem

A lot of outages do not start with total failure. They start with unfairness.

One dependency gets slow. One tenant gets noisy. One endpoint starts retrying too aggressively. Soon the shared worker pool fills up, request queues grow, timeouts stack, and healthy traffic gets punished for a problem it did not cause.

Without isolation, the system behaves like this:

```text
all requests
  -> shared thread pool
  -> shared connection pool
  -> shared queue
  -> one slow dependency
  -> everything backs up together
```

That is the core anti-pattern. Shared capacity is efficient right up until it becomes a blast-radius multiplier.

## Core concept

A bulkhead is a resource boundary with its own budget.

That budget might be:

- a separate thread pool
- a dedicated async semaphore
- a per-tenant queue
- an isolated database connection pool
- a separate worker deployment
- a whole “cell” or shard with bounded traffic

The point is not just separation. The point is **bounded contention**.

If your image-processing pipeline stalls, your checkout API should not lose all of its workers. If one enterprise tenant floods your search service, smaller customers should not all see 30-second latency.

A healthier shape looks more like this:

```text
user traffic
  -> checkout pool (40 workers) -> payments
  -> search pool (25 workers)   -> search index
  -> media pool (10 workers)    -> image processor
```

Now each path can degrade independently.

## Where bulkheads show up in real systems

Bulkheads exist at several layers, and good systems usually use more than one.

### 1. In-process isolation

A service makes calls to multiple downstreams. Instead of one global worker pool, each downstream gets its own concurrency limit.

For example:

- payment authorization: max 50 in flight
- recommendations: max 20 in flight
- email notification: max 5 in flight

If email gets stuck, it should not block payment requests. This is the easiest bulkhead to add and one of the highest leverage changes for services with mixed criticality.

### 2. Queue isolation

Background jobs are a classic failure-sharing trap. One backlog can starve all workers.

A better setup is often:

- `billing-jobs`
- `search-index-jobs`
- `thumbnail-jobs`

with separate worker counts and queue depth alarms. If thumbnail generation explodes after a product launch, billing still runs.

### 3. Tenant or workload isolation

Multi-tenant systems often need per-tenant or per-plan budgets. Otherwise your “best customer” can accidentally become your biggest outage source.

That does not always require dedicated hardware. Sometimes per-tenant concurrency caps, token buckets, or partitioned queues are enough.

### 4. Cell-based isolation

At larger scale, teams isolate entire slices of infrastructure. A cell serves a subset of traffic with its own compute, caches, and sometimes its own storage path. Problems stay inside a smaller box.

This is a more expensive kind of bulkhead, but it is powerful because the blast radius becomes a design parameter instead of a surprise.

## A small example

Say you run an API gateway handling 8,000 requests per second. It fans out to three downstream services:

- auth service, p95 = 30 ms
- catalog service, p95 = 80 ms
- recommendation service, p95 = 250 ms and occasionally very spiky

At first, all outgoing calls share one pool of 300 worker slots.

That works until recommendations slows down and starts holding 220 slots. Auth and catalog now fight over the remaining 80. Gateway latency jumps for everyone, even though auth is healthy.

With bulkheads, you split the budget:

| Downstream | Max in flight | Timeout |
| --- | ---: | ---: |
| Auth | 120 | 100 ms |
| Catalog | 120 | 200 ms |
| Recommendations | 40 | 300 ms |

Now recommendation slowness can still hurt recommendation features, but it cannot consume the whole gateway. You may return partial responses or skip personalized results, yet login and browsing stay alive.

That is what good degradation looks like. Not “nothing failed,” but “the important parts kept working.”

## Tradeoffs

Bulkheads are worth it, but they are not free.

### Better isolation, lower average utilization

A single shared pool is often more efficient on calm days. Reserved budgets can sit idle. That is the price of keeping spare lifeboats instead of one big crowded raft.

### More knobs to tune

Each boundary adds configuration:

- concurrency limits
- queue sizes
- timeout values
- overflow behavior

Bad defaults can create self-inflicted pain. Too small, and you reject healthy traffic. Too large, and the boundary stops being protective.

### Risk of local starvation

Isolation can turn “shared pain” into “specific pain.” That is usually the right trade, but it means teams must consciously choose priorities. Not every endpoint deserves the same budget.

### Architectural complexity

Cell-based or per-tenant isolation can increase deployment, routing, and observability complexity. You should earn that cost with scale or risk, not copy it because a hyperscaler blog post made it look cool.

## Common failure modes

Bulkheads fail when teams treat them as a one-time config instead of an operating model.

### 1. Shared hidden dependencies

You create separate worker pools, but they all still share one database connection pool or one overloaded cache cluster. The isolation looks real in code and fake in production.

When you add a bulkhead, ask: what is actually isolated here, and what is still shared underneath?

### 2. Wrong fallback behavior

If a bulkhead fills up, the system needs a policy:

- fail fast
- queue briefly
- serve stale data
- omit an optional feature
- route to a degraded path

If you do not choose deliberately, many stacks choose for you by hanging until timeout. That is usually the worst option.

### 3. Retry storms across boundaries

A full bulkhead often causes rejected requests. If callers respond by retrying immediately, they can keep the compartment permanently flooded.

Bulkheads work best with sane retries, jitter, and backpressure. Isolation without caller discipline just moves the stampede around.

### 4. One giant “critical” pool

Teams sometimes isolate optional work but leave every supposedly important request in one massive shared pool. Then all critical paths still fail together.

If everything is priority one, nothing is.

### 5. No visibility into saturation

A bulkhead that silently saturates becomes a mystery outage. You need to know not just that requests are failing, but **which boundary is full**.

## How to test it

Bulkheads should be tested under stress, not admired in a diagram.

In staging or load test environments, try scenarios like:

1. Make one downstream 10x slower and verify other request classes still hit their SLOs.
2. Flood one tenant or queue and check that others retain capacity.
3. Force bulkhead saturation and confirm the fallback is fast and intentional.
4. Add retries from a caller and verify the system does not spiral into permanent overload.
5. Kill one cell or shard and confirm traffic loss stays inside the expected blast radius.

A simple experiment:

```text
- gateway traffic: 8,000 RPS
- recommendation latency injected to 2 seconds
- recommendation pool capped at 40 in flight
- expected result:
  - auth success rate stays > 99.9%
  - catalog latency remains within SLO
  - recommendation features degrade or fail fast
  - queue depth and rejection metrics rise only in recommendation path
```

If the whole gateway slows down anyway, you do not really have a bulkhead. You have a diagram.

## How to observe it in production

The most useful bulkhead metrics are boring and specific:

- in-flight requests per pool or dependency
- queue depth per workload
- rejection count and rate
- timeout rate by downstream
- fallback rate by feature
- per-tenant saturation or throttling counts
- success rate and latency for unaffected paths during a localized incident

I would also log the reason for degradation clearly. “served_without_recommendations=bulkhead_saturated” is much more useful than a generic 500 buried in some middle tier.

Dashboards should make one question easy to answer: is the boundary containing the problem, or is the problem leaking through?

## Practical advice

If you want to add bulkheads without redesigning the world, start here:

1. Identify one shared pool serving requests with very different criticality.
2. Split optional work from essential work.
3. Put explicit concurrency limits and short timeouts around the optional path.
4. Add a fallback that users can live with.
5. Measure saturation and rejected work.

That alone fixes a surprising number of “one slow thing broke everything” incidents.

Bulkheads are not glamorous. They are the software equivalent of closing doors before the storm reaches the next room. But that is the job. Reliability is often just disciplined separation.

## Further reading

- [Azure Architecture Center: Bulkhead pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/bulkhead)
- [Resilience4j Bulkhead](https://resilience4j.readme.io/docs/bulkhead)
- [Polly for .NET: Bulkhead resilience strategy](https://www.pollydocs.org/strategies/bulkhead.html)
- [AWS Builders Library: Using load shedding to avoid overload](https://aws.amazon.com/builders-library/using-load-shedding-to-avoid-overload/)
