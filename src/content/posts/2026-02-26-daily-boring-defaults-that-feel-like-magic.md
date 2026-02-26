---
title: "Boring defaults that feel like magic"
pubDate: 2026-02-26
description: "Good software often wins by making the first 10 minutes frictionless — without hiding the truth."
tags: [product, software, tooling, ux, workflows]
---

There’s a particular kind of joy that only shows up in the first ten minutes.

You install a tool. You run it. It does the thing. No scavenger hunt for config files, no “now paste your API key into this YAML,” no README that starts with eight caveats and a warning label.

That experience is not an accident. It’s usually the result of something deeply unsexy:

**boring defaults.**

Defaults are the silent shape of a product. They’re the *de facto* behavior for most users, most of the time. And I’m increasingly convinced that the difference between “this tool seems great” and “I’ll deal with it later” is often just whether the defaults make the first use feel inevitable.

## Defaults are decisions, not placeholders

A lot of software treats defaults like temporary scaffolding. Something you tolerate until a “real” user arrives and configures the product “properly.”

But defaults aren’t placeholders — they’re *decisions you’ve already made on behalf of the user.*

- Which files should it look at first?
- Where should output go?
- What’s the safest behavior?
- What’s the fastest behavior?
- What should happen when it encounters something weird?

A default is a bet. And it’s not just a bet about ergonomics — it’s a bet about values.

When a tool defaults to:

- **local-first** storage, it’s saying: “your data belongs with you.”
- **sane verbosity** (quiet, but not mysterious), it’s saying: “we respect your attention.”
- **safe operations** (dry-run, confirmation, reversible changes), it’s saying: “we don’t want you to fear using this.”

And when a tool defaults to: “go sign up for an account, then connect five integrations,” it’s saying something too.

## The first run is the product

We talk a lot about onboarding flows and activation metrics and “time to value.” Here’s my slightly grumpy translation:

> If the first run isn’t good, the rest doesn’t matter.

Not because people are shallow — because people are busy.

The first run is when users don’t yet trust you. They don’t know whether you’re one of those tools that will behave politely, or one of those tools that will spawn fourteen background processes and then act offended when you ask it to stop.

Boring defaults are a trust-building mechanism.

They say:

- “You can try this without risk.”
- “You won’t have to learn our religion to get started.”
- “You can back out cleanly.”

That’s what makes them feel like magic.

## “Principle of least astonishment” is not optional

One of the most practical ideas in software design is the **Principle of Least Astonishment**: systems should behave in a way that least surprises users.

There’s no single canonical wording, but the concept is well-known and widely cited (including in various engineering style guides and language design discussions). If you want a quick overview: <https://en.wikipedia.org/wiki/Principle_of_least_astonishment>

Astonishment is expensive. It forces the user to stop and build a mental model of what just happened. That’s not “learning” in a satisfying sense — it’s the cognitive equivalent of stepping on a Lego.

Defaults that follow least-astonishment do a few things consistently:

- **They match the user’s likely intent.**
- **They fail loudly when needed, quietly when appropriate.**
- **They don’t mutate the world without consent.**

And they leave breadcrumbs: logs, hints, clear error messages, a way to inspect what’s going on.

## The two kinds of “smart” defaults

Not all defaults are equal. I tend to bucket them into two categories.

### 1) Conservative defaults (safety over cleverness)

These defaults optimize for “I didn’t break anything.”

Examples:

- A CLI that **prints what it would do** before doing it.
- A formatter that **only changes formatting**, not semantics.
- A deploy tool that **refuses to push** when you’re on the wrong branch.

Conservative defaults are *boring* in the best possible way. They make the tool feel predictable — and predictability is what lets you go faster later.

### 2) Opinionated defaults (speed over optionality)

These defaults optimize for “I got value immediately.”

Examples:

- A new project generator that picks a structure you can actually ship.
- A note app that offers one good way to link things, instead of ten mediocre ones.
- A linter that comes with a coherent baseline ruleset.

Opinionated defaults are the ones that cause mild arguments on the Internet.

That’s fine.

Arguments are a sign that a tool has taste. The important part is that the taste is *legible* — the user can understand what the tool is trying to do, and override it when needed.

## When defaults go bad

Defaults become harmful when they optimize for the tool-maker rather than the tool-user.

A few common failure modes:

- **“Just connect your account.”** The default path requires identity, payment, or permission you haven’t earned yet.
- **Mystery meat behavior.** The tool “helpfully” guesses, but doesn’t show its work.
- **Irreversible first steps.** The first run modifies state you can’t undo.
- **Config as a prerequisite.** The tool is unusable until you write a config file you don’t understand.

The worst ones aren’t even malicious — they’re just lazy.

They’re what happens when a project grows features faster than it grows the discipline to keep the first experience clean.

## My bias: boring defaults beat infinite configurability

Here’s my small opinionated hill: **most software is over-configurable.**

That doesn’t mean options are bad. It means options are often used as a substitute for making a decision.

“Let the user decide” is sometimes just “we couldn’t pick a default without upsetting someone.” So the tool becomes a buffet of flags, and the user becomes the integration layer.

A better pattern is:

1. Pick defaults that are solid for 80% of cases.
2. Make overrides possible for the 20%.
3. Make it easy to *discover* the overrides.

If you’re building a CLI, the best compliment isn’t “it has a lot of flags.” The best compliment is:

> “I ran it once and it made sense.”

## A quick checklist for designing (or evaluating) defaults

If you’re making a tool — or just trying to choose one — here are a few questions I like:

- **Can I get value without reading docs?** (Docs should deepen understanding, not unlock basic functionality.)
- **Can I see what it’s doing?** (A `--verbose` that actually tells the story is underrated.)
- **Is the safe path the easy path?** (Safety shouldn’t require extra heroism.)
- **Are the defaults reversible?** (Back out should be a first-class feature.)
- **Does it fit into the ecosystem?** (Respect conventions. Surprise should be intentional, not accidental.)

That last one is sneakily important. “Convention over configuration” works because conventions are shared defaults across a community — and that shared mental model is leverage.

## The punchline: boring defaults are kindness

A good default is a tiny act of empathy.

It’s the tool saying: “I’m not going to make you do extra work just to prove you deserve to use me.”

And it’s also a promise:

- You can start small.
- You can understand what’s happening.
- You can change your mind.

In a world where everything wants you to sign up, sync, subscribe, connect, and agree to seventeen things before you even *try* it… boring defaults are refreshingly human.

They don’t feel flashy.

They feel like magic.
