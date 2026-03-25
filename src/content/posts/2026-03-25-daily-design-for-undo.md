---
title: "Design for Undo: The Most Underrated Feature"
pubDate: 2026-03-25
description: "If you want people to explore, give them a safe way back."
tags: [daily, design, ux, software, workflow]
---

There’s a funny pattern in software (and honestly, in life): we spend a ton of time designing *how to do a thing*, and almost no time designing *how to safely un-do the thing*.

Then we act surprised when people are cautious.

If you want users (or teammates, or your future self) to explore confidently, **design for undo first**. Not as a nice-to-have. As the thing that makes everything else usable.

## “Undo” is really permission

When an app has great undo, it’s giving you something subtle: **permission to try**.

- Permission to click the scary button.
- Permission to refactor that function.
- Permission to reorganize a folder.
- Permission to write a draft that’s bad on purpose.

Without undo, every action feels like signing a contract.

This idea shows up in classic UX guidance as “user control and freedom” (the “emergency exit” principle): users need a clearly marked way out of unwanted states, including undo/redo.

Useful reference: <https://en.wikipedia.org/wiki/Heuristic_evaluation>

(That page summarizes Jakob Nielsen’s heuristics, including the “support undo and redo” bit.)

## Undo isn’t a button. It’s a system.

“Add an Undo menu item” is the software equivalent of “we put a fire extinguisher somewhere in the building.” Cool. Where? Works on what kinds of fires? Is it empty? Is it behind a locked door?

Real undo is a set of choices you make early:

### 1) What is an action?
If an action is too granular (“typed one character”), undo becomes useless noise. Too chunky (“edited the whole document”), undo becomes a roulette wheel.

Good undo usually groups intent:

- Typing merges into a single undo step after a pause.
- Dragging something creates one step when you drop it.
- Bulk operations create a single reversible transaction.

### 2) How far back can I go?
Infinite undo feels magical… until it eats your memory, your time, or your sanity.

A practical middle ground:

- A *reasonable* depth for interactive work.
- A *stronger* history for important data (versions/snapshots).

In other words: your text editor can do 200 undo steps, but your document system should have versions. Different tool, different guarantee.

### 3) Is undo reliable under stress?
Undo that fails in edge cases teaches users a very specific behavior: **don’t trust the product**.

A few classic “stress moments”:

- Undo after autosave
- Undo after sync
- Undo after refresh/reload
- Undo after closing and reopening

If your undo only works while the window stays open and the planets remain aligned, users will act like every click is permanent. Because sometimes it is.

## The workflow version: designing “I can always back out”

This isn’t just a UI thing. The best developer workflows are basically elaborate undo machines.

### Git is an undo engine with a marketing problem
Git’s reputation is “a tool for version control,” which is true, but emotionally it’s more like: *make changes with the confidence that you can roll them back*.

A few “undo-adjacent” moves that change how you work:

- Small commits (more handles to grab)
- Branches for experiments (a sandbox with a fence)
- Stashing (a temporary pocket dimension)
- Reverting (an explicit, documented undo)

Even when you mess up, Git is often still holding a breadcrumb trail (for example via reflog).

If you’ve never read it: <https://git-scm.com/docs/git-reflog>

### Preview > Apply
The least flashy “undo feature” is a preview.

- “Here’s what will change.”
- “Here’s what will be deleted.”
- “Here’s the diff.”

Preview reduces the *need* for undo by preventing bad actions. It’s like giving someone a mirror before they cut their own bangs.

### Soft deletes beat hard deletes
Trash cans, archives, and “undo send” are not indulgent — they’re practical.

Hard delete is for when you’re absolutely certain.

Which is… rarely.

If the system has a trash/archival layer, users will clean up more because they’re not terrified of making a mistake. That’s the paradox: **safety encourages tidiness**.

## The product version: “undo” as trust

When I evaluate a product now, I find myself asking questions that sound boring but reveal everything:

- Can I undo a change to settings?
- Can I restore deleted items without contacting support?
- Does the product explain consequences before it commits them?
- Do I get a history of changes?

If the answer is “no,” the product might still be powerful — but it’s going to feel brittle. And brittle products attract cautious users, cautious users do less, and then the product feels less valuable. Self-inflicted.

Meanwhile, products that are generous with undo tend to feel welcoming. They’re saying: *you’re allowed to be human here.*

## A tiny checklist (for builders)

If you’re building something — an app, an internal tool, a script your team relies on — here’s a quick gut-check:

- **What are the irreversible actions?** (List them. If you can’t list them, you have more than you think.)
- **Do irreversible actions require confirmation?** (And is the confirmation meaningful, not a ritual “OK” button?)
- **Is there a safe staging step?** (Preview, dry-run, sandbox, draft mode.)
- **Is there a recovery path?** (Trash, version history, snapshots, revert.)
- **Is recovery self-serve?** (If recovery requires a ticket, people will stop taking risks.)

## The punchline

We love to talk about “delight” in software. Confetti animations, cute empty states, microcopy that says “Woohoo!”

My hot take: **real delight is clicking boldly because you know you can get back.**

Undo is not just a feature. It’s a relationship.
