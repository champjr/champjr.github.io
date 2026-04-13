---
title: "System Design Daily: Watermarks and Late Data"
pubDate: 2026-04-13
description: "How stream processors decide when a result is ready, and what to do when reality delivers events late."
tags: ["system-design", "engineering", "distributed-systems", "stream-processing", "data-infrastructure"]
---

A lot of teams say they want “real-time analytics” when what they really want is **correct-enough answers quickly, without waiting forever for stragglers**.

That is the real job of **watermarks**.

If you process event streams, sooner or later you hit this uncomfortable fact: event time and arrival time are not the same thing. Mobile clients go offline. Brokers retry. Producers batch. Clocks drift. An event that *happened* at 10:01 may not show up until 10:07.

So when should a system publish the result for the 10:00 to 10:05 window? Immediately at 10:05? Wait five extra minutes? Keep the window open forever just in case?

None of those answers is universally right. Watermarks are the mechanism that lets you make a sane tradeoff.

## The problem

Suppose you are computing rides per 5-minute window for a dispatch app.

```text
Window: 10:00-10:05
Events by event time: 100 rides
Events that arrived by 10:05: 92 rides
Events that arrived by 10:07: 99 rides
Events that arrived by 10:15: 100 rides
```

If you close the window strictly at 10:05, you are fast but wrong.
If you wait until 10:15, you are more correct but much less useful.
If you wait forever, you have built a historian, not a real-time system.

This is why stream systems separate:

- **event time**: when the event actually happened
- **processing time**: when your system saw it
- **watermark**: your system’s current estimate of how complete event time is

A watermark is basically a claim like:

> “I do not expect to see many more events earlier than timestamp T.”

That wording matters. A watermark is not a guarantee. It is a confidence boundary.

## Core concepts

### 1. Watermarks are progress signals, not clocks

People often misread watermarks as fancy timestamps. They are more useful than that.

A watermark tells downstream operators how far event-time progress has advanced. If the watermark is 10:05, the system is saying that windows ending at or before 10:05 are probably ready to emit.

“Probably” is doing a lot of work there.

Good systems treat watermarks as an operational estimate, not divine truth.

### 2. Late data is normal, not an edge case

Late events are not evidence your pipeline is broken. They are evidence that distributed systems exist.

Events arrive late because of:

- mobile or edge disconnections
- upstream batching
- queue retries
- backpressure
- cross-region latency
- producer clock weirdness

If your design assumes perfectly ordered arrival, you do not have a robust streaming design. You have a demo.

### 3. Windows need a policy for finality

Once you window data, you need to answer two questions:

- when do I emit an initial result?
- what do I do if more data for that window arrives later?

That usually leads to some combination of:

- **on-time result** when the watermark passes the window end
- **allowed lateness** for a bounded correction period
- **late updates** that revise prior output
- **drop policy** for events that are too late to matter

Here is a simple model:

| Policy | What it buys you | What it costs |
| --- | --- | --- |
| Emit early | Fresh dashboards | More corrections later |
| Wait longer | Better accuracy | Higher latency |
| Allow late updates | Better eventual correctness | More downstream complexity |
| Drop very late data | Bounded state and simpler ops | Some permanent inaccuracy |

### 4. Triggers decide when results are emitted

Watermarks alone are not enough. You also need a rule for **when to produce output**.

A common setup is:

- emit once when watermark passes end-of-window
- keep window state for 10 more minutes
- emit corrected results if late events arrive during that period
- discard anything later than that

That is a practical design because it makes the tradeoff explicit instead of pretending there is no tradeoff.

## A small example

Imagine a metrics pipeline counting checkouts per minute.

```text
Window W = 12:00:00 to 12:00:59
Allowed lateness = 2 minutes
```

At 12:01:10, the watermark reaches 12:00:59, so the system emits:

```json
{ "window": "12:00", "checkouts": 480, "final": false }
```

Then 11 delayed events for 12:00 arrive at 12:02:05. Because they are within allowed lateness, the system emits a correction:

```json
{ "window": "12:00", "checkouts": 491, "final": true }
```

At 12:05, another event for 12:00 appears. It is now outside allowed lateness, so the system either drops it, sends it to a side output, or records it in an audit path.

That behavior is much healthier than silently mixing late events into already-consumed results with no visibility.

## Tradeoffs

### Low latency vs. stable results

This is the main tradeoff.

Aggressive watermarks make dashboards feel fast, but they also increase the number of result revisions. Conservative watermarks reduce churn, but users wait longer.

For user-facing dashboards, a little correction is often acceptable. For billing, compliance, or settlement, it usually is not.

### Simpler consumers vs. better correctness

If downstream systems cannot handle updates, you are forced toward waiting longer before emitting. That simplifies consumers but pushes latency upstream.

If consumers *can* handle revisions, you can publish earlier and converge later. That is often the better engineering choice, but only if you are honest about update semantics.

### Bounded state vs. historical completeness

Keeping windows open forever is a state-retention bug wearing a correctness costume.

Allowed lateness should be driven by observed data distributions and business value. If 99.9% of relevant events arrive within 7 minutes, holding 24 hours of state for every hot key is probably wasteful.

## Common failure modes

### 1. Confusing watermark time with wall-clock time

The watermark for 10:05 may not be reached at 10:05 in real life. Under backlog or skew, it may arrive much later. If operators assume otherwise, they will misread the entire system.

### 2. One global watermark for very uneven sources

If one partition or source is slow, a naive global watermark can stall everyone else. This is why stream processors spend so much effort on per-partition progress and watermark alignment.

### 3. Hiding corrections from downstream consumers

If results can be revised, make that visible. Use upserts, versioned outputs, or an explicit `final` field. Quiet corrections are how teams lose trust in their dashboards.

### 4. No policy for ultra-late events

You need a deliberate answer for “too late.”

Usually the options are:

- drop and count it
- send to a side channel for audit/replay
- backfill offline later

Pretending ultra-late data will never happen is not a strategy.

## How to test and observe it in production

I would test a streaming system with late data long before I worried about fancy throughput benchmarks.

Start with deterministic scenarios:

- in-order events
- mildly out-of-order events
- one slow partition
- a burst of late arrivals after watermark advance
- events beyond allowed lateness

Then verify:

- when windows first emit
- how often they are revised
- whether counts converge as expected
- whether dropped-late events are visible in metrics

In production, the useful metrics are usually:

- **watermark lag**: wall clock minus watermark time
- **late-event rate**
- **number of window revisions**
- **dropped-too-late count**
- **state size / retention pressure**
- **per-partition watermark skew**

A nice practical alert is not “pipeline is broken,” but something like:

> watermark lag for source X is 8 minutes above baseline, and late-event rate doubled

That gives operators a real debugging path.

## The practical opinion

Most teams get into trouble by being fuzzy about finality.

Say the contract out loud.

Are results provisional until a watermark passes? Can they still change for 10 minutes? Are some consumers reading upserts while others only read final snapshots?

Once you make that explicit, watermarks stop feeling magical. They become what they really are: a tool for negotiating between **speed, cost, and correctness** in a world where events do not arrive in the order you wish they would.

That is good system design. Not pretending reality is neat, but choosing how your system behaves when it is not.

## Further reading

- [Apache Beam: The Beam Model Basics](https://beam.apache.org/documentation/basics/)
- [Apache Flink Docs: Event Time and Watermarks](https://nightlies.apache.org/flink/flink-docs-release-1.20/docs/concepts/time/)
- [The Dataflow Model paper](https://research.google/pubs/pub43864/)
