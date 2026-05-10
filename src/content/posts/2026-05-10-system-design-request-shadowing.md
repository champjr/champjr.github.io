---
title: "System Design Daily: Request Shadowing"
pubDate: 2026-05-10
description: "How to safely mirror production traffic to new code paths without letting your test become a second outage."
tags: ["system-design", "engineering", "distributed-systems", "testing", "reliability", "observability"]
---

Most teams say they want production realism. Very few teams actually want production risk.

That is the gap request shadowing tries to close.

Request shadowing, sometimes called traffic mirroring, means taking a real production request, sending the primary copy to the system that serves the user, and sending a second copy to a shadow system that does **not** affect the user-visible result. The goal is simple: exercise new code, new infrastructure, or a new dependency with realistic traffic before promoting it.

I like shadowing because it is honest. Synthetic load tests are useful, but they rarely capture the weird shape of live traffic: skewed keys, bursty tenants, malformed payloads, slow downstreams, and all the ugly long-tail cases people forget to generate. Shadowing gives you realism without asking users to be your canary.

But there is a catch. Mirroring traffic sounds safe right up until the shadow path overloads a dependency, leaks side effects, or becomes expensive enough to hurt the main path. So the real topic is not "how do I copy requests?" It is "how do I copy them without creating a second incident?"

## The problem request shadowing solves

Suppose you are replacing a search service.

The old service handles 4,000 queries per second. The new one looks good in staging, passes benchmarks, and survives replayed logs from last week. That is still not the same as running against live production traffic, where:

- some queries are much more expensive than others
- popular tenants create hot partitions
- payloads contain weird optional fields
- client timeouts shape the request mix
- caches make the traffic distribution non-obvious

A dark launch with request shadowing lets you answer practical questions before cutover:

- Does the new service stay within latency and CPU budgets?
- Does it return results comparable to the old service?
- Which request classes regress?
- Do real production headers, auth context, and payload sizes break anything?

That is much better than learning the answer during the first 5 percent of live rollout.

## Core concepts

### 1. One request, two fates

In a shadow setup, the primary path is the source of truth. The user waits only for that result. The shadow path is fire-and-forget from the user's perspective.

```text
Client -> Edge/API -> Primary service -> Response to user
                 \
                  -> Shadow service -> logs/metrics/diffing only
```

That design protects the user experience. If the shadow target is slow or broken, the main response should still complete normally.

### 2. Shadow traffic must be side-effect safe

This is the biggest rule.

You should not mirror unsafe writes into a system that will send emails, charge cards, mutate production state, or enqueue real jobs. If the request includes writes, the shadow environment needs one of these protections:

- write suppression
- fake downstreams
- isolated databases and queues
- explicit "shadow mode" branches that skip side effects

If you cannot guarantee side-effect safety, do not shadow that endpoint.

### 3. Compare outputs, not just health

A shadow system that stays up but returns different answers is not ready.

Shadowing is most valuable when you compare:

- status codes
- response shapes
- ranking order
- counts and aggregates
- latency distributions

Not every diff is bad. Timestamps, generated IDs, and nondeterministic ordering may vary. Good shadow systems define what equivalence means before they start diffing.

### 4. Sample aggressively, not blindly

Mirroring 100 percent of production traffic is often unnecessary and sometimes reckless. A better pattern is targeted sampling:

- 1 percent of all traffic at first
- 100 percent of one low-risk endpoint
- specific tenants or regions
- only requests below a payload-size threshold

My bias is to start too small, prove isolation, then ramp up.

## A concrete example

Imagine a product catalog API moving from Elasticsearch to OpenSearch, or from one index layout to another.

Primary request:

```http
GET /search?q=running+shoes&tenant=us-store&limit=20
```

Mirroring policy:

- 10 percent of `/search` requests are shadowed
- shadow request carries `X-Shadow-Request: true`
- shadow service writes metrics and top-20 result IDs
- a diff worker compares the old and new rankings offline

You might record something like:

| Metric | Primary | Shadow |
| --- | --- | --- |
| p95 latency | 120 ms | 155 ms |
| error rate | 0.2% | 0.5% |
| top-5 result overlap | baseline | 92% |
| CPU at 10% mirrored traffic | 48% | 67% |

That tells you something useful fast. The new stack is not catastrophically wrong, but it is slower and more expensive. Better to learn that before full cutover.

## Tradeoffs

Request shadowing is powerful, but it is not free.

