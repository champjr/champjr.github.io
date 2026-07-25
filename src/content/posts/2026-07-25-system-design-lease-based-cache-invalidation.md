---
title: "System Design Daily: Lease-Based Cache Invalidation"
pubDate: 2026-07-25
description: "How leases reduce stale reads and thundering-herd reloads when many clients depend on the same cached data."
tags: ["system-design", "engineering", "distributed-systems", "caching", "reliability"]
---

Cache invalidation has a bad reputation because most teams meet it in its worst form.

One service writes to a database. Ten app servers cache the result. A popular key expires or changes, and suddenly every server decides to refill the same value at once. Some requests get stale data, some stampede the database, and some poor engineer starts saying things like "eventual consistency" in a tone that means "please stop asking questions."

One underrated fix is **lease-based cache invalidation**.

The idea is simple: when a cached item becomes invalid or is about to be recomputed, not every reader gets to regenerate it. One actor gets a short lease, does the refresh, and everyone else either waits, serves slightly stale data, or retries later. You are using time-bounded ownership to keep cache refill behavior civilized.

I like this pattern because it solves two real production problems at once:

1. too many writers trying to rebuild the same cache entry
2. readers seeing inconsistent freshness during refill windows

It is not magic. It adds coordination, clock assumptions, and failure edge cases. But for hot keys and expensive reads, it is one of the most practical upgrades you can make.

## The problem

Imagine a product page service with a cache in front of a database.

- one hot product gets 40,000 reads per minute
- cache TTL is 60 seconds
- rebuilding the value requires 3 database queries and 1 inventory service call
- a rebuild takes about 120 ms on a healthy day

If the key expires normally and 200 requests arrive in that 120 ms gap, you can get this:

```text
request burst -> cache miss -> 200 app servers all rebuild same object
                         -> DB QPS spikes
                         -> downstream inventory gets hammered
                         -> some requests time out before refill completes
```

This is the classic cache stampede. Plain mutex locking can help, but many teams only think of locking at the process level. That works on one node, then fails the minute you have twenty nodes behind a load balancer.

Lease-based invalidation gives you a distributed version of the same idea.

## Core concepts

### What a lease is

A lease is a temporary right to refresh or mutate a cache entry.

It usually includes:

- a key, like `product:123`
- an owner, like `app-server-7`
- an expiration time, like 2 seconds from now
- often a token or version so stale owners cannot overwrite newer work

The rule is straightforward:

- if you hold the lease, you may rebuild the value
- if you do not hold the lease, you do not rebuild it

Everyone else takes a fallback path.

### Typical request flow

A practical flow looks like this:

1. request checks cache
2. if value is fresh, serve it
3. if value is missing or stale, try to acquire lease for that key
4. winner rebuilds from source of truth and writes cache
5. losers either:
   - wait briefly and retry cache
   - serve stale value within a grace window
   - fail soft, depending on the product requirement

Here is the shape in pseudocode:

```text
GET product:123
  if cache hit and fresh:
    return value

  if try_acquire_lease("product:123", ttl=2s):
    value = rebuild_from_db_and_inventory()
    cache.put("product:123", value, ttl=60s)
    release_lease()
    return value

  else:
    if stale_value_available and staleness < 5s:
      return stale_value
    sleep 40ms
    retry cache once
```

That grace path matters. A lease without a fallback just moves the pain around.

### Lease duration is a design choice

The lease should be long enough for a normal rebuild, but short enough that a crashed owner does not block recovery forever.

If rebuild time is usually 120 ms and p99 is 600 ms, a 2 second lease is probably reasonable. A 30 second lease would be lazy engineering. A 100 ms lease would create duplicate work under normal jitter.

This is why I think of leases as a reliability knob, not just a lock.

### Fencing or version checks

A common bug is this:

- server A acquires lease
- server A pauses because of GC, network, or scheduler delay
- lease expires
- server B acquires new lease, rebuilds, writes fresh value
- server A wakes up and writes old data over the new value

That is not hypothetical. It happens.

The fix is usually a **fencing token** or monotonically increasing version. The cache write should only succeed if the writer still owns the latest lease generation.

That turns a lease from "probably safe" into "safe against delayed zombies," which is a much better property.

## A small example

Say you run a feed ranking service. A hot user opens the app and their home feed key is missing.

- steady-state traffic: 8,000 reads/minute for that feed key during peak moments
- rebuild cost: 50 candidate items fetched + ranker call
- normal rebuild time: 80 ms
- p99 rebuild time: 450 ms

You set:

- cache TTL: 30 seconds
- stale-if-revalidating window: 3 seconds
- lease TTL: 1.5 seconds

