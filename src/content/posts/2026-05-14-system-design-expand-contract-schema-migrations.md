---
title: "System Design Daily: Expand-Contract Schema Migrations"
pubDate: 2026-05-14
description: "How to change a live database schema without making deploy day feel like roulette."
tags: ["system-design", "engineering", "distributed-systems", "databases", "reliability"]
---

Most schema migrations are easy in development and rude in production.

On your laptop, you stop the app, run `ALTER TABLE`, restart, and move on. In production, you usually have multiple app versions running at once, a database that cannot disappear for five minutes, background workers still consuming old messages, and a rollback story that gets ugly fast.

That is why I like the expand-contract pattern. It is one of those boring system design habits that saves you from self-inflicted outages.

The idea is simple: instead of making one breaking schema change, you split it into two safe phases.

1. **Expand**: make the schema capable of supporting both the old and new application behavior.
2. **Contract**: after all code paths have moved to the new behavior, remove the old shape.

It sounds slower because it is slower. It is also much safer, and production systems usually reward safe more than clever.

## The problem this solves

A breaking migration assumes the world updates instantly. Real systems do not.

Even if your deploy platform is good, you may still have:

- old pods serving traffic during a rolling deploy
- workers lagging behind the web tier
- retries replaying older request shapes
- analytics jobs reading yesterday's schema assumptions
- rollback pressure if a feature misbehaves

If the schema changes in a way that old code cannot tolerate, you turn a normal deploy into a coordinated distributed transaction. That is exactly the kind of thing we try to avoid elsewhere in system design.

## Core concept: compatibility before cleanup

Expand-contract is really about **compatibility windows**.

During the expansion phase, both versions should work:

- old code with new schema
- new code with old data still present

During the contraction phase, you remove compatibility only after you have evidence nobody depends on it anymore.

A common example is renaming a column.

Suppose you want to replace `full_name` with `display_name` in a `users` table.

### Bad plan

```sql
ALTER TABLE users RENAME COLUMN full_name TO display_name;
```

This is attractive and dangerous. Old application instances now break immediately.

### Expand-contract plan

**Expand**

```sql
ALTER TABLE users ADD COLUMN display_name TEXT;
```

Deploy application code that:

- reads `display_name` when present
- falls back to `full_name` when absent
- writes both fields for new updates

Backfill old rows:

```sql
UPDATE users
SET display_name = full_name
WHERE display_name IS NULL;
```

After all readers and writers have moved over, **contract**:

```sql
ALTER TABLE users DROP COLUMN full_name;
```

Nothing magical happened. You just gave your system time to converge.

## A small production example

Imagine a checkout service doing about 2,000 writes per second. You want to replace a single `status` string with two fields:

- `payment_state`
- `fulfillment_state`

Why? Because `status='done'` has been hiding two independent workflows and causing reporting bugs.

A naive migration would rewrite the app and flip the schema in one release. That is how you get partial deploys where half the fleet writes the new fields and half still expects `status`.

A safer plan looks like this:

| Phase | App behavior | DB shape |
| --- | --- | --- |
| Expand | Old code still works | Add new nullable columns |
| Dual-write | New code writes old + new fields | Both representations exist |
| Read switch | New code reads new fields first | Backfill completes |
| Contract | Remove old writes, then old column | Final schema only |

The dual-write period is annoying, but it buys you rollback safety. If you deploy and discover a bug in fulfillment logic, the old `status` column still exists and still contains fresh data.

## Tradeoffs

Expand-contract is not free.

### Pros

- **Safer rolling deploys**. Multiple app versions can coexist.
- **Rollback friendly**. Old code usually still works after partial rollout.
- **Better for large systems**. Independent services and workers rarely move in lockstep.
- **More observable**. Each phase can be measured separately.

### Cons

- **More code**. Temporary fallback and dual-write logic add complexity.
- **Longer migrations**. One change becomes several deploys plus a backfill.
- **Data drift risk**. Dual writes can diverge if implementation is sloppy.
- **Cleanup debt**. Teams are good at expanding and bad at contracting.

My opinion: this trade is almost always worth it for user-facing systems. The time you “save” with one-shot breaking migrations is often repaid with interest during incident response.

## Common failure modes

This pattern is straightforward, but people still mess it up in predictable ways.

### 1. Writing new fields without backfilling old data

The new code reads `display_name`, but half the rows still only have `full_name`. Everything looks fine in staging because the dataset is tiny. Production says hello.

**Fix:** make backfill an explicit migration phase, not a “we'll do that later” task.

### 2. Forgetting background workers

The web app is updated, but a worker deployed three hours later still writes the old schema. Now your dual-write assumptions are false.

**Fix:** inventory every writer, not just the obvious one.

### 3. Large blocking backfills

`UPDATE huge_table SET ...` sounds clean until it locks rows forever, bloats replicas, or destroys your I/O budget.

**Fix:** backfill in batches, throttle it, and watch replica lag.

Pseudo-approach:

```text
loop:
  update next 5,000 rows
  sleep 100ms
  stop if replica lag or write latency crosses threshold
```

### 4. Contracting too early

You drop the old column because the main service is done, but an ad hoc export job still uses it every morning.

**Fix:** measure reads and writes to deprecated fields before removing them.

### 5. Treating dual writes as permanently acceptable

Temporary compatibility code has a way of becoming folklore.

**Fix:** create the contract step when you create the expand step. If there is no cleanup date, the cleanup date is never.

## How to test it

The test is not “does the migration SQL run?” The real test is “can mixed versions survive?”

I would test at four levels.

### 1. Schema compatibility tests

Run old app code against the expanded schema, and new app code against data that has not been fully backfilled yet.

### 2. Mixed-version integration tests

Spin up two app versions:

- v1 reading/writing old shape
- v2 reading/writing both shapes

Then run realistic traffic through both.

### 3. Backfill rehearsal

Measure how long batch updates take on production-like data volumes. Small tables lie.

Watch for:

- row lock duration
- replication lag
- write latency regression
- WAL/binlog growth

### 4. Rollback drills

After deploying the dual-write code, simulate rollback. If v1 cannot recover cleanly, you do not actually have a safe migration plan.

## How to observe it in production

This is where a lot of teams under-invest.

At minimum, I want these signals:

- count of reads using fallback logic
- count of writes updating old vs new columns
- backfill progress percentage
- replication lag during backfill
- error rate split by app version
- time since last access to deprecated field

A simple migration dashboard beats heroic log archaeology.

You can even expose a metric like:

```text
schema_fallback_reads_total{field="display_name"}
```

When that metric stays at zero for a meaningful period, you have evidence that the contract phase is probably safe.

## The bigger lesson

Expand-contract is not just a database trick. It is a systems habit.

Any time a distributed system needs to change a shared contract, the safest move is usually:

- add compatibility
- migrate traffic or data
- remove compatibility later

That applies to schemas, APIs, queue payloads, cache key formats, and sometimes entire service boundaries.

The pattern feels conservative because it is. Good production engineering is often the art of being conservative in places where chaos is expensive.

If your migration plan depends on every process switching behavior at the exact same instant, you probably do not have a migration plan. You have a wish.

## Further reading

- [Prisma docs: Expand and contract migrations](https://www.prisma.io/dataguide/types/relational/expand-and-contract-pattern)
- [Martin Fowler: Parallel Change](https://martinfowler.com/bliki/ParallelChange.html)
- [GitHub docs: About migrations for PostgreSQL](https://docs.github.com/en/enterprise-server@3.16/admin/configuration/configuring-your-enterprise/about-postgresql-migrations)
