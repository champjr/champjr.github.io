---
title: "System Design Daily: Write-Ahead Logging"
pubDate: 2026-04-03
description: "Why durable systems write the receipt before they move the furniture, and how WAL shapes databases, queues, and recovery paths."
tags: ["system-design", "engineering", "distributed-systems", "databases", "storage"]
---

Most systems fail in a boring way: **they crash in the middle of doing something important**.

A payment service records a balance update, but dies before the row hits disk. A message broker accepts a publish, but the machine reboots before the message is durable. A database updates a data page in memory, but a power loss lands halfway through the write.

The fix is one of the most useful ideas in system design: **write-ahead logging (WAL)**.

The principle is simple:

> Before you mutate the main state, append a durable record of the intent or change.

That sounds almost trivial. It is not trivial. WAL is the difference between “we think we committed that” and “we can prove exactly what happened after a crash.”

## Problem framing: random writes are fragile, crashes are inevitable

If your service updates the primary copy of its data directly, you inherit two nasty problems:

1. **Partial failure**: the process can die halfway through an operation.
2. **Storage reality**: random in-place writes are harder to make atomic and durable than sequential appends.

Suppose you run a tiny ledger service:

- Account A: $500
- Account B: $300

A transfer of $50 should do two writes:

1. subtract $50 from A
2. add $50 to B

Now imagine the machine crashes after step 1 but before step 2. Without some durable record of what was supposed to happen, recovery becomes guesswork.

Guesswork is not a recovery strategy.

WAL gives you a safer sequence:

1. append a log record saying what change is about to happen
2. fsync or otherwise make that log durable according to your durability policy
3. apply the change to the main data structure later

If the process crashes after step 1, recovery can replay the log.
If it crashes after step 3, recovery can still replay safely because the log is the source of truth for in-flight changes.

## Core concept: the log is the durable history

A write-ahead log is usually an **append-only sequence of records**. Each record describes one of:

- a logical operation (`transfer $50 from A to B`)
- a physical change (`page 42 changed from X to Y`)
- or enough metadata to redo/undo work during recovery

The important properties are:

- **append-first**: log before touching base data
- **durability boundary**: acknowledge success only after the required log bytes are durable
- **ordered replay**: after a crash, scan the log and reconstruct the intended state

A simplified flow looks like this:

```text
client write
   |
   v
append record to WAL ----> flush / fsync
   |                            |
   |                            +--> safe point for "committed"
   v
apply change to memtable / data pages / indexes
   |
   v
later background flush / compaction / checkpoint
```

This is why WAL shows up everywhere:

- relational databases
- LSM-based storage engines
- message brokers
- stream processors
- some filesystem and metadata designs

Even when systems do not call it “WAL,” the pattern is often there.

## A small example with numbers

Imagine an orders service receives 2,000 writes per second. Each order mutation changes:

- one order row
- one customer aggregate
- one inventory counter

Writing those three structures in place, synchronously, for every request is expensive and failure-prone.

With WAL, the service can instead:

- append a 300-byte record to a sequential log
- flush the log every 5 ms or per transaction, depending on durability goals
- update in-memory state immediately
- write checkpointed state to tables later in larger batches

At 2,000 writes/sec, the WAL traffic is only about **600 KB/sec** of sequential append workload. That is a much friendlier I/O pattern than 6,000 scattered small writes.

This is the practical magic of WAL: **better crash recovery and often better write throughput**.

## Tradeoffs: what WAL buys you, and what it costs

### The upside

**1. Durable commits**  
You get a clear answer to “what counts as committed?” Usually: the log record reached stable storage.

**2. Fast writes**  
Sequential append is usually kinder to disks and SSD write paths than random in-place mutation.

**3. Recoverability**  
Crash recovery becomes replay, not archaeology.

**4. Replication hooks**  
Logs are also a natural feed for replicas, CDC pipelines, and downstream consumers.

Postgres, for example, leans heavily on WAL for both durability and replication.

### The downside

**1. Recovery time can grow**  
A huge log means a slow restart if you have to replay too much history.

**2. You need checkpoints**  
If WAL is the forever-truth and you never checkpoint compacted state, restart becomes miserable.

**3. fsync is where optimism goes to die**  
You can claim durability only after the relevant flush semantics happen. Skip that, and you are benchmarking fantasy.

