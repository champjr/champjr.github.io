---
title: "System Design Daily: Maglev Hashing for Stable Load Balancing"
pubDate: 2026-06-08
description: "How Maglev hashing keeps request routing stable when backends come and go, without spraying remaps across your fleet."
tags: ["system-design", "engineering", "distributed-systems", "load-balancing", "architecture"]
---

A lot of load balancing problems are really **remapping problems**.

You are not just trying to spread traffic across healthy backends. You are trying to do it **without constantly changing where requests go** every time a server is added, removed, or marked unhealthy.

That stability matters more than people first expect.

If request routing shifts too much, you pay for it everywhere:

- caches get colder
- connection pools churn
- sticky-ish application behavior gets less sticky
- downstream state gets redistributed abruptly
- tail latency gets worse even when average load looks fine

That is the problem **Maglev hashing** is meant to improve.

I like Maglev as a topic because it sits in a useful middle ground. It is more deliberate than “just pick a random backend,” but less operationally awkward than pretending perfect affinity is free. If you run L4 or L7 load balancers, API gateways, service meshes, or large ingress fleets, this idea shows up fast.

## The problem

Imagine you run an API tier with 100 backend instances.

A plain round-robin balancer spreads traffic nicely while the backend set stays constant. But now one instance fails health checks. If your clients or proxies reshuffle without a stable mapping strategy, a large fraction of keys or flows may land somewhere new.

That is annoying for simple stateless endpoints. It is expensive for workloads with locality:

- per-user cache entries
- warm JIT state
- in-memory session-adjacent data
- open HTTP/2 or database-adjacent connections
- shard-aware application logic sitting above storage

What you want is:

1. reasonably even distribution
2. deterministic routing
3. minimal disruption when membership changes
4. fast lookup at request time

Classic consistent hashing is one answer. **Maglev hashing** is another, especially when you want simple O(1) table lookup after building a precomputed permutation table.

## Core concepts

### 1. Every backend gets a permutation of the lookup table

Maglev hashing builds a fixed-size table, say size `M = 65537`.

For each backend, the balancer computes two values from its identity:

- an **offset** into the table
- a **skip** value that defines a permutation step

That lets each backend walk the table in a unique order:

```text
backend A -> 5, 12, 19, 26, ...
backend B -> 9, 20, 31, 42, ...
backend C -> 1, 18, 35, 52, ...
```

The balancer then fills the table by iterating through these permutations until every slot points at some backend.

At request time, you hash the request key, take `hash(key) % M`, and look up the backend in that slot.

That means the online path is cheap:

```text
request key -> hash -> table index -> backend
```

No ring walk. No scanning through nodes. Just a table read.

### 2. Stability comes from rebuilding a mostly similar table

When one backend disappears, you rebuild the table using the remaining backends.

The important property is that **most table entries stay assigned to the same backend**. Only the entries that depended on the removed backend, plus a limited amount of spillover from table construction, move elsewhere.

That is the whole game.

You are not preventing remaps. You are making them **proportional to the change**, rather than letting a small membership change scramble half the fleet.

### 3. It is not true stickiness, but it is often enough

Maglev hashing is deterministic for a chosen key, such as:

- source IP
- 5-tuple flow hash
- user ID
- session cookie
- request path + tenant ID

So the same key usually lands on the same backend as long as membership is stable.

That makes it great for “soft affinity” workloads. But it is not a substitute for durable shared state. If a backend dies, its mapped keys will move. If you need hard session guarantees, you still need externalized state or replication.

## A small example

Suppose you have 5 cache-heavy API servers and a Maglev table with 10,001 slots.

Traffic distribution is roughly:

- 50,000 requests/sec
- 10,000 active users
- each user issues 5 requests/sec

You hash on `user_id` so a user tends to hit the same backend repeatedly.

In the steady state, each backend gets about 20 percent of the user population, around 2,000 users.

Now backend 3 fails.

With a naive reshuffle, a very large share of users might get remapped unpredictably, collapsing cache hit rate across the whole pool.

With Maglev hashing, the users mapped to backend 3 must move, but many users mapped to backends 1, 2, 4, and 5 stay put. If backend 3 held about 20 percent of table entries, the disruption is much closer to that 20 percent band than to a full-system scramble.

