---
title: "System Design Daily: Snapshot Isolation and Write Skew"
pubDate: 2026-05-06
description: "Snapshot isolation makes databases feel pleasantly concurrent, until two correct-looking transactions combine into an incorrect result."
tags: ["system-design", "engineering", "distributed-systems", "databases", "transactions", "consistency"]
---

A lot of system design conversations flatten database isolation into a cartoon.

On one side you have "fast but weak." On the other side you have "serializable but expensive."

Reality is more annoying, which is why it is interesting.

One of the most practical traps is **write skew under snapshot isolation**. Teams pick snapshot isolation because it performs well and avoids many obvious anomalies. Then months later they discover that two individually reasonable transactions can violate a business invariant without either one looking broken in isolation.

My opinionated take: if your correctness depends on a rule involving **multiple rows**, you should get nervous whenever someone says, "we're safe, the database uses snapshot isolation."

## The problem framing

Snapshot isolation gives each transaction a consistent snapshot of the database as of some point in time. Reads do not block writes in the same way they do under stricter models, and writers usually only conflict when they update the **same row**.

That sounds great, and often is.

The trap is that many real invariants are not "only one transaction may update row X." They are things like:

- at least one on-call engineer must remain scheduled
- a room cannot be double-booked
- an account cannot exceed a risk limit across several positions
- a warehouse must not allocate more stock than remains across several bins

Those rules live across a **set** of records.

If two transactions read the same snapshot, make decisions from that old picture, and then update different rows, both can commit successfully while the combined result breaks the rule.

That is write skew.

## Core concepts

### Snapshot isolation

Under snapshot isolation, transaction T1 reads from a stable snapshot S1, and transaction T2 may read from the same snapshot S1 even while both are running concurrently.

Each transaction behaves as if the world stays still while it is reading.

The database usually prevents **write-write conflicts** on the same record. If both transactions update row `doctor_7`, one should fail or retry. But if T1 updates `doctor_7` and T2 updates `doctor_9`, both may commit even if they both made their decisions from a stale shared snapshot.

### Write skew

Write skew happens when:

1. two transactions read overlapping data
2. each transaction checks some condition that is true in the snapshot
3. each transaction updates a different row
4. the combined effect makes the condition false

That last part is the killer. No single statement looks insane. The system-level outcome is insane.

## A small example

Suppose an operations team requires **at least one primary database operator on call at all times**.

Table:

```sql
oncall(name, shift_id, active)
```

Current state for shift 42:

```text
Alice active=true
Bob   active=true
```

Now Alice and Bob both open the internal scheduling tool and mark themselves unavailable at almost the same moment.

Transaction T1:

```sql
BEGIN;
SELECT count(*) FROM oncall WHERE shift_id = 42 AND active = true;
-- result: 2
UPDATE oncall SET active = false WHERE shift_id = 42 AND name = 'Alice';
COMMIT;
```

Transaction T2:

```sql
BEGIN;
SELECT count(*) FROM oncall WHERE shift_id = 42 AND active = true;
-- result: 2
UPDATE oncall SET active = false WHERE shift_id = 42 AND name = 'Bob';
COMMIT;
```

Under snapshot isolation, both transactions can commit because they updated different rows.

Final state:

```text
Alice active=false
Bob   active=false
```

The invariant "at least one person remains on call" is gone.

No dirty reads. No lost update on the same row. Still broken.

That is why this issue surprises people. The database is not malfunctioning. It is faithfully implementing the isolation level you chose.

## Tradeoffs

Snapshot isolation is popular for good reasons.

| What it buys you | What it does not buy you |
| --- | --- |
| stable reads within a transaction | protection for every multi-row invariant |
| less blocking for many workloads | serial execution semantics |
| good throughput compared with stricter isolation | automatic detection of write skew |

A few tradeoffs matter in practice.

### Throughput vs stronger guarantees

Snapshot isolation often gives better concurrency than full serializable isolation, especially in read-heavy systems. That makes it attractive for APIs, dashboards, and services with long-running business transactions.

But if the cost of violating an invariant is high, the extra throughput can be a false bargain.

### Simpler application code vs explicit coordination

Developers love writing transaction logic that says, "read current state, check a condition, then update my row." Snapshot isolation makes that pattern look safe more often than it really is.

