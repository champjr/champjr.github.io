---
title: "System Design Daily: Outlier Detection for Unhealthy Instances"
pubDate: 2026-04-29
description: "A load balancer that keeps sending traffic to the sickest instance is not balanced, it is confused."
tags: ["system-design", "engineering", "distributed-systems", "reliability", "load-balancing", "observability"]
---

A lot of system design talk stops at “put a load balancer in front of it.” That is necessary, but it is not enough. A balancer can spread requests evenly and still do a terrible job if one backend instance is half-broken.

This is where **outlier detection** matters. The basic idea is simple: if one instance is behaving much worse than its peers, stop trusting it for a while.

I think this is one of the most underappreciated reliability features in modern service meshes and proxies. It is not glamorous, but it prevents a very common failure pattern: one sick node poisoning the whole fleet.

## The problem framing

Imagine you have 20 API instances behind a layer 7 load balancer. Nineteen are healthy. One has a noisy neighbor on the host, a bad JVM heap state, a stuck network path, or a dying dependency connection pool.

Average load still looks fine. CPU across the fleet might look normal. But that one instance is now returning 8% errors and taking 2 seconds at p99 while the others are sitting around 120 ms.

If traffic is spread evenly, about 5% of requests will still hit the bad node.

That means your customer experience can look like this:

- 95% of requests: healthy
- 5% of requests: mysteriously awful

That is enough to create support tickets, retry storms, and a vague sense that “the system is flaky.”

Static health checks often miss this. An instance can pass `/healthz` and still be a terrible place to send real traffic.

## Core concepts

Outlier detection is different from basic health checking.

### Health checks ask, “Are you alive?”

A normal health check asks whether the process can respond at all.

```text
load balancer -> GET /healthz -> 200 OK
```

That catches total failures, crash loops, and obvious brokenness.

### Outlier detection asks, “Are you behaving worse than your peers?”

Instead of just checking liveness, the balancer or proxy watches real request behavior:

- consecutive 5xx responses
- local origin failures like connection resets or timeouts
- success-rate deviation from peers
- latency outliers, in some systems

When one instance crosses a threshold, it gets **ejected** temporarily from the backend pool.

```text
client traffic
   |
   v
proxy/load balancer
   |
   +--> instance A  healthy
   +--> instance B  healthy
   +--> instance C  elevated 5xx, timeouts
                    -> eject for 30s
```

After the ejection window, the instance is allowed back in. If it is still bad, it can be ejected again, often for longer.

### Passive vs active signals

There are two broad ways to decide an instance is bad:

- **active checks**: synthetic probes like `/healthz`
- **passive checks**: actual user traffic outcomes

The strongest setups use both. Active checks catch dead instances. Passive checks catch instances that are technically alive but operationally untrustworthy.

## A small example

Suppose your proxy watches consecutive failures and ejects any host after **5 consecutive 5xx responses**.

You have 10 instances receiving 200 requests per second total, so each one gets about 20 RPS.

If one instance starts failing every request:

- after roughly 250 ms, it accumulates 5 failed requests
- the proxy ejects it for 30 seconds
- the remaining 9 instances absorb the traffic

That is much better than letting that node continue harming users until a human notices a dashboard.

A simplified policy might look like this:

```yaml
outlier_detection:
  consecutive_5xx: 5
  interval: 10s
  base_ejection_time: 30s
  max_ejection_percent: 20
```

The important field there is `max_ejection_percent`. Without some guardrail, an overreactive policy can eject too much of the fleet and turn a partial incident into a full outage.

## Tradeoffs

Outlier detection is useful, but it is not free.

| Tradeoff | Benefit | Cost |
| --- | --- | --- |
| Fast ejection thresholds | Removes bad nodes quickly | More false positives during brief blips |
| Longer ejection windows | Protects users from persistent bad nodes | Slower recovery when the node is actually fine again |
| Success-rate based detection | Catches subtle degradation | Needs enough peer traffic to compare meaningfully |
| Conservative max ejection caps | Prevents self-inflicted fleet collapse | Leaves some bad nodes serving traffic during widespread trouble |

