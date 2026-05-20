---
title: "The Best Error Messages Pick a Lane"
pubDate: 2026-05-20
description: "Why helpful software stops trying to sound mysterious when something goes wrong."
tags: ["daily", "software", "ux", "writing", "design"]
---

You can learn a lot about a product from the moment it fails.

When everything works, software gets to borrow confidence from the happy path. Buttons click. Pages load. Files save. The app looks competent because nothing has asked it a difficult question yet.

Then something breaks.

A network request times out. A form field rejects an input. A sync job gets confused. A file vanishes into whatever digital swamp inconvenient files go to when they want attention.

And suddenly the product has to speak in its own voice.

This is why I think error messages are one of the purest expressions of software quality. Not because they need to be poetic. Usually they very much should not be poetic. But because they reveal whether a team has decided what kind of help it is actually willing to offer.

The best error messages pick a lane.

They do not try to be vague and detailed at the same time. They do not act apologetic while hiding the reason. They do not throw a raw stack trace at a normal person and then pretend this counts as transparency. They tell you what happened, what it means for you, and what to do next.

That is the lane.

## Most bad error messages are trying to dodge responsibility

A lot of error copy sounds like it was written by a committee of nervous ghosts.

"Something went wrong."

Yes, thank you. I had sensed a disturbance.

Or you get the opposite problem, where the message dumps internal jargon without translation.

"Request failed due to upstream invalidation during serialization."

Maybe that is accurate. Maybe it is even noble in its accuracy. But if the user cannot tell whether they should retry, wait, refresh, or abandon hope, the message has still failed.

What makes these bad is not just lack of clarity. It is evasion.

The software is effectively saying, "A problem exists, but I am not prepared to describe the boundary between my problem and your problem. Good luck."

That boundary is the whole job.

## Good error messages answer three questions

I think most useful error messages can be judged by whether they answer three simple questions:

1. What happened?
2. What does this affect right now?
3. What should I do next?

That is it. Not a novel. Not a legal brief. Not a haunted shrug.

For example:

- "Your file did not upload because the connection dropped."
- "Nothing was saved yet."
- "Try again, or save the file locally and upload later."

That message may not be beautiful, but it is kind. It reduces uncertainty.

This lines up with long-standing usability guidance too. Nielsen's heuristic of helping users recognize, diagnose, and recover from errors is boring advice in the best possible way, because boring advice tends to survive contact with reality. The original [10 usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) still hold up.

The key word there is recover.

A product does not earn trust by never failing. That is not an available option. It earns trust by making failure legible.

## Specificity is usually more comforting than reassurance

One of the funniest little mistakes in software writing is the belief that softening an error makes it feel better.

It often does the opposite.

"Oops! We hit a snag" sounds friendly until you need to decide whether you just lost an hour of work.

In those moments, specificity is more comforting than cheerfulness.

Tell me the draft is still saved.
Tell me my payment did not go through.
Tell me the imported CSV had 14 rows with invalid dates.
Tell me the sync is delayed but not broken.

That is real reassurance, because it gives me something solid to stand on.

This is also why I like interfaces that separate the user-facing explanation from the technical details instead of trying to mash them together. A short plain-language summary, followed by expandable details or an error code, is often the best of both worlds. Normal users get clarity. Technical users get breadcrumbs. Support teams get something searchable.

Everyone wins, or at least loses less badly.

## Error tone matters, but not as much as direction

I am not anti-personality in software. A little style can make products feel less sterile. But error states are where a lot of clever brand voice goes to die.

If the app wants to joke with me while my work may have disappeared, it had better be extremely sure the joke is helping.

Usually it is not.

This is one of those places where tone should be subordinate to direction. A calm sentence is better than a funny sentence. A useful sentence is better than a charming sentence. If you can be all three, great, but useful should get the first draft.

My favorite error messages have a kind of professional composure. Not cold, not robotic, just steady. They sound like someone who has seen this problem before and already knows the next move.

That is the emotional effect good software should aim for. Not "Whoopsie." More like, "Here is the situation. Here is the plan."

## The hidden test is whether the message changes behavior

A surprisingly practical question to ask about any error message is this: after reading it, does the user know what to do differently?

If not, the message is probably just narration.

This matters internally too. Teams often treat error handling as edge-case polish, when it is really part of the main interface. If a failure happens often enough to deserve a dashboard, it probably deserves better copy too.

The message is not decoration on top of the system. In failure states, the message *is* the system.

That is why strong products often feel smarter than they technically are. They explain themselves well. And weak products often feel dumber than they are because they go silent at exactly the wrong moment.

## Pick a lane, then help people move

I do not need software to promise perfection. I need it to stop becoming cryptic under pressure.

When something breaks, pick a lane.

Be plain about what happened.
Be honest about what is affected.
Be concrete about the next step.

If there is an error code, fine, include it.
If there are details for advanced users, great, make them available.
But first, do the human job.

Good error messages are not just better writing. They are evidence that the product remembers a stressed person is reading.

That should not be a high bar.

And yet here we are, still being told that something went wrong.
