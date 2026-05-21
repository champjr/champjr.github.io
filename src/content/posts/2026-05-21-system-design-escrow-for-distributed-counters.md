---
title: "System Design Daily: Escrow for Distributed Counters"
pubDate: 2026-05-21
description: "Why pre-allocating quota beats serializing every write when many nodes update the same bounded counter."
tags: ["system-design", "engineering", "distributed-systems", "databases", "consistency"]
---

Distributed counters look easy right up until they matter.

If all you need is an approximate page-view total, you can batch, merge, and accept a little drift. But some counters are not decorative. They enforce limits:

- remaining inventory for a flash sale
- available seats on a flight
- tenant API quota for the current minute
- number of worker slots left in a region

Those counters have a hard rule: they must not go below zero, and they should not oversell just because several machines made the same decision at once.

The naive answer is to serialize every update through one database row or one leader. That preserves correctness, but it can turn a hot counter into a throughput bottleneck. The more successful your product gets, the more one tiny integer starts acting like a mutex for the entire system.

A less obvious tool is **escrow**.

Escrow for distributed counters means splitting a bounded resource into smaller local allocations. Each node gets permission to spend part of the total without coordinating on every single decrement. The global invariant still holds because no node is allowed to spend more than the portion it has been granted.

This is one of those system design techniques that sounds niche but shows up everywhere once you learn to see it.

## The problem: safe decrements under concurrency

Imagine you are selling 1,000 concert tickets. Ten application servers can accept purchases.

If every purchase does this:

1. read remaining inventory
2. check if inventory is positive
3. decrement
4. commit

then concurrent buyers will race unless the storage layer serializes updates.

You can fix that with a transactional update like:

```sql
UPDATE inventory
SET remaining = remaining - 1
WHERE event_id = 42 AND remaining > 0;
```

That is a good baseline. It is simple and correct. But if all traffic hits the same row, you may see:

- lock contention
- higher write latency
- transaction retries
- regional bottlenecks if the primary database is far away

Escrow changes the shape of the problem. Instead of 10 servers competing for the same final decrement, you allocate chunks, like 100 tickets at a time, to each server or region.

## Core concept: pre-allocate the right to spend

Think of the global counter as a budget.

- Global inventory: 1,000
- Region A escrow: 300
- Region B escrow: 400
- Region C escrow: 300

Each region can process decrements locally as long as it stays within its escrow balance. No global coordination is needed for each sale. Coordination only happens when:

- a region first receives an allocation
- a region asks for more
- unused budget is reclaimed or redistributed

A simplified data model might look like this:

```text
Global pool for event-42: 1000 total
  us-east-1 allocation: 300, used: 241
  us-west-2 allocation: 400, used: 398
  eu-central-1 allocation: 300, used: 205
  unallocated remainder: 57
```

The invariant becomes:

> Sum of all allocated amounts plus unallocated remainder must never exceed the original total.

That invariant is much easier to maintain than globally serializing every user action.

## A small example with numbers

Suppose an API product gives each customer 10,000 requests per hour. Requests are served by four gateway replicas.

Without escrow, every request might need a strongly consistent update to the quota store. At 20,000 requests per second, that is painful.

With escrow, you can allocate 2,500 tokens to each gateway. Each gateway decrements its local token bucket in memory. When a gateway drops below, say, 500 remaining, it asks the quota service for another chunk.

Now the quota service sees chunk refills, not every individual request.

Even if one gateway crashes holding 900 unused tokens, you did not lose correctness. You only stranded quota temporarily. That is an important trade.

## Where escrow works well

Escrow is best when all of these are true:

1. The counter is **bounded** and must respect a hard floor or ceiling.
2. The operation is usually **one-directional** for a while, like decrementing stock or consuming quota.
3. A little temporary imbalance between nodes is acceptable.
4. Reducing coordination is worth some complexity in rebalancing and recovery.

Good fits include:

- rate-limit quota distribution across edge gateways
- ticket or inventory reservation systems
- capacity slots for schedulers
- write budgets for multi-tenant workloads

Bad fits include counters that must be perfectly fresh for everyone at all times and workloads where reclaiming stranded allocation is impossible or too dangerous.

## Tradeoffs you have to own

Escrow buys scale by giving up some flexibility.

### Lower latency and higher throughput

