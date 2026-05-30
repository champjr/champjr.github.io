---
title: "Open Source Tech of the Day: Steampipe"
pubDate: 2026-05-30
description: "Query cloud services, APIs, and SaaS tools with SQL, no data warehouse detour required."
---

If you have ever looked at a pile of cloud APIs and thought, "what if this mess would just let me `SELECT *` in peace?", Steampipe is here with very strong "yes, actually" energy.

Steampipe is an open-source tool that lets you query live data from APIs, cloud platforms, and services using SQL. Instead of exporting data into a warehouse, stitching together one-off scripts, or clicking around five dashboards like you are speedrunning admin panels, you install a plugin and start asking questions with familiar queries.

That means AWS, GitHub, Kubernetes, files, Slack, and a bunch more can start behaving a lot more like tables than tantrums.

## Quick tour

Steampipe's big trick is simple and kind of magical: it maps external systems into SQL tables. Want to inspect GitHub repos, list unencrypted volumes in AWS, find public S3 buckets, or poke around Kubernetes resources? You can do it with queries you already know.

A typical workflow looks like this:

- install Steampipe
- add a plugin for the service you care about
- run a query against live data

So instead of writing a custom script against an SDK just to answer one operational question, you can do something more like:

```sql
select title, url, score
from hackernews_top
limit 10;
```

Or query GitHub issues, AWS instances, or Kubernetes pods with the same overall mental model. That consistency is the real superpower. Once it clicks, you start seeing a lot of "I should script this" tasks as "I should just query this."

## Why it's cool

First, it is zero-ETL by design. You are querying live systems directly, so you skip the whole "pipe data somewhere else first and hope it is fresh" dance.

Second, it makes SQL weirdly fun again. SQL is not glamorous, but it is dependable, expressive, and already sitting in a lot of developers' muscle memory. Steampipe takes that old superpower and points it at modern APIs.

Third, the plugin ecosystem is excellent. There are plugins for major cloud providers, developer platforms, SaaS tools, and even fun stuff like Hacker News. That makes it useful for security checks, inventory, cost reviews, compliance questions, internal audits, and general "what on earth is happening in this account?" moments.

I also like that it scales from tinkering to real work. You can use it locally as a single binary, but it also fits neatly into CI jobs, dashboards, and automation pipelines.

## Who it's for

Steampipe is especially great for:

- platform and DevOps folks who live across too many APIs
- security teams doing audits and posture checks
- cloud engineers who want fast answers without custom glue code
- curious builders who enjoy turning messy systems into queryable ones

If your happy place is somewhere between "spreadsheet brain" and "CLI goblin," this is probably your kind of tool.

## Getting started

The smallest useful first step is to install Steampipe, add one plugin, and run one query.

On macOS, that can be as simple as:

```bash
brew install turbot/tap/steampipe
steampipe plugin install github
steampipe query "select full_name, visibility from github_my_repository limit 5;"
```

That is enough to go from zero to "wait, I can inspect my GitHub world with SQL?" in a couple of minutes.

If GitHub is not your thing, swap in a different plugin, like AWS, Kubernetes, or Hacker News, and follow the same pattern.

## Links

- Official docs: https://steampipe.io/docs
- GitHub repo: https://github.com/turbot/steampipe
- Extra: https://hub.steampipe.io/plugins/turbot/github
