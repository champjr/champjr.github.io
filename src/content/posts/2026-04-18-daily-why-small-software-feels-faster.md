---
title: Why Small Software Feels Faster, Even When It Isn't
pubDate: 2026-04-18
description: The products that feel quick usually do less, say less, and make fewer tiny demands on your attention.
tags: [daily, software, product, ux]
---

I keep coming back to a simple product truth: users do not experience software as a stopwatch. They experience it as a sequence of interruptions, confirmations, delays, and little moments of doubt.

That is why small software often *feels* faster than big software, even when the underlying system is not dramatically quicker.

A page can load in a respectable amount of time and still feel slow if it arrives with a parade of popups, skeleton screens, tour modals, permission prompts, and a suspiciously cheerful tooltip explaining where the settings moved this week. Meanwhile, a scrappy little tool can take a beat to think, show one honest loading state, and somehow come across as relaxed, competent, and quick.

That difference matters more than a lot of teams want to admit.

The classic usability guidance from Nielsen Norman Group still holds up well here: users tend to notice delays around 0.1 seconds, 1 second, and 10 seconds in meaningfully different ways. Those thresholds are not magic, but they are useful because they describe perception, not just performance graphs. If you have never read that piece, it is still worth your time: [Response Times: The 3 Important Limits](https://www.nngroup.com/articles/response-times-3-important-limits/).

But I think modern software has added a new failure mode on top of raw delay: **interaction overhead**.

Interaction overhead is all the tiny work a product makes you do that is not your actual goal.

It is the extra click to dismiss a panel you did not ask for. The mandatory workspace picker when there is only one workspace. The "Are you sure?" for an action that is obviously reversible. The dashboard full of cards before you can get to the one screen you actually use. The settings taxonomy that reads like the org chart of the company that built it.

None of these things are individually catastrophic. Together, they create drag. And drag feels like slowness.

This is why some "lightweight" apps earn such intense loyalty. They are not just using fewer megabytes. They are wasting less of your cognitive budget.

The best small tools usually share a few habits:

They get to the point quickly.

They do not narrate every clever thing they are doing.

They avoid turning setup into a personality test.

They make default choices confidently.

They do not ask for your attention unless they can justify the interruption.

That last one is underrated. Attention is the most expensive resource in the room, and a lot of software spends it like it is using a corporate card at an airport bar.

I also think small software benefits from a kind of emotional clarity. When a tool is focused, the user can build a clean mental model of it. "This app is for capturing notes." "This script resizes images." "This website tells me when the train is coming." You can hold the whole thing in your head.

Once software grows past that boundary, it often starts compensating with ceremony. More navigation. More labeling. More onboarding. More explanation. Sometimes that is necessary, but sometimes it is just interest on product debt.

There is a design temptation to equate richness with reassurance. Add another status badge. Add another explanation. Add another secondary action so nobody feels trapped. Add another layer of customization so power users feel respected. Each move is defensible. But the combined effect can be a product that constantly clears its throat before speaking.

Small software, by contrast, often sounds like someone who knows what they mean.

This is not an argument that every product should be tiny. Plenty of serious tools need breadth. If you are building Figma, GitHub, or a cloud platform, "just do one thing" is not especially useful advice. Complexity is sometimes earned.

But even big products can borrow the manners of small ones.

They can make the common path obvious.

They can stop treating every screen like a chance to advertise adjacent features.

They can reduce decisions that do not improve outcomes.

They can remember that speed is partly technical and partly social. A product that respects your time feels faster because, in a practical sense, it is. It asked less from you.

That is the part I wish more teams measured.

Not just time to first paint, but time to confidence.

Not just API latency, but time to "I know what to do next."

Not just task completion, but how many tiny permissions, prompts, explanations, and side quests happened along the way.

Software can be objectively fast and still subjectively exhausting. In the long run, exhausting software loses.

The products people describe as "fast" are usually the ones that help them stay in motion. No drama, no extra ceremony, no surprise committee meeting with the interface.

Maybe that is the real advantage of small software. It is not merely smaller. It is more willing to let the user remain the main character.
