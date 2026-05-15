---
title: "System Design Daily: Timing Wheels for Delayed Jobs"
pubDate: 2026-05-15
description: "How to schedule millions of delayed tasks without turning your database into a sad priority queue."
tags: ["system-design", "engineering", "distributed-systems", "queues", "reliability"]
---

A lot of systems need to do work later, not now.

Send a retry in 30 seconds. Expire a shopping cart in 15 minutes. Release a distributed lock lease in 10 seconds. Move a stuck message back to the ready queue after its visibility timeout. Remind a user tomorrow morning.

The first version of this is usually a database table with `run_at` and a polling worker:

```sql
SELECT *
FROM jobs
WHERE run_at <= now()
ORDER BY run_at
LIMIT 100;
```

That works for a while. Then product adds more reminders, retries, timeouts, and scheduled workflows. Suddenly you are storing millions of future tasks, polling all the time, and paying a weird amount of money just to discover that most jobs are still not ready.

This is where **timing wheels** are worth knowing. They are a practical data structure for efficiently managing huge numbers of delayed jobs and timers.

## The problem

A delayed-job system has two conflicting goals:

1. **Cheap inserts**. Adding a timer should not get slower as the number of scheduled items grows.
2. **Cheap expiry**. When time advances, you want to quickly find what just became due.

A naive priority queue gives you decent semantics, but it can become expensive when you have very large timer counts and high churn. A naive database poller is even worse because it keeps re-checking work that is not ready yet.

The core mistake is treating time as a giant sorted list when most of the time you only care about **the current slice**.

## Core concept: bucket time instead of sorting everything

A timing wheel breaks time into buckets.

Imagine a circular array with 60 slots, one slot per second. A pointer moves once per second. When the pointer lands on a slot, every timer in that bucket expires and gets processed.

```text
[00][01][02][03]...[58][59]
  ^
 current tick
```

If a job should fire 8 seconds from now, put it in the bucket 8 ticks ahead. When the wheel advances to that slot, the job is due.

That gives you a nice property:

- **insert** is close to O(1)
- **tick processing** is proportional to the number of jobs due now, not the total number scheduled

That is the big win.

### What about delays longer than one wheel rotation?

You need one of two tricks.

#### Option 1: rounds counter

If the wheel has 60 slots and a job is due in 130 seconds, put it in slot 10 with `rounds=2`. Each time the pointer lands on slot 10, decrement rounds. Fire the job when rounds hits zero.

#### Option 2: hierarchical timing wheels

Use multiple wheels for different granularities:

- wheel A: seconds
- wheel B: minutes
- wheel C: hours

A job scheduled for 3 hours from now starts in the hour wheel. As time gets closer, it cascades down into the minute wheel, then the second wheel.

This is usually the more scalable design for very large timer populations.

## A small example

Suppose you run a notification system with:

- 5 million pending reminders
- 50,000 new delayed jobs per minute
- most delays between 30 seconds and 24 hours

If you poll a SQL table every second, you keep hammering an index full of mostly future rows. Even if the query is indexed, the read amplification is silly.

A hierarchical timing wheel might look like this:

| Wheel | Bucket size | Slots | Coverage |
| --- | --- | --- | --- |
| L1 | 1 second | 60 | 1 minute |
| L2 | 1 minute | 60 | 1 hour |
| L3 | 1 hour | 24 | 1 day |

When a reminder is 9 hours away, it sits in L3. When it gets within the next hour, it moves to L2. When it gets within the next minute, it moves to L1. Only the current L1 bucket needs immediate attention.

That is much closer to the shape of the problem.

## Tradeoffs

Timing wheels are useful, but they are not magic.

### What they are good at

- **Huge timer cardinality**. Millions of delayed jobs are realistic.
- **High churn**. Inserts and cancellations stay cheap.
- **Predictable work per tick**. You only process the bucket that just matured.
- **Good fit for retries and timeouts**. Especially when exact-to-the-millisecond precision does not matter.

### What they are bad at

- **Exact ordering inside a bucket**. If many jobs land in the same slot, you may need a small secondary sort.
- **Very high precision**. If you need strict millisecond scheduling, bucket-based designs get harder and more expensive.
- **Very sparse, very long timers**. For tasks scheduled months out, a durable scheduler or workflow engine may be a better fit.
- **Operational simplicity**. A database poller is inefficient, but it is easier to explain to a sleepy on-call engineer.

