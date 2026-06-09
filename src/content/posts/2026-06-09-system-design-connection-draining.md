---
title: "System Design Daily: Connection Draining for Safe Deploys and Scale-In"
pubDate: 2026-06-09
description: "How to remove instances from service without cutting live requests in half or turning routine deploys into user-visible errors."
tags: ["system-design", "engineering", "distributed-systems", "load-balancing", "reliability", "architecture"]
---

A lot of production incidents are not caused by the system failing. They are caused by the system **changing membership badly**.

A deploy starts, an autoscaler shrinks a pool, or a node is marked unhealthy. Then a few ugly things happen all at once:

- in-flight requests get cut off
- long-lived connections reset
- retries pile onto the remaining fleet
- error rates spike during what was supposed to be a routine operation

This is exactly the problem **connection draining** is meant to solve.

I think connection draining is one of those topics teams under-invest in because it sounds operational, not architectural. That is a mistake. If your service cannot safely remove one instance at a time, then your architecture is more fragile than it looks.

## The problem

Imagine an API service with 12 instances behind a load balancer. Each instance handles about 800 requests per second. Most requests finish in 40 to 80 ms, but some exports and report-generation calls take 10 to 30 seconds. A few clients also keep HTTP/2 or WebSocket connections open for minutes.

Now you deploy a new version and terminate two old instances immediately.

What happens?

- short requests might survive
- long requests get interrupted
- clients retry, often at the same moment
- the remaining 10 instances absorb both normal traffic and retry traffic
- latency rises, which causes more timeouts, which causes more retries

A clean deploy just became a tiny self-inflicted DDoS.

Connection draining changes the removal sequence:

1. stop sending **new** traffic to the instance
2. let **existing** requests and connections finish, up to a limit
3. force-close only after the drain window expires

That sounds simple, but the details matter a lot.

## Core concepts

### 1. Draining is different from health failure

A draining instance is often perfectly healthy. It is just being **retired gracefully**.

That distinction matters because healthy removal should behave differently from emergency removal:

- **draining**: stop new traffic, allow in-flight work to finish
- **hard unhealthy**: remove immediately because serving anything is worse

If your system treats both states the same way, you lose one of the biggest tools you have for safe deploys.

### 2. You need to think at both request level and connection level

For plain HTTP/1.1, request draining and connection draining are close cousins. For HTTP/2, gRPC, and WebSockets, they are not the same thing.

An instance can have:

- zero new requests assigned
- existing HTTP/2 connections still open
- active streams still running
- idle keep-alive connections that never quite die

So a real drain policy usually needs two rules:

- do not admit new work
- give existing work a bounded amount of time to finish

That second rule is where teams often get sloppy.

### 3. Drain windows are a product decision, not just an infra default

If your longest legitimate request is 20 seconds, a 5-second drain timeout is fake safety. If your drain window is 15 minutes, scale-in gets sluggish and capacity costs drift upward.

A practical drain timeout usually comes from:

- p99 or p99.9 request duration
- whether streaming connections exist
- whether clients retry safely
- how expensive interruption is

There is no universal best value. There is only a value that matches your workload.

## A small example

Suppose one instance handles:

- 700 normal API requests/sec
- 30 long-running report requests/minute
- 200 open keep-alive connections

You want to scale from 10 instances down to 9.

Without draining, the removed instance might drop:

- 15 in-flight short requests
- 8 long-running requests at various completion points
- 200 client connections that all reconnect at once

With draining:

- the load balancer stops assigning new requests at time `t=0`
- the instance keeps serving the 8 long-running requests
- idle keep-alive connections are nudged closed
- after, say, 45 seconds, any remaining stragglers are terminated

If each dropped long-running request causes one retry and each retry consumes 10 seconds of backend work, then abruptly killing 8 requests can easily create **80 seconds of duplicated work** plus client-visible failures. Draining is often cheaper than the retry storm it prevents.

## Tradeoffs

| Choice | Upside | Downside |
| --- | --- | --- |
| Short drain window | faster deploys and scale-in | more interrupted requests |
| Long drain window | fewer user-visible resets | slower rollouts, slower instance turnover |
| Immediate close of idle connections | quicker retirement | more reconnect churn |
| Let all connections linger | gentler on clients | instances may never drain fully |

A few tradeoffs matter most in practice.

### Faster fleet turnover vs. safer request completion

