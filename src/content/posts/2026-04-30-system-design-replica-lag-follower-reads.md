---
title: "System Design Daily: Replica Lag and Follower Reads"
pubDate: 2026-04-30
description: "Follower reads can cut cost and latency, but only if you treat replica lag as a product constraint instead of a footnote."
tags: ["system-design", "engineering", "distributed-systems", "databases", "reliability", "performance"]
---

A lot of architectures quietly assume that “a read is a read.” It is not. In a replicated database, **where** you read from matters just as much as what you query.

Follower reads are attractive because they are cheap. They let you spread read traffic across replicas instead of hammering the primary. They can reduce regional latency, increase read throughput, and give your write leader a little breathing room.

But there is a catch: replicas are behind. Sometimes by milliseconds, sometimes by seconds, and during incidents sometimes by much more. That gap is **replica lag**, and if you do not design around it, follower reads create bugs that look random and user-hostile.

My opinionated version is this: follower reads are great, but only when the application is explicit about which reads may be stale.

## The problem framing

Imagine an app with one primary database and three read replicas.

```text
writes --> primary
            |
            +--> replica A
            +--> replica B
            +--> replica C
```

A user updates their shipping address, then immediately refreshes the order page. The write commits on the primary. The next page load is routed to replica B, which is 800 ms behind.

The user sees the old address and assumes the save failed.

Nothing is technically broken. Replication is working. The database is healthy. But the product experience is bad because the system promised more freshness than the architecture could actually deliver.

This is the real design problem. Follower reads are not mainly a database tuning trick. They are a **consistency contract**.

## Core concepts

### Primary, replicas, and apply delay

In most replicated systems, writes land on a primary first. Replicas receive the change later by shipping log entries, binlog events, WAL segments, or some similar stream.

That means there are at least two clocks in play:

- when the write is acknowledged on the primary
- when each replica has applied that write locally

The distance between those two is lag.

### Follower reads

A follower read is any read served by a non-primary replica.

Teams use them for a few common reasons:

- offload heavy read traffic from the primary
- serve users from a nearby region
- isolate analytics-ish reads from write-heavy paths
- survive primary overload or failover events more gracefully

All good reasons. The mistake is treating follower reads as free scale.

### Not all staleness is equally bad

Some reads can tolerate old data:

- public profile pages
- product catalog browsing
- counts that are approximate anyway
- internal dashboards with a slight delay

Some reads usually cannot:

- “I just changed this” confirmation pages
- account balances
- permission checks after a role update
- inventory or seat availability near the limit

That split should shape your routing policy.

## A small example

Suppose your primary handles 2,000 writes/sec and 12,000 reads/sec. Each replica can absorb 4,000 reads/sec. With three replicas, follower reads can take most of the pressure off the primary.

But now assume your 99th percentile replication lag is:

- normal: 120 ms
- deployment spike: 900 ms
- bad incident: 8 s

If a customer updates an email preference and then reloads the settings screen immediately, a follower read can show the old state.

A practical API policy might look like this:

```text
GET /products/123           -> replica allowed
GET /dashboard/traffic      -> replica allowed
GET /me/settings            -> primary for 5 seconds after a write
POST /orders                -> write to primary
GET /orders/abc123          -> primary or read-your-writes token required
```

The key idea is simple: do not route all reads the same way.

## Tradeoffs

| Choice | Benefit | Cost |
| --- | --- | --- |
| Read mostly from replicas | Lower primary load, better horizontal scale | More stale reads |
| Read sensitive paths from primary | Better correctness perception | Higher load on leader |
| Use nearest-region replicas | Lower latency for global users | Higher chance of lag-induced surprises |
| Block on replica freshness | Stronger consistency | More latency and operational complexity |

This is why “eventual consistency” is too vague to be useful in design reviews. You want to ask sharper questions:

- How stale can this endpoint be before users notice?
- Which actions require read-your-writes behavior?
- What is the fallback when replica lag crosses a threshold?

## Common failure modes

### 1. Read-after-write confusion

