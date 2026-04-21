---
title: "Software Should Show You the Future"
pubDate: 2026-04-21
description: "Why previews, dry runs, and diff views make software feel smarter and safer."
tags: ["daily", "software-design", "ux", "developer-tools"]
---

There is a special kind of software confidence that has nothing to do with branding, animations, or how many AI sparkles are taped to the landing page.

It comes from a much simpler question: before I commit to this action, will the software show me what is about to happen?

That is one of the most underrated product features in computing.

A preview is not glamorous. It does not usually make the keynote. Nobody posts, “just used a really tasteful confirmation screen, life changed.” But previews, dry runs, and diff views quietly do something more important than marketing. They reduce the cost of trust.

You can feel this in good developer tools immediately. `git diff` is the obvious example. It answers the most useful question in programming: “what, exactly, changed?” Terraform’s `plan` command does something similar for infrastructure. It lets you inspect the future before you apply it, which is a very civilized way to operate a computer. Instead of saying “trust me,” the tool says “let’s look together.” If you have never used it, the [Terraform plan documentation](https://developer.hashicorp.com/terraform/cli/commands/plan) is a good example of this philosophy made concrete.

This idea should exist far beyond developer tools.

Any software that can change something important should be a little eager to show its work.

Delete 200 photos? Show me which ones.

Rename a folder tree? Preview the before and after.

Import a CSV? Tell me what columns matched, what broke, and what is about to get weird.

Send a newsletter? Render the actual email, not an approximation from three screens ago.

Even a tiny “this will affect 48 items” message can change the emotional tone of a product. Suddenly it feels less like a machine pulling levers behind a curtain and more like a competent person narrating the next step.

I think this matters because most software risk is not dramatic risk. It is not “the data center exploded.” It is smaller and more common than that. It is the risk of unintended consequences. The wrong files get moved. The wrong audience gets the message. The wrong setting gets copied to production. A default gets accepted because the interface made speed too easy and inspection too annoying.

A preview is a way of respecting hesitation.

That sounds like a small thing, but it is actually a strong product opinion. A lot of software is optimized around momentum. Click next, keep going, complete the flow, do not interrupt the conversion funnel. Friction is treated like a bug, even when some friction is plainly useful. The result is software that feels efficient right up until it causes rework.

Good previews are strategic friction. They slow down the dangerous part, not the whole experience.

This is also why “undo” and “preview” are siblings, not substitutes.

People sometimes treat undo as the answer to everything. Just let users reverse the action later. That is helpful, and more products should have excellent undo, but it is not the same thing. Undo repairs trust after a mistake. Preview protects trust before one. The best products do both.

There is also a subtle psychological effect here. When software shows me the result ahead of time, I assume the creators have thought carefully about consequences. When it does not, I start wondering what else they skipped. The presence of a preview makes the whole system feel more deliberate.

And previews do not need to be fancy.

In many cases, a plain text summary is enough:

- 12 files will be renamed
- 3 entries will be skipped due to missing dates
- 1 duplicate record will be merged
- No existing data will be deleted

That little block of text can do more for user confidence than an entire illustration library.

I have the same reaction to websites and apps that explain defaults clearly. “We selected this option because it preserves your existing data.” Great, now I know what game we are playing. Explain the next move and I relax. Hide the next move and I get suspicious.

The funny thing is that software teams often know this instinctively in internal tools. Engineers love staging environments, preview deploys, feature flags, and test runs. Then the public product ships with a cheerful button that says something vague like **Continue**. Continue to what, exactly? That button is doing a lot of emotional damage.

If I had a universal design rule for software that changes state, it would be this: whenever the stakes are non-trivial, let the user inspect the future.

Not every click needs a ceremony. Nobody wants a confirmation dialog for increasing the volume. But when the action is expensive, irreversible, wide-ranging, or easy to misunderstand, the software should become a better conversational partner. It should say what it believes will happen next.

That is not only good UX. It is good manners.

A preview says: your caution is reasonable, your attention is valuable, and we are not going to make you guess.

More software should have that kind of confidence. Quiet confidence. The kind that does not ask for trust first, but earns it one visible consequence at a time.
