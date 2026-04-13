---
title: "The Case for Medium-Sized Tools"
pubDate: 2026-04-13
description: "Why some of the most satisfying software lives between a tiny script and an enterprise platform."
tags: [tools, software, workflow, product]
---

There is a strange gap in software discourse.

On one side, people celebrate tiny tools. A shell script. A single-purpose CLI. A little utility that does one job cleanly and then politely gets out of the way. Fair enough. Tiny tools are great.

On the other side, there are platforms. Full ecosystems. Suites. Operating systems wearing fake mustaches. These get a lot of attention too, mostly because they are ambitious, expensive, or loud enough to be mistaken for inevitable.

What gets less love is the category in the middle: **medium-sized tools**.

I mean software that does more than one small thing, but still feels graspable by one human brain. Tools with a clear shape. Tools you can learn in an afternoon, trust over time, and bend a little without needing a procurement department or a support contract. Not a one-liner. Not a cathedral. Something in between.

I think this is an underrated sweet spot.

Medium-sized tools are often where software feels most humane.

A tiny tool is elegant right up until you need five more of them, plus glue code, plus your own conventions, plus a README that gradually turns into local mythology. This is the classic fate of many "simple" workflows. You start with one helpful script and end three months later with an accidental framework that only makes sense if you were present at its creation.

Meanwhile, the very large tool solves that problem by doing everything. In theory, anyway. In practice, it often introduces a different kind of tax: more setup, more abstraction, more defaults, more vocabulary, more little ceremonies required before anything useful happens. It may be powerful, but it is also a lifestyle.

Medium-sized tools avoid both traps when they are done well.

They usually have a few qualities I really like:

- They have an opinion, but not a religion.
- They solve an adjacent cluster of problems, not one microscopic issue.
- They can be inspected without reading a whitepaper.
- They have enough surface area to grow with you, but not enough to demand allegiance.

That last part matters. A lot of software quietly wants to become your new operating philosophy. It wants to own your workflow, your data model, your team's rituals, and possibly your idea of self-worth. I am increasingly suspicious of that ambition.

Sometimes I do not want a platform. I want a sturdy, capable object.

This is one reason I still like a lot of good command-line software. Some of the best CLI tools grow just far enough. They start with one obvious use case, then earn a few more. They add filters, previews, search, config, maybe some scripting hooks. After a while they become substantial, but they still feel like tools, not kingdoms.

A good example is [ripgrep](https://github.com/BurntSushi/ripgrep). Yes, at first glance it is "just grep, faster and friendlier." But that undersells it. It is not merely a single trick. It is a practical search environment with sensible defaults, file filtering, regex support, and ecosystem compatibility, all while staying mentally portable. It is bigger than a toy, smaller than an empire.

That shape is powerful.

The same pattern shows up outside the terminal too. The software people keep around for years is often not the most all-encompassing product. It is the one that occupies a clear middle layer in their life. Big enough to reduce friction. Small enough to remain legible.

Legibility is the key word here.

I think we underrate how much pleasure comes from software you can still *see*. Not visually, necessarily, but conceptually. You know where things are. You know roughly how it behaves. When it breaks, you have a fighting chance of guessing why. When you want to extend it, you are editing the tool, not negotiating with a bureaucracy.

This is also why medium-sized tools age well. Tiny tools can become brittle because they depend on the user to provide all the structure. Giant platforms can become bloated because they keep absorbing edge cases like a whale filtering plankton. But medium-sized tools often keep their dignity longer. They have enough internal structure to be reliable, and enough restraint to avoid becoming a swamp.

Of course, this category is hard to market.

"Pretty capable, still understandable" is not the sort of phrase that sends venture capitalists into orbit. It is not as romantic as "Unix philosophy" and not as glamorous as "all-in-one workspace for the future of intelligent collaboration." It is, however, the kind of software normal people actually get attached to.

You can tell when a tool has found this balance because users talk about it with a specific sort of affection. Not the zealous tone of converts. More like the fondness people have for a well-made bag, notebook, or kitchen knife. It is useful. It wears in nicely. It does not constantly ask to become part of your personality.

I wish more software aimed for that.

There is a lot of room on the internet for products that are competent, opinionated, and bounded. Products that say: here is the problem area I cover, here is how I think about it, and here is where I stop. That last part, especially, feels almost radical now.

Because software that knows where it stops is easier to trust.

And trust, in practice, is what makes a tool stick. Not raw capability alone. Not feature count. Not branding. Trust is built when the software helps repeatedly without becoming an administrative event. When it saves time without demanding devotion. When it is powerful, but still proportionate.

Maybe that is the case for medium-sized tools in one sentence: **they respect the scale of an actual human life**.

They are not trying to automate every dimension of your existence. They are not trying to reduce you to a workflow diagram. They just help, in a way that remains understandable.

That is not a small thing. It is probably the size most software should be.
