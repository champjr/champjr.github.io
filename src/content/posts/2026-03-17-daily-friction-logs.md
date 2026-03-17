---
title: "Friction Logs: Turning Tiny Annoyances into Compounding Wins"
pubDate: 2026-03-17
description: "A simple daily practice for noticing what slows you down—and fixing the right things."
tags: [workflow, productivity, tools, habits]
---

Most of my “productivity” breakthroughs don’t arrive as thunderbolts. They show up as a mild, repeatable irritation.

- I open a repo and immediately forget where the docs live.
- I paste the same snippet for the 40th time.
- I lose 90 seconds re-finding a command I ran yesterday.
- I do a tiny ritual of window-shuffling before I can start.

None of these are disasters. That’s the problem. Because they’re small, they hide in plain sight.

A **friction log** is just a tiny notebook (literal or digital) where you record those annoyances as they happen. Not to vent. To treat them like bugs.

The pitch is simple:

1. **Notice friction** while you work.
2. **Write it down** in one sentence.
3. Once a day (or week), **fix one item** that will pay rent forever.

It’s boring in the best way.

## Why friction is such a liar

Friction is sneaky because it’s made of *micropayments*.

If something costs you 30 seconds, you can’t justify stopping your flow to fix it. If it costs you 10 minutes, you’ll fix it immediately.

So the “30-second problem” gets billed to your future self, repeatedly, with interest.

There’s also a weird psychological effect: friction doesn’t feel like work. It feels like *you being bad at work*. The narrative becomes “I’m scattered” or “I’m not disciplined,” when the real issue is “my tools are configured in a way that fights me.”

A friction log flips the story. It says: **the system is allowed to be wrong**.

## What counts as friction?

If you can describe it as a verb, it counts.

- “**Re-find** the same link.”
- “**Re-derive** the same command.”
- “**Re-explain** the same context.”
- “**Re-open** the same set of tabs.”
- “**Re-ask** the same question to my future self.”

I’m especially interested in friction that has these traits:

- **Frequent:** it happens multiple times a week.
- **Interruptive:** it breaks your mental thread.
- **Embarrassingly fixable:** you can imagine a 5–30 minute fix.

That last one is key. Friction logs are not a new way to guilt yourself into refactoring your entire life.

## The one-sentence log format

Don’t over-structure it. If you can’t capture it in one sentence, it’s probably not friction—you’ve found a project.

Here’s the format I like:

- **When I** <situation>, **I have to** <annoying step>, **because** <reason guess>.

Examples:

- When I start a new feature branch, I have to re-remember the test command because the README doesn’t say it.
- When I deploy a small change, I have to click through three dashboards because there’s no single “where is my thing?” link.
- When I take notes during a call, I have to decide where they go because my note system has too many “inboxes.”

Notice the tone: factual, slightly annoyed, not theatrical.

## Fix the *smallest* thing that removes the most friction

The goal isn’t to fix every item. It’s to fix **one thing that changes the shape of your day**.

Some high-leverage fixes I’ve seen (and repeatedly re-seen):

### 1) Add a “How to run this” section to the repo

It’s wild how many repos have deep architecture docs and zero “here’s how you actually run the thing.”

A friction log entry like “I keep guessing the dev command” can often be solved by adding 8 lines:

- install
- run
- test
- lint/format
- common env vars

Not glamorous. Extremely kind.

### 2) Make “default commands” memorable

If the right command is `npm run dev`, great. If it’s `npm run dev:local:ssl:fast`, maybe we should talk.

Sometimes the fix is aliasing complexity behind a simpler interface:

- add a `justfile`, `Makefile`, or `task` runner
- create a short `./scripts/dev` wrapper
- add a `bin/` command that does the right thing

This is one reason I like task runners: they turn tribal knowledge into something discoverable.

If you want a good overview of task runners and the “make boring automation easy” philosophy, the **Task** project has nice docs and examples:

<https://taskfile.dev/>

### 3) Create a single “index” note

A lot of note-taking friction is *routing* friction: where does this thought go?

An underrated trick: keep one “index” note that is nothing but links.

- current projects
- active docs
- recurring checklists
- the one place you can always start

Then your friction log entry becomes solvable: you’re not rebuilding a knowledge system; you’re just building a front door.

### 4) Remove decisions, not actions

If you’re constantly switching between three apps to do something, your first instinct might be “automate the actions.”

Often the bigger win is “remove the decision.”

- pick a default folder
- pick a default naming scheme
- pick a default capture tool

The action might still be manual, but the mental load drops.

## A tiny daily ritual that actually sticks

Here’s a version that doesn’t require a personality transplant:

- Keep a note titled **Friction Log**.
- Whenever you hit an “ugh,” add a bullet.
- At the end of the day, choose **one bullet** and do one of these:
  - Fix it in 10 minutes.
  - Reduce it (make it 50% less annoying).
  - Convert it into a clear task you can schedule.
  - Delete it if it’s not real friction.

That’s it.

If you can only do it weekly, do it weekly. The compounding comes from *continuity*, not intensity.

## The unexpected side effect: you stop blaming yourself

This is my favorite part.

A friction log makes you less dramatic about your own brain. When you repeatedly document what’s getting in the way, patterns appear:

- Your environment isn’t predictable.
- Your defaults aren’t obvious.
- Your system expects you to remember too much.

Those are solvable problems.

And when you fix them, you get a very specific kind of confidence: not “I’m a disciplined person now,” but “I can make my tools kinder to me.”

Which is, honestly, the more durable kind.

## One question to start

What’s a tiny annoyance you’ve accepted as normal that you’d be delighted to never see again?

Write that down. That’s your first friction log entry.
