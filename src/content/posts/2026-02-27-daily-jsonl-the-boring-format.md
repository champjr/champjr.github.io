---
title: "JSONL: The Boring Format That Makes Debugging Fun"
pubDate: 2026-02-27
description: "Why one-JSON-object-per-line is quietly one of the best defaults for logs, exports, and scrappy pipelines."
tags: ["workflow", "tooling", "data", "plain-text"]
---

There are two kinds of file formats:

1. The kind you *admire*.
2. The kind you *actually finish projects with*.

JSON Lines (a.k.a. **JSONL**, **NDJSON**) is firmly in category #2. It’s not glamorous. It doesn’t have a conference keynote. Nobody says “wow” when they see it.

And yet, when I’m building anything that smells like **logs**, **exports**, **ingestion**, **scrappy data analysis**, or **“I just need this to work by lunch”**, JSONL is the format I reach for first.

If you’ve never used it: JSONL is just **one JSON object per line**.

```text
{"ts":"2026-02-27T15:42:01Z","event":"signup","user_id":123}
{"ts":"2026-02-27T15:42:07Z","event":"verify_email","user_id":123}
{"ts":"2026-02-27T15:44:19Z","event":"purchase","user_id":123,"sku":"coffee-mug"}
```

That’s it. That’s the whole pitch. Which is exactly why it’s good.

## The superpower: it streams

Regular JSON is *fine* until the moment it’s not.

A single big JSON array looks innocent:

```json
[
  {"id": 1, "name": "A"},
  {"id": 2, "name": "B"}
]
```

But it comes with a bunch of hidden assumptions:

- You can keep the whole thing in memory (or at least parse it as a whole).
- You can write it all in one shot.
- If the file is truncated, you may have nothing.

JSONL doesn’t require any of that. Because each line is a complete record, you can:

- write records as they happen,
- read records incrementally,
- recover data even if the process crashes halfway through.

If you’ve ever watched a long-running export job fail at 98% and thought, *“cool, now I get to learn what despair tastes like,”* JSONL is a nice antidote.

## It plays nicely with Unix tools

A lot of modern tooling is secretly just “Unix pipes with better marketing.” JSONL leans into that.

Want to see the last 20 events?

```bash
tail -n 20 events.jsonl
```

Want to filter down to a particular event type?

```bash
grep '"event":"purchase"' events.jsonl
```

Want to keep only a couple fields and pretty-print them? If you have `jq` installed:

```bash
jq -c '{ts, event, user_id}' events.jsonl | head
```

Even if you don’t use `jq`, the fact that each record is line-delimited means tools like `head`, `tail`, `wc -l`, and plain old text editors become surprisingly useful.

That’s the “boring format” advantage: **your file is still a text file**.

## Debugging is cheap

When something breaks in a pipeline, the fastest path to clarity is often:

- open the file,
- scroll,
- spot the weird thing.

With JSON arrays, a single malformed object can nuke the whole parse. With JSONL, you can often isolate the bad record, drop it, and keep going.

It’s the difference between:

- “the entire dataset is invalid”

and

- “line 18,402 is cursed.”

I prefer cursed lines. They’re actionable.

## It’s a good boundary between systems

A lot of engineering pain comes from boundaries that are too clever.

You want a boundary that:

- multiple languages can write,
- multiple languages can read,
- doesn’t require shared runtime assumptions,
- and won’t explode because somebody added a field.

JSON already gives you the cross-language part. JSONL adds a simple batching story: each line is a message.

It’s basically a poor person’s message queue file. (And sometimes the poor person is you, and the queue is “a cron job and vibes.”)

## A quick mental model: JSONL is “append-only JSON”

If you treat JSONL as an append-only log, the file becomes a timeline. That lends itself to patterns that are hard with other formats:

- **Event sourcing lite:** write events, replay them later.
- **Incremental imports:** keep track of the last processed line.
- **Backfills:** append historical records without rewriting everything.

You can build a lot of reliable behavior out of “append lines, process lines, don’t panic.”

## The gotchas (because nothing is free)

JSONL is simple, but there are a few sharp edges worth acknowledging.

### 1) Newlines in strings

JSON strings can contain newlines (escaped as `\n`). That’s fine.

But if you accidentally emit *literal* newlines inside an object (usually from a sloppy serializer or manual concatenation), you can split a record across lines, which defeats the whole format.

Rule of thumb: **always use a real JSON serializer**, not string-building.

### 2) It’s not self-describing

A random JSONL file doesn’t tell you:

- what schema to expect,
- what each field means,
- whether fields are optional.

That’s not a JSONL-specific problem; it’s a “data gets passed around without documentation” problem.

Fix: include a README next to the export (or put a comment header in a separate file). A tiny bit of context goes a long way.

### 3) It’s not the most compact

Compared to a binary columnar format like Parquet, JSONL is larger and slower to parse. If you’re crunching *tons* of data, you’ll feel it.

But if you’re moving “human-scale” logs and exports—or you value debuggability—JSONL often wins on total cost of ownership.

(And when you outgrow it, JSONL can be a stepping stone: export JSONL, then convert to Parquet in a dedicated batch job.)

## When I reach for JSONL

Here are a few situations where JSONL consistently pays off for me:

- **Application logs** where I want structure without losing the ability to `tail -f`.
- **Data exports** where it’s okay to be verbose, but not okay to fail at the end.
- **Scraping** where I’m collecting records one by one and want to save progress.
- **AI/ML experiments** where each prompt/result pair is a record and I want quick slicing.
- **Migration scripts** where I want “write once, replay many times.”

If it’s a one-off and I don’t want to design a schema up front, JSONL is the comfy sweatshirt of formats.

## Practical tips if you adopt it

1. **Compress it.** JSONL gzips extremely well.
2. **Include a stable id.** Even a UUID helps with deduping.
3. **Add timestamps.** Future-you loves timestamps.
4. **Prefer `snake_case` or `camelCase` consistently.** Pick one. Stick to it.
5. **Treat it like an API.** Once it’s used somewhere, changing field meaning is a breaking change.

## The “boring” point

There’s a quiet power in formats that don’t need a ceremony.

JSONL doesn’t try to be a database. It doesn’t try to be a data lake. It doesn’t try to be a universal everything file.

It’s just: **records, one per line, in a language everybody speaks**.

And that makes it one of those rare defaults that stays good even when the project gets messy.

If you want a quick reference/spec, the JSON Lines site is refreshingly straightforward: https://jsonlines.org/
