---
title: "Open Source Tech of the Day: eza"
pubDate: 2026-05-19
description: "A fast, colorful, modern replacement for ls that makes the terminal feel a lot more alive."
---

If you spend any time in a terminal, you already know `ls`. It is dependable, ancient, and about as emotionally expressive as a filing cabinet. eza is the open-source glow-up: a modern replacement for `ls` that keeps the core job simple, but makes everyday file browsing dramatically nicer.

At a glance, eza gives you better defaults, cleaner colors, optional icons, Git-aware output, tree views, smarter metadata, and a generally more readable picture of what is actually in a directory. It is one of those tools that can feel cosmetic at first, right up until you use it for a day and then immediately miss it on every machine that does not have it.

## Quick tour

The pitch is refreshingly direct: eza lists files, but with more context and less squinting.

A plain run already looks sharper than classic `ls`, but the fun starts when you add a couple of flags:

```bash
eza -l --icons --git
```

That gives you a long view with file metadata, icons, and Git status hints. Suddenly a project directory stops being a blur of filenames and starts reading more like a dashboard.

A few standout tricks:

- **Tree view** for exploring nested folders without reaching for another tool
- **Git status integration** so changed or ignored files are easier to spot
- **Better date and size display** for quicker “what changed?” moments
- **Hyperlink support** in terminals that support it, which is delightfully nerdy
- **Theme customization** if you want your terminal to look just a little extra nice

It is also a maintained continuation of the idea behind `exa`, with bug fixes, security fixes, and ongoing improvements from the community.

## Why it’s cool

A lot of developer tools sell themselves on complexity. eza is cool because it improves a tiny, boring command you use constantly.

That matters more than it sounds.

When a tool sits in your muscle memory, even small upgrades compound. Better visibility into symlinks, hidden files, Git state, and directory structure can shave off friction dozens of times per day. It will not change your life in one dramatic moment. It just keeps handing you tiny quality-of-life wins until you realize your shell got better.

Also, it respects the command line’s golden rule: do one job, but do it beautifully.

## Who it’s for

eza is a great fit for:

- **Developers** hopping through repos all day
- **Linux and macOS tinkerers** who enjoy polishing their shell setup
- **New terminal users** who want friendlier output right away
- **Anyone replacing a pile of aliases** with one smarter binary

If you are happy with stock `ls`, that is fine. If you have ever typed `ls -lah` out of habit and thought, “there has to be a nicer version of this by now,” eza is the answer.

## Getting started

The smallest possible first step is just to run it once.

If you use Homebrew:

```bash
brew install eza
```

Then try:

```bash
eza -l --icons
```

That is enough to see the appeal immediately. If you like it, the next obvious move is an alias like `alias ls='eza'` or `alias ll='eza -l --icons --git'`.

## Links

- Official site: <https://eza.rocks/>
- GitHub repo: <https://github.com/eza-community/eza>
- Nice walkthrough: <https://betterstack.com/community/guides/linux/eza-explained/>
