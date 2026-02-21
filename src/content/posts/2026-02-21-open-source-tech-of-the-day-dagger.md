---
title: "Open Source Tech of the Day: Dagger"
pubDate: 2026-02-21
description: "A programmable CI/CD engine that runs pipelines anywhere with containers + caching."
---

If you’ve ever copied a CI pipeline from repo to repo, played “why does it work on GitHub Actions but not on my laptop?”, or stared at a 200-line YAML file wondering where your life went — today’s pick is for you.

## Quick tour

**[Dagger](https://dagger.io/)** is an open-source CI/CD engine you program with real languages (Go, Python, TypeScript, etc.), while it does the heavy lifting with containers under the hood.

The mental model is refreshingly simple:

- You describe a build/test/deploy workflow as code.
- Dagger executes it as a container graph.
- The same pipeline runs locally, in CI, or on any machine that can run containers.

Instead of “CI config files” being a special snowflake you only touch when it breaks, your pipeline becomes a first-class part of your codebase — with functions, types, tests, refactors, and reusable modules.

## Why it’s cool

### 1) Your pipeline becomes *portable*

A Dagger pipeline can run:

- On your laptop while you iterate
- In GitHub Actions / GitLab CI / Buildkite / whatever
- On a teammate’s machine

That portability isn’t magic; it’s because the steps are containerized and controlled. If it builds the same container the same way, it tends to behave the same way.

### 2) Great caching (the "make it fast" superpower)

Dagger builds a graph of operations and can reuse results when inputs haven’t changed. In practice, this often means:

- Faster incremental runs
- Less re-downloading dependencies
- Less "CI is slow so we stopped trusting it" energy

### 3) Pipelines as reusable building blocks

Because Dagger is code, you can factor out common pieces:

- “Build the app”
- “Run unit tests”
- “Package an image”
- “Publish artifacts”

…and reuse them across repos or teams with modules.

### 4) It nudges you toward better engineering habits

When your pipeline is a normal program, it’s much easier to:

- Add small helper functions
- Log/trace what’s happening
- Keep things DRY without YAML contortions

It’s like moving from shell scripts taped together with vibes to a tool you can actually maintain.

## Who it’s for

Dagger is a great fit if you:

- Maintain multiple services/repos and want a consistent pipeline story
- Want to run CI steps locally (fast feedback, fewer CI round-trips)
- Are hitting the limits of “YAML + bash” for complex workflows
- Care about reproducibility and caching (especially in container-heavy builds)

If you have a tiny repo with a single `npm test` step, plain CI YAML is fine. But once pipelines start feeling like mini-apps, Dagger starts looking very reasonable.

## Getting started (smallest first step)

The quickest way to try Dagger is to install the CLI and run a minimal pipeline.

### Option A: Homebrew (macOS)

```bash
brew install dagger/tap/dagger
```

### Option B: Install script (macOS/Linux)

```bash
curl -fsSL https://dl.dagger.io/dagger/install.sh | sh
sudo mv bin/dagger /usr/local/bin
```

Now, in any project directory, you can initialize a new Dagger module (pick an SDK you like):

```bash
dagger init --sdk=python
```

Then run the default function (Dagger generates a starter you can tweak):

```bash
dagger call -m .
```

From there, the fun part is editing the generated module to do one real thing your project needs (e.g., run tests in a container, build an artifact, or produce a Docker image).

## A couple standout features to explore next

- **Language SDKs:** You’re not stuck in a domain-specific config format. Use your team’s language.
- **Composable container graph:** Pipelines aren’t linear scripts; they’re operations that can be reused and combined.
- **Works well with existing CI:** Dagger doesn’t demand you abandon your CI provider — it plugs in.

## Links

- Official homepage / docs: https://dagger.io/
- GitHub repo: https://github.com/dagger/dagger
- Extra reading (concepts overview): https://docs.dagger.io/
