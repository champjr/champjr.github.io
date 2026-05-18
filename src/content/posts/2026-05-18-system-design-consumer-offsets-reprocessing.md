---
title: "System Design Daily: Consumer Offsets and Safe Reprocessing"
pubDate: 2026-05-18
description: "How to track progress in event consumers without turning retries, replays, and deploys into data corruption."
tags: ["system-design", "engineering", "distributed-systems", "stream-processing", "reliability"]
---

Event-driven systems love to advertise the fun part: decoupling, fan-out, async workflows, nice clean boundaries.

The less glamorous part is deciding what a consumer has actually processed.

That is the job of **offset management**. If you get it wrong, you do not just lose a little elegance. You get duplicate side effects, skipped records, bad backfills, and on-call nights where everyone argues about whether the consumer is "caught up" while production says otherwise.

Today’s focused topic is **consumer offsets and safe reprocessing**: how consumers track position in a log or queue, what can go wrong, and how to design replay-friendly systems.

## The problem

Imagine a payment-events topic partitioned in Kafka:

```text
partition-7
[offset 1001] payment.created
[offset 1002] payment.authorized
[offset 1003] payment.captured
[offset 1004] payment.refunded
```

A fraud detection service reads this stream and writes results into its own database.

Two simple questions quickly become complicated:

1. When should the consumer mark offset `1003` as done?
2. What happens if it crashes after writing to the database but before committing the offset?

If it commits too early, it can **skip work**.
If it commits too late, it can **repeat work**.
If the downstream side effects are not idempotent, either mistake becomes a business bug.

That is why offset tracking is not an implementation detail. It is part of your system’s correctness model.

## Core concepts

### Offset means position, not success everywhere

An offset usually means, “I have processed records up to here according to some local definition of done.”

That definition matters.

For a stateless metrics consumer, “done” may mean the record was parsed and counters were updated in memory.
For an order projector, “done” may mean the database transaction committed.
For an email sender, “done” might need to include a durable record that the send was attempted.

The dangerous habit is treating offset commit as a routine SDK call instead of a boundary in your data flow.

### There are only a few real delivery outcomes

In practice, a consumer usually lands in one of these buckets:

| Strategy | Failure risk | Typical outcome |
| --- | --- | --- |
| Commit before processing | skipped records on crash | at-most-once |
| Commit after processing | duplicates on crash | at-least-once |
| Atomic processing + position update in one durable system | more complexity | closer to exactly-once for that boundary |

Most production systems should assume **at-least-once delivery** and design for duplicate handling. That is the boring, durable truth.

### Offsets are per partition, not global truth

In partitioned logs, progress is usually tracked per partition. A consumer group may be caught up on 31 partitions and badly behind on one hot shard.

That means “lag” is not a single number you should trust blindly. You want to know:

- lag by partition
- lag by consumer instance
- age of the oldest unprocessed message
- time since last successful commit

The oldest-message age is often more meaningful than raw record count.

## A small example

Say your shipping service consumes `order.paid` events and creates shipment rows.

Pseudo-flow:

```text
1. Read message at offset 81244
2. Start DB transaction
3. Insert shipment(order_id=123)
4. Commit DB transaction
5. Commit consumer offset 81244
```

Now imagine the process crashes between steps 4 and 5.

After restart, it reads offset `81244` again.

If the insert is naive, you create two shipments.
If the insert is protected by `UNIQUE(order_id)`, the second attempt becomes harmless. The consumer can detect the duplicate, treat it as already-applied work, and then commit the offset.

That is the heart of safe reprocessing:

- **business side effects must tolerate replay**
- **offset commits should follow durable application of work**

## Tradeoffs

### Automatic commits are convenient and often wrong

Many client libraries support auto-commit every few seconds. That sounds nice until a batch is fetched, half processed, and the process dies after the auto-commit advanced past records that never finished.

My opinion: auto-commit is fine for throwaway analytics and dangerous for business-critical workflows.

Manual commits are more annoying, but at least they make the correctness boundary explicit.

### Batch commits improve throughput, but widen replay windows

Committing every message is simple but expensive. Committing every 1,000 messages is efficient but increases the amount of work that can replay after a crash.