My bias is to start conservative and tune from real incidents. Teams often copy aggressive settings from examples without realizing those numbers were chosen for a very specific fleet shape and traffic profile.

## Common failure modes

### 1. Treating health checks as sufficient

A process can answer `/healthz` while:

- timing out on downstream calls
- suffering GC pauses
- holding a saturated thread pool
- failing only a subset of endpoints

If your design assumes green health checks mean safe traffic, you will miss the most annoying class of failures.

### 2. Ejecting the victim instead of the culprit

Sometimes the “bad” instance is only revealing a deeper issue first. Maybe one AZ has packet loss. Maybe one shard is slower than the others. Maybe one dependency subset is degraded.

Outlier detection protects users, but it can also hide systemic problems if nobody investigates repeated ejections.

Think of it as a seat belt, not a diagnosis.

### 3. Retry amplification

Once a request fails on a bad node, clients or upstream services may retry. If retries are not bounded, the bad node creates extra traffic pressure on the rest of the fleet just as they are picking up its load.

Outlier detection works best with:

- sane timeouts
- retry budgets
- circuit breakers or concurrency limits

Otherwise you remove one bad host and still flood the survivors.

### 4. Flapping in and out of service

A weak instance can bounce between healthy and unhealthy every few seconds.

That causes:

- unstable latency
- confusing incident timelines
- poor cache warmth on reentry
- uneven load distribution

Use exponentially increasing ejection time or at least a base ejection plus a cap. Bad nodes should have to earn their way back.

### 5. Over-ejecting during broad dependency failure

If a shared dependency starts failing, every instance may look bad at once. If your proxy ejects too many backends, you can accidentally create total unavailability on top of an already-bad situation.

That is why ejection ceilings matter. Sometimes “serve degraded traffic from all nodes” is safer than “trust almost none of them.”

## How to test it

Do not wait for production to discover whether your outlier policy is too timid or too trigger-happy.

A useful test plan includes:

1. **Single bad instance test**  
   Inject 5xxs or 2-second latency into one backend only. Confirm it gets ejected quickly and that fleet latency improves.

2. **Gray failure test**  
   Make one instance fail only some endpoints or only 10 to 20% of requests. This is closer to reality than hard-down failure.

3. **Shared dependency failure test**  
   Make all instances experience the same downstream errors. Verify your `max_ejection_percent` prevents catastrophic self-ejection.

4. **Recovery test**  
   Restore the bad instance and watch how it reenters. Make sure it does not immediately flap back out under normal warm-up conditions.

5. **Retry interaction test**  
   Measure request volume before and after ejection. A good outlier policy can still fail overall if retries explode.

## What to observe in production

If you use outlier detection, you should treat these metrics as first-class:

- per-instance 5xx rate
- per-instance timeout rate
- per-instance p95 and p99 latency
- number of ejections by reason
- ejection duration and reentry count
- percent of fleet ejected
- retry rate before and after ejection events

A very practical alert is not just “backend errors are high,” but **“the same instance has been ejected repeatedly in the last hour.”** That usually points to a host-level or placement-level problem worth fixing at the source.

Logs and traces also help. When one instance is consistently bad, you want to know whether the issue follows:

- the host
- the zone
- the dependency path
- the deployment version
- the tenant or shard subset

## The design lesson

Good load balancing is not just about distribution. It is about **discrimination**.

A balancer should not keep giving equal opportunity to obviously bad backends. That is not fairness. That is negligence in software form.

Outlier detection gives the system a short memory and a little skepticism. Both are healthy traits in distributed systems.

If you are already running a proxy that supports it, this is one of the highest-leverage reliability features to tune carefully. It will not eliminate incidents, but it can shrink the blast radius of the weird half-failures that make systems feel haunted.

## Further reading

- [Envoy Proxy, Outlier Detection](https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/upstream/outlier)
- [Istio, Outlier Detection](https://istio.io/latest/docs/tasks/traffic-management/circuit-breaking/)
- [The Tail at Scale, Dean and Barroso](https://research.google/pubs/the-tail-at-scale/)
- [Amazon Builders' Library, Timeouts, Retries, and Backoff with Jitter](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)
