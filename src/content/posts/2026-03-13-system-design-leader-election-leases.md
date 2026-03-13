---
title: "System Design Daily: Leader Election with Leases (and Fencing Tokens)"
pubDate: 2026-03-13
description: "How to pick one active leader safely, avoid split-brain, and prove it’s working in production."
tags: ["system-design", "engineering", "distributed-systems", "reliability", "operations"]
---

Sometimes you need *exactly one* thing to be in charge.

- One worker should run a periodic job.
- One instance should be the “primary” consumer for a partition.
- One node should coordinate compaction, migrations, or failover.

You can call it “leader election,” but the real problem is: **how do we ensure at most one actor is allowed to do the dangerous work, even during failures?**

This post is about a practical approach that works well in real systems: **leader election using leases**, plus the detail that separates “mostly fine” from “never corrupts data”: **fencing tokens**.

## Problem framing

You have a set of contenders (instances A, B, C). At any moment you want:

1. **Safety:** at most one leader is allowed to execute leader-only operations.
2. **Liveness:** if the leader dies, another contender becomes leader soon.
3. **Observability:** you can tell who the leader is and why.

The trap: in distributed systems, failures are ambiguous.

- A leader can be alive but *partitioned*.
- A leader can be dead, but other nodes don’t know yet.
- Clocks drift.
- Networks pause.

If you get this wrong you create **split brain**: two nodes both believe they’re leader, both write, and your “reliable” system becomes a corruption machine.

## Core concept: a lease is a time-bounded leadership grant

A **lease** is a piece of state stored in a *coordination system* (etcd, ZooKeeper, Consul, a DB row with strong semantics) that says:

> “Holder X is leader until time T, unless renewed.”

The winner becomes leader by **acquiring** the lease; it stays leader by **renewing** it periodically.

Key properties you want from the coordinator:

- **Linearizable writes / CAS** (compare-and-swap) so only one contender can acquire.
- **A single source of truth** for leadership.
- **Failure detection via TTL**: if the leader can’t renew (crash, partition), its lease expires.

### Minimal API (conceptual)

Think in terms of a tiny coordinator API:

```text
Acquire(name, holder, ttl) -> {ok, fencingToken}
Renew(name, holder, ttl)   -> {ok}
Get(name)                  -> {holder, expiresAt, fencingToken}
Release(name, holder)      -> {ok}
```

Many systems don’t expose exactly this, but you can map it:

- etcd: a key attached to a lease (TTL) + compare-and-swap + lease keepalive
- ZooKeeper: ephemeral sequential nodes + watches
- Postgres: `SELECT ... FOR UPDATE` + a row with `expires_at` + conditional update

## The crucial detail: fencing tokens

A lease alone prevents *most* split-brain cases, but there’s a nasty failure mode:

1. A is leader.
2. A pauses (GC pause, STW, host hiccup) long enough to miss renewals.
3. Lease expires; B acquires leadership.
4. A unpauses and continues doing leader-only writes, unaware it lost leadership.

This is how you get “two leaders,” even with TTL.

**Fencing tokens** solve this.

A fencing token is a **monotonically increasing number** issued by the coordinator when leadership is acquired (or renewed, depending on your scheme). The rule is:

- Every leader-only operation includes the token.
- The downstream system rejects operations with a **token lower than the latest seen**.

So even if A comes back from the dead, it can’t do damage—its token is stale.

### Example: fencing on a database writer

Suppose leader writes to a database table that represents some external side effect:

```sql
CREATE TABLE leader_state (
  name TEXT PRIMARY KEY,
  last_fencing_token BIGINT NOT NULL
);
```

When the new leader B starts, it reads and then updates its token:

```sql
-- Pseudocode: reject if token is older
UPDATE leader_state
SET last_fencing_token = :token
WHERE name = 'payments-reconciler'
  AND last_fencing_token < :token;
```

Then every leader-only write (e.g., “mark invoices paid”) is conditioned on the token being current.

If A tries with token 41 but B already advanced it to 42, A’s update affects 0 rows and it knows it’s fenced out.

This pattern is especially important when the “side effect system” is *not* the coordinator (e.g., a database, object store, or a third-party API). Your coordinator can’t stop stale leaders from sending requests; **your target system must defend itself**.

## Tradeoffs and design choices

### TTL length vs failover time

- Short TTL (e.g., 5–10s): faster failover, but more sensitive to pauses and transient network jitter.
- Long TTL (e.g., 60s): fewer accidental failovers, but longer time running without a leader.

A pragmatic rule: pick a TTL comfortably above your p99 “stop-the-world” pause + p99 network hiccup, then renew at something like TTL/3.

Example:

- TTL = 15s
- renew every 5s
- declare leadership lost if renew fails twice

### Coordinator choice

