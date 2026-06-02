---
title: "System Design Daily: Partition Keys and Per-Key Ordering"
pubDate: 2026-06-02
description: "How to preserve the ordering that matters in queues and streams without serializing your entire system."
tags: ["system-design", "engineering", "distributed-systems", "messaging", "reliability"]
---

Most systems do **not** need total ordering. They need the smaller, more useful promise: **events about the same thing should be processed in order**.

That distinction matters. Teams often start with a queue, assume ordering is automatic, then discover that parallel consumers cheerfully reorder updates for the same account, cart, or device. The result is not just cosmetic weirdness. It turns into corrupted state, duplicate side effects, and impossible incident timelines.

My opinionated take is that **per-key ordering is one of the most underappreciated system design tools**. Total ordering is expensive theater for many products. Per-key ordering is usually the thing you actually wanted.

## The problem

Imagine a payment platform that emits these events for a single account:

```text
1. debit $40
2. debit $20
3. refund $20
```

If consumers process them in that order, the balance is correct.

If a parallel consumer fleet processes `refund $20` before `debit $20`, you may temporarily show the wrong balance. Worse, if one handler checks invariants against current state, reordering can trigger false overdraft alarms or bad compensating actions.

The same shape shows up everywhere:

- shopping carts: `add item`, `remove item`, `checkout`
- IoT devices: `firmware-update-start`, `ack`, `rollback`
- ticketing: `reserve seat`, `expire hold`, `confirm purchase`
- user profiles: `email changed`, `verification sent`, `login allowed`

You usually do not care whether **Alice's** update happens before **Bob's**. You care that **Alice's own events** stay in sequence.

## Core concepts

### 1. Pick the ordering key deliberately

Per-key ordering starts with the key.

A producer chooses a partitioning key such as:

- `account_id`
- `order_id`
- `device_id`
- `tenant_id`

All events with the same key are routed to the same partition, shard, or message group. That gives one consumer lane authority over that key at a given time.

If the key is wrong, the rest of the design is wrong.

Common mistake: partitioning by a field that is easy to compute instead of a field that matches the state machine. If your business invariant lives at the `account_id` level but you partition by `transaction_id`, you preserved almost nothing.

### 2. Ordering is usually local to a partition

Systems like Kafka, Pulsar, and SQS FIFO make ordering guarantees within a partition or message group, not across the whole topic or queue.

That is the trade.

```text
producer -> hash(key) -> partition 7 -> consumer A
producer -> hash(key) -> partition 2 -> consumer B
producer -> hash(key) -> partition 7 -> consumer A
```

Events for the same key land together, but different keys can move independently. That is what lets you scale horizontally without turning the entire pipeline into a single-file line.

### 3. Parallelism and ordering fight each other

If you want more throughput, you add more partitions or more workers.

If you want stricter ordering, you reduce the number of places where the same key can be processed concurrently.

You do not get infinite parallelism and perfect sequencing for free. You choose where to serialize.

A practical rule is:

- serialize **within a key**
- parallelize **across keys**

That sounds simple, but it implies real consequences for hot accounts, celebrity users, and noisy tenants.

### 4. Ordering at the broker does not guarantee ordered side effects

This is where teams fool themselves.

The broker may deliver messages in order, but your consumer can still break that promise by:

- processing messages asynchronously and committing offsets too early
- retrying a failed message while later messages for the same key continue
- writing to multiple downstream systems with different latency
- using a database pattern that allows concurrent updates to the same row

Ordered delivery is only the first half. You also need **ordered application**.

## A small example

Suppose you run an inventory service.

Events:

```json
{ "sku": "shoe-9", "type": "reserve", "qty": 2, "version": 41 }
{ "sku": "shoe-9", "type": "release", "qty": 1, "version": 42 }
{ "sku": "shoe-9", "type": "reserve", "qty": 3, "version": 43 }
```

You partition by `sku` so all `shoe-9` events hit the same partition.

If starting inventory is `10`, correct ordered processing yields:

| Event | Inventory after |
| --- | ---: |
| reserve 2 | 8 |
| release 1 | 9 |
| reserve 3 | 6 |

