---
title: "System Design Daily: Active vs Passive Health Checks"
pubDate: 2026-07-23
description: "How to tell whether a backend is truly healthy, and why good systems combine active probes with passive failure signals."
tags: ["system-design", "engineering", "distributed-systems", "reliability", "load-balancing"]
---

A lot of outages are not caused by a server being fully down. They come from the uglier middle state: the process is up, the port is open, and the instance is still making things worse.

That is why health checking deserves more respect than it usually gets.

When people say “just add a health check,” they often mean an active probe like `GET /healthz`. That is useful, but incomplete. Real production systems usually need two different signals:

- **Active health checks**: the platform or load balancer asks, “are you healthy?”
- **Passive health checks**: the system watches real traffic and asks, “are users actually getting good results?”

I like this topic because it is one of those boring pieces of system design that quietly determines whether a partial failure stays small or spreads.

## The problem

Imagine you have six API replicas behind a load balancer. Each replica responds to `/healthz` in 3 ms because that endpoint only checks whether the process is alive.

Meanwhile one replica has:

- a saturated connection pool to Postgres
- request latencies above 4 seconds
- timeout errors on 20 percent of requests

Your active probe still says “healthy.” Your users disagree.

That is the core problem: **health is contextual**. A machine can be alive while the service it provides is failing. If your system only knows how to detect dead boxes, it will happily route traffic to slow, error-prone, half-broken ones.

## Core concepts

### Active health checks

Active checks are synthetic probes initiated by infrastructure.

Examples:

- Kubernetes readiness probe
- load balancer HTTP/TCP checks
- service mesh health probes

Typical questions they answer:

- Is the process reachable?
- Is it ready to serve traffic?
- Can it talk to critical dependencies?

A simple version looks like this:

```http
GET /readyz
200 OK
{
  "db": "ok",
  "queue": "ok",
  "build": "2026.07.23"
}
```

The big advantage is speed and consistency. Active checks let you remove bad instances before customers hit them. They also work even when traffic is low.

But active checks are only as good as what they measure. A shallow probe often turns into a lie detector that lies.

### Passive health checks

Passive checks use observations from real requests.

Examples:

- recent 5xx rate
- timeout rate
- success latency EWMA
- connection failures
- gRPC transport errors

Instead of asking a separate endpoint whether a backend is healthy, the system infers health from lived behavior.

If a backend starts returning 503s or timing out, a proxy can reduce or stop traffic to it even if `/healthz` is still green.

This is often how mature load balancers behave. They trust production traffic more than cheerful self-reporting.

### Liveness vs readiness vs usefulness

These sound similar and they are not.

| Signal | Question | Bad use of it |
|---|---|---|
| Liveness | Should this process be restarted? | Using it to decide user traffic routing |
| Readiness | Should this instance receive new traffic? | Making it depend on every optional dependency |
| Passive usefulness | Are real requests succeeding fast enough? | Ignoring it because “the pod is healthy” |

A good system keeps these separate.

## A small example

Suppose a load balancer routes 12,000 requests per minute across 4 instances.

Under normal conditions:

- active probe every 5 seconds
- unhealthy after 3 failed probes
- passive eject if 30 second error rate exceeds 8 percent or p95 latency exceeds 2 seconds

Now instance C hits a database lock storm.

- `/readyz` still returns 200
- p95 latency jumps from 120 ms to 3,500 ms
- 12 percent of requests time out

If you rely on active checks only, C may keep receiving traffic for minutes.

If you also have passive checks, the balancer can mark C degraded after the recent production error signal crosses threshold:

```text
Before incident:
A 25%  B 25%  C 25%  D 25%

After passive ejection:
A 33%  B 33%  C 1-5%  D 33%
```

That tiny trickle is sometimes intentional. It lets the system test whether C has recovered without immediately flooding it again.

## Tradeoffs

### Active checks are simple, but easy to oversimplify

A probe that only checks process uptime is cheap and weak. A deeper readiness check is stronger, but can be dangerous if it includes too much.

