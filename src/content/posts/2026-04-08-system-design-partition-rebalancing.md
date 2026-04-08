---
title: "System Design Daily: Partition Rebalancing"
pubDate: 2026-04-08
description: "How to move data between nodes without turning a healthy cluster into a self-inflicted outage."
tags: ["system-design", "engineering", "distributed-systems", "databases", "scalability"]
---

Most system design diagrams look calm right up until the cluster changes shape.

Adding a node sounds easy. Removing a bad node sounds necessary. Replacing a full node sounds routine. Then reality shows up: data has to move, traffic has to keep flowing, and your “simple scaling event” becomes a disk-thrashing, cache-cold, latency-spiking mess.

That problem has a name: **partition rebalancing**.

This is the part of distributed systems where you discover whether your architecture was designed for growth or just for demos.

## The problem

If your data is partitioned across nodes, each node owns some subset of keys, shards, tablets, partitions, or ranges. Over time, cluster membership changes:

- you add capacity
- a node fails permanently
- one AZ is draining
- one machine gets too hot or too full
- workload becomes skewed and one partition needs to split

Now ownership has to change. Some data moves. Some requests get rerouted. Replicas catch up. Caches get invalidated. Background compaction or repair may get triggered at the worst possible moment.

The core challenge is not merely **moving bytes**. It is moving bytes **without violating latency, availability, or correctness goals**.

## Core concepts

### 1. Data movement is resource contention in disguise

Rebalancing competes with normal production traffic for:

- network bandwidth
- disk read/write IOPS
- CPU for serialization, checksums, compression, compaction
- memory for buffers and page cache

That means “rebalance faster” is often the wrong instinct. Fast enough to recover risk, slow enough not to melt the cluster is the real target.

### 2. There are two kinds of balancing

| Type | Goal | Common trigger |
| --- | --- | --- |
| **Capacity balancing** | Evenly spread data/storage | new node, disk pressure |
| **Load balancing** | Evenly spread reads/writes/CPU | hot partition, traffic skew |

These are related but not identical. A node can hold the right amount of data and still be the wrong place for current traffic.

### 3. Granularity matters

Systems rebalance at different units:

- **whole shard/partition** movement
- **token/range** movement
- **sub-partition split + move**
- **replica-only** reassignment first, primary later

Coarse movement is simpler but clumsier. Fine-grained movement is more flexible but adds metadata and operational complexity.

### 4. Ownership change should be explicit

A good rebalance usually has a handoff state machine, not a magical switch:

1. allocate destination
2. copy snapshot or existing files
3. stream recent updates
4. verify destination is caught up
5. switch reads/writes or leadership
6. retire old owner

If your design skips these states, you usually pay with data races, duplicate writes, or ugly recovery logic.

## A simple example

Imagine a key-value store with 4 partitions and 2 replicas each.

```text
Before:
P1 -> A (leader), B
P2 -> B (leader), C
P3 -> C (leader), D
P4 -> D (leader), A
```

You add node **E** because disks are getting full.

A naïve rebalance might move half the cluster immediately:

```text
After (target):
P1 -> A, E
P2 -> B, E
P3 -> C, D
P4 -> D, A
```

Looks harmless. But if P1 and P2 each hold 800 GB, you just created 1.6 TB of copy traffic. On a 1 Gbps link, ignoring overhead, that is roughly:

- 1.6 TB ≈ 12.8 Tb
- 12.8 Tb / 1 Gbps ≈ 12,800 seconds
- about **3.5 hours** minimum in fantasy land

In real systems, disk and replication overhead make it worse. During that time:

- compactions may spike
- read latency can rise due to cache churn
- repair traffic may overlap
- failover risk increases because data is “in transition” longer

This is why mature systems use **rate-limited, staged rebalancing**, often with priorities and safety caps.

## Design tradeoffs

### Aggressive vs. conservative rebalancing

**Aggressive** rebalancing reduces imbalance quickly, which is useful if a node is near failure or out of disk. But it raises blast radius.

**Conservative** rebalancing protects tail latency and user traffic, but the cluster remains uneven longer.

My bias: default conservative, escalate only when a clear risk metric justifies it.

### Background copy vs. live streaming

A common pattern is:

- bulk copy a snapshot or immutable files
- stream the write-ahead log / change stream after that
- cut over once lag is near zero

