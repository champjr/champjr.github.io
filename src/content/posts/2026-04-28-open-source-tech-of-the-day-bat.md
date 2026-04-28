---
title: "Open Source Tech of the Day: bat"
pubDate: 2026-04-28
description: "A polished cat clone that makes terminal file viewing nicer with syntax highlighting, Git context, and surprisingly good defaults."
---

Sometimes the best open-source tools are not trying to reinvent your whole workflow. They just take one crusty old command, give it a glow-up, and quietly make your day better.

That is bat.

bat is an open-source command line tool that works like `cat`, but with syntax highlighting, line numbers, Git change markers, paging, and a bunch of smart defaults that make reading files in the terminal feel dramatically less bleak. It solves a very ordinary problem, namely “I need to look at this file quickly,” and then turns that tiny moment into something genuinely pleasant.

## Quick tour

The elevator pitch is simple: `bat` shows file contents, but prettier and with more context.

That sounds small until you use it for five minutes. Then you realize it is doing a lot of helpful work for you:

- **Syntax highlighting for tons of languages**, so config files, scripts, JSON, Markdown, and source code are much easier to scan
- **Line numbers and Git diff markers**, which are great when you are reviewing edits or tracking down where something changed
- **Automatic paging**, so long files do not rocket past your eyeballs at terminal velocity
- **Works well as a drop-in upgrade** for file viewing, especially when paired with shell aliases or Git tooling

It also integrates nicely with existing terminal habits. You can use it directly on a file, pipe output into it, preview files from fuzzy finders, or hook it into tools like `git` and `man`-page workflows. It is not trying to become an entire IDE. It just makes text inspection feel first-class.

## Why it’s cool

What I like about bat is that it respects a sacred rule of good command line software: be useful immediately.

You install it, run one command, and the value is obvious. No project scaffolding. No dashboard. No twelve-step configuration pilgrimage. Just a better file viewer right away.

It is also a nice reminder that “developer experience” is not only about giant platforms. Sometimes it is about shaving friction off the small tasks you do fifty times a day. Opening logs. Checking a YAML file. Peeking at a shell script. Comparing a config before and after a tweak. bat makes all of that friendlier without getting in the way.

And yes, the name is excellent. A `cat` clone with wings is the exact right amount of nerdy.

## Who it’s for

bat is especially good for:

- developers who live in the terminal
- sysadmins and SREs reading configs, logs, and scripts all day
- Git users who want quick visual context while inspecting files
- anyone who has ever opened a dense blob of JSON and immediately regretted their choices

If you mostly work in GUI editors, bat is still handy. If you already spend real time in a shell, it feels like an instant quality-of-life upgrade.

## Getting started

The smallest first step is to install bat and run it on a file you already know.

For example, install it from your package manager, then try `bat README.md` or `bat package.json` in any project directory. That one command is enough to see the syntax highlighting, line numbers, and paging behavior in action.

If you like what you see, the next fun move is aliasing `cat` to `bat` or using bat as a previewer in your fuzzy finder setup.

## Links

- Official docs/homepage: <https://github.com/sharkdp/bat#readme>
- GitHub repo: <https://github.com/sharkdp/bat>
- Extra guide: <https://github.com/sharkdp/bat#installation>
