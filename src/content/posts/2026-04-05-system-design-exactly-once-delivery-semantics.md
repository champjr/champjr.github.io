---
title: "System Design Daily: Exactly-Once Delivery Is Mostly Marketing"
pubDate: 2026-04-05
description: Why message delivery guarantees are really a composition of broker behavior, idempotency, and side-effect boundaries.
tags: ["system-design", "engineering", "distributed-systems", "messaging", "reliability"]
---

“Exactly once” is one of those phrases that sounds precise and usually is not.

In system design conversations, teams often ask for exactly-once delivery as if it were a switch you can turn on in a queue. In practice, what they usually want is simpler and more useful: **don’t lose important work, and don’t do the dangerous parts twice**.

That is not the same thing.

A broker can help. A transaction log can help. Consumer offsets can help. But once your handler talks to an external payment provider, sends an email, updates a database, or triggers a webhook, the problem stops being “message delivery” and becomes **side-effect coordination**.

My opinionated version is this: **exactly-once delivery is rarely an end-to-end property. Exactly-once effect is the thing that matters, and you usually get there with idempotency plus careful boundaries, not magic.**

## The problem framing

Say you run an order service that publishes a `ChargeCustomer` event after checkout.

```json
{
  "eventId": "evt_9f4c",
  "orderId": "ord_123",
  "customerId": "cus_42",
  "amountCents": 4999
}
```

A billing worker consumes that event and calls a payment API.

What can go wrong?

- The worker processes the message, charges the card, then crashes before acknowledging the message.
- The broker times out the consumer and redelivers the same event.
- Another worker picks it up and charges the card again.
- Now your queue has done its job—durability and retry—but your business logic has created a duplicate charge.

This is why delivery semantics matter. You need to know what the platform guarantees, what the consumer guarantees, and what your side effects guarantee.

## Core concepts

### At-most-once

At-most-once means a message is delivered zero or one time.

That sounds nice until you notice the “zero.” The usual way to get at-most-once behavior is to acknowledge early or accept loss on failure.

Good for:

- metrics and telemetry where occasional loss is acceptable
- cache invalidation hints that are recoverable elsewhere
- low-value notifications

Bad for:

- payments
- inventory movements
- anything legal, financial, or user-visible in a painful way

### At-least-once

At-least-once means the system will retry until it believes processing succeeded.

This is the workhorse model for real systems because it chooses duplication over loss. That is usually the correct bias.

But at-least-once means your consumer **must** tolerate duplicates.

Typical flow:

```text
1. Consumer reads message
2. Consumer performs work
3. Consumer stores success / commits offset / acks message
```

If the consumer crashes between 2 and 3, the broker will likely redeliver. That is expected behavior, not a bug.

### Exactly-once

Exactly-once is only meaningful if you specify the boundary.

Possible meanings include:

- exactly once between producer and broker
- exactly once from broker log to consumer state store
- exactly once for externally visible business effect

Those are very different promises.

Some platforms provide strong guarantees inside their own ecosystem. For example, Kafka’s idempotent producers and transactions can make “read-process-write back to Kafka” much stronger than generic queue processing. But if your handler also calls Stripe, sends email through SES, and writes to MySQL, the end-to-end story depends on those boundaries too.

## A small example with numbers

Assume your worker handles 1 million billing events per day.

- redelivery rate after retries/timeouts: 0.2%
- that means about 2,000 duplicate deliveries per day

If each duplicate can trigger a second external charge, you have a disaster.

If instead you store a unique idempotency key like `charge:ord_123` in your payments table and the payment provider also honors an idempotency key, those 2,000 duplicates become mostly harmless lookups.

A simplified API shape might look like this:

```http
POST /charges
Idempotency-Key: charge:ord_123

{
  "orderId": "ord_123",
  "amountCents": 4999
}
```

And your local database logic might be:

```sql
INSERT INTO processed_messages(message_id, processed_at)
VALUES ('evt_9f4c', now())
ON CONFLICT DO NOTHING;
```

If that insert reports “already exists,” the handler knows it has seen this event before and can skip the dangerous side effect.

That is not exactly-once delivery. It is usually better: **at-least-once delivery with exactly-once-ish effect at the business boundary**.

## Tradeoffs

### Delivery guarantees cost throughput or complexity

Stronger guarantees usually mean some mix of:

- transactional metadata
- deduplication state
- coordination between offset commits and state writes
- more storage for retained IDs
- higher latency on the happy path

If a team asks for exactly-once everywhere, what they often mean is “I don’t want to think about failure modes.” Sadly, the bill still arrives.

