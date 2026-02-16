---
title: "Open Source Tech of the Day: Zellij"
pubDate: 2026-02-16
description: "A friendly, batteries-included terminal multiplexer that makes long-running CLI work feel organized."
---

If you spend any real time in a terminal, you’ve probably had this moment: you’re SSH’d into a box, you’ve got a build running, logs streaming, a REPL open, a TODO list somewhere… and then your laptop decides it’s time for a coffee-break nap.

A **terminal multiplexer** is the antidote: it keeps sessions alive, lets you split panes, and makes the terminal feel more like a workspace.

Today’s pick: **Zellij** — an open-source terminal workspace / multiplexer that aims to be *pleasant by default*.

## Quick tour

Zellij sits between you and your shell, managing “tabs” and “panes” inside a single terminal window.

A few things you’ll notice right away:

- **It looks welcoming.** A status bar, clear hints, and a UI that doesn’t feel like it was designed as a rite of passage.
- **Splits and tabs are first-class.** Think “IDE layout,” but for CLI workflows.
- **Sessions are resilient.** Detach, close your terminal, reconnect later, and your whole layout can still be there.

If you’ve used tmux or screen, you already understand the category. Zellij’s twist is: fewer sharp edges, more “you’re probably trying to do X, so here’s a reasonable way.”

## What problem it solves

The terminal is amazing at *doing* things, but it’s historically not great at *organizing* things.

Zellij helps when you’re:

- running long tasks (builds, tests, deployments)
- tailing multiple logs at once
- juggling SSH sessions
- keeping a “dashboard” of panes (server, client, docs, git) without bouncing between windows

It’s also a subtle productivity win: fewer context switches means fewer “wait, what was I doing?” moments.

## Standout features

### 1) Sensible defaults + discoverability

Zellij ships with a UI that teaches you its controls. The status bar shows modes and key hints so you don’t need to memorize an encyclopedic key map before you’re allowed to split a pane.

The result is a multiplexer you can recommend to someone without saying, “Okay, first, print this 4-page cheat sheet.”

### 2) Layouts that feel like templates

You can define layouts for common setups (for example: editor left, server logs right, tests bottom). That’s huge if you do repeatable work — you stop rebuilding your workspace by hand every morning.

Even if you never write a custom layout file, the built-in experience nudges you toward “workspaces as reusable shapes,” which is a nice mental model.

### 3) Plugin ecosystem (optional, but fun)

Zellij supports plugins (written in Rust or WebAssembly-based approaches, depending on the plugin). This gives it room to grow into a more customizable terminal “home base” over time.

You don’t have to care about plugins on day one. But it’s comforting to know the ceiling is higher than “splits and scrollback.”

## Why it’s cool

Zellij is cool for the same reason a good text editor is cool: it makes a power-user workflow feel *less fragile*.

It’s optimistic software. It assumes you want to do real work in the terminal, and it tries to make that experience approachable rather than punishing. The terminal doesn’t need to be cosplay for 1970s minicomputers.

Also: once you get used to treating a single terminal window as a set of living workspaces, it’s hard to go back. Your laptop fan may still sound like a tiny jet, but at least your workflow will be tidy.

## Who it’s for

- **Developers** who live in CLI tools (git, test runners, build tools, REPLs)
- **SRE/DevOps folks** juggling logs, SSH, and incident “war rooms”
- **Anyone learning the terminal** who wants multiplexer benefits without starting with a boss fight

If you’re already a deep tmux wizard, Zellij might still win you over with its UX. If you’re brand new, it’s one of the least intimidating ways to get the “multiple panes + persistent sessions” superpower.

## Getting started (smallest first step)

Install Zellij and run it once.

On macOS (Homebrew):

```bash
brew install zellij
zellij
```

That’s it. You’ll drop into a session immediately.

If you want the next tiny step: open a second pane and run something long-lived in it (like `tail -f` on a log file, or a local dev server). Then detach and reattach to convince yourself you’re not imagining the persistence.

## Practical tips (so it sticks)

- **Use it as a “project shell.”** Start Zellij when you start a project. Keep that session around for days.
- **Name sessions.** When you have multiple projects, names beat “session-12” every time.
- **Keep one pane for notes.** A markdown file, `todo.txt`, or even a scratch buffer in `nano`—anything that stops your brain from holding state.

## Links

- Official docs/home: https://zellij.dev/
- GitHub repo: https://github.com/zellij-org/zellij
- Extra: "Introduction" docs page: https://zellij.dev/documentation/
