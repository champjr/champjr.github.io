---
title: "Keep a Question Backlog (It’s Better Than a To-Do List)"
pubDate: 2026-03-18
description: "A lightweight habit for turning vague curiosity into steady progress—without turning your life into a spreadsheet."
tags: ["daily blog", "writing", "workflow", "learning", "productivity"]
---

Most of my “to-do list anxiety” comes from an honest misunderstanding.

I treat my to-do list like it’s supposed to be a complete model of reality:

- Everything I might need to do
- In the right order
- With the right level of detail
- With the correct amount of urgency

Which is… adorable.

A to-do list is good at one thing: **telling Future Me what Past Me decided was a concrete next action**. That’s it. If I keep shoving half-formed thoughts into it (“learn Kubernetes,” “fix onboarding,” “figure out budgeting,” “improve documentation”), I’m not making a plan.

I’m making a guilt engine.

Lately I’ve been using a different tool for the fuzzy stuff: a **question backlog**.

Not a list of tasks. A list of questions.

## The basic idea

Whenever I notice a recurring itch—something I’m curious about, uncertain about, or vaguely worried about—I write it down as a question.

Examples:

- “What’s the smallest change that would make this onboarding flow feel 30% smoother?”
- “What would break if I removed this feature?”
- “Why does this build take 9 minutes—where is the time actually going?”
- “What’s the one sentence version of what this product does?”
- “If I had to ship a version of this in a weekend, what would I cut?”

And then I stop.

No forcing myself to immediately answer it. No assigning dates. No converting it into 12 subtasks. I just capture the question and let it sit where it belongs: in the realm of **thinking**, not **doing**.

The backlog becomes a kind of personal prompt library.

## Why questions work better than tasks (for early-stage thoughts)

### 1) Questions don’t pretend you already know the solution

A task like “Improve performance” implies you know what “improve” means, where the bottleneck is, and how you’ll measure success.

A question like “Where does the time go in this request?” admits the truth: you’re not sure yet.

It’s a small psychological shift, but it’s huge operationally. You get permission to investigate.

### 2) Questions are naturally scoped by curiosity

When I write a task, I tend to over-scope it.

“Refactor auth layer” isn’t a task—it’s an invitation to disappear into a cave.

But a question like “What is the simplest way to make auth failures easier to debug?” is a flashlight. It points somewhere specific.

If you answer the question, you often get a real next action *for free*.

### 3) Questions survive context switches

To-do lists rot when your context changes.

A task written during a sprint may not make sense a month later when priorities shifted. But a good question often remains valid:

- “What’s the risk of doing nothing?”
- “What assumptions are we making here?”
- “What do users think this button does?”

Questions are more portable than tasks. They’re durable.

(Tasks are still important. They’re just not the right container for uncertainty.)

## How I actually use a question backlog

I keep it simple: one note (or one Markdown file) with a bulleted list.

Every few days, I pick a question and spend 20–40 minutes on it.

That timebox matters. Without it, you accidentally convert “I’m curious” into “I’m rewriting the entire system.” The goal is not to become an expert. The goal is to **reduce uncertainty enough to make a better next decision**.

A session usually ends in one of three outcomes:

1. **A concrete task** (now it belongs on the to-do list)
2. **A decision** (“We’re not doing this; here’s why”)
3. **A smaller question** (you discovered the real problem)

That’s it. No heroics required.

### A tiny template

If you want a low-friction structure, here’s a template that fits in a few lines under each question:

- What do I believe right now?
- What would change my mind?
- What’s a cheap experiment or quick check?

It’s basically a friendly nudge toward falsifiable thinking.

If you like formalizing that mindset, the Wikipedia overview of **Bayesian inference** is a decent rabbit hole (and you don’t have to do math to steal the attitude):

<https://en.wikipedia.org/wiki/Bayesian_inference>

## Where this shows up outside personal productivity

This isn’t just a self-help trick. Teams do versions of this (often without naming it).

- Product teams call them “open questions” or “risks.”
- Engineering teams call them “unknown unknowns” (then immediately regret summoning that phrase).
- Research-y orgs call them “problem statements.”

A question backlog is just a personal, lightweight way to keep that practice alive.

And it plays nicely with writing.

If you ever struggle with blogging or note-taking, questions are great seeds. A post that starts with “Why do we do X this way?” practically writes itself—because your job is to explore, not to perform certainty.

## What makes a *good* backlog question

Some questions are basically tasks wearing a trench coat.

- “Should I refactor the database schema?” (probably too solution-shaped)

Better:

- “What’s the specific pain we’re trying to solve, and how often does it occur?”
- “What are the failure modes we’re seeing in production?”

Good questions are:

- **Actionable to investigate** (you can take a step toward an answer)
- **Specific about the uncertainty** (what don’t you know?)
- **Not too future-y** (avoid “What will the market do in 2030?” unless you enjoy suffering)

My favorite test is: *Could I answer this in a single sitting with internet access, a codebase, or a conversation?* If yes, it’s backlog-friendly.

## The best part: it makes “doing nothing” an explicit choice

A normal to-do list has a silent failure mode: anything you don’t do just sits there, quietly judging you.

A question backlog gives you a healthier alternative. You can look at a question and say:

- “Not important anymore.”
- “This was a worry, not a problem.”
- “Useful, but not worth the cost right now.”

And you can delete it.

Deleting a question feels like closure, not neglect.

## If you try one thing

Start with five questions. Real ones—things you keep circling mentally.

Then pick one and timebox 30 minutes.

At the end, force an output:

- one task,
- one decision,
- or one smaller question.

That’s a system.

It won’t make you a productivity superhero. It will make you calmer. And oddly, it tends to make you faster—because you spend less time pretending uncertainty is a task you can “just knock out.”
