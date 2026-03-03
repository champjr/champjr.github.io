---
title: "System Design Daily: Backpressure vs. Load Shedding"
pubDate: 2026-03-03
description: "How to keep a system stable when demand exceeds capacity—without turning a spike into an outage."
tags: ["system-design", "engineering", "distributed-systems", "reliability", "performance"]
---

If you’ve ever watched a healthy system tip into a cascading failure, you’ve seen the core problem: **work arrives faster than you can safely process it**.

When that happens, you have two broad choices:

- **Backpressure:** slow the producer (or the caller) down.
- **Load shedding:** refuse or degrade some work to protect the rest.

They’re related, but not interchangeable. Backpressure is the “make the line longer and slower” option; load shedding is the “we’re at capacity—some of you need to come back later” option. If you don’t implement either explicitly, your system will invent its own version via timeouts, retries, queue buildup, memory pressure, and eventually… downtime.

This post is a practical guide to both.

## Problem framing: overload is normal, cascades are optional

Overload isn’t a rare edge case. It’s a certainty:

- traffic spikes (launches, incidents, bots, thundering herds)
- downstream slowdowns (a DB hot shard, a GC pause, a noisy neighbor)
- dependency failures (third‑party API latency)
- internal maintenance (deploys, rebalances, schema changes)

The dangerous part is **feedback loops**:

1. Latency increases.
2. Clients time out and retry.
3. Retries increase load.
4. Queues grow, workers saturate, tail latency gets worse.
5. More timeouts → more retries → more load.

The key design question isn’t “how do we never overload?” It’s:

> When we overload, do we fail *predictably* and *partially*, or *chaotically* and *totally*?

## Core concepts

### Backpressure: match ingress to processing capacity

**Backpressure** is a mechanism that prevents a fast producer from overwhelming a slower consumer.

Common forms:

- **Bounded queues + blocking / waiting:** producers wait when buffers are full.
- **Credits / windowing:** consumers advertise “I can accept N more items.”
- **Concurrency limits:** cap in-flight requests per upstream/downstream pair.
- **Adaptive rate limits:** adjust allowed RPS based on observed latency/errors.

Backpressure works best when:

- you control both sides (internal services)
- you have streaming or batch semantics
- you can tolerate increased latency in exchange for stability

A canonical reference is the **Reactive Streams** spec, which formalizes demand signaling (“request(n)”) so consumers can control how much they receive.

Link: <https://www.reactive-streams.org/>

### Load shedding: refuse work to keep the system alive

**Load shedding** intentionally drops or degrades requests when you’re at (or near) capacity.

Common forms:

- **Reject early:** return 429/503 before doing expensive work.
- **Prioritize:** serve premium/critical traffic; shed best-effort traffic.
- **Degrade:** return cached/stale results, disable nonessential features.
- **Shed by cost:** drop expensive queries first (e.g., unbounded scans).

Load shedding works best when:

- latency SLOs matter more than completeness
- some work is optional or can be retried later
- you must protect shared resources (DB, cache, thread pools)

A solid mental model comes from Google’s SRE guidance on handling overload.

Link: <https://sre.google/sre-book/handling-overload/>

### A useful way to think about it

- **Backpressure says:** “I will accept the work, but not all at once.”
- **Load shedding says:** “I will not accept this work right now.”

In practice, good systems do both:

- backpressure internally (between services, queues, worker pools)
- load shedding at the edge (API gateway, frontend, ingress)

## A small example (with numbers)

Imagine an image processing service.

- Each worker can process **10 images/sec** (avg).
- You have **20 workers**.
- So steady-state capacity is roughly **200 images/sec**.

Now a spike hits: **500 images/sec** for 2 minutes.

### If you do nothing

Requests pile up. If you buffer in memory, you may OOM. If you buffer in a queue, latency explodes:

- excess rate: 500 - 200 = **300 images/sec**
- over 120 seconds, backlog becomes **36,000 images**

Even after the spike ends, you’ll take 36,000 / 200 = **180 seconds** to drain—*assuming nothing else goes wrong*. Users experience 3–6 minute latencies, clients time out, retries multiply, and now you’re processing duplicates.

### With backpressure

You cap ingest to 200/sec via credits or a bounded queue. Clients may wait (or get slower responses), but the system stays stable. Latency increases modestly for admitted work; admitted work still completes.

### With load shedding

You accept 200/sec and reject 300/sec with a clear response (e.g., **429 Too Many Requests** with a `Retry-After`). You preserve fast latencies for successful requests at the cost of partial availability.

The “right” answer depends on the product:

- A photo backup app might prefer backpressure (eventual completion).
- A realtime social feed might prefer shedding (freshness and responsiveness).

## Tradeoffs (the honest part)

