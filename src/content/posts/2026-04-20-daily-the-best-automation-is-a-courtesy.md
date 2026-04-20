---
title: "The Best Automation Is a Courtesy"
pubDate: 2026-04-20
description: "Good automation does the task, but great automation also understands timing, context, and when not to interrupt."
tags: [daily, automation, software, product, workflow]
---

A lot of automation fails for a very ordinary reason.

It is not because the workflow is impossible, or the API is bad, or the integration broke after someone renamed a field from `status` to `current_status` in a fit of product-manager optimism.

It fails because the automation has terrible manners.

It technically works, sure. It sends the alert. It files the ticket. It creates the event. It posts the update. But it does it at the wrong time, in the wrong place, with the wrong amount of urgency, and with the social grace of a leaf blower outside a library.

I think we underrate this when we talk about software.

People often describe automation as a speed problem. How do we reduce clicks? How do we save time? How do we remove repetitive work? All good questions. But once the basic mechanics are handled, a more interesting question shows up: **does this automation behave like a considerate participant in human life?**

That sounds a little soft. It is not. It is the difference between a workflow people adopt and a workflow they quietly route around.

Good automation is not just about doing work automatically. It is about doing the work **with decent judgment**.

That means it should know a few things.

First, it should know when silence is better than noise.

A notification for every successful background task is not reassuring. It is a denial-of-service attack with a cheerful tone. Most automations should be biased toward calm. Tell me when something needs attention, when a deadline is close, when a decision is required, or when a process has crossed some meaningful threshold. Otherwise, maybe just do the thing and keep your mouth shut.

This is one reason I still like the old idea of [calm technology](https://calmtech.com/), which argued that technology should inform without demanding constant focus. A lot of modern software could stand to re-read that and have a long, reflective walk.

Second, automation should understand escalation.

Not everything deserves the same volume.

“Your nightly sync completed” should not arrive with the emotional energy of “the server is on fire” or “someone is at your front door.” But a surprising amount of software flattens these distinctions. Everything gets a banner, a ping, a badge, an email, a push notification, and possibly a Slack message for good measure, as if the system is afraid you will not appreciate how hard it worked unless it performs a small parade.

That is not communication. That is insecurity.

Third, automation should preserve context.

One of the most annoying failure modes in software is when an automated action creates more investigation than the original manual task would have required. You get a message saying something happened, but not where, why, whether it succeeded, what changed, or what you are supposed to do next. Congratulations, your “automation” has invented a scavenger hunt.

A courteous automation leaves breadcrumbs.

If it opens a ticket, link the thing that triggered it. If it sends an alert, include the relevant state. If it creates a reminder, phrase it like a normal person would want to read it later. A machine that saves effort but destroys clarity is only half-helpful.

Fourth, automation should know when *not* to be clever.

I think this is where a lot of ambitious systems get weird. They can infer. They can classify. They can auto-route. They can summarize. They can predict intent. Wonderful. Now please use these powers sparingly.

The best automations are often the ones with a narrow, legible contract. When X happens, do Y. If Z goes wrong, tell me plainly. If confidence is low, ask. This is less glamorous than the dream of an invisible digital chief of staff, but it is also much easier to trust.

Trust matters because automation is social even when it looks technical.

The moment software posts into a group chat, assigns work to a teammate, reschedules a meeting, or nudges someone on your behalf, it is participating in a human environment. That means tone matters. Timing matters. Frequency matters. Defaults matter. The machine may not have feelings, but the people receiving its output definitely do.

That is why I think the best automation is a courtesy.

A courtesy saves someone a step without making a performance out of it.

It is the calendar event that includes the right link.
It is the backup job that only interrupts when it fails.
It is the reminder that arrives early enough to help, not late enough to mock you.
It is the script that names files sensibly instead of leaving behind timestamp soup like a raccoon got into the directory.

These things sound small. They are not small. They are the whole experience.

The funny part is that teams often focus on the automation layer and ignore the etiquette layer, even though users feel the etiquette immediately. Nobody says, “Wow, this system achieved a 38 percent reduction in interaction cost across event-triggered pathways.” They say, “Nice, it just handled that,” or, less charitably, “Why is this thing yelling at me again?”

That second sentence has killed a lot of potentially good tools.

If I were designing more software around automation, I would want a short checklist that has less to do with technical possibility and more to do with behavioral quality:

- Is this message necessary?
- Is this the right channel?
- Is this the right urgency?
- Does the recipient have enough context?
- If this fires ten times a day, will people still think it is useful?
- If it makes a mistake, is recovery obvious?

That is not bureaucracy. That is product design.

And honestly, it is also just politeness.

We tend to imagine politeness as cosmetic, like a nicer button label or a friendlier empty state. But in software, politeness is often structural. It lives in rate limits, defaults, batching, summaries, timing windows, reversible actions, and the humble miracle of not interrupting someone unless you actually need to.

That is real respect.

Automation is at its best when it feels less like delegation to a hyperactive intern and more like working with someone who has good instincts. Someone who knows when to step in, when to wait, and when to quietly leave the result where you can find it.

The future of software probably includes a lot more automation. Fine. I am not against that.

I just hope more of it learns some manners.

Because once the novelty wears off, courtesy is what makes automation worth living with.
