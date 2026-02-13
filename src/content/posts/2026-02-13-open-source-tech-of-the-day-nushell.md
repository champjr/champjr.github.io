---
title: "Open Source Tech of the Day: Nushell"
pubDate: 2026-02-13
description: "A modern shell where pipelines pass structured tables instead of brittle strings."
---

If you’ve ever written a heroic one-liner that worked *perfectly*… until one filename had a space in it, a header changed, or the output format drifted just enough to ruin your day — today’s project is for you.

## Quick tour

**[Nushell](https://www.nushell.sh/)** (often just “Nu”) is a cross-platform, open-source shell that treats command output as **structured data** by default.

In classic shells, pipelines are streams of text. That’s powerful, but it also means you spend a lot of time doing “string archaeology” (grep/sed/awk incantations) to extract the thing you actually wanted.

In Nushell, common commands return **tables** (rows + columns). So instead of parsing, you *query*:

- `ls` gives you a table with columns like `name`, `type`, `size`, `modified`
- `ps` gives you process info as structured rows
- `open` can read formats like JSON/YAML/CSV and turn them into data you can filter and transform

The vibe is: **shell + data wrangling** had a very competent kid.

## Why it’s cool

### 1) Pipelines that don’t collapse when output changes
Because data stays typed and columnar, you can do things like:

- Filter by a real column (`where size > 10mb`) instead of guessing at character positions
- Sort by a real date field instead of whatever the locale decided today

It’s the difference between “parse this text” and “operate on this dataset.”

### 2) Great ergonomics for real work
Nu isn’t just a data toy; it’s built for daily driving:

- Helpful error messages (often pointing at *exactly* what went wrong)
- Strong tab completion and introspection
- Solid cross-platform behavior (Linux/macOS/Windows)

### 3) It plays nicely with your existing tools
Nushell doesn’t demand you abandon the CLI ecosystem you already use. You can still call `git`, `rg`, `fd`, `curl`, etc. And when something emits JSON (hello, `curl` APIs), Nu can ingest it and let you operate on it without glue scripts.

## Who it’s for

- **Shell power users** who are tired of brittle parsing and want pipelines that are more “dataframe” than “mystery meat.”
- **Developers and SREs** who frequently inspect JSON, logs, and system state, and want repeatable commands.
- **Data-adjacent folks** (analytics, automation, “I live in CSVs”) who want quick transformations without reaching for a full Python notebook.

If you love the philosophy of pipes but wish you could stop memorizing seven different ways to trim whitespace, Nu will feel refreshing.

## Standout features (the “oh nice” list)

- **Structured tables everywhere**: many built-ins return consistent columns you can `select`, `where`, `sort-by`, `group-by`, etc.
- **Built-in support for common data formats**: JSON, YAML, CSV, TOML, and more via `open` and friends.
- **Discoverability**: Nu has a “show me the shape of this data” feel — great when you’re exploring.

## Getting started (smallest first step)

Install Nushell, then launch it.

On macOS (Homebrew):

```sh
brew install nushell
nu
```

On Windows (winget):

```powershell
winget install nushell
nu
```

Then try a tiny “structured pipeline” taste test:

```nu
ls | sort-by size | last 10
```

That’s it. You’re now doing “shell stuff,” but with a table you can sort and slice like a sane person.

## A quick practical example

Say you want to find the largest files in a directory tree. In many shells, you end up stitching together `find` + `du` + `sort` + `head` and hoping you don’t trip over weird filenames.

In Nu, you can keep the intent readable. One approachable pattern is:

```nu
ls **/* | where type == file | sort-by size | last 20
```

Even if you don’t memorize the exact glob syntax on day one, the key idea is that you’re working with **file objects** (with `type` and `size`) rather than raw strings.

## Links

- Official homepage/docs: https://www.nushell.sh/book/
- GitHub repo: https://github.com/nushell/nushell
- Extra (examples + recipes): https://www.nushell.sh/cookbook/
