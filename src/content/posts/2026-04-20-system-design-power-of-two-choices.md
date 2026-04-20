---
title: "System Design Daily: The Power of Two Choices"
pubDate: 2026-04-20
description: "Random load balancing is simple, least-connections is expensive, and the power of two choices lands in the sweet spot between them."
tags: ["system-design", "engineering", "distributed-systems", "performance", "load-balancing"]
---

If you send traffic to a pool of servers, the naive approach is to pick a backend at random.

That works better than people expect, until it doesn't.

Under bursty traffic, uneven request cost, or a small number of hot clients, random choice can leave one instance sweating while its neighbors are basically fine. The other naive response is to say, "okay, let's always pick the least-loaded backend." That sounds smart, but now you need every load balancer to have fresh global state, and you can easily create a system that spends too much effort trying to be perfectly fair.

The power of two choices is one of my favorite system design tricks because it is embarrassingly simple and weirdly effective.

The rule is this:

1. Pick two candidate backends at random.
2. Compare a small load signal, usually in-flight requests.
3. Send the request to the less loaded of the two.

That tiny bit of choice dramatically improves load distribution without requiring expensive coordination across the whole fleet.

## The problem it solves

Suppose you run 100 API instances behind a layer 7 load balancer. Average request latency is 50 ms, but 5% of requests take 800 ms because they hit a slower code path.

If traffic is purely random, those slow requests clump by chance. A few unlucky instances accumulate longer queues, their latencies rise, and new requests keep landing there because random routing is blind.

This creates a bad feedback loop:

- long requests increase concurrency on one backend
- queueing raises latency for the next requests
- retries or impatient clients add more pressure
- p95 and p99 blow up even though average CPU across the fleet still looks reasonable

This is the annoying part of load balancing in real systems: you usually do not lose because the *average* machine is overloaded. You lose because a subset of machines becomes overloaded first.

The power of two choices reduces that skew.

## Why "two" is enough to matter

There is a beautiful result from the literature here: when you place work by choosing the less loaded of two random bins instead of one random bin, the maximum imbalance drops a lot.

You do not need the full math to use it productively. The intuition is enough.

With pure random routing, a request can easily land on a bad backend even if many healthier backends exist. With two random samples, the odds improve fast because you only need *one* of those two to be decent, and then the comparison steers away from the worse option.

You are not finding the global best backend. You are just avoiding obviously bad ones.

That turns out to be a very good bargain.

## A simple example

Imagine four backends with current in-flight request counts:

| Backend | In-flight requests |
| --- | ---: |
| A | 2 |
| B | 3 |
| C | 11 |
| D | 12 |

With random routing, each backend gets 25% of new requests, including the already-congested C and D.

With the power of two choices, you sample two at random:

- if you sample A and C, choose A
- if you sample B and D, choose B
- if you sample C and D, choose C
- if you sample A and B, choose A

C and D still receive traffic sometimes, but much less often than with blind random choice. Over many requests, that is enough to keep skew from snowballing.

A pseudocode version is almost boring:

```text
c1 = random_backend()
c2 = random_backend(excluding=c1)

if load(c1) <= load(c2):
  choose c1
else:
  choose c2
```

Where `load()` might mean:

- active requests
- pending queue depth
- EWMA latency
- CPU load, carefully used
- a composite score if you really know what you are doing

My bias is to start with **in-flight requests**. It is simple, local, and usually good enough.

## Core design choices

The pattern is simple, but the details matter.

### 1. What load signal should you compare?

The most common signal is current in-flight requests.

Why this works well:

- it is cheap to track
- it reacts immediately
- it roughly captures queue pressure
- it does not require sharing fleet-wide metrics everywhere

Latency-based signals can also work, especially EWMA latency, but they are noisier. CPU is even trickier because many services are bottlenecked by I/O, connection pools, or downstream dependencies long before CPU is actually the constraint.

If you are starting from scratch, keep it boring:

- compare in-flight request counts
- break ties randomly
- add health checks and outlier ejection separately

### 2. Where does the decision happen?

You can use this pattern in several places:

- at an edge or service mesh load balancer
- inside a client library doing client-side load balancing
- in queue consumers choosing a shard or worker pool
- in schedulers assigning work to workers

Client-side balancing can be especially nice because each client only needs a local view of the backends it knows about. The pattern does not depend on a centralized brain.

### 3. Do you need weights?

Sometimes your backends are not equal.

Maybe one node has twice the CPU, or one zone is intentionally smaller. In that case, you usually want **weighted** choices, not uniform sampling.

The practical version is:

- sample according to weights
- compare normalized load, such as `inflight / capacity_units`

Otherwise the small nodes get punished for being small.

## Tradeoffs

This technique is great, but it is not magic.

