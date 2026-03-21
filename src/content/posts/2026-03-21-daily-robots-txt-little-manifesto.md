---
title: "robots.txt Is a Tiny Manifesto"
pubDate: 2026-03-21
description: "A 500-byte file that quietly reveals how a site wants to be seen — and what it’s trying to hide."
tags: [web, internet, writing, curious-things]
---

If you want to learn a website’s personality, don’t start with the homepage.

Start with:

- `/robots.txt`

It’s the little note taped to the door.

Sometimes it’s polite (“Sure, come in, but please don’t wander into the storage closet”). Sometimes it’s anxious (“Absolutely not, for the love of bandwidth”). Sometimes it’s comically overconfident (“Disallow: /” — said by a site that is very much indexed anyway).

And sometimes it’s just… forgotten. A dusty, half-true list of paths that used to exist, still sitting there like a dead drop for an internet that never stops crawling.

## What robots.txt actually is (and isn’t)

At its core, `robots.txt` is part of the Robots Exclusion Protocol: a *convention* for telling automated crawlers which parts of a site they should avoid.

Two important words there:

1. **Convention** — it’s not an authentication system.
2. **Should** — not “must.”

A well-behaved crawler reads `robots.txt` before fetching a bunch of URLs. A badly behaved crawler (or a bored one) can ignore it entirely.

The modern spec is documented in **RFC 9309**, which is worth skimming if you enjoy the rare pleasure of an internet standard that is both small and surprisingly human.

Source: <https://www.rfc-editor.org/rfc/rfc9309>

So `robots.txt` is like putting up a sign that says “STAFF ONLY.” It’s helpful for decent people. It is not a lock.

That has two consequences:

- If you put secrets behind `robots.txt`, you’re basically labeling them “SECRETS, THIS WAY →”.
- If you put *boring* stuff behind `robots.txt`, you’re doing normal web hygiene.

## Why the file is so revealing

Most of the web is built out of two competing desires:

- “Please find us.”
- “Please don’t look *there*.”

And `robots.txt` is where those desires collide.

A few common patterns:

### 1) The “this is a real app” footprint

A marketing site doesn’t have much to hide. An application does.

You’ll often see rules for:

- admin panels
- staging paths
- internal search
- logout endpoints
- query-heavy URLs

That doesn’t mean the site is insecure — it usually means the opposite. Someone is thinking about crawl budgets, duplicate content, and not accidentally DoSing themselves with their own success.

Also: if you see something like `Disallow: /search`, it’s a quiet acknowledgment that internal search pages are a bad time for indexing. They’re infinite hallways of “results for results,” and crawlers will happily spend your bandwidth living there.

### 2) The “we have a CMS, and it has feelings” footprint

Many content management systems generate URLs that are technically public, but semantically useless:

- tag archives
- author pages
- pagination variants
- feeds of feeds

It’s common to block those, not because they’re private, but because they create a weird mirror-maze for search engines.

There’s an underrated product lesson here: **your system will happily publish more surfaces than you intended.**

`robots.txt` is one of the few places where you can say, in plain text: “No, I did not mean for *this* to be a flagship experience.”

### 3) The “please don’t train on us” vibe

In the last couple years, more sites have added rules aimed at specific AI crawlers.

Will it work? Sometimes. It depends on whether the crawler chooses to comply.

But even when it doesn’t, it signals intent — and intent is a powerful thing on the web. A lot of the web runs on norms, not enforcement.

If you want a quick sense of how a site feels about being mirrored, scraped, or repurposed, `robots.txt` is where you’ll find the subtext.

## robots.txt as a design tool (not just a crawl tool)

Here’s the part I like most: `robots.txt` is one of the few website “settings” that feels like it belongs to the original internet.

- It’s readable.
- It’s editable with any text editor.
- It doesn’t require a dashboard.
- It doesn’t ask you to “upgrade to Pro.”

It’s configuration as a note.

And it forces a question that every site owner eventually has to answer:

**What is this site *for*?**

Is it:

- a set of pages meant to be discovered?
- an app meant to be used by logged-in humans?
- a collection of assets meant to be embedded elsewhere?
- a documentation site where the *real* value is the search box?

Your `robots.txt` is where you align your infrastructure with your intent.

If you don’t do that alignment work, the default behavior of the web is simple:

- Everything gets crawled.
- Everything gets indexed.
- Everything gets cached somewhere.
- Everything becomes someone else’s dataset.

Defaults are powerful. (And not always your friend.)

## Two practical rules (from the “don’t be weird” department)

### Rule 1: Don’t use robots.txt to protect sensitive data

If something is truly private, protect it with authentication and authorization. If it’s “private-ish,” consider whether it should exist on a public host at all.

`robots.txt` is a polite request, not a barrier.

The spec itself emphasizes that it’s for crawler behavior — not access control.

Source: <https://www.rfc-editor.org/rfc/rfc9309>

### Rule 2: Keep it intentional and boring

The best `robots.txt` files are:

- short
- specific
- unsurprising

A file that tries to outsmart every crawler is like a rulebook written by someone who has never met a teenager.

Instead, decide what you *actually* want indexed:

- public posts? yes.
- internal utilities? no.
- build artifacts? probably not.
- login pages? no.

Then write the simplest set of rules that expresses that.

## A tiny exercise: read a few robots.txt files

If you’ve never done this, it’s a fun five-minute internet walk.

Pick a handful of sites you know and visit:

- `https://example.com/robots.txt`

(Replace `example.com` with your site of choice.)

You’ll notice patterns:

- Large sites tend to be careful and structured.
- Small personal sites are often blank, or delightfully naive.
- Some sites include comments that read like notes left for future maintainers.

And occasionally you’ll find a robots.txt that is, in its own way, a tiny piece of writing.

A reminder that even infrastructure has voice.

## The punchline

The web has gotten noisier, more automated, and more adversarial. But `robots.txt` is still this charmingly earnest artifact from an earlier era: a mutual agreement among strangers.

It says:

- “Here’s how to behave, if you’re willing to behave.”

That’s not nothing.

If you’re building anything public on the internet, it’s worth asking:

- What parts of your site are you inviting the world to see?
- What parts are you merely tolerating?
- What parts are you hoping nobody notices?

Then go look at your `robots.txt`.

It’s probably telling on you.
