---
title: "The 5-Minute Sandbox"
pubDate: 2026-03-20
description: "A tiny, low-stakes space to explore an idea before you commit to building the whole thing."
tags: ["workflow", "software", "writing", "thinking", "productivity"]
---

Most of my best work starts in a place that looks a little embarrassing.

Not a polished repo.
Not a pristine Notion doc.
Not a beautifully named folder with a responsible README.

More like:

- a scratch file called `tmp.js`
- a note titled “uhh maybe?”
- a napkin diagram that is 70% arrows and 30% regret

I used to treat these as “not real work.” Now I think they’re the opposite: the scratchpad is where real work begins, because it’s where you can be wrong cheaply.

I’ve come to rely on something I’ll call the **5-minute sandbox**: a deliberately small, time-boxed space where you can poke at an idea without committing to the whole production.

It’s not a methodology. It’s not a productivity system. It’s more like giving your brain a kiddie pool instead of demanding an Olympic lap.

## The problem: commitment too early

A lot of tools (and a lot of our own self-talk) push us to commit before we’ve even touched the problem.

You want to try an idea, and suddenly you’re:

- choosing a framework
- naming a project
- picking a folder structure
- thinking about “how it will scale”
- worrying if it should be in TypeScript

You haven’t even proven the thing is worth doing, but you’re already negotiating the terms of a 30-year mortgage.

Early commitment is a quiet creativity killer. It turns exploration into performance.

And when exploration turns into performance, your brain does what it always does under performance pressure: it reaches for the safest possible move.

Which is how you end up “just doing what you did last time,” even when you were excited about doing something different.

## The 5-minute sandbox: rules of the pool

The sandbox is a tiny container with a few constraints that make it safe:

1. **It has a short timer.** Five minutes is a vibe, not a stopwatch. The point is: this is *not* the whole project.
2. **It can be ugly.** You are allowed to write the world’s most cursed variable names.
3. **It’s disposable.** If you delete it, nothing of value is lost (except maybe your ego).
4. **It’s for learning, not shipping.** The output is understanding.

This flips a switch.

When you know you’re not “building the real thing,” you can ask better questions:

- What do I *actually* not understand here?
- What’s the simplest version that proves the core?
- Where does this idea break if I push on it?

Most importantly: you stop confusing “I haven’t committed” with “I’m not making progress.”

## What counts as a sandbox?

Anything that lowers the stakes.

Here are a few formats that work well:

### 1) A single file script

Open a new file. No project. No dependencies. Just:

- parse the input
- transform it
- print the output

I’m constantly amazed how often this reveals the whole shape of the problem.

You don’t need a full app to learn whether the logic is annoying.

### 2) A REPL / notebook / “evaluate this line”

REPLs are honesty machines.

They don’t care about your architecture. They don’t care about your intentions. They care about the value of `x` right now.

Even if you never ship from the sandbox, the REPL gives you the kind of feedback loop that production code often hides behind layers of ceremony.

### 3) A “fake UI” in plain text

Before you build the interface, write it as a text flow.

Example:

- User types a query
- We show 5 results
- They pick one
- We ask one follow-up
- We output the final thing

If the text version is confusing, the polished version will be confusing too—just with nicer shadows.

### 4) A deliberately throwaway branch

I love a branch that starts with a message like “spike:” or “scratch:”

It gives you permission to do weird things without the guilt of “this will be in history forever.”

(And yes, I know it *is* in history forever. The point is psychological.)

## The secret benefit: you become nicer to yourself

The 5-minute sandbox isn’t just a coding trick. It’s a self-management trick.

A lot of procrastination is actually **fear of commitment** masquerading as laziness.

If you tell yourself, “I have to solve this today,” your brain starts scanning for escape routes.

If you tell yourself, “I’m going to play with this for five minutes,” your brain goes, “Fine. I can survive five minutes.”

Once you start, you often keep going. Not because you’re disciplined, but because the work stops being threatening.

This is the same reason “rubber duck debugging” works: you lower the social stakes and give your brain a simple, safe channel to externalize thoughts. The classic explanation is worth reading if you’ve never run your own monologue at an inanimate object: <https://en.wikipedia.org/wiki/Rubber_duck_debugging>

## What you do with the sandbox output

A sandbox should produce one of three things:

1. **A green light.** “Okay, this is promising.”
2. **A red light.** “This is not worth it,” or “this is more complex than I want right now.”
3. **A map.** “Here are the unknowns I need to resolve next.”

Notice what’s missing: a complete implementation.

If you try to turn the sandbox into the real thing, you’ll usually drag its bad habits into production:

- weird globals
- no tests
- unclear naming
- no structure

The sandbox is allowed to be a mess because it’s a tool for thinking.

The handoff moment is: when you *understand* the shape of the thing, you start the real project with a clean slate and a clearer head.

A practical pattern:

- Do the sandbox.
- Write down 5–10 bullets: what you learned, what surprised you, what the minimal “real” version should be.
- Then decide: build, defer, or drop.

If you build, you build from the bullets—not from the messy scratch code.

## A small opinion: the “real work” is the learning

We tend to treat learning as overhead.

But in knowledge work, learning is the work. Shipping is what you do *after* you’ve learned enough to ship responsibly.

The 5-minute sandbox is a way to make learning feel legitimate. It gives you a clear artifact (“I tried it”) and a clear boundary (“I didn’t over-invest”).

It’s also, frankly, a way to keep your inner perfectionist from grabbing the steering wheel and driving you into a ditch.

So the next time you feel yourself stalling because the “right” way to start feels heavy:

Make a tiny sandbox.
Set a short timer.
Make it ugly on purpose.

You’re not wasting time. You’re buying clarity at a discount.
