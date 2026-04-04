---
title: "Software Should Show Its Appetite"
pubDate: 2026-04-04
description: "The best tools warn you how much time, attention, or compute they’re about to eat."
tags: [daily, software, ux, developer-tools, productivity]
---

One of my favorite qualities in software is also one of the least glamorous: **it gives you a decent warning about how hungry it is**.

How much time will this action take?
How much of my screen, CPU, bandwidth, or attention is it about to consume?
Is this a tiny nibble, or am I accidentally summoning a whale?

A surprising amount of software treats this as an optional courtesy. You click a button labeled something vague like **Sync**, and suddenly your fans spin up, your laptop gets warm enough to fry a philosophical egg, and you’re locked into a progress bar that appears to be measuring time in geologic epochs.

This is bad manners.

Good tools show their appetite.

## Small actions should look small

People build trust with software the same way they build trust with people: by learning whether the other party is going to be weirdly expensive.

If I click “rename file,” I expect a quick, boring, almost invisible operation.
If I click “reindex the whole library,” I expect some ceremony.
If I click “generate a video from 400 source clips using AI,” I expect the app to stare at me for a second and say, “Just so we’re aligned, this is going to be a *whole thing*.”

The problem is that many interfaces flatten these into the same visual weight. A tiny operation and a huge one both get identical buttons, identical wording, and identical emotional posture.

Then the software acts offended when the user feels ambushed.

## Appetite is not just speed

When I say “show its appetite,” I don’t just mean loading spinners.

I mean the software should reveal, as clearly as it can:

- **How long** something will probably take
- **How much** data or compute it will use
- **What scope** it will touch
- **Whether it’s reversible**
- **What will happen next** while it’s running

That information changes behavior.

People are much more willing to do heavy tasks when the tool is honest about the cost. Weirdly, honesty often makes the software feel *faster*, even when it isn’t.

Jakob Nielsen’s classic response-time guidance still holds up pretty well: around **0.1 seconds feels instantaneous**, **1 second keeps the user’s flow mostly intact**, and **10 seconds is about the upper bound before attention starts to wander**. That doesn’t mean every task must be under 10 seconds; it means longer tasks need better explanation and feedback.

Source: <https://www.nngroup.com/articles/response-times-3-important-limits/>

In other words, if your tool is going to be slow, it needs personality, context, and a plan.

## Great tools narrate the blast radius

The best command-line tools do this naturally.

A dry run says: “Here is what I *would* do.”
A diff says: “Here is exactly what changes.”
A query planner says: “Here is why your database is about to ruin your afternoon.”
A package manager that lists the dependencies it will install is basically saying: “I’m hungry, but here’s the grocery list.”

That’s excellent behavior.

The worst tools, by contrast, are the ones that greet every action with the same poker face.

Delete one file? Sure.
Delete 18,000 files? Also sure.
Download a tiny update? Sure.
Rebuild your entire local cache from orbit? Sure.

That’s not confidence. That’s a lack of introspection.

## “Estimated time remaining” is allowed to be a little wrong

A lot of software avoids estimates because estimates can be wrong.

Fair. But the absence of an estimate is often worse.

Users do not need prophetic certainty. They need enough signal to make a decision.

If an export is likely to take **30 seconds**, tell me that.
If a build usually takes **3–5 minutes**, tell me that.
If the answer is truly unknowable, tell me what it depends on: file count, network speed, model size, queue depth, phase of the moon, whatever.

A rough estimate says, “We respect your time enough to model it.”
No estimate says, “Good luck in the void.”

And honestly, most people are forgiving if the estimate is framed as an estimate. What they hate is feeling trapped.

## Appetite should affect defaults

If an action is cheap, make it easy.
If an action is expensive, make the cost obvious.

This sounds simple, but it has big implications:

- Expensive actions should often have **preview states**.
- Irreversible actions should carry **stronger language**.
- Long-running jobs should usually become **background tasks**.
- Heavy features should remember my preference for **“ask first”** or **“run overnight.”**

A mature tool doesn’t just show appetite once. It learns when not to interrupt your day with it.

That’s one reason schedulers, batch queues, and “notify me when done” flows feel so civilized. They acknowledge a basic truth: just because a task is valid doesn’t mean it belongs in the foreground of my life right now.

## This matters beyond apps

I think this principle applies to teams, APIs, and products in general.

A good API call tells you about rate limits.
A good cloud dashboard estimates cost before you click deploy.
A good migration script explains how many rows it will touch.
A good coworker says, “This looks like a five-minute fix, unless we open the old billing code, in which case cancel your afternoon.”

That last one is not a bug. That’s wisdom.

Systems become humane when they reveal their appetite up front.

## A tiny checklist for builders

If you make software, it’s worth asking:

- Does the user know the **scope** of this action before running it?
- Do we show the likely **time or cost** when it’s nontrivial?
- Is there a **preview, dry run, or diff**?
- Can long tasks move to the **background** without punishing the user?
- If the task is stalled, do we explain **what phase** it’s in?

If the answer to most of those is no, the tool may still be powerful — but it probably feels heavier than it needs to.

## The punchline

The software I love most is rarely the flashiest.

It’s the stuff that quietly says, “Here’s what this will cost. Here’s what I’m touching. Here’s how long I think it’ll take. You still want to do it?”

That is such a sane, grown-up way for a tool to behave.

Software does not need to be timid. It can do big, ambitious, computationally ridiculous things. But it should not pretend those things are free.

Show me your appetite, and I’ll trust you more.
Hide it, and every click starts to feel like opening a restaurant bill face-down.
