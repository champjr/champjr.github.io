---
title: "System Design Daily: The Saga Pattern (Distributed Transactions Without 2PC)"
pubDate: 2026-03-23
description: "How to coordinate multi-step workflows across services using compensations, timeouts, and good observability."
tags: ["system-design", "engineering", "distributed-systems", "microservices", "reliability"]
---

When you break a system into multiple services, you also break the one thing that made life easy: a single database transaction.

Sooner or later you’ll need a workflow like:

- Create an order
- Reserve inventory
- Authorize payment
- Arrange shipment

…and you’ll want it to be *atomic*. Either everything happens, or nothing happens.

In a single database, that’s a transaction.

Across services, a true ACID transaction usually means **two-phase commit (2PC)**. And 2PC is a great way to turn a few localized failures into a platform-wide incident. It’s coordinator-heavy, blocks resources, and creates “stuck” states that are painful to unstick.

The pragmatic alternative is the **Saga pattern**: model the workflow as a sequence of local transactions, and when something fails, run **compensating actions** to undo (or neutralize) the completed steps.

This post is one focused thing: how sagas work, what you’re trading off, the failure modes you’ll hit in real production, and how to test/observe them so you don’t end up with ghost orders and angry humans.

## Problem framing: what are we actually trying to guarantee?

Sagas don’t give you atomicity. They give you:

- **Consistency over time** (eventual consistency)
- **A clear definition of “done”** vs. “failed” vs. “timed out”
- **A way to recover** without manual DB surgery

The goal is usually:

1. **Don’t lose money or inventory**
2. **Don’t double-charge**
3. **Make “what happened?” explainable**
4. **Make cleanup automatic**

If you need strict atomicity (e.g., moving money between ledgers with legal constraints), a saga may be the wrong tool. But for most product workflows, it’s the right kind of imperfect.

## Core concepts

### 1) Local transaction

Each step is a local ACID transaction inside one service (one database) that moves that service forward.

Example: Inventory service writes a `reservation` row and decrements `available` (or allocates from a pool) in the same DB transaction.

### 2) Saga state

Somewhere, you track:

- Saga ID / correlation ID
- Current step
- Per-step status (started/succeeded/failed)
- Timeouts / retries / deadlines

This can live in an **orchestrator service**, or be distributed across participants (choreography).

### 3) Compensation

A compensation is an action you run *after* a step succeeded, to “undo” it if a later step fails.

Compensation is not necessarily a perfect inverse.

- Payment authorization → compensation: void authorization (easy)
- Payment capture → compensation: refund (not identical; fees, timing)
- Email sent → compensation: “sorry” email (cannot unsend)

A practical mental model:

> Sagas don’t roll back history. They *add more history* to reach a safe end state.

### 4) Idempotency and retries

Sagas assume failure, so they retry. That means every step and every compensation should be **idempotent**.

If you don’t build idempotency, your “recovery” system becomes your “duplicate charge” system.

### 5) Timeouts and deadlines

Sagas that don’t time out become immortal zombies.

Each saga needs:

- A **deadline** (overall)
- Per-step **timeouts**
- A clear rule for what happens at timeout (compensate? mark as pending? escalate?)

## Orchestration vs. choreography

There are two common ways to implement sagas.

### Orchestration (central brain)

An orchestrator tells each service what to do and tracks progress.

Pros:
- Easier to understand end-to-end
- Central place for timeouts, retries, and “what state are we in?”
- Better for complex workflows with branching

Cons:
- Orchestrator becomes critical infrastructure
- You can accidentally create a “god service”

### Choreography (events + reactions)

Each service emits events; other services react.

Pros:
- Loose coupling
- No central coordinator to scale/operate

Cons:
- Harder to debug (“who triggered this?”)
- Failure handling spreads everywhere
- Cycles and edge cases creep in

My opinionated take: **start with orchestration** unless you have a mature eventing platform *and* strong observability discipline. Choreography without excellent tracing is how you get a distributed haunted house.

## A small example (with numbers)

Let’s design a simplified checkout saga.

Requirements:
- Average 200 checkouts/sec
- p99 end-to-end checkout under 2 seconds
- Inventory hold expires in 10 minutes

Steps:
1. `CreateOrder`
2. `ReserveInventory`
3. `AuthorizePayment`
4. `ConfirmOrder`

Compensations:
- If payment auth fails → `ReleaseInventory`
- If inventory reservation fails → `CancelOrder`

Pseudo-API:

```http
POST /checkout
{
  "cartId": "c_123",
  "paymentMethodId": "pm_456"
}

200 OK
{
  "orderId": "o_789",
  "sagaId": "s_abc",
  "status": "PENDING" 
}
```

Key implementation detail: **respond quickly** with `PENDING`, and let the saga complete asynchronously (or block only within a tight deadline and fall back to async).

A simple state machine view:

