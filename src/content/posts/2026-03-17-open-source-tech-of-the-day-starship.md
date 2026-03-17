---
title: "Open Source Tech of the Day: Starship"
pubDate: 2026-03-17
description: "A fast, cross-shell prompt that gives you just enough context—right when you need it."
---

If your terminal prompt is either **(a)** a sad little `$` with no context, or **(b)** a 3-line ASCII art novel that redraws itself every time you blink… today’s pick is for you.

**Starship** is an open-source, *cross-shell* prompt that adds smart, minimal context to your command line: git status, language/runtime versions, k8s context, battery, time, cloud profile indicators, and more—without turning your prompt into a dashboard you have to scroll past.

## Quick tour

Starship’s core idea is simple: your prompt should answer “what environment am I in?” at a glance.

A typical Starship prompt might show:

- **Current directory** (with nice truncation so long paths don’t eat the whole line)
- **Git info**: branch, dirty/clean status, ahead/behind, stashes
- **Language/runtime context** when relevant: Node, Python, Rust, Go, Java, etc.
- **Container / orchestration hints**: Docker context, Kubernetes context/namespace
- **Cloud + credentials context** (optional): helpful when “oops wrong account” is expensive

The clever bit: most modules only appear when they matter. Enter a Node project → you’ll see Node. Leave it → it disappears.

## Why it’s cool

1) **It works everywhere (well, almost everywhere)**

Starship supports a long list of shells (zsh, bash, fish, PowerShell, and more). If you bounce between machines or teams, you can keep the same prompt “language” and muscle memory.

2) **Fast by design**

Prompts can get sluggish when they run a pile of scripts on every keystroke. Starship is written in Rust and built to be snappy. You still *can* configure it to do a ton—but the default experience is speed-first.

3) **You can go from “default” to “yours” in one file**

Configuration lives in a single `starship.toml`. You can start with a tiny change (like turning off a module that annoys you) and iterate from there.

4) **It’s a safety rail for context switching**

This is the underrated part: Starship can help you avoid “wrong folder / wrong repo / wrong cluster” mistakes. Seeing the current git branch or k8s context in your face is a gentle, constant reminder.

Not paranoid. Just… pleasantly aware.

## Who it’s for

- **CLI-first developers** who live in git repos all day
- **Polyglot folks** who jump between Node/Python/Go/Rust projects and want the prompt to keep up
- **SRE / DevOps / platform engineers** who want strong environment cues (docker/k8s/cloud) without a whole terminal theme overhaul
- **Anyone who wants their prompt to be helpful, not performative**

If you *love* hand-rolling shell prompt functions (respect), Starship might still be interesting as a reference implementation. But it’s especially great if you’d rather spend that energy shipping the thing you opened the terminal for.

## Getting started (smallest first step)

Pick the easiest install method for your system, then add one line to your shell config.

### 1) Install

On macOS with Homebrew:

```sh
brew install starship
```

Or use the official install script (works across platforms):

```sh
curl -sS https://starship.rs/install.sh | sh
```

### 2) Enable it in your shell

For **zsh**, add this to `~/.zshrc`:

```sh
eval "$(starship init zsh)"
```

Then restart your terminal.

### 3) (Optional) Make one tiny tweak

Create `~/.config/starship.toml` and disable a module you don’t care about. Example:

```toml
[package]
disabled = true
```

That’s it—you’re now “customizing” your prompt without adopting a new lifestyle.

## Standout features worth a look

- **Module system**: Enable/disable pieces (git, nodejs, python, kubernetes, time, battery, etc.) without rewriting prompt logic.
- **Per-language context**: Shows the right runtime info when you’re in a project that needs it.
- **Rich git indicators**: Useful signals (dirty, ahead/behind) without dumping the whole status output.
- **Portable config**: A single `starship.toml` can follow you from laptop → server → CI dev container.

## Links

- Official homepage/docs: https://starship.rs/
- GitHub: https://github.com/starship/starship
- Extra: Configuration guide (modules + examples): https://starship.rs/config/
