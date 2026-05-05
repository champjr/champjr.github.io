---
title: "System Design Daily: Raft Snapshots and Log Compaction"
pubDate: 2026-05-05
description: "Consensus logs cannot grow forever. Snapshotting and log compaction keep replicated state machines fast enough to survive success."
tags: ["system-design", "engineering", "distributed-systems", "consensus", "databases", "reliability"]
---

Distributed systems people love to talk about consensus, but they often stop at leader election and majority writes.

That is only the glamorous half.

The less glamorous half is what happens **after** your Raft cluster keeps working for weeks or months and the replicated log becomes enormous. If every follower, restart, and new replica has to replay millions of historical entries from the beginning of time, your “reliable” system slowly turns into a museum of its own past.

That is why **snapshots and log compaction** matter.

My opinionated take: if you use a replicated log and have not thought through compaction, you do not have a finished design yet. You have a demo.

## The problem framing

Raft stores state as an ordered log of commands:

```text
1: set x=3
2: set y=9
3: delete x
4: create order 123
5: mark order 123 shipped
...
```

Each follower replays the same commands in the same order to rebuild the same state machine.

That is clean and robust, but the log keeps growing. Over time, three practical problems show up:

1. **Recovery gets slower.** A restarting node may need to replay a huge log before it can serve.
2. **New replicas take forever to catch up.** Replaying millions of entries across the network is expensive.
3. **Storage cost and I/O keep rising.** Old entries still consume disk, checksums, compaction bandwidth, and operator patience.

You need a way to preserve correctness without keeping every historical command forever in the hot path.

## Core concepts

### 1. Snapshotting

A **snapshot** is a compact point-in-time representation of the current state machine.

Instead of saying:

```text
replay entries 1 through 12,483,991
```

you can say:

```text
load snapshot at index 12,400,000
then replay entries 12,400,001 onward
```

That changes restart time dramatically.

A key detail is that a snapshot is not just application data. It must also carry enough metadata to remain safe in the consensus protocol, usually including:

- `last_included_index`
- `last_included_term`
- the serialized state machine data
- often membership/configuration state too

Those first two fields matter because Raft uses log index and term to reason about what is committed and what conflicts.

### 2. Log compaction

Once a snapshot safely covers the effects of older entries, the node can **compact** that prefix of the log.

That usually means entries up to `last_included_index` can be truncated locally.

A simplified picture:

```text
before:
[snapshot: none]
[log: 1 ... 12,483,991]

after snapshot at 12,400,000:
[snapshot: state at 12,400,000]
[log: 12,400,001 ... 12,483,991]
```

You still preserve correctness because the snapshot already contains the result of the older commands.

### 3. InstallSnapshot for lagging followers

Compaction creates a new case: what if a follower is **so far behind** that the leader no longer has the old log entries it needs?

Raft handles this with an `InstallSnapshot` flow. The leader sends the snapshot itself, not the missing ancient log tail.

That lets a badly lagging or newly added replica jump forward in one big step.

### 4. Trigger policies

Snapshotting can be triggered by different policies:

| Trigger | Good for | Risk |
| --- | --- | --- |
| Every N log entries | Predictable control | Might snapshot too often during bursts |
| Every M bytes of log growth | Better storage control | More variable timing |
| Periodic timer | Simple operations | May ignore actual write volume |
| Hybrid | Better balance | More knobs to tune |

Most real systems end up with a hybrid approach because the workload is never as tidy as the first whiteboard sketch.

## A small example

Imagine a Raft-backed metadata service handling 2,000 writes per second. Each replicated log entry averages 300 bytes.

That is roughly:

- `2,000 * 300 B = 600 KB/s`
- about `51 GB/day` of raw log traffic before replication overhead

Even if your actual retained log on one node is smaller after segmenting and compression, the point stands: the cluster cannot replay unlimited history forever.

Suppose you snapshot every 500,000 entries.

At 2,000 writes per second, that is one snapshot about every 250 seconds, or a little over 4 minutes. If the serialized state machine is 1.2 GB, a cold-start follower can recover like this:

