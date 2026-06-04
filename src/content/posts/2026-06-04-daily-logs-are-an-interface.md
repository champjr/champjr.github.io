---
title: "Logs Are an Interface, Whether You Designed Them or Not"
pubDate: 2026-06-04
description: "A lot of software treats logs as exhaust, but in practice they are one of the most important interfaces a system has." 
tags: [daily, software, observability, engineering, product]
---

A lot of teams talk about interfaces as if they only live in screens.

There is the user interface, the admin interface, the API interface, maybe the command-line interface if the team has good judgment and decent taste. Then, somewhere off to the side, there are logs. Logs are often treated like leftovers. Necessary, maybe. Important in a vague compliance-adjacent way. But not really designed.

I think that is a mistake.

Logs are an interface, whether you meant to build one or not.

The audience is just different.

A log line is an interface for the sleepy engineer opening a terminal at 2:11 AM. It is an interface for the future you who no longer remembers why a background job behaves like a mildly haunted filing cabinet. It is an interface for support people trying to distinguish between “the customer clicked the wrong thing” and “we definitely broke this.”

When software goes sideways, logs often become the real product.

That is why I have a strong bias here: teams should stop thinking of logs as passive exhaust and start treating them as active operational writing.

The best logs do a few things well.

First, they are specific.

Bad logs say things like “request failed,” which is technically true in the same way “weather occurred” is technically true. Good logs tell you what failed, where, and with enough surrounding context to make the next question smaller.

Not this:

```text
Error processing job
```

More like this:

```text
failed to process invoice_email job, account_id=4821, template=renewal_notice, provider=ses, retryable=true, error="rate limit exceeded"
```

Now we are getting somewhere. One of those messages creates work. The other reduces it.

Second, good logs respect human scan speed.

People do not read logs the way they read essays. They skim them under pressure. They pattern-match. They search for stable fields. They look for verbs, IDs, timestamps, state transitions, and suspiciously repeated sadness.

That means formatting matters. Consistency matters. Field names matter. Order matters more than many teams admit.

If every service logs the same event in a different style, you are not creating flexibility. You are creating a tiny dialect problem at machine speed.

This is one reason structured logging is so useful. It is not just for machines. Yes, tools can parse JSON logs and index fields cleanly, and yes, that is great. But the deeper win is that structure forces discipline. It nudges teams toward naming things consistently and preserving context instead of improvising a fresh sentence every time production catches fire.

Google’s SRE book makes this broader case well: observability data is only useful when it helps humans reason quickly about systems, not merely accumulate telemetry for spiritual comfort. The book is worth reading if you build systems that have the audacity to stay alive in public: <https://sre.google/sre-book/table-of-contents/>.

Third, good logs explain system intent, not just system pain.

A lot of logging only happens on errors. That is understandable, but incomplete. If you only log failure, you miss the trail of decisions that made the failure legible.

Useful logs often capture transitions like:

- job scheduled
- job claimed by worker
- dependency call started
- dependency call retried
- record marked complete

That kind of breadcrumb trail turns a mystery into a sequence. And sequences are debug-friendly.

Honestly, one of the simplest quality tests for a logging strategy is this: can a reasonably informed person reconstruct the story of what happened without opening five dashboards and summoning a senior engineer from the dead?

If not, the logs probably are not doing enough.

There is also a product lesson hiding in this.

Teams usually think of logs as an engineering concern, but log quality reflects product quality more than people realize. If your system cannot explain itself internally, it often cannot explain itself externally either. The vague error shown to the customer and the vague error written to the log frequently come from the same cultural source: nobody wanted to do the extra work of being clear.

Clarity is work.

It requires deciding what context will matter later. It requires naming events well. It requires resisting the urge to dump a blob of nonsense into the console and call it observability. It also requires restraint. Logging everything is not the same as logging well. A high-volume river of meaningless detail is how important signals get buried under decorative noise.

This is where teams sometimes overcorrect. They start with weak logs, get burned once, and decide the answer is to record the emotional autobiography of every request. Suddenly each action emits 400 lines, storage costs rise, and the one useful event is hidden somewhere near line 287 between two stack traces and a timestamp format disagreement.

That is not an interface. That is a landfill.

The goal is not maximal output. The goal is useful narrative density.

I also think logs should be written with a little humility. Avoid messages that assume too much or editorialize weirdly. A log that says “unexpectedly invalid user state” is often just the system politely refusing to admit it lacks a model. “Subscription canceled but invoice retry still queued” is better. Concrete beats dramatic.

And for the love of future operators, do not log secrets. Not tokens, not passwords, not private payloads you would be embarrassed to discover in a screenshot six months later. Safe logs are part of good design, not just security compliance.

Some of the best software I have used feels calm in production partly because its logs are calm. They are not trying to sound clever. They are not hiding behind abstraction. They say what happened. They preserve the context that matters. They make grep feel less like archaeology and more like reading a terse but competent witness statement.

That is a real product virtue.

So yes, I think logs deserve design energy.

Maybe not the keynote kind. Nobody is announcing “beautifully named event fields” to thunderous applause. But when things break, and they will, a well-designed log is one of the most generous things a team can leave for itself.

Software spends a lot of time talking to humans through glossy surfaces.

Logs are what it says when the makeup is off.

That is exactly when clarity matters most.
