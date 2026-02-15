---
title: "Open Source Tech of the Day: Nushell"
pubDate: 2026-02-15
description: "A modern shell that treats data as tables—so you stop regex-wrestling and start piping real structure."
---

If you’ve ever written a heroic one-liner like:

```sh
ps aux | grep thing | awk '{print $2}' | xargs kill
```

…and then immediately regretted it (because spacing, headers, locale, or “what if the process name contains…?”), today’s open-source pick is for you.

## Quick tour

**Nushell (“Nu”)** is a cross-platform shell that makes a bold move: instead of treating everything as strings, it treats most command output as **structured data** (think tables, records, lists). You still type commands at a prompt, you still build pipelines—but your pipelines pass *data*, not text blobs.

That means you can do operations like filter, sort, select columns, and transform values without reaching for `grep`/`sed`/`awk` as often.

A taste of what “structured pipelines” feels like:

```nu
ls | sort-by size | last 10
```

Want only big files?

```nu
ls | where size > 100mb
```

Need JSON from an API and want one field?

```nu
http get https://api.github.com/repos/nushell/nushell | get stargazers_count
```

(And yes: Nu can still call external commands, so you’re not stuck in a walled garden.)

## Why it’s cool

A few standout ideas that make Nu more than “yet another shell”:

1) **No more “parse the column spacing” games**

Traditional shells are incredible, but they often force you into brittle text parsing. Nu leans into typed values—numbers are numbers, dates are dates, file sizes are file sizes—so comparisons and formatting are less fragile.

2) **Built-in support for common data formats**

Nu understands things like JSON, YAML, CSV/TSV, and more. That’s a big deal if your day involves config files, logs, API payloads, or “please extract one value from this blob.”

3) **It plays nicely with the rest of your toolbox**

Nu isn’t trying to erase the Unix ecosystem. You can run `git`, `docker`, `kubectl`, `rg`, etc. Nu’s superpower is what happens *between* those commands—where data tends to get messy.

4) **Cross-platform consistency**

Nu runs on macOS, Linux, and Windows. If you bounce between machines, that “learn once, use anywhere” factor is real.

## Who it’s for

- **Developers and SREs** who live in terminals and are tired of pipelines breaking on edge cases.
- **Data-curious folks** who want lightweight data wrangling without spinning up a full notebook.
- **Windows users** who want something modern and ergonomic that still feels like a shell.
- **Shell tinkerers** who enjoy a new mental model (and a nicer way to handle structured output).

If you *love* classic POSIX shell minimalism and only ever pipe plain text, Nu might feel “too fancy.” But if you frequently find yourself doing “extract, filter, join, transform,” Nu can be a breath of fresh air.

## Getting started (smallest possible first step)

Install Nushell, open it, and run `ls`.

On macOS with Homebrew:

```sh
brew install nushell
nu
```

That’s it. Once you’re in Nu, try:

```nu
ls | where type == 'file' | sort-by size | last 5
```

You’ll get a neat table of your five largest files in the current directory—without counting columns or slicing strings.

### One practical “aha” to try

If you have a JSON file and you want to peek inside, Nu makes it pleasantly direct:

```nu
open data.json | to yaml
```

Or grab just a nested value:

```nu
open data.json | get user.profile.name
```

It’s the kind of thing that turns “ugh, I guess I’ll write a script” into “oh, that was two commands.”

## Links

- Official homepage / docs: https://www.nushell.sh/
- GitHub repo: https://github.com/nushell/nushell
- Extra: Nushell Book (Quick Tour): https://www.nushell.sh/book/quick_tour.html
