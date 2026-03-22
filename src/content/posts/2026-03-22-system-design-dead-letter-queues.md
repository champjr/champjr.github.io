---
title: "System Design Daily: Dead Letter Queues (DLQs) and Poison Message Handling"
pubDate: 2026-03-22
description: "How to stop one bad message from taking down an entire consumer fleet."
tags: ["system-design", "engineering", "distributed-systems", "reliability", "messaging"]
---

Queues are supposed to make systems *more* resilient: producers can keep going, consumers can scale independently, and spikes get smoothed.

And then a single malformed or “impossible” message shows up, your consumer crashes on it, the queue immediately redelivers it, the consumer crashes again… and you’ve built an infinite loop that burns CPU, hammers downstream dependencies, and blocks good work behind a bad payload.

This post is about designing **poison message handling** using **Dead Letter Queues (DLQs)** so that:

- good messages keep flowing
- bad messages are isolated and inspected
- retries are intentional (not accidental)
- you can prove you’re not silently losing data

## Problem framing: the “one bad message” failure mode

Most production messaging systems are *at-least-once* delivery. That’s a sane default: if you must choose between losing messages and duplicating them, duplication is usually easier to detect and correct.

But at-least-once delivery has a sharp edge:

1. Consumer receives message `M`.
2. Consumer errors (bug, schema mismatch, downstream 500, timeout, etc.).
3. Consumer does not ack/commit.
4. Broker redelivers `M`.
5. Repeat forever.

If your queue uses a **visibility timeout** (e.g., SQS), the message becomes visible again after N seconds. If you’re using a log-based system (e.g., Kafka), your consumer group can get stuck on an uncommittable offset.

The result is the same: **a poison message can pin your throughput to ~0**, or at least pin a partition/shard and cause backlog growth.

A DLQ is the pressure relief valve.

## Core concepts (with opinions)

### 1) DLQ: a separate place for “could not be processed”

A **Dead Letter Queue** is a queue (or topic) where messages go after they have failed processing *enough times*.

The key word is **enough**: the DLQ is not a “first failure” mechanism. It’s the *terminal* path after retries.

What should a DLQ message include?

- the original payload (or a pointer to it)
- metadata: message id, timestamp, source queue/topic, consumer version
- failure context: error type, stack trace hash, last exception message
- retry count / attempt number

If your DLQ doesn’t preserve context, you haven’t built observability—you’ve built a dumpster.

### 2) Retry policy: controlled, bounded, and reason-aware

You need a retry policy that answers:

- **How many attempts?** (e.g., 5)
- **How fast?** (exponential backoff + jitter is common)
- **For which errors?** (transient vs permanent)

A practical stance:

- **Retry transient dependencies** (timeouts, 429s, brief 5xx).
- **Do not blindly retry permanent failures** (schema errors, validation failures, missing required fields).

In many systems you can’t perfectly classify errors. That’s fine—default to *bounded retries + DLQ*.

### 3) “Poison message” is not one thing

Poison messages come in a few flavors:

- **Malformed:** can’t parse JSON/Avro/Protobuf
- **Invalid:** parses, but fails business validation (negative quantity, unknown enum)
- **Incompatible:** schema evolution mismatch between producer and consumer
- **Non-deterministic:** race conditions / time-dependent logic causing intermittent failures
- **Toxic to downstream:** message triggers expensive path, thundering herd, or deadlocks

Your handling should differ:

- malformed/invalid → usually DLQ quickly (maybe no retry)
- downstream outage → retry with backoff
- incompatible schema → depends: can you gracefully ignore unknown fields? do you need a hotfix?

### 4) Partitioned systems: one poison message can block *a shard*

In Kafka-like systems, order is preserved per partition. That’s great… until a poison message sits at offset `X` and your consumer can’t commit past it.

Two common patterns:

- **Dead-letter topic + “skip” strategy**: write the failing record to a dead-letter topic, then commit the offset to move on.
- **Parking-lot topic**: move to a “parked” topic for later replay, *keeping ordering semantics separate from normal flow*.

Skipping is scary because it looks like data loss. That’s why your DLQ must be treated as first-class data.

## A small concrete example (numbers + pseudo-API)

Imagine a worker that processes `ChargeCustomer` events.

- Normal throughput: 1,000 msgs/min
- Consumer concurrency: 50
- Visibility timeout: 30s
- Average processing time: 200ms

A poison message crashes the worker instantly on parse.

Without DLQ:

- it is redelivered every 30s
- if you have autoscaling, the backlog growth can trigger scale-out
- your fleet churns on the same message and you burn capacity

