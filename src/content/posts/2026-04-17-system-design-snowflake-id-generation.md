---
title: "System Design Daily: Snowflake-Style ID Generation"
pubDate: 2026-04-17
description: How to generate sortable distributed IDs without turning one database sequence into your system’s bottleneck.
tags: ["system-design", "engineering", "distributed-systems", "architecture", "databases", "scalability"]
---

A lot of systems start with the same innocent assumption: the database can hand out IDs forever.

At small scale, that is fine. Then the system grows up. You have multiple writers, maybe multiple regions, and lots of places that want identifiers before a database round trip.

Snowflake-style IDs are a practical answer. They let you generate unique IDs on many machines, usually in roughly time order, without central coordination on every write.

## The problem

You need IDs that are:

- globally unique
- cheap to generate
- available even when a database is far away or briefly unavailable
- reasonably sortable by creation time

A single database sequence gives you uniqueness and ordering, but it creates a choke point. Every writer depends on one allocator.

Random UUIDs remove the choke point, but they give up locality. New rows land all over the place instead of clustering near recent writes.

Snowflake-style IDs split the difference: generate locally, keep approximate time ordering, and avoid centralized allocation on the hot path.

## Core concept

A classic Snowflake-style ID is a 64-bit integer assembled from a few fields:

```text
| timestamp | worker id | sequence |
```

One common layout looks like this:

| Field | Bits | Purpose |
| --- | ---: | --- |
| timestamp since custom epoch | 41 | Rough creation time |
| worker or node ID | 10 | Which generator produced it |
| per-millisecond sequence | 12 | Multiple IDs in the same millisecond |

That yields:

- 2^10 = 1024 generators
- 2^12 = 4096 IDs per millisecond per generator
- ~69 years of timestamp range from the chosen epoch

The algorithm is simple:

1. Read current time in milliseconds.
2. If it is the same millisecond as the previous ID, increment the sequence.
3. If the sequence overflows, wait until the next millisecond.
4. Combine timestamp, worker ID, and sequence into one integer.

That is enough to generate IDs independently across many nodes.

## A small example

Suppose your layout is:

- epoch = 2026-01-01T00:00:00Z
- timestamp bits = 41
- worker ID = 37
- sequence = 12 bits

At `2026-04-17T18:00:00.123Z`, the timestamp delta from the custom epoch is encoded into the high bits.

If worker 37 generates its 19th ID during that millisecond, the fields might look like this:

```text
timestamp_delta_ms = 9,201,600,123
worker_id          = 37
sequence           = 19

id = (timestamp_delta_ms << 22) | (37 << 12) | 19
```

The exact number is less important than the behavior:

- IDs are unique without asking a central service every time.
- IDs from the same worker are monotonic if the clock behaves.
- New rows tend to sort near other recent rows.

That is why these IDs are popular in event pipelines and OLTP systems that care about insertion locality.

## Tradeoffs

Snowflake-style IDs are useful because they are not fully random, and that is where the tradeoffs begin.

### Good write locality

Compared with random UUIDs, time-ordered IDs are friendlier to B-trees and LSM-adjacent ingestion patterns. Recent inserts cluster together instead of scattering.

### No hot-path central allocator

You still need coordination to assign worker IDs safely, but not per write. That is a huge operational difference.

### Roughly sortable, not globally truthful

These IDs are often treated as “creation order.” That is only approximately true. Across workers, clock skew can make a later event get a smaller ID than an earlier event. If exact causality matters, this is the wrong primitive.

### Capacity is bounded by bit layout

Your bit budget is policy.

If 10 bits are reserved for workers, you cannot casually expand to 20,000 generators later. If 12 bits are reserved for sequence numbers, each worker tops out at 4096 IDs per millisecond unless you shard the generator or change the format.

### They leak metadata

An ID may reveal creation time and sometimes machine identity. That is often acceptable internally and sometimes awkward externally.

## Common failure modes

This is the part teams usually learn in production.

### 1. Clock rollback