That is operationally meaningful.

A cache hit rate dropping from 92 percent to 88 percent is survivable. Dropping from 92 percent to 61 percent because a single node disappeared is how you create a second outage on top of the first one.

## Tradeoffs

| Property | Maglev hashing | Plain random / round robin | Ring-based consistent hashing |
| --- | --- | --- | --- |
| Request-time lookup | very fast | very fast | usually a bit more work |
| Stable mapping | good | weak | good |
| Minimal remap on membership change | good | weak | good |
| Weighted backends | possible, but not always elegant | easy enough | often easier to express |
| Implementation complexity | moderate | low | moderate |

A few practical tradeoffs matter.

### Why people like it

- deterministic routing with very cheap lookup
- minimal disruption when backends change
- good fit for connection-heavy or cache-heavy services
- works well at load balancer scale because the hot path is simple

### What can bite you

- table construction is more complex than plain load balancing
- weighting unequal backends can get awkward depending on implementation
- bad key choice can still create skew
- deterministic routing can amplify hot-key problems if one key or tenant is abnormally heavy

My opinion here is simple: **stable routing is only as good as the thing you hash on**. If you hash on source IP behind big NATs, you may create accidental hotspots. If you hash on a real tenant or session key, you usually get something much saner.

## Common failure modes

### Hashing on the wrong key

This is the classic mistake.

If 30 percent of your traffic comes from one large mobile carrier NAT and you hash on source IP, you may pin a ridiculous amount of traffic to a small backend subset. The balancing algorithm is not broken, your key choice is.

### Ignoring backend heterogeneity

Maglev is happiest when backends are roughly interchangeable. If one backend has half the CPU or is in a degraded zone, equal assignment may be too optimistic.

You need either weighting support or separate pools when capacity is not uniform.

### Rebuild churn during flapping health checks

If health checks flap every few seconds, the table keeps rebuilding and the system never benefits from stable locality.

This is not really a Maglev problem. It is a control-plane hygiene problem. Add hysteresis, dampening, and sane outlier detection.

### Confusing affinity with correctness

Maglev improves placement stability. It does not make local memory durable. If requests depend on mutable in-process state that cannot move, backend failure still hurts.

Use Maglev to preserve efficiency, not to avoid designing state correctly.

## How to test and observe it in production

### Test membership churn, not just balanced steady state

A boring load test where all 100 backends stay healthy will miss the whole point.

Test these cases:

- remove 1 backend from 20
- add 2 fresh backends during live traffic
- flap a backend in and out of health
- skew one tenant to 10x normal traffic
- compare cache hit rate before and after membership changes

### Measure remap percentage explicitly

This is the metric I would insist on.

For a sample of keys, compare backend assignment before and after a pool change:

```text
remap_rate = keys_with_new_backend / total_sampled_keys
```

If one backend out of 20 disappears, your remap rate should look much closer to about 5 percent plus overhead than to “everything moved.”

### Watch locality-sensitive metrics

After rollout, monitor:

- cache hit ratio
- backend connection churn
- request latency during backend adds/removals
- per-backend request skew
- health check flap rate
- p95 and p99 during reconfiguration windows

You are not just validating even load. You are validating **calmness during change**.

### Compare against simpler policies

Run A/B or shadow comparisons against round robin or random choice for the same traffic class. Sometimes the extra complexity is not worth it for a truly stateless service. For cache-heavy gateways, it often is.

## A practical mental model

Maglev hashing is best thought of as a **stability-oriented load balancer**.

It does not maximize fairness at any cost. It does not eliminate remapping. It tries to keep the system from overreacting to ordinary backend churn.

That is a good production instinct.

A lot of distributed systems fail not because they lack clever algorithms, but because they turn every small topology change into a large behavioral change. Maglev is one of those patterns that says: when the world shifts a little, the system should shift a little too.

That is a design taste I trust.

## Further reading

- [Maglev: A Fast and Reliable Software Network Load Balancer (Google)](https://research.google/pubs/pub44824/)
- [Envoy load balancing documentation](https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/upstream/load_balancing/load_balancers)
- [Cilium Maglev load balancing reference](https://docs.cilium.io/en/stable/network/kubernetes/kubeproxy-free/#maglev-consistent-hashing)
