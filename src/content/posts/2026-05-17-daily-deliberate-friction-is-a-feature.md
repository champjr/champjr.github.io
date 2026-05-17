---
title: "Deliberate Friction Is a Feature"
pubDate: 2026-05-17
description: "A small defense of the tiny pauses and confirmations that keep software from becoming too eager."
tags: [daily, product, software, ux, workflow]
---

A lot of software is obsessed with removing friction. That instinct is usually right. Nobody wakes up hoping for three extra modal dialogs, a maze of settings, or a loading spinner that feels like it is thinking about its childhood.

But there is a version of “frictionless” that quietly turns into “reckless.” And once you notice it, you start seeing it everywhere.

A button that archives a project instantly when it probably should ask, “Are you sure?” An AI tool that eagerly rewrites a sentence when you only wanted a suggestion. A file sync product that helpfully propagates your mistake to every device at machine speed. A social app that makes posting so easy you realize, two seconds too late, that ease was not actually your main problem.

Sometimes the best product decision is a tiny speed bump.

I think good software needs two kinds of motion: fast paths for routine actions, and deliberate friction for meaningful ones. The trouble is that many products are excellent at the first part and almost embarrassed by the second. They want to feel magical, effortless, invisible. They do not want to admit that some actions deserve a moment of ceremony.

But ceremony is not always bloat. Sometimes it is respect.

A confirmation step can be a way of saying, “This matters.” A version history panel says, “You are allowed to change your mind.” A publish flow with preview says, “Maybe look at this once as a reader before launching it into the world.” Even the humble undo button is a kind of product philosophy. It assumes humans are smart, busy, distractible, and occasionally one mis-click away from inventing new vocabulary.

That is not bad UX. That is humane UX.

The mistake is treating all friction as equal. Bad friction is repetitive, confusing, and divorced from user intent. It makes simple things weird. Good friction is brief, legible, and placed exactly where consequences become real.

You can feel the difference immediately.

Bad friction is having to re-enter your password every six minutes because a security team somewhere lost an argument. Good friction is a destructive action asking for one extra beat before it happens.

Bad friction is a form with twelve required fields before you can try the product. Good friction is a payment screen that shows the actual total, the renewal terms, and the cancellation path before it lets you click buy.

Bad friction is a collaboration tool that pops a notification for every microscopic update. Good friction is a sharing setting that forces you to decide whether a document is private, team-only, or public.

There is a reason products like Git made “commit” such a strong verb. The word itself carries weight. You are not just vaguely saving some vibes. You are recording a state change. That tiny bit of seriousness is useful.

I suspect the next wave of product design will need more of this, not less.

As software gets more agentic, more auto-completing, more willing to take initiative, deliberate friction becomes even more important. Systems that can act on your behalf should probably reveal a little more intent before they do. “Here is what I am about to change” is a much better sentence than “Done :)” when the blast radius is unclear.

This is one reason I like tools that separate draft mode from live mode. It is also why I think preview states, dry runs, staged changes, and explicit confirmation screens are underrated design moves. They are not signs that a product lacks confidence. They are signs that it understands consequences.

In developer tools, this lesson is already old news. We have `git diff`, CI checks, feature flags, migrations with rollback plans, and dry-run options for a reason. The system is not insulting you by asking you to look twice. It is collaborating with the reality that production is an expensive place to improvise.

If you want a nice example outside of coding, the [Nielsen Norman Group's writing on error prevention](https://www.nngroup.com/articles/slips/) is still a useful anchor. Preventing slips is not about distrusting users. It is about designing for the fact that attention is finite.

I do not want software to become slower or fussier. I want it to get better at distinguishing between low-stakes flow and high-stakes intent.

Delete should feel different from duplicate. Publish should feel different from preview. Send should feel different from save draft. “Run everywhere” should maybe feel at least a tiny bit different from “try locally.”

The dream is not zero friction. The dream is friction with taste.
