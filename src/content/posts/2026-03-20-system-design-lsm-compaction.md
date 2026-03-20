---
title: "System Design Daily: LSM Trees and Compaction (The Real Cost of Fast Writes)"
pubDate: 2026-03-20
description: "LSM trees buy you blazing writes by postponing work — compaction is where you pay the bill."
tags: ["system-design", "engineering", "distributed-systems", "databases", "storage"]
---

If you’ve ever shipped a system that *writes easily* but occasionally *reads like it’s underwater*, there’s a good chance an LSM tree is involved.

Log-Structured Merge (LSM) trees power a big chunk of the modern storage world: RocksDB, LevelDB, Cassandra, ScyllaDB, HBase, and many “we built our own KV store” projects. The headline benefit is simple: **writes are sequential and fast**. The hidden footnote is: **you’re deferring and reshaping work into compaction**, and compaction will eventually demand its tribute in CPU, I/O, and tail latency.

This post is about one focused topic: **how LSM compaction works, the tradeoffs it creates, the common failure modes, and how to observe/test it in production**.

## Problem framing: why LSM exists

Most “I need a datastore” problems have an uncomfortable requirement combo:

- High write throughput (often spiky)
- Reads that must remain acceptably fast
- Data bigger than RAM
- SSDs/HDDs that punish random writes

A classic B-tree keeps data sorted on disk with in-place updates, which means **random writes and page splits** (not free on SSDs, painful on HDDs). LSM flips the model:

- Buffer writes in memory (fast)
- Persist them as immutable sorted files (sequential)
- **Merge** those files in the background to maintain read efficiency

LSM is basically: *"write now, organize later"*.

## Core concepts (in plain terms)

### 1) Memtable + WAL

Incoming writes go to:

- **WAL (Write-Ahead Log)**: append-only log for durability
- **Memtable**: in-memory structure (often a skiplist) holding sorted keys

When the memtable fills, it’s flushed to disk as an immutable **SSTable** (Sorted String Table).

### 2) SSTables, levels, and read amplification

SSTables are immutable sorted files that typically include:

- Data blocks (key/value entries)
- Index blocks
- Bloom filter(s)
- Metadata

But you don’t just have one SSTable. You have many, so a read might have to check multiple files/levels.

That’s **read amplification**: one logical read causing multiple physical reads.

### 3) Compaction: where “later” happens

Compaction merges SSTables to:

- Reduce the number of files a read must touch
- Drop overwritten/obsolete values
- Apply tombstones (deletes) and eventually reclaim space
- Keep data roughly sorted and organized

There are multiple compaction strategies, but the two you’ll hear most:

- **Leveled compaction**: data is organized into levels with non-overlapping key ranges at lower levels. Better read performance, more write amplification.
- **Size-tiered compaction**: merge similarly-sized files as they accumulate. Better write throughput, worse read amplification (and space amplification).

(Real systems often provide hybrids and knobs.)

### 4) The three amplifications (the mental model you want)

LSM tuning is mostly about managing three kinds of “amplification”:

- **Write amplification**: each logical write gets rewritten during compaction (sometimes many times).
- **Read amplification**: reads must consult multiple files/levels.
- **Space amplification**: multiple versions/tombstones + compaction backlog temporarily inflate disk usage.


## A small numeric example (why compaction can bite)

Assume:

- Write rate: **20k writes/sec**
- Average value size: **1 KB**
- Effective ingest: ~**20 MB/sec** (ignoring overhead)

Now assume your compaction setup results in **10× write amplification** (not unusual depending on configuration and workload). That means your storage engine may need to perform ~**200 MB/sec** of *additional* background write I/O *on average* just to keep up.

If your SSD can sustain 400–800 MB/sec sequential writes, this looks okay… until you remember foreground reads share the same disk, and compaction also has to **read** old SSTables (not just write new ones).

The practical takeaway: **capacity planning for LSM is capacity planning for compaction**, not for your ingest.

## Tradeoffs you actually feel in systems

### Leveled compaction (typical RocksDB default-ish)

**Pros**

- Predictable read latency (especially point lookups)
- Lower read amplification
- Better for read-heavy or latency-sensitive services

**Cons**

- Higher write amplification → more CPU and I/O
- Can create periodic compaction-induced tail spikes if underprovisioned

### Size-tiered compaction (common in Cassandra-ish worlds)

