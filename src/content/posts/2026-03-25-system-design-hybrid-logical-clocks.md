---
title: "System Design Daily: Hybrid Logical Clocks (Ordering Events When Time Lies)"
pubDate: 2026-03-25
description: "Why wall clocks betray distributed systems, and how HLCs give you a practical event order without needing perfect time sync."
tags: ["system-design", "engineering", "distributed-systems", "databases", "consistency"]
---

Distributed systems learn quickly: **time is not a reliable shared truth**.

You want to answer questions like:

- “Which write happened last?”
- “Is this read causally consistent?”
- “Did this job run before that job?”
- “Can I safely apply this update, or is it stale?”

…and your first instinct is to slap a timestamp on things.

Then reality shows up: clocks drift, NTP can step time, VMs pause, and suddenly your “ordering” is fiction.

Today’s topic is **Hybrid Logical Clocks (HLCs)**: a practical, widely-used way to order events in distributed systems that combines the best parts of **physical time** (roughly matches real time) and **logical time** (preserves causality).

## Problem framing: “just use timestamps” breaks in subtle, painful ways

The naive strategy for ordering is **Last-Write-Wins (LWW)** by wall-clock timestamp:

- every write gets `updatedAt = now()`
- the biggest timestamp wins

That seems fine… until one node’s clock is wrong.

### A tiny example

Two replicas, A and B:

- A’s clock is **5 minutes fast**.
- B’s clock is correct.

A client writes:

1. at real time 13:00:00, write `value=1` to **A** → A stamps it `13:05:00`
2. at real time 13:01:00, write `value=2` to **B** → B stamps it `13:01:00`

If you do LWW, `value=1` “wins” forever because `13:05:00 > 13:01:00`.

You now have **data loss caused by clock skew**. Not a crash. Not a partition. A slightly wrong clock.

So you reach for logical clocks.

## Core concepts: physical vs logical vs hybrid

### Physical clocks (wall time)

Pros:
- human-friendly
- matches “real” time (usually)
- good for TTLs, dashboards, compliance reporting

Cons:
- can go backwards
- skew between nodes breaks ordering

### Logical clocks (Lamport clocks)

Lamport’s idea: represent time as a counter that only moves forward.

Rules:
- each local event increments a counter
- messages carry the counter
- on receive: `counter = max(counter, receivedCounter) + 1`

Pros:
- never goes backwards
- gives a consistent “happened-before” style ordering

Cons:
- has no relation to real time
- you can’t easily answer “about when did this occur?”

Reference: Lamport’s classic paper, *Time, Clocks, and the Ordering of Events in a Distributed System*.

### Hybrid Logical Clocks (HLC)

An HLC timestamp is typically a pair:

- `pt`: a physical-time component (e.g., milliseconds since epoch)
- `lc`: a logical counter to break ties and preserve causality

You can think of it as:

- “Use wall clock when it’s safe.”
- “When causality demands you be later than something you observed, bump the logical part.”

A common representation is `(pt, lc)` and the ordering is lexicographic:

- `(pt1, lc1) < (pt2, lc2)` if `pt1 < pt2`, or `pt1 == pt2 && lc1 < lc2`.

### The update rules (intuitively)

On a local event:

- `pt = max(localWallTime, pt)`
- if wall time didn’t advance, increment `lc`

On receiving a message with `(pt_m, lc_m)`:

- set `pt = max(localWallTime, pt, pt_m)`
- if `pt == pt_m` (or more generally, if you had to “catch up” to the message time), increase `lc` so the new timestamp is strictly greater than what you observed

That’s enough to guarantee:

- monotonic timestamps per node
- if event X causally precedes event Y via messaging, then `HLC(X) < HLC(Y)`
- timestamps remain close-ish to wall clock when the world is behaving

This is why HLC shows up in real systems (notably some distributed databases).

## Where HLC fits

HLC is a sweet spot when you want **(1) causality-safe ordering** and **(2) timestamps that still look like time**.

It’s *not* a substitute for serializability or a guarantee of real-time ordering across machines—if you need that, look at stronger time models (e.g., Spanner’s TrueTime).

## Tradeoffs: what you’re buying with HLC

### Benefits

1. **Causality without perfect clocks**
   - You get a safe ordering that respects message flow.

2. **Human-ish time**
   - `pt` tracks wall time most of the time, so logs/metrics don’t become alien.