### Deduplication windows are not infinite

Many systems only remember message IDs for a bounded time.

If your dedupe store keeps 24 hours of IDs and a message reappears 3 days later from a replay, backup restore, or dead-letter reprocessing flow, you may perform the side effect again.

So the real question is not “do we dedupe?” It is:

- for how long?
- at what layer?
- with what key?
- against which side effect?

### Ordering and exactly-once are separate headaches

Teams sometimes bundle these together, but they are distinct.

You can have:

- no duplicates, wrong order
- correct order, duplicate deliveries
- both mostly okay for one partition and not okay across all keys

If your state transitions are order-sensitive—say `Created -> Paid -> Refunded`—then idempotency alone is not enough. You may also need per-entity sequencing or optimistic concurrency checks.

### External systems weaken your guarantee

Your queue may support transactions. Your email provider probably does not.

If you send a “Welcome!” email and then crash before marking the message done, the message can be retried and the user may get a second welcome email. This is annoying, but harmless. For credit card charges, it is not harmless at all.

That is why mature systems classify side effects by consequence:

| Side effect | Duplicate tolerance | Typical strategy |
|---|---|---|
| Metrics increment | High | Accept at-least-once |
| Email send | Medium | Idempotency key if possible, otherwise accept rare duplicate |
| Inventory reservation | Low | Transactional state change + dedupe |
| Payment capture | Very low | Strong idempotency end-to-end |

## Common failure modes

### 1. Treating broker guarantees as business guarantees

The classic mistake is reading “exactly once” in a vendor doc and assuming it applies to the whole workflow. It usually applies to a narrower boundary than your product manager assumes.

### 2. Non-atomic state update and acknowledgment

If you update local state and ack separately, there is always a crash window.

Examples:

- charge card, then ack message
- write DB row, then commit offset
- publish event, then mark job complete

These are where duplicates and ghost work come from.

### 3. Weak idempotency keys

`customerId` is usually a bad dedupe key.

`orderId` might be good for “one charge per order,” but terrible for “multiple shipment updates per order.” The key must match the business invariant you are protecting.

### 4. Replays that bypass dedupe assumptions

Backfills, dead-letter reprocessing, and disaster recovery restores love exposing hidden assumptions. A consumer that was “safe” in steady state becomes unsafe during replay because the dedupe window expired or the side-effect API changed.

### 5. Poison messages hidden by retries

A message that always fails after making a partial side effect can bounce forever unless you have retry limits, DLQs, and explicit operator visibility.

## How to test and observe it in production

### Test the crash windows on purpose

Do not just unit test the handler. Inject failures between every step:

- after the external API succeeds but before ack
- after local DB commit but before offset commit
- after publish but before status update

Then verify the end state is still correct after retries.

### Replay real messages in staging

Take a sample of production-like events and replay them twice. Then three times. If your “exactly once” design falls apart under duplicate replay, it was never exactly once.

### Instrument duplicate behavior

Track metrics like:

- duplicate delivery rate
- dedupe hit rate
- age of redelivered messages
- count of side-effect retries by downstream provider
- DLQ volume and retry exhaustion

A rising dedupe hit rate can be healthy—it may mean your safety net is working. A rising duplicate *side effect* rate means it is not.

### Make the boundary visible

Write down, in docs and dashboards, what is actually guaranteed.

For example:

- broker to consumer delivery: at-least-once
- consumer DB state transition: idempotent by `eventId`
- external payment effect: idempotent by `orderId`
- email notifications: best effort, duplicates possible

That sort of honesty prevents a lot of future pain.

## The practical takeaway

If someone asks for exactly-once delivery, ask a better question: **exactly once where, and for which side effect?**

Most reliable systems are built from a more boring stack:

1. durable messaging
2. at-least-once retries
3. idempotent consumers
4. atomic or near-atomic state transitions where possible
5. explicit handling for the side effects that cannot be rolled back

That is less magical than “exactly once,” but it is how you keep users from being charged twice while still surviving crashes and retries.

In distributed systems, the honest design is usually the robust one.

## Further reading

- [Kafka documentation: Exactly-once semantics](https://kafka.apache.org/documentation/#semantics_eos)
- [Amazon SQS Developer Guide: At-least-once delivery](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/standard-queues-at-least-once-delivery.html)
- [Stripe API docs: Idempotent requests](https://docs.stripe.com/api/idempotent_requests)
- [Designing Data-Intensive Applications — Chapter 11 notes on stream processing and exactly-once ideas](https://dataintensive.net/)