**Pros**

- Great write throughput
- Compactions can be simpler and cheaper per merge

**Cons**

- Reads can touch many SSTables → higher p99
- Tombstones can linger longer → weird read behavior and space usage

### Tombstones (deletes) are not free

In LSM, a delete is typically a **tombstone marker**. The actual space is reclaimed only when compaction runs and the system can prove the deleted key is shadowed across relevant files.

That means:

- Heavy delete workloads can inflate space and compaction work
- Range scans can get slower (tombstone filtering)
- “Deleted” data might still exist on disk until compaction rewrites it

## Common failure modes (and what they look like)

### 1) Compaction debt / backlog

**Symptom**: your disk is busy, p99 latency rises, and the number of SSTables grows.

**Why it happens**: ingest increases (or disk slows), but background compaction bandwidth doesn’t. The system falls behind.

**What it causes**:

- Rising read amplification → more I/O per read
- More CPU (filters, decompression, iterators)
- Space amplification (old + new files coexist)

### 2) Write stalls (the scary one)

Many engines intentionally **stall writes** when too many files accumulate (especially in L0 / the freshest level). This is self-defense: without stalling, latency would become unbounded and disk usage might explode.

**Symptom**: sudden drop in write throughput; request timeouts; queues build up.

### 3) Compaction “storms” (tail latency cliffs)

A compaction storm is when a big merge gets triggered (or multiple merges pile up) and competes hard with foreground traffic.

**Causes**:

- Too-large memtables flush into L0 too fast
- Poorly chosen level size ratios
- Hot partitions causing localized churn
- Misconfigured throttling (either none, or too aggressive)

### 4) Pathological workloads: hot keys + overwrites

Overwriting the same keys repeatedly can be brutal:

- Tons of obsolete versions that must be rewritten/garbage-collected
- Compaction keeps touching the same key ranges

This can manifest as: “But our dataset is small, why is the disk on fire?”

### 5) Long range scans that starve compaction

Range scans can be I/O hungry, and on some systems they can interfere with compaction scheduling or cache behavior.

**Symptom**: analytics job runs → online read p99 jumps → compaction falls behind → p99 stays bad even after the job finishes.

## How to test and observe compaction in production

Compaction issues are *observable* if you instrument the right things.

### Metrics to capture (minimum viable)

Even if your datastore is “managed,” insist on these signals:

- **Number of SSTables per level** (and/or total file count)
- **Pending compaction bytes / compaction backlog**
- **Compaction throughput** (read MB/s and write MB/s)
- **Write stall time** (total and rate)
- **Read amplification proxies**:
  - average files consulted per point lookup
  - bloom filter hit rate
  - block cache hit rate
- **Disk utilization**: queue depth, await latency

If you’re on RocksDB, many of these exist as built-in “rocksdb.*” stats and properties.

### Logs/events worth alerting on

- “Stopped writes” / “write stall” messages
- Compaction errors (checksum, corruption)
- Disk full / low disk headroom

### A pragmatic SLO suggestion

Instead of only alerting on p99 reads/writes, add “storage health” SLOs:

- Compaction backlog should remain below X GB for Y% of the day
- Write stall time should be near zero outside maintenance windows

Because once your LSM falls behind, *every downstream SLO becomes harder*.

## Design guidance (slightly opinionated)

- **Treat compaction as a first-class resource consumer.** If you size for ingest only, you’re underprovisioned.
- **Prefer predictable latency for user-facing systems.** Leveled compaction + proper cache sizing tends to be friendlier.
- **Keep headroom on disk.** Space amplification + backlog can surprise you. “80% full” is not a universal safe point.
- **Watch L0 like a hawk.** Many systems become unstable when the freshest level accumulates overlapping files.

## Further reading (high-quality)

- RocksDB: **Compaction** overview and tuning notes: <https://github.com/facebook/rocksdb/wiki/Compaction>
- LevelDB paper (intro + design): <https://github.com/google/leveldb/blob/main/doc/index.md>
- Apache Cassandra docs on compaction strategies: <https://cassandra.apache.org/doc/latest/cassandra/operating/compaction/index.html>

## Closing

“Later” is compaction, and compaction is not background housekeeping — it’s a core part of your system’s performance envelope.

If you internalize one thing: **your write throughput is bounded by how fast you can compact**, not how fast you can accept requests.