With DLQ (maxReceiveCount = 5):

- message is attempted 5 times (over a few minutes, depending on backoff)
- then moved to DLQ
- normal messages proceed

Pseudo-flow:

```text
consume(msg):
  try:
    event = parse(msg)
    validate(event)
    charge(event)
    ack(msg)
  except ParseError or ValidationError:
    send_to_dlq(msg, reason="permanent")
    ack(msg)  # IMPORTANT: don't redeliver forever
  except TransientDependencyError:
    nack_with_backoff(msg)
```

The controversial part is acknowledging after DLQ-ing. It’s the right move: you’re explicitly choosing to remove the poison record from the hot path.

## Tradeoffs: what you gain and what you pay

### DLQ pros

- **Availability:** poison messages stop being system-wide incidents
- **Debuggability:** you get a durable corpus of “weird” events to inspect
- **Safety:** bounded retries limit blast radius on downstream services

### DLQ cons

- **Operational burden:** you now own a workflow for reviewing and acting on DLQ items
- **Risk of “silent failure”:** teams may ignore the DLQ unless alerted
- **Replay complexity:** you need tooling to reprocess messages after a fix

If you add a DLQ but don’t add alerting and a replay path, you’ve just hidden failures.

## Common failure modes (and how to avoid them)

### 1) DLQ becomes a black hole

Symptoms:

- DLQ grows steadily
- nobody reviews it
- you “technically” never lose messages, but you also never fulfill the business action

Fix:

- page on DLQ rate spikes (not just size)
- create an oncall runbook: “top failure types”, “how to replay”, “when to discard”

### 2) No deduplication / idempotency, then replay double-charges

DLQ replay is *reprocessing*. If your handler isn’t idempotent, replay can cause duplicates (double emails, double charges, duplicate writes).

Fix:

- include an idempotency key in the message (or derive one deterministically)
- store a processed-record ledger keyed by `(message_id, handler_version)` or business key

### 3) Retrying permanent failures wastes capacity

If you retry a schema/validation failure 10 times, you’ve just multiplied pain.

Fix:

- validate early
- differentiate parse/validation vs dependency errors
- cap attempts and move on

### 4) Poison message blocks ordering guarantees

If strict ordering matters (e.g., ledger updates), skipping a message is not acceptable.

Fix:

- isolate strict-order streams from “best-effort” streams
- design a compensating mechanism (e.g., send to DLQ, halt the partition, alert humans)
- or represent the strict-order state in a system that supports transactions/constraints

### 5) PII leakage into DLQ

DLQs often end up with raw payloads, stack traces, and headers—exactly the stuff that can contain sensitive data.

Fix:

- treat DLQ storage as production data
- redact sensitive fields before DLQ (or store encrypted pointers)
- lock down access and retention

## How to test this design (before production teaches you)

### Unit tests

- malformed payload → immediate DLQ, acked
- validation failure → DLQ with reason code
- transient dependency failure → retried with backoff

### Integration tests

- simulate downstream 500s, ensure retries don’t exceed your budget
- simulate consumer crash mid-processing, ensure at-least-once behavior doesn’t corrupt state

### Chaos / fault injection

- introduce a poison message into a staging queue and confirm:
  - good messages continue
  - poison message ends in DLQ after N attempts
  - alert fires

## Observability: what to measure in production

If you only track “queue depth,” you’ll miss the story. Track:

- **DLQ enqueue rate** (per reason)
- **retry attempt distribution** (p50/p95 attempts)
- **age of oldest message** (main queue and DLQ)
- **consumer error rate** (by exception type)
- **time-to-resolution** for DLQ incidents (from first DLQ to replay/close)

Also consider a simple SLO:

- “99.9% of messages are processed successfully within 10 minutes”

DLQ backlog is then a first-class SLO risk, not a curiosity.

## Practical links (worth bookmarking)

- AWS SQS Dead-Letter Queues (DLQ) and redrive: https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html
- Kafka docs on delivery semantics (at-least-once / exactly-once context): https://kafka.apache.org/documentation/#semantics
- *Release It!* (Michael T. Nygard) — foundational reliability patterns (circuit breakers, bulkheads, and yes, poison messages): https://pragprog.com/titles/mnee3/release-it-third-edition/

## Closing take

A DLQ isn’t “extra complexity.” It’s admitting reality: in distributed systems, bad inputs and weird states *will* happen. The only question is whether you let them:

- take down the pipeline, or
- get quarantined with enough context to fix and replay safely.

Build the quarantine.