First, it adds cost. You are literally running extra traffic through extra systems. If you mirror 20 percent of a hot endpoint, you should expect extra CPU, network, storage, and observability spend.

Second, comparisons can lie. If the new system depends on current state that differs from the primary system, diffs may reflect data drift rather than logic bugs. That is common when caches, indexes, or replicas are out of sync.

Third, the mirror point matters. Mirroring at the edge captures real user inputs, but it may miss internal enrichments added later in the request path. Mirroring deeper in the stack includes more context, but now your shadow depends on more of the existing architecture.

Finally, shadowing is a testing method, not a release strategy by itself. A system can look healthy under shadow traffic and still fail under real cutover because real cutover introduces feedback loops like user retries, cache fills, and write amplification.

## Common failure modes

### Letting shadow traffic hit real side effects

This is the classic unforced error. Someone mirrors order-creation requests, and the shadow path sends duplicate emails or touches a payment provider. The safest assumption is that every write path is dangerous until proven otherwise.

### Making the primary path wait on shadow work

If the proxy or application spends too much time cloning payloads, serializing large bodies, or waiting on shadow dispatch, you have accidentally turned a test harness into user latency.

### Comparing raw responses without normalization

If one system returns items in slightly different but acceptable order, or generates different tracing metadata, naive diffing produces noise. Too much noise and the team stops trusting the signal.

### Ignoring load-dependent behavior

A shadow service at 5 percent mirrored traffic may look great, then fall apart at 50 percent because cache locality changes, GC pressure rises, or one shard gets hot. Traffic shape matters as much as traffic volume.

### Forgetting downstream dependencies

You may isolate the shadow service itself and still accidentally overload a shared database, auth service, feature flag backend, or metrics pipeline. A shadow environment is only isolated if its dependencies are isolated enough too.

## How to test and observe it in production

Start with a small plan, not a heroic one.

1. **Verify side-effect suppression.** Intentionally send known write-like requests and confirm nothing external happens.
2. **Measure primary overhead.** Compare latency and CPU with mirroring off and on. Shadowing that adds 15 ms to the main path is already suspicious.
3. **Ramp traffic in steps.** For example: 1 percent, 5 percent, 10 percent, 25 percent. Hold each level long enough to see steady-state behavior.
4. **Diff by request class.** Break results down by tenant, endpoint, query size, and payload complexity. Averages hide the interesting failures.
5. **Kill the shadow path on purpose.** Make sure the primary path keeps working when the shadow target times out, returns 500s, or disappears.

In production, the core dashboards should include:

- mirrored request rate
- primary-path latency overhead from mirroring
- shadow-path latency and error rate
- diff rate, by endpoint and tenant
- shared dependency saturation
- dropped shadow requests due to sampling or backpressure

A useful alert is not just "shadow errors are high." It is "shadow errors are high **and** they are correlated with a shared dependency that also serves production." That is where a test becomes a real risk.

## A practical implementation pattern

A clean pattern is:

- mirror at the edge or gateway
- tag mirrored traffic explicitly
- route it to isolated compute and storage
- store compact comparison artifacts, not full payloads forever
- make shadow dispatch best-effort, never blocking

Pseudo-config:

```text
if request.path startsWith "/search" and sample(0.10):
  send primary(request)
  send shadow(request, headers={"X-Shadow-Request": "true"}) asynchronously
else:
  send primary(request)
```

And inside the shadow service:

```text
if header["X-Shadow-Request"] == "true":
  disable side effects
  log comparable output
  skip user-facing notifications
```

It is not glamorous, but it works.

## The practical takeaway

Request shadowing is one of the best ways to test system behavior under real traffic without making users pay the price. Used well, it gives you realistic inputs, safer migrations, and much better confidence before rollout.

Used carelessly, it gives you duplicate side effects, hidden costs, and confusing data.

So here is the opinionated rule: mirror reads freely, mirror writes only with paranoia, and treat the shadow path like a potentially hostile load generator until you have proved otherwise.

Further reading:

- [Google Cloud Service Mesh, traffic mirroring](https://cloud.google.com/service-mesh/docs/traffic-management/traffic-mirroring)
- [Istio documentation, Mirroring traffic to HTTP services](https://istio.io/latest/docs/tasks/traffic-management/mirroring/)
- [NGINX documentation, Mirroring HTTP requests](https://nginx.org/en/docs/http/ngx_http_mirror_module.html)
- [Amazon Builders' Library: Ensuring rollback safety during deployments](https://aws.amazon.com/builders-library/ensuring-rollback-safety-during-deployments/)
