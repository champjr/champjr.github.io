---
title: "Open Source Tech of the Day: D2"
pubDate: 2026-05-27
description: "D2 makes diagrams feel like writing code, which is a lot more fun than dragging boxes around for an hour."
---

If diagramming tools have ever made you feel like you're negotiating with a stubborn whiteboard, D2 might be your escape hatch.

D2 is an open-source language for turning plain text into diagrams. Instead of dragging shapes around in a browser tab and trying to line up arrows with the patience of a watchmaker, you write a few lines of text, hit render, and get clean diagrams for architecture, workflows, sequences, org charts, and more. It is fast, surprisingly readable, and kind of addictive once it clicks.

## Quick tour

At its core, D2 lets you describe relationships in a tiny, friendly syntax:

```txt
api: API Server
worker: Background Worker
db: PostgreSQL

api -> worker: enqueue job
worker -> db: store result
```

That turns into an actual diagram with nodes and arrows, which is exactly the sort of payoff I like from a tool. You type a little, and suddenly your messy mental model has structure.

D2 solves a very common problem: a lot of technical diagrams get stale because they are annoying to update. If changing one arrow means rearranging half the page by hand, people stop maintaining the diagram. But if the diagram is text, it can live next to your code, get reviewed in pull requests, and be updated with normal developer habits.

A couple standout features make D2 more than just “Mermaid, but different.”

First, it has a strong layout engine story. D2 can produce diagrams that look polished without demanding pixel-level babysitting. Second, it supports multiple diagram types well, from flowcharts to sequence diagrams to infrastructure maps. Third, it has a nice theming and styling system, so you can make outputs look clean for docs, presentations, or internal runbooks without turning design work into a side quest.

## Why it’s cool

D2 feels like one of those tools that quietly removes friction from real work.

If you are documenting a system, sketching a deployment plan, explaining an incident path, or mapping a product workflow, the hardest part is often not the thinking, it is wrestling the tool. D2 gets out of the way. That matters.

I also like that it fits naturally into version-controlled documentation. A diagram in text means diffs are understandable, updates are cheap, and your docs can be treated more like code. That is a big win for teams that already live in GitHub or GitLab.

And honestly, there is a tiny bit of delight in watching plain text turn into something presentation-ready. It feels mildly magical, which is a quality I support in software.

## Who it’s for

D2 is a great fit for:

- developers documenting services, data flows, or architecture
- platform and DevOps teams keeping infrastructure diagrams close to the repo
- technical writers who want diagrams generated from source
- founders and product folks who need quick visual explanations without opening a heavyweight design tool

If you love drag-and-drop design and want hand-tuned layouts for every box, D2 may not replace your favorite visual editor. But if you care about speed, repeatability, and diagrams that can survive contact with real engineering workflows, it is a strong pick.

## Getting started

Smallest first step: try the online playground.

Paste a few lines of D2 syntax into the playground, change a node label, add an arrow, and you will understand the value in about two minutes. If you want it locally after that, install the CLI and render a `.d2` file to SVG.

That gives you a lightweight path from “huh, neat” to “okay, this is going in the docs repo.”

## Links

- Official homepage/docs: https://d2lang.com/
- GitHub repo: https://github.com/terrastruct/d2
- Playground: https://play.d2lang.com/
