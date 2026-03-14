---
title: "Open Source Tech of the Day: Lazygit"
pubDate: 2026-03-14
description: "A fast, friendly terminal UI for Git that makes everyday workflows way less fussy."
---

Git is incredible… and also sometimes a little *much* for quick, everyday tasks.

If you’ve ever thought “I just want to see what’s going on and commit this without a 12-command ceremony,” today’s pick is for you:

## Quick tour

**Lazygit** is a terminal UI (TUI) for Git. It sits on top of your existing repo and Git install, then gives you a clean, keyboard-driven interface for the stuff you do constantly:

- **Status at a glance:** staged vs unstaged changes, untracked files, current branch, recent commits.
- **Interactive staging:** stage hunks/lines without juggling `git add -p` prompts.
- **Easy commits:** write a message, commit, amend, squash—without losing track of what’s staged.
- **Branch workflows:** create/switch branches, rebase/merge, resolve conflicts with context.
- **Diffs everywhere:** side-by-side diffs you can navigate like a file browser.

Under the hood, it’s still Git. Lazygit is basically “Git, but with a cockpit.”

## Why it’s cool

A lot of dev tools try to replace Git or invent a new workflow. Lazygit’s vibe is different: it **reduces friction** while staying honest about what Git is doing.

A few standout features that make it stick:

1) **Hunk/line staging that feels natural**

You can move through changed files, preview diffs, and stage just the parts you want. This is the sweet spot between “stage everything” and “drop into patch mode and hope you don’t fat-finger it.”

2) **Rebase and conflict resolution with less dread**

Rebasing is powerful, but the mental overhead can spike fast—especially when conflicts appear. Lazygit helps by keeping the history, the current operation, and the working tree visible at the same time.

3) **Keyboard-first, fast, and predictable**

You don’t have to hunt around a GUI for the right panel. The navigation model is consistent: panels for files/branches/commits, plus context-sensitive actions. After a day or two, it becomes muscle memory.

Also: you can be “lazy” *and* competent. It’s allowed.

## Who it’s for

- **CLI Git users** who like the terminal but want less ceremony for common tasks.
- **GUI Git users** who want a faster, more scriptable workflow without losing visibility.
- **Anyone learning Git** who benefits from a visual model of “working tree → staging area → commits.”

If you’re doing advanced Git surgery daily, you’ll still use raw commands sometimes—but Lazygit is excellent for the 80% of Git work that’s repetitive.

## Getting started (smallest first step)

1) Install Lazygit

- macOS (Homebrew):
  
  ```bash
  brew install lazygit
  ```

- Linux / Windows: see the install docs below.

2) Run it inside any Git repo:

```bash
cd path/to/your/repo
lazygit
```

That’s it. No daemon, no server, no setup wizard.

If you want one “starter mission,” try this:

- Open a repo
- Pick a modified file
- Stage a single hunk
- Commit with a message
- Create a new branch

It’s a five-minute loop that immediately shows you the value.

## Links

- Docs / homepage: https://lazygit.kdheepak.com/
- GitHub: https://github.com/jesseduffield/lazygit
- Extra: "Lazygit: the simple terminal UI for git commands" (quick intro) https://dev.to/jorge_rockr/lazygit-the-simple-terminal-ui-for-git-commands-5d0k
