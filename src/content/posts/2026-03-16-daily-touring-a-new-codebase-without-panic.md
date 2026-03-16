---
title: "Touring a New Codebase (Without Panic)"
pubDate: 2026-03-16
description: "A practical way to get oriented fast: find the seams, follow the data, and write down what you learn."
tags: [programming, workflows, code-reading, software-engineering]
---

There are two emotional states I reliably hit when I open an unfamiliar codebase:

1. **Confidence** (for about 90 seconds)
2. **A quiet, creeping suspicion that everything is wired to everything**

A big repository can feel like a city with no map. You don’t know which roads are important, which neighborhoods are safe, or why there’s an alley labeled `legacy_v2_final_final`.

Over time I’ve learned that the “read the code” advice is technically correct but strategically useless. *Where* do you start? How do you avoid spending a day spelunking and emerging with nothing but a vague awareness that “it uses Docker… probably”?

This is the approach that’s worked best for me: a codebase tour that’s less like reading a novel and more like figuring out how a building is put together.

## The goal isn’t understanding—it’s orientation

If you aim for total comprehension up front, you’ll get discouraged fast.

Instead, I try to answer a smaller set of questions:

- **What does the system do, in one sentence?**
- **Where does a request/event enter the system?**
- **What are the main subsystems (the “neighborhoods”)?**
- **Where is the data stored and how does it move?**
- **What’s the easiest way to run a thin slice locally?**

Once you can answer those, you’re not “done,” but you’re no longer lost.

## Step 1: Read the README like it’s an interface contract

I treat the README (and any `docs/` landing page) as the public API for future-me.

I’m looking for:

- **How to run tests/build** (the exact commands matter)
- **How to start the app** (including any required services)
- **How config is handled** (env vars? files? both?)
- **The intended architecture** (even a flawed diagram is a clue)

If the README is thin, I don’t judge (okay, I judge a little). I just compensate by looking for:

- `package.json` scripts / `Makefile`
- `docker-compose.yml`
- `justfile`
- `scripts/` folders
- CI config (GitHub Actions, etc.)

CI is underrated documentation because it has to be executable. It’s the repo telling you, “This is what ‘working’ means.”

## Step 2: Identify the “edges” first

In most systems, the edges are where meaning lives:

- HTTP routes / controllers
- message queue consumers
- cron/scheduler jobs
- CLI entrypoints
- webhooks

If I can find the edges, I can trace inward.

This is also where naming tends to be most honest. You’ll see things like `CreateInvoice` or `handleStripeWebhook` (as opposed to the interior, where you get `ManagerFactory2` and existential dread).

A tip: don’t start by reading deep library code. Start with files that have verbs.

## Step 3: Follow a single request (or event) end-to-end

Pick one happy-path action the system supports:

- “User signs in”
- “Create a post”
- “Upload an image”
- “Process an order”

Then trace that flow end-to-end:

1. **Entry** (route/handler)
2. **Validation** (schema checks, auth)
3. **Core logic** (service layer, domain logic)
4. **Persistence** (DB writes)
5. **Side effects** (events, emails, caches)
6. **Response** (serialization)

You will not understand every function you encounter. That’s fine. The point is to learn the shape of the system.

When I get stuck on an unfamiliar abstraction, I ask: *Is this important for the flow, or is it plumbing?*

If it’s plumbing, I note it and keep moving.

## Step 4: Map the “seams” (a.k.a. where you can safely change things)

The biggest difference between being lost and being productive is knowing where you can make a change without detonating the whole repo.

I look for seams like:

- clear module boundaries (folders with a cohesive theme)
- stable interfaces (types, protocols, handler contracts)
- dependency injection points
- adapter layers (DB adapters, API clients, queue producers)

A seam is where the system already expects variability. Those are friendly places to start contributing.

If you’re new to a project and want a small win, a seam is where you can:

- add logging/metrics
- improve error messages
- add a test
- fix a small bug

without first becoming the world’s leading expert in whatever `core/engine/graph/allocator.rs` is doing.

## Step 5: Use git history as a guided tour

This one feels obvious, but I still forget to do it.

When I see a weird piece of code, I check:

- **blame**: who touched this and when?
- **commit messages**: what problem were they solving?
- **PR discussion** (if public): what tradeoffs were debated?

Code that looks strange often has a backstory like “the vendor API returns broken JSON on Tuesdays.” History is where that lore gets preserved.

Also: if you can identify the *most frequently modified directories*, you’ve learned something about where the system is evolving (or unstable).

## Step 6: Keep a scratchpad of “facts,” not feelings

When I’m new to a codebase, I’ll have a lot of thoughts like:

- “This seems messy.”
- “Why is this named that?”
- “I hate this.”

Those are emotionally true, but not actionable.

Instead, I keep a short running doc (even just a local note) with concrete facts:

- “API routes are defined in `src/server/routes.ts`.”
- “DB is Postgres; migrations live in `db/migrations`.”
- “Background jobs run via X, configured in Y.”
- “Auth middleware is applied in Z.”

This becomes a personal map. Bonus: later, when you *do* file an issue or propose a refactor, you can point to specifics.

## Step 7: Earn the right to refactor

I like refactoring. I also like not breaking production.

A codebase you don’t understand is not a codebase you should aggressively rearrange.

My rule is:

- **First, add a test that locks in behavior.**
- **Then, make the smallest change that improves the situation.**

Most “messy” code is carrying invisible constraints. You uncover those constraints by touching the code gently, in small increments, and watching what fails.

If you want a smart, practical perspective on this whole process, I like Sparkbox’s piece on understanding a large codebase: <https://sparkbox.com/foundry/how_to_understand_a_large_codebase>.

## The punchline: you’re building a mental index

When you’re touring a new codebase, you’re not trying to memorize everything.

You’re trying to build an index in your head:

- “If I need to change X, I should look *over there*.”
- “If the system behaves oddly, the logs probably come from *this layer*.”
- “If a request gets slow, the DB call is likely in *that module*.”

That index is what “understanding” looks like in practice.

And the nice part is: once you have it, learning accelerates. Every future change is a new street you get to name.
