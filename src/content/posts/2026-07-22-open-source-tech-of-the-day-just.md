---
title: "Open Source Tech of the Day: just"
pubDate: 2026-07-22
description: "A delightfully simple command runner that makes repetitive terminal tasks feel civilized."
---

If your shell history is full of “what was that command again?” moments, [just](https://just.systems/) is here to clean up the mess.

`just` is a command runner, kind of like `make` after a long nap and a strong coffee. You put repeatable commands in a `justfile`, give them friendly names, and run them with `just <recipe>`. That means fewer pasted command blobs in READMEs, fewer tribal-knowledge setup steps, and way less “hang on, let me find the right incantation.”

The core idea is refreshingly small: define recipes once, then run them anywhere you have the repo. But `just` also has enough polish to be genuinely useful for solo projects, teams, dotfiles, and automation glue.

## Quick tour

A `justfile` can hold recipes like:

```make
serve:
  python3 -m http.server 8000

test:
  pytest

fmt:
  ruff format .
```

Now instead of remembering exact commands, you can just run:

```bash
just serve
just test
just fmt
```

That might sound tiny, and it is, but tiny tools with sharp edges tend to earn permanent spots in the toolbox.

A few standout features make `just` more than a glorified alias file:

- **Readable task definitions**. Recipes look clean and stay easy to scan.
- **Parameters and defaults**. You can pass arguments into recipes without turning everything into a shell script.
- **Cross-platform friendliness**. It works well on macOS, Linux, and Windows, which matters if your team is not all living in the same terminal universe.
- **Nice ergonomics**. `just --list` shows available recipes, which is perfect for repos that need a self-documenting command menu.

## Why it’s cool

I like tools that lower the cost of doing things the tidy way, and `just` absolutely does that.

A lot of projects have a bunch of “standard” commands: install dependencies, run tests, format code, start dev servers, reset local data, deploy previews, and so on. Without a tool like `just`, those commands drift into Slack messages, stale docs, shell history, and one teammate’s suspiciously powerful memory.

With `just`, the canonical way to do those things lives in the repo. It becomes easier for new contributors to get moving, easier for future-you to pick a project back up, and easier to avoid the classic “works on my machine” ritual dance.

It also hits a sweet spot between shell aliases and heavier automation systems. If `Makefile` feels a bit crusty for your use case, but a full task runner framework feels like bringing a fog machine to a dentist appointment, `just` is a great middle path.

## Who it’s for

`just` is especially good for:

- Developers who repeat the same terminal commands every day
- Teams that want a simple, discoverable command interface in each repo
- Open source maintainers who want setup and maintenance tasks to be obvious
- Tinkerers with homelab, scripts, dotfiles, or personal projects

If you spend meaningful time in a terminal and occasionally mutter “there has to be a cleaner way,” this is probably for you.

## Getting started

Smallest first step: install `just`, then create a `justfile` with one useful recipe.

For example:

```make
hello:
  echo "hello from just"
```

Then run:

```bash
just hello
```

That’s enough to get the idea. After that, move one repetitive command from your notes, README, or shell history into the file. One is all it takes to see the value.

## Links

- [Official homepage and docs](https://just.systems/)
- [GitHub repo](https://github.com/casey/just)
- [Recipe documentation](https://just.systems/man/en/recipes.html)
