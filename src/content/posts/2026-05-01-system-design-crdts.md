---
title: "System Design Daily: CRDTs for Multi-Writer Systems"
pubDate: 2026-05-01
description: "When many replicas can accept writes, CRDTs give you a way to merge state without begging for a lock server first."
tags: ["system-design", "engineering", "distributed-systems", "data", "reliability", "consistency"]
---

A lot of distributed systems tutorials quietly assume a comforting rule: one place accepts writes, everyone else catches up later. Real systems are messier. Mobile clients go offline. Regions split from each other. Collaborative apps let multiple users edit at once. Edge nodes accept writes because waiting for a central leader would feel awful.

Once you allow **multiple writers**, the ugly question shows up immediately: what happens when two copies of the same data diverge?

You can serialize everything through a leader. You can reject concurrent edits. You can make users deal with merge conflicts. Sometimes those are the right answers. But sometimes the better answer is to choose a data model that is designed to merge safely.

That is where **CRDTs**, or **Conflict-Free Replicated Data Types**, earn their keep.

My opinionated take: CRDTs are not magic, and they are definitely not free, but they are one of the few tools in distributed systems that let you say, with a straight face, “yes, replicas can accept writes independently, and no, we do not need a coordinator for every merge.”

## The problem framing

Imagine a globally distributed "likes" service for articles. Users can like or unlike an article from phones, laptops, or web sessions. Some requests hit us-east, some hit eu-west, and some arrive after a device has been offline for minutes.

If each region keeps a local counter and later tries to reconcile by last-write-wins, you can lose updates. If two regions both increment from 10 to 11, and later one write overwrites the other, you end up with 11 instead of 12.

That is the core problem. In a multi-writer system, **concurrent updates are normal**, not exceptional.

```text
client A -> region us-east  : like(article-42)
client B -> region eu-west  : like(article-42)

both regions accept locally
both replicate later

naive merge: one side wins
correct result: count should reflect both likes
```

CRDTs give you data structures whose merge rules are mathematically designed so replicas can converge even when updates arrive out of order, are duplicated, or are replayed later.

## Core concepts

A CRDT is a replicated data type with a merge strategy that guarantees eventual convergence, assuming all updates are eventually delivered.

The useful properties are usually described like this:

- **Commutative**: applying updates in different orders leads to the same result
- **Associative**: grouping merges differently does not change the result
- **Idempotent**: replaying the same update does not keep changing the state

That combination matters because real distributed systems are full of duplicates, reordering, and retries.

There are two broad families.

### Operation-based CRDTs

Replicas send operations such as `increment`, `add(user123)`, or `remove(item9)`. This can be efficient, but usually requires stronger guarantees around message delivery and deduplication.

### State-based CRDTs

Replicas periodically exchange full or partial state and merge it with a deterministic rule. This is easier to reason about operationally, but state can grow large.

For teaching purposes, state-based CRDTs are the cleaner mental model.

### A simple example: the G-Counter

A **grow-only counter** tracks one slot per replica.

```text
us-east: [3, 0, 0]
eu-west: [0, 5, 0]
ap-south:[0, 0, 2]
```

The total is the sum: `3 + 5 + 2 = 10`.

If us-east processes another increment, it becomes `[4, 0, 0]`. When two replicas merge, they take the element-wise maximum.

```text
merge([4,0,0], [3,5,0]) = [4,5,0]
```

Total is now `9` across those two states, and no increment got lost.

This works because each replica only increases its own component, and merge never subtracts information.

### More practical CRDTs

Common examples include:

- **G-Counter**: only increments
- **PN-Counter**: increments and decrements using two grow-only counters
- **G-Set**: only additions
- **OR-Set**: add/remove set that tracks element identities carefully
- **LWW-Register**: last-write-wins register, simple but easy to misuse

That last one deserves a warning. People hear “CRDT” and think all conflict resolution suddenly becomes correct. It does not. A last-write-wins register is technically convenient, but it throws away concurrent intent. For user-edited text, shopping carts, counters, or permissions, that is often the wrong trade.

## A small example

Suppose three regions each accept reactions for a post. We model reaction count as a PN-Counter.

```text
increments:
  us-east: 120
  eu-west: 95
  ap-south: 40

decrements:
  us-east: 8
  eu-west: 4
  ap-south: 1
```

Displayed count is:

```text
(120 + 95 + 40) - (8 + 4 + 1) = 242
```

Now imagine eu-west is partitioned for 10 minutes. It keeps accepting writes locally, then rejoins. After state exchange, the merge takes the max for each region's increment and decrement components. The final answer converges without a distributed lock and without replaying a fragile global transaction log.