**4. Log corruption becomes a big deal**  
Your recovery path depends on the log being parseable and integrity-checked.

## Common failure modes

### 1) Acknowledging before durability

This is the classic sin.

If your service returns `200 OK` before the WAL is durable, you have built a polite liar. Everything looks fine until a crash reveals that the acknowledged write never actually existed.

This can be a valid tradeoff if you explicitly want weaker durability, but it must be intentional and documented.

### 2) Forgetting idempotent replay

Recovery replays history. If replaying a record twice corrupts state, your design is brittle.

Use sequence numbers, transaction IDs, page LSNs, or deduplication markers so that replay can safely answer: **have I already applied this record?**

### 3) Letting checkpoints lag forever

If checkpointing falls behind, recovery time quietly gets worse week after week. Then you hit a crash and discover your "five minute restart" is actually 90 minutes of log replay.

Operationally, WAL is not just a write path feature. It is a **recovery-time budget**.

### 4) Treating the log as free storage

Teams sometimes keep too much in the WAL path because append looks cheap. It is cheap right up until:

- disks fill
- replication lags
- restart time explodes
- retention rules become unclear

WAL should be designed with clear lifecycle rules: rotation, archival, truncation, checkpoint coordination.

## How to test and observe WAL in production

If you only test the happy path, WAL will betray you at the least convenient moment.

### Tests worth running

**Crash-at-every-step tests**  
Take a write flow and simulate crashes:

- before append
- after append, before fsync
- after fsync, before apply
- during checkpoint
- during log segment rotation

Then restart and verify invariants.

**Replay determinism tests**  
Given the same WAL, recovery should produce the same final state every time.

**Torn record / corruption tests**  
Inject truncated records, bad checksums, and partial segments. Recovery should fail clearly or stop at a safe boundary.

**Lag tests**  
Force checkpoint lag and measure restart time. Don’t guess.

### Metrics and signals to watch

A few observability basics go a long way:

| Metric | Why it matters |
| --- | --- |
| WAL append latency | Shows pressure on the commit path |
| fsync latency p95/p99 | Usually the real durability bottleneck |
| WAL bytes/sec | Helps capacity planning |
| Checkpoint age / distance | Predicts recovery time |
| Replay time in drills | Measures reality, not hope |
| Segment archive / replication lag | Warns about downstream durability gaps |

Also log explicit recovery summaries after restart:

- last durable log sequence number
- number of records replayed
- time spent replaying
- whether recovery stopped due to clean end-of-log or corruption boundary

That one summary line saves a lot of confusion during incidents.

## A practical design sketch

Suppose you are building a simple internal queue service.

Pseudo-API:

```http
POST /messages
{
  "topic": "email",
  "payload": { "to": "user@example.com", "template": "welcome" }
}
```

A sane WAL-backed write path might be:

1. assign message ID `msg_90210`
2. append `ENQUEUE topic=email id=msg_90210 ...` to WAL
3. flush according to durability mode
4. insert into in-memory queue index
5. return success

On crash recovery:

- replay WAL
- rebuild the in-memory queue index
- ignore duplicate `msg_90210` if already materialized in a checkpointed segment

That design is not glamorous. It is also the kind of design that survives Tuesday.

## Slightly opinionated closing thought

Engineers sometimes treat WAL as a database-internals detail. It is more general than that.

WAL is a mindset: **record the durable story before you mutate the world**.

If your system has to answer "did we really accept this write?" after a crash, you need some version of that idea.

Not every service needs a textbook database-grade WAL. But if you are building anything that promises durability, auditability, replay, or recoverability, you should have a crisp answer for:

- what is the durable commit point?
- what exactly gets replayed after a crash?
- how long does recovery take when the log is large?
- how do we prove replay is safe and idempotent?

If those answers are fuzzy, the system is probably less durable than the API makes it sound.

## Further reading

- [PostgreSQL Documentation: Write-Ahead Logging (WAL)](https://www.postgresql.org/docs/current/wal-intro.html)
- [Martin Kleppmann: Turning the database inside-out with Apache Samza](https://www.confluent.io/blog/turning-the-database-inside-out-with-apache-samza/)
- [Designing Data-Intensive Applications](https://dataintensive.net/) by Martin Kleppmann
- [LevelDB implementation notes](https://github.com/google/leveldb/blob/main/doc/impl.md)
