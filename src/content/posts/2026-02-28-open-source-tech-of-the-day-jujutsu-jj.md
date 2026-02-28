---
title: "Open Source Tech of the Day: Jujutsu (jj)"
pubDate: 2026-02-28
description: "A Git-compatible VCS that makes rewriting history feel normal—in a good way."
---

If you’ve ever wished Git history editing felt less like defusing a tiny bomb, today’s open-source gem is for you: **Jujutsu**, usually invoked as **`jj`**.

Jujutsu is a **Git-compatible version control system** that rethinks the everyday workflow around commits, branching, and rewriting. It can work **with a Git repo** (so you can collaborate with Git users) while giving you a model that’s often *simpler*, *more consistent*, and *shockingly comfortable* once it clicks.

## Quick tour

### What it is
- **A DVCS** (distributed version control system) with its own concepts and commands.
- **Git-compatible**: it can use Git as a “backend” and interoperate with existing repos.
- **Designed for change**: rewriting and reorganizing work is not a rare emergency move—it’s just… normal.

### What problem it solves
Git is amazing, but its internal model leaks into daily usage: detached HEAD states, staging quirks, and “oops I rebased the wrong thing” moments. Jujutsu tries to make common tasks feel more direct:

- You’re always “on” a working copy state.
- You can **edit, split, squash, reorder, and rebase** with fewer footguns.
- The tool feels built around the idea that your work is a *draft* until you decide it’s ready.

### Standout features (the “wait, that’s nice” list)
1) **First-class history rewriting**
   - In `jj`, rewriting commits is treated like a routine part of iterating. You can reshape a stack of changes without the same level of ceremony.

2) **Great at stacked work (multiple commits in flight)**
   - If you like to build a feature as a clean series of logical commits, `jj` makes that style feel natural rather than fragile.

3) **Git interop without the “two worlds” headache**
   - You can use `jj` in repos that still push/pull with Git, which means you can try it without forcing your team to change tools.

## Why it’s cool

Jujutsu has a particular vibe: it assumes you want your final history to be clean, but it doesn’t punish you while you’re getting there.

In Git, it’s easy to end up treating “rewrite” as something you do only when you’re desperate or when you’re already late. In `jj`, it feels more like editing a document: move paragraphs around, fix the phrasing, then hit publish.

Also: the command-line UX is thoughtful. Things tend to be named after what you’re trying to do, not after an implementation detail from 2005.

## Who it’s for

- **Developers who like tidy commit history** (or wish they did).
- **People who do lots of local iteration** and want to reorganize changes before sharing.
- **Anyone who’s Git-fluent but Git-tired**—especially if your work often becomes a stack of “almost-there” commits.
- **Teams that can’t switch away from Git** (yet): you can still use `jj` locally and collaborate via Git.

If you never rewrite history and you’re happiest with a single commit per PR, you might not feel the magic immediately. But if you’ve ever said “I need to clean this up before anyone sees it,” you’re the target audience.

## Getting started (smallest first step)

Try it on a throwaway repo or an existing Git repo you don’t mind experimenting with.

1) **Install `jj`**
   - macOS (Homebrew):
     ```sh
     brew install jj
     ```
   - Other options (prebuilt binaries, cargo, etc.) are in the official install docs.

2) **Initialize in a repo**
   - New repo:
     ```sh
     mkdir jj-sandbox && cd jj-sandbox
     jj git init
     ```
   - Or in an existing Git repo, you can set up `jj` to work alongside it (see the docs).

3) **Make a tiny change and see the log**
   ```sh
   echo "hello jj" > hello.txt
   jj status
   jj log
   ```

From there, the fun experiment is: make two or three commits, then try reshaping them (reordering/squashing/splitting) and notice how *normal* it feels.

## Links

- Official docs: https://jj-vcs.github.io/jj/latest/
- GitHub repo: https://github.com/jj-vcs/jj
- Installation & setup (great starting page): https://docs.jj-vcs.dev/latest/install-and-setup/
