---
title: "Open Source Tech of the Day: Gitea"
pubDate: 2026-02-24
description: "A lightweight, self-hostable Git platform that feels like a comfy private GitHub."
---

If you’ve ever thought, “I love GitHub/GitLab… but I don’t always want *my* code, issues, and CI living *over there*,” today’s open-source tech is for you.

**Gitea** (pronounced “git-ay”) is a fast, lightweight, self-hosted Git service: repos, pull requests, issues, wikis, releases, and more—packaged in a single app that’s happy on a tiny VPS, a home server, or a Raspberry Pi. It’s the kind of tool that makes you feel like you just reclaimed a little bit of the internet.

## Quick tour

At a high level, Gitea gives you the familiar workflow you already know:

- **Repositories** with branches, tags, protected rules, and access controls
- **Pull requests** with reviews, code comments, and merge checks
- **Issues + projects** (kanban-ish boards) for tracking work without duct-taping spreadsheets
- **Wikis + releases** for docs and shipping artifacts
- **Users/teams/orgs** with fine-grained permissions

If you’ve used GitHub, you’ll recognize most of the shapes immediately—just… smaller, quieter, and under your control.

## Why it’s cool

A few standout reasons Gitea keeps showing up in “best self-hosted stack” lists:

1. **It’s genuinely lightweight.** Gitea is written in Go, runs as a single binary, and is known for being resource-friendly. That means it’s realistic to host it even if your “server” is a modest box in a closet.

2. **You get the “platform” benefits without the platform bloat.** For many teams, you don’t need an everything-suite; you need a place for code + collaboration. Gitea hits that sweet spot.

3. **Easy upgrades and backups.** Because it’s one app with a straightforward data layout (database + repo storage), it’s easier to reason about than a sprawling set of services.

4. **It plays nicely with your existing Git habits.** You can keep using your preferred local workflow (CLI Git, GUI clients, SSH keys), and Gitea just becomes the remote.

Also: there’s something mildly delightful about opening a pull request against yourself on a Sunday afternoon and thinking, “Yep, this is running on my hardware.” It’s the tech equivalent of baking your own bread.

## Who it’s for

Gitea is a great fit if you’re:

- A **solo dev** who wants private repos without subscriptions (or just wants to own the stack)
- A **small team** that needs PRs + issues but doesn’t want a heavyweight install
- A **homelab tinkerer** building a “personal cloud” (Gitea pairs nicely with Tailscale, Caddy, and backups)
- A **classroom / workshop instructor** who wants a local Git server for a lab environment

If you need extremely deep enterprise compliance knobs or a full integrated mega-suite, you might look at other options—but for a lot of people, Gitea is exactly “enough,” which is a compliment.

## Getting started (smallest first step)

The quickest way to *try* Gitea is Docker. Here’s a minimal local run using a single container:

```bash
docker run -d \
  --name gitea \
  -p 3000:3000 \
  -p 2222:22 \
  -v gitea-data:/data \
  gitea/gitea:latest
```

Then open:

- http://localhost:3000

You’ll be walked through initial setup (database choice, admin account, etc.). After that, create a repo, add an SSH key, and push something from a terminal:

```bash
git remote add origin ssh://git@localhost:2222/<you>/<repo>.git
git push -u origin main
```

That’s it—you’re hosting your own “GitHub-like” remote.

*Tip:* If you plan to run this beyond a quick test, use the official Docker Compose example from the docs so you can pin versions and make upgrades boring.

## A couple standout features worth exploring

- **Organizations + teams:** Handy when you want a clean separation between personal projects and shared work.
- **Mirrors:** You can mirror repos from elsewhere (or mirror out), which is great for backups or gradual migration.
- **Webhooks + integrations:** Even if you don’t use Gitea Actions or external CI, webhooks make it easy to wire into whatever you already run.

And if your brain is currently whispering “Could I host this for family projects?”—yes. Gitea is exactly that kind of “sure, why not?” tool.

## Links

- Official docs/home: https://docs.gitea.com/
- GitHub repo: https://github.com/go-gitea/gitea
- Extra: Install with Docker (docs): https://docs.gitea.com/installation/install-with-docker