If the machine clock moves backward, the generator can produce duplicate IDs or break monotonicity.

That can happen because of bad NTP behavior, VM suspend/resume, or misconfigured time sync.

Common mitigations:

- refuse generation until wall clock catches up
- keep the last timestamp and clamp to it
- alert aggressively on clock regressions
- use a monotonic source for waiting logic, while still encoding wall-clock time carefully

My opinion: if your generator notices time moved backward by more than a tiny threshold, failing closed is usually better than quietly minting broken IDs.

### 2. Worker ID collisions

Two nodes accidentally configured with the same worker ID will happily generate colliding IDs.

This is the hidden dependency. You removed the central write allocator, but you still need a trustworthy way to assign node identity.

That might be:

- a lease in ZooKeeper, etcd, or Consul
- a StatefulSet ordinal in Kubernetes
- static assignment in a small fleet

If worker identity is sloppy, the whole scheme is sloppy.

### 3. Sequence exhaustion in one millisecond

If one generator needs more than the sequence space allows in a single millisecond, it must block until the next millisecond or spill onto more workers.

A hot partition, a bursty batch job, or one overloaded API pod can hit the ceiling.

Choose the bit layout from measured peak rates, not vibes.

### 4. Treating IDs as security boundaries

These IDs are identifiers, not secrets. They are often guessable and time-correlated.

Do not use them as proof of authorization. Do not assume they are safe to expose if enumeration matters.

## How to test it

A distributed ID generator deserves the same seriousness as a storage primitive.

Test cases I care about:

1. **Uniqueness under parallel load**: generate hundreds of millions of IDs across many workers and verify no collisions.
2. **Monotonicity per worker**: confirm each generator never goes backward during normal operation.
3. **Clock regression behavior**: simulate NTP rollback and verify the generator blocks or errors exactly as designed.
4. **Sequence overflow**: generate more than the per-millisecond sequence budget and confirm the wait path is safe.
5. **Worker reassignment**: restart nodes, replace pods, and verify worker IDs are never duplicated during handoff.

A simple production-minded benchmark might look like this:

```text
32 workers
peak target: 150k IDs/sec each
clock skew injected: +/- 5 ms
expected:
- zero collisions
- bounded stalls during overflow
- explicit errors or pauses on backward clock jumps
- p99 generation latency stays tiny except during forced overflow tests
```

## How to observe it in production

You do not want to discover ID problems from corrupted data later.

Track at least these metrics:

- IDs generated per node per second
- sequence overflow count
- clock rollback detections
- current worker ID leases
- generation latency
- duplicate-key write failures downstream

Also log enough structured context to debug bad events: worker ID, last timestamp, current timestamp, and whether the generator entered a wait or reject path.

One practical dashboard panel I’d keep is **clock regressions by node over time**. If that graph twitches, your infrastructure is sick.

## When to use this pattern

Snowflake-style IDs are a good fit when you need local generation, high write throughput, and roughly time-ordered keys.

They are a bad fit when:

- exact global ordering is required
- the fleet is too dynamic to assign worker IDs safely
- identifier predictability is a security problem
- a standard like UUIDv7 gives you enough ordering without operational worker-ID management

Today, many teams should at least consider UUIDv7 before building custom Snowflake infrastructure. It preserves time-ordering benefits while avoiding the worker-ID coordination problem, though with different tradeoffs.

The boring truth is this: distributed ID generation is not really about IDs. It is about where you want coordination to live.

Snowflake-style schemes move coordination off the write path and into clock discipline plus node identity management. That is often a good trade, but only if you operate those parts deliberately.

## Further reading

- [RFC 9562: UUIDs, including UUIDv7](https://www.rfc-editor.org/rfc/rfc9562)
- [ULID specification](https://github.com/ulid/spec)
- [KSUID](https://github.com/segmentio/ksuid)
- [Instagram Engineering: Sharding and IDs at Instagram](https://instagram-engineering.com/sharding-ids-at-instagram-1cf5a71e5a5c)
