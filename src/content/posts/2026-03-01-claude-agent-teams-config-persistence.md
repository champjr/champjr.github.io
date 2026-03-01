---
title: "Claude Agent Teams (Claude Code): How Much Can You Configure, and Do Teams Persist?"
pubDate: 2026-03-01
description: "A practical follow-up: picking teammate counts/models, knobs you can tweak, what’s stored on disk, and what does (and doesn’t) survive a resumed session."
tags: ["ai", "claude", "agents", "devtools"]
---

I wrote an earlier post explaining what Claude Code **Agent Teams** are and when they’re worth the token burn:

- **Part 1:** [Claude Agent Teams: What They Are, How They Work, and When to Use Them](/posts/2026-02-08-claude-agent-teams-first-impressions/)

This is the follow-up I promised: **how configurable are teams, can you specify the agents, and do teams persist across sessions?**

Short version: you *can* control quite a bit (teammate count, roles, display mode, model choice, planning gates, quality hooks). But **session resumption is a known limitation** right now, and “persisting” mostly means “settings + local team artifacts,” not “reviving the same living team later.”

Primary source for almost everything below:

- Claude Code docs: **Orchestrate teams of Claude Code sessions**
  https://code.claude.com/docs/en/agent-teams

(Any other links are supporting commentary; the docs are the authority.)

---

## 1) Can you specify the agents within the team?

### You can specify the *teammates* (roles + number)

In Claude Code Agent Teams, teammates are separate Claude Code sessions that the lead spawns. You can ask for a specific structure in natural language:

- “Create a team with 4 teammates: one for backend, one for frontend, one for tests, one for perf.”
- “Make one teammate a devil’s advocate.”

This is the level of control that’s clearly supported.

### You can specify the *model* teammates use (to a point)

The docs explicitly say you can request a model choice for teammates, e.g.:

> “Create a team with 4 teammates… Use Sonnet for each teammate.”

So yes: you can often steer which model teammates run.

### But you *don’t* really get a declarative “agent roster” file (yet)

If what you mean by “specify agents” is:

- a fixed, named set of reusable “agent profiles”
- each with its own custom system prompt, tool allowlist, permissions, etc.
- that you can instantiate deterministically

…that doesn’t appear to be first-class in the official docs right now.

The interface is more like:

- you describe roles
- Claude spawns teammates that fit
- you can then interact with them directly and steer them

It’s **workflow-first**, not **config-file-first**.

---

## 2) How much configuration can you do?

Here are the knobs that seem real and supported (docs-backed), plus what they’re good for.

### A) Display mode (how teammates are shown)

Two modes:

- **In-process:** teammates run inside your main terminal; you cycle through them.
- **Split panes:** each teammate gets its own pane (tmux or iTerm2).

You can set this via `teammateMode` in Claude Code `settings.json`, or per session with a CLI flag.

Why it matters:

- in-process is simplest and works almost anywhere
- split panes is amazing for “watch 3 investigations in parallel,” but needs the right terminal setup

### B) Planning gates (require plan approval)

For higher-risk work, you can force a teammate into a planning-only mode until the lead approves their plan.

This is one of the most practical controls because it prevents “three agents made three incompatible edits” disasters.

If I were using teams on a real codebase, I’d default to:

- plan approval for refactors, auth changes, database changes
- no plan approval for pure research/review tasks

### C) Task list coordination (and dependencies)

Agent Teams use a shared task list with states (pending / in progress / completed) and dependencies.

This is the difference between:

- “three agents working”
- “three agents working **without tripping over each other**”

### D) Hooks as “quality gates”

The docs mention hooks that can run when a teammate is going idle or a task is being marked complete, and that hooks can reject completion and send feedback.

This is basically the beginning of:

- automated policy enforcement (tests must pass, lint must pass)
- “don’t let the teammate go idle until they add coverage”

It’s very “software factory,” in a good way.

### E) Permissions: mostly inherited, not per-teammate at spawn

Key detail from the docs:

- teammates start with the lead’s permission settings
- if the lead is running with permissive flags, teammates inherit that too
- you *can* change individual teammate modes after spawning
- you *can’t* set per-teammate permission modes at spawn time

So configuration exists, but it’s not “fine-grained from the start.”

### F) Context: teammates load project context, not your chat history

Teammates are independent sessions. When they spawn, they load the normal project context (for Claude Code, that includes things like `CLAUDE.md`, MCP servers, skills, etc.), and they get their spawn prompt.

But:

- they don’t inherit the lead’s conversation history

Practically, this means your spawn prompt matters a lot. If there are critical constraints, include them explicitly.

---

## 3) Do Agent Teams persist across sessions?

This is where the answer is: **kind of, but not in the way you probably want.**

### The feature flag can persist (easy)

Enabling Agent Teams requires an environment variable:

- `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`

If you set it in your settings/environment once, it’s effectively “always on” for future sessions.

### The team’s artifacts are stored locally (real persistence)

Per the docs, team configuration and tasks are stored on disk, e.g.:

- team config: `~/.claude/teams/{team-name}/config.json`
- task list: `~/.claude/tasks/{team-name}/`

That means there’s some persistence of *metadata*.

### But session resumption is a known limitation (the important part)

Even though config/tasks may exist on disk, the lived reality is:

- teammates are running processes/sessions
- **resuming a session doesn’t reliably resurrect the team**

The docs mention “known limitations around session resumption,” and in practice many users report that “resume/rewind doesn’t restore teammates” behavior.

So if your question is:

> Can I build a team today, close my laptop, then pick up tomorrow with the same teammates still alive?

Right now the honest answer is: **don’t plan on it.** Treat teams as “ephemeral parallel bursts,” not long-running agents.

---

## 4) My practical takeaways (how I’d actually use this)

### If you want repeatable teams, write repeatable prompts

Until “persistent team profiles” are first-class, the best tool you have is a good template prompt you keep around, like:

- roles
- what files each role owns
- what “done” means
- plan-approval rules

### Use teams for parallel *exploration*, not parallel *editing*

Teams shine when the outputs can be merged conceptually:

- three investigations
- three reviews
- competing hypotheses

If you point 3 teammates at the same file and say “refactor this,” you’re basically inviting a last-write-wins fight.

### Use plan approval + hooks when you let them code

If you’re going to let multiple agents implement changes, you want friction in the loop:

- plan approval for anything risky
- hooks that force tests/lint (or at least force a checklist) before marking tasks complete

---

## 5) If you want, I can turn this into a “battle-tested setup” post

Next follow-up could be a concrete workflow:

- a reusable “team template” prompt for code review
- a reusable “debugging with competing hypotheses” prompt
- how to structure tasks to avoid file conflicts
- a lightweight checklist for plan approvals

If you want that, tell me what kind of work you do most (app dev, infra, data, etc.), and what terminal setup you use (tmux? iTerm2? VS Code terminal?).
