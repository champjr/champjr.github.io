---
title: "Open Source Tech of the Day: zoxide"
pubDate: 2026-05-06
description: "A smarter cd command that learns where you work and turns terminal navigation into a near-instant reflex."
---

Every terminal user eventually develops a tiny daily ritual: `cd` into the same five directories, typo one of them, go up a level, try again, mutter something impolite, continue. zoxide exists to end that little loop.

zoxide is an open-source "smarter cd" command. It watches which directories you use most, ranks them, and lets you jump back with short fuzzy queries instead of full paths. It is inspired by classics like `z` and `autojump`, but feels polished for modern shells and workflows.

## Quick tour

The core idea is delightfully simple. Instead of typing:

```bash
cd ~/Dev/champ-blog/src/content/posts
```

you eventually type something more like:

```bash
z posts
```

and zoxide figures out the most likely destination based on where you actually spend time.

A few standout features make it more than just a shortcut trick:

- **Learns from your habits**: frequently and recently used directories rise to the top.
- **Works across major shells**: bash, zsh, fish, PowerShell, Nushell, and friends are invited.
- **Interactive jumping with fzf**: if you want a menu instead of a best guess, `zi` gives you one.
- **Smart completion**: tab completion turns the whole thing into muscle memory surprisingly fast.

This is one of those tools that does not sound dramatic on paper, then quietly shaves friction off your day fifty times in a row.

## Why it's cool

I like zoxide because it solves a very real problem without making a big speech about it.

A lot of terminal productivity tools ask you to learn a new worldview, rewrite your config, or pledge allegiance to a framework. zoxide mostly says, "Hey, what if moving around your filesystem just got easier?" That restraint is part of the charm.

It is also a nice example of open-source ergonomics done right. The tool is fast, tiny, cross-platform, and easy to explain. You can show it to someone in thirty seconds, and the value lands immediately. No architecture diagram required. No "it really shines once you deploy the full stack" caveat. Just faster navigation.

There is also a subtle compounding effect here. Saving a few seconds on directory hopping sounds minor until you realize how often developers, sysadmins, writers, and tinkerers do exactly that. zoxide is not trying to be the star of your terminal. It is trying to make the rest of your tools easier to reach, which is honestly a cooler ambition.

## Who it's for

zoxide is a great fit for:

- developers bouncing between repos all day,
- terminal-heavy sysadmins and SREs,
- dotfiles enthusiasts who enjoy small quality-of-life wins,
- anyone who opens a shell, knows exactly where they want to go, and does not want to type the whole path like it is 1989.

If you mostly live in a file picker or GUI IDE, it may be a nice extra. If your shell is home base, it is a tiny upgrade that feels bigger than it looks.

## Getting started

Smallest first step: install it, then enable it in your shell.

On macOS or Linux with Homebrew:

```bash
brew install zoxide
```

Then add the shell init line from the docs, for example in zsh:

```bash
eval "$(zoxide init zsh)"
```

Restart your shell, move around normally for a bit, then try `z <directory-name-fragment>` to jump back somewhere you have already visited.

That is it. No migration plan. No terminal renovation montage.

## Links

- [Official homepage](https://zoxide.org/)
- [GitHub repo](https://github.com/ajeetdsouza/zoxide)
- [Getting started guide](https://github.com/ajeetdsouza/zoxide?tab=readme-ov-file#getting-started)
