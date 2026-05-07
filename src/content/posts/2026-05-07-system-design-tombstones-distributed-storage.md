---
title: "System Design Daily: Tombstones in Distributed Storage"
pubDate: 2026-05-07
description: "Deletes are not really deletes in distributed systems. Tombstones are how you stop removed data from quietly coming back."
tags: ["system-design", "engineering", "distributed-systems", "databases", "storage", "replication"]
---

Deleting data sounds simple until you replicate it.

On one machine, a delete can mean, "remove this row" or "free this file." In a distributed system, that is often the wrong mental model. If replicas can be behind, partitions can last longer than you want, and anti-entropy can replay old state, then a naive delete is not a delete at all. It is an invitation for a zombie record.

That is why serious distributed storage systems use **tombstones**.

A tombstone is a marker that says, "this item used to exist, and it was deliberately deleted." That sounds small, but it solves a big problem: without a delete marker, another replica may later reintroduce stale data and act like nothing happened.

My slightly opinionated take is this: if your system replicates state asynchronously, you should assume deletes are harder than inserts until proven otherwise.

## The problem framing

Imagine a key-value store with three replicas: A, B, and C.

A client writes:

```text
PUT /profiles/42 => {name: "Maya", tier: "pro"}
```

All three replicas eventually store it.

Later, the client deletes the profile while replica C is partitioned away:

```text
DELETE /profiles/42
```

A and B see the delete. C does not.

If A and B simply remove the row immediately, then the system has lost memory that the delete ever happened. When C rejoins and participates in repair, it may offer its old copy of `/profiles/42` as if it were valid state. Without a stronger signal, one of the other replicas may accept it.

Congratulations, your delete has been undone by success.

Tombstones exist to prevent exactly that class of bug.

## Core concepts

### A tombstone is a delete record

Instead of physically removing data right away, the system writes a special value:

```text
key = /profiles/42
value = TOMBSTONE
version = 1087
```

Now the delete participates in replication just like a normal write. During repair, read reconciliation, or log replay, the tombstone can beat an older live value because it has newer version metadata.

### Deletes need ordering metadata

A tombstone without ordering is just a sad comment.

Systems usually pair tombstones with one of these:

- monotonically increasing versions
- logical clocks
- vector clocks
- timestamps plus conflict rules

The key idea is that a replica must be able to answer: did the delete happen **after** the version of this object I am looking at?

If yes, the tombstone wins.

### Tombstones are usually temporary, not permanent

Keeping tombstones forever is safe but expensive. They consume disk, increase compaction cost, and can slow reads or scans.

So most systems retain tombstones for a **grace period** long enough for lagging replicas and repair jobs to observe them. After that, background compaction or garbage collection can remove both the tombstone and any shadowed old versions.

This retention window is where a lot of operational pain lives.

## A small example

Suppose a replicated store keeps a tombstone for 7 days.

Day 0:

- `order:991` exists on replicas A, B, C at version 12

Day 1:

- C is isolated by a network issue
- client deletes `order:991`
- A and B store tombstone version 13

Day 3:

- A and B compact old live value version 12, but keep tombstone 13
- C still has live value 12

Day 5:

- C returns
- repair compares version 12 on C with tombstone 13 on A/B
- tombstone wins, C deletes local copy

Good outcome.

Now change one number.

If the tombstone grace period were only 1 day, A and B might garbage-collect the tombstone before C returns. Then repair sees C's version 12 as the only remaining fact and resurrects the deleted object.

That is the zombie-record failure mode in one paragraph.

## Tradeoffs

Tombstones are one of those designs that feel obviously correct until you live with them.

| Benefit | Cost |
| --- | --- |
| prevents deleted data from reappearing | higher storage overhead |
| lets deletes replicate like ordinary writes | more work during compaction and repair |
| supports eventual consistency safely | retention windows require careful tuning |
| helps preserve causality around deletes | scans can slow down when tombstones pile up |

A few practical tradeoffs matter most.

### Safety vs storage cost

Longer tombstone retention lowers the chance of zombie resurrection, especially when replicas can be offline for a while. But it also increases disk usage and background cleanup pressure.

