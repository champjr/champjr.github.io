---
title: "Open Source Tech of the Day: chezmoi"
pubDate: 2026-04-12
description: "A delightfully practical open-source tool for managing dotfiles across multiple machines without turning your home directory into a trust exercise."
---

There is a special kind of computer chaos where your shell config is great on one machine, mostly fine on another, and mysteriously haunted on a third. **chezmoi** exists for that exact problem.

chezmoi is an open-source tool for managing **dotfiles and personal machine config** across multiple computers. It gives you a clean way to track things like your shell setup, Git config, editor preferences, and small scripts, while handling the fact that not every machine is identical. If you’ve ever copied `.zshrc` around like a nervous camp counselor, this is a much better system.

## Quick tour

The basic pitch is simple: chezmoi treats your dotfiles like something worth managing on purpose.

Instead of directly editing random files in your home directory and hoping future-you remembers what happened, you keep a source state in chezmoi, usually backed by Git. Then chezmoi applies that state to the current machine.

A few standout features make it especially nice:

- **Machine-aware templates** so your config can adapt to macOS, Linux, work laptops, or home servers.
- **Safe previews and diffs** so you can see what will change before you let it touch anything.
- **Good secret handling options** with support for tools like 1Password, Bitwarden, age, and more.
- **Single-command bootstrap** for setting up a fresh machine without a weekend-long copy-paste ritual.
- **Works with plain files** instead of inventing a weird proprietary universe around your config.

That last point matters. chezmoi feels powerful, but it still respects the fact that your dotfiles are just files. No cult initiation required.

## Why it’s cool

chezmoi solves a boring problem that quietly eats a lot of time.

A lot of developers, tinkerers, and terminal gremlins gradually build a nice environment, then lose little pieces of it every time they switch machines. One laptop has the good prompt. Another has the useful aliases. A server somewhere has the one config tweak you forgot to document and now deeply need.

chezmoi turns that mess into an actual workflow. You can version your setup, bootstrap a new machine quickly, and keep platform-specific differences without maintaining three almost-identical config folders like a person trying to juggle knives politely.

It is also one of those tools that tends to age well. The more machines you touch, the more valuable it gets.

## Who it’s for

chezmoi is a great fit for:

- **Developers** with multiple laptops, desktops, or servers
- **People who care about shell/editor ergonomics** and want them consistent everywhere
- **Homelab and self-hosting folks** who rebuild machines often
- **Consultants or platform engineers** hopping between environments
- **Anyone starting to take dotfiles seriously** without wanting an overengineered setup

If you only ever use one machine and never customize anything, chezmoi may be more tool than you need. But if your config already feels like a tiny portable operating philosophy, it is very much in its lane.

## Getting started

The smallest possible first step is to install chezmoi and let it create a managed source state for your current machine.

On macOS with Homebrew:

```bash
brew install chezmoi
chezmoi init
chezmoi add ~/.zshrc
chezmoi diff
```

That gives you a first managed file and shows what chezmoi wants to track. From there, you can commit the source directory to Git and gradually add the rest of your setup.

If you already have a dotfiles repo, the classic next move is even smaller on a fresh machine:

```bash
chezmoi init --apply https://github.com/yourname/dotfiles.git
```

That is a pretty satisfying amount of leverage for one command.

## Links

- Official homepage/docs: <https://www.chezmoi.io/>
- GitHub repo: <https://github.com/twpayne/chezmoi>
- Extra reading: Quick start guide: <https://www.chezmoi.io/quick-start/>
