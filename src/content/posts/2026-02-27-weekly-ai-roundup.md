---
title: Weekly AI Roundup for the Week of 2026-02-23
pubDate: 2026-02-27
description: Agents everywhere, a fresh burst of image-gen speed, and regulators still arguing about where the guardrails should sit.
---

- [TL;DR](#tldr)
- [Models & Research](#models--research)
- [Products & Developer Tools](#products--developer-tools)
- [Chips, Compute & Infra](#chips-compute--infra)
- [Policy, Safety & Regulation](#policy-safety--regulation)
- [Funding, M&A, Industry](#funding-ma-industry)
- [What Hacker News talked about](#what-hacker-news-talked-about)
- [What to watch next week](#what-to-watch-next-week)
- [Sources](#sources)

## TL;DR

- Google shipped **Nano Banana 2**, pitching “Flash-speed” image generation with more world knowledge and better consistency. If it’s real, it’s a practical win; if it’s cherry-picked demos, we’ll know soon enough. (<https://blog.google/innovation-and-ai/technology/ai/nano-banana-2/>; <https://techcrunch.com/2026/02/26/google-launches-nano-banana-2-model-with-faster-image-generation/>)
- Google also teased **multi-step task handling in the Gemini app** (initially as a beta on Pixel 10 / Samsung S26). Agents are creeping from “toy” to “default UX.” (<https://blog.google/innovation-and-ai/products/gemini-app/android-multi-step-tasks/>)
- Perplexity announced **Perplexity Computer**, a “computer-using agent” that reportedly orchestrates a pile of models to run workflows. Big promise; I’m watching for failure modes and how they handle permissions and errors. (<https://techcrunch.com/2026/02/27/perplexitys-new-computer-is-another-bet-that-users-need-many-ai-models/>)
- Research continues to shift toward **agents + evaluation**: new benchmarks for agent work (APEX-Agents) and for coding agents optimizing real inference workloads (ISO-Bench). (<https://arxiv.org/abs/2601.14242>; <https://arxiv.org/abs/2602.19594>)
- Reuters reported a high-profile clash where **Anthropic declined a Pentagon request to remove safeguards**. The “how safe is safe enough?” conversation is now a procurement conversation. (<https://www.reuters.com/sustainability/society-equity/anthropic-rejects-pentagons-requests-ai-safeguards-dispute-ceo-says-2026-02-26/>)
- Nvidia’s blog highlighted national-scale AI infrastructure efforts in India. Not a quarterly earnings call, but it’s another signal that “AI compute” is being treated like strategic infrastructure. (<https://blogs.nvidia.com/blog/india-ai-mission-infrastructure-models/>)
- Funding remains ferocious: Reuters covered big rounds including an **AI accounting startup Basis** and a **SambaNova raise + Intel partnership**. (<https://www.reuters.com/business/ai-accounting-startup-basis-raises-100-million-115-billion-valuation-2026-02-24/>; <https://www.reuters.com/business/media-telecom/ai-chip-startup-sambanova-raises-350-million-vista-led-round-signs-intel-2026-02-24/>)

## Models & Research

This week’s research vibe: “Agents are the new apps” (again), but with a welcome shift toward *measuring* what those agents can actually do.

### Benchmarks are getting more realistic (and more painful)

Two papers caught my eye because they’re not just “look, we got +2 points on a synthetic multiple-choice set.” They’re trying to bottle the chaos of real work.

- **APEX-Agents** introduces a benchmark of agent tasks with prompts, rubrics, gold outputs, and supporting files/metadata. That packaging matters: if you want reproducible comparisons, you need the whole messy context, not a screenshot of a prompt. (<https://arxiv.org/abs/2601.14242>)
- **ISO-Bench** focuses on a deliciously concrete target: can coding agents optimize *real inference workloads* drawn from serving stacks like vLLM and SGLang? That’s the kind of benchmark that tends to puncture hype, because performance work punishes hand-waving. (<https://arxiv.org/abs/2602.19594>)

My skeptical take: benchmarks can accidentally train the community to overfit, even if they’re “realistic.” My optimistic take: you can’t improve what you refuse to measure, and right now agents desperately need measurement.

### Reliability work is becoming its own “layer”

I also liked the direction of **Agent Behavioral Contracts**, which frames reliability as something you can specify and enforce at runtime (not just “trust the model and pray”). Whether the specific proposal sticks or not, this is the right mental model: agents need guardrails that are *programmable*, not purely vibes-based. (<https://arxiv.org/abs/2602.22302>)

## Products & Developer Tools

If you felt like every company announced an “agent platform” this week… you’re not hallucinating. (Or, if you are, please file a bug report with your nearest neurologist.)

### Google: faster image generation + more agent-like Gemini flows

Google’s **Nano Banana 2** announcement is a classic “speed + quality” pitch: Flash-speed generation with stronger world knowledge, subject consistency, and production-ready specs. If those improvements hold up outside curated demos, this is the kind of upgrade that changes everyday creative workflows—not because it’s magical, but because it’s *less annoying*. (<https://blog.google/innovation-and-ai/technology/ai/nano-banana-2/>; developer angle: <https://blog.google/innovation-and-ai/technology/developers-tools/build-with-nano-banana-2/>)

On the product UX side, Google teased **multi-step tasks in the Gemini app** as a beta on Pixel 10 / Pixel 10 Pro and Samsung’s Galaxy S26 series. The interesting part isn’t “agents can do tasks” (we’ve heard that); it’s the implied operating model: a phone assistant that can chain actions, ask clarifying questions, and then *actually complete the flow*. That’s the bar: not “smart,” but “done.” (<https://blog.google/innovation-and-ai/products/gemini-app/android-multi-step-tasks/>)

### Perplexity: a computer-using agent… with lots of models inside

TechCrunch covered **Perplexity Computer**, described as a system that unifies capabilities by orchestrating 19 models. That multi-model approach can be pragmatic (use the right tool for the job), but it also multiplies complexity: more moving parts, more edge cases, more ways to accidentally leak context across boundaries.

What I want to see next:

- permissioning that’s explicit (what can it click? what can it buy? what can it delete?)
- robust recovery when a site changes its UI (because it will)
- audits/logs that make it obvious *why* the agent did a thing

Source: <https://techcrunch.com/2026/02/27/perplexitys-new-computer-is-another-bet-that-users-need-many-ai-models/>

### Enterprise tooling keeps inching toward “agent ops”

New Relic launched an **AI agent platform** plus OpenTelemetry-related tooling, per TechCrunch. Observability is one of those unsexy requirements that becomes extremely sexy the first time an agent silently does the wrong thing at 2:13 AM. This category will likely converge on a few primitives: traces, tool-call logs, policy checks, evaluation harnesses, and “blast radius” limits.

Source: <https://techcrunch.com/2026/02/24/new-relic-launches-new-ai-agent-platform-and-opentelemetry-tools/>

## Chips, Compute & Infra

We keep trying to talk about AI like it’s only a model problem. Meanwhile, reality keeps reminding us it’s also a *construction project*.

NVIDIA’s blog highlighted India’s push to build AI infrastructure and models, framing AI compute as national-scale capability. Yes, it’s corporate comms (read with salt). Still, the trend is clear: more countries and large orgs want reliable access to compute, talent, and a domestic ecosystem that doesn’t hinge on one vendor or one geopolitical relationship.

Source: <https://blogs.nvidia.com/blog/india-ai-mission-infrastructure-models/>

A second, quieter compute story sits underneath the agent hype: serving and inference optimization work is becoming a competitive advantage. ISO-Bench (above) is a reminder that “agentic software” is going to be judged on latency, throughput, and cost—because those are the levers that decide whether a cool demo becomes a product.

## Policy, Safety & Regulation

Two Reuters items were the most “tell me where the world is headed” signals this week.

### Safeguards meet procurement reality

Reuters reported that **Anthropic would not remove safeguards** despite a Pentagon request, with language about potentially being labeled a “supply chain risk.” The important shift here is not who’s right; it’s that safety constraints are now being negotiated like contract terms.

If you’re building AI systems for regulated domains (defense, healthcare, finance), assume you’ll need:

- a clear, configurable safety posture
- documented behavior under stress (refusals, escalation, logging)
- a way to prove what happened after the fact

Source: <https://www.reuters.com/sustainability/society-equity/anthropic-rejects-pentagons-requests-ai-safeguards-dispute-ceo-says-2026-02-26/>

### Data sovereignty pressure is also AI pressure

Reuters also reported a U.S. diplomatic pushback against certain data-sovereignty initiatives, arguing they could limit AI and cloud services. The subtext is straightforward: many modern AI deployments depend on cross-border data movement and centralized infra. Regulators want control; companies want scale; users want both privacy *and* convenience. Everyone wants a unicorn that pays taxes.

Source: <https://www.reuters.com/sustainability/boards-policy-regulation/us-orders-diplomats-fight-data-sovereignty-initiatives-2026-02-25/>

## Funding, M&A, Industry

It’s still raining money—sometimes for good reasons, sometimes because investors are allergic to sitting out a hype cycle.

A few Reuters items from the week:

- **Basis** (AI accounting) raised **$100M Series B**, valuing it at **$1.15B**, with the framing that “agentic AI” is pulling investor attention. Accounting is a great testbed: high volume, lots of rules, painful workflow automation, and measurable ROI when it works. (<https://www.reuters.com/business/ai-accounting-startup-basis-raises-100-million-115-billion-valuation-2026-02-24/>)
- **SambaNova Systems** raised **$350M** and signed an **Intel partnership** as it competes in AI infrastructure. The competitive landscape keeps widening: it’s not just Nvidia vs. everyone; it’s “who can offer an end-to-end stack with credible economics.” (<https://www.reuters.com/business/media-telecom/ai-chip-startup-sambanova-raises-350-million-vista-led-round-signs-intel-2026-02-24/>)
- Reuters also reported on a major **OpenAI funding round** involving large strategic investments (Amazon, Nvidia, SoftBank mentioned). This is one of those “if true, it’s era-defining” deals—but also exactly the kind of story where details evolve quickly. Treat early headlines as provisional until filings and official statements land. (<https://www.reuters.com/business/retail-consumer/amazon-invest-50-billion-openai-2026-02-27/>)

My take: the funding wave is both signal and distortion. Signal, because lots of real value is being created. Distortion, because it can make bad unit economics look temporarily charming.

## What Hacker News talked about

HN’s “AI” conversations this week were less about shiny model releases and more about *impact and return*—which feels healthy.

- A thread on a **PwC survey** headline: “56% of CEOs report zero financial return from AI in 2026.” The discussion is a mix of skepticism, war stories, and the recurring theme that adoption is harder than buying tools. (<https://news.ycombinator.com/item?id=47174891>)

If you want one meta-take from HN: people are increasingly allergic to “AI will 10x everything” narratives unless you can point to a workflow, a cost line, and a before/after.

## What to watch next week

A few things I’ll be tracking as we roll into early March:

1. **Agent permissioning becomes a product feature, not a footnote.** The winners will make “what the agent can do” painfully explicit—and easy to revoke.
2. **More realism in evaluation.** Expect a continuing swing toward benchmarks that include files, codebases, and messy context (and away from neat little multiple-choice tests).
3. **Enterprise observability and governance.** Agent platforms without traces, audits, and policy hooks are going to feel like deploying microservices without logs.
4. **Regulatory narratives harden.** The “we’ll figure it out later” era is ending; buyers (especially governments) will demand crisp answers about safeguards and data handling.

## Sources

- Google: Nano Banana 2: <https://blog.google/innovation-and-ai/technology/ai/nano-banana-2/>
- Google (dev): Build with Nano Banana 2: <https://blog.google/innovation-and-ai/technology/developers-tools/build-with-nano-banana-2/>
- Google: Gemini app multi-step tasks: <https://blog.google/innovation-and-ai/products/gemini-app/android-multi-step-tasks/>
- TechCrunch: Google launches Nano Banana 2: <https://techcrunch.com/2026/02/26/google-launches-nano-banana-2-model-with-faster-image-generation/>
- TechCrunch: Perplexity Computer: <https://techcrunch.com/2026/02/27/perplexitys-new-computer-is-another-bet-that-users-need-many-ai-models/>
- TechCrunch: New Relic AI agent platform: <https://techcrunch.com/2026/02/24/new-relic-launches-new-ai-agent-platform-and-opentelemetry-tools/>
- arXiv: APEX-Agents: <https://arxiv.org/abs/2601.14242>
- arXiv: ISO-Bench: <https://arxiv.org/abs/2602.19594>
- arXiv: Agent Behavioral Contracts: <https://arxiv.org/abs/2602.22302>
- NVIDIA blog: India AI mission/infrastructure: <https://blogs.nvidia.com/blog/india-ai-mission-infrastructure-models/>
- Reuters: Anthropic & Pentagon safeguards dispute: <https://www.reuters.com/sustainability/society-equity/anthropic-rejects-pentagons-requests-ai-safeguards-dispute-ceo-says-2026-02-26/>
- Reuters: US diplomats & data sovereignty initiatives: <https://www.reuters.com/sustainability/boards-policy-regulation/us-orders-diplomats-fight-data-sovereignty-initiatives-2026-02-25/>
- Reuters: Basis raises $100M: <https://www.reuters.com/business/ai-accounting-startup-basis-raises-100-million-115-billion-valuation-2026-02-24/>
- Reuters: SambaNova raises $350M, Intel partnership: <https://www.reuters.com/business/media-telecom/ai-chip-startup-sambanova-raises-350-million-vista-led-round-signs-intel-2026-02-24/>
- Reuters: OpenAI funding round: <https://www.reuters.com/business/retail-consumer/amazon-invest-50-billion-openai-2026-02-27/>
- Hacker News thread (PwC survey CEOs/AI returns): <https://news.ycombinator.com/item?id=47174891>
