---
title: "System Design Daily: Distributed Semaphores"
pubDate: 2026-05-31
description: "How to cap concurrent work across many nodes without turning a hot service into a self-inflicted outage."
tags: ["system-design", "engineering", "distributed-systems", "reliability", "concurrency"]
---

When a system melts down, it is often not because each request is individually expensive. It is because **too many expensive things happen at once**.

That is the job of a semaphore. A semaphore says, "Only _N_ of these may run concurrently." On a single machine, that is basic concurrency control. In a distributed system, it becomes a design problem: how do you enforce a shared concurrency limit across many workers, pods, or regions without introducing a fragile bottleneck?

My opinionated take is simple: **distributed semaphores are usually better than unbounded optimism, but worse than local limits unless you truly need a global cap**. Use them when the protected resource is globally scarce or dangerously shared. Do not reach for them just because they sound neat.

## The problem

Imagine a service that generates PDFs. One request is fine. A thousand at once is not.

Each PDF job might consume:

- 300 MB of memory during rendering
- 1 CPU core for 2 to 5 seconds
- a database lookup at the start
- an object-store upload at the end

If you have 20 workers and each worker happily starts 20 render jobs in parallel, you can create 400 concurrent renders by accident. That is enough to turn a healthy cluster into a swap festival.

A local semaphore per process helps, but it does not solve the whole problem. If every worker allows 5 concurrent jobs and autoscaling adds 50 workers, your "safe" concurrency becomes 250.

Sometimes that is fine. Sometimes the true constraint is external and shared:

- a downstream database that can tolerate only 40 heavy queries at once
- a licensed third-party API that allows 10 concurrent sessions
- a GPU pool with 8 cards total
- a migration job that must not exceed 3 shard rebuilds at a time

That is where a **distributed semaphore** earns its keep.

## Core concepts

### 1. A semaphore controls concurrency, not rate

This sounds obvious, but teams blur it all the time.

- **Rate limit**: 100 requests per second
- **Semaphore**: 20 requests in flight at the same time

You use a rate limiter when the problem is sustained arrival speed. You use a semaphore when the problem is **simultaneous pressure** on a resource with slow release.

A batch export endpoint might tolerate 200 starts per minute but still need a semaphore of 5 because each export runs for several minutes.

### 2. Permit acquisition must have an owner and an expiry

In a single process, a thread acquires a permit and later releases it. In a distributed system, machines crash, networks partition, and deploys kill workers mid-job.

If a permit can be acquired but never automatically reclaimed, your semaphore leaks capacity forever.

That is why a practical distributed permit usually includes:

- a unique owner ID
- a lease or TTL
- periodic renewal while work is healthy
- release on completion

Without expiry, you do not have coordination. You have future pain.

### 3. Global caps are correctness tools and blast-radius tools

A distributed semaphore is often protecting one of two things:

1. **Correctness-sensitive work**, where too much concurrency causes races or invalid state.
2. **Capacity-sensitive work**, where too much concurrency causes overload.

The second case is more common. A semaphore is frequently a reliability control, not a purity play.

### 4. Fairness is optional, but starvation is real

A minimal semaphore only answers: can I get a permit right now?

Real systems quickly need more nuance:

- should permits be FIFO?
- can one tenant hold all permits?
- should a heavy job cost 3 permits while a light job costs 1?
- what happens when waiters time out and retry?

A semaphore that ignores fairness can accidentally protect the service while making user experience chaotic.

## A small example

Suppose you run an embedding pipeline backed by 12 GPU workers. Each GPU can safely process 4 embedding batches in parallel before latency and memory usage get ugly.

Your true global budget is:

```text
12 workers x 4 safe concurrent batches = 48 permits
```

A simple design is:

- store a semaphore with 48 permits in a coordination system
- each embedding job acquires 1 permit before starting
- large jobs acquire 2 permits
- workers renew every 10 seconds
- permits expire after 30 seconds without renewal

Pseudo-API:

```text
POST /permits/acquire
{ "semaphore": "embedding-gpu", "owner": "job-8f2", "count": 2, "ttlSeconds": 30 }

POST /permits/renew
{ "semaphore": "embedding-gpu", "owner": "job-8f2", "ttlSeconds": 30 }

POST /permits/release
{ "semaphore": "embedding-gpu", "owner": "job-8f2" }
```

If only 1 permit remains, the 2-permit job waits instead of starting and detonating memory.

That sounds restrictive. Good. Restriction is the point.

## Tradeoffs

