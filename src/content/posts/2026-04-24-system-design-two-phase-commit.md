---
title: "System Design Daily: Two-Phase Commit"
pubDate: 2026-04-24
description: "When 2PC is the right hammer, why it hurts, and how to operate it without lying to yourself."
tags: ["system-design", "engineering", "distributed-systems", "databases", "transactions"]
---

Most distributed system advice eventually converges on a healthy suspicion of distributed transactions. That suspicion is earned. Two-phase commit, usually shortened to 2PC, is one of those ideas that looks beautifully clean on a whiteboard and immediately starts charging interest in production.

Still, it matters. If you ever need multiple systems to either commit together or abort together, 2PC is the canonical protocol. You should understand it even if your conclusion is, “I would rather redesign the workflow.” That is usually the right conclusion, but not always.

## The problem 2PC tries to solve

Imagine a payment service and a ledger service. A customer transfer should only succeed if:

1. the payment row is marked `captured`, and
2. the ledger entry is written.

If only one happens, your system is now telling two incompatible stories.

A simplified API flow might look like this:

```text
POST /transfers
{
  "from": "acct_A",
  "to": "acct_B",
  "amount": 2500
}
```

Suppose service A updates one database and service B updates another. If A commits and B fails, retries may help, but retries are not a correctness proof. You need a way to coordinate the decision.

That is where 2PC enters.

## Core idea

2PC introduces a **coordinator** and a set of **participants**.

- The coordinator asks every participant if it is prepared to commit.
- If everyone says yes, the coordinator tells them to commit.
- If anyone says no, the coordinator tells them to abort.

The protocol has two phases.

### Phase 1: Prepare

The coordinator sends `PREPARE`.

Each participant does everything needed to make the transaction durable and *committable*, but does not expose the final commit yet. In practice, that usually means:

- validating constraints,
- writing intent to durable storage,
- locking rows or resources that must not change,
- replying `YES` or `NO`.

### Phase 2: Commit or abort

- If every participant replied `YES`, the coordinator writes a durable commit decision and sends `COMMIT`.
- If any participant replied `NO`, or the coordinator decides to give up, it writes `ABORT` and sends `ROLLBACK`.

A tiny pseudo-diagram:

```text
Coordinator      DB-A          DB-B
    |             |             |
    |--PREPARE--->|             |
    |------------>|--PREPARE--->|
    |<---YES------|             |
    |<------------|<---YES------|
    |             |             |
    |--COMMIT---->|             |
    |------------>|--COMMIT---->|
    |<---ACK------|             |
    |<------------|<---ACK------|
```

The value proposition is simple: everybody commits, or nobody does.

## Why teams keep reaching for it

2PC is attractive for real reasons.

### 1. It gives strong atomicity across boundaries

If you truly cannot tolerate split-brain business state, 2PC gives you a crisp rule: one global outcome.

### 2. The mental model is easy

Compared with sagas, compensation logic, and eventually consistent repair workflows, 2PC feels straightforward. There is one decision, one coordinator, one final answer.

### 3. Some infrastructure already supports it

Relational databases, XA-style transaction managers, and a few enterprise integration stacks have built-in primitives for this pattern.

## The part people underprice

The cost of 2PC is not primarily CPU or network. It is **coordination under failure**.

Participants that vote `YES` in phase one are now in a dangerous limbo. They must hold enough state to guarantee they can follow the coordinator's final decision. That usually means locks, transaction state, and waiting.

In other words, 2PC buys correctness by spending availability and latency.

A good rule of thumb is this:

| Property | 2PC usually improves | 2PC usually hurts |
| --- | --- | --- |
| Cross-system atomicity | Yes |  |
| Tail latency |  | Yes |
| Operational simplicity |  | Yes |
| Failure isolation |  | Yes |
| Throughput under contention |  | Yes |

That trade is sometimes worth it. It is often not.

## A small example with numbers

Say you have three participants: inventory, billing, and shipping.

- Prepare round-trip to each service: about 40 ms
- Coordinator durable decision write: 10 ms
- Commit round-trip: about 40 ms

Even before retries, you are around 90 to 120 ms of coordination cost, plus lock hold time, plus variance. If one dependency has a p99 of 500 ms, your global transaction inherits that pain. Add a network blip during phase two and your “quick transaction” becomes a pile of waiting sessions and blocked rows.

