---
title: "The Anti-Feature Roadmap"
pubDate: 2026-03-06
description: "A practical case for saying no—not as stubbornness, but as a design tool."
tags: [product, software, workflow, writing, constraints]
---

There’s a kind of roadmap that doesn’t photograph well.

It doesn’t have a big banner feature at the top. It doesn’t have a heroic “Q3 Initiative” with a logo. It won’t win the meeting by default.

It’s the roadmap made of *not doing things*.

Call it the anti-feature roadmap: the set of deliberate omissions and removals that make the rest of the product (or project, or workflow) actually work.

If that sounds like a fancy way to justify procrastination, fair. But I’m not talking about “we didn’t get to it.” I mean intentional decisions like:

- We will not add a second way to do the same thing.
- We will not support ten configuration knobs when two will do.
- We will delete a screen that’s technically useful but practically confusing.
- We will leave a rough edge because smoothing it would fracture everything else.

In other words: we will treat “no” as a design tool, not as a mood.

## Features are commitments (not toppings)

A feature isn’t a topping you sprinkle on at the end like parsley.

A feature is a commitment:

- **You must explain it.** Documentation, onboarding, tooltips, FAQs.
- **You must support it.** Bug reports, edge cases, upgrade paths.
- **You must integrate it.** How it interacts with other features—especially the ones you forgot you had.
- **You must *own* it.** Someone’s going to rely on it, and now it’s part of your public promise.

That last part is where things get spicy.

Because what looks like “small” on a roadmap can be “permanent” in reality.

A neat example outside software is [Chesterton’s fence](https://en.wikipedia.org/wiki/G._K._Chesterton#Chesterton's_fence): don’t remove a fence you don’t understand, because you’ll discover later what it was protecting. Features are fences too. Once they’re in, they change behavior, expectations, and the mental model. Removing them later is possible—but it’s a *project*, not a checkbox.

## Complexity doesn’t arrive loudly

Nobody wakes up and says, “Today I will create a confusing product.”

Complexity arrives like mail.

One envelope is fine. Ten is annoying. Fifty turns your kitchen counter into an archaeological site.

The danger is that each envelope arrived for a good reason.

- “A customer asked for it.”
- “We needed it for an edge case.”
- “Competitors have it.”
- “It’ll be quick.”

None of those are evil. But the combined effect is a system that asks users to remember too much, decide too much, and configure too much.

And when a product becomes decision-heavy, people don’t become more empowered. They become tired.

So the anti-feature roadmap has a job: keep the counter clear.

## The weird magic of subtraction

Subtraction feels risky because it’s visible.

If you add a feature and it’s mediocre, you can hide it behind a menu, slap “beta” on it, and quietly stop mentioning it.

If you remove something, you are *breaking a promise*—even if the promise was accidental.

Yet, subtraction is often the fastest way to make a product feel better:

- Fewer buttons = fewer wrong buttons.
- Fewer modes = fewer “why did it do that?” moments.
- Fewer options = fewer arguments you have with yourself.

This is not a moral stance. It’s physics.

Every extra mechanism in a system increases the number of interactions between mechanisms. That interaction surface is where bugs live, where confusion grows, and where maintenance costs hide.

## “Worse is better” (sometimes)

There’s an old essay in software culture called “Worse is Better” by Richard P. Gabriel.

It’s frequently summarized as “simple systems win,” but the more interesting point is about *priorities*: you can optimize for simplicity and correctness at the same time only up to a point. After that, one tends to dominate.

Gabriel’s original write-up is worth reading if you haven’t: <https://www.dreamsongs.com/RiseOfWorseIsBetter.html>

I don’t agree with every conclusion people draw from it, but it’s a useful reminder that “best” is contextual.

Sometimes the best product is the one that:

- does fewer things,
- explains itself quickly,
- and keeps working even when you’re not thinking about it.

That’s not glamorous. It’s *reliable*. Reliability is a feature users can’t screenshot but immediately feel.

## A quick test: would you teach this?

Here’s my favorite litmus test for whether a feature should exist:

**Would you happily teach it to a friend?**

Not in a “well, technically…” way. I mean: would you open the app, hand them your phone, and say, “Okay, here’s how this works,” without building a temporary shrine to exceptions?

If teaching requires:

- four caveats,
- a special vocabulary list,
- and a tiny apology,

…that feature might be a symptom.

It could be covering for a missing abstraction. Or compensating for a confusing default. Or offering power where the system lacks coherence.

Sometimes the right move is not “add a toggle.”

Sometimes the right move is “fix the default.”

## Designing constraints on purpose

The anti-feature roadmap isn’t “never add anything.” It’s “add fewer things, better.”

A few tactics that help:

### 1) Pick one obvious path

Many apps fail by offering two ways to do the same job:

- a button *and* a gesture,
- a menu *and* a command,
- a workflow *and* a wizard,

…and none of them are clearly the “main” one.

Pick a default path. Make it excellent. Then, if you add an alternative, make it clearly secondary (and ideally, composable with the first).

### 2) Make “advanced” a place, not a vibe

“Advanced” should be an explicit location, not a slow infection.

If every screen is advanced, nothing is.

Create a boundary: an advanced settings page, an expert mode, a config file. That’s not gatekeeping; it’s ergonomics.

### 3) Sunset plans belong in the same doc as features

If you ship a feature without a removal story, you’re basically adopting a pet without checking your lease.

When you add something, write down:

- what success looks like,
- what metrics (or qualitative signals) you’d watch,
- and what would cause you to remove it.

Even if you never execute the sunset plan, you’ve made the cost explicit.

### 4) Don’t confuse “more” with “better” in your own life

This isn’t just product advice. It’s workflow advice.

I’ve watched myself build mini-operating-systems out of productivity tools—complex capture flows, color-coded tags, nested templates—only to realize I built a bureaucracy to avoid the real work.

The anti-feature roadmap for a personal workflow might be:

- fewer apps,
- fewer tags,
- fewer repeating obligations you no longer believe in.

You don’t need a system that can do everything.

You need a system that helps you do *your* thing.

## The punchline: “no” makes the “yes” legible

There’s a subtle benefit to the anti-feature roadmap: it clarifies what you *are* building.

When you stop adding, your actual priorities become visible.

When you stop supporting five different ways to do the same task, the one remaining way can become *great*.

When you stop chasing edge cases, you can harden the core.

And when you stop treating every request as a mandate, you can start treating requests as what they usually are:

Signals.

Signals about pain.

Signals about confusion.

Signals about unmet expectations.

Sometimes the right response to a request is a feature.

But often, the right response is:

- better defaults,
- clearer language,
- fewer steps,
- or a smaller promise that you can actually keep.

The anti-feature roadmap isn’t a rejection of ambition.

It’s ambition with a budget.

A commitment to build something that still feels crisp a year from now—after the mail keeps arriving.