1. download or load a 1.2 GB snapshot
2. replay only the recent tail since snapshot creation

That is often much faster than replaying millions of tiny mutations, especially when applying each mutation touches indexes, validation logic, and caches.

## Tradeoffs

Snapshotting sounds obviously good, but the design has real edges.

### Faster recovery vs snapshot cost

Large snapshots reduce replay work, but creating them is not free. Serializing state can burn CPU, saturate disk, and compete with foreground traffic.

If you snapshot too aggressively, you can hurt the steady-state system to help a hypothetical restart.

### Smaller logs vs bigger transfer units

Compacted logs are easier to manage, but snapshots are chunky. Shipping a 2 GB snapshot to a new follower may be slower than shipping incremental logs if the follower is only slightly behind.

This is why systems usually choose between sending logs or a snapshot based on how far behind the follower is.

### Simplicity vs application-aware snapshots

A generic byte dump is simple, but some state machines can create better snapshots if they are application-aware. For example, they may exclude expired sessions or compact tombstones.

That can be great, but it also couples your storage engine and consensus layer more tightly.

## Common failure modes

### 1. Stop-the-world snapshots

If snapshot creation pauses writes or blocks the apply loop for too long, latency spikes show up right when the system is under load. This is a classic “maintenance path becomes production path” mistake.

### 2. Incomplete durability assumptions

If you delete old log segments before the snapshot is durably persisted, you can create a terrifying gap where neither the old log nor a valid snapshot is safely available.

The order of operations matters a lot here.

### 3. Follower catch-up thrash

A slow follower may repeatedly begin log replay, fall further behind, get forced into snapshot install, then struggle to finish because the snapshot is too big for its disk or network budget.

This usually signals a deeper capacity mismatch, not just a protocol issue.

### 4. Missing configuration state

If membership metadata is not represented correctly in the snapshot, recovery after restart can get weird fast. Consensus systems need the cluster configuration to be as durable as the data.

### 5. Corrupt or unverified snapshots

A snapshot is just a faster path to wrongness if you do not checksum it, version it, and verify compatibility during restore.

## How to test it

Do not stop at unit tests for serialization. The interesting bugs show up in transitions.

I would want these tests in a serious system:

- create a snapshot while writes continue
- restart a node from snapshot plus recent log tail
- force a lagging follower to use `InstallSnapshot`
- simulate crash during snapshot creation
- simulate crash after snapshot write but before old-log deletion
- validate restore across software versions
- load test a cluster while snapshots happen on schedule

A useful chaos case is:

```text
leader creates snapshot
follower falls behind
network blips
leader compacts old log
follower recovers only through snapshot install
```

If that path is shaky, your cluster is one bad week away from pain.

## How to observe it in production

You want snapshotting to be boring, which means you need visibility.

At minimum, track:

- snapshot creation duration
- snapshot size in bytes
- log retained bytes and retained entries
- time since last successful snapshot
- follower replication lag
- count and duration of `InstallSnapshot` operations
- restart recovery time from boot to ready
- checksum or restore validation failures

A healthy dashboard answers a few simple questions quickly:

- Are snapshots happening often enough?
- Are they hurting latency?
- Are followers usually catching up from logs, or constantly needing full snapshots?
- Is recovery time growing as the dataset grows?

If recovery time trends upward month after month, the compaction strategy is probably falling behind reality.

## The practical takeaway

Consensus is not only about agreeing on the next write. It is also about staying operational after the ten-millionth write.

Snapshots and log compaction are the maintenance system for your maintenance system. They keep the replicated log from becoming an anchor around the cluster's neck.

Design them early. Measure them in production. And be suspicious of any consensus implementation that treats compaction as an afterthought.

That is usually where the future incident is hiding.

## Further reading

- [In Search of an Understandable Consensus Algorithm (Raft paper)](https://raft.github.io/raft.pdf)
- [etcd documentation: How etcd manages storage and compaction](https://etcd.io/docs/v3.5/learning/persistent-storage-files/)
- [HashiCorp Raft library overview](https://developer.hashicorp.com/nomad/docs/architecture/cluster/consensus)
