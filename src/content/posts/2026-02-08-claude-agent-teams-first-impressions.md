---
title: "Claude Agent Teams: What They Are, How They Work, and When to Use Them"
pubDate: 2026-02-08
description: "Anthropic’s new multi-session orchestration in Claude Code: a lead agent, multiple teammates, shared tasks, and direct inter-agent messaging—plus practical guidance on when it’s worth the token burn."
tags: ["ai", "claude", "agents", "devtools"]
---

Anthropic just shipped **Agent Teams** for **Claude Code**—a feature that turns “one helpful coding agent” into **a coordinated group of agents** that can work **in parallel** on the same project.

It’s exciting for the obvious reason (speed), but it’s more interesting for the *less obvious* one: **structure**.

A lot of “multi-agent” demos are basically chaos with better branding—multiple LLMs spitting ideas into a shared chat. Agent Teams, at least on paper and in the docs, is trying to be something closer to a real workflow: *roles, tasks, coordination, and synthesis*.

This post covers:

- what Agent Teams is
- how it works (conceptually + mechanically)
- how to enable and use it
- when you should (and shouldn’t) reach for it
- my thoughts: where it’s genuinely useful, where it’s overkill, and what I’d watch closely

Sources worth skimming alongside this post:

- [Anthropic announcement: Claude Opus 4.6][opus-46]
- [Claude Code docs: Agent Teams][agent-teams-docs]

---

## What is “Agent Teams”?

**Agent Teams** is a Claude Code feature that lets you run **multiple Claude Code sessions (teammates)** at the same time, with one session acting as a **team lead**.

According to Anthropic’s docs, the lead coordinates work, assigns tasks, and synthesizes results, while teammates are separate sessions with their **own context windows** and the ability to **message each other directly**.

This is the key difference from simpler “parallelism” patterns:

- **Subagents**: useful for “go do X and report back.” They don’t really collaborate.
- **Agent Teams**: meant for “go do X, Y, Z *together*, and argue your way to the best answer.”

In practice, Agent Teams is a way to make Claude Code behave less like a single assistant and more like a **mini engineering team**:

- one lead doing triage + orchestration
- specialists doing independent exploration
- fast feedback loops via messaging

The catch (and it’s a real one): **each teammate is a separate Claude instance**, so token usage can scale roughly with the size of the team.

---

## How it works (mental model)

Here’s the “good enough” model that matches the docs.

### 1) Team lead + teammates

- **Lead**: your main Claude Code session. It’s the coordinator.
- **Teammates**: additional Claude Code sessions it spawns.

Each teammate is independent:

- separate context window
- separate reasoning
- separate tool usage
- and (importantly) separate costs

### 2) Shared task list

Agent Teams uses a shared task list to coordinate parallel work.

Tasks can be:

- **pending**
- **in progress**
- **completed**

…and tasks can have **dependencies**, so blocked work can automatically unblock as prerequisites finish.

This is one of those things that sounds boring until you’ve tried to coordinate multiple agents without it.

### 3) Direct inter-agent messaging

Teammates can message each other directly, not just the lead.

That enables the best kind of multi-agent behavior:

- competing hypotheses
- peer review
- “hey, your assumption doesn’t match the logs”

This is how you avoid the classic failure mode where one agent commits to a plausible explanation and stops searching.

### 4) Display modes

The docs describe two ways to visualize/control the team:

- **In-process**: teammates run inside your main terminal UI.
- **Split panes**: teammates each get their own terminal pane (tmux / iTerm2 supported).

### 5) Local persistence (teams + tasks)

Claude Code stores team config and tasks locally (per the docs), so the “team” is a real object on disk, not just a vibe.

That’s a big deal for making this feel like a workflow feature rather than a demo.

---

## How to enable Agent Teams

Agent Teams is currently **disabled by default** and flagged as experimental.

Per the Claude Code docs, you enable it by setting:

- `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`

The docs show enabling it via `settings.json`:

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

Or by exporting the environment variable in your shell.

Once enabled, you can request a team in natural language.

---

## How to use it (practical workflow)

The best way to learn Agent Teams is to start with tasks that are naturally parallel *and* don’t create merge conflicts.

### A good first run: parallel review

Prompt shape:

- “Create an agent team.”
- assign each teammate a distinct lens
- require a clean summary back from the lead

Example:

> Create an agent team to review this PR.
> 
> - Teammate 1: security + auth + input validation
> - Teammate 2: performance + scaling risks
> - Teammate 3: correctness + edge cases
> 
> Have them message each other if they disagree, then synthesize one final review.

No file edits. Low risk. High signal.

### The killer use case: debugging with competing hypotheses

Single-agent debugging has a consistent failure mode:

1. agent finds one plausible explanation
2. it “feels right”
3. it stops searching

Agent Teams is built to do better here.

Example:

