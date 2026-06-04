---
title: "System Design Daily: Feature Flag Consistency"
pubDate: 2026-06-04
description: "How to roll out runtime config safely when stale flags, partial propagation, and race conditions can change user behavior." 
tags: ["system-design", "engineering", "distributed-systems", "feature-flags", "reliability"]
---

Feature flags look deceptively simple. Add a boolean, check it in code, roll out slowly, done.

In practice, feature flags are a **distributed systems problem wearing a product-management hat**.

The hard part is not creating the flag. The hard part is making sure the right machines evaluate the right value at the right time, without turning your application into a slot machine where two requests from the same user take different paths for reasons nobody can explain.

My opinionated take: if your system treats flags as "just config," you eventually ship a reliability incident with a nice admin UI on top.

## The problem

Imagine an API fleet with 200 instances across three regions. You introduce a new checkout path behind a flag called `checkout_v2`.

You want to roll it out like this:

- 1% of users for 10 minutes
- 10% for an hour
- 50% if metrics stay clean
- 100% after that

Sounds safe. But then reality shows up:

- one region polls config every 60 seconds, another every 5 seconds
- some edge caches hold the old rules
- one worker process refreshed config, another did not
- a background job and the web app evaluate the same user differently
- analytics counts both old and new paths because the evaluation was not logged consistently

Now you are not running a controlled rollout. You are running **partial truth propagation**.

## Core concepts

### 1. A feature flag is runtime control-plane data

Flags are not just code branches. They are **control-plane inputs** that steer behavior in the data plane.

That means they deserve the same design questions you would ask of any other control-plane system:

- how is config distributed?
- how fresh does it need to be?
- what is the fallback when distribution fails?
- who is allowed to mutate it?
- how do clients know which version they are evaluating?

If you skip those questions, you get the worst kind of bug: everything is technically "working," but not in the same way.

### 2. Consistency requirements depend on the flag

Not every flag needs the same guarantees.

A UI experiment flag can usually tolerate some lag. A kill switch for a bad payments integration cannot.

Here is the useful split:

| Flag type | Tolerable staleness | Typical requirement |
| --- | --- | --- |
| cosmetic A/B test | seconds to minutes | eventual consistency is fine |
| gradual rollout | low seconds | stable bucketing matters more than instant propagation |
| entitlement / permission | very low | consistent evaluation for the same principal |
| emergency kill switch | near immediate | fast propagation and safe default |

Teams get into trouble when they use one infrastructure path for all four.

### 3. Stable targeting matters as much as freshness

Suppose `checkout_v2` is enabled for 10% of users.

If the rule is evaluated by hashing `user_id`, then user `12345` should either always land in the enabled bucket or always land out of it for a given rollout percentage.

That stability is crucial.

Bad targeting looks like this:

```text
request 1 -> user 12345 -> old checkout
request 2 -> user 12345 -> new checkout
request 3 -> user 12345 -> old checkout again
```

That can happen if you:

- hash on unstable inputs like request ID
- evaluate in multiple services with different rule engines
- change rollout math between SDK versions
- mix server-side and client-side evaluation without alignment

For progressive delivery, **deterministic bucketing** is more important than clever UI for percentage sliders.

### 4. Propagation model shapes failure behavior

Most flag systems use one of three distribution models:

- **polling**: instances fetch config every N seconds
- **streaming / push**: a long-lived connection delivers updates quickly
- **snapshot at startup**: config loads on boot and changes only on restart

Polling is simple and robust, but slower.
Push is fast, but adds connection-state complexity.
Startup snapshots are operationally boring and often good enough for coarse toggles, but terrible for emergency response.

The right question is not "which one is best?" It is: **what failure mode can this application afford?**

## A small example

Say your service handles 20,000 requests per minute. You flip a payments kill switch intended to disable a broken provider immediately.

With 60-second polling, worst case looks like this:

- update made at `12:00:01`
- some instances do not refresh until `12:01:00`
- roughly one minute of traffic still hits the bad path

If even 8% of requests use that provider, that is:

`20,000 requests/min × 0.08 = 1,600 risky requests`

That might be fine for a color-theme experiment. It is not fine for a broken payment path.

