---
title: "Small Tools, Long Half-Lives"
pubDate: 2026-02-21
description: "Why tiny utilities keep surviving—and how to choose (and keep) yours."
tags: [tools, workflow, software, productivity]
---

Some software feels like it’s made of mayflies.

You try a shiny new app, fall in love with the onboarding, and then—three months later—it’s acquired, renamed, paywalled, redesigned into a “platform,” or quietly turned into a web wrapper that forgets what it was for.

And yet, a handful of small tools keep showing up in the background of our work like old friends who don’t need to be interesting to be useful.

- `grep` still greps.
- `ssh` still SSHes.
- `make` still makes.
- Plain text still plain-texts.

These tools have *long half-lives*. They don’t win by being the best-looking thing on your screen. They win by being (1) boring, (2) composable, and (3) difficult to break.

I’ve been thinking about what makes a “small tool” worth adopting—and, more importantly, worth *keeping*.

## The quiet superpower: narrow scope

A small tool does one job. Not “one job” like a marketing bullet point (“We do one job: accelerate synergy!”). One job like:

- “Search lines in a file.”
- “Sync files between machines.”
- “Render Markdown.”
- “Transform JSON.”

Narrow scope gives you three benefits:

1) **A stable mental model.** You don’t have to re-learn it every time it updates.

2) **A stable failure mode.** When something goes wrong, it fails in predictable ways. (The best case is a clean error message; the second-best case is doing nothing.)

3) **A stable place in your workflow.** You can build habits around it.

This is one reason the Unix tradition keeps producing tools that last. The “small pieces, loosely joined” idea isn’t about nostalgia—it’s about *maintainability at the human level*.

If you want the canonical articulation of that mindset, Mike Gancarz’s write-up is still a good reference point:

- https://en.wikipedia.org/wiki/Unix_philosophy

(That page itself links to multiple primary sources; it’s a nice map of the territory.)

## Composability beats completeness

There’s a pattern I keep seeing:

- A complete tool tries to anticipate every possible use case.
- A composable tool tries to be a good citizen in an ecosystem.

Complete tools tend to accumulate features until they become their own operating system. Composable tools tend to stay small because they rely on conventions:

- text in / text out
- exit codes
- pipes
- files

Even if you don’t live in a terminal, the same idea applies in “modern” workflows:

- A note format that other apps can read.
- A task list that exports cleanly.
- A calendar that plays well with other calendars.

The question isn’t “does this app do everything?”

It’s “when I outgrow it, does my data escape cleanly?”

## The durability checklist (my biased version)

When I consider adopting a tool as part of my *actual* workflow—not just a weekend fling—I run a quick checklist. This is not scientific, just scar tissue.

### 1) Plain formats win

If a tool’s core artifact is a plain format, it’s harder for the tool to trap you.

Examples:

- Markdown
- JSON
- CSV (with caveats)
- SQLite

If the format is proprietary *and* undocumented *and* the export story is “we have an API,” that’s usually a “no” for anything important.

### 2) It should degrade gracefully

A durable tool should still be useful when:

- you’re offline
- you’re tired
- you’re on a new computer
- the company disappears

If the tool becomes a pumpkin the moment your login expires, it’s not a tool—it’s a rental.

### 3) It should be scriptable, even if you never script it

Scriptability is a proxy for clarity.

When a tool can be driven by:

- CLI flags
- config files
- a documented API

…it usually means the tool has a stable internal model. Even if you never write a script, you benefit because the “manual” UI is built on something consistent.

### 4) “Boring” is a feature

I don’t mean ugly. I mean *unexciting.*

Exciting tools are great for exploration. Boring tools are great for infrastructure.

Infrastructure should be boring the way a reliable refrigerator is boring. (If your refrigerator starts A/B testing a new “cooling experience,” you should be allowed to throw it into the sun.)

## The hidden cost of novelty

Novelty feels productive because it generates immediate activity:

- new shortcuts
- new automations
- new organizational systems
- new dopamine

But novelty also has a maintenance tail:

- dependencies
- upgrades
- migrations
- “Wait, where did that setting move?”

The more novel the tool, the more likely you’re signing up for ongoing cognitive rent.

This is why I’m increasingly suspicious of workflows that require *constant* rearranging to stay “optimized.”

Optimization is not the same thing as stability.

Sometimes the best workflow improvement is simply choosing a small set of tools you trust, then refusing to keep fiddling with them.

## So what do you do with this?

A practical approach (that I’m trying to follow myself):

1) **Pick a few primitives.** Text files, folders, a calendar, a task list, a place to ship code.

2) **Prefer tools that speak those primitives.** If the tool can’t export to something boring, it’s probably not a long-term friend.

3) **Treat the “platform” layer as optional.** Use the fancy dashboard if it helps. But keep your workflow alive without it.

4) **Write down the rules.** If a tool matters, document how you use it. Not a 40-page wiki—just enough that Future You can rebuild the system after an outage or a laptop swap.

That last point is underrated. Workflows don’t fail because people are lazy. They fail because people are human, and humans forget.

A good tool helps you do the work.

A great tool helps you keep doing the work six months from now.