A practical middle ground is:

- process records in bounded batches
- apply side effects durably
- commit the highest contiguous offset only after the whole safe batch completes

That gives you better throughput without pretending failures disappear.

### Reprocessing is powerful, but only if schemas and side effects behave

Teams often say they want replay, then discover six months later that replay breaks because:

- event schemas changed without compatibility discipline
- downstream APIs are not idempotent
- old records trigger emails, webhooks, or billing again
- consumers mixed transient logic with irreversible side effects

If replay is part of your recovery plan, design for it on day one.

## Common failure modes

### 1. Treating retries as the same thing as reprocessing

Retries happen close to the original attempt. Reprocessing often happens days or months later after code changes, schema changes, or state drift.

A system that survives retries may still fail badly during a backfill.

### 2. Committing holes inside a partition

Suppose offsets `10, 11, 12` are fetched together, but offset `11` fails while `12` succeeds.

If you commit offset `12` anyway, you just created a hole and effectively dropped `11` for that consumer group.

Within one partition, only commit the highest **contiguous** safe offset.

### 3. Not separating poison messages from transient failures

Some records are temporarily blocked by downstream timeouts. Others are malformed forever.

If you keep retrying poison messages in place, one bad record can stall a whole partition.

Good patterns include:

- dead-letter queues for records that exceed retry policy
- parking lots for manual inspection
- clear distinction between retriable and non-retriable errors

### 4. Reprocessing without side-effect guards

This is the classic disaster.

A team replays a month of `user.created` events to rebuild a search index. The consumer also sends welcome emails as part of the same code path. Suddenly thousands of existing users get another welcome email.

Index rebuilding and user notification should not share the same irreversible effect path.

### 5. Observing lag without observing commit health

A consumer can keep polling and appear alive while not making durable progress.

If offsets are not advancing, or commit latency spikes, your system is sick even if CPU and memory look fine.

## How to test it

Test consumer correctness with failure injection, not just happy-path unit tests.

### Functional tests

- process one record twice and verify idempotent outcome
- crash after side effect but before offset commit
- crash before side effect and verify no false commit
- verify poison messages route to the right place

### Replay tests

Take a realistic sample, maybe 1 million old events, and run a replay into a staging environment.

Check:

- final state matches expectations
- no duplicate external calls
- commit rate and lag remain stable
- old schemas still deserialize correctly

### Load tests

Measure behavior under skew:

- one hot partition with 10x traffic
- slow downstream database
- rebalance during active processing

The thing to watch is not just throughput. Watch **recovery behavior** after interruption.

## How to observe it in production

If I were running an important consumer fleet, I would want these signals:

- consumer lag by partition
- age of oldest unprocessed record
- offset commit latency and failure rate
- records retried, records dead-lettered
- duplicate-detection hits
- replay job progress and estimated completion time
- downstream side-effect error rates

A useful alert is often: “oldest unprocessed record is older than 10 minutes” rather than “lag > 10000.” Ten thousand tiny records may be fine. One stuck partition holding 15 minutes of payment events is not.

## A practical design pattern

For business-critical consumers, a solid pattern looks like this:

```text
read event
  -> apply changes in local DB transaction
  -> write idempotency / processed-event marker
  -> commit DB transaction
  -> commit consumer offset
```

That processed-event marker might be keyed by `(partition, offset)` or by a domain event ID if one exists.

The exact shape depends on the system, but the principle stays the same: **make replay cheap, expected, and boring**.

Because the real goal is not to avoid ever re-reading a message. The real goal is to ensure that re-reading it does not hurt you.

## Further reading

- [Kafka Consumer Design](https://docs.confluent.io/platform/current/clients/consumer.html)
- [Apache Kafka Documentation: Consumer Configs](https://kafka.apache.org/documentation/#consumerconfigs)
- [Designing Data-Intensive Applications, Chapter 11](https://dataintensive.net/)
- [The Log: What every software engineer should know about real-time data's unifying abstraction](https://engineering.linkedin.com/distributed-systems/log-what-every-software-engineer-should-know-about-real-time-datas-unifying)
