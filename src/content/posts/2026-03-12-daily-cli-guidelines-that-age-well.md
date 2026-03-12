---
title: "CLI Guidelines That Age Well (and the Ones I Ignore)"
pubDate: 2026-03-12
description: "Some command-line design habits I keep coming back to—plus a few rules I cheerfully bend."
tags: [cli, tooling, developer-experience, workflows]
---

I have an ongoing love/hate relationship with command-line tools.

I love them because they’re fast, scriptable, and unapologetically literal. I can glue them together with pipes, stash them in `Makefile`s, and run them from anywhere—including places with terrible Wi‑Fi.

I hate them because a surprising number feel like they were designed as puzzles for the author’s future self.

If you’ve ever typed a command, got a three-line error, and thought, “Cool. I understand *none* of this,” you know the vibe.

So here are some CLI guidelines that age well—the ones that keep paying dividends after the third time you run the tool, and the thirtieth.

(And yes: I’m going to admit a few rules I ignore when I’m hacking on something small. Because real life has deadlines.)

## 1) The help text is the product

A CLI can be internally elegant and still be a failure if `--help` is bad.

I’ve come to treat `--help` as the *primary UI*. The binary is just an implementation detail.

A good help screen answers three questions:

- **What does this tool do?** (one line, human phrasing)
- **What are the common ways I’ll use it?** (2–6 examples)
- **What do I do when something goes wrong?** (pointers, exit codes, config locations)

That “examples” part is the cheat code. People learn by copying.

One of the best public references for this stuff is the Command Line Interface Guidelines site: <https://clig.dev/>. Even if you don’t adopt everything, it’s a strong reminder that UX is not just for apps with buttons.

### A tiny trick that helps

If you only do one thing, do this:

- Put the most common commands first.
- Use examples that look like they came from real work, not a toy demo.

If your tool outputs JSON, an example should include `jq`. If your tool manipulates files, show a before/after.

## 2) “Default” should be safe, not clever

There’s a specific kind of CLI that scares me:

- It can delete things.
- It defaults to doing the deletion.
- The confirmation prompt is… vibes.

For anything that mutates the world, I want defaults that are:

- **Non-destructive** (or at least recoverable)
- **Explicit** (actions are named like actions)
- **Previewable** (dry run is first-class)

A `--dry-run` flag is basically a trust builder. Same with `--yes`/`--force` as a deliberate, opt-in escape hatch.

And if you can, print what you’re about to do in a way a human can skim.

Example of a good pattern:

- `tool plan …` → show what would happen
- `tool apply …` → do it

I’ve rarely regretted adding that split.

## 3) Output is an API—treat it like one

Most CLIs have two audiences:

1. Humans reading in a terminal
2. Other programs parsing the output

When you don’t pick a lane, everyone suffers.

What’s worked best for me:

- **Human-readable by default** (short, aligned-ish, not too chatty)
- A `--json` (or `--format json`) mode that is stable and documented
- Keep logs and status messages on **stderr** so stdout stays clean

That last one is boring, but it’s the difference between:

- `tool list | jq …` working reliably
- and you spending your afternoon debugging why there’s a “Loading…” line in the middle of a JSON array

If you’re making claims like “this tool is scriptable,” stdout/stderr discipline is where you prove it.

## 4) Make errors actionable (and slightly empathetic)

The best error messages do three things:

- **Say what happened** in plain language
- **Say why** (or what the tool thinks why)
- **Say what to do next**

Bad:

- `Error: invalid argument`

Better:

- `Error: unknown subcommand "stauts". Did you mean "status"? See "tool --help".`

No one needs the full stack trace by default. Give a `--verbose` (or `--debug`) flag for that. But the first error should feel like a helpful coworker, not a haunted printer.

Also: exit codes matter. If your tool fails, *fail on purpose*.

- `0` = success
- non‑zero = failure

If the CLI is meant for automation, there’s a whole world of difference between “printed an error message” and “actually returned a failing exit code.”

## 5) Make the “right” thing easy and the “wrong” thing obvious

I like CLIs that nudge you toward good behavior.

Examples:

- If authentication is required, give a clear `tool auth login` path.
- If configuration is required, provide `tool config init` and generate a commented template.
- If a dangerous operation exists, make it longer to type and harder to do accidentally.

One of my favorite micro-patterns is requiring the target to be explicit for destructive operations.

Instead of:

- `tool delete`

Prefer something like:

- `tool delete --id 123`

It’s not bulletproof, but it avoids the “oops, defaulted to everything” class of disasters.

## 6) Subcommands should read like sentences

This is a style thing, but it adds up.

A CLI that reads like a sentence tends to be easier to remember:

- `tool repo clone …`
- `tool repo list`
- `tool repo add-remote …`

You can almost narrate it.

When subcommands are inconsistent (sometimes nouns, sometimes verbs, sometimes vibes), users start guessing—and guessing is how you end up on Stack Overflow at 2 AM.

## The rules I happily bend (sometimes)

Now, honesty: I don’t always follow the full discipline above.

If I’m building a tiny internal tool or a one-off script, I’ll sometimes:

- Skip `plan/apply` and just add `--dry-run`
- Dump a little extra info to stdout because it’s “fine”
- Let the help text be minimal

But there’s a consistent pattern to when I regret it:

- The tool survives longer than I expected.
- Someone else starts using it.
- I try to wire it into automation.

That’s when today’s “eh, whatever” becomes tomorrow’s “why is this like this.”

So my compromise is:

- **Start simple**, but
- **leave hooks for grown-up behavior**

Meaning: even if the first version is scrappy, I try to reserve space for:

- `--help` with examples
- `--json` output mode
- `--verbose` debugging
- predictable exit codes

You don’t have to ship a perfect CLI. But it’s worth shipping one that can become perfect without a rewrite.

## A quick self-checklist

If you’re shipping (or even just sharing) a CLI, here’s a short checklist I use:

- `--help` answers “what is this” and includes real examples
- destructive actions are explicit and previewable
- stdout is parseable; logs go to stderr
- errors suggest a next step
- there is a stable machine-readable output format

If you hit those, you’re already ahead of the tools that treat humans as an optional dependency.

And if you ever feel guilty for caring about this stuff: remember that CLIs are the original productivity apps. They just hide their UI behind a blinking cursor.
