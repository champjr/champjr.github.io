---
title: "System Design Daily: Connection Pool Sizing"
pubDate: 2026-05-24
description: "Why connection pools are really latency and overload control mechanisms, not just a performance tweak."
tags: ["system-design", "engineering", "distributed-systems", "performance", "databases"]
---

Most teams meet connection pooling as a boring implementation detail. Add a pool, reuse connections, move on.

I think that framing is too shallow.

A connection pool is really a queue with teeth. It decides how much concurrency your service is allowed to push into a dependency, how long requests are allowed to wait before they become useless, and whether overload stays local or spreads across your whole system.

That means pool sizing is not a tuning footnote. It is part of system design.

## The problem

Say you run an API service that talks to Postgres. Each incoming request needs one database connection for part of its work. If you open a fresh TCP and TLS connection for every request, latency goes up and your database wastes work on handshakes. So you add a pool.

Good start, but now a harder question appears:

How many connections should the service be allowed to use at once?

If the pool is too small, requests queue in the app and latency rises even when the database could do more work. If the pool is too large, the app floods the database with concurrent queries, causing lock contention, CPU thrash, memory pressure, and slower queries for everybody. Bigger pools can make the whole system slower.

That is the counterintuitive bit. More concurrency is not always more throughput.

## Core concepts

### 1) A connection pool is an admission controller

A pool is not just a cache of open sockets. It is a gate.

When all connections are busy, the caller must do one of three things:

- wait for a connection
- fail fast
- route work somewhere else

That choice shapes user experience during overload.

If your application lets requests wait forever on pool checkout, you are quietly building an unbounded queue. Unbounded queues feel nice in demos and terrible in incidents.

### 2) Pool size sets effective concurrency

Imagine a service with:

- 8 application instances
- 32 database connections per instance

That is a possible peak of 256 in-flight database operations, before you count admin tools, background jobs, migrations, or other services.

If Postgres is happy at 80 to 120 active queries and starts degrading hard above that, your pool configuration is lying to your architecture.

This is why pool sizing must be done globally, not one service at a time.

### 3) Little's Law is useful here

A rough mental model:

`concurrency = throughput × latency`

If your service needs 200 database operations per second, and the average time holding a connection is 20 ms, then the average concurrency needed is:

`200 × 0.020 = 4`

Even with burst headroom, that does not suggest a pool of 100. It suggests starting small, measuring, and being suspicious of giant defaults.

Of course averages lie. Tail latency matters. Some queries are slow, bursts happen, and transactions may hold connections longer than expected. But the formula is still a good reality check.

## A small example

Suppose each app instance handles 150 requests per second at peak. Only 40% of requests need the database, and those requests hold a connection for about 15 ms on average.

Per instance, required average DB concurrency is:

`150 × 0.40 × 0.015 = 0.9`

Round up, add burst headroom, and maybe you start testing with a pool of 8 to 12, not 50.

Now imagine six instances:

| Value | Number |
| --- | ---: |
| App instances | 6 |
| Pool per instance | 10 |
| Max possible DB concurrency | 60 |

That is a design statement: this service can apply at most about 60 concurrent database operations, assuming every checked-out connection is active.

If latency spikes and every instance suddenly wants all 10 connections, you still have a guardrail. Without it, autoscaling plus oversized pools can turn one busy minute into a database outage.

## Tradeoffs

### Small pools

Pros:

- protect the dependency from overload
- reduce lock contention and query pileups
- make backpressure visible earlier

Cons:

- more requests may queue in the app tier
- latency can rise if the pool is undersized
- long transactions become more painful because they monopolize scarce slots

### Large pools

Pros:

- less waiting for connection checkout during moderate bursts
- simple fix for some local bottlenecks

Cons:

- can overwhelm the database
- hide inefficient queries for longer
- increase tail latency under contention
- create unfairness, where noisy paths consume most connections

My bias: start smaller than your instincts want, then prove you need more.

## Common failure modes