That is why 2PC tends to age badly at scale. The algorithm is not broken. Your latency budget is.

## Common failure modes

### Coordinator crash after prepare

This is the classic one. Participants already voted `YES`, so they cannot unilaterally decide to abort without risking inconsistency. They wait for the coordinator's durable decision or for recovery logic to reconstruct it.

This is the famous **blocking** property of 2PC.

### Long-lived locks

Prepared participants often hold locks or reserved capacity while waiting. Under degraded conditions, those locks fan out into queueing, timeouts, and user-visible incidents.

### Heuristic decisions

Some implementations allow operators or participants to make a local “best effort” decision after timeouts. This can restore progress, but now you have traded protocol guarantees for manual inconsistency risk. That is not free. It is just moving the cost to operations.

### Partial acknowledgments in phase two

The coordinator may know the global decision is commit, but some participants might not have received the message yet. Recovery requires replaying the decision until every participant converges.

### Retry confusion at the application layer

If the caller times out and retries while the distributed transaction is still resolving, you can create duplicate attempts unless you pair the workflow with idempotency keys.

## How to think about when 2PC is appropriate

I am a little opinionated here: 2PC is best when the number of participants is small, the failure domains are well understood, and the business invariant is truly strict.

Reasonable cases include:

- tightly controlled internal systems,
- low-latency networks inside one environment,
- operations where compensation would be legally or financially ugly,
- relatively low transaction volume.

Bad cases include:

- internet-spanning microservices,
- flaky downstreams,
- high-throughput hot paths,
- systems that need graceful degradation more than perfect synchrony.

If your architecture document says “we will use 2PC between six microservices and two SaaS APIs,” that is not bravery. That is self-harm.

## What people use instead

The usual alternative is to stop demanding a single cross-system transaction.

Instead, teams use:

- **sagas** for multi-step workflows with compensation,
- **transactional outbox** to atomically persist local state plus an event,
- **idempotent consumers** so retries are safe,
- **reconciliation jobs** to repair drift.

Those patterns are messier conceptually, but they usually preserve availability better and scale with fewer pathological stalls.

2PC is cleaner in theory. The alternatives are often kinder in reality.

## How to test it before production

Do not stop at unit tests. 2PC only gets interesting when things fail at awkward moments.

### Inject failures by phase

Test at least these cases:

1. participant rejects during prepare,
2. coordinator crashes after all `YES` votes but before broadcasting commit,
3. participant crashes after prepare and before commit,
4. network partition during phase two,
5. duplicate `COMMIT` delivery,
6. client timeout while transaction eventually commits.

### Measure lock duration

Prepared state is where the pain hides. Track how long rows, leases, or reservations remain held while waiting for global resolution.

### Load test with contention

2PC can look fine in a happy-path benchmark and then collapse once many requests compete for the same records. Test with real skew, not just uniform random traffic.

## What to observe in production

If you run 2PC, you need visibility into the limbo state.

At minimum, instrument:

- count of in-flight prepared transactions,
- age of oldest prepared transaction,
- prepare success rate by participant,
- commit and abort latency,
- lock wait time,
- recovery replay count,
- coordinator restarts during active transactions.

A simple alert worth having is: **prepared transaction age above threshold**. That usually means one of two things, both bad: the coordinator is unhealthy, or a participant is stuck.

Also log a stable transaction ID everywhere. During incident response, “did we commit or not?” should be answerable from logs and durable state, not from vibes.

## The practical takeaway

2PC is not obsolete. It is just expensive in the exact places distributed systems already hurt: latency, availability, and failure handling.

Use it when you need hard atomicity and can keep the blast radius small. Avoid it when eventual consistency plus repair is acceptable. Most modern architectures should treat 2PC as a specialized tool, not a default pattern.

That may sound less glamorous than “global transaction manager,” but it is the more honest design instinct.

## Further reading

- [Gray, "Notes on Data Base Operating Systems"](https://people.eecs.berkeley.edu/~brewer/cs262/Gray81.pdf)
- [PostgreSQL docs, prepared transactions](https://www.postgresql.org/docs/current/sql-prepare-transaction.html)
- [Martin Kleppmann, *Designing Data-Intensive Applications*](https://dataintensive.net/)
- [Microsoft docs, transaction processing and XA concepts](https://learn.microsoft.com/en-us/previous-versions/windows/desktop/ms686872(v=vs.85))