### Upsides

- **Much better skew resistance than random routing**
- **Much cheaper than global least-loaded scheduling**
- **Works with partial, stale, or local information**
- **Easy to implement in proxies, meshes, and clients**

### Downsides

- **Not globally optimal**. Sometimes both sampled backends are mediocre.
- **Sensitive to bad load metrics**. If your signal lies, the routing lies.
- **Can amplify herd behavior** if every balancer reacts to the same noisy metric too aggressively.
- **Does not replace health management**. A backend that is half-dead still needs draining, health checks, or outlier detection.

This is the pattern's real personality: it is a smart heuristic, not an oracle.

## Common failure modes

### Using a misleading metric

If you compare CPU but your bottleneck is a saturated database connection pool, the load balancer may keep choosing the wrong node.

Use the metric most closely tied to admission pressure.

### Ignoring request cost variance

If one request can take 2 ms and another can take 2 seconds, raw in-flight count is only an approximation. A backend with 5 giant requests may be much worse off than one with 10 tiny requests.

That does not make the algorithm bad. It means you should notice when request cost variance is extreme and consider separate pools, request classification, or a richer score.

### Letting stale membership linger

This pattern assumes the candidate set is mostly healthy and current. If clients keep routing to instances that should have been removed, smarter choice logic will not save you.

Membership hygiene still matters.

### Forgetting about retries

A request that times out and retries through the same balancing policy can still worsen overload. The algorithm helps distribute traffic, but it cannot fix retry storms on its own.

Pair it with deadlines, backoff, and load shedding.

### Overengineering the score

Teams sometimes start with a beautiful simple algorithm and then bolt on 14 metrics, three decay functions, and some mysterious penalty coefficient nobody trusts.

If you do that, you often reintroduce instability.

I would rather run a plain two-choice policy on a clean in-flight counter than a fancy scoring model nobody can explain during an incident.

## How to test it

You can test this in staging or even with a small simulation.

### Simulation

Model N backends and generate requests with a mixed latency distribution, for example:

- 95% of requests take 50 ms
- 5% of requests take 800 ms

Compare three routing strategies:

- random
- round robin
- power of two choices using in-flight requests

Then measure:

- max in-flight requests on any backend
- p95 and p99 response latency
- queue wait time before service
- fraction of requests hitting the most-loaded 10% of nodes

In many realistic cases, two-choice routing noticeably reduces tail latency because it prevents hotspots from compounding.

### Load test in a real service

In a pre-production environment, inject slow requests into a subset of backends and watch whether the algorithm shifts traffic away before the whole fleet degrades.

That is the key question: does the system avoid concentrated pain, or does it keep feeding the sick nodes?

### Failure drills

Test scenarios like:

- one zone has higher latency
- a subset of instances has a slow dependency
- health checks lag actual degradation by 30 seconds
- request mix changes from uniform to highly skewed

You want to see graceful bias away from trouble, not oscillation or panic.

## What to observe in production

If you deploy this, make it observable.

Track at least:

- in-flight requests per backend
- request distribution across backends
- p50, p95, and p99 latency by backend
- backend selection counts by policy
- retry rates and timeout rates
- number of unhealthy or ejected backends

A very useful graph is the spread between median and max in-flight requests across the pool. If that spread stays tighter after rollout, the policy is doing its job.

Another useful check is selection entropy: if traffic suddenly collapses onto a few nodes, either your load signal is broken or your candidate pool is unhealthy.

## Where it fits in a broader design

The power of two choices is not a full traffic-management strategy. It works best alongside a few boring friends:

- health checks to remove bad backends
- outlier detection to quarantine weird ones
- deadlines and retries with budgets
- circuit breakers or load shedding when the whole pool is in trouble

Think of it as a cheap anti-skew primitive. It reduces the chance that random chance turns into a hotspot.

That is a very worthwhile job.

## The practical takeaway

If your current policy is pure random or round robin, and your request cost is uneven, the power of two choices is one of the highest-leverage upgrades you can make.

It is easy to explain, cheap to implement, and usually improves tail behavior without requiring perfect global knowledge.

That combination is rare.

In system design, there is a whole class of ideas that win not because they are theoretically perfect, but because they are robust under real operational mess. This is one of them.

## Further reading

- [The Power of Two Choices in Randomized Load Balancing](https://www.eecs.harvard.edu/~michaelm/postscripts/handbook2001.pdf)
- [NGINX, Inc.: Random with Two Choices Load Balancing](https://www.f5.com/company/blog/nginx/nginx-power-of-two-choices-load-balancing-algorithm)
- [Envoy load balancing overview](https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/upstream/load_balancing/load_balancers)
- [The Tail at Scale](https://research.google/pubs/the-tail-at-scale/)
