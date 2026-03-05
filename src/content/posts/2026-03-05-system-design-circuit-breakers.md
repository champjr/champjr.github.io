---
title: "System Design Daily: Circuit Breakers (Timeouts First)"
pubDate: 2026-03-05
description: "How to keep one slow dependency from turning into a full-blown outage."
tags: ["system-design", "engineering", "distributed-systems", "reliability", "resilience"]
---

When a service gets slow, it doesn’t usually fail alone.

In a microservice-ish architecture, *slowness propagates*:

- Service A calls Service B.
- B is overloaded and starts taking 2–10 seconds instead of 50–100ms.
- A keeps waiting, ties up its worker threads, and stops answering *its* callers.
- Retries pile on.
- Everything downstream looks “up” (no hard failures), but the whole system is effectively down.

A circuit breaker is a deliberately boring mechanism to stop that cascade. It’s also frequently misused. The opinionated take: **timeouts come first**, then circuit breakers, then retries.

This post is about designing circuit breakers for service-to-service calls: what they are, how to tune them, where they go wrong, and how you observe them in production.

## Problem framing: the “slow is worse than down” dependency

A dependency that is *hard down* (connection refused) usually fails fast. Your code returns quickly, your resources get freed, and your system has a chance.

A dependency that is *soft down* (accepts connections, responds slowly, returns intermittent errors) is more dangerous:

- You hold onto threads, DB connections, and memory while you wait.
- Queues grow, tail latencies explode.
- Callers retry, increasing load on the already-struggling dependency.

Circuit breakers exist to force “soft down” into “fast fail” so the rest of the system can degrade gracefully.

## Core concepts: states, thresholds, and what to measure

A circuit breaker wraps a call (HTTP, gRPC, DB, cache, third-party API) and tracks outcomes.

### 1) The three basic states

- **Closed:** calls flow normally; breaker observes successes/failures.
- **Open:** calls are rejected immediately (or a fallback is used) without attempting the dependency.
- **Half-open:** after a cool-down period, allow a small number of “probe” requests. If they succeed, close the breaker; if they fail, reopen.

### 2) What counts as a “failure”

This is where real designs differ. Common failure signals:

- Timeout
- Connection errors / DNS errors
- HTTP 5xx (sometimes 429 too)
- Application-level “unavailable” errors

A practical heuristic:

- **Always treat timeouts as failures**.
- Treat 5xx as failures.
- Treat 4xx as *usually not* failures (they’re often caller bugs), except **429** if it represents throttling.

### 3) Windowing: consecutive vs. rolling

Two common strategies:

- **Consecutive failures:** open after N failures in a row.
  - Simple, reacts fast.
  - Can flap with bursty traffic.

- **Rolling window:** compute failure rate over the last *K* requests or last *T* seconds; open if it exceeds a threshold.
  - More stable.
  - Needs enough volume to be meaningful.

Most production systems prefer a rolling window with a minimum request volume.

### 4) The “timeouts first” rule

A circuit breaker without timeouts is a seatbelt without brakes.

You should set:

- A **client-side timeout** for the dependency call (including retries).
- A **server-side timeout/budget** for how long the server will work on a request.

Then the breaker observes timeouts and opens accordingly.

## A small example: breaker tuning with numbers

Say Service A calls Service B.

- Normal latency p99 for B: **120ms**
- During incidents, B can degrade to **2–5s**
- A has a thread pool of **200** worker threads
- A receives **300 RPS**

If A waits 5 seconds on every call, the system saturates quickly:

- 300 RPS * 5s ≈ **1500 concurrent in-flight** calls
- But A only has 200 threads
- Result: requests queue, time out, and *everything* looks broken

Design:

- Set B call timeout to **300ms** (or 2–3× the healthy p99, adjusted for your SLA)
- Breaker opens if failure rate > **50%** over a rolling window of **20 requests**, with at least **20** requests observed
- When open, cool down for **10s**, then allow **5** probe calls in half-open

Pseudo-code-ish:

```ts
const breaker = new CircuitBreaker({
  timeoutMs: 300,
  rollingWindowRequests: 20,
  failureRateToOpen: 0.50,
  openStateCooldownMs: 10_000,
  halfOpenMaxProbes: 5,
});

async function getUserProfile(userId: string) {
  return breaker.exec(async () => {
    return await http.get(`/profiles/${userId}`, { timeoutMs: 300 });
  }, {
    fallback: async () => ({
      userId,
      profile: null,
      source: "fallback",
    })
  });
}
```

That fallback might be “return a partial page”, “serve a cached copy”, or “show ‘try again later’ while the rest of the product works.” The key: **fail fast** and keep your own resources healthy.