This is usually better than only replaying the full mutation stream, because immutable file transfer is cheaper than rebuilding everything from logical writes.

### Move leadership first or last?

If partitions have leaders/primaries, you can:

- **move leadership first** to drain a hot node quickly
- **move leadership last** after the replica is warm and caught up

Moving leadership first can reduce immediate load but may shift write traffic to a cold cache. Moving it last is safer for performance predictability.

### Global fairness vs. local urgency

Schedulers often need to answer:

- should we slightly improve the whole cluster?
- or urgently evacuate one risky node?

The right answer is usually “both, but not with one queue.” Separate **urgent evacuation** from **routine balancing** so emergencies do not wait behind cosmetic optimization.

## Common failure modes

### 1. Rebalancing causes an outage instead of preventing one

Classic move: add nodes to help a stressed cluster, then trigger massive data reshuffling that makes the cluster even slower. Congratulations, you scaled into an incident.

Mitigation:

- cap concurrent moves
- cap per-node bandwidth and IOPS used by balancing
- pause or slow balancing automatically when p95/p99 latency rises

### 2. Hot partitions remain hot after movement

Moving a hot partition just relocates the pain if the problem is key skew, not node count.

Mitigation:

- detect per-partition QPS and size separately
- split partitions when possible
- use key salting or workload-aware routing for pathological hot keys

### 3. Dual ownership bugs

The nastiest class: two nodes both believe they can serve writes, or reads bounce between old and new owners with inconsistent views.

Mitigation:

- explicit epoch/version on partition ownership
- fencing tokens for leadership changes
- control plane updates that are monotonic and auditable

### 4. Copy completes, but correctness does not

A destination replica may look “healthy” because the file transfer finished, while it is actually missing tail updates, tombstones, or secondary index state.

Mitigation:

- track catch-up lag explicitly
- verify checksums or Merkle/range hashes
- require convergence criteria before cutover

### 5. Rebalancing fights compaction, repair, or backups

Background maintenance jobs often collide in the same resource pool.

Mitigation:

- centralize resource budgets
- avoid overlapping heavy jobs on the same node
- expose balancing as a first-class workload, not an invisible side effect

## How to test it before production embarrasses you

You do not really understand your rebalance path until you test it under load.

### Useful test scenarios

1. **Add one node to a healthy cluster**
   - verify time to balance
   - watch user latency during transfer

2. **Drain a nearly full node**
   - ensure urgent migrations preempt routine ones

3. **Replace a failed node while traffic is high**
   - confirm no split-brain ownership
   - confirm replication lag converges

4. **Rebalance with one hot partition**
   - verify the scheduler does not “solve” the wrong problem

5. **Kill the destination mid-transfer**
   - confirm resume/retry logic works cleanly

### What to observe in production

If you only track “percent balanced,” you are flying blind. Watch:

- bytes moved per minute
- partitions in each state: pending, copying, catching up, ready, cutover
- replication/apply lag on destination
- p50/p95/p99 latency during balancing
- disk queue depth / IOPS / compaction backlog
- cache hit ratio before and after cutover
- number of ownership changes per hour
- rebalance cancellations or retries

A practical alert is not “rebalancing exists.” It is something like:

- **node disk > 85% and projected exhaustion < 24h**
- **rebalance lag growing for 30m**
- **latency budget exceeded while balancing active**

## A reasonable mental model

Partition rebalancing is really a control problem:

- the **planner** decides what should move
- the **executor** moves data safely
- the **governor** prevents user traffic from being collateral damage
- the **observer** proves the move actually finished correctly

If one of those pieces is weak, the whole thing becomes superstition.

The best rebalancing systems are not the fastest on paper. They are the ones that stay boring during cluster changes.

That is the standard worth chasing.

## Further reading

- [Apache Cassandra: Architecture - consistent hashing, partitioning, replication](https://cassandra.apache.org/doc/stable/cassandra/architecture/overview.html)
- [CockroachDB docs: Rebalancing data](https://www.cockroachlabs.com/docs/stable/architecture/replication-layer#rebalancing)
- [Google Bigtable: A Distributed Storage System for Structured Data](https://research.google/pubs/pub27898/)
- [Amazon Dynamo: Highly Available Key-value Store](https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf)
