---
title: Tiny Scripts, Big Leverage
pubDate: 2026-03-10
description: Why small, readable automation beats ambitious frameworks (most days).
tags: [workflow, automation, tooling, unix, productivity]
---

Every so often I get the urge to “do automation properly.”

You know the vibe:

- Spin up a full task runner
- Add a config schema
- Make it cross-platform
- Throw in a plugin system, because you’re a Serious Adult now

And then… I ship nothing. Or I ship a beautiful scaffolding that automates exactly zero of the annoying things that prompted the project.

The older I get (in Internet years), the more I’ve come to love **tiny scripts**—little 20–80 line programs that do one job, live in the repo (or a dotfiles folder), and are easy to read end-to-end.

They’re not glamorous. They’re also the only kind of automation that reliably survives contact with my future self.

## Tiny scripts work because they’re legible

A lot of productivity advice assumes that future-you will remember why you did something. Future-you will not.

Future-you is a different person with different stress levels, fewer context clues, and a suspiciously short attention span.

Tiny scripts are a kindness because they’re **auditable**:

- You can open the file and see what it does.
- You can predict how it fails.
- You can change one thing without learning a framework.

The whole thing fits in your head. That matters.

It’s the same reason I like the classic articulation of the Unix philosophy: small pieces, composed together. Even if you’re not a terminal gremlin, the idea is useful: keep tools simple enough that you can *trust* them.

If you want the canonical reference, here’s the original write-up people usually point to:

- <https://en.wikipedia.org/wiki/Unix_philosophy>

## The “two-minute threshold” for automation

I’ve settled on a rule of thumb:

If a task is annoying and I’m about to do it for the **third time**, I should pause and ask:

- Can I make future-me never do this manually again?

Not with a big system. With a tiny script.

This is the “two-minute threshold” part: the script should be something I can create in about as long as it takes to complain about the task.

Some examples that have paid off for me:

- A script that renames and resizes a batch of images for posting.
- A script that generates a new post file with frontmatter filled in.
- A script that checks formatting/build locally before I push.
- A script that pulls down a couple of logs, scrubs them, and zips them up for debugging.

None of these are impressive. All of them reduce friction.

## A good tiny script has three properties

### 1) It’s boring on purpose

The best tiny scripts are aggressively uncreative.

- No clever abstractions.
- No “just in case” parameters.
- No optional dependency that breaks on your friend’s laptop.

Boring is maintainable.

When I’m tempted to generalize, I try to write down the simplest question:

- “What is the next action I wish a computer would do for me?”

Then I automate exactly that.

### 2) It fails loudly and early

Automation is only relaxing if it’s honest.

A tiny script should be the opposite of “best effort.” It should be like:

- If a required env var isn’t set, stop.
- If an input file doesn’t exist, stop.
- If a command fails, stop.

In shell, this often looks like `set -euo pipefail` plus explicit checks.

In JavaScript/Python, it’s the same spirit: validate assumptions before you do work.

That way the failure mode is “I can fix it” instead of “I have no idea what state my repo is in now.”

### 3) It’s easy to delete

This is underrated.

Big automation frameworks are sticky. You feel guilty removing them because you invested so much time. Tiny scripts are disposable. That’s good.

If a script stops earning its keep, delete it.

The goal is not to build an empire. The goal is to remove a papercut.

## Tiny scripts beat dashboards

A dashboard is a promise.

It promises that you will keep feeding it data. That you will keep the widgets accurate. That you will remember how to interpret the colors.

A tiny script is an action.

It does the thing. It doesn’t try to become your identity.

There’s a trap in modern tooling where we optimize for the feeling of control—beautiful graphs, synchronized checklists, status pages—when what we actually need is **momentum**.

Momentum comes from reducing steps.

Tiny scripts reduce steps.

## The “README test” (a quick quality check)

Here’s a quick test I use to keep myself honest.

If someone found the script in a repo, could I explain it in 6 lines at the top of the file?

Something like:

- What it does
- What it assumes
- How to run it
- What it changes
- How to undo it (if applicable)

If I can’t do that, it’s probably not a tiny script anymore. It’s a mini-system wearing a trench coat.

## Practical advice: pick the least fancy language you can

I’m not saying “only use Bash.” I’m saying: **optimize for availability and readability**.

- If it’s file wrangling on macOS/Linux, shell is often fine.
- If it’s parsing JSON and doing a couple transformations, Python is a delight.
- If it’s in a Node project and you already have dependencies installed, a small JS script is totally reasonable.

The best language is the one that:

- you already have,
- you can run without ceremony,
- and you can debug without summoning a priest.

Also: if you write shell scripts, run them through ShellCheck at least once. It catches a shocking number of “this will absolutely bite you later” issues.

- <https://www.shellcheck.net/>

## My favorite part: tiny scripts teach you your own workflow

The real benefit isn’t that you saved 45 seconds.

It’s that scripting forces you to clarify the workflow:

- What are the inputs?
- What are the outputs?
- What are the invariants?
- What should never happen?

You end up with a sharper mental model of your own process.

And if you’re doing this long enough, you start noticing patterns:

- which tasks are truly repetitive,
- which ones are “repetitive” but actually require judgment,
- and which ones you should stop doing entirely.

Automation isn’t just about speed. It’s also a mirror.

## A small challenge

Pick one recurring annoyance this week and write the smallest possible script for it.

Constraints:

- Under 80 lines.
- No dependencies you don’t already have.
- No “v2.”

Ship the ugly version. Let it be a little dumb.

The point is to make your computer feel like a helpful roommate instead of a pet you have to train forever.
