---
title: "Open Source Tech of the Day: Vector"
pubDate: 2026-03-22
description: "A fast, flexible observability data pipeline for collecting, transforming, and routing logs/metrics wherever you want."
---

You know the feeling: you’ve got logs in *three* places, metrics in *two* more, and every team has a different “just ship it to $VENDOR” opinion. **Vector** is the open-source “plumbing layer” that sits between your data sources (apps, hosts, containers, cloud services) and your destinations (your SIEM, your log store, your metrics backend), so you can standardize, clean up, and route observability data **without** rewriting every app or committing your future to one tool.

Vector describes itself as a high-performance observability data pipeline — think **agent + aggregator** that can:

- **Collect** logs/metrics from lots of inputs (files, Syslog, journald, Kubernetes, cloud sources, etc.)
- **Transform** events (parse, enrich, filter, redact, sample, re-shape) using VRL (Vector Remap Language)
- **Route** to many outputs (console, Kafka, Elasticsearch/OpenSearch, Datadog, Splunk, S3, Prometheus remote write, and more)

If that sounds like “Fluent Bit / Logstash / Telegraf vibes”… yes — and Vector is part of that same family of tools. The fun part is how *fast* and *pleasant* it can be once you start composing pipelines like LEGO bricks.

## Quick tour

Vector configurations are typically a single YAML/TOML file composed of three main component types:

1. **Sources**: where data comes from
2. **Transforms**: how data changes on the way through
3. **Sinks**: where data goes

A cute mental model is: **events flow through a directed graph**, not a monolithic “one input → one output” setup. That means you can branch, merge, sample, and route different subsets of data to different places (for cost control, compliance, or sanity).

One standout: **VRL** (Vector Remap Language). Instead of stapling together a dozen regexes and praying, you get a purpose-built language for parsing and manipulating observability events. It has batteries for common formats and lets you do things like:

- Parse Syslog/JSON
- Drop noisy fields
- Add metadata (service/env/region)
- Redact secrets (and yes, you should)
- Route based on severity or source

## Why it’s cool

- **Vendor flexibility without chaos.** Swap backends, add a second destination, or run a migration with parallel output — all without touching app code.
- **Cost control knobs.** Sampling, filtering, and routing are first-class. Ship *everything* to cheap storage, but only errors to your expensive alerting pipeline.
- **Performance-minded.** Vector’s reputation is built on being lightweight and fast, especially compared to some JVM-era “log pipelines that ate the server.”
- **One tool, many shapes.** Run it as a daemon on hosts, as a Kubernetes DaemonSet, as a central aggregator, or both.

(Also: watching a clean pipeline file replace a pile of ad-hoc log shipping scripts is deeply satisfying. Like finally untangling the drawer of mystery cables.)

## Who it’s for

- **Platform / SRE / DevOps folks** who want consistent observability plumbing across environments
- **Teams scaling up** from “tail -f in production” to real log/metric routing
- **Anyone trying to de-risk vendor lock-in** without building their own pipeline framework
- **Homelabbers** who want a single, structured way to get logs from services into a central place

If you only have one app and one destination, Vector might be overkill today — but the minute you have *two* destinations or *three* log formats, it starts paying rent.

## Getting started (smallest possible first step)

The quickest “hello world” is to run Vector with demo logs and print them to your terminal.

### Option A: Docker (zero installs)

1) Create a file called `vector.yaml`:

```yaml
sources:
  demo:
    type: demo_logs
    format: syslog
    count: 20

transforms:
  parse:
    type: remap
    inputs: [demo]
    source: |
      .structured = parse_syslog!(.message)

sinks:
  out:
    type: console
    inputs: [parse]
    encoding:
      codec: json
```

2) Run Vector:

```bash
docker run --rm -it \
  -v "$(pwd)/vector.yaml:/etc/vector/vector.yaml:ro" \
  vectordotdev/vector:latest
```

You should see JSON events printed to stdout — already parsed and structured.

### Option B: Homebrew (macOS)

```bash
brew install vector
vector --version
```

Then point it at a config file with `vector --config vector.yaml`.

## Practical links

- **Official homepage / docs:** https://vector.dev/
- **GitHub repo:** https://github.com/vectordotdev/vector
- **Extra (excellent starting point):** https://vector.dev/docs/setup/quickstart/

---

If you try one “stretch goal” after the hello world: add a transform that **redacts** a field (or samples debug logs), then route errors to one sink and everything else to another. It’s the moment Vector stops being “a log shipper” and starts feeling like a real pipeline.
