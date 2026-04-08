---
title: "Open Source Tech of the Day: Yazi"
pubDate: 2026-04-08
description: "A blazing-fast terminal file manager that makes moving around your filesystem feel delightfully modern."
---

If your file manager life is currently a mix of `cd`, `ls`, vague tab completion, and occasional emotional support from `find`, Yazi might be your new favorite sidekick.

Yazi is an open-source terminal file manager written in Rust, and its whole deal is speed. It’s designed to make navigating files, previewing content, jumping around large directories, and doing common file operations feel quick and fluid instead of clunky and keyboard-taxing. Think “terminal file manager,” but with modern polish rather than retro punishment.

## Quick tour

At first glance, Yazi looks like a clean, keyboard-friendly browser for your filesystem. You move through directories, preview files on the fly, and perform everyday tasks without constantly bouncing back to raw shell commands.

The thing that makes it stand out is that it doesn’t just feel like a thin wrapper around `ls`. It feels responsive in a way that makes large folders and repeated navigation less annoying. Previews are fast, bulk operations are built in, and it plays nicely with the kind of workflows terminal-heavy people actually have.

A few standout features:

- **Fast async architecture** so moving through big directories feels snappy
- **File previews** for many file types, which means less “open it and see” guesswork
- **Bulk rename and selection tools** for cleaning up groups of files without ceremony
- **Plugin, theme, and config support** if you want to make it yours
- **Shell integration** so it can hand your current directory back to the shell when you exit

That last one is sneakily important. A lot of terminal file managers are fun right up until they dump you back where you started. Yazi makes it much easier to use it as part of your real shell workflow instead of as a weird side quest.

## Why it’s cool

Yazi sits in a sweet spot between old-school terminal power and modern ergonomics. It respects the keyboard, starts fast, and doesn’t feel bloated, but it also doesn’t act like usability is a character flaw.

It’s especially nice if you spend a lot of time doing small file tasks that don’t deserve a full GUI window: finding a config file, hopping across project folders, sorting downloads, skimming logs, or cleaning up screenshots before your desktop starts looking like a digital junk drawer.

There’s also a broader trend here that Yazi fits beautifully: terminal tools are getting better-looking, friendlier, and more composable without losing their hacker DNA. Yazi feels like part of that new generation. It has taste.

## Who it’s for

Yazi is a great fit for:

- **Developers** who live in the terminal and want less filesystem friction
- **Sysadmins and power users** managing lots of directories, logs, and configs
- **Keyboard-first folks** who like fast workflows and minimal mouse mileage
- **Curious tinkerers** who want a more modern alternative to older terminal file managers

If you only ever manage files in Finder, Explorer, or a browser upload dialog, Yazi may be overkill. But if your terminal is already home base, it makes a lot of sense very quickly.

## Getting started

The smallest possible first step is: **install it and run `yazi`**.

For example, on macOS with Homebrew:

```bash
brew install yazi ffmpeg sevenzip jq poppler fd ripgrep fzf zoxide imagemagick
```

Then launch it:

```bash
yazi
```

You don’t need to memorize the whole feature set on day one. Just use it to browse a project directory, preview a few files, and move around with the keyboard. If it clicks, add the shell integration next so Yazi can return you to the directory you ended in.

## Links

- Official homepage/docs: <https://yazi-rs.github.io/>
- GitHub repo: <https://github.com/sxyazi/yazi>
- Quick start guide: <https://yazi-rs.github.io/docs/quick-start/>
