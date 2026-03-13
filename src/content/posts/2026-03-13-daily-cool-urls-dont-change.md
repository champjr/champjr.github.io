---
title: "Cool URLs, Boring Slugs, and the Art of Not Renaming Things"
pubDate: 2026-03-13
description: "A small argument for treating links as promises—and designing your site like you’ll still care in five years."
tags: [web, blogging, writing, durability, product]
---

I have a petty personal dislike of broken links.

Not in the dramatic “this is why civilization is collapsing” way. More like the “I opened three tabs for a deep dive and now two of them are 404s, so I’m making tea and staring out the window” way.

Broken links aren’t just annoying; they’re a tiny breach of trust.

When a page disappears, it’s not only my time that gets wasted. It’s also the *context chain* that gets severed: discussions lose their references, old docs lose their evidence, and any future reader loses the path that taught past-you something important.

So here’s a small, opinionated idea I keep coming back to:

**A URL is a promise.**

And once you start treating it that way, a bunch of design choices get easier.

## Links are social infrastructure

You can build a website that works perfectly as a set of pages you personally browse.

But the moment you add the possibility that someone else might link to it—an email, a chat, a blog post, a bookmark, a paper, a GitHub issue—you’ve built something more like public infrastructure.

Which means “works today” isn’t the bar.

The bar is:

- **Will this still work after I redesign the site?**
- **Will this still work after I switch static site generators?**
- **Will this still work after I reorganize categories?**
- **Will this still work after I realize my old titles were cringe?**

(That last one comes for all of us.)

There’s an old W3C page that people cite in exactly this context, and it’s old for a reason: it keeps being true.

“Cool URIs don’t change.”

Source: <https://www.w3.org/Provider/Style/URI>

## Renaming is easy; redirect discipline is hard

In software, renaming a thing is a rite of passage.

It’s also a great way to break everyone else’s code.

URLs have the same vibe, except your “API consumers” include future-you and strangers you’ll never meet.

You can absolutely redesign your URL structure. You can absolutely change your titles. You can absolutely move posts into different folders, switch from `/blog/` to `/posts/`, or turn your site into a single-page app with a background gradient that screams “I bought a course.”

Just don’t pretend that renaming is free.

The cost is paid by anyone who arrives through the old link.

So the responsible pattern is:

- **Pick a URL shape you can live with.**
- **Stick to it.**
- **If you must change it, redirect forever.**

“Forever” sounds dramatic until you remember that the whole point of publishing is that it outlives the moment you wrote it.

## The secret weapon is the boring slug

A lot of people think the slug needs to be clever.

It doesn’t.

In fact, clever slugs age badly, because your cleverness is often tied to a trend, a reference, or a mood you won’t share later.

What holds up is boring:

- Put the date first if your site is chronologically organized.
- Use a few stable keywords.
- Avoid punctuation that will inevitably become an encoding problem.

If your title is “The Year I Learned to Stop Worrying and Love the Terminal” (which I’d click, to be clear), your slug does *not* need to be:

`/posts/the-year-i-learned-to-stop-worrying-and-love-the-terminal/`

It can be:

`/posts/2026-03-13-terminal-love/`

or even:

`/posts/2026-03-13-daily-cool-urls-dont-change/`

Boring slugs are easier to keep stable because they’re less emotionally attached to the exact phrasing of the headline.

They’re also easier to type.

And yes, that matters. If something can’t be typed, it can’t be shared in the most primal form of the internet: “hey, go to this thing.”

## Titles can change; URLs shouldn’t have to

This is where I get a little product-y.

A title is marketing.

Not “marketing” as in deceptive, but marketing as in: the interface between your idea and someone else’s attention.

It’s normal to improve titles over time:

- you learn what the post is actually about
- you realize the title is too cute and not searchable
- you want to be clearer for future readers

But if your URL is derived from the title, then every title edit becomes a breaking change.

So I like a decoupling strategy:

- **Stable slug** that’s mostly semantic but not fragile
- **Editable title** that you’re allowed to refine

This is basically the same principle as stable identifiers in software: keep the ID boring, let the display name be pretty.

## A tiny checklist for “link permanence”

If you run a small site (especially a GitHub Pages style setup), you don’t need enterprise tooling. You just need a couple of habits.

Here’s my lightweight set:

1) **Decide your canonical URL format early.**
   If you’re going to do `/posts/<slug>/`, commit to it.

2) **Never ship a redesign without a redirect plan.**
   If you can’t do redirects, *don’t change the URL structure*. Cosmetic redesigns are cheaper than broken permalinks.

3) **Avoid moving old posts “for organization.”**
   Organization is a present-you itch that future readers shouldn’t have to scratch.

4) **If you must move things, leave a breadcrumb.**
   Even a simple “This post moved to …” page is better than nothing.

5) **Treat links like citations.**
   If you cite something, archive it (where appropriate) or quote the key line with a source link so the reader doesn’t lose the context if the external page disappears.

That last one is a whole separate rabbit hole (hello, link rot), but the key idea is: the more you care about your words being useful later, the more you’ll care about the survival of the references.

## The punchline

The internet isn’t a library. It’s more like a city.

Stuff gets demolished. Streets get renamed. Landmarks disappear. New construction happens every day.

But the best cities keep the old roads readable. They preserve signposts. They acknowledge that people built maps.

So when I’m working on a site—or even a little repo of notes—I try to choose a URL scheme I won’t hate later, then I do the boring thing:

**I don’t rename it.**

And if I do, I leave a trail.
