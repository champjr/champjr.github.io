---
title: "System Design Daily: Work Stealing for Uneven Parallelism"
pubDate: 2026-06-07
description: "How worker pools stay busy when some tasks are tiny, some are huge, and static partitioning quietly wastes half your capacity."
tags: ["system-design", "engineering", "distributed-systems", "scheduling", "architecture"]
---

A lot of production systems look balanced on paper and lopsided in reality.

You have 64 workers. You have a backlog of jobs. CPU is available. The queue is full. But somehow half the workers are idle while a few unlucky ones are drowning in long-running tasks.

That is the problem **work stealing** is meant to solve.

The idea is simple: instead of assigning work once and hoping the distribution stays fair, idle workers are allowed to "steal" tasks from busy workers. It is one of those patterns that sounds almost too clever until you see how often static assignment falls apart in real systems.

I like work stealing because it is an honest response to a fact many architectures try to ignore: **real workloads are irregular**. Request size varies. tenants vary. compaction jobs vary. image transforms vary. one "job" might take 2 milliseconds and the next might take 20 seconds.

If your scheduler assumes the work units are roughly equal, production will eventually embarrass that assumption.

## The problem

Suppose you run a background processing service for video uploads.

Each uploaded file triggers:

- thumbnail generation
- metadata extraction
- virus scan
- multiple transcodes

You have 16 worker processes. A naive design pushes jobs into partitions based on `video_id % 16`, or assigns batches evenly at dispatch time.

That looks fair until the workload shifts:

- some uploads are 20-second clips
- some are 2-hour recordings
- some need one output format
- some need six

Now queue lengths may look similar, but total work is not similar at all. One worker might have five huge jobs while another burns through thirty tiny ones and goes idle.

That is the core failure of static partitioning. It balances **item count**, not **remaining work**.

## Core concepts

### 1. Local queues first, stealing second

Most work-stealing systems give each worker its own queue.

That has two benefits:

- normal scheduling is cheap because workers mostly pop from their own queue
- locality is better because related tasks often stay on the same worker and reuse warm memory

When a worker runs out of local work, it becomes a thief. It picks another worker, takes one or more tasks, and gets busy again.

A simplified sketch looks like this:

```text
worker-1: [job A][job B][job C][job D]
worker-2: [job E]
worker-3: []
worker-4: [job F][job G]

worker-3 goes idle
worker-3 steals [job D] from worker-1
```

The important point is that stealing is a fallback path, not the hot path.

### 2. You are trading coordination for utilization

Static assignment has very little runtime coordination. That is why people like it.

Work stealing adds coordination cost:

- workers need visibility into who has work
- stealing itself needs synchronization
- task ownership can move during execution windows

But the payoff is much higher utilization when work is uneven.

A practical way to think about it is this:

| Approach | Coordination cost | Locality | Handles skew well |
| --- | --- | --- | --- |
| One global queue | medium to high | weak | yes, but can contend heavily |
| Static partitions | low | strong | no |
| Work stealing | medium | pretty good | yes |

That middle ground is why the pattern shows up so often.

### 3. Task size matters

Work stealing works best when tasks are not absurdly large.

If a single task monopolizes a worker for 30 minutes, the scheduler cannot do much until that worker hits a safe boundary. In practice, this means you often need to make big jobs divisible:

- split a backfill into ranges
- split a video transcode pipeline into stages
- split a graph crawl into batches
- split a reindex into shards

Stealing is much more effective when units are small enough to move, but large enough that scheduling overhead does not dominate.

## A small example

Imagine 8 workers and 80 jobs.

- 72 jobs take 100 ms each
- 8 jobs take 5 s each

If you assign 10 jobs to each worker up front, one unlucky worker might get 3 long jobs:

- worker 1: `3 * 5 s + 7 * 100 ms = 15.7 s`
- worker 2: `1 * 5 s + 9 * 100 ms = 5.9 s`
- worker 3: `0 * 5 s + 10 * 100 ms = 1.0 s`

Even if the average looks fine, total completion time is now pinned by the most unlucky partition.

With work stealing, workers 2 through 8 can finish their local queues, then peel smaller remaining tasks away from busy workers. You still cannot split a job already in flight, but you stop making the imbalance worse.

