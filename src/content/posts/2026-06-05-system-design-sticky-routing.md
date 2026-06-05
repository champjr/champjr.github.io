---
title: "System Design Daily: Sticky Routing and Session Affinity"
pubDate: 2026-06-05
description: "When routing the same user to the same backend helps, when it hurts, and how to keep affinity from turning into accidental fragility."
tags: ["system-design", "engineering", "distributed-systems", "load-balancing", "architecture"]
---

A lot of system design advice starts with a noble instinct: any request should be able to land on any healthy server.

That is still the right default. But some systems get simpler, faster, or cheaper when related requests keep landing on the same backend for a while. That design choice is usually called **sticky routing** or **session affinity**.

The idea is straightforward: instead of distributing each request independently, the load balancer tries to route a user, session, tenant, or key range back to the same instance.

Sometimes that is exactly what you want.

Sometimes it is how you accidentally build a distributed monolith with worse failure behavior.

## The problem

Imagine a web app with 20 stateless API servers behind a load balancer.

If every request can go anywhere, you get nice even balancing, easy failover, and simple autoscaling. But a few workloads become inefficient:

- in-memory session data gets reloaded repeatedly
- warm caches never stay warm for a given user
- WebSocket or long-poll clients reconnect to different nodes
- per-user rate-limit counters or local state become scattered
- expensive authentication or personalization work repeats more than necessary

So a team adds affinity. Maybe a cookie pins a browser session to one server. Maybe a reverse proxy hashes on user ID. Maybe a service mesh keeps the same tenant talking to the same pool.

That can work beautifully. It can also produce silent hotspots and ugly failure modes if nobody treats affinity as a real system design decision.

## Core concepts

### 1. Affinity is a routing hint, not a correctness guarantee

This is the first rule worth being opinionated about.

If your system *breaks* when a request lands on a different server, you do not have sticky routing. You have hidden state coupling.

Good affinity improves efficiency. It should not be the only thing preserving correctness.

That means the source of truth still lives in shared durable storage, or in a replicated protocol that tolerates movement. The affinity layer is there to improve locality, not to hold the whole product together with vibes.

### 2. There are different kinds of stickiness

Common options include:

| Strategy | Example | Useful when | Risk |
| --- | --- | --- | --- |
| Cookie-based session affinity | LB sets `SERVERID=node-7` | Browser sessions, classic web apps | Uneven distribution over time |
| Source IP hashing | same client IP maps to same backend | simple edge routing | NAT can concentrate many users |
| Consistent hashing on key | tenant ID or user ID picks backend | cache locality, per-tenant state | skew from hot keys or large tenants |
| Connection affinity | one TCP/WebSocket stays on one node | streaming, chat, subscriptions | draining and failover get harder |

These are not interchangeable. IP affinity sounds simple until a giant office NAT or mobile carrier gateway sends thousands of users to one unlucky instance.

### 3. Affinity is really about locality

What you are buying is usually one of three things:

- **cache locality**, where repeated requests can reuse memory already on that node
- **state locality**, where temporary per-session state stays nearby
- **connection locality**, where long-lived streams avoid unnecessary reconnect churn

That locality can reduce latency a lot.

Suppose a personalized dashboard request costs:

- 3 ms if the user profile and permissions are already warm in local memory
- 25 ms if the server must rebuild context from Redis and the primary database

If the same user makes ten requests in a minute, affinity can turn one cold request plus nine warm ones into a noticeable win.

## A small example

Say you run 8 API instances for a B2B product. Each tenant has a moderately hot in-memory authorization graph around 40 MB once loaded.

Without affinity, requests for tenant `acme` bounce across all 8 instances, so each node keeps loading pieces of the same graph. That means:

- more repeated cache fills
- higher memory waste
- more backend reads

With consistent hashing on tenant ID, `acme` mostly lands on instance 3, with one backup destination during failover. Now the auth graph stays warm where it is actually used.

That may cut backend lookups from, say, 400 per minute to 80 per minute for that tenant.

But there is a catch. If `acme` is ten times larger than every other tenant, instance 3 may become a hotspot even though overall cluster CPU looks fine.

That is the classic affinity tradeoff: better locality, worse balance.

## Tradeoffs

### Why sticky routing helps

- lower median latency from warm caches
- fewer repeated reads to shared stores
- simpler handling of connection-oriented protocols
- less cross-node chatter for session-ish work

### Why sticky routing hurts

- load distribution gets less even
- hot users or tenants can overload one instance
- scaling out does not instantly spread existing sticky sessions
- draining nodes and deployments become trickier
- incidents become burstier because one bad node owns a stable slice of traffic

This is why I usually prefer the phrase **bounded affinity** in practice. Keep requests local when convenient, but preserve the ability to rebalance and fail over quickly.

## Common failure modes

### 1. Accidental statefulness

A team stores shopping cart state only in process memory because "the user will keep hitting the same node." Then the node restarts, and the cart disappears. That is not an affinity problem. That is a state placement mistake.

### 2. Hotspot tenants

One enterprise customer generates 20% of traffic and all of it hashes to a single backend pool. Average cluster load looks fine, but one pool melts.

### 3. Sticky failure amplification

If one backend gets slow but stays nominally healthy, the same users keep getting sent back to it. Affinity can make a partial failure feel personal and persistent.

### 4. Broken autoscaling expectations

You add more instances, but existing sticky sessions stay glued to the old nodes. The new capacity sits underused while old nodes remain hot.

## How to test and observe it in production

Measure affinity directly. Do not just assume it is helping.

Useful signals include:

- per-instance request rate, CPU, memory, and p95 latency
- skew metrics, like busiest instance traffic divided by median instance traffic
- cache hit rate by instance and by tenant class
- session rebinding rate, meaning how often a user or tenant moves to a new node
- connection counts per node for WebSockets or streaming protocols
- fraction of traffic served after failover or draining events

A simple production drill is to intentionally drain one backend and watch:

1. how quickly sticky clients rebalance
2. whether latency spikes stay bounded
3. whether reconnect storms hit downstream dependencies

Another good test is synthetic hotspot traffic. Send 15% to 20% of load for one tenant or user key and confirm the system either tolerates that skew or has a mitigation strategy.

Mitigations usually include:

- shard very large tenants across sub-keys instead of one hash key
- keep local caches as hints backed by shared durable state
- cap connection counts per instance
- use consistent hashing with bounded loads or weighted placement when available
- make session drain and rebinding observable before you need them in an incident

## The practical takeaway

Sticky routing is not old-fashioned and it is not automatically bad. It is a useful tool for buying locality.

But it should be treated like a performance optimization with failure implications, not a free convenience.

If affinity is optional, measurable, and easy to break safely, it can make a system faster and cheaper.

If affinity becomes the only reason your state works, you have built something fragile and merely hidden the fragility behind a load balancer.

That is usually where the trouble starts.

## Links

- AWS, Sticky sessions with load balancers: <https://docs.aws.amazon.com/prescriptive-guidance/latest/load-balancer-stickiness/welcome.html>
- NGINX, session persistence and load balancing concepts: <https://docs.nginx.com/nginx/admin-guide/load-balancer/http-load-balancer/>
- Envoy, ring hash load balancer: <https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/upstream/load_balancing/load_balancers#ring-hash>
