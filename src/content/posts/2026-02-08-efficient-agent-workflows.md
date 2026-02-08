---
title: "Efficient Agent Workflows: How to Get Better Results with Less Context (and Less Spend)"
pubDate: 2026-02-08
description: "Practical tactics for making AI agents faster, cheaper, and more reliable: context budgeting, just‑in‑time retrieval, structured prompts, parallelism patterns, and caching." 
tags: ["agents", "productivity", "ai", "best-practices"]
---

Agents are amazing at two things:

1. **Turning ambiguous goals into concrete steps**
2. **Doing a lot of small, boring work without getting tired**

They’re also amazing at a third thing that nobody advertises:

3. **Burning tokens (and time) when you let the context get sloppy**

If you’ve ever watched an agent “get lost” in a long conversation, re-read old messages, forget constraints, or start over from scratch… that’s not just a model problem. It’s usually a **context engineering** problem.

Anthropic has a useful framing here: *context is a finite resource with diminishing returns*—as you stuff more tokens into the window, you can get “context rot” where retrieval and reasoning degrade. Context should be treated like an **attention budget**, not an infinite hard drive. Source: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents

This post is a practical playbook for being **efficient** with agents:

- maximize outcome quality
- minimize context bloat
- reduce latency and cost
- keep the agent reliable over long tasks

I’ll focus on what works in the real world (coding, research, writing, automation), not just theory.

---

## The core idea: context is a budget

The mental shift that makes everything else click:

- Your agent’s context window is not “memory.”
- It’s more like **RAM**.

Every token you include competes for attention:

- instructions
- tool outputs
- logs
- earlier conversation
- retrieved documents
- examples
- and the user’s latest ask

If you want an agent to behave well, you have to keep its working set **small, relevant, and well-structured**.

### Practical rule

> If the agent needs it *later*, store a **reference** to it, not the whole thing.

(Examples: a file path, a URL, a search query, an issue ID, a checklist item.)

Anthropic explicitly recommends “just in time” context: keep lightweight identifiers (paths, links, queries), and load details only when needed using tools. Source: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents

---

## 1) Start with the smallest working prompt that could possibly succeed

Most agent inefficiency starts here: people write prompts like legal documents.

The agent doesn’t need 40 paragraphs of rules. It needs:

- the goal
- constraints
- definition of done
- and a way to ask questions when it’s blocked

Anthropic’s guidance: system prompts should be clear and direct, and you should aim for the **minimal set of information** that fully outlines expected behavior—then add only what’s needed based on observed failure modes. Source: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents

### A good “agent task” template

Use something like this (works for coding, writing, research):

- **Goal:** what “done” looks like
- **Context:** only the facts that matter
- **Constraints:** what not to do
- **Output format:** what you want back
- **Checkpoints:** where to ask before doing risky things

Example:

> Goal: Add tags browsing to my Astro blog.
> Context: content is in `src/content/posts`. Schema is in `src/content/config.ts`.
> Constraints: keep it static-build compatible; keep UI minimal.
> Output: commit + push; provide URLs.
> Checkpoints: ask before adding heavy dependencies.

This gets you 80% of the value with 20% of the tokens.

---

## 2) Use the right pattern: workflows before agents, agents before teams

A big efficiency win is choosing the simplest architecture that works.

Anthropic makes a strong point: often you don’t need “agents” at all—**a few well-structured LLM calls with retrieval and examples** can outperform a wandering autonomous loop, with better cost/latency. Source: https://www.anthropic.com/engineering/building-effective-agents

### The ladder (cheapest → most expensive)

1. **Single call** (with good prompt + retrieval)
2. **Prompt chaining** (outline → draft → polish)
3. **Routing** (small model for easy tasks, big model for hard ones)
4. **Parallelization** (multiple perspectives or independent sections)
5. **Orchestrator-workers** (dynamic delegation)
6. **Full agents** (tool-using loop)
7. **Agent teams** (multiple independent sessions)

Each step up buys flexibility, but costs more.

### Practical heuristic

> If you can predict the steps, don’t pay for autonomy.

Use a workflow.

> If you can’t predict the steps (or the environment is messy), pay for autonomy.

Use an agent.

> If you need competing hypotheses and real collaboration, pay for a team.

Use agent teams.

---

## 3) Keep tool output token-efficient (and teach the agent to ask for less)

If you’re building tools (or even just choosing tools), tools are *where context goes to die*.

The worst offenders:

- dumping entire files
- dumping unfiltered logs
- returning huge JSON blobs

Two fixes:

### A) Prefer “query tools” over “fetch tools”

Instead of “get me everything,” build or use tools that return:

- top N results
- specific fields
- a narrow time window
- a summary + a pointer to the full artifact

### B) Put “how to use tools” into the system prompt

A tiny bit of tool guidance saves a ton of tokens:

- “When reading a file, start with the top 80 lines.”
- “When searching logs, show only errors and surrounding context.”
- “Prefer IDs/paths over copying large bodies.”