At 12:00:00 the key expires.

- Request 1 gets the lease and starts rebuild.
- Requests 2 through 70 arrive during the next 80 ms.
- Those requests do not stampede the ranking service.
- They either serve the slightly stale feed or retry once after a short sleep.
- At 12:00:00.080 the new feed lands in cache.

Without the lease, 70 ranker calls might fire. With the lease, you did one.

That is the entire economic case for the pattern.

## Tradeoffs

### Better protection for hot keys, more coordination overhead

Every lease acquisition is a coordination event, usually through Redis, Memcached-style CAS, ZooKeeper, etcd, or a database row. That overhead is small compared with an expensive rebuild, but it is still real.

For cheap keys, leases can be overengineering. For hot, expensive keys, they are often a bargain.

### Lower origin load, but sometimes higher staleness

If losers serve stale data during revalidation, users may briefly see old information. That is often acceptable for feeds, counts, and catalog pages. It is not acceptable for fraud decisions or account balances.

Do not use the same fallback policy for every domain.

### Safer under bursts, trickier under partial failure

If your lease store is slow or partitioned, refill behavior gets weird fast. You may start serving stale data longer than expected, or multiple contenders may believe they won.

This is why the storage choice matters. A lease system needs clear atomic semantics, not wishful thinking.

## Common failure modes

### 1. Lease TTL set from hope, not data

If you never measured rebuild latency distribution, your lease TTL is probably wrong. Use p99 or p99.9 rebuild time plus some network margin.

### 2. No fencing on write-back

This is the zombie writer bug. If the old lease holder can still write after expiry, your cache can move backward in time.

### 3. Synchronized expiry across many hot keys

Leases help per key, but if 50,000 keys all expire at once, you still get a wave of lease traffic and rebuild traffic. TTL jitter is still your friend.

### 4. Serving stale forever during lease-store trouble

Teams sometimes add stale serving but forget to cap it. Then a broken lease path quietly turns "briefly stale" into "wrong for an hour."

Always cap max staleness and emit an alert when the system keeps taking the stale path.

### 5. Assuming one-node mutexes are enough

In-process locks solve single-host duplication, not fleet-wide duplication. If traffic can hit multiple nodes, local mutexes are only a partial defense.

## How to test and observe this in production

I would not ship lease logic without testing the ugly cases on purpose.

### What to test

- force 100 concurrent misses on one hot key and verify only one rebuild runs
- delay the lease holder past lease expiry and confirm stale writes are rejected
- kill the lease holder mid-rebuild and verify another node recovers after expiry
- simulate lease-store latency and watch fallback behavior
- add TTL jitter tests so many hot keys do not expire in lockstep

### Metrics worth watching

A lease-based cache needs more than hit rate.

| Metric | Why it matters |
|---|---|
| cache hit rate by key cohort | shows whether hot keys are actually protected |
| lease acquisition attempts vs wins | reveals contention level |
| rebuild latency p50/p95/p99 | drives lease TTL tuning |
| stale serves count and age | tells you whether fallback is helping or hiding pain |
| rejected stale-owner writes | confirms fencing is doing real work |
| origin QPS during cache expiry events | proves whether stampedes are gone |

### Logs and traces

Tag traces with:

- cache key or key family
- lease owner ID
- lease generation or fencing token
- result path: hit, stale, lease-winner, lease-loser-retry

When production gets weird, those fields make the story obvious.

## When I would use this

I reach for lease-based invalidation when all three are true:

- the key is hot
- rebuild is expensive or touches fragile dependencies
- a few hundred milliseconds of stale data is acceptable

That covers a lot of real systems: feeds, search result caches, product catalogs, recommendation blobs, computed profile views, and dashboard aggregates.

I would not use it for every cache entry in the system. Most keys are not hot enough to deserve extra machinery. But for the handful of keys that dominate read traffic, leases are one of those ideas that feel almost unfairly effective.

Cache invalidation is still one of the hard problems. Lease-based invalidation does not make it easy. It just makes one important part of it much less chaotic, which in production is often the best kind of victory.

Further reading:

- [Meta Engineering, TAO: Facebook's Distributed Data Store for the Social Graph](https://engineering.fb.com/2013/06/25/core-infra/tao-the-power-of-the-graph/)
- [Redis distributed locks and the Redlock discussion](https://redis.io/docs/latest/develop/clients/patterns/distributed-locks/)
- [The Memcached "leases" paper notes and discussion from Facebook's scaling work](https://www.usenix.org/system/files/conference/nsdi13/nsdi13-final170_update.pdf)
- [Martin Kleppmann on distributed locking tradeoffs](https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html)
