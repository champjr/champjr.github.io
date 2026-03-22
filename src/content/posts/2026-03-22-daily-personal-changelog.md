---
title: "The Personal Changelog (Because My Brain Is Not a Git Repo)"
pubDate: 2026-03-22
description: "A tiny daily ritual that makes work feel calmer, more legible, and easier to pick back up tomorrow."
tags: ["workflow", "writing", "productivity", "notes"]
---

Somewhere in the last few years, I developed a mild superstition:

If I don’t write down what I changed, it didn’t really happen.

Not in the metaphysical sense. In the very practical sense that tomorrow-me (and next-week-me, and “why is this broken in three months”-me) will stare into the void and honestly have no idea what I did or why.

I’m not talking about an immaculate journal. I’m talking about a **personal changelog**: a short, dated list of “what moved” that day.

If you’ve ever shipped something and then immediately forgotten the path you took to get there, you already understand the appeal.

## What I mean by a “personal changelog”

A personal changelog is a note with exactly one job:

- **Capture the deltas.**

Not the whole story. Not the meeting notes. Not the feelings (unless the feelings explain the decisions). Just the changes:

- What I started
- What I finished
- What I tried (and abandoned)
- What I learned that will matter later
- What I decided *not* to do

It’s the human version of:

- `Added:`
- `Changed:`
- `Fixed:`
- `Removed:`

That’s not an accident. The best public changelogs are boring in a comforting way.

If you want a canonical template for software changelogs, the community standard is **Keep a Changelog**:

- https://keepachangelog.com/en/1.1.0/

You can steal the headings wholesale. Your life will not explode.

## Why this works (and why it feels strangely soothing)

A few things happen when you keep even a scruffy changelog.

### 1) It reduces “open loops”

Your brain is great at keeping unfinished business warm. That’s helpful right up until it becomes background anxiety.

There’s a classic psychology idea called the **Zeigarnik effect**: people tend to remember uncompleted tasks better than completed ones.

- https://en.wikipedia.org/wiki/Zeigarnik_effect

Whether the effect is strong in every context is debatable, but the *experience* is real: half-done things occupy mental RAM.

A changelog is a way to **externalize the loop**. You’re telling your brain, “it’s tracked; you can stop pinning it to the front of the clipboard.”

### 2) It makes progress legible

Lots of work is invisible while you’re doing it:

- moving a thing from “kind of working” to “actually reliable”
- answering the same question three times until it becomes a rule
- deleting a broken approach (which feels like losing, even when it’s winning)

A changelog turns those into *artifacts*. Your day becomes a sequence of tangible edits instead of a haze of tabs.

### 3) It helps you resume faster

I used to think I needed better focus.

I actually needed fewer cold starts.

Tomorrow’s most expensive minute is often the first one, when you’re reconstructing:

- where you left off
- what you were thinking
- what you already tried

A changelog is basically a **breadcrumb trail** for future-you. Not perfect documentation—just enough to rehydrate context.

### 4) It improves your “taste” over time

After a couple weeks, patterns pop out:

- “Why do I keep fixing the same class of bug?”
- “Why do I always start feature work before writing the small safety checks?”
- “Why do Fridays turn into random admin sludge?”

It’s hard to have good opinions about your workflow if you can’t see it.

## The format (keep it aggressively small)

Here’s what I recommend if you’re starting:

- One note per day
- 5–12 bullets total
- No guilt if you miss a day
- The point is clarity, not completeness

Example:

**2026-03-22**

- Added a pre-push check to run the build locally
- Fixed a flaky test by removing time-based assertions
- Wrote down the “definition of done” for the project’s homepage refresh
- Tried a new tool for X → decided not to keep it (too many moving parts)
- Next: finish the migration doc; ask Sam about the DNS change

That’s it. That’s the whole religion.

If you want headings, try:

- **Added**
- **Changed**
- **Fixed**
- **Removed**
- **Notes / Next**

If you want to be *even lazier*, keep only:

- **Did**
- **Learned**
- **Next**

The best format is the one you’ll actually use when you’re tired.

## Where to store it

Some options, all valid:

- A plain text file in a folder called `changelog/`
- A single running document with dated sections
- A private repo (feels nice if you already live in Git)
- A notes app (search is the killer feature)

My preference: **plain markdown files** named like `YYYY-MM-DD.md`.

It’s boring, grep-able, portable, and it doesn’t care what app I’m using this year.

## A few rules that keep it from turning into “yet another system”

1) **No prose unless it earns its keep.**

If you find yourself writing paragraphs, you’re probably journaling. Which is fine! But it’s a different activity. Changelog bullets are meant to be cheap.

2) **Log removals as wins.**

“Removed the thing” is often the most honest kind of progress.

3) **Write down “decisions” explicitly.**

A tiny line like “Decided to keep X simple; no plugin architecture” will save you from future debates with yourself.

4) **Always include one ‘Next’ bullet.**

Not ten. One.

If you do only one thing, do that. It’s the baton pass to tomorrow.

## The quiet benefit: it makes you nicer to your future self

A changelog is an act of basic decency toward future-you.

It says: “I know you’re going to show up with a full day, a finite brain, and a suspiciously empty memory of today’s details. Here’s the map.”

And, honestly, it’s also a way to be nicer to present-you.

Because when your progress is written down, you can stop re-proving it to yourself every five minutes.