To make it actually safe, you may need explicit locks, a redesign of the data model, or serializable isolation. None of those are free.

### Local correctness vs system correctness

Each individual transaction can be locally correct and still be systemically wrong. That is the real mental shift. System design is full of these cases.

## Common failure modes

### 1. Invariants encoded only in application logic

If your only guardrail is application code doing `SELECT ...` then `UPDATE ...`, write skew is waiting nearby.

### 2. Tests that never use real concurrency

A unit test that runs T1 and then T2 sequentially will pass forever. The bug lives in overlap.

### 3. Assuming unique constraints solve everything

Unique constraints are great for single-key conflicts like "one email per user" or "one reservation id." They do not automatically protect richer predicates like "no more than N active reservations in this class of rows."

### 4. Long-running snapshots

The longer transactions stay open, the older their view of the world gets. That increases the chance that their decision logic is acting on a picture that is technically consistent but operationally stale.

## How to prevent it

There is no single fix. The right choice depends on the invariant and the workload.

### Option 1: use serializable isolation

If the database offers real serializable isolation, it can detect dangerous structures and force one transaction to retry.

This is the cleanest correctness story, but it may reduce throughput or raise retry rates under contention.

### Option 2: lock the predicate explicitly

Sometimes you can turn a multi-row rule into an explicit lock target.

For the on-call example, you might lock all rows for the shift before checking availability:

```sql
SELECT * FROM oncall WHERE shift_id = 42 FOR UPDATE;
```

That reduces concurrency, but it makes the invariant real instead of aspirational.

### Option 3: materialize the invariant into one row

A surprisingly practical pattern is to keep a single aggregate row that transactions must update.

Example:

```text
shift_42.active_count = 2
```

Now both transactions contend on the same record, which means the database's normal write conflict detection becomes useful.

### Option 4: move the rule into a database constraint, if possible

Sometimes exclusion constraints, check constraints plus careful modeling, or range constraints can encode what application code was hand-waving.

If the database can reject the invalid state directly, do that.

## How to test it

You do not find write skew with polite tests.

I would want:

- concurrency tests that start two transactions from the same initial snapshot
- randomized overlap with sleeps between read and write phases
- invariant assertions after commit, not just per-transaction success checks
- retry-path testing if using serializable isolation
- load tests that simulate the real hotspot predicate, not just random keys

A useful harness looks like this:

```text
1. seed two active operators
2. start T1 and T2 concurrently
3. have both read active_count before either writes
4. let both attempt their update
5. assert final active_count >= 1
```

If that assertion can fail even once, the design is not done.

## How to observe it in production

This is one of those issues where traditional CPU and latency dashboards are not enough.

Track the things that reveal correctness pressure:

- transaction retry rate, especially under serializable isolation
- lock wait time for the rows or predicates protecting invariants
- count of invariant violations detected by downstream audits
- age of open transactions
- business-level sanity metrics, like negative inventory or empty required coverage

I also like adding explicit audit queries or periodic checks for important invariants. Yes, that is defensive. It is also cheaper than discovering the problem from a customer or an incident.

For the on-call example, a tiny production check could be:

```sql
SELECT shift_id
FROM oncall
GROUP BY shift_id
HAVING SUM(CASE WHEN active THEN 1 ELSE 0 END) = 0;
```

If that ever returns rows, something bypassed your intended safety model.

## The practical takeaway

Snapshot isolation is useful because it eliminates a lot of pain without forcing everything through strict serialization.

But it is not magic.

If your invariant spans multiple rows, partitions, or records, ask a blunt question early: **what exact mechanism stops two concurrent transactions from both making a valid local choice that creates an invalid global result?**

If the answer is fuzzy, the bug is probably already in the design.

That is the lesson of write skew. The hard part is rarely the transaction syntax. The hard part is being honest about what has to stay true across the whole system.

## Further reading

- [PostgreSQL docs: Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
- [Berenson et al., A Critique of ANSI SQL Isolation Levels](https://sigmodrecord.org/?smd_process_download=1&download_id=8550)
- [CockroachDB docs: Transaction retries and isolation](https://www.cockroachlabs.com/docs/stable/transactions.html)