My opinion: timing wheels are great when you need lots of timers and can tolerate bounded scheduling jitter. If you need perfect precision, or business workflows that span weeks, use a different tool.

## Common failure modes

### 1. Assuming the scheduler is durable when it is not

An in-memory wheel is fast, but a restart can vaporize timers unless you persist them somewhere.

Common pattern:

- durable source of truth in Kafka, Postgres, or a log-backed store
- in-memory timing wheel for near-term execution
- replay on restart

If you skip the durable part, you did not build a scheduler. You built a hope machine.

### 2. Ignoring clock behavior

Do not drive scheduling off wall-clock time alone. NTP adjustments, leap seconds, and VM pauses can create surprising jumps.

Use a monotonic clock for elapsed delay calculations, and convert to wall-clock only when user-facing timestamps matter.

### 3. Overstuffed buckets

If too many timers hash into one slot, one tick can become a mini outage.

Example:

- 200,000 visibility timeouts all set to exactly 30 seconds
- one bucket matures
- one worker thread tries to requeue them all
- latency spikes and downstream systems get punched in the face

Mitigations:

- spread timers with jitter when exact alignment is unnecessary
- shard wheels across partitions or tenants
- cap work per tick and spill over safely

### 4. Forgetting cancellation cost

Scheduling is only half the story. Many systems also cancel timers constantly, for example when a client ack arrives before a timeout.

If cancellation requires scanning a bucket list linearly, hot buckets become painful. Store handles or indexes that let you remove timers cheaply.

### 5. Silent scheduling lag

The wheel says a job was due at 12:00:10, but it actually ran at 12:00:37 because the process was CPU-starved or the due bucket was enormous.

That is not a tiny implementation detail. That is a user-visible reliability bug.

## How to test it

Test the scheduler like a systems component, not just a library.

### Functional tests

- insert timers with short, medium, and long delays
- verify they fire once
- verify cancellation works
- verify timers across wheel boundaries cascade correctly

### Load tests

Simulate realistic timer distributions.

For example:

- 10 million scheduled timers
- 100,000 inserts per minute
- 20,000 cancellations per minute
- burst of 300,000 expirations on one tick

Measure:

- insert latency
- expiration lag
- CPU per tick
- memory growth

### Restart tests

Kill the scheduler process mid-flight, replay durable state, and confirm you do not lose or double-fire jobs beyond your stated semantics.

## How to observe it in production

If I were operating this, I would want these metrics on a dashboard:

- scheduled timer count
- insert rate and cancel rate
- expired jobs per tick
- bucket occupancy distribution
- scheduling lag (`actual_fire_time - expected_fire_time`)
- replay time after restart
- dropped or duplicate executions

A useful alert is not just “scheduler process is down.” It is “p99 scheduling lag is above 5 seconds for 10 minutes.” That catches the failure your users actually feel.

## A simple architecture sketch

```text
API / workers
    |
    v
Durable job store  ---> recovery replay on restart
    |
    v
In-memory timing wheel(s)
    |
 each tick
    v
Ready queue / executor workers
```

The durable store is for correctness. The timing wheel is for efficiency. The executor is where retries, idempotency, and backpressure still matter.

That last part is important. A good delayed-job scheduler does not remove downstream reliability concerns. It just stops your timer bookkeeping from becoming the bottleneck.

## Closing thought

Timing wheels are one of those ideas that feel almost too simple once you see them: stop globally sorting time, and just organize the next bit of it well.

That simplicity is why they show up in real systems like Kafka-style delayed operations, network timer facilities, and high-throughput timeout management. If your system has accumulated enough retries, leases, reminders, and delayed reprocessing to make the database sad, a timing wheel is often the right next abstraction.

## Further reading

- [Hashed and Hierarchical Timing Wheels, explained by The Morning Paper](https://blog.acolyer.org/2015/11/23/hashed-and-hierarchical-timing-wheels/)
- [Apache Kafka, Purgatory, and Hierarchical Timing Wheels](https://www.confluent.io/blog/apache-kafka-purgatory-hierarchical-timing-wheels/)
- [Netty `HashedWheelTimer` API docs](https://netty.io/4.1/api/io/netty/util/HashedWheelTimer.html)