This is the classic one. A user updates something, then sees old data a second later. They retry, open support tickets, or accidentally submit duplicate work.

This is not just a UX issue. It can cause:

- duplicate payments attempts
- repeated settings changes
- unnecessary retries from clients
- support teams distrusting the system

### 2. Stale authorization and policy checks

If a permission change writes to the primary but an access check reads from a lagging follower, you can temporarily allow or deny the wrong thing.

That is a nasty class of bug because it looks intermittent and may have security implications.

### 3. Lag spikes during maintenance or incidents

Follower reads often look safe in average conditions. Then a backup job, schema migration, disk contention event, or network hiccup pushes lag way up.

If your architecture never measured lag budgets, suddenly “slightly stale” becomes “completely misleading.”

### 4. Hidden coupling with caches

Teams sometimes combine replica reads with caches and accidentally stack staleness on staleness.

For example:

1. primary commits a change
2. replica is 700 ms behind
3. app reads stale data from replica
4. stale result is cached for 60 seconds

Now a sub-second replica lag became a one-minute correctness problem.

### 5. Assuming failover solves freshness

During failover, a replica may become the new primary, but only after some promotion logic and safety checks. If you were already serving reads from lagging followers, the switchover period can expose even more confusing freshness behavior.

## How to design it well

A good follower-read design usually mixes a few patterns.

### Route by freshness requirement

Mark endpoints or query paths as one of:

- **must be fresh**
- **fresh enough within N seconds**
- **cheap and allowed to be stale**

That is better than a universal “all reads go to replicas” rule.

### Use read-your-writes windows

After a user performs a write, pin their subsequent reads to the primary for a short window, maybe 5 to 30 seconds depending on your system.

This is often enough to preserve trust without abandoning replica scale for the whole product.

### Gate follower reads on lag

If replica lag exceeds some threshold, stop using replicas for freshness-sensitive traffic.

For example:

```text
if replica_lag_ms < 200:
  allow follower read for standard endpoints
else:
  route to primary or return degraded freshness warning
```

### Observe lag as a first-class SLI

If your team cannot answer “what was p95 and p99 replica lag last week?” then follower reads are being operated on vibes.

## How to test and observe in production

Do not just test replication in the happy path. Test the ugly path where replication is working, but late.

Useful tests include:

1. **Immediate read-after-write test**  
   Write a record, then read it from both primary and replica in a tight loop. Measure how long convergence actually takes.

2. **Lag injection test**  
   Artificially slow replica apply or network delivery. Confirm sensitive endpoints stop using followers when thresholds are exceeded.

3. **Cache interaction test**  
   Verify stale replica responses do not poison caches longer than intended.

4. **Permission update test**  
   Change a user role, then exercise authorization checks from paths that might hit followers.

The production signals I would watch are:

- current, p95, and p99 replica lag
- fraction of reads served by primary vs replicas
- read-after-write error reports or synthetic checks
- cache fill source, especially whether stale follower data seeded the cache
- failover events correlated with lag spikes

One very practical synthetic probe is this: write a timestamped canary row to the primary every few seconds and measure when each replica can read it back. That gives you an honest freshness graph instead of a comforting theory.

## The design lesson

Follower reads are not dangerous because replicas exist. They are dangerous when the system is vague about freshness.

If the product says “save completed,” the next read should usually behave like it means it. If the product says “stats may be delayed,” then a follower read is perfectly fine.

That is the real system design move here: turn replica lag from an invisible implementation detail into an explicit routing and product decision.

Used that way, follower reads are excellent. Used lazily, they create haunted software, where the truth depends on which machine answered your question.

## Further reading

- [PostgreSQL Documentation, Replication](https://www.postgresql.org/docs/current/runtime-config-replication.html)
- [Amazon Aurora, Replication Lag](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/CHAP_Troubleshooting.html#CHAP_Troubleshooting.AuroraReplicaLag)
- [Designing Data-Intensive Applications, Chapter 5: Replication](https://dataintensive.net/)
- [Jepsen, Elasticsearch 1.5.0](https://jepsen.io/analyses/elasticsearch-1-5-0)