### Backpressure tradeoffs

Pros:

- Protects downstream dependencies by preventing unbounded buildup.
- Preserves completeness (less dropped work).
- Keeps the system in a stable operating region.

Cons:

- Latency can grow; users may perceive slowness.
- Can push pressure upstream (your caller becomes the queue).
- Requires coordination/protocols (credits, bounded buffers, limits).

### Load shedding tradeoffs

Pros:

- Keeps tail latency sane for admitted traffic.
- Prevents meltdowns by cutting demand quickly.
- Easy to implement at the edge (reject early).

Cons:

- You will drop real user requests.
- Retrying can reintroduce overload if not controlled.
- Requires careful error semantics and client behavior.

My opinionated take: **If you don’t control clients, shedding is safer than “letting them hang.”** Timeouts plus retries are basically “load shedding, but randomized and expensive.”

## Common failure modes (and how to avoid them)

### 1) Unbounded queues disguised as “reliability”

An unbounded queue can look like resilience (“we never drop!”) until it becomes a time bomb:

- latency becomes unbounded
- the queue becomes your biggest stateful component
- restarts cause huge recovery storms

Fix: **bound the queue**, and decide explicitly what happens when it fills (block, shed, or spill to durable storage with limits).

### 2) Retry storms

Retries are gasoline. Under overload, they turn partial failure into total failure.

Fix:

- use **exponential backoff + jitter**
- cap retries
- retry only on safe errors
- prefer **429 with `Retry-After`** for load signals

### 3) Head-of-line blocking

A few slow requests can clog the whole system:

- one thread pool
- one queue
- one DB connection pool

Fix: isolate work classes:

- separate queues / pools for cheap vs expensive
- apply per-tenant or per-endpoint limits
- enforce maximum request cost (time, rows, bytes)

### 4) “Backpressure” that moves the problem to the DB

If your app returns 200 quickly but enqueues unlimited work that hammers the database later, you’ve deferred the failure.

Fix: ensure **the bottleneck is acknowledged where it exists**:

- limit concurrency at the DB boundary
- propagate saturation signals upward

### 5) Shedding too late

If you only shed after spending CPU (auth, parsing, fanout), you still melt.

Fix: **reject early** in the request lifecycle, ideally at the edge proxy or gateway.

If you’re using Envoy, its overload management and circuit breakers are worth understanding.

Link: <https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/upstream/circuit_breaking>

## How to implement (practical patterns)

### Pattern A: Concurrency limiting + fast fail

At each service boundary, set a hard limit on in-flight work (globally and/or per key):

- max in-flight requests to downstream: 200
- max in-flight per tenant: 20

When the limit is reached:

- return 429 (client can retry later)
- or enqueue to a bounded queue (server absorbs wait)

This is the simplest “backpressure-ish” mechanism for request/response services.

### Pattern B: Credits / demand signaling (true backpressure)

For streaming or message-driven pipelines:

- consumer requests N messages
- broker delivers up to N
- consumer acks and requests more

This prevents pileups and makes capacity explicit.

### Pattern C: Priority queues and graceful degradation

Define traffic classes:

1. critical (checkout, writes)
2. interactive reads
3. best-effort (analytics, prefetch)

Under load, serve classes 1–2; shed class 3.

Degrade features that are *nice-to-have*:

- recommendations
- heavy search facets
- real-time counts

This is often better than blanket 503s.

## How to test and observe in production

You can’t “unit test” overload behavior. You need **load tests + observability**.

### Tests to run

- **Step load:** jump from 50% → 150% capacity; verify behavior (latency, error codes, queue depth).
- **Dependency slowdown:** inject latency to DB/cache; ensure backpressure triggers and retries don’t spike.
- **Fail-open vs fail-closed:** confirm which endpoints shed and which must stay available.

### Metrics that matter

- queue depth (and oldest item age)
- in-flight requests / concurrency
- p95/p99 latency by endpoint
- 429/503 rate (shed rate) and where it happens
- downstream saturation signals (connection pool wait, thread pool queue, CPU)

### Tracing/logging signals

- explicit “rejected due to overload” events (not just generic 5xx)
- request cost annotations (rows scanned, fanout count, payload bytes)
- correlation between retries and error spikes

A simple operational goal:

> Make overload visible in dashboards and predictable in behavior.

If your on-call can’t answer “are we shedding?” within 60 seconds, you’re one spike away from a mystery outage.

## Closing: pick your failure mode

Backpressure and load shedding are not “performance hacks.” They’re **stability features**.

- If you value completeness, push back and process steadily.
- If you value responsiveness, shed aggressively and recover quickly.

Either way: decide deliberately. Your system will fail under load someday—your job is to choose *how*.
