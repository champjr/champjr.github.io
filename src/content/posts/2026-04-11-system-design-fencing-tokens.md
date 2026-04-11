---
title: "System Design Daily: Fencing Tokens"
pubDate: 2026-04-11
description: "Why locks are not enough, and how fencing tokens prevent stale leaders from corrupting shared state."
tags: ["system-design", "engineering", "distributed-systems", "coordination", "reliability"]
---

A lot of distributed system bugs start with a sentence that sounds reassuring: “we have a lock.”

Then a node pauses for 40 seconds because of GC, the network gets weird, or a lease expires without the process noticing. Another node correctly takes over. The old node wakes up, still believes it is the leader, and continues writing anyway.

Now you do not have a lock problem. You have a **stale owner** problem.

That is what **fencing tokens** are for.

A fencing token is a monotonically increasing number attached to a lease, lock, or leadership grant. Every time ownership is granted, the system issues a larger token than before. Downstream systems accept operations only from the highest valid token and reject older ones.

My opinionated version is simple: if a stale leader can cause damage, a lease by itself is not enough. You want a fence.

## The problem

Imagine a job processor coordinating access to a shared payments ledger.

- Worker A acquires a lock with token `41`
- Worker A starts processing a batch
- Worker A pauses for 30 seconds during a stop-the-world GC event
- The lease expires
- Worker B acquires the same lock with token `42`
- Worker B continues processing correctly
- Worker A wakes up and resumes writing with stale assumptions

If the ledger accepts both writers, bad things happen:

- duplicate side effects
- out-of-order state transitions
- partially overwritten records
- very confusing audit logs

The important point is that both workers may have behaved “correctly” from their own local perspective. The failure is in the **coordination boundary**.

## Core concepts

### 1. A lock answers “who was allowed?”, not “who is still safe?”

People often treat leases as if they were magical proof of exclusive access. They are not. A lease is only a time-bounded coordination hint.

The dangerous gap is between:

- the coordination system deciding ownership changed, and
- the old owner realizing that fact

That gap shows up during:

- GC pauses
- long scheduler stalls
- network partitions
- delayed packets
- clock weirdness
- overloaded processes that stop renewing on time

Fencing tokens close the gap by moving correctness to the write path.

### 2. The token must be monotonic

Every successful acquisition gets a larger token than the last one:

| Owner | Token |
| --- | --- |
| Worker A | 41 |
| Worker B | 42 |
| Worker C | 43 |

The downstream resource stores or compares the latest token it has seen. If it receives a request with token `41` after already accepting `42`, it rejects it, even if the request otherwise looks valid.

That one rule turns stale leadership from a silent corruption bug into a visible rejected write.

### 3. The resource being protected must enforce the fence

This is the part people skip.

If your lock service hands out tokens but your database, file store, or service does nothing with them, you have built a nice theory and zero protection.

A fencing design only works when the protected system checks something like:

```text
if request.token < current_max_token:
    reject
else:
    accept and update current_max_token
```

The lock service cannot save you if the storage layer blindly trusts old writers.

### 4. Fencing is about ordering authority, not wall-clock time

A token does not need to represent time. It only needs to represent **newer authority**.

That makes fencing much more robust than designs that rely on clocks being perfectly aligned. Real systems should be skeptical of clocks whenever correctness matters.

## A small example

Suppose you have a service that updates inventory reservations.

Pseudo-API:

```http
POST /inventory/reserve
{
  "sku": "chair-42",
  "qty": 2,
  "token": 107
}
```

The inventory store tracks, per reservation stream or partition, the highest token it has accepted.

```text
highest_token_seen = 107
```

Now an old leader sends:

```http
POST /inventory/reserve
{
  "sku": "chair-42",
  "qty": 1,
  "token": 106
}
```

The store rejects it.

That matters because a stale write is often still syntactically correct. The payload may be well-formed, authenticated, and aimed at the right row. Without fencing, nothing distinguishes “valid request from old leader” from “valid request from current leader.”

### Numbers make this clearer

Say lease duration is 15 seconds.

- normal processing time per batch: 200 ms
- p99 GC pause: 8 seconds
- rare worst-case pause during memory pressure: 25 seconds

If you only rely on lease expiry, that 25-second pause is enough to create dual writers. If you use fencing tokens, the old worker can wake up whenever it wants, but its writes still fail after ownership has moved on.

That is exactly the property you want.

## Tradeoffs