Anthropic’s context engineering guidance emphasizes that tools should promote efficiency and avoid overlapping/ambiguous toolsets. Source: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents

---

## 4) Compress the conversation intentionally (don’t let it rot)

Long tasks often degrade because the agent is dragging around stale history.

A simple trick that works:

### “Rolling brief” summaries

Every so often (or at checkpoints), ask the agent to produce:

- current goal
- decisions made
- constraints
- current plan
- open questions
- next actions

Then start a new thread using only that summary + the files/links it references.

This is basically manual compaction. It’s boring, but it works.

---

## 5) Move stable context to files (so you don’t keep paying for it)

If something is stable, don’t paste it every time.

Examples:

- project conventions
- architecture notes
- API contracts
- style guides
- “how we do deployments”

Put them in:

- `README.md`
- `CONTRIBUTING.md`
- `CLAUDE.md` / “agent instructions” file (if your tool supports it)
- or a `docs/` folder

Then the agent can **reference the file** and load only what it needs.

This aligns with the “just in time” approach: keep pointers, load details only when needed. Source: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents

---

## 6) Be ruthless about “definition of done”

Agents waste time when the finish line is fuzzy.

Instead of:

- “make it better”

Use:

- “add tags + search pages, build must pass, push to main, and tell me the URLs”

A clear “done” gives the agent a stopping condition.

### A great DoD checklist for code changes

- Build passes
- No secrets committed
- Tests updated (if applicable)
- User-facing instructions updated
- The change is reversible

Even if you don’t have a formal CI pipeline, this checklist reduces wasted loops.

---

## 7) Use parallelism like a scalpel, not a hammer

Parallel agents feel like free speed. They aren’t.

Parallelism is best when:

- tasks are independent
- each worker has a distinct lens
- aggregation is straightforward

Anthropic’s “Building Effective Agents” highlights parallelization as useful for either **independent sections** or **voting/multiple perspectives**. Source: https://www.anthropic.com/engineering/building-effective-agents

### High-ROI parallel patterns

#### A) Multi-lens review

- security lens
- performance lens
- correctness lens

Aggregate into one “findings + fixes” report.

#### B) Competing hypotheses debugging

Have each worker try to disprove the others.

#### C) Research sectioning

Split by topic, not by source. (More coherent.)

### Low-ROI parallel patterns

- multiple agents editing the same file
- “10 agents build my whole app”
- tasks with tight sequential dependencies

---

## 8) Put static content at the front (so you can benefit from caching)

If you’re using an API platform that supports prompt caching, structure your prompt so the shared prefix stays identical.

OpenAI’s guidance is explicit: cache hits require exact prefix matches; put static instructions and examples at the beginning, and variable content at the end. Source: https://platform.openai.com/docs/guides/prompt-caching

Even if you’re not using prompt caching explicitly, this structure still helps performance:

- the model sees the rules first
- and the “current request” last

### Caching-friendly prompt layout

1. system instructions
2. tool descriptions
3. style rules
4. examples
5. **then** user request + volatile context

---

## 9) Route tasks to cheaper models by default

Not every step needs your biggest model.

Common strategy:

- cheap model: summarization, extraction, formatting, boilerplate
- expensive model: planning, architecture, debugging, ambiguous problems

Anthropic describes routing as a way to send easy tasks to smaller models and hard tasks to larger ones, optimizing cost/performance. Source: https://www.anthropic.com/engineering/building-effective-agents

If you don’t do this, you’ll end up paying premium rates to format bullet points.

---

## 10) Make the agent show its work *selectively*

A subtle efficiency trick: you don’t want the agent to be verbose all the time, but you *do* want it to be auditable.

Ask for:

- a short plan up front
- and concise progress updates
- and a final summary of what changed + where

But don’t ask for a novel.

### Two modes that work well

- **“Executor mode”**: minimal narration, just do the steps.
- **“Reviewer mode”**: slow down, explain decisions, enumerate risks.

Switch between them deliberately.

---

## A small “efficiency checklist” you can reuse

When you’re about to hand work to an agent, run this:

1. Can this be a workflow (fixed steps) instead of a free-roaming agent?
2. What’s the smallest context that would work?
3. What are the constraints + definition of done?
4. Are there any expensive tool outputs we can avoid?
5. Can we store stable context in files and reference paths instead?
6. Should we parallelize (multi-lens / independent sections) or keep it single-threaded?
7. Which parts can run on a cheaper model?
8. Where are the checkpoints that need human approval?

If you answer those eight questions, you’ll get:

- better outputs
- fewer “agent loops”
- smaller bills
- and fewer weird failures

---

## Closing thought

The best agent users don’t “prompt harder.”

They:

- **budget context**
- **design constraints**
- **choose the right orchestration pattern**
- **retrieve information just-in-time**
- and **treat tokens like money** (because they are)

You don’t need to starve the model. You just need to stop feeding it junk.