3. **Simple comparison**
   - A total order (lexicographic) is easy to store and compare.

### Costs / risks

1. **You still care about clock quality**
   - HLC softens clock issues; it doesn’t make them irrelevant.
   - If a node’s wall clock jumps far into the future, `pt` can jump too.

2. **You can accumulate “logical debt”**
   - If you frequently receive timestamps ahead of your wall time, the logical counter will do extra work.

3. **Storage/format complexity**
   - It’s not just “a timestamp.” You have a composite value with ordering semantics.

In practice, store HLC as `(pt, lc)` (two integers) and expose a debug string form so humans can reason about it.

## Common failure modes (the stuff that bites you in prod)

### 1) A node’s clock jumps forward by minutes/hours

Symptoms:
- events from that node appear “in the future”
- LWW-style conflict resolution becomes biased toward that node

Mitigations:
- alert on clock offset and time steps
- consider capping acceptable future `pt` drift and quarantining the node
- prefer slewing (gradual correction) over stepping when configuring time sync

### 2) Using HLC as a “truthy commit time”

If you show users “this happened at 13:02:03” based on `pt`, you’re implying real-world time.

That’s usually fine for UI, but don’t use it for compliance or payment timing guarantees unless you have a stronger time source and a defined bound.

### 3) Confusing total order with causality

HLC gives you a total order, but that doesn’t mean it’s a real-time order. Two concurrent events will still be arbitrarily ordered.

If your algorithm assumes “ordered means dependent,” you’ll invent phantom causality.

### 4) Mixing multiple time domains

Watch out when some parts of your system use:

- wall timestamps
- Lamport counters
- database commit timestamps
- Kafka offsets

Pick one “ordering primitive” per domain and document how to translate (or don’t translate at all).

## How to test and observe HLC behavior in production

### Instrumentation to add

- **clock offset metric** (NTP/chrony offset) per node
- **time step events** (did the clock jump backwards/forwards?)
- **HLC logical counter rate**: how often `lc` increments because wall time didn’t advance
- **received timestamp lead**: distribution of `(pt_m - localWallTime)` on message receive

If you see a node regularly receiving timestamps far ahead of its wall time, that node is either:

- badly out of sync, or
- paused/suspended, or
- in a different time domain (container clock issues happen)

### Chaos tests worth doing

1. **Skew injection**: run a replica with +30s and -30s skew, then perform concurrent updates.
2. **Pause/resume**: suspend a VM/container for 60s, then rejoin and observe HLC catch-up.

The goal isn’t just “it doesn’t crash.” The goal is “it doesn’t silently pick the wrong winner.”

## A concrete mini-design: conflict resolution with HLC

Suppose you have a replicated key-value store and you want a simple conflict rule:

- accept an update if its HLC is greater than the stored HLC

Pseudo-API:

```http
PUT /kv/{key}
Body: { value: "...", hlc: "(pt,lc)", nodeId: "A" }
```

Write path (simplified):

1. client sends `PUT` to any replica
2. replica assigns `hlc_new = tick()`
3. replica stores `(value, hlc_new)` locally
4. replica replicates `(key, value, hlc_new)` to peers

Apply rule on peers:

- if `hlc_new > hlc_stored`, overwrite
- else ignore as stale

ASCII sketch:

```text
client
  |
  | PUT key=x
  v
Replica A ----replicate----> Replica B
 (tick HLC)                   (compare HLC)
```

This is intentionally not “the world’s best database.” It’s a clear illustration:

- With wall clocks, skew can cause permanent wrong winners.
- With HLC, you keep the “timestamp wins” simplicity but remove a big class of skew-induced corruption.

## Good references (worth bookmarking)

- Leslie Lamport: *Time, Clocks, and the Ordering of Events in a Distributed System* (1978)
  - https://lamport.azurewebsites.net/pubs/time-clocks.pdf
- Google Spanner paper (TrueTime for external consistency)
  - https://research.google/pubs/pub39966/
- CockroachDB docs/blog on Hybrid Logical Clocks (practical implementation notes)
  - https://www.cockroachlabs.com/docs/stable/architecture/transaction-layer.html#hybrid-logical-clocks

## Closing opinion

Wall-clock timestamps are fine for *display*, but they’re a trap for *correctness*. HLC is a boring upgrade that prevents a whole class of skew-induced “last write wins” corruption. Use it for ordering, and still monitor clock health like it matters—because it does.