## Tradeoffs (and the sharp edges)

Circuit breakers are not free. You’re choosing when to give up.

### Pros

- **Containment:** stops cascades and reduces blast radius.
- **Backpressure:** protects your service from tying up resources.
- **Faster recovery:** reduces load on a struggling dependency.

### Cons

- **False opens:** you might reject calls even though the dependency is mostly fine.
- **Reduced functionality:** fallbacks can be stale or incomplete.
- **Complex tuning:** thresholds that work at 1 RPS may fail at 1000 RPS.
- **Operational confusion:** if you don’t expose breaker state, it looks like “mysterious 503s.”

A good circuit breaker design is explicit about the trade: *we prefer partial service over full outage.*

## Common failure modes (how breakers go wrong)

### 1) No timeouts (or timeouts longer than your queueing)

If your timeout is 10s but your request deadline is 1s, you’ve already lost. Timeouts must align with your **end-to-end latency budget**.

### 2) Retrying inside an already-saturated system

Retries multiply load. A good rule:

- **Retry only when the error is clearly transient** (e.g., connection reset)
- Use **exponential backoff + jitter**
- Keep retries *few* (0–2 is often enough)
- Never retry non-idempotent operations unless you have idempotency keys

And remember: circuit breakers often make retries less necessary because they short-circuit quickly.

### 3) Breakers shared across unrelated call paths

If you use one breaker for “all calls to Service B”, a failure in one endpoint can block unrelated endpoints.

Better:

- Break per **dependency + endpoint** (or per “call type”)
- Sometimes per **region/cluster**

### 4) Global synchronized flapping

If every instance uses the exact same cooldown and half-open probe pattern, you can get a thundering herd when the breaker half-opens.

Fixes:

- Add **random jitter** to open cooldowns
- Limit half-open probes
- Consider “gradual ramp” (e.g., allow 1%, then 5%, then 25%)

### 5) Fallbacks that silently hide outages

Fallbacks are great—until they mask real problems.

If your fallback returns “empty data” with HTTP 200, you may quietly degrade correctness. Make fallbacks **observable** and ideally **user-visible** in some subtle way (or at least internally visible).

## How to test and observe circuit breakers in production

A circuit breaker is an operational feature. If you can’t see it, you can’t trust it.

### Metrics to emit

At minimum per breaker key (service+endpoint):

- `breaker_state{state=closed|open|half_open}` (gauge)
- `breaker_rejections_total` (counter)
- `dependency_requests_total{outcome=success|error|timeout}`
- Latency histograms for dependency calls (`p50/p95/p99`)
- Your service’s worker pool saturation (queue depth, active threads)

Also track:

- Percentage of responses served via fallback
- User-impacting error rates upstream

### Logs (sparingly)

Log state transitions (closed→open, open→half-open, half-open→closed) with:

- breaker key
- reason (timeout rate, 5xx rate)
- rolling window stats

Do **not** log every rejected call; use metrics for that.

### Tracing

In distributed tracing, annotate spans with:

- `circuit_breaker.state`
- `circuit_breaker.short_circuited=true|false`
- `fallback.used=true|false`

This makes incident debugging dramatically faster.

### Failure injection / chaos testing

In a staging environment (or carefully in prod):

- Introduce artificial latency to B (e.g., +500ms)
- Introduce error rates (e.g., 30% 5xx)

What you want to see:

- Breaker opens quickly enough to protect A
- A continues to meet its own latency SLO (possibly with partial results)
- When B recovers, breaker closes without herding

A simple checklist:

1) Does A remain responsive when B is slow?
2) Does A shed load rather than pile up queues?
3) Are dashboards obvious about “we’re in fallback mode”?

## A simple mental model: protect your scarce resources

Circuit breakers are about protecting what’s scarce:

- threads
- CPU
- DB connections
- memory
- queue capacity

They convert “waiting” into “decision.” The best designs:

- set tight, realistic timeouts
- degrade intentionally with a well-defined fallback
- make breaker state visible
- avoid synchronized flapping

If you only remember one thing: **timeouts are the real circuit breaker**. The state machine just makes it systematic.

## References (worth bookmarking)

- Martin Fowler — Circuit Breaker pattern: https://martinfowler.com/bliki/CircuitBreaker.html
- resilience4j CircuitBreaker docs (modern JVM reference implementation): https://resilience4j.readme.io/docs/circuitbreaker
- AWS Builders’ Library — Timeouts, retries, and backoff (practical guidance): https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/
- Google SRE Book — Handling overload (context for load + latency): https://sre.google/sre-book/handling-overload/