Now imagine version 43 is applied before version 42 because your consumer farm retries version 42 later.

You might temporarily compute:

```text
10 -> reserve 2 = 8
8  -> reserve 3 = 5
5  -> release 1 = 6
```

The final number happens to match here, which is dangerous because it hides the bug. In many workflows, the intermediate state triggers real actions, like rejecting a purchase, publishing a restock event, or paging someone.

That is why adding a monotonically increasing `version` per key is often worth it. Even with broker ordering, a version lets consumers detect gaps, duplicates, and stale updates.

## Tradeoffs

| Decision | Benefit | Cost |
| --- | --- | --- |
| Partition by entity key | Preserves relevant order | Can create hot partitions |
| Add more partitions | More throughput | Repartitioning is operationally painful |
| Use strict FIFO queues | Simpler reasoning | Lower throughput than relaxed queues |
| Add per-key version checks | Catches reorder/duplicate bugs | Requires producer discipline and state tracking |
| Buffer on gaps | Preserves correctness | Adds latency and memory pressure |

My bias is to be explicit about what is ordered and what is not. If the product only needs per-user or per-order sequencing, say that in the design doc. Do not vaguely claim "the queue is ordered" because that sentence is usually lying by omission.

## Common failure modes

### Hot keys

One tenant or account gets dramatically more traffic than everyone else. Because all its messages share a key, one partition becomes the bottleneck while others sit mostly idle.

Mitigations include:

- splitting the entity into subkeys when the business invariant allows it
- moving expensive work off the critical ordered path
- using separate workflows for exceptional heavy tenants

If the invariant really is global for that key, sometimes the answer is uncomfortable: **that key is inherently serial**.

### Repartitioning surprises

Changing partition counts can reshuffle keys. That is usually safe for future traffic, but dangerous if you assume old and new consumers can both process the same key concurrently during migration.

Treat repartitioning as a correctness event, not just a scaling tweak.

### Poison messages blocking a key

Strict per-key ordering means one bad message can stall everything behind it for that key.

That is not a bug in the queue. That is the cost of the guarantee.

You need a policy for:

- retries with bounded backoff
- parking poison messages for investigation
- compensating or manually skipping when the business approves it

### Out-of-order side effects after retries

A timed-out consumer may still finish its database write after another worker already retried the same message. Now you have ordered delivery but unordered writes.

This is where idempotency keys, compare-and-swap conditions, and version checks stop being optional.

## How to test and observe it in production

First, test with deliberate disorder.

Good chaos tests include:

- duplicate a message for the same key
- delay message `N` and deliver `N+1` first
- crash the consumer after writing state but before acking
- increase one key's traffic by 100x to reveal hot partition behavior

Second, instrument the guarantees directly.

Useful metrics:

- per-partition consumer lag
- hottest keys by message rate
- reorder detections per key
- version-gap events
- age of oldest blocked message in a partition or message group
- retry rate for messages that hold ordered lanes

Useful logs or traces:

- include `ordering_key`, `partition`, `offset` or `sequence`, and `entity_version`
- emit a structured event when a consumer sees `expected_version=42` but receives `44`

A queue is not "observably ordered" because the broker docs say so. It is observably ordered when your telemetry can prove whether entity updates arrived, waited, retried, and applied in sequence.

## The practical takeaway

If your system cares about state transitions for an entity, design around **per-key ordering**, not vague FIFO dreams.

Route related events to the same lane. Keep processing serialized for that key. Add versions so you can detect when reality drifts from theory. Then watch for the two things this design naturally creates: **hot keys** and **blocked keys**.

That is the honest trade. You give up some parallelism so your state machine stops hallucinating.

## Further reading

- [Apache Kafka documentation: Message ordering](https://kafka.apache.org/documentation/#semantics)
- [Amazon SQS FIFO queues](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/FIFO-queues.html)
- [Martin Kleppmann, *Designing Data-Intensive Applications*](https://dataintensive.net/)
- [Apache Pulsar concepts: ordering and partitioned topics](https://pulsar.apache.org/docs/latest/concepts-messaging/)