```text
PENDING
  -> INVENTORY_RESERVED
  -> PAYMENT_AUTHORIZED
  -> CONFIRMED (terminal success)

PENDING
  -> INVENTORY_FAILED -> CANCELED (terminal failure)

INVENTORY_RESERVED
  -> PAYMENT_FAILED -> COMPENSATING -> CANCELED
```

If you attempt to make checkout “synchronously atomic” across services, you’ll either blow your p99 or you’ll quietly create partial failures you can’t explain.

## Tradeoffs (what you’re paying for)

### You trade atomicity for availability

Sagas keep services available under partial failure by allowing progress where possible and recovering later.

The cost: users may observe intermediate states.

### You trade simplicity for explicit state

A single DB transaction is simple because the database hides the messy part.

With sagas, *you* own the messy part:

- state machine
- retries
- timeouts
- compensations

### You trade “rollback” for “business semantics”

Compensations have product meaning.

That’s good: it forces you to define what “undo” means.

It’s also hard: you’ll discover that some actions are irreversible, and you need product rules for them.

## Common failure modes (the stuff that actually hurts)

### 1) The “double execute” problem

A step succeeds, but the response is lost. The orchestrator retries. The service runs it twice.

Mitigation:
- Idempotency key per step: `(sagaId, stepName)`
- Store step result and return it on replay

### 2) Compensation fails (or is delayed)

If compensation is best-effort, you’ll drift.

Mitigation:
- Compensations must be first-class operations with retries and alerting
- Put compensations on a durable queue and track their outcomes
- Build a “repair” job for long-running stuck sagas

### 3) Timeouts that lie

A 2-second timeout doesn’t mean the operation didn’t happen; it means you didn’t hear back.

Mitigation:
- Treat timeouts as **unknown** outcomes
- Query state (or store step state) before deciding to compensate

### 4) Out-of-order events (especially in choreography)

`PaymentAuthorized` arrives before `InventoryReserved` due to retries, partitions, or different consumer lag.

Mitigation:
- Make handlers robust to reordering
- Use a saga state store and accept events only when they make sense

### 5) Orchestrator crash / deploy mid-flight

If your orchestrator forgets the saga, you’ve lost the plot.

Mitigation:
- Persist saga state durably before and after each step
- Make the orchestrator restartable and able to resume

### 6) “Undo” isn’t real

Refunds aren’t the inverse of capture. Releasing inventory after a delay might fail because someone else bought it.

Mitigation:
- Define terminal states that are acceptable: `REFUND_PENDING`, `MANUAL_REVIEW_REQUIRED`
- Put humans in the loop for edge cases, but keep it rare and well-instrumented

## How to test and observe sagas in production

### Observability: treat saga IDs as non-optional

At minimum, propagate:

- `sagaId`
- `orderId` (or business entity ID)
- `step`
- `attempt`

Log fields and tracing attributes should include these so you can answer:

- “Where is saga `s_abc` stuck?”
- “Which step is causing most failures?”
- “How many are compensating right now?”

Recommended metrics:

- `saga_started_total`, `saga_succeeded_total`, `saga_failed_total`, `saga_timed_out_total`
- Per-step latency histograms (p50/p95/p99)
- Retry counts per step
- Compensation rate (if it spikes, something upstream is unstable)

### Testing: you need failure injection, not just unit tests

1. **State machine unit tests**
   - Given step N succeeded, step N+1 fails → ensure compensation plan is correct.

2. **Idempotency tests**
   - Run each step twice with same `(sagaId, step)` and assert no duplicate side effects.

3. **Chaos / fault injection in staging**
   - Drop responses (simulate timeout)
   - Kill orchestrator mid-flight
   - Introduce message duplication and reordering

4. **Replay tests**
   - Re-run “already completed” sagas through the orchestrator to ensure it resumes safely.

### Operational playbooks

Have a boring CLI or admin endpoint:

- “Show saga state by ID”
- “Retry step”
- “Force compensate”
- “Mark as terminal + reason”

If you don’t build these, you will eventually do the same thing manually in a SQL console at 2:00am. That’s how people get hurt.

## Practical links (worth reading)

- Microservices.io (Chris Richardson) — Saga pattern overview: <https://microservices.io/patterns/data/saga.html>
- Martin Fowler — Patterns for distributed systems thinking (a good rabbit hole): <https://martinfowler.com/articles/patterns-of-distributed-systems/>
- Microsoft — Cloud Design Patterns (general reliability patterns that pair well with sagas): <https://learn.microsoft.com/azure/architecture/patterns/>
- "Designing Data-Intensive Applications" (Kleppmann) — background on distributed failure reality: <https://dataintensive.net/>

## Closing thought

A saga is a contract with reality: networks are flaky, services fail independently, and “atomic across services” is a fantasy unless you’re willing to pay the 2PC tax.

Design the workflow as a state machine, make every step and compensation idempotent, put deadlines everywhere, and invest in the observability to explain what happened.

Do that, and sagas stop being scary. They become what they really are: a disciplined way to build reliable business workflows on unreliable components.