### Fast cleanup vs slow repair

If your anti-entropy jobs run slowly or only occasionally, short grace windows are dangerous. The system may clean up evidence of the delete before every replica has seen it.

### Simplicity vs semantic richness

A plain tombstone works well for "this whole object is deleted." Things get trickier when you support field-level merges, nested documents, or CRDT-style updates. Then you may need per-field tombstones or more expressive merge rules.

## Common failure modes

### 1. Grace periods shorter than replica outage reality

Teams pick a small retention window to save disk, then discover some replicas, regions, or restore workflows can lag for longer. Old data comes back because the system forgot the delete too early.

### 2. Clock-based deletes with sloppy time assumptions

If conflict resolution depends on wall-clock timestamps, skew can create surprising outcomes. A stale write with a bad future timestamp may beat a legitimate tombstone.

This is one reason many engineers prefer stronger versioning than "latest clock wins" whenever they can get it.

### 3. Tombstone storms after bulk deletes

Deleting millions of keys is often more expensive than inserting them. Suddenly your compaction backlog grows, read amplification increases, and storage alerts wake everyone up.

The delete path is a write path. Treat it that way.

### 4. Secondary indexes that forget to honor tombstones

You delete the primary record, but an index entry lingers. Now search results or reverse lookups still surface data that should be gone.

A delete is only complete when all derived state converges too.

### 5. Misunderstanding compliance deletion

A logical delete marker is not the same as verified physical erasure. For privacy or regulatory workflows, you often need a more explicit lifecycle: tombstone now for replication safety, then audited purge later.

## How to design with tombstones sanely

A useful approach is:

1. make deletes first-class replicated events
2. attach unambiguous ordering metadata
3. retain tombstones longer than worst-case repair lag
4. compact only when you can prove lagging replicas are safe
5. monitor resurrection risk, not just disk usage

For example, a storage API might behave like this:

```text
DELETE /cache/item/abc
=> writes {key: abc, tombstone: true, version: 84721}
```

Read reconciliation then follows a simple rule:

```text
if tombstone.version > value.version:
    treat object as deleted
else:
    keep value
```

Simple rules like this are good. Hidden rules are where pain starts.

## How to test and observe this in production

Tombstone bugs rarely show up in happy-path integration tests. You need tests that simulate the ugly parts of distributed life.

I would want at least these:

### Test with partitions and delayed repair

- write an object to all replicas
- isolate one replica
- delete the object on the healthy side
- wait long enough to exercise compaction behavior
- heal the partition
- verify the object stays deleted everywhere

If you cannot automate that scenario, you do not really know your delete semantics.

### Test bulk-delete behavior

Measure what happens when you delete 10,000, 1 million, or 100 million keys. Tombstones can turn background maintenance into the real bottleneck.

### Test secondary-state convergence

If you maintain search indexes, caches, materialized views, or analytics sinks, verify the delete marker propagates or invalidates them too.

### Watch these production signals

- tombstone count by table or partition
- compaction backlog and duration
- replica repair lag
- read amplification on ranges with heavy churn
- resurrection incidents, ideally counted explicitly

A surprisingly good metric is **deleted object resurrection rate**. It should be zero. If it is not zero, your delete path is not trustworthy.

## The practical lesson

In distributed storage, a delete is often not the absence of data. It is a **new piece of data** with very specific meaning.

That is the right way to think about tombstones. They are not cleanup residue. They are part of the correctness protocol.

If your system replicates asynchronously, supports anti-entropy, or tolerates temporarily disconnected replicas, then tombstones are not an edge-case implementation detail. They are the thing standing between you and "why did that supposedly deleted customer record come back from the dead?"

That is not a fun incident report to write.

## Further reading

- [Apache Cassandra documentation on tombstones](https://cassandra.apache.org/doc/stable/cassandra/managing/operating/compaction/tombstones.html)
- [Amazon Dynamo paper](https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf)
- [Martin Kleppmann, *Designing Data-Intensive Applications* notes and talks](https://martin.kleppmann.com/)
- [Riak KV conflict resolution and deletion behavior](https://docs.riak.com/riak/kv/latest/learn/concepts/replication/index.html)
