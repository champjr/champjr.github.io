---
title: "Boring Naming Conventions Are a Secret Productivity Tool"
pubDate: 2026-06-11
description: "Predictable names look unglamorous, but they remove tiny decisions that quietly waste a shocking amount of energy."
tags: [daily, workflow, software, naming, productivity]
---

There are many glamorous ways to improve how a team works.

You can redesign the sprint ritual. You can buy a new project management system. You can invent a folder taxonomy with enough color coding to qualify as a municipal transit map.

Or, and I say this with affection, you can name things less creatively.

I think boring naming conventions are one of the most underrated productivity tools in modern work.

Not because naming is thrilling. Quite the opposite. Good naming conventions are useful for the same reason good plumbing is useful. You mostly notice them when they are missing, and once they are working you would prefer not to hear a keynote about them.

A lot of day-to-day friction is really just search friction wearing a fake beard.

Where is the final file. Which dashboard is the current dashboard. Is `homepage-new` newer than `homepage-final`, or is `homepage-final` actually older than `homepage-final-v2` because somebody panicked on a Thursday. Is the Slack channel called `#ops-prod`, `#production-ops`, or `#ops-war-room`, and are those all somehow different places.

None of this feels like a strategic problem when it happens once. It feels trivial. Mildly annoying. The kind of thing people shrug off because the cost is measured in seconds.

But seconds are sneaky. If a task forces ten micro-decisions before the real work begins, the problem is not just elapsed time. The problem is mental drag. Tiny ambiguities break momentum. They make simple work feel heavier than it should.

That is why predictable naming matters.

A good convention does not need to be beautiful. It needs to answer the obvious questions fast. What is this. When was it made. What system does it belong to. Is it active, archived, draft, or experimental. If the answer is visible in the name, a surprising amount of coordination disappears.

This is especially true in environments where everything multiplies. Repositories, documents, Slack channels, dashboards, scripts, feature flags, saved searches, cloud resources. The modern workplace is basically a giant machine for generating nouns. If those nouns drift into chaos, people start spending real energy translating the system back into English.

I suspect this is one reason developers become weirdly passionate about naming conventions. It is not because they love rigid order for its own sake. It is because they have suffered. They have stared into the abyss of an S3 bucket list or a shared drive full of files named things like `misc`, `temp2`, and `newest-use-this`.

There is a quiet joy in being able to guess correctly.

When a post is named `YYYY-MM-DD-topic`, or a feature branch is `feature/user-export`, or a meeting note is `2026-06-11-planning`, you do not have to admire the artistry. You just find the thing. Your brain gets to stay focused on the actual task instead of performing a little archaeological dig.

This does not mean every system needs maximum ceremony. Over-optimization is real. If naming a quick experiment requires consulting a seven-page policy document, congratulations, you have turned helpful structure into a minor religion.

The sweet spot is lightweight predictability.

A few simple patterns go a long way:

- Put the most important differentiator first.
- Use dates in sortable formats like `YYYY-MM-DD`.
- Prefer plain language over internal poetry.
- Reserve words like `final` for the comedy museum and use versioning or status labels instead.
- If people cannot guess the name, the convention probably is not doing its job.

This overlaps with a broader design principle I like: make good behavior the path of least resistance.

People usually do not create naming chaos because they are irresponsible. They do it because the system has no default shape, and improvisation is faster in the moment. Then the pile grows. Then everyone inherits it.

This is why software that enforces just enough naming structure often feels disproportionately calming. Git branch prefixes. Date-based note templates. auto-generated issue numbers. predictable URL slugs. These are small constraints, but they reduce a lot of ambient uncertainty.

The same idea shows up outside software too. Libraries have call numbers. Streets have addresses. Airports have gate numbers, which is good, because “the gate near the coffee place with the weird carpet” would not scale especially well.

There is even research behind the value of reducing unnecessary decisions. The classic idea of [decision fatigue](https://en.wikipedia.org/wiki/Decision_fatigue) gets cited a lot, sometimes too casually, but the general point holds up in practice: when routine choices pile up, they steal attention from the choices that actually matter.

That is what boring naming conventions buy back. Not genius. Not creativity. Just attention.

And attention is expensive.

So yes, I like elegant systems and clever ideas and beautifully crafted interfaces. But I also think there is something noble about a filename that behaves itself.

Not every improvement needs to feel innovative. Some of the best ones just make the mess easier to navigate.

Boring names, used consistently, are a tiny act of mercy for your future self and everyone else wandering through the same digital attic.