A simplified API might look like this:

```text
POST /posts/42/reactions/like
POST /posts/42/reactions/unlike
GET  /posts/42/reactions
```

Internally, each write updates the local replica's CRDT component and asynchronously replicates to peers.

## Tradeoffs

CRDTs solve a specific class of problems very well, but they charge rent.

| Tradeoff | Upside | Cost |
| --- | --- | --- |
| Multi-writer availability | Replicas can accept local writes during partitions | More complex data modeling |
| Coordinator-free merge | No central lock or leader needed for each update | Metadata can grow fast |
| Eventual convergence | Order, retries, and duplicates are less scary | Reads may be temporarily stale |
| Local latency | Good fit for offline and geo-distributed apps | Not every business rule fits a CRDT |

The biggest practical lesson is this: **CRDTs work best when the product semantics already tolerate eventual consistency.**

Good fits:

- likes, reactions, and counters
- collaborative presence or cursors
- tags, memberships, or shopping-cart-ish sets
- offline-first note metadata

Bad fits, or at least dangerous fits:

- bank balances without stronger invariants
- inventory when oversell is unacceptable
- permission revocation where delay is a security problem
- workflows that require a single global order

## Common failure modes

### 1. Picking last-write-wins because it sounds easy

LWW registers are seductive. Add a timestamp, pick the latest, call it distributed systems. Then users lose data because two edits happened concurrently and one vanished. That is not convergence, that is silent discard.

### 2. Ignoring metadata growth

Some CRDTs keep tombstones, per-replica vectors, or unique tags for adds and removes. In long-lived systems, that metadata can become the real dataset.

If you never plan compaction, pruning, or replica-ID lifecycle management, the design will age badly.

### 3. Assuming eventual delivery means quick delivery

CRDTs promise convergence eventually, not immediately. During partitions or backlog spikes, different replicas can show different answers for longer than product teams expect.

That means UI and API semantics still matter. “Saved locally, syncing” is often more honest than pretending the world is instantly unified.

### 4. Using CRDTs where invariants matter more than availability

A CRDT can merge counts elegantly while still violating business reality. If you have exactly one hotel room left, “we will converge later” is not a satisfying inventory strategy.

### 5. Forgetting removal semantics are harder than add semantics

Sets with remove support are trickier than they look. If one replica removes `item7` while another concurrently adds it, what should win? The answer depends on the CRDT flavor, and your product team should actually agree with that answer.

## How to test and observe in production

If you adopt CRDTs, test the merge behavior harder than the happy path.

### Test for adversarial delivery

Build tests that intentionally:

- reorder updates
- duplicate updates
- delay one replica for minutes
- partition replicas and rejoin them later
- replay old state snapshots

The key assertion is not just “system stayed up.” It is “all replicas converged to the same valid value.”

### Verify algebraic properties

For critical CRDT types, property-based tests are worth it. Generate random update streams and prove, in code, that merge is commutative, associative, and idempotent.

That sounds academic until it saves you from a deeply embarrassing production bug.

### Observe convergence lag

Track how long replicas take to converge after an update. Useful production signals include:

- replication delay between regions
- count of divergent replicas per object class
- size of CRDT metadata per key or shard
- tombstone growth rate
- merge conflict rate by type, even if merges are automatic

### Sample for semantic correctness

Do not only monitor transport-level health. Sample real objects and validate business expectations.

Examples:

- reaction counts match expected totals after delayed sync
- offline edits eventually appear on all devices
- removed items do not resurrect after replay

## The practical rule

CRDTs are worth considering when you need three things at once:

1. more than one place can accept writes
2. coordination is too expensive or unavailable
3. the data can be modeled with merge-friendly semantics

If those three are not true, a simpler design is usually better.

That is the part people sometimes skip. CRDTs are not a badge of sophistication. They are a specialized tool for a specific problem shape. But when the shape matches, they are excellent.

And in distributed systems, “excellent” usually means something boring and precious: the system keeps accepting useful work, and later all the copies agree on what happened.

## Further reading

- [A comprehensive study of Convergent and Commutative Replicated Data Types](https://hal.inria.fr/inria-00555588/document)
- [CRDTs illustrated by Martin Kleppmann](https://martin.kleppmann.com/papers/crdt-tutorial-paipo17.pdf)
- [Automerge documentation](https://automerge.org/)
- [Riak Data Types](https://docs.riak.com/riak/kv/latest/developing/data-types/index.html)