| Design choice | Benefit | Cost |
| --- | --- | --- |
| Local semaphores only | Fast, simple, no shared coordinator | No true global cap |
| Central distributed semaphore | Strong global control | Coordinator dependency, added latency |
| Weighted permits | Better matches real resource cost | Requires cost modeling |
| Short lease TTLs | Faster recovery from crashed workers | More renew traffic, more false expiries |
| Long lease TTLs | Fewer renewals | Slower recovery, larger capacity leaks |

The main tradeoff is brutal but honest: **the more accurately you coordinate concurrency, the more you create a coordination path that can fail**.

That does not mean distributed semaphores are bad. It means they should protect expensive or dangerous work, not every innocent code path in your stack.

## Common failure modes

### Permit leaks

A worker acquires a permit, then crashes before release. If there is no lease expiry, capacity silently disappears. If you ever find yourself adding an admin endpoint called `/force-clear-permits`, that is a smell.

### Double ownership after partitions

A worker may believe it still owns a permit while the coordinator has expired it and given it to someone else. If the work is correctness-sensitive, this can create overlapping execution.

This is where **fencing tokens** help. Each successful acquisition gets a monotonically increasing token, and downstream systems reject stale tokens. The semaphore limits concurrency; the fencing token protects correctness.

### Retry storms on contention

If 500 callers fail to acquire a permit and all retry every 100 ms, the semaphore becomes a hot key and the system burns effort on disappointment.

Backoff, jitter, and queueing discipline matter here just as much as the permit logic.

### Hidden queue growth

A semaphore does not remove demand. It delays demand. If you cap concurrency at 20 while 5,000 jobs pile up behind it, you have built a queue whether you meant to or not.

That queue needs its own limits, timeouts, and observability.

### Using one semaphore for unrelated work

If image resizing, exports, and search reindexing all share one global permit pool, the noisiest workload wins. Separate scarce resources into separate semaphores unless you deliberately want shared contention.

## How to test it

Test the semaphore itself, and test the behavior it is supposed to improve.

### Failure tests

- kill a worker after acquire and confirm the permit returns after TTL
- pause a worker so renewals stop and verify expiry behavior
- simulate coordinator failover
- inject network delay between workers and coordinator

### Load tests

Drive more demand than the protected resource can safely handle, then compare two runs:

1. unbounded or locally bounded concurrency
2. distributed semaphore enabled

You want to see:

- lower error rate on the protected dependency
- lower memory or CPU spikes
- stable tail latency for admitted work
- predictable wait times for queued work

### Correctness tests

If duplicate execution is dangerous, verify that stale owners cannot continue useful work after lease loss. That usually means testing fencing at the downstream layer, not just the permit service.

## How to observe it in production

A distributed semaphore without observability is just mystery throttling.

At minimum, expose:

- total permits
- available permits
- current holders
- acquire success rate
- acquire wait time
- timeout rate while waiting
- lease renewal failures
- expired permit count
- queue depth behind the semaphore

Also watch the thing you are protecting:

- database connection saturation
- GPU memory pressure
- third-party API errors
- shard rebuild duration

The win condition is not "all permits are used efficiently." The win condition is **the shared resource stays healthy while important work still gets through**.

A useful alert is often: _permits exhausted for too long + queue depth growing + downstream still unhealthy_. That means the semaphore is not enough and you need lower admission, more capacity, or less work per unit.

## When to use one, and when not to

Use a distributed semaphore when:

- the scarce resource is shared across many nodes
- concurrency, not just request rate, is the real failure trigger
- duplicate execution is acceptable or separately guarded
- you are willing to run a coordination path on purpose

Avoid it when:

- a simple local semaphore per instance is enough
- the real problem is bad backpressure upstream
- the protected work should be queued by a job system instead
- you are using it to paper over unknown capacity numbers

That last one matters. A semaphore is not a substitute for capacity understanding. It is a mechanism for enforcing what you already know.

## Final takeaway

Distributed semaphores are one of those patterns that look small in code and large in consequences.

Used well, they turn a fragile shared resource into something predictable. Used lazily, they add a coordinator, a queue, and a false sense of control.

If you need a global cap, make permits leased, observable, and paired with sane retry behavior. If correctness matters, add fencing. And if a local limit is enough, enjoy the simpler life.

## Further reading

- [etcd concurrency primitives](https://etcd.io/docs/v3.5/dev-guide/api_concurrency_reference_v3/)
- [ZooKeeper Recipes and Solutions, Locks](https://zookeeper.apache.org/doc/current/recipes.html#sc_recipes_Locks)
- [Google SRE Book, Addressing Cascading Failures](https://sre.google/sre-book/addressing-cascading-failures/)
- [Martin Kleppmann on distributed locking and fencing tokens](https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html)
