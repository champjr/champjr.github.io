---
title: "Open Source Tech of the Day: Podman"
pubDate: 2026-03-05
description: "Daemonless, rootless containers that feel like Docker—without needing a always-on engine."
---

If you like containers but don’t love the idea of a big background daemon holding the keys to your whole machine, today’s pick is **Podman**.

**Podman** is an open-source container engine that lets you **build, run, and manage containers and pods** with a command-line experience that’s intentionally familiar if you’ve used Docker. The twist: Podman is **daemonless** (each command runs as a normal process), and it’s designed to run **rootless** by default (so you can run containers as your regular user without handing everything to `root`).

In practice, Podman tends to feel like “containers, but a little more grown-up about security and architecture.”

## Quick tour

Podman gives you a clean set of primitives:

- **Containers**: run an image, attach to it, exec into it, stop it, remove it
- **Images**: pull/build/tag/push the stuff you run
- **Pods**: a Kubernetes-ish concept where multiple containers share networking and can be managed together

If you’ve typed `docker run …` before, you’ll recognize most of the verbs:

- `podman run` to start a container
- `podman ps` to list running containers
- `podman images` to list images
- `podman build` to build from a Containerfile/Dockerfile

One neat bit: Podman doesn’t need a long-running “engine.” That means fewer moving parts, and fewer “why is the daemon mad today?” moments.

## Why it’s cool

**1) Daemonless = simpler mental model.**

With Podman, the CLI isn’t just a remote control for a privileged background service. When you run a container, **the process tree is visible and understandable**, and the lifecycle is less mysterious.

**2) Rootless containers are the default vibe.**

Running containers as an unprivileged user is a big deal on shared dev machines and laptops. Podman leans into this and makes “least privilege” feel normal rather than heroic.

**3) Pods are surprisingly handy.**

Pods let you group a few related containers (say: app + sidecar + metrics) under one umbrella with shared networking. You don’t always need the full Kubernetes ceremony to benefit from the “tightly-related containers” model.

**4) It plays well with the ecosystem.**

Podman uses **OCI standards** and works with common tools and registries. And for plenty of workflows, you can swap `docker` → `podman` and keep moving (with a few footnotes, but still).

## Who it’s for

- **Developers** who want a container workflow on their laptop without a heavyweight daemon
- **Security-conscious teams** who want fewer privileged components in the default path
- **Linux users** who like building blocks (Podman + Buildah + Skopeo) instead of one monolith
- **Kubernetes-curious folks** who want to experiment with pods locally in a lightweight way

If your day is 80% “run a database container and a web app,” Podman is a great fit. If you’re deep into Docker Desktop-only features, you may need to map a couple concepts first.

## Getting started (smallest first step)

### Option A: Install with Homebrew (macOS)

```bash
brew install podman
podman machine init
podman machine start
```

Then run something simple:

```bash
podman run --rm docker.io/library/hello-world
```

On macOS, Podman uses a lightweight VM (“podman machine”) to provide a Linux environment for containers.

### Option B: Install on Linux

On many distros you can install Podman from your package manager. For example, on Debian/Ubuntu you might use `apt`, and on Fedora you’d use `dnf`.

Once installed, the smallest first step is still the same:

```bash
podman run --rm docker.io/library/hello-world
```

### A tiny “real” example (a web service)

Run Nginx and hit it locally:

```bash
podman run --rm -p 8080:80 docker.io/library/nginx
```

Then visit:

- http://localhost:8080

If you want to see what’s running in another terminal:

```bash
podman ps
```

## Practical notes (the stuff you’ll actually ask)

- **“Do I have to rewrite everything from Docker?”** Usually no. A lot of commands are drop-in similar. You may still run into differences around networking, volumes, and Docker-Compose-specific behaviors.
- **“What about Compose?”** There’s a `podman compose` story (often via a plugin). If you’re Compose-heavy, plan a small trial migration rather than a big-bang switch.
- **“Is rootless slower/weirder?”** Sometimes you’ll bump into edge cases (especially around low ports and certain filesystem behaviors). The upside is worth it for many teams, but it’s good to test your exact workload.

## Links

- Homepage: https://podman.io/
- GitHub: https://github.com/containers/podman
- Extra: Rootless tutorial: https://github.com/containers/podman/blob/main/docs/tutorials/rootless_tutorial.md