In real systems, that usually means better tail completion time for a batch, better cluster utilization, and fewer idle cores during spikes.

## Tradeoffs

### Why it helps

- keeps workers busy under uneven load
- reduces long tails caused by unlucky partitioning
- preserves some locality without requiring perfect upfront balancing
- adapts naturally when job duration is unpredictable

### What it costs

- more scheduler complexity
- extra locking or coordination around deques and ownership
- risk of too much stealing traffic if the system is badly tuned
- less predictability for per-worker cache warmth compared with strict affinity

I am mildly opinionated here: if your workload is homogeneous and simple, work stealing is probably unnecessary. A boring queue is great when it stays boring. This pattern earns its keep when variance is the problem.

## Common failure modes

### Stealing too aggressively

If idle workers constantly probe other workers, the scheduler can become noisy and expensive. You want bounded, backoff-aware stealing, not a tiny denial-of-service attack between your own threads.

### Tasks are too big to rebalance

A "job" that represents 500 GB of backfill work is not really schedulable. It is a hostage. Break giant jobs into chunks that can move safely.

### Shared bottlenecks make stealing pointless

If every worker ultimately blocks on the same database pool, storage throttle, or remote API, stealing may improve fairness without improving throughput. The workers are busy, but the system is still bottlenecked elsewhere.

### Duplicate execution from sloppy ownership rules

In distributed implementations, task stealing can go wrong if two workers believe they own the same task. Without leases, acknowledgements, or atomic claim semantics, a scheduler bug quietly becomes a correctness bug.

### Locality gets destroyed

If you steal large batches too often, caches get colder and data movement increases. Good stealing policies usually move enough work to help, but not so much that the scheduler thrashes.

## How to test and observe it in production

This is where teams often stop too early. They confirm throughput improved in a benchmark and call it done. The real questions are more operational.

### Test under skew, not just average load

Create workloads with:

- a few very large jobs among many small ones
- bursty arrivals for one tenant or partition
- staged downstream slowdowns
- mixed CPU-heavy and I/O-heavy tasks

If the scheduler only looks good when all work items are similar, you have not really tested the point of work stealing.

### Instrument the scheduler itself

You want to see:

- queue depth per worker
- steal attempts per second
- successful steals versus failed steals
- task wait time before execution
- task execution time distribution
- worker idle percentage
- batch completion or end-to-end tail latency

A very useful sanity metric is **skew after scheduling**. If one worker still carries 5 times the queued work of the median worker, the policy is not doing enough.

### Watch for second-order effects

Improved utilization can expose other limits. After rolling out work stealing, look at:

- downstream saturation, especially databases and object storage
- CPU cache miss or memory pressure changes
- network traffic between nodes if tasks pull data with them
- retries or duplicate claims in distributed queues

In other words, make sure you did not solve one imbalance by moving the pain somewhere less visible.

## A practical implementation pattern

A common design is:

```text
[dispatcher] -> local deque per worker
                  |
                  +-> worker pops from head
                  +-> idle worker steals from tail of another deque
```

Popping from one end and stealing from the other helps reduce contention and keeps recently spawned local work local.

For distributed worker pools, the equivalent pattern is often:

- assign jobs to a preferred shard or worker group
- allow idle groups to claim older work from overloaded groups
- use leases or claim tokens so ownership transfers are explicit

That is not quite the same as thread-level work stealing, but the design instinct is similar: **prefer locality first, rebalance when idle capacity appears elsewhere**.

## Closing thought

Work stealing is a good reminder that fairness at dispatch time is not the same thing as fairness over the life of a workload.

Systems with uneven tasks need a scheduler that can admit it was wrong a minute ago and correct course.

That is really what stealing is: a controlled way for idle capacity to go find useful work instead of waiting politely while one partition suffers alone.

## Further reading

- [Blumofe and Leiserson, Scheduling Multithreaded Computations by Work Stealing](https://dl.acm.org/doi/10.1145/324133.324234)
- [Java ForkJoinPool documentation](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/ForkJoinPool.html)
- [Tokio runtime, work-stealing scheduler notes](https://docs.rs/tokio/latest/tokio/runtime/)
- [The Go scheduler](https://go.dev/s/go11sched)
