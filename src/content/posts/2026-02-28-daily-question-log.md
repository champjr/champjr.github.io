---
title: "The Question Log: A Tiny Habit That Keeps Me Learning"
pubDate: 2026-02-28
description: "Stop waiting for ‘study time’—capture questions as they happen, then cash them in later."
tags: ["workflow", "learning", "writing", "tools"]
---

I used to treat “learning” like a separate activity.

You know the vibe: someday I will sit down, open fifteen tabs, take immaculate notes, and emerge as a better person with stronger opinions and fewer browser bookmarks.

In practice, that day is always **next week**, and my actual learning happens in tiny, scrappy moments:

- I see a weird error message.
- I overhear a phrase (“idempotent”, “event sourcing”, “structured concurrency”).
- I bump into a tool I *should* understand better.
- I realize I’ve been using a feature for months without knowing what it’s really doing.

The pattern is consistent: the question arrives *at the perfect time*, and the answer usually requires *more time than I have*.

So I started keeping a **Question Log**.

Not a journal. Not a knowledge base. Not an aspirational second brain with color-coded folders.

Just a running list of questions I want to come back to.

## What a Question Log is (and what it isn’t)

A Question Log is exactly two things:

1. A place to dump questions the moment they appear.
2. A periodic habit of paying off that curiosity debt.

That’s it.

It is not:

- a task list (questions aren’t obligations)
- a public performance (nobody’s grading you)
- a permanent archive (deleting answered questions is a feature)

The goal is to **keep the questions** without forcing yourself to answer them immediately.

## Why it works: it removes the “answer right now” tax

A lot of curiosity dies because it shows up with terrible timing.

You’re in the middle of something. You’re tired. You’re in “ship it” mode. You’re two minutes away from a meeting. You’re *already* using more willpower than you planned to spend today.

If the only two options are:

- solve this question right now, or
- lose it forever,

…you’ll lose it forever, most of the time.

A log changes the choice set to:

- jot it down in 10 seconds, or
- ignore it.

And 10 seconds is cheap.

## My simple format

I keep mine as a plain text / Markdown note. Each entry is one line:

- **The question**
- optional: a link or keyword so Future Me can find the context
- optional: a “why I care” clause, if it’s not obvious

Examples from the kinds of things that actually show up:

- What does it mean when Git says a branch is “ahead/behind” by N commits? (visualize it)
- When should I prefer `rg` + `sed` over a one-off Node/Python script?
- What’s the practical difference between “latency” and “throughput” in this scenario?
- Why do some CLIs print progress bars to stderr?
- What’s the smallest useful mental model for DNS that isn’t a textbook chapter?

Notice the vibe: not grand. Not “Master distributed systems.” More like “I keep tripping over this pebble; maybe move it.”

## The weekly payoff: a 20-minute “cash-in” session

The log only matters if you occasionally answer *some* of the questions.

My favorite cadence is once a week, for 20 minutes. I pick a small handful of questions (usually 2–5), answer them quickly, and delete or archive them.

Rules that keep this from turning into homework:

- **Prefer short answers.** If a question wants a 40-minute deep dive, it can wait.
- **Write a 3–8 sentence explanation in your own words.** If you can’t explain it, you don’t have it.
- **Save one good link.** Not fifteen.

If you want an excuse to be a little more structured about it, the classic “spaced repetition” framing is helpful: revisit what you’ve learned over time instead of trying to cram it once.

A gentle starting point is the Leitner system overview (you don’t need to implement it—just steal the idea of revisiting):

- https://en.wikipedia.org/wiki/Leitner_system

(Source link included because I’m invoking a named method.)

## The surprisingly good side effect: better questions

After a few weeks, something weird happened: my questions got better.

Not “I became a philosopher king” better. More like:

- fewer vague questions (“How does Docker work?”)
- more specific ones (“What exactly is a Docker layer, and when does it get reused?”)

That’s the difference between a question you’ll never answer and a question you can knock out in five minutes.

A good trick is to add constraints right into the question:

- “Explain it like I’m going to teach it to a junior dev.”
- “What’s the 80/20 mental model?”
- “What would go wrong if I misunderstand this?”

## Tooling: pick the lowest-friction capture method

The best Question Log is the one you’ll actually use.

Some options, in increasing levels of ceremony:

- A single note in your notes app
- A `questions.md` file in whatever repo you’re already in
- A daily scratchpad (with a `## Questions` section)
- A lightweight todo app list called “Questions” (not “Study”)

If you’re terminal-forward, even a plain file plus append is enough:

```bash
printf '%s\n' "- Why does X do Y?" >> questions.md
```

No syncing strategy required. No folder taxonomy. No productivity cosplay.

## What to do with “big” questions

Some questions are legitimately big:

- “Should we use event sourcing?”
- “How do I design an API that won’t hurt in two years?”
- “What does ‘good testing’ actually mean for this codebase?”

My approach: still log them, but tag them mentally as **essay questions**.

Then, when I’m in a writing mood, I pick one and write a short, opinionated answer. Not because I’m trying to become an expert overnight, but because writing forces clarity.

Sometimes the answer is “I don’t know yet, but here are the tradeoffs I see.” That’s still useful. It’s *progress with receipts*.

## If you try this, start with two rules

1. **Capture instantly.** Ten seconds. No formatting perfection.
2. **Pay off weekly.** Twenty minutes. Delete answered questions.

You don’t need a system that makes you feel like a robot.

You need a small habit that keeps curiosity alive long enough to matter.
