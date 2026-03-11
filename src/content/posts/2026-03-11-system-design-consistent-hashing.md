---
title: "System Design Daily: Consistent Hashing (and Why Virtual Nodes Matter)"
pubDate: 2026-03-11
description: "How to shard or route requests so adding/removing nodes doesn’t reshuffle your entire world."
tags: ["system-design", "engineering", "distributed-systems", "caching", "databases", "scalability"]
---

If you’ve ever scaled a cache cluster, a sharded database, or even a fleet of stateless workers with **sticky routing**, you’ve probably run into the same nasty behavior:

- With a simple `hash(key) % N` scheme, when **N changes**, *almost every key moves*.
- “Almost every key moves” means **cache miss storms**, **hot partitions**, and “why is everything slow right after we autoscaled?” incidents.

Consistent hashing is the “boring fix” that lets you add or remove nodes while only moving a **small fraction** of keys.

## Problem framing: sharding wants stability

There are two common problems that look different but share the same underlying need:

1) **Sharding / partitioning** (data placement)
- Put user `123` in shard A; user `456` in shard B.

2) **Request routing** (traffic placement)
- Route all requests for `userId=123` to the same cache node, or the same stateful service instance.

In both cases, you want:

- **Even distribution** of keys across nodes
- **Minimal movement** when nodes join/leave
- **Determinism**: all clients compute the same mapping

The naive approach:

```text
nodeIndex = hash(key) % N
```

This distributes keys fairly evenly *for a fixed N*, but it is catastrophically unstable when N changes.

### A quick gut-check with numbers

Say you have **1,000,000 keys** and **10 cache nodes**.

- With `mod 10`, each node gets ~100k keys.
- If you scale to **11** nodes, the mapping becomes `mod 11` and almost every key lands on a new remainder.

In practice, you often remap **~90%+** of keys. Your cache effectively gets cold-started.

Consistent hashing is the idea that scaling should cost you **~1/(N+1)** of keys (when adding a node), not “everything.”

## Core concept: put both keys and nodes on a ring

Consistent hashing maps hash values onto a conceptual circle (0…2^m-1) and does routing by “walking clockwise.”

1. Hash each **node** into the ring.
2. Hash each **key** into the ring.
3. A key belongs to the **first node clockwise** from the key’s position.

A tiny ASCII ring (not to scale):

```text
0 -----------------------------------------------------> 2^m
|                                                        |
|   (node B)                           (node A)          |
|        *                                 *             |
|                 (key x)  *                              |
|                                                        |
+--------------------------------------------------------+

key x maps to the next node clockwise
```

### What happens when you add a node?

Adding a node inserts one new point on the ring. Only keys that fall between the **previous node** and the new node get reassigned.

That’s the magic: you’re changing the mapping *locally*, not globally.

If node placement is roughly uniform, adding 1 node to N nodes moves about **1/(N+1)** of keys.

- With 10 nodes → add 1 node: ~9% of keys move
- With 100 nodes → add 1 node: ~1% of keys move

That’s a scaling event you can survive.

## The part people skip: virtual nodes (vnodes)

In real systems, “one node = one point on the ring” is usually not good enough.

Why?

- Hashing a small number of nodes (say 8–20) doesn’t guarantee even spacing.
- Uneven spacing → uneven load.

A node that owns a large arc of the ring gets:

- More keys
- More requests
- More cache memory pressure / CPU

**Virtual nodes** fix this by giving each physical node many positions on the ring.

- Each physical node advertises, say, **100–500 virtual nodes**.
- The ring now has thousands of points, which smooths out variance.

Implementation sketch:

```text
for node in nodes:
  for v in range(V):
    ring.add(hash(nodeId + "#" + v), node)

keyHash = hash(key)
owner = ring.nextClockwise(keyHash)
```

Opinionated take: if you’re doing consistent hashing in production and you *aren’t* using vnodes (or an equivalent technique like rendezvous hashing), you’re probably shipping an outage lottery.

## Tradeoffs: consistent hashing isn’t free

Consistent hashing buys you stability, but it adds its own complexity.

### Pros

- **Minimal remapping** on membership change
- **Decentralized**: clients can compute routing locally (with shared membership state)
- Works well for **caches**, **sharded KV stores**, and **sticky routing**

### Cons / gotchas