Operations teams often want scale events to complete quickly. Application teams want every request to finish. You rarely get both perfectly.

My bias is to optimize for **predictable bounded grace**, not perfect kindness and not brutal speed. A drain policy that says “let work finish for up to 30 or 60 seconds, then enforce the cutoff” is often the practical middle.

### Long-lived connections complicate everything

WebSockets, SSE, gRPC streams, and very chatty HTTP/2 clients can keep a process alive much longer than normal request latency would suggest.

That means you may need protocol-aware behavior such as:

- sending `Connection: close` on HTTP/1.1 responses
- issuing GOAWAY for HTTP/2 or gRPC so clients stop creating new streams
- refusing new subscriptions while allowing existing streams to end

If you ignore this, your drain policy may look correct on paper and fail in production.

### Draining only works if retries are sane

Even with good draining, some work will still get interrupted. Clients must retry with timeouts, backoff, and idempotency where needed.

A service with unsafe retries turns a graceful drain into duplicate writes.

## Common failure modes

### Treating process exit as the drain mechanism

Killing a process with SIGKILL is not a drain strategy. It is an admission that there was no strategy.

At minimum, the application should:

- stop accepting new work
- surface itself as not ready for new traffic
- finish or cancel in-flight work deliberately
- exit only after a timeout or after all work completes

### Forgetting the load balancer propagation delay

You can mark a node draining in your app, but if the load balancer keeps sending requests for another few seconds, you still get cutovers in the messy zone.

This is especially common when there are multiple layers:

```text
client
  -> CDN / edge proxy
    -> regional load balancer
      -> service mesh sidecar
        -> application instance
```

Each layer may have its own view of endpoint health and retirement state.

### Draining queues but not request handlers, or vice versa

Some services consume both synchronous traffic and async jobs. Teams sometimes drain only one plane.

The result is awkward:

- HTTP requests stop
- background workers keep pulling jobs
- the instance never really goes quiet

A real drain plan needs to cover **all work admission paths**.

### Ignoring stuck requests

A drain window with no maximum is an outage in slow motion. One wedged handler or one dead downstream call can pin an instance forever.

Use deadlines and cancellation. Draining depends on the system being willing to stop waiting.

## How to test and observe it in production

### Test membership removal as a first-class scenario

Do not just benchmark steady-state throughput. Run controlled tests where you remove instances during live traffic.

Useful experiments:

- drain 1 of 10 instances during peak-like load
- drain 3 instances sequentially during a deploy
- simulate a few 30-second requests while draining
- compare graceful drain versus immediate termination
- test HTTP/1.1 and HTTP/2 clients separately

### Measure the right things

The metrics I care about most are:

- requests in flight at drain start
- drain duration per instance
- requests terminated due to timeout
- reconnect rate after drain begins
- retry rate during deploy windows
- p95 and p99 latency during scale-in or rollout
- percentage of instances that fail to drain before force-kill

A healthy draining system should show **predictable small bumps**, not jagged spikes.

### Add structured lifecycle logs

When an instance enters draining, log it clearly. When it stops accepting new traffic, log that too. When it force-closes with 3 requests still running, log that.

You want operators to answer:

- when did drain start?
- who initiated it?
- how many requests were still active?
- what was forcibly terminated?
- did clients reconnect cleanly?

Without that, deploy-time errors become ghost stories.

### Watch deploys as reliability events

A deployment is not just code shipping. It is a repeated resilience test of instance removal.

If every deploy causes a brief error-rate spike, that is not normal background noise. That is architecture feedback.

## What good looks like

A well-behaved service removal path usually looks like this:

```text
mark instance draining
  -> stop new admissions
  -> tell upstreams not to route new traffic
  -> signal long-lived protocols to wind down
  -> wait bounded grace period
  -> cancel stragglers
  -> exit cleanly
```

That sequence is not glamorous, but it is one of the clearest signs that a system is built by adults.

The main lesson is simple: **safe scale-in and safe deploys are part of system design**. If your architecture assumes instances appear and disappear, then you need a deliberate retirement path, not just a startup path.

## Further reading

- [Kubernetes Pod termination and termination flow](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#pod-termination)
- [Envoy draining](https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/operations/draining)
- [Elastic Load Balancing deregistration delay](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/edit-target-group-attributes.html#modify-target-group-health-settings)
- [gRPC graceful shutdown guidance](https://grpc.io/docs/guides/server-graceful-stop/)