### Stronger correctness vs. more integration work

The upside is straightforward: fencing tokens dramatically reduce the chance that stale leaders corrupt state.

The cost is that downstream systems need to participate. That usually means:

- schema changes to persist the last accepted token
- conditional write logic
- API changes to pass the token through
- clearer error handling for rejected stale writes

This is more work than “just renew the lease.” It is also much more honest.

### Centralized counter vs. scoped counters

Some systems use one global monotonically increasing counter. Others issue tokens per resource, partition, or lock name.

A global counter is simple to reason about, but it can become a coordination bottleneck.

Scoped counters scale better, but you must be precise about what the token actually fences. Per-partition fencing is often a good practical middle ground.

### Rejecting stale writes vs. auto-retrying them

Usually, a stale token should cause a hard rejection. Quietly retrying with a new token can blur ownership boundaries and hide bugs.

My bias: stale ownership should be loud. If an operation is no longer authorized by ordering, fail it clearly and let the caller reacquire correctly.

## Common failure modes

### 1. Tokens are generated, but never enforced

This is the fake safety version. The coordination layer hands out nice increasing numbers, logs look impressive, and the storage system ignores them.

Result: stale writers still win sometimes.

### 2. Enforcement happens in the wrong place

If you validate the token at an API gateway but not at the final storage boundary, a delayed internal retry or background worker may still apply an old write.

The fence has to exist at the place where corruption would actually occur.

### 3. Token comparison is not atomic with the write

Suppose your store does:

1. read current token
2. compare request token
3. write data
4. write new token

That sequence can race.

You want a single atomic conditional update when possible, for example:

```sql
UPDATE reservations
SET qty = qty + 2, token = 42
WHERE sku = 'chair-42' AND token < 42;
```

The exact shape varies by database, but the principle is the same: comparison and state change should be one correctness unit.

### 4. Fencing only covers writes, but reads drive bad decisions

Sometimes a stale leader cannot write directly, but it can still make bad control-plane decisions, trigger side effects, or enqueue work based on outdated assumptions.

Fencing protects a specific boundary. You still need to think about where stale authority can do harm.

### 5. Humans confuse lease renewal success with safety

A system may renew most leases successfully and still be vulnerable in the rare cases that matter. Fencing is there for the ugly tail events, not the happy path.

## How to test and observe it in production

Do not trust fencing tokens because the whiteboard says they are correct. Test the exact stale-writer scenario.

### Useful tests

1. **Pause the leader**
   - acquire lock with token `N`
   - freeze or delay the owner longer than the lease duration
   - let a new owner acquire token `N+1`
   - verify the old owner’s write is rejected

2. **Delay packets artificially**
   - inject network latency between workers and storage
   - confirm delayed writes with old tokens do not land late

3. **Crash and replay**
   - replay queued requests from an old process image
   - verify stale writes remain rejected after recovery

4. **Concurrent cutover under load**
   - run normal traffic while leadership changes repeatedly
   - confirm no split-brain writes make it through

### Metrics worth having

- stale-write rejection count
- highest token issued per lock or partition
- lease handoff latency
- token enforcement failures by downstream system
- write conditional-check failures

A healthy system should show occasional rejected stale writes during chaos testing and maybe during rare real incidents. That is not a bug. That is the fence doing its job.

Structured logs help a lot here. Include fields like:

```json
{
  "lock_name": "inventory-partition-7",
  "request_token": 106,
  "highest_seen_token": 107,
  "result": "rejected_stale_owner"
}
```

When an incident happens, you want evidence, not folklore.

## The practical takeaway

Fencing tokens are one of those patterns that look slightly annoying right up until the day they save you from a truly nasty corruption bug.

Leases are useful. Leader election is useful. But neither one, alone, guarantees that an old owner stops acting immediately. Distributed systems are full of pauses, delays, and half-broken assumptions.

A fencing token gives downstream systems a simple question to ask: “is this request from the newest valid owner?”

If the answer is no, reject it.

That is a much better failure mode than silent corruption.

Further reading:

- [Martin Kleppmann, How to do distributed locking](https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html)
- [Apache ZooKeeper Recipes and Solutions: Locks](https://zookeeper.apache.org/doc/current/recipes.html#sc_recipes_Locks)
- [Google Chubby paper](https://research.google/pubs/pub27897/)
- [etcd concurrency API documentation](https://etcd.io/docs/v3.5/dev-guide/api_concurrency_reference_v3/)
