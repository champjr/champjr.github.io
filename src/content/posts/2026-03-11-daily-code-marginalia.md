---
title: "Code Marginalia: Notes That Save Future-You"
pubDate: 2026-03-11
description: "A small case for writing in the margins—comments, readmes, and tiny decision logs that keep code humane."
tags: [workflow, writing, engineering, productivity, maintainability]
---

I used to think “good code explains itself.”

Now I think that’s only *half* true.

Good code can explain *what* it does. But it rarely explains **why** it does it that way, **what you tried first**, or **what sharp edges you discovered and worked around**. Those are the things that get forgotten the fastest—and they’re exactly what you need when you revisit a project three weeks (or three months) later.

So here’s a small case for **code marginalia**: lightweight notes that live close to the work. Not giant docs. Not a novel. Just enough breadcrumbs that the next you (or the next teammate) can keep moving without re-deriving the same conclusions.

## What “marginalia” means in code

In books, marginalia is the scribbles in the margins: underlines, quick thoughts, “this is important,” “come back to this.” It’s informal, personal, and brutally practical.

In code, marginalia is anything that answers one of these:

- **Why is this here?**
- **What would break if I change it?**
- **What did we try that didn’t work?**
- **What’s the intended shape of the solution?**
- **Where are the dragons?**

The key is proximity. If the only explanation is in a forgotten ticket from last quarter, it doesn’t count. If the explanation is near the code, it survives.

## The problem: code is optimized for machines, not memory

Programs have to be unambiguous. Humans don’t.

When you write code, you’re often compressing a mess of context into a clean-looking implementation:

- constraints you discovered the hard way
- tradeoffs you weighed and punted on
- weird behavior you observed in an API
- the reason you chose “boring but reliable” over “cool but fragile”

Then time passes, and the implementation remains… but the context evaporates.

This is why “reading your old code” can feel like meeting a version of yourself who left a complicated puzzle as a prank.

The joke is on you because you’re the one who has to solve it.

## Comments that actually help (and comments that don’t)

Let’s be honest: a lot of comments are either noise or debt.

### Mostly-noise comments

- restating the obvious
- narrating line-by-line logic
- describing *what* the code already says clearly

```js
// Increment i
i++;
```

That’s not marginalia. That’s a caption under a photo that says “photo.”

### Useful marginalia comments

The best comments explain **intent**, **invariants**, and **constraints**.

Examples:

- *Intent:*
  
  ```ts
  // We debounce here to avoid hammering the search endpoint on every keystroke.
  // UX stays responsive; results update within 250ms.
  ```

- *Invariants (the “do not violate this” rule):*

  ```py
  # Invariant: this function must be idempotent.
  # Retries happen upstream on timeouts.
  ```

- *Constraints (the “the world is weird” rule):*

  ```go
  // NOTE: vendor API returns 200 with an error payload when rate-limited.
  // We must check body.errorCode, not just status.
  ```

The point isn’t to dump a diary into the code. It’s to preserve the missing dimension: the reasoning.

## The 15-minute decision log (my favorite “tiny doc”)

If you do nothing else, try this: create a file called something like `DECISIONS.md` or `notes/decisions.md` and keep it brutally short.

Format:

- Date
- Decision
- Alternatives considered
- Why you chose this
- What would make you revisit it

One entry might be five lines.

This is basically a minimal version of an Architecture Decision Record (ADR). ADRs can get heavyweight, but the underlying idea is solid: **record decisions while they’re fresh**.

If you want the canonical ADR approach, Michael Nygard’s original write-up is still a great reference: <https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions>.

(That link is also useful when you need to justify to your future self that, no, you didn’t choose a weird approach “for fun.”)

## Commit messages are part of the margin

A commit message is a note to future readers. Which is to say: it’s a note to *future you*, because you will forget.

A good pattern is:

- first line: what changed
- body: why, and what tradeoffs you made

Even a couple sentences helps.

Bad:

- “fix stuff”
- “wip” (the software equivalent of shrugging)

Better:

- “Cache rendered markdown to reduce page load jitter”
- “Handle vendor 200+error payload on rate limit”

Those aren’t poems, but they’re *anchors*.

## Readme as a map, not a brochure

Most projects start with a README that looks like a marketing page:

- what it is
- how to install it
- how to run it

That’s fine, but it’s not enough. When you come back to a project, you want a *map*:

- where the important code lives
- what flows through the system
- what data shapes matter
- what assumptions are baked in

A “map README” can be as small as:

- `src/ingest/` — fetches external data, retries here
- `src/indexer/` — normalizes records, idempotent by design
- `src/web/` — UI and API, feature flags live here

That kind of note is worth its weight in gold because it makes re-orientation fast.

## Tests are marginalia too (especially snapshot tests)

Tests are executable documentation. But they’re also **examples**.

If you ever find yourself squinting at the code and wondering, “what is this function *supposed* to do with weird input?”

…that question should be answered by a test.

Not just “happy path” tests, either. Edge cases are where the story lives.

I’ll even argue that some tests exist mainly as marginalia:

- regression tests that encode a past bug
- “weird behavior” tests that prove a dependency quirk
- examples that show intended usage

If you write one good regression test after a bug, you’ve effectively left a sticky note that says: “don’t step here again.”

## A tiny dose of literate programming

I’m not suggesting we all rewrite our codebases as essays.

But the spirit of *literate programming*—the idea that code can be presented as a narrative—still has something to teach us. Donald Knuth’s original framing is worth reading even if you never adopt the tooling: <https://en.wikipedia.org/wiki/Literate_programming>.

The lesson I steal is simple: **explanations are first-class**.

Even if you don’t go full literate, sprinkling narrative in the right places keeps your codebase from becoming an archeological site.

## Rules of thumb (so this stays lightweight)

A few constraints keep marginalia from turning into a mess:

1) **Prefer the smallest note that prevents a future re-derivation.**

2) **Write notes at the moment you feel friction.** If you just spent 20 minutes figuring out a gotcha, you are holding a rare artifact: fresh context. Capture it.

3) **Keep a “Why” closer than a “How.”** The “how” changes with refactors; the “why” often survives.

4) **Delete outdated notes aggressively.** Stale marginalia is worse than none. If the comment is wrong, it’s a trap.

5) **Don’t apologize in comments.** “This is hacky” is less helpful than “We do X because Y constraint; revisit if Z changes.”

## The payoff: fewer heroic re-reads

There’s a particular kind of fatigue that comes from re-learning your own work.

Not because you’re forgetful, but because the project has a hundred tiny context decisions and none of them are written down.

Marginalia is how you stop paying that tax.

It’s also how you make your code kinder. Not “perfect.” Just kinder.

Future-you will still complain, of course. That’s a sacred tradition.

But they’ll complain while shipping.
