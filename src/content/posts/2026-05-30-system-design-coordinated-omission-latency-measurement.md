---
title: "System Design Daily: Coordinated Omission in Latency Measurement"
pubDate: 2026-05-30
description: "Why many latency tests lie, and how to measure systems without accidentally hiding the worst stalls."
tags: ["system-design", "engineering", "distributed-systems", "performance", "observability"]
---

You can build a system that looks fast in dashboards and still feels awful to users.

One of the easiest ways to fool yourself is with **coordinated omission**. It sounds academic. It is not. It shows up any time your load generator, benchmark loop, or client measurement strategy slows down when the system under test slows down. The result is simple and dangerous: the worst delays become undercounted or completely invisible.

If you only remember one line from this post, make it this one: **a system stall does not stop user demand from existing. Your measurements should not pretend it does.**

## The problem

Imagine an API that normally answers in 10 ms. Then once every minute it pauses for 2 seconds because of a GC pause, disk stall, lock convoy, or overloaded dependency.

A user who hits that pause experiences a terrible request.

But many simple benchmarks do something like this:

```text
while true:
  start = now()
  send_request()
  wait_for_response()
  record_latency(now() - start)
```

That loop sends the next request only after the previous one finishes. So during the 2 second stall, it stops generating traffic. It also stops collecting the measurements that real users would have experienced if requests had kept arriving.

That is coordinated omission. The measuring system has accidentally coordinated its behavior with the system being measured.

In other words, your benchmark quietly says, “the server was stuck, so I guess nobody wanted service during that time.” Real production traffic is rarely that polite.

## Core concepts

### 1. Latency is not just per-request, it is also about missed opportunities to serve

Suppose your service normally handles 100 requests per second, which means one arrival every 10 ms.

Now the service stalls for 2 seconds.

A closed-loop benchmark may record one 2000 ms request and then go back to recording 10 ms requests. That sounds bad, but not catastrophic.

A user-centered view is harsher and more accurate. During that 2 second stall, roughly **200 arrival slots** existed. If demand stayed constant, a lot of those users would have observed huge latency, not just one unlucky request.

This is why coordinated omission crushes tail visibility. It compresses a long period of pain into a tiny sample.

### 2. Closed-loop load often hides the problem

Two patterns matter here:

- **Closed-loop**: send a request, wait, then send the next one.
- **Open-loop**: issue requests at an intended arrival rate regardless of how slow prior requests were.

Closed-loop is fine for some experiments, especially when modeling a fixed number of blocked clients. But it is a bad default if you want to understand what an overloaded shared service feels like under continuing demand.

Open-loop testing is usually the safer baseline for latency work because it preserves the arrival process instead of letting the service dictate it.

### 3. Percentiles can look healthy while users suffer

This is the most annoying part.

You can publish p50, p95, and even p99 numbers that look pretty reasonable while a subset of users keeps hitting catastrophic stalls. If your measurement process misses the requests that would have arrived during the stall, the percentile math is built on incomplete evidence.

That makes coordinated omission not just a benchmarking bug, but an observability design bug.

### 4. Histograms need the right recording model

A plain latency histogram is not enough if you record only observed completions and ignore the requests that should have been represented during a long pause.

Some tooling can compensate if you know the expected sampling interval or arrival rate. For example, HdrHistogram and tools built around it can record a measured latency and backfill the implied missed samples for a known interval.

That correction is not magic. It is just a more honest representation of the delay users would have experienced.

## A small example

Assume your service normally sees 500 requests per second, or one request every 2 ms.

Now it stalls for 1 second.

A naive closed-loop client might observe something like this:

- 499 requests at 5 to 8 ms
- 1 request at 1000 ms

That dataset says the median is tiny and the bad event is rare.

But if arrivals should have continued every 2 ms, then the stall affected roughly **500 request opportunities**.

A more honest picture is closer to this:

```text
normal period: 5 ms, 6 ms, 7 ms, 5 ms ...
stall period: 1000 ms, 998 ms, 996 ms, ... 4 ms
```

The exact synthetic values depend on the correction model, but the big idea is constant: a 1 second pause under steady demand is not one bad request. It is a wide band of bad user experiences.

## Tradeoffs

