---
title: "Open Source Tech of the Day: Kamal"
pubDate: 2026-03-21
description: "A dead-simple, SSH-powered way to deploy containerized apps to your own servers."
---

If you’ve ever looked at a “simple” deployment guide and somehow ended up with eight services, three YAML dialects, and a mild distrust of your own laptop… today’s open-source pick is for you.

**Kamal** (from Basecamp) is a CLI that deploys web apps as Docker containers to any server you can SSH into. Think “Capistrano for containers,” but with modern ergonomics: it builds your image, pushes it to a registry, provisions Docker if needed, and performs rolling deploys with health checks.

## Quick tour

At a high level, Kamal helps you answer the eternal question:

> “How do I ship this app to a couple of Linux boxes… reliably… without becoming a full-time Kubernetes operator?”

Kamal’s approach is pleasantly pragmatic:

- **SSH is the control plane.** Your servers don’t need an agent or a big management stack. If you can SSH, you can deploy.
- **Your app runs as containers.** The “works on my machine” part gets captured in an image.
- **Rolling deploys + health checks.** New containers come up, get checked, and then traffic shifts.
- **Built-in helpers for common pieces.** Reverse proxy, accessories (like Postgres/Redis), secrets handling patterns, and multi-host setups are first-class.

In practice, you’ll keep a `config/deploy.yml` (or destination-specific variants) that describes:

- your app name and image
- which hosts/roles run which containers
- registry info
- env/secrets patterns
- optional “accessories” (DB, cache, etc.)

Then you run a deploy command and Kamal does the orchestration over SSH.

## Why it’s cool

A few standout reasons Kamal has become a go-to recommendation:

1) **It’s the “own your infrastructure” middle path.**

Kamal shines when you want the control and cost profile of a VPS (or bare metal), but you also want deployments that feel modern and repeatable.

2) **It makes “two servers and a dream” feel professional.**

Rolling deploys, health checks, and role-based hosts are the difference between “I SCP’d a tarball” and “I can sleep after pushing to main.”

3) **The mental model is refreshingly small.**

You don’t need to learn a whole cluster ecosystem. You mostly need to know Docker basics, SSH access, and what you want your process topology to look like.

4) **Great for teams that already ship with Docker.**

If you already have a Dockerfile, you’re a large portion of the way there.

(Also: it’s kind of delightful that the “platform” is just your servers plus SSH. Old-school, but in a good way.)

## Who it’s for

Kamal is a strong fit if you’re:

- a solo dev or small team deploying a Rails/Django/Node/Go app
- moving off a PaaS but not looking to adopt Kubernetes
- running a handful of services on 1–10 hosts
- comfortable managing Linux boxes (or willing to learn the basics)

Less ideal if you need:

- highly dynamic autoscaling across many nodes
- multi-tenant cluster scheduling or complex service meshes
- extremely elaborate deployment policies (K8s is great at this)

## Getting started (smallest possible first step)

The tiniest “try it” step is to install the CLI and read the install page so you understand the moving parts.

1) Install Kamal (Ruby required):

```bash
gem install kamal
```

2) Skim the install docs and prerequisites:

- you’ll need at least one server reachable via SSH
- your app should have a Docker image build path (usually a `Dockerfile`)
- you’ll typically push images to a registry (Docker Hub, GHCR, etc.)

From there, the next “real” step is generating/creating your deploy config (`config/deploy.yml`) and running a first deploy to a single host.

## Links

- Official docs / homepage: https://kamal-deploy.org/
- GitHub repo: https://github.com/basecamp/kamal
- Extra tutorial: https://www.jetbrains.com/help/ruby/tutorial-deploy-a-rails-app-using-kamal.html
