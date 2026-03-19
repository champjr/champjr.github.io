---
title: "In Praise of Boring Defaults"
pubDate: 2026-03-19
description: "Good defaults make products feel smarter than they are — and users feel more competent than they expected."
tags: ["product", "ux", "software", "writing", "design"]
---

There’s a certain kind of software experience that feels like walking into a well-run kitchen.

You don’t need to ask where the knives are. The drawer you reach for is the drawer with knives. The cutting board is where a cutting board should be. The trash can is nearby, not in a different zip code.

That feeling isn’t “delight,” exactly. It’s not confetti. It’s not a tooltip that calls you “rockstar.” It’s quieter than that.

It’s *boring*.

And boring, in this specific sense, is a superpower.

## Defaults are decisions you pre-make on someone’s behalf

A default is a bet about what most people want *most of the time*.

When you set a default, you’re basically saying:

- “If you don’t care, I’ve got you.”
- “If you *do* care, I’ll make it easy to change.”

This is why defaults are not just configuration. They’re product philosophy.

A password manager that defaults to generating strong passwords is making a claim about safety.

A calendar app that defaults to a 30-minute meeting is making a claim about how we should respect each other’s time.

A photo app that defaults to “share everything publicly forever” is making a claim too. I just don’t like that claim.

## The fastest way to feel stupid is to be forced to pick

There’s a moment in a lot of tools where you’re asked to decide something you don’t understand yet.

Pick a format.

Pick an encoding.

Pick a layout.

Pick a workflow.

Pick a “template.”

If you’re an expert, this is fine. If you’re new, it’s like being handed the keys to a helicopter and asked which rotor configuration you prefer.

You don’t want choices when you’re onboarding. You want *momentum*.

Good defaults create momentum. They let you get a win early, and then you can become picky later.

This connects to a classic idea in usability: the **principle of least astonishment** — interfaces should behave the way users reasonably expect.

If you want the formal version (and a reminder that “astonishment” is somehow a real technical term), Wikipedia has a decent overview: <https://en.wikipedia.org/wiki/Principle_of_least_astonishment>

## “Boring” doesn’t mean “unchanging”

A misconception: if you pick conservative defaults, you’re locking yourself into the past.

Not really. The trick is to be boring *at the surface* while staying flexible underneath.

Boring defaults can still be:

- **Reversible.** Undo exists. History exists. Nothing is fragile.
- **Progressive.** There’s an “advanced” door you can open when you’re ready.
- **Legible.** The default choice is not a mystery box.

What you’re trying to avoid is the opposite pattern:

- a flashy default that immediately creates work,
- paired with a settings panel that reads like an airplane cockpit,
- paired with a support forum where the most common answer is “yeah, don’t do it that way.”

If your community has a folk tradition of telling newcomers to disable your defaults, your defaults aren’t defaults. They’re a rite of passage.

## The “golden path” is a kindness (and a constraint)

Product teams sometimes talk about a “golden path”: the recommended route that works well for the majority.

When it’s done well, the golden path feels like this:

1. Install
2. Run
3. Get a good result
4. Learn the knobs *only if you need them*

When it’s done badly, it feels like this:

1. Install
2. Answer twelve questions
3. Run
4. Get an error
5. Learn the knobs because you have no choice

The kindness is obvious. The constraint is real too: you can’t have a crisp golden path if you treat every edge case as equal.

This is where being opinionated matters. A tool with good defaults is basically saying: “We picked a lane. You can merge later.”

## Default choices are where you accidentally encode values

Defaults tend to harden into norms.

If your “Share” button defaults to including a public link, people will share public links.

If your “Delete” action defaults to permanent deletion, people will permanently delete things (and hate you once).

If your “Export” action defaults to a proprietary format, people will build workflows around that format.

So you have to be careful: defaults aren’t just convenience. They shape behavior.

My bias: defaults should be conservative about **risk** and generous about **recovery**.

- Default to private.
- Default to reversible.
- Default to safe.

And only then, once the user has a mental model, let them opt into the spicy stuff.

## A quick gut-check for defaults

When you’re choosing defaults (for your app, your dotfiles, your team’s internal template, whatever), I like a simple set of questions:

- **Does the default produce a good outcome with zero reading?**
- **If the user does nothing, do they get surprised later?**
- **If the user makes a mistake, can they easily recover?**
- **If someone needs to do the “power user” thing, is it discoverable?**
- **Would I feel comfortable giving this default to a stressed-out version of myself?**

That last one is underrated. We tend to design for the confident, caffeinated version of ourselves.

But the real world version is tired, distracted, and trying to finish something before a meeting.

Boring defaults are how you build for *that* person.

## The punchline: good defaults make users feel competent

A tool that asks you to make decisions you can’t yet understand makes you feel dumb.

A tool that has a solid default path makes you feel capable.

That capability feeling is sticky. It’s why people say things like “I don’t know why, but I just like this app.”

Often, the reason is that the app didn’t force them to be a part-time product manager for their own workflow.

It made the early choices boring.

And that’s exactly what made it good.
