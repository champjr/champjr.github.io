---
title: "Context Blocks: the 30-second preface that saves future-you"
pubDate: 2026-02-24
description: "A tiny habit for notes, code, and docs that makes work resumable (and less cursed)."
tags: [writing, workflow, notes, documentation, productivity]
---

There’s a special kind of irritation that only arrives *after* you’ve done the hard part.

You open a note you wrote last week. Or a half-finished branch. Or a doc titled something optimistic like `plan.md`. Inside: a few bullets, a link, and a sentence fragment that looks like it was dictated by a raccoon.

You, staring at it: “Okay… but *why*?”

This is the tax we pay for leaving artifacts without context. Not because we’re careless — because our brains are optimized for *now*, not for “Tuesday-me in six days at 9:13 AM, with a different set of worries.”

The fix I keep coming back to is embarrassingly small:

## Write a context block at the top

A **context block** is a short preface that answers:

- What is this?
- Why does it exist?
- What’s the current state?
- What’s the next move?

It’s 4–8 lines. It takes ~30 seconds. It prevents your future self from doing archaeological work with a toothbrush.

If you’ve ever practiced “README-driven development,” this is the same instinct applied everywhere, not just repositories. (The original idea is usually credited to Tom Preston-Werner: <https://tom.preston-werner.com/2010/08/23/readme-driven-development.html>.)

### The template

Drop this at the top of a note, doc, or even a scratch file:

**Context**: …

**Goal**: …

**Status**: …

**Next**: …

Optional if relevant:

**Constraints**: …

**Links**: …

That’s it. No ceremony. No perfect prose. The point is that the *first screen* tells the story.

## Why it works (and why we keep not doing it)

When you’re mid-task, you’re holding a lot in your head: assumptions, decisions, “I tried X and it was weird,” and the little mental map of where everything lives. That map disappears the moment you switch contexts.

Psychology has a bunch of names for pieces of this. One of the most famous is the **Zeigarnik effect** — the tendency for unfinished tasks to stay mentally “active” and tug at your attention. The details are nuanced (and replication has been debated), but the phenomenon is at least a good shorthand for why half-done work can feel sticky in your brain.

If you want the overview: <https://en.wikipedia.org/wiki/Zeigarnik_effect>

The more practical takeaway: if you don’t externalize the state of the task, your mind tries to keep it warm in RAM, and your attention gets taxed. A context block is a cheap “dump to disk.”

## Where to use context blocks (three high-leverage spots)

### 1) Notes you intend to return to

Not every note needs this. Grocery lists can remain gloriously feral. But anything that’s:

- a plan,
- a decision,
- a research thread,
- a draft,
- a “parking lot” item,

…benefits immediately.

Example context block for a research note:

**Context**: Comparing lightweight comment systems for a static blog.

**Goal**: Pick one that’s simple, cheap, and doesn’t require users to create accounts.

**Status**: Looked at Giscus + Utterances; need to check moderation + theming.

**Next**: Make a shortlist with pros/cons; test the embed locally.

That’s enough to restart the engine.

### 2) Code that you’re actively changing

If you’re working in a branch for more than an hour, add a context block somewhere visible:

- top of the PR description,
- top of a tracking issue,
- top of a `NOTES.md` in the branch,
- even the top of the file you’re touching (temporary and removed later).

A good context block in code looks like this:

**Context**: Refactoring auth middleware to separate parsing vs policy.

**Goal**: Make it testable; stop leaking header parsing into handlers.

**Status**: Parsing extracted; tests passing; need to wire policy + update docs.

**Next**: Add 2 tests for malformed tokens; update handler call sites.

It prevents the classic “I was in the middle of something… I think” moment.

### 3) Decision docs (a.k.a. “why we did the weird thing”)

A surprising amount of tech debt isn’t bad code — it’s *mysterious code*. The code makes sense, but only if you know the decision that shaped it.

Context blocks pair nicely with lightweight decision records (you don’t need a whole bureaucracy). If you want a simple, widely used format, look up “Architecture Decision Records” (ADR). A good intro: <https://adr.github.io/>

Even if you don’t adopt ADRs formally, you can steal their best trick: always capture **why**.

## What to put in each line (so it stays short)

A context block succeeds when it stays brief. Here are constraints that keep it from becoming a novella:

- **Context**: one sentence, written for someone who *didn’t* live in your brain.
- **Goal**: the finish line, not the method.
- **Status**: what’s done + what’s blocked.
- **Next**: the single next action that gets traction.

If you can’t write “Next” clearly, that’s a signal. You’re either missing a decision, waiting on information, or the task is too big. That’s not a failure — it’s your note telling the truth.

## A small opinion: optimize for resuming, not remembering

A lot of “productivity” advice accidentally assumes you should become the kind of person who remembers everything.

That’s a trap.

I think the better standard is: **can I resume this quickly?**

Resuming is mechanical. It’s not about heroic recall; it’s about leaving a breadcrumb trail. Context blocks are breadcrumbs with a label maker.

Also: they’re friendly to other humans. If you ever share a doc, or ask someone for help, a context block is instant clarity. It’s the difference between “hey can you look at this?” and “hey can you look at this *and also guess what universe we’re in*?”

## The only rule

If you do nothing else, do this:

> Before you stop working, write **Status** and **Next**.

Even if the rest is missing, those two lines are enough to prevent cold-start pain.

Future-you is going to open the file, see a clear next step, and feel a tiny, surprising wave of gratitude.

Which is nice.

And if future-you is still annoyed anyway… well, at least you can be annoyed while making progress.