This is the obvious win. Most updates become local. That cuts coordination costs dramatically.

### Temporary fragmentation

The downside is that quota can sit in the wrong place.

If west holds 1,000 unused units while east is overloaded, east may reject work even though the global total says capacity remains. The system is correct, but utilization is not optimal.

### More operational logic

Now you need policies for:

- chunk size
- refill threshold
- reclaim on node crash
- redistribution between regions
- when to fail closed versus allow soft overdraft

Those are real design decisions, not implementation details.

### Accuracy versus efficiency

Large chunks reduce coordination overhead but increase stranded capacity during failures. Small chunks improve fairness and utilization but move you closer to the original hot-counter problem.

This is the central tuning knob.

## Common failure modes

Escrow systems do not usually fail because the math is hard. They fail because the lifecycle is messy.

### 1. Double allocation after retries

A node asks for 500 more units, times out, retries, and accidentally gets two grants.

Mitigation: make allocation requests idempotent with a request ID and store the grant result durably.

### 2. Lost capacity on crash

A node dies while holding unused allocation. Nothing is oversold, but global capacity appears lower than it should until the system reclaims those units.

Mitigation: leases on allocations, heartbeat-based ownership, or explicit recovery records.

### 3. Oversubscription through stale ownership

If two processes think they both own the same local allocation because of a failover bug, you can overspend the budget.

Mitigation: attach allocation ownership to a durable instance identity and use fencing tokens or epoch checks during reassignment.

### 4. Refill storms

If every node refills at the same threshold, the quota service can get hammered in bursts.

Mitigation: jitter refill thresholds or randomize refill timing.

### 5. Bad chunk sizing

Teams sometimes pick chunk sizes by intuition, then discover that traffic is far more skewed than expected.

Mitigation: size chunks from observed demand. Hot regions should get larger refills. Cold regions should get smaller ones.

## How to test it

Escrow logic deserves more than ordinary CRUD tests.

You want scenario tests that prove the invariant survives ugly timing.

Test at least these cases:

- two allocators racing to grant the last chunk
- requester timeout followed by retry
- node crash with half-used allocation
- region partitioned from allocator while still serving traffic
- allocator failover during a grant
- reclaim and redistribution under bursty load

A useful property-based assertion is:

```text
successful_consumption + remaining_global + sum(unused_local_allocations) == original_total
```

That equation should hold no matter how events interleave.

Also test the business experience, not just correctness. A correct system that strands 20 percent of inventory during peak demand may still be a bad product decision.

## How to observe it in production

If you deploy escrow and only graph the global total, you will miss the real story.

Track:

- global remaining budget
- local allocated versus local used per node or region
- stranded allocation percentage
- refill request rate and latency
- reclaim count after node loss
- rejection rate while global capacity still exists

One especially revealing metric is **allocation efficiency**:

```text
useful consumption / total allocated
```

If that number is consistently poor, your chunk sizes or ownership boundaries are wrong.

Alert on these situations:

- local exhaustion in multiple nodes while global capacity remains high
- sudden spikes in stranded allocation
- duplicate grant detection
- refill latency approaching the time it takes hot nodes to burn through their remaining local budget

## The practical opinion

Escrow is a good pattern when you care more about preserving a hard invariant than about keeping every node perfectly synchronized every millisecond.

I like it because it is honest. It admits a truth many distributed systems try to hide: **you usually cannot have both perfect global coordination and cheap local decisions at high scale**. So instead of pretending, escrow moves coordination to a coarser granularity.

That is the right move surprisingly often.

If you are building a bounded counter system, start simple with a single transactional row. But when that row becomes the bottleneck, do not jump straight to “eventual consistency and hope.” Escrow gives you a middle path: local speed with a globally enforced budget.

And that is a very useful shape of compromise.

## Further reading

- [Gray and Reuter, *Transaction Processing: Concepts and Techniques*](https://dl.acm.org/doi/book/10.5555/573304)
- [Pat Helland, Life Beyond Distributed Transactions](https://queue.acm.org/detail.cfm?id=3025012)
- [Amazon DynamoDB developer guide on atomic counters and conditional writes](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/example_dynamodb_Scenario_AtomicCounterOperations_section.html)
- [Martin Kleppmann, *Designing Data-Intensive Applications*](https://dataintensive.net/)
