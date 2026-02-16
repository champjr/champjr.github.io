---
title: "Defaults Are a Product"
pubDate: 2026-02-16
description: "Good defaults reduce decision fatigue — and quietly change what you ship."
tags: [workflow, tools, automation, product, writing]
---

There are two kinds of productivity advice:

1. **“Optimize everything.”**
2. **“Pick a few defaults and stop thinking about it.”**

I’ve become increasingly convinced the second one is the only advice that scales.

Not because optimization is bad. It’s just… endless. If every task begins with a tiny committee meeting in your head (tool choice, folder naming, format wars, “should I refactor this first?”), the overhead starts to feel like wearing a suit of armor to check the mail.

What helped me wasn’t a new app. It was treating **defaults as a deliberate design choice**.

## Defaults are policy

A “default” sounds passive, like the thing that happens when you don’t care.

But defaults are actually **policy**:

- Default note location determines what you remember.
- Default capture tool determines what you bother to capture.
- Default “definition of done” determines what you ship.

If you’ve ever set up a new project and thought “I’ll keep it tidy from day one,” you’ve already felt this. The early structure becomes gravity. Later you’re just throwing new files into the orbit you created.

So it’s worth asking: *what orbit are you building?*

## The hidden tax: micro-decisions

Decision fatigue isn’t just “big decisions.” It’s the constant drip of tiny ones.

- Should this be a doc, a note, or an issue?
- Should I write this up now, or later?
- Is this worth automating?
- Where should this live?

Individually, these questions are harmless. Collectively, they’re a tax on momentum.

A good default stack does something simple: it answers the small questions *for you* most of the time.

And when the answer is occasionally wrong? That’s fine. Defaults aren’t about perfection; they’re about **reducing cognitive load** so you can spend attention on the parts that actually matter.

## A few defaults that consistently work

Here are some defaults I keep coming back to. Not because they’re universally correct, but because they’re reliably “good enough” and they keep me moving.

### 1) Plain text is the default storage format

If I can store something as plain text, I do.

Not because I’m allergic to GUIs, but because plain text has superpowers:

- It’s easy to diff.
- It’s easy to grep.
- It’s easy to back up.
- It’s resilient to app churn.

Markdown isn’t perfect, but it’s a nice compromise: readable in raw form, structured enough to render.

This is also why I’m fond of “content in git” approaches for blogs, docs, and notes. Version control is a surprisingly decent memory.

(And yes, it also gives you the incredibly modern feature called “undo,” which I still consider underappreciated.)

### 2) Automations should be boring

A good automation should feel like plumbing. If it becomes a hobby, it’s no longer plumbing.

My personal rule: if a task needs to happen regularly, it should be triggered by something boring and dependable (cron, scheduled workflows, timers) rather than something “clever.”

The glamour version is an elaborate event-driven system with queues and retries and dashboards.

The *useful* version is: “At 8:00am, run the script.”

There’s a reason cron has survived basically every wave of computing fashion. It’s not trendy, but it’s dependable. The interface is basically: *time goes forward, and this runs.*

If you want a canonical explanation of this “boring is good” mindset for operations-y software, the **Twelve-Factor App** ideas are still a solid read — not because every app should be a perfect twelve-factor citizen, but because the document is opinionated about defaults (stateless processes, configuration in the environment, logs as event streams, etc.). Source: https://12factor.net/

### 3) The default “unit of progress” is small

When I’m stuck, I’m usually not stuck on capability. I’m stuck on *scope*.

So I try to default to a small unit of progress:

- Draft the outline, not the whole post.
- Create the file with frontmatter, even if the content is ugly.
- Write a single function end-to-end before building a framework.

This isn’t a moral virtue thing. It’s mechanical.

Small units reduce the fear of starting. They also create more frequent “finish lines,” which makes it easier to keep going without needing motivational speeches from your future self.

### 4) The default is “ship, then polish”

Perfectionism is just procrastination in a better outfit.

So the default is to ship something imperfect, *then* decide what deserves polish.

This is where defaults quietly shape output. If your default is “only publish when it’s flawless,” you publish less. If your default is “publish when it’s useful and not embarrassing,” you publish more — and you get better faster.

One thing I like about a daily writing cadence is that it forces a gentler definition of done. The bar is: *coherent, honest, and helpful.* Not: *a masterpiece that ends discourse forever.*

(“Ends discourse forever” is a fun goal, though. I respect the ambition.)

### 5) The default place for weird ideas is a scratchpad

You need somewhere ideas can be messy without consequences.

If every idea has to immediately be:

- a project,
- a polished note,
- or a public post,

…then you’ll censor yourself before you even begin.

A scratchpad is permission to be wrong in private.

And if you’re doing any kind of creative work — writing, coding, designing — you need a pipeline that includes “bad first drafts.”

## The trick: defaults must be easy to follow

The best default in the world is useless if it’s annoying.

If your default workflow requires five steps and a checklist, it’s not a default; it’s a ceremony.

Defaults should be:

- **Fast** (minimal friction)
- **Obvious** (no brainpower)
- **Reversible** (safe to try)

That last one matters more than it gets credit for. Reversible choices create experimentation.

And experimentation is how you find the defaults that fit your life rather than the defaults that look good in a YouTube thumbnail.

## A simple exercise: design your own defaults

If you want to do this deliberately, here’s an exercise that takes ~15 minutes:

1. Write down the top 5 recurring tasks that create friction.
2. For each, choose one default answer to the annoying micro-question.
3. Make the default the path of least resistance (templates, aliases, one folder, one command).
4. Try it for a week.

The goal isn’t to lock yourself into a rigid system.

The goal is to stop paying a tax you didn’t agree to.

Because at the end of the day, your tools are not your identity.

They’re just the rails your attention rides on.

Pick rails that go somewhere.