For example, if your readiness endpoint fails whenever an optional analytics service is down, you can accidentally take your whole fleet out of rotation for a non-critical dependency.

My rule of thumb: **readiness should reflect whether this instance can safely serve its primary function, not whether the universe is perfect.**

### Passive checks reflect reality, but need enough traffic

Passive checks are great because they observe what customers experience. The downside is that they need signal volume.

A backend receiving 5 requests per minute does not produce strong statistical evidence. One timeout might mean disaster, or it might mean noise.

That means passive checks are strongest on high-throughput paths and weaker on quiet internal services.

### Both can flap if thresholds are sloppy

If thresholds are too sensitive, instances bounce in and out of service.

Common causes:

- ejecting after one timeout
- recovering after one successful request
- not separating client errors from server errors
- using mean latency instead of percentiles

Health policy should have hysteresis. It should be harder to re-enter than to stay healthy.

## Common failure modes

### 1. The fake health endpoint

`/healthz` returns 200 as long as the process is alive, even if the thread pool is exhausted and every user request times out.

This is probably the most common mistake.

### 2. Recursive dependency doom

A service marks itself unready because a downstream dependency is unhealthy. Every replica does the same. Suddenly the entire upstream tier disappears from the load balancer, even though some requests could still have succeeded with degraded behavior.

### 3. Shared fate blindness

If all replicas depend on the same broken database, passive checks may eject all of them. That is not wrong, but it is important to understand: health checking is not a substitute for dependency isolation.

### 4. Retry amplification

A backend starts failing. Passive checks detect failure slowly. Clients retry aggressively. The failing backend now sees even more load, which increases failure rate and poisons the passive signal further.

This is why health checks, retry budgets, and load shedding belong in the same conversation.

## How to test it

Health checking is one of those mechanisms that sounds fine in design docs and then surprises you in production. Test it on purpose.

### In staging or game days

- make one replica return slow responses but keep `/readyz` green
- make one replica return 503s for 10 percent of traffic
- break an optional dependency and verify the fleet stays mostly available
- break a critical dependency and confirm traffic drains quickly
- simulate recovery and confirm instances do not flap back too fast

### Metrics to watch

You want observability at both the instance and balancer level.

Track:

- per-backend success rate
- per-backend p95 and p99 latency
- active probe success/failure counts
- passive ejection counts and duration
- traffic share before and after ejection
- request retries caused by backend failure

A very practical dashboard panel is: **backend traffic share + error rate + readiness state on one chart**. If one instance is “ready” while its traffic is erroring out, you have a mismatch worth fixing.

### Logs and traces

Log why a host was marked unhealthy.

Not just “unhealthy,” but:

- `readiness_failed: db_connect_timeout`
- `passive_eject: consecutive_5xx threshold exceeded`
- `recovered: 2m stable success rate`

That turns debugging from folklore into evidence.

## What I would actually do

If I were designing a service from scratch, I would do this:

1. **Use a shallow liveness probe** only for restart decisions.
2. **Use a focused readiness probe** for critical serving dependencies.
3. **Use passive outlier detection** at the proxy or load balancer for real traffic failures.
4. **Add hysteresis** so recovery is deliberate, not twitchy.
5. **Keep optional dependencies out of readiness** unless failure truly makes serving unsafe.

That combination is much more robust than any single signal.

The important mindset shift is that health is not binary. Systems are often healthy, degraded, recovering, overloaded, or lying. Good health checking architecture recognizes that messy middle instead of pretending every instance is either perfect or dead.

## Further reading

- [Kubernetes: Liveness, Readiness, and Startup Probes](https://kubernetes.io/docs/concepts/configuration/liveness-readiness-startup-probes/)
- [Envoy: Outlier Detection](https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/upstream/outlier)
- [Google SRE Book: Handling Overload](https://sre.google/sre-book/handling-overload/)
- [AWS: Health Checks for Network Load Balancer Target Groups](https://docs.aws.amazon.com/elasticloadbalancing/latest/network/target-group-health-checks.html)

The short version: ask your services whether they are healthy, but trust production traffic enough to verify the answer.