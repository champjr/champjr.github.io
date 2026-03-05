---
title: "Boring Formats, Durable Workflows"
pubDate: 2026-03-05
description: "A small case for choosing boring file formats so your future self can keep shipping."
tags: [workflow, tooling, writing, data, longevity]
---

There’s a special kind of productivity tax you only notice after it’s already charged your card.

It shows up when you:

- open a project from six months ago,
- stare at an inscrutable binary blob with a proprietary icon,
- and realize the only program that can read it was last updated during the Obama administration.

At that moment, you don’t want innovation. You want *boring*.

By “boring,” I mean: widely supported, easily inspected, friendly to diffs, and likely to still be readable when your laptop has been replaced by whatever rectangle we all carry in 2032.

This is a light manifesto for choosing boring formats—because they make workflows durable.

## The durability triangle

When I look back at the systems that have survived my own attention span, they tend to optimize for three things:

1. **Legibility** (can I understand it by looking?)
2. **Portability** (can I move it between tools?)
3. **Composability** (can I glue it into other stuff?)

Boring formats do suspiciously well on all three.

## Plain text isn’t a vibe. It’s a strategy.

Plain text is not magically better than everything else. It’s just the closest thing we have to a “universal adapter.”

- It plays nicely with version control.
- It can be searched with whatever you already have (`ripgrep`, your editor, your OS search).
- It can be transformed with a dozen languages (or one ugly `awk` script you swear you’ll rewrite).

If you’ve never stumbled into it, [The Plain Text Project](https://plaintextproject.online/) is a nice tour of this philosophy.

### Markdown: the 80/20 of writing

Markdown isn’t perfect (it’s basically a family of dialects in a trench coat), but it’s hard to beat for “write once, render anywhere.”

The hidden power move is that Markdown isn’t just for blog posts. It’s for:

- decision logs
- lightweight specs
- meeting notes
- runbooks
- “things I keep forgetting” cheat sheets

If the content matters, I want it in a file I can open without negotiating with an app.

## Data: prefer formats that admit to being data

A lot of “modern” formats are designed around a single tool’s internal needs. That’s fine—until it isn’t.

When I’m storing information I might want to reuse, I try to pick a format that:

- doesn’t hide structure,
- doesn’t require a GUI to edit,
- and won’t gaslight me during a merge conflict.

### CSV: lovable, flawed, and still everywhere

CSV is janky. It’s also ubiquitous.

If you’re reaching for a quick dataset that people can open in anything—from spreadsheets to Python to “I refuse to install dependencies”—CSV is still a strong default.

If you want a canonical reference for the shape of the beast, here’s the classic: [RFC 4180](https://www.rfc-editor.org/rfc/rfc4180).

My personal rule: if the data has *nested structure*, don’t force it into CSV. That’s how you end up with JSON inside a cell, which is the data equivalent of storing your spare keys in a locked safe.

### JSON: great for machines, OK for humans

JSON is fantastic as an interchange format. It’s strict enough to be predictable, and it’s supported basically everywhere.

It’s not always fun to hand-edit, but it’s a lot more fun than debugging why a YAML parser decided your string is actually a timestamp with feelings.

### YAML: powerful, but don’t over-trust it

YAML is ergonomically nice for config. It’s also a minefield if you treat it like a general-purpose data store.

I still use it—just with guardrails:

- keep it small
- avoid cleverness
- prefer explicit strings when ambiguity is possible

Your future self is not impressed by your ability to express a complex graph in whitespace.

## SQLite: the “boring” database that keeps winning

If you need something more structured than files but less “run a server and become a DBA,” SQLite is a gift.

It’s:

- a single file
- queryable with standard SQL
- easy to back up
- easy to move around

SQLite’s own documentation even has a page on when it’s a good fit: [Appropriate Uses for SQLite](https://www.sqlite.org/whentouse.html).

I like SQLite for personal tools, small services, caches, and anything where the data should outlive the code that wrote it.

## Git diffs: choose formats that make change obvious

A format can be “portable” but still hostile to iteration.

If you use Git (or any diff-based review), you quickly learn that **a human-friendly diff is a feature**.

Boring formats shine here:

- A Markdown file shows what changed.
- A JSON file can be pretty-printed and reviewed.
- A SQLite file… not so much (but you can export migrations or snapshots if you care).

This is one reason I’m wary of burying important state in opaque formats—even if the app is great.

## The “escape hatch” test

Here’s the question I try to ask before committing to a tool:

> If I had to leave this tool tomorrow, how do I get my stuff out?

If the answer is “export to PDF,” that’s not an escape hatch. That’s a fire exit that opens into a brick wall.

If the answer is “it’s already plain files in a folder,” congratulations—you just saved your future self a weekend.

## A practical default stack

If I’m starting something new and I want it to last, my boring-by-default choices look like:

- **notes/docs:** Markdown
- **simple lists:** plain text (one item per line) or Markdown
- **small datasets:** CSV
- **structured interchange:** JSON
- **configuration:** simple YAML (or JSON if I’m feeling strict)
- **local structured storage:** SQLite

None of this is edgy. That’s the point.

## The punchline

Tool choice isn’t just about what feels fast today. It’s also about what keeps working when you’re tired, distracted, or coming back after a long gap.

Boring formats turn into durable workflows because they’re forgiving. They don’t demand allegiance. They don’t punish you for switching editors. They don’t require a particular brand of app to remain solvent.

And if you ever find yourself thinking, “But this new format is *so elegant*,” just remember: your future self is not collecting elegance. They’re collecting outcomes.