### 1) Multiplying defaults across replicas

A team sets the pool to 30 because it worked on one instance. Then autoscaling grows from 2 instances to 20. Congratulations, you now have a theoretical 600 concurrent database sessions.

This is one of the most common pool mistakes because each local decision looks reasonable.

### 2) Long transactions pinning connections

Connection pools are occupied by time, not by query count. A request that starts a transaction, calls another service, does some JSON work, and only then commits may hold a connection far longer than expected.

That makes the pool look too small when the real problem is transactional scope.

### 3) Pool wait hidden inside request latency

If you only measure end-to-end response time, you might miss that half the latency is spent waiting to acquire a connection. Then people tune SQL, add indexes, or scale the database when the real issue is queueing before the query even starts.

### 4) Separate workloads sharing one pool

Foreground traffic, background jobs, and maintenance tasks often compete for the same pool. A backfill job can quietly starve user requests.

This is why serious systems often isolate workloads with separate pools, separate users, or even separate replicas.

### 5) "Fixing" incidents by raising the pool limit

This feels good for ten minutes.

Then the database gets slower, transactions live longer, timeouts cascade, and the pool fills again. You did not remove the bottleneck. You just moved the queue to a more expensive place.

## How to design with pools, not around them

A practical approach:

1. Estimate needed concurrency from throughput and connection hold time.
2. Set a global budget for the dependency, not per service in isolation.
3. Divide that budget across instances and workloads.
4. Put a timeout on pool acquisition.
5. Decide what happens on timeout: fail fast, shed low-priority work, or retry carefully.

A pseudo-API policy might look like this:

```txt
pool_size = 12
max_checkout_wait = 50ms
on_pool_timeout = return 503 for low-priority endpoints
background_jobs_pool = 4
user_traffic_pool = 8
```

That is much healthier than letting everything wait 5 seconds and pretending the system is fine.

## What to test before production

Do not just load-test request rate. Test pool behavior explicitly.

### Test 1: Saturation test

Drive enough traffic that every connection becomes busy. Measure:

- pool checkout latency
- request latency
- database CPU and active sessions
- timeout rate

You want to know where queueing starts and whether it happens in the app or the database.

### Test 2: Slow-query injection

Deliberately make 1% to 5% of queries slow. This shows whether a handful of pinned connections can collapse the rest of the service.

### Test 3: Autoscaling test

Increase replica count while holding total traffic constant. If total database concurrency rises just because more pods exist, your pool budgeting is broken.

### Test 4: Mixed workload test

Run user traffic and batch work together. Verify that one cannot starve the other.

## What to observe in production

At minimum, instrument these metrics:

- pool size
- checked-out connections
- idle connections
- connection acquisition latency
- acquisition timeout count
- query latency, especially p95 and p99
- active database sessions
- transaction duration

The most useful graph is often not raw request latency, but request latency next to pool wait time. If they rise together, the pool is telling you something important.

Tracing helps too. A span named something like `db.pool.acquire` can expose hidden queueing that otherwise gets blamed on the database.

## The opinionated takeaway

Treat connection pools as part of overload control.

If a dependency can safely handle 100 concurrent operations, do not configure your fleet to casually attempt 400 and hope timeouts sort it out. Put the queue where it is cheapest, shortest, and most observable. Usually that means the application layer, with explicit limits and fast feedback.

A well-sized pool does three jobs at once: it reuses expensive connections, protects the dependency, and makes trouble visible early. That is a lot of leverage for one supposedly boring setting.

Further reading:

- [PostgreSQL Documentation: Connection Settings](https://www.postgresql.org/docs/current/runtime-config-connection.html)
- [High Scalability: Little's Law, Scalability and Fault Tolerance](http://highscalability.com/littles-law-scalability-and-fault-tolerance-the-os-is-your-b/)
- [Google SRE Book: Addressing Cascading Failures](https://sre.google/sre-book/addressing-cascading-failures/)
- [HikariCP Wiki: About Pool Sizing](https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing)
