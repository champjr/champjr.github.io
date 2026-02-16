---
title: "Docker Mastery, Part 1: What Docker Actually Is (and Why It’s Worth Learning)"
pubDate: 2026-02-16
description: "A practical mental model for images, containers, volumes, and why Docker makes dev + deploy less chaotic."
tags: ["docker", "devops", "self-hosting", "containers", "tutorial"]
---

Docker has a funny reputation.

On one side: “It solved my environment problems forever.”

On the other: “I wrote one Dockerfile, summoned three demons, and now my laptop fans are a permanent weather system.”

This series is the path to the first camp.

In Part 1, we’ll build a clear mental model, get Docker installed, run a real container, and understand the handful of concepts that explain 80% of Docker day-to-day.

---

## The 10,000-foot overview

Docker is a toolkit for **packaging and running software in containers**.

A **container** is an isolated process (plus its filesystem + configuration) that runs on your machine. The big idea is that the app gets a predictable environment:

- the right runtime (Node/Python/Go/etc.)
- the right dependencies
- the right OS-level files

…and you don’t have to manually recreate that environment on every laptop, CI runner, or server.

### “But isn’t that just a VM?”

Not exactly.

- A VM virtualizes an entire machine.
- A container is (roughly) “a normal process with extra isolation + a packaged filesystem.”

Containers *feel* VM-like when you use them, but they’re typically lighter weight.

---

## The core mental model: images vs containers

If Docker ever felt confusing, it’s usually because “image” and “container” got blurred.

### Image = the template
A **container image** is a standardized package of *everything needed to run the container*: binaries, libraries, files, and defaults.

Two useful facts from Docker’s own docs:

- **Images are immutable** (you don’t edit them; you build a new one).
- **Images are layered** (each layer is a set of filesystem changes). That’s why you can start from a base image and add your app on top.  
Source: https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-an-image/

### Container = a running instance
A **container** is what you get when you *run an image*.

One image can be used to start many containers.

Think:

- Image = “recipe”
- Container = “meal you actually cooked”

---

## The other three concepts you’ll use constantly

### 1) Ports
Containers have their own network namespace.

If an app inside a container listens on port `3000`, your host machine can’t magically see it.

So you **publish** a port, like:

- host `localhost:3000` → container `3000`

### 2) Volumes
Containers are meant to be disposable.

If you delete a container, the filesystem changes inside it usually go with it. That’s great for reproducibility… and terrible for databases.

So Docker has **volumes**: durable storage managed outside the container’s writable layer.

### 3) Networks
Docker networks let containers talk to each other by name (especially with Compose).

---

## What’s “Docker Engine” vs “Docker Desktop”?

- **Docker Engine** is the underlying client/server system: a daemon (`dockerd`), APIs, and the `docker` CLI. It manages images, containers, networks, and volumes.  
Source: https://docs.docker.com/engine/

- **Docker Desktop** is a packaged experience for macOS/Windows (UI + bundled pieces) that makes running Docker locally smoother.

If you’re on a Mac and you’re starting out: **Docker Desktop is the easiest on-ramp**.

---

## Install (macOS)

1) Install Docker Desktop:

- https://www.docker.com/products/docker-desktop/

2) Verify in Terminal:

```sh
docker version
```

If that prints client/server info, you’re good.

---

## Your first real container (not “hello world”)

Let’s run Nginx (a tiny web server) and publish it to your local machine:

```sh
docker run --rm -p 8080:80 nginx:alpine
```

What that means:

- `docker run` → start a container
- `nginx:alpine` → use the `nginx` image, Alpine variant (small)
- `-p 8080:80` → host port 8080 maps to container port 80
- `--rm` → delete the container when it stops (clean-up)

Now open:

- http://localhost:8080

Stop it with `Ctrl+C`.

### A few inspection commands you should memorize

In another terminal while it’s running:

```sh
docker ps
```

To see images you have locally:

```sh
docker image ls
```

---

## Why Docker is useful (in real life)

### 1) Reproducible dev environments
Your app isn’t “whatever happens to be installed on this laptop.”

It’s: “this Dockerfile builds the environment.”

### 2) Easier local stacks
Running a web app often means:

- app server
- database
- cache
- queue

Docker + Compose turns that into **one command** instead of a weekend of setup notes.

### 3) Clean deploy story
If it runs in a container locally, you can ship that same container to:

- a VPS
- a Kubernetes cluster
- a CI runner
- a managed container platform

Same artifact. Fewer surprises.

---

## The series roadmap: “Mastering Docker”

I’m going to keep each post tight and practical. Here’s the plan:

### Part 1) What Docker is + first container (you are here)
Images vs containers, ports, volumes, install, and a first run.

### Part 2) Dockerfiles that don’t suck
How to write a Dockerfile for a real app (layer caching, `.dockerignore`, multi-stage builds, and avoiding 2GB images).

### Part 3) Docker Compose for sane local stacks
Run app + DB + redis together, container networking, env vars, and common gotchas.

### Part 4) Data persistence (volumes) and backups
How to not lose your database, and how to move data between machines.

### Part 5) Debugging containers without vibes
Logs, exec/shell, inspecting networking, and the 5 commands that save you.

### Part 6) Shipping: from laptop to server
A simple deployment playbook (VPS + reverse proxy), plus what changes in prod.

### Part 7) Security basics you can actually do
Least privilege, image sources, updates, scanning, and how to avoid the dumb mistakes.

(And if you want to go further, we can do an optional “Part 8: Kubernetes vocabulary for Docker people.”)

---

## What to do before Part 2

Do these three things:

1) Install Docker and run the Nginx command.
2) Run `docker ps` while it’s running.
3) Stop it, then run:

```sh
docker image ls
```

If those make sense, you’re ready for Dockerfiles.

## Links

- Docker “What is an image?”: https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-an-image/
- Docker Engine overview: https://docs.docker.com/engine/
- Docker Get Started: https://docs.docker.com/get-started/