| Approach | Benefit | Cost |
| --- | --- | --- |
| Closed-loop benchmarking | Simple, cheap, easy to reason about | Hides coordinated omission under stalls |
| Open-loop benchmarking | Preserves intended arrival rate | Can increase queueing fast and needs careful capacity control |
| Corrected histograms | More realistic tail distribution | Requires known interval assumptions and better tooling |
| Production-side passive metrics only | Easy to collect everywhere | Often misses user-perceived queueing outside the service boundary |
| Client-side synthetic probes | Better end-to-end view | Extra infrastructure and possible probe bias |

My opinionated take is that **simple benchmarks are useful for throughput exploration, but they are dangerously flattering for tail latency unless you actively defend against coordinated omission**.

## Common failure modes

### Benchmarking with one worker per thread and calling it representative

If each worker blocks on its own response, the test inherits server stalls and stops applying arrival pressure exactly when it should not.

### Watching only server-side latency

Server timing often starts after admission, queueing, or connection acquisition. Users do not care where the wait happened. If they waited 800 ms, it counts.

### Reporting percentiles without the arrival model

A p99 number without knowing whether the load was open-loop or closed-loop is missing context. Two test setups can report the same throughput and wildly different latency truthfulness.

### Mistaking low request count during distress for recovery

Under severe overload, a system may complete fewer requests, which means fewer bad measurements get recorded. Dashboards can look deceptively calmer right when the user experience is collapsing.

### Testing at average load only

Coordinated omission hurts most when queues form, pauses happen, or dependencies wobble. If you benchmark only the happy path, you are basically rehearsing for a different show.

## How to test for it

Start with two complementary load tests.

### Test A: closed-loop baseline

Use your normal request loop and record latency. This gives you the flattering version.

### Test B: open-loop or constant-arrival-rate test

Drive a fixed arrival rate, for example 1000 requests per second, independent of response completion. Then compare percentile distributions.

If Test B suddenly shows much worse tail behavior, that is not an unfair test. It is often the more realistic one.

You can also inject deliberate pauses:

- add a 500 ms stop-the-world pause in the app
- sleep in a hot dependency path
- saturate disk or network briefly
- force lock contention around a shared resource

Then ask a concrete question: **did my measurement system show the stall as one ugly request, or as a broad latency event affecting many arrivals?**

Tools that support constant-rate load generation or corrected recording are worth preferring here.

## How to observe it in production

In production, you usually cannot infer coordinated omission from one metric. You need a few views together.

Watch these at the same time:

- end-to-end client latency, not just handler time
- request arrival rate versus completion rate
- queue depth or pending request count
- connection pool wait time
- GC pauses, CPU steal, disk latency, and downstream timeout rates
- histogram buckets or HDR summaries that preserve tail detail

A good smell test is this: if arrival rate stayed steady, queue depth spiked, and a dependency paused, but your latency chart shows only a tiny blip, your measurement stack is probably being too polite.

Another useful pattern is to compare:

1. server-side latency
2. edge or load-balancer observed latency
3. active probe latency from outside the service

Gaps between those layers often reveal where waiting is being hidden.

## Design implications

Coordinated omission is not just about better benchmarks. It changes system design choices.

If your tail is worse than you thought, you may need:

- tighter admission control
- smaller queues
- aggressive timeouts and hedging in the right places
- fewer shared bottlenecks
- better isolation around GC, compaction, or noisy neighbors
- load shedding before queueing becomes user-visible misery

This is why honest latency measurement matters. Bad measurements do not just mislead the graph. They push teams toward the wrong architecture decisions.

## Final takeaway

The most dangerous latency bug is the one your benchmark edits out of the story.

When systems stall, real demand does not pause in sympathy. Your measurement approach should not, either.

If you care about user experience, use open-loop testing where appropriate, preserve end-to-end timing, and treat corrected histograms as a feature, not a luxury. Tail latency is already slippery enough. There is no need to help it hide.

## Further reading

- [HdrHistogram](https://hdrhistogram.github.io/HdrHistogram/)
- [wrk2: constant throughput, correct latency recording variant of wrk](https://github.com/giltene/wrk2)
- [Gil Tene on Coordinated Omission (Mechanical Sympathy thread)](https://groups.google.com/g/mechanical-sympathy/c/icNZJejUHfE/m/BfDekfBEs_sJ)
- [How NOT to Measure Latency](https://www.slideshare.net/slideshow/how-not-to-measure-latency-60111840/60111840)