You can build leases with a few backends, but they are not equivalent:

- **etcd / ZooKeeper / Consul:** purpose-built; good semantics; operational overhead.
- **Relational DB:** tempting because you already have it; can work if you’re careful; beware failover behavior and transaction timeouts.
- **Redis:** possible (e.g., `SET key value NX PX`), but correctness depends on deployment mode and failure behavior; be very cautious for “must not corrupt” workloads.

If losing correctness would be catastrophic (double-charging, double-deleting, corrupting), use a coordinator with strong, well-understood semantics.

### What “leader” is allowed to do

Not every action needs strict single-leader semantics.

- If your leader-only action is **idempotent** and safe to run twice, you can relax.
- If it’s **not idempotent** (charging cards, issuing refunds), you want fencing.

The less safe the side effect, the more you should invest in tokens and defensive checks.

## Common failure modes (the ones that bite)

1. **Split brain from pauses** (GC, scheduler stall): solved by fencing tokens.
2. **Clock-based expiration errors:** avoid relying on local time; prefer coordinator TTL semantics.
3. **Thundering herd on failover:** all contenders wake up and hammer the coordinator. Add jitter and exponential backoff.
4. **Stale watches / missed events:** a contender thinks it will be notified, but isn’t. Always re-check state on wakeup; watches are hints, not truth.
5. **Leader does not step down cleanly:** on shutdown, release lease if possible, but don’t *depend* on it.
6. **Coordinator is overloaded:** then elections flap, and your system oscillates. Watch coordinator latency and error rates like a hawk.

## A small concrete architecture example

Let’s say you have 12 worker instances that run background jobs, but you want only one to run a *daily billing finalization* job.

- Workers contend for leadership under name `billing-finalizer`.
- Coordinator is etcd.
- Leader writes to Postgres.

Flow:

```text
[12x workers]
   |  Acquire lease "billing-finalizer" (TTL 15s)
   v
[etcd]  -> returns fencingToken (monotonic)
   |
   | leader runs job; every DB write includes fencingToken check
   v
[Postgres]
```

Pseudo-code:

```python
while True:
  ok, token = etcd.acquire("billing-finalizer", holder_id, ttl=15)
  if not ok:
    sleep(jittered_backoff())
    continue

  leader = True
  start_keepalive_thread(ttl=15, renew_every=5)

  while leader:
    # do leader-only unit of work
    did_work = finalize_billing_batch(token)

    if not did_work:
      sleep(1)

    if keepalive_failed:
      leader = False  # step down
```

And `finalize_billing_batch(token)` does conditional writes:

- Updates that require leadership are guarded by `WHERE last_fencing_token < :token` or similar.
- If the guard fails, the instance aborts immediately.

## How to test and observe it in production

Leader election isn’t “set and forget.” You need to be able to *prove* it’s behaving.

### Metrics to add

- `leader_is_leader{service=...}`: 0/1 gauge per instance.
- `leader_fencing_token{service=...}`: current token held.
- `leader_renew_success_total`, `leader_renew_failure_total`.
- `leader_elections_total` and `leader_stepdowns_total`.
- Coordinator client latency: p50/p95/p99 for acquire/renew.

### Logs you actually want

- “Acquired leadership” with token and TTL.
- “Renew failed” with error type (timeout vs auth vs connection).
- “Stepping down” and *why*.
- “Fenced out” events (token rejected) — these are rare and extremely important.

### Chaos / fault tests

Do these on staging at minimum:

1. **Kill -9 the leader** → new leader should appear within ~TTL.
2. **Network partition leader from coordinator** (but not from DB) → leader should step down; any DB writes after stepdown should be rejected by fencing.
3. **Inject a long pause** (sleep/CPU starvation) → old leader resumes; should fail fencing checks.
4. **Coordinator slowness** (add latency) → observe if renews flap; adjust TTL/backoff.

### Production alerting (practical)

- Page if **no leader for > 2× TTL** (if leadership is required for critical work).
- Warn if election rate spikes (flapping).
- Warn if you see any “fenced out” events—those indicate real-world pauses/partitions that you should understand.

## Opinionated takeaways

- Use **leases** for liveness, but use **fencing tokens** for safety.
- Don’t trust “I’m leader because I feel like it.” Trust only the coordinator.
- If the leader does side effects, defend the side-effect system against stale leaders.
- Treat the coordinator as production-critical infrastructure; monitor it like a database.

## Further reading

- Raft consensus paper (the approachable one): https://raft.github.io/raft.pdf
- etcd leases + keepalive (official docs): https://etcd.io/docs/v3.5/dev-guide/api_reference_v3/
- ZooKeeper recipes (leader election / locks): https://zookeeper.apache.org/doc/current/recipes.html
- Martin Kleppmann on distributed locks / fencing tokens: https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html
