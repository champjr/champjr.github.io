---
title: "Open Source Tech of the Day: lnav"
pubDate: 2026-06-02
description: "A wonderfully nerdy log viewer that turns messy terminal logs into something you can actually explore."
---

Logs are where truth goes to hide in plain sight.

When something breaks, most of us do some combination of `tail`, `grep`, squinting, and mild bargaining. lnav, short for Logfile Navigator, is an open-source terminal app built to make that whole experience much less chaotic.

It is a log viewer for the command line, but that undersells it a bit. lnav can ingest multiple log files at once, detect formats automatically, merge entries by timestamp, follow files as they grow, and give you a much richer interface for searching and understanding what is actually happening. It feels a little like someone taught `less`, `tail -f`, and a debugging dashboard to cooperate for once.

## Quick tour

The basic idea is simple: point lnav at one or more log files or directories, and it starts doing the helpful stuff automatically.

A few standout tricks:

- It understands many common log formats without extra setup.
- It merges multiple files into one chronological view, which is fantastic when one incident sprawls across app logs, proxy logs, and system logs.
- It can open compressed logs too, which saves you from the classic "hang on, let me unzip this ancient mystery first" detour.
- It has built-in filtering, highlighting, and navigation for warnings and errors.
- It lets you query logs with SQLite, which is delightfully overpowered in the best way.

That last feature is especially fun. If you are trying to answer questions like "which endpoint is failing most often?" or "what status codes spiked in the last hour?", being able to treat logs like queryable data instead of pure text is a huge upgrade.

lnav also does a nice job with structured logs. JSON logs, which are often technically useful and emotionally annoying, become much easier to pretty-print and inspect. That alone can lower the ambient drama level of debugging.

## Why it's cool

A lot of tools help you collect logs. lnav helps you think with them.

That is the part I like most. It does not try to become a giant centralized observability platform. There is no server to stand up, no account to create, and no pipeline to wire together before you can get value. You run it locally, point it at files, and start investigating.

It also respects terminal people. If your instinct during an outage is to SSH into a box and start poking around, lnav feels like a very natural upgrade path instead of a totally different workflow. You keep the speed and directness of the CLI, but you get better visibility, better navigation, and fewer "wait, which file was I in?" moments.

And honestly, tools that reduce friction during debugging are disproportionately valuable. A tiny improvement in how fast you can spot patterns or correlate events pays off quickly when you are tired, under pressure, or ankle-deep in stack traces.

## Who it's for

lnav is a great fit for:

- developers debugging local apps or services
- SRE and ops folks spelunking through production-ish logs
- homelab tinkerers who would like their diagnostics to feel a bit less feral
- anyone who lives in a terminal and wants better log ergonomics without adopting a whole platform

If your current log workflow is "open three terminals and hope vibes carry me through," this is worth a look.

## Getting started

The smallest possible first step is to install it and point it at one real log file.

On macOS:

```bash
brew install lnav
lnav /var/log/system.log
```

On Linux, grab a package or release build, then open a log file or directory the same way. Once lnav starts, try searching with `/`, jump between errors with `e` and `E`, and explore from there. You do not need a whole observability migration. One file is enough to get the idea.

## Links

- Official homepage and docs: https://lnav.org/
- GitHub repo: https://github.com/tstack/lnav
- Extra: https://docs.lnav.org/en/latest/
