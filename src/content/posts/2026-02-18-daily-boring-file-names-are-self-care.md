---
title: "Boring File Names Are Self-Care"
pubDate: 2026-02-18
description: "A small naming scheme that keeps projects calm, searchable, and surprisingly future-proof."
tags: ["workflow", "writing", "productivity", "tools"]
---

There’s a specific kind of dread that only appears when you _know_ you saved a thing, but you have no idea what you called it.

It’s not a dramatic dread. It’s more like a tiny paper cut for your brain.

- Was it `final.pdf`?
- Or `final-v2.pdf`?
- Or, in a moment of chaos, `FINAL FINAL (use this).pdf`?

I’m not here to shame your past self. Past you was doing their best. Past you also had to answer that Slack message, finish the doc, and remember to eat lunch.

But: naming files well is one of those “small lever, big peace” habits. It’s not glamorous. It doesn’t make a good keynote. It’s basically flossing.

And once you get the hang of it, you stop losing time to the dumbest possible scavenger hunts.

## The real reason file names matter

Most advice about naming files sounds like it’s about order. In practice, it’s about **retrieval**.

Your future self is going to search for things. They’re going to do it while tired, while stressed, or while trying to get something out the door in ten minutes.

File names help your future self answer three questions quickly:

1) **What is it?**
2) **When is it from?**
3) **How does it relate to other things?**

If the file name answers those, you’ve basically built a tiny index. If it doesn’t, your brain starts doing archaeology.

## A simple naming scheme that keeps projects calm

Here’s the scheme I keep coming back to, because it’s boring and it works:

**`YYYY-MM-DD short-topic optional-detail.ext`**

Examples:

- `2026-02-18 meeting-notes product-metrics.md`
- `2026-02-01 invoice hosting-renewal.pdf`
- `2026-01-10 screenshots onboarding-bug.png`

I like this format because it sorts correctly _everywhere_ (Finder, terminal, GitHub, cloud drives) without any special tools.

If you don’t want the date in every file name, keep it for things where “when” matters:

- notes
- receipts
- drafts
- exported data
- screenshots

If “when” truly doesn’t matter (like `logo.svg`), don’t force it. The point is usefulness, not ritual.

## The one rule I’ll argue about: use ISO dates

Use `YYYY-MM-DD`.

Not `2-18-26`. Not `Feb 18`. Not `18-02-2026`.

ISO dates are a minor miracle because:

- they’re unambiguous
- they sort correctly as strings
- they’re readable by humans

This isn’t my opinion, it’s one of those things the world quietly converged on for good reasons. If you want the official standard, here’s the Wikipedia page for [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601).

That link is also a nice example of “useful link when relevant” that doesn’t require a sales pitch.

## Kebab-case vs spaces (and why you should pick one)

For the rest of the filename, you have a choice:

- `kebab-case-like-this`
- `snake_case_like_this`
- `Title Case Like This`
- `whatever your fingers did in the moment`

Pick one and be consistent.

My bias: **kebab-case**.

It plays nicely with URLs and scripts, it’s easy to read, and it doesn’t make you do weird escaping in terminals as often. Spaces are fine until you touch a command line or an automated build step, at which point your computer becomes a petty bureaucrat demanding paperwork for every space.

(Yes, you can quote paths. Yes, you can escape spaces. Also yes: life is short.)

## Versioning: don’t do “final-final-really”

Here’s the trap: you’re iterating quickly, saving frequently, and “versioning” becomes a vibe instead of a system.

If you’re in Git (or any real version control), the correct answer is: **commit**.

But not everything lives in Git. For those cases, I try one of these two approaches:

### Option A: date-driven versions

`2026-02-18 proposal client-x.md`

When you revise it tomorrow:

`2026-02-19 proposal client-x.md`

Now the order is obvious, and you don’t have to keep mental track of which “v3” was the good one.

### Option B: explicit versions, but standardized

If dates feel heavy, use:

- `v01`, `v02`, `v03` (fixed width!)

So:

- `proposal-client-x-v01.md`
- `proposal-client-x-v02.md`

The fixed width matters because `v9` and `v10` sort weirdly in many UIs. Padding makes sorting behave.

If you’re thinking “this sounds like a lot of rules,” notice what’s missing: there’s no need to remember what “v2” means. It just means “later than v1.” That’s enough.

## The underrated ingredient: a tiny bit of “what”

Dates and clean slugs are great, but the secret sauce is a little descriptive specificity.

Not:

- `2026-02-18 notes.md`

But:

- `2026-02-18 notes budget-forecast.md`
- `2026-02-18 notes hiring-plan.md`

I’m not asking you to write a sentence. I’m asking you to give your future self a fighting chance.

When you add that extra noun phrase, search becomes powerful:

- search “forecast” across your notes folder
- search “renewal” across receipts
- search “onboarding” across screenshots

You’re turning your file system into a low-budget database, in the best way.

## “But I already have Spotlight / Google Drive search / ripgrep”

Yes, search is incredible.

Good file names don’t replace search. They **make search work better**.

Search is only as useful as the words it can match. File names are the one piece of metadata you always have, everywhere, without needing an app to cooperate.

Also, search helps you find things you remember. File names help you find things you _forgot you forgot_.

That second category is where the time savings hide.

## A practical starter kit

If you want to adopt this without turning your weekend into “the great renaming,” start here:

1) Pick one place that causes pain (Downloads, screenshots, a project folder).
2) For new files only, name them with `YYYY-MM-DD topic`.
3) When you touch an old file, rename it then. (Don’t batch it. That’s how you lose a Saturday.)
4) If a naming debate lasts more than 10 seconds, choose the boring option and move on.

You don’t need to become an archivist. You just need to reduce friction.

## The punchline

A lot of productivity advice is about doing more.

Boring file names are about **losing less**—less time, less context, less patience.

It’s a tiny kindness to your future self, and future you is the person who has to ship the thing when the deadline is closer and the coffee is colder.

Name the file like you’re going to need it again.

Because you are.
