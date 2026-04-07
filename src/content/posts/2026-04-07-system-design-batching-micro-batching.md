---
title: "System Design Daily: Batching and Micro-Batching"
pubDate: 2026-04-07
description: How grouping work improves throughput, where the latency bill shows up, and how to keep batch systems from turning into mystery meat.
tags: ["system-design", "engineering", "distributed-systems", "performance", "architecture"]
---

A lot of systems get faster not by doing less work, but by being less dramatic about *when* they do it.

That is batching in a sentence.

Instead of paying fixed overhead for every single request, event, write, or network hop, you group multiple units of work together and amortize the cost. Sometimes that means a worker flushes 500 records to storage at once. Sometimes it means a queue consumer waits 50 milliseconds and processes 100 messages together. Sometimes it means a client sends one bulk API call instead of 200 tiny ones.

This is one of the most useful ideas in system design because it shows up everywhere: storage engines, stream processors, indexing pipelines, notification systems, metrics pipelines, log ingestion, and even seemingly synchronous APIs.

My opinionated take: **batching is one of the easiest ways to buy throughput, and one of the easiest ways to accidentally hide latency, fairness problems, and giant failure domains**. It is a power tool. Keep your fingers.

## The problem framing

Imagine an event ingestion service that receives 20,000 analytics events per second.

Each event eventually needs to be written to object storage and indexed for querying.

If you process each event individually, you pay the fixed cost of:

- parsing and validation
- a network call to storage or the next service
- metadata overhead per write
- context switching in workers
- acknowledgements and bookkeeping per message

Even if each event is tiny, the overhead around the event often is not.

Suppose one write call has:

- 4 ms of fixed overhead
- 0.02 ms of per-event work

If you write events one by one, 1,000 events cost roughly:

- `1000 * (4 + 0.02) ms = 4020 ms`

If you batch 100 events per write, the same 1,000 events cost roughly:

- `10 * 4 ms + 1000 * 0.02 ms = 60 ms`

That is not a rounding error. That is the difference between a system that melts and a system that breathes normally.

So the case for batching is obvious. The catch is that the system now *waits* to form batches. That waiting time is latency, and users notice latency faster than they notice your beautiful throughput graph.

## Core concepts

### Batching vs. micro-batching

**Batching** usually means collecting work until some threshold is reached, then processing it as a group.

Common thresholds:

- number of items, like 500 messages
- total size, like 8 MB
- time window, like every 1 second
- any combination of the above

**Micro-batching** is the same idea with much smaller time windows, often tens or hundreds of milliseconds, so the system gets some efficiency gains without looking obviously asynchronous.

Examples:

- a metrics agent flushing every 10 seconds: batching
- a stream processor grouping records every 100 ms: micro-batching
- a bulk insert every 1,000 rows or 50 ms, whichever comes first: micro-batching

The difference is not philosophical. It is mainly about how much latency the product can tolerate.

### Fixed cost amortization

Most systems have a fixed cost per operation.

That cost might be:

- opening a transaction
- a TLS handshake or network round trip
- a syscall
- lock acquisition
- object allocation
- updating a WAL or index structure

Batching spreads that fixed cost across more useful work.

That is why databases support bulk inserts, queues support prefetch, search engines support bulk indexing, and cloud APIs often have bulk endpoints. The math keeps winning.

### Triggers and flush conditions

Healthy batch systems almost never rely on just one trigger.

A practical design usually flushes when **any** of these happens:

- item count exceeds a limit
- byte size exceeds a limit
- oldest item age exceeds a limit
- downstream pressure or memory pressure says “flush now”

That “whichever comes first” rule matters because traffic is rarely stable. High traffic fills count thresholds quickly. Low traffic may never fill them, so time-based flushes protect tail latency.

### Acknowledgement boundary

This is where batch designs get subtle.

If a worker consumes 200 messages and writes them in one database transaction, when do you acknowledge success?

Options include:

1. acknowledge only after the entire batch commits
2. acknowledge per item after individual success tracking
3. split the batch into sub-batches with separate commit points

Each option changes your duplicate behavior, retry cost, and blast radius on failure.

## A small example

Say you run a notification fanout service.

Each incoming event creates push notifications for followers. Traffic pattern:

- average: 3,000 fanout jobs/sec
- spikes: 25,000 jobs/sec during live events
- downstream push provider prefers requests up to 500 notifications at a time

A worker design might look like this:

```text
while true:
  collect up to 500 notifications
  or stop waiting after 75 ms
  group by provider + app + priority
  send bulk request
  mark successful tokens
  retry failures individually or in smaller groups
```

That gives you a sane compromise:

- enough batching to cut request overhead
- a 75 ms cap so low-volume traffic does not wait forever
- grouping by destination so one bad provider response does not poison unrelated work

## Tradeoffs

Here is the whole game in a table:

| Choice | Benefit | Cost |
| --- | --- | --- |
| Larger batches | Better throughput, lower per-item overhead | More waiting, bigger retries, worse fairness |
| Smaller batches | Lower latency, smaller blast radius | Higher overhead, more downstream calls |
| Time-based flushing | Predictable max waiting time | Can produce undersized batches during quiet periods |
| Count-based flushing | Efficient at high traffic | Tail latency gets ugly at low traffic |
| Single giant transaction | Simpler correctness model | Failure repeats more work |
| Per-item tracking inside a batch | Better recovery | More bookkeeping and complexity |

The recurring tradeoff is simple: **batching converts overhead into latency and coupling**.

That can be a fantastic trade when the workload is internal, high-volume, and tolerant of slight delay. It can be a terrible trade for user-facing writes that need instant confirmation.

## Common failure modes

### 1. Batch size slowly grows until it becomes a liability

Teams often start with “let’s batch 100 items.” Traffic increases, and someone pushes it to 1,000, then 5,000, because throughput graphs look great.

Then one failed batch causes huge retry storms, memory spikes, long GC pauses, or transaction lock contention.

A batch should be big enough to amortize overhead, not so big that failure becomes theatrical.

### 2. Head-of-line blocking

If one slow or malformed item can hold a whole batch hostage, you have built a convoy system.

This happens when:

- a single poison message causes the full batch to retry
- one tenant with giant payloads delays everyone else
- batches mix “fast path” and “slow path” work together

Segmentation helps. Batch by tenant, destination, priority, or payload class when those dimensions have different performance behavior.

### 3. Low-traffic latency surprises

Batch systems often look excellent in load tests and annoying in real life.

Why? Because the test environment is busy enough to fill batches instantly, while real traffic at 2:13 AM is not.

A “batch of 1,000” may actually mean “wait 4 seconds for enough work to arrive.”

This is why max-age flush thresholds matter so much.

### 4. Invisible backlogs

Batch pipelines hide pain well. A worker can look healthy while quietly increasing wait time before flush.

Throughput might remain high even as end-to-end freshness gets worse.

That is how teams end up saying “the system is processing fine” while users are asking why their dashboard is 12 minutes behind.

### 5. Partial success ambiguity

Suppose a bulk API returns:

- 470 items accepted
- 20 rate-limited
- 10 permanently invalid

If your retry logic treats that as one undifferentiated failure, you either drop good work or duplicate it. Bulk systems need per-item result handling even when the request itself is batched.

## How to test it

Do not just benchmark peak throughput. That is the least surprising metric.

Test these instead:

### Traffic-shape tests

Run with:

- steady high volume
- bursty traffic
- low trickle traffic
- mixed payload sizes

You want to know whether your flush policy behaves well at midnight, not just at noon.

### Failure injection

Simulate:

- one bad item inside an otherwise healthy batch
- downstream 429s or 5xxs on bulk calls
- commit success followed by ack failure
- worker restarts during flush
- memory pressure while accumulating batches

This tells you whether retries are bounded or whether you built a duplication cannon.

### Fairness tests

Make sure one noisy tenant or one hot partition cannot consume all available batch capacity.

A system can be efficient overall and still be unfair in a way your largest customers will notice immediately.

## What to observe in production

If you run batch systems, I would track these before I tracked anything fancy:

- batch size distribution: p50, p95, max
- oldest item age at flush
- queue wait time before processing
- end-to-end latency from item arrival to durable success
- retry rate by batch and by item
- partial success rate on bulk calls
- batch failure blast radius: items retried per failed flush
- memory held by in-flight buffers

A useful mental model is that batch systems have **two latencies**:

1. processing latency after work starts
2. waiting latency before work starts

Teams monitor the first one and forget the second one. The second one is often where the real user pain lives.

## The practical rule

If I had to reduce this topic to one rule, it would be:

**batch aggressively on internal boundaries, batch carefully on user-facing boundaries.**

Users do not care that you saved 40% on RPC overhead if their write, notification, or dashboard update now feels mushy.

But inside your system, where slight delay is acceptable, batching is one of the best levers you have. Just give it guardrails:

- cap age, not just size
- cap blast radius, not just throughput
- design for partial success
- isolate slow classes of work
- monitor queue age, not just worker utilization

That is the boring truth about batching. It is not a trick. It is not magic. It is disciplined laziness: wait just long enough to be efficient, but not long enough to become someone else’s problem.

## Further reading

- [Designing Data-Intensive Applications — Martin Kleppmann](https://dataintensive.net/)
- [Apache Kafka Producer Configs](https://kafka.apache.org/documentation/#producerconfigs)
- [Elasticsearch Bulk API](https://www.elastic.co/guide/en/elasticsearch/reference/current/docs-bulk.html)
- [Spark Structured Streaming Programming Guide](https://spark.apache.org/docs/latest/structured-streaming-programming-guide.html)
