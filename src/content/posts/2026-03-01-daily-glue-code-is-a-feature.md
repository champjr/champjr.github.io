---
title: "Glue Code Is a Feature, Not a Sin"
pubDate: 2026-03-01
description: "A small defense of the scrappy scripts and one-off automations that make everything else feel smooth."
tags: ["workflow", "software", "tools", "automation"]
---

There’s a particular kind of software you won’t find in glossy product launch videos.

It’s the tiny script with an embarrassing name.
The Make target that only works on your machine.
The shell alias that saves you nine keystrokes and, somehow, nine minutes of attention.
The “temporary” notebook that has survived three laptops.

This stuff is usually called *glue code*—the connective tissue between systems that were never designed to meet.
And in many corners of engineering culture, “glue” is said with a faint wrinkle of the nose, like you just admitted to eating cereal for dinner.

I think that’s backwards.

Glue code is not a sign you’re doing it wrong. In a lot of cases, it’s the sign you’re doing it *right*: you’re paying attention to friction, and you’re shaving it down before it can file your brain into sawdust.

## The world is mostly interfaces

We love to imagine our work as building “systems,” but most of the time we’re navigating interfaces:

- exporting data from one place so another place can read it
- pulling a handful of fields out of a JSON blob
- renaming files so they match a convention
- pushing a button in a web UI because there’s no API
- reformatting text so it’s readable (to humans *or* to machines)

These are not glamorous tasks, but they’re extremely common. A lot of *real productivity* is won or lost in the gaps between tools.

The Wikipedia definition of glue code is refreshingly straightforward: code that “connects software components.” It’s the adapter layer, the shim, the wrapper, the tiny translator. (<https://en.wikipedia.org/wiki/Glue_code>)

If you’ve ever written a script that takes output from one command and feeds it into another, congratulations: you’ve built a miniature integration platform. You just didn’t invoice anyone for it.

## “But it’s not scalable” (to what?)

A common criticism of glue code is that it’s not “scalable.”

Sometimes that’s true.

If you’re processing millions of events per second, your bash one-liner is not going to age well. If you’re supporting a paying customer base, you need sturdier rails than a single person’s command history.

But here’s the thing: most glue code is written to scale *attention*, not throughput.

A script that saves you 30 seconds a day is already a win if it:

- reduces context switching
- decreases the chance of a silly mistake
- makes a boring task feel “one click” instead of “a whole thing”

We often treat “scalable” as a synonym for “enterprise-grade,” but the smallest and most precious resource is your own working memory.

In other words, the question isn’t “does this scale?”
It’s “does this remove a pebble from my shoe?”

## Glue code as “workflow design”

Here’s the opinionated bit: glue code is a kind of workflow design, and workflow design is a kind of product design.

You are the user.
The product is your day.
Your roadmap is “what keeps annoying me?”

That’s not a metaphor. It’s literally how good products get built: someone notices friction, then makes it smaller.

Glue code just runs the same playbook at a smaller radius.

If you’ve ever thought:

- “I always forget the flags for this command.”
- “I keep opening three tabs to do the same lookup.”
- “This file naming convention is right there, and I still mess it up.”

…that’s your product manager brain handing your engineer brain a ticket.

## The best glue code has a half-life

One reason glue code gets a bad reputation is that it can turn into a haunted house of “quick fixes.”

So here’s a simple rule I like:

**Write glue code as if it might live longer than you think.**

Not *forever*. Just longer than your current mood.

That means:

1) **Give it a name that helps Future You.**
   
   If it’s a script file, put a verb in it: `sync-notes`, `resize-images`, `publish-post`.

2) **Add one comment at the top explaining why it exists.**
   
   Not how it works. Why it exists.
   
   Example:
   
   > “This converts the export from Tool A into the CSV format Tool B requires.”

3) **Make the happy path obvious.**
   
   A single command is ideal. A tiny CLI is fine. A Make target is surprisingly good.

4) **Fail loudly when it matters.**
   
   If a missing environment variable means “this will publish to production,” don’t quietly guess.

5) **Put the sharp edges somewhere visible.**
   
   If your script assumes a directory exists or a tool is installed, say so.

That’s it. You don’t need to architect a cathedral. You just need to avoid leaving booby traps.

## A tiny taxonomy of glue

Not all glue code is created equal. I mentally bucket it like this:

- **Personal glue:** aliases, small scripts, one-off automations. The goal is speed and fewer mistakes.
- **Team glue:** shared repo scripts, Make targets, dev tooling. The goal is consistency.
- **System glue:** integrations, jobs, connectors. The goal is reliability and observability.

The mistake is treating all three categories as if they’re the same kind of thing.

Personal glue should be biased toward *low ceremony*. If you need a ticketing system to add an alias, you’re not adding an alias.

System glue should be biased toward *robustness*. If an integration fails silently, it will fail loudly in your customer’s inbox.

And team glue lives in the middle, which is why it’s the one that starts arguments.

## The boring superpower: standardize the seam

If you want your glue to get better without getting bigger, standardize the *seam*.

Pick a couple of “common currencies” your tools speak well:

- plain text (human-readable and grep-able)
- JSON (machine-readable and structured)
- CSV (still everywhere, somehow)
- files in predictable places (a directory is a fantastic API)

When you standardize the seam, the glue becomes thinner.

This is why tools like `jq` are so beloved: they make JSON a reasonable seam. It’s hard to overstate how much easier life gets when you can confidently extract `thing.items[0].name` without inventing a bespoke parser. (<https://jqlang.github.io/jq/>)

Even if you don’t use `jq`, the principle holds: the less time you spend translating formats, the more time you spend doing the actual work.

## When glue code becomes a smell

Glue code isn’t sacred. It can absolutely become a smell.

A few warning signs:

- **You don’t trust it anymore.** You run it and then manually verify everything every time.
- **It depends on invisible state.** A specific working directory, a browser session, a hidden token.
- **It quietly does the wrong thing.** No errors; just incorrect output.
- **It’s doing business logic.** Personal glue should not encode company policy.

When you hit these, you don’t need to feel guilty—you just need to promote the script.

“Promote” can mean:

- add tests
- add logging
- make inputs explicit
- turn it into a small package
- document it
- give it an owner (even if the owner is still you)

The upgrade path is not “delete all glue.”
The upgrade path is “identify the glue that became load-bearing.”

## A practical takeaway

If you want a small, concrete habit that nudges you toward better glue code, try this:

**Whenever you do a repetitive task for the third time, write the smallest automation that removes one step.**

Not the whole thing. One step.

Example: if you keep forgetting the exact command to resize images for a post, don’t build an image pipeline. Write a script that wraps the command with the right flags.

Then, if you *still* do it often and it *still* annoys you, automate the next step.

That’s how the best workflows happen: a sequence of tiny, justified upgrades.

## Closing thought

The internet has given us an astonishing number of powerful tools. The downside is that we now spend a lot of time negotiating between them.

Glue code is how we negotiate back.

It’s a vote for your future attention.
It’s a refusal to do the same annoying thing twice.
It’s the quiet, uncelebrated craft of making your own work less brittle.

And honestly? If cereal for dinner is wrong, I don’t want to be right.
