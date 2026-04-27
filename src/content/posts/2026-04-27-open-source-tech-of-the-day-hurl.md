---
title: "Open Source Tech of the Day: Hurl"
pubDate: 2026-04-27
description: "A delightfully plain-text HTTP tool that lets you send requests, chain workflows, and test APIs without building a shrine to shell quoting."
---

If curl is the Swiss Army knife you already respect, Hurl is the friend who shows up with labels, checklists, and a much better testing story.

Hurl is an open-source command line tool for running and testing HTTP requests from plain text files. You write requests in a human-readable format, optionally add assertions about the response, and then run the file like a little API script. That means it can act as a request runner, a smoke-test tool, a lightweight API test suite, or a neat way to document an HTTP workflow without forcing everyone into a GUI.

## Quick tour

The core idea is wonderfully simple: put your requests in a text file, then describe what success looks like right next to them.

A tiny Hurl file might say “GET this endpoint, expect a 200, confirm a JSON field equals RUNNING,” and that is already enough to turn a manual check into a repeatable test. From there it scales up nicely:

- **Chain multiple requests** in one file for login flows, multi-step APIs, and setup-plus-verify sequences
- **Capture values** from one response and reuse them later, which is great for tokens, IDs, and session data
- **Assert on status codes, headers, JSON, XML, HTML, and timings** without bolting together five other tools
- **Use it in CI** so an API check can live in version control instead of only in somebody’s memory or browser tab

Because Hurl is text-first, it is also surprisingly readable. A Hurl file doubles as living documentation. You are not just testing an endpoint, you are showing future-you how the system is supposed to behave.

## Why it’s cool

What makes Hurl cool is that it sits in a sweet spot between raw power and low ceremony.

Sometimes Postman-style tools are great, especially for exploration. But once you want something reviewable, scriptable, and easy to keep in a repo, a plain text format starts looking very smart. Hurl gives you that without making you drop all the way down to giant bash scripts with heroic amounts of escaping.

I also like that it is built around real-world API work, not just toy examples. It handles REST, GraphQL, SOAP, HTML checks, and response assertions in one place. It can even validate performance-ish details like response time. That makes it useful for developers, QA folks, SREs, and anyone who has ever muttered “I just want to verify the thing works” while opening too many tabs.

And honestly, there is something satisfying about an HTTP test file you can read in thirty seconds. No mystery collection exports. No clicking through seven panels. Just requests, expectations, and vibes.

## Who it’s for

Hurl is especially handy for:

- developers testing APIs during local work
- teams that want simple HTTP smoke tests in CI
- QA engineers who prefer readable test artifacts
- DevOps and platform folks checking health endpoints or auth flows
- curious tinkerers who want more structure than curl, but less overhead than a heavyweight test stack

If you live in the terminal and like tools that behave like tools, Hurl is very easy to root for.

## Getting started

The smallest first step is to install Hurl, create a file with one request, and run it.

For example, make a file like `health.hurl` with a `GET` request to a public endpoint and an `HTTP 200` expectation, then run `hurl health.hurl`. That is enough to feel the whole model click into place.

If you want the quickest guided path, the official “Your First Hurl File” tutorial is the best next stop.

## Links

- Official homepage/docs: <https://hurl.dev/>
- GitHub repo: <https://github.com/Orange-OpenSource/hurl>
- Extra guide: <https://hurl.dev/docs/tutorial/your-first-hurl-file.html>
