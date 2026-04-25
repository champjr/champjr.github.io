---
title: "System Design Daily: Cursor Pagination"
pubDate: 2026-04-25
description: Why offset pagination breaks at scale, how cursor pagination works, and what to watch in production when feeds keep moving underneath you.
tags: ["system-design", "engineering", "distributed-systems", "databases", "api-design", "performance"]
---

Offset pagination looks innocent.

`GET /items?page=5&limit=20` is easy to explain, easy to document, and easy to wire into a UI. Then the dataset grows, writes become continuous, and suddenly page 5 is both slow and unreliable. Users see duplicates, skipped items, or timelines that shift under their feet.

That is why cursor pagination shows up in so many serious systems. It is not because engineers love complexity. It is because once data is large and changing, “start from row 80 and give me 20 more” becomes a bad contract.

## The problem

Imagine a social feed with 10 million posts. New posts arrive every second.

If your API uses offset pagination:

```http
GET /feed?offset=40&limit=20
```

then the database often has to scan or skip the first 40 matching rows before returning the next 20. At small offsets, that is fine. At offset 40,000, it is not charming anymore.

Worse, offsets assume the list is stable between requests. Real systems are not stable.

Example:

1. User loads items 1 to 20.
2. Three new items are inserted at the top.
3. User requests offset 20 for the “next page.”

Now items 18, 19, and 20 may appear again, or some items may get skipped depending on sort order and timing. The API did exactly what it was asked to do. The contract was the problem.

## Core idea: continue from a known position

Cursor pagination replaces “skip N rows” with “continue after this specific item or sort position.”

A typical API looks like this:

```http
GET /feed?limit=20&after=eyJjcmVhdGVkQXQiOiIyMDI2LTA0LTI1VDEyOjU5OjAwWiIsImlkIjoiODQ3MjEifQ==
```

That `after` token usually encodes the last seen sort key, often something like:

- `created_at`
- `id` as a tiebreaker

Conceptually the query becomes:

```sql
SELECT *
FROM posts
WHERE (created_at, id) < (:last_created_at, :last_id)
ORDER BY created_at DESC, id DESC
LIMIT 20;
```

This is the important shift: the database can seek directly into an index instead of counting past a pile of rows.

## Why the tiebreaker matters

A cursor based only on timestamp is a trap.

If 500 rows share the same second-level timestamp, the system needs a deterministic way to continue. Otherwise you can still get duplicates or gaps.

So production-grade cursors usually sort by a pair:

| Primary sort | Tiebreaker | Example |
| --- | --- | --- |
| `created_at DESC` | `id DESC` | feeds, event logs |
| `score DESC` | `id DESC` | ranked search results |
| `updated_at ASC` | `id ASC` | backfill jobs |

The general rule is simple: your cursor should include enough data to uniquely identify a position in the ordered result set.

## A small example with numbers

Suppose your feed is sorted newest first:

```text
(105, 10:05)
(104, 10:04)
(103, 10:03)
(102, 10:02)
(101, 10:01)
```

User asks for 2 items.

Page 1 returns:

```text
(105, 10:05)
(104, 10:04)
```

Cursor encodes `(10:04, 104)`.

Before page 2, two new rows arrive:

```text
(107, 10:07)
(106, 10:06)
(105, 10:05)
(104, 10:04)
(103, 10:03)
...
```

Page 2 query says “give me rows after `(10:04, 104)` in descending order,” so it returns:

```text
(103, 10:03)
(102, 10:02)
```

That is exactly what the user wanted: continue from where they left off, not from wherever offset 2 happens to point now.

## Tradeoffs

Cursor pagination is better for moving datasets, but it is not free.

### What it does well

- Better performance on large ordered datasets.
- More stable results when inserts or deletes happen between requests.
- Works naturally with index range scans.
- Often reduces database CPU for deep pagination.

### What it makes harder

- You usually lose arbitrary page jumps like “go to page 87.”
- Cursors are more complex to design and debug.
- Sorting must be well-defined and stable.
- If ranking changes constantly, a cursor can still feel weird because the ordering itself changed.

This is the practical opinionated bit: if you are building a feed, event log, inbox, or API over a hot table, page numbers are usually a UX fantasy. Pretending otherwise just moves pain from product design into production incidents.

## Common failure modes

### 1. Non-unique sort order

If you sort only by `created_at`, rows with identical timestamps can repeat or disappear across pages.

Fix: add a unique tiebreaker, usually `id`.

### 2. Opaque cursor that is not actually validated

Some teams base64-encode JSON and call it a day. That is fine for opacity, but the server must still validate that the cursor is well-formed, uses expected fields, and matches the current query shape.

Fix: treat cursors like API inputs, not magic strings.

### 3. Cursor mismatch with filters

A cursor created for `status=published` should not be reused against `status=draft` or a different sort order.

Fix: encode filter and sort metadata in the cursor, or reject mismatched cursors.

### 4. Reverse pagination is bolted on later

Teams implement `next` first, then discover the UI also needs `previous`.

Fix: decide early whether you need bidirectional navigation. Reverse cursors usually require symmetric ordering logic.

### 5. Unindexed query path

Cursor pagination does not save you if the database cannot use the index that matches your `WHERE` and `ORDER BY`.

Fix: ensure the index matches the access path, for example:

```sql
CREATE INDEX idx_posts_created_id_desc
ON posts (created_at DESC, id DESC);
```

## How to test it before production

Do not just test page 1.

Test these cases:

1. **Deep pagination**: request 100 consecutive pages and inspect latency.
2. **Concurrent inserts**: add rows between page fetches and verify no duplicates or gaps for the chosen contract.
3. **Concurrent deletes**: remove rows and confirm the API still progresses safely.
4. **High tie density**: generate many rows with identical timestamps or scores.
5. **Filter drift**: reuse old cursors with changed filters and verify rejection behavior.
6. **Reverse navigation**: if supported, verify next then previous lands on the expected boundary.

A good property-based test is: given a fixed snapshot, walking all pages via cursors should return each row exactly once, in order.

## What to observe in production

If cursor pagination matters, monitor it like a real subsystem.

Useful signals:

- p50, p95, and p99 latency by endpoint and query shape
- rows scanned vs rows returned
- duplicate-item complaints in client telemetry
- invalid cursor rate
- percentage of requests that hit deep pagination
- database index usage and slow query logs

Also watch product metrics. If clients almost never paginate past the first few pages, that tells you something. Maybe the UX should favor “load more” or refresh semantics instead of pretending users browse page 63 for fun.

## When offset is still fine

Offset pagination is not evil.

It is perfectly reasonable when:

- datasets are small
- the list is mostly static
- admins truly need arbitrary page jumps
- query cost is bounded and understood

Back-office dashboards and tiny tables do not need a distributed-systems-flavored solution to a boring problem.

But once the list is large, user-facing, and constantly changing, cursor pagination is usually the more honest design.

It aligns the API with how data actually behaves in production: not frozen, not neat, and definitely not waiting politely for page 2.

## Good references

- [Stripe API pagination docs](https://docs.stripe.com/api/pagination)
- [Shopify on relative pagination](https://shopify.engineering/pagination-relative-cursors)
- [PostgreSQL documentation on indexes and `ORDER BY`](https://www.postgresql.org/docs/current/indexes-ordering.html)
- [GitHub GraphQL pagination docs](https://docs.github.com/en/graphql/guides/using-pagination-in-the-graphql-api)
