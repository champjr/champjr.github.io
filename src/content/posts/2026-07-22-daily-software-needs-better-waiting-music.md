---
title: "Software Needs Better Waiting Music"
pubDate: 2026-07-22
description: "When software makes us wait, it should explain the wait instead of pretending a spinner is a strategy."
tags: [daily, product, software, ux, design]
---

One of the least respected moments in software is the wait.

Not the big dramatic wait, like a video export or a game install. I mean the tiny everyday stalls. A sync that takes a beat. A search index warming up. A document importing. A deploy screen hanging just long enough for you to wonder whether it is working or quietly composing your villain origin story.

Most products still handle these moments with the same blunt instrument: a spinner and a vague hope that you will stay emotionally available.

I think that is a design failure.

When software makes people wait, it should do a better job of explaining what kind of wait this is.

Is progress happening?

Is the system blocked on another service?

Is this operation usually ten seconds or two minutes?

Can I leave this screen safely, or is this one of those applications that treats navigation like betrayal?

A surprising amount of user trust lives inside those questions.

This is why I keep coming back to the idea that waiting is part of the interface, not an awkward gap between interfaces. If a product has to pause, that pause is still a user experience it is responsible for.

And yet, plenty of software behaves as if the wait is beneath explanation. You get a throbber. Maybe some animated dots. Maybe a message that says “Processing...” with the emotional depth of a microwave.

That might have been acceptable when software was smaller and expectations were lower. It feels lazy now.

The best systems do something more honest. They give shape to the delay.

A good loading state can tell you what is happening, what happens next, and whether your action was successfully received. It does not need to become a novel. It just needs to reduce ambiguity.

That distinction matters because users are often not frustrated by waiting alone. They are frustrated by uncertainty.

People will tolerate a surprising amount of delay when the delay feels legible. Package trackers work this way. Build pipelines work this way when they are designed well. Even old-fashioned file copy dialogs, for all their many sins, at least attempted to answer the basic human question: is this moving forward or not?

The Nielsen Norman Group has written for years about visibility of system status as a core usability principle, and it remains one of the most durable pieces of UX advice on the internet ([Visibility of System Status](https://www.nngroup.com/articles/ten-usability-heuristics/)). Users should not have to infer whether software heard them.

That sounds obvious, but a lot of products still make people guess.

You click a button and nothing visibly changes for three seconds. So you click again. Now you have two uploads, three calendar invites, or a duplicate order headed bravely into the world. This is not really a user error. It is a communication error.

I also think software teams underrate how different kinds of waiting feel.

There is “we are fetching data.”

There is “we are doing work on your machine.”

There is “we are waiting on another system and do not control the pace.”

There is “this is complete, but the interface has not caught up yet.”

Those are not the same experience, and they should not all look like the same little spinning circle auditioning for a job it cannot actually do.

Sometimes a determinate progress bar makes sense. Sometimes a staged checklist is better. Sometimes the right answer is a plain sentence that says, essentially, this usually takes about a minute and you do not need to keep this tab open. That sentence is not flashy, but it is generous.

Good waiting states also make products feel more competent than they technically are.

I do not mean deceptive polish. I mean that explanation changes the emotional temperature. A slow tool that narrates itself clearly often feels more trustworthy than a faster tool that disappears into silence and then snaps back with results like nothing happened.

This is one reason I have a soft spot for apps and systems that expose a little operational truth. Show me the steps. Show me the queue. Tell me you are “uploading,” then “processing,” then “finalizing.” I do not need every internal detail, but I appreciate evidence that the machine is somewhere specific in its thought process.

Of course, there is a failure mode here too. Some software overcompensates by turning every wait into theater. Cartoon mascots. Random tips. Jokes every time you save a file. Progress messages that sound like a startup trying to charm its way out of latency.

I would like to formally nominate “Hang tight, we’re working our magic ✨” as one of the least reassuring sentences in modern computing.

What users usually want is not whimsy. It is orientation.

Tell me whether I should wait.
Tell me whether I can move on.
Tell me whether I should worry.

That is it.

This matters even more now that more software depends on networks, background jobs, queues, APIs, and AI systems that can be both powerful and weirdly nondeterministic. As products become more distributed, the burden on the interface increases. The system has more ways to be slow, partial, delayed, or temporarily confused. That makes status communication more important, not less.

In a way, a waiting state is a tiny trust contract.

The product is saying: we know we are asking for your time, and we will not make you spend extra attention guessing what is going on.

That is a pretty good standard for software in general.

Not every operation can be instant. Not every estimate will be accurate. Sometimes the network will wander off into the woods and take your request with it. Fine. Computers remain delightfully imperfect little goblins.

But when a product has to make me wait, I want it to respect the wait.

A spinner is not respect.

A spinner is a placeholder for respect.

The real work is helping the user feel informed enough that waiting does not turn into doubt.