- **Membership distribution**: every client must agree on the ring (or you get split-brain routing)
- **Hot keys** still exist: even perfect distribution can’t fix one celebrity user
- **Operational tuning**: vnode count, ring updates, rebalancing speed
- **Data movement cost**: fewer keys move, but those keys still need warmup / replication

### Alternative worth knowing: rendezvous hashing

Rendezvous (highest-random-weight) hashing avoids the ring and can have nice properties (no ring maintenance, easy weighting). Some load balancers and libraries prefer it. But consistent hashing remains common, especially where “ring hash” is built in.

## Common failure modes (and how they show up)

### 1) Uneven load due to too few vnodes

Symptoms:
- One node’s CPU is always higher
- Cache evictions concentrated on one node
- Higher tail latency for keys mapped to that node

Fix:
- Increase vnode count
- Use a better hash function (fast *and* well-distributed)
- Consider **weighted vnodes** if nodes are heterogeneous

### 2) Membership disagreement (ring drift)

If different clients see different node lists (or different ordering), the same key can be routed to different nodes.

Symptoms:
- Cache hit rate collapses without a clear infra cause
- Confusing “it works on one instance but not another” behavior

Fix:
- Distribute membership via a strongly consistent source (e.g., config service, service discovery with versioning)
- Treat ring updates as **versioned**: `ringVersion=123`
- Roll out membership changes carefully (see “testing”)

### 3) Thundering herd on node removal

When a node dies, its keys shift to neighbors. That can be fine… unless your neighbor nodes are already near capacity.

Symptoms:
- After a node failure, nearby nodes saturate and trigger cascading failures

Fix:
- Overprovision headroom
- Use replication (e.g., map to the next R nodes on the ring)
- Consider gradual rebalancing for planned drain

### 4) Hot keys and “perfectly balanced misery”

A single hot key (or small set) can dominate traffic regardless of hashing.

Fix:
- Add caching layers (local + shared)
- Add request coalescing (singleflight)
- Use key-splitting or app-level partitioning for ultra-hot objects

## How to test it (before you ship it)

### Distribution simulation

Before production, run a quick simulation:

- Generate, say, 10 million random keys
- Map them to nodes
- Measure the per-node key count distribution (min/mean/max, stddev)

You want the max to be close to mean (within a few %), which generally requires vnodes.

### Membership change tests

Test the actual property you care about: **remapped key fraction**.

- Compute mapping with N nodes
- Add one node and recompute
- Measure `% keys moved`

If you’re seeing “most keys moved,” you built `mod N` by accident somewhere.

### Failure drills

- Kill a node (or mark it unhealthy) and observe:
  - request rate shift
  - latency shift
  - cache hit rate change
  - error rate

A good system bends; it doesn’t snap.

## Observability in production: what to measure

Consistent hashing problems are often visible in metrics *before* users complain.

Track at least:

- **Request rate per node** (should be roughly even, adjusted for weights)
- **Cache hit ratio per node** (a node with very low hit ratio may be getting mismapped traffic)
- **Evictions / memory pressure** per node
- **p95/p99 latency per node**
- **Ring version / membership version** on each client (export it!)
- **Key remap events** during deploys (how many keys moved, how quickly)

A simple but powerful debug trick: log or sample the computed owner for a few stable keys under `ringVersion` so you can verify routing consistency across clients.

## A concrete example: sharding user profiles

Say you store user profiles in a sharded KV store and want stable placement.

- 20 nodes today, each can handle ~5k req/s.
- You expect growth and want to add nodes without a full reshuffle.

Design:

- Use consistent hashing with **200 vnodes per node**.
- Assign each key `user:{userId}` to the next node clockwise.
- For reads, go to that node.
- For writes, write to that node and also replicate to the next 2 nodes (R=3) if you need high availability.

When you add the 21st node, you should move about **~1/21 ≈ 4.8%** of keys. That’s a manageable warmup window, not an outage.

## Further reading (good links, no fluff)

- Consistent hashing original paper: Karger et al., *Consistent Hashing and Random Trees* (1997): <https://www.cs.princeton.edu/courses/archive/fall09/cos518/papers/chash.pdf>
- Amazon Dynamo paper (consistent hashing + vnodes in the real world): <https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf>
- Envoy “ring hash” load balancing (practical consistent hashing for routing): <https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/upstream/load_balancing/load_balancers#ring-hash>

---

If you take one thing from this: **consistent hashing isn’t just the ring**. The ring is the easy part. The production-grade version is “ring + vnodes + versioned membership + metrics.”