This is why kill switches usually need one of:

- push-based propagation
- an authoritative server-side evaluation path
- or a local fail-closed rule that does not depend on fresh remote config

## Tradeoffs

### Centralized evaluation vs local evaluation

**Centralized evaluation** means one service decides the flag result and downstream systems trust it.

Pros:

- consistent logic
- easier auditing
- simpler rollout math

Cons:

- adds latency or coupling
- can become a dependency bottleneck

**Local evaluation** means each service or SDK evaluates rules from a copied config snapshot.

Pros:

- low latency
- resilient during brief control-plane outages
- scales well for read-heavy usage

Cons:

- stale config risk
- version skew across SDKs
- harder debugging when services disagree

A common compromise is: **central authoring, local cached evaluation, and explicit versioning**.

### Fail-open vs fail-closed

When the flag service is unreachable, what should happen?

- **fail-open**: keep current behavior or default to enabled
- **fail-closed**: disable the risky path

Neither is universally right.

For safety features, payment guards, or kill switches, fail-closed is often the sane default.
For noncritical experiments, fail-open may preserve availability and user experience.

Just do not let this be accidental. Defaults are architecture.

## Common failure modes

### 1. Split evaluation

The web tier says a user is enabled. The async worker says they are not. The audit log has no idea which one was true.

This often breaks flows that span services, like checkout, onboarding, or message delivery.

### 2. Flag dependency spaghetti

One flag assumes another is enabled first. A third flag overrides both in staging but not prod. Congratulations, you built a hidden state machine without documentation.

### 3. Cache stickiness after rollback

You turn a feature off, but CDN nodes, mobile SDKs, or long-lived workers keep using the old value. The rollback "succeeds" in the dashboard and fails in the real world.

### 4. Missing exposure logs

If you do not record which flag version and variant a request saw, incident review turns into folklore.

For every important evaluation, you want enough context to answer:

- which flag?
- which rule version?
- which subject key?
- which variant?
- evaluated where?

## How to test and observe in production

First, test the control plane, not just the code branch.

Useful tests:

1. **Propagation latency test**
   - flip a flag in staging or a canary environment
   - measure time until all instances report the new version

2. **Cross-service consistency test**
   - send the same user through web, API, and async paths
   - verify all components record the same variant

3. **Rollback drill**
   - disable a live but low-risk feature
   - confirm caches, workers, and clients converge quickly

4. **SDK skew test**
   - run mixed client versions intentionally
   - verify old and new evaluators still bucket users the same way

Production observability should include:

- config version currently loaded per instance
- propagation lag histogram
- evaluation count by variant
- mismatch rate between services for the same principal
- last successful control-plane refresh time
- flag changes in the audit log, tied to deploys and incidents

A simple pseudo-event for logging can be enough:

```json
{
  "flag": "checkout_v2",
  "subject": "user:12345",
  "variant": "enabled",
  "ruleVersion": 42,
  "evaluator": "api-gateway",
  "timestamp": "2026-06-04T18:00:00Z"
}
```

That one event shape makes incident review dramatically less miserable.

## Practical design advice

If I were building a serious flag system, I would insist on a few boring rules:

- use deterministic hashing for percentage rollouts
- version every ruleset explicitly
- separate emergency kill switches from casual experiment flags
- make defaults intentional and documented
- expose current config version in health/debug endpoints
- log evaluations for critical flows
- rehearse rollback before you need it

Feature flags are powerful because they let you decouple deployment from release. But that only works if the flag system itself is treated like production infrastructure, not a convenience wrapper around `if` statements.

That is the real lesson: **a flag is not just a branch. It is a distributed decision.**

## Further reading

- Martin Fowler, *Feature Toggles*: https://martinfowler.com/articles/feature-toggles.html
- LaunchDarkly docs, *Percentage rollouts*: https://launchdarkly.com/docs/home/releases/percentage-rollouts
- Unleash docs, *Strategy variants and gradual rollout*: https://docs.getunleash.io/reference/activation-strategies
- Stripe engineering, *Designing robust and predictable APIs with idempotency* (good example of why stable behavior matters across retries): https://stripe.com/blog/idempotency