> Create an agent team to debug intermittent 500s.
> 
> - Teammate A: investigate DB/pool exhaustion
> - Teammate B: investigate caching/race conditions
> - Teammate C: investigate memory leak / GC pressure
> 
> Require evidence: point to code paths, logs, metrics. Have them challenge each other.

If the agents can actually disagree productively, this is where the feature pays for itself.

### Cross-layer feature work (frontend + backend + tests)

This is the “parallelize the stack” scenario:

- teammate 1: backend endpoints/data model
- teammate 2: frontend UI/state
- teammate 3: tests + edge cases

The trick is to avoid everyone editing the same file. Good boundaries matter.

---

## When you should use Agent Teams (and why)

Anthropic’s docs call out the strongest scenarios as:

- research + review
- debugging with competing hypotheses
- cross-layer coordination
- new modules/features where teammates can work independently

That maps to a simple heuristic:

### Use Agent Teams when…

- **parallel exploration changes the answer** (not just the speed)
- you want **multiple perspectives** (security/perf/correctness)
- the problem benefits from **argument + evidence**, not just a plan
- the work can be split into **non-overlapping ownership**

### Don’t use Agent Teams when…

- the task is sequential (“do step 1, then step 2, then step 3”)
- the work centers on a single file/module (merge conflict factory)
- the job is small enough that coordination overhead dominates
- you’re cost-sensitive and the extra instances don’t buy much

Subagents (or just one Claude Code session) tend to win in those cases.

---

## Cost, safety, and control (the non-fun part)

Agent Teams is “more power,” which means it can also be “more damage” if you’re not careful.

A few safety/operational notes pulled from the docs + the obvious implications:

### 1) Token costs scale with the team

Each teammate is a separate session. If you spawn 5 teammates, you should expect **a big multiplier** on usage.

That’s fine when you’re unblocking a production incident. It’s silly when you’re renaming variables.

### 2) Permissions propagate

The docs note that teammates inherit the lead’s permission settings.

So if you’re running Claude Code in an overly-permissive mode, you’re basically giving that permission to *every teammate you spawn*. Treat this like giving shell access to an entire team.

### 3) Quality gates matter

Claude Code supports hooks (per the docs) that can enforce quality gates when a task is completed.

In a multi-agent world, “finish a task” shouldn’t mean “ship it.” It should mean:

- tests pass
- lint passes
- no secrets
- no broken builds

---

## How I’d actually use this (opinionated)

If I’m being blunt: **Agent Teams is overkill for 80% of what people will try it on.**

But for the 20% where it fits, it’s legitimately a big deal.

### Where I think it shines

1. **Adversarial debugging**
   - multiple hypotheses
   - shared evidence
   - converge through disagreement

2. **Parallel review**
   - security/perf/correctness
   - best ROI for “extra brains per token”

3. **Architecture exploration / trade studies**
   - teammate A proposes path 1
   - teammate B proposes path 2
   - teammate C tries to break both

### Where I think people will misuse it

- “I want 10 agents to build my whole app.”

Without strong boundaries and a real integration plan, you’ll get:

- duplicated work
- conflicting changes
- a messy set of partial implementations

Agent Teams is not a substitute for:

- a clear spec
- file ownership
- tests
- and a human integrating the final result

### My recommended starting rule

Start with **read-only** agent teams:

- review
- research
- debugging analysis

…and only graduate to “teammates write code” once you’ve learned how the coordination behaves in your environment.

---

## How to prompt Agent Teams effectively

Prompts that work well tend to have:

1. **Roles** (clear ownership)
2. **Constraints** (what not to do)
3. **Definition of done**
4. **Synthesis request** (lead must produce one final artifact)

Template:

> Create an agent team.
> 
> Roles:
> - Teammate A: …
> - Teammate B: …
> - Teammate C: …
> 
> Constraints:
> - Avoid editing the same files.
> - Prefer small diffs.
> - Require tests.
> 
> Deliverable:
> - Lead produces a single summary + recommended next actions.

---

## Closing thoughts

Agent Teams feels like a genuine step toward **usable multi-agent systems**, not just “more tokens, more chatter.” The architecture choices Anthropic is documenting—shared task list, direct messaging, a lead that synthesizes—are the boring ingredients you need for this to be real.

My bet is that the best early wins will be:

- *competing-hypothesis debugging*
- *parallel review*
- *cross-layer feature scaffolding with strict boundaries*

…and the biggest early footguns will be:

- cost surprises
- permission mistakes
- teammates stepping on the same files

If you try it, treat it like hiring interns with infinite stamina: you still need task boundaries, quality gates, and a lead who actually leads.

If you want to go deeper, read the official docs first (they’re unusually practical):

- [Claude Code docs: Agent Teams][agent-teams-docs]

[opus-46]: https://www.anthropic.com/news/claude-opus-4-6
[agent-teams-docs]: https://code.claude.com/docs/en/agent-teams
