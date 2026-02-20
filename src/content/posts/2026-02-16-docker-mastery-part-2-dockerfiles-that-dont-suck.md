---
title: "Docker Mastery, Part 2: Dockerfiles That Don’t Suck (Fast Builds, Small Images, Safer Defaults)"
pubDate: 2026-02-16
description: "Write Dockerfiles that build quickly, ship less junk, and run with safer defaults—without getting fancy."
tags: ["docker", "devops", "containers", "self-hosting", "tutorial"]
---

A bad Dockerfile works… until it doesn’t.

Symptoms you’ve probably seen:

- builds take forever (even when you didn’t change anything)
- images are huge for no reason
- you accidentally ship secrets, `node_modules`, or your entire repo history
- the container runs as root because “that’s what the base image does”

In Part 2, we’ll build a mental model for **how Docker builds images**, then apply a handful of patterns that make Dockerfiles faster, smaller, and less scary.

Series links:
- Part 1: [What Docker actually is](/posts/2026-02-16-docker-mastery-part-1-what-is-docker/)
- Part 2: Dockerfiles that don’t suck (you are here)
- Part 3: [Docker Compose for sane local stacks](/posts/2026-02-18-docker-mastery-part-3-docker-compose-for-sane-local-stacks/)

---

## The key idea: every Dockerfile instruction becomes a cached layer

When you run `docker build`, Docker executes your Dockerfile top-to-bottom. Each instruction (`FROM`, `RUN`, `COPY`, etc.) produces an **image layer**.

Docker can reuse (“cache”) a layer if:

- the instruction is identical, and
- everything it depends on (files copied in, etc.) is identical

So your job is simple:

1) **Put stable steps early** (so they cache)
2) **Copy volatile files late** (so you don’t invalidate the cache)
3) **Don’t send junk to the build context** (use `.dockerignore`)

Source (official): Dockerfile best practices: https://docs.docker.com/build/building/best-practices/

---

## A practical example: a Node app Dockerfile (the “good enough” version)

Let’s say you have a Node app that builds to `dist/`.

Here’s a Dockerfile that’s fast, reasonably small, and safe-by-default for many projects:

```Dockerfile
# syntax=docker/dockerfile:1

FROM node:22-alpine AS build
WORKDIR /app

# 1) Copy only dependency manifests first (better caching)
COPY package.json package-lock.json ./

# 2) Install deps in a cached layer
RUN npm ci

# 3) Now copy the rest of the app
COPY . .

# 4) Build
RUN npm run build


FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Copy only what you need at runtime
COPY --from=build /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

# Run as a non-root user (we’ll explain below)
USER node

EXPOSE 3000
CMD ["node", "dist/server.js"]
```

This Dockerfile uses several “don’t suck” ideas:

- dependency caching (`COPY package*.json` before `COPY . .`)
- multi-stage builds (build artifacts in one stage, minimal runtime in another)
- a non-root user (`USER node`)

Now let’s break those down.

---

## 1) Build caching: copy dependency manifests first

Most projects change app code far more often than they change dependencies.

So instead of:

```Dockerfile
COPY . .
RUN npm ci
```

Do:

```Dockerfile
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
```

That way Docker can reuse the cached layer for `npm ci` across builds where your dependencies didn’t change.

This pattern exists for basically every ecosystem:

- Node: `package.json` / lockfile
- Python: `requirements.txt` / `poetry.lock`
- Go: `go.mod` / `go.sum`
- Rust: `Cargo.toml` / `Cargo.lock`

---

## 2) `.dockerignore`: don’t ship your whole life into the build

Docker build starts by sending a **build context** (files from your directory) to the builder.

If you don’t use `.dockerignore`, Docker may send:

- `.git/` history
- `node_modules/`
- `dist/` from old builds
- `.env` files (danger!)
- local caches and random junk

Make a `.dockerignore`.

A decent starter for many JS projects:

```gitignore
node_modules
npm-debug.log
.yarn
.pnpm-store

dist
build
.coverage

.git
.gitignore

.env
.env.*

Dockerfile
docker-compose.yml
README.md
```

Notes:

- You *can* ignore `Dockerfile` itself; Docker still reads it because you pass it explicitly.
- Be careful ignoring docs/config if your build step needs them.

Source (official): `.dockerignore` file: https://docs.docker.com/build/building/context/#dockerignore-files

---

## 3) Multi-stage builds: build big, run small

Multi-stage builds let you:

- use a “fat” image with build tooling (compilers, dev deps)
- then copy only the artifacts into a smaller runtime image

That’s the difference between:

- shipping *your source code + compiler + build tools*
- shipping *just the compiled output*

Source (official): Multi-stage builds: https://docs.docker.com/build/building/multi-stage/

### Common multi-stage patterns

- Node/TS → compile to `dist/`, ship `dist/` + production deps
- Frontend SPA → build static files, ship them in `nginx:alpine`
- Go → build a static binary, ship it into `scratch` or `distroless`

---

## 4) Reduce image size (without becoming a wizard)

A few reliable, low-effort wins:

### Pick a reasonable base image

- `alpine` is small, but sometimes causes compatibility issues (musl vs glibc, native modules).
- `slim` is often a nice middle ground.

If your app needs native modules or you’re fighting weird TLS/locale/build errors, prefer a Debian/Ubuntu-based image.

### Don’t leave package manager caches behind

If you install OS packages, clean caches in the same layer:

```Dockerfile
RUN apk add --no-cache curl
```

Or for Debian-based images:

```Dockerfile
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*
```

### Keep `RUN` steps cohesive

It’s common to combine related steps into one `RUN` so you don’t leave temporary files behind in earlier layers.

---

## 5) Run as a non-root user (least privilege)

By default many images run as root inside the container.

Even with containers, root is still root *in the container’s namespace*, and “oops” moments get worse when everything runs as root.

You have a few good options:

### Option A: use a base image that already provides a non-root user

The official Node images include a `node` user:

```Dockerfile
USER node
```

### Option B: create your own user

On Alpine:

```Dockerfile
RUN addgroup -S app && adduser -S app -G app
USER app
```

Then make sure files your app needs are readable/writable.

Source (official-ish guidance): Dockerfile best practices (least privilege): https://docs.docker.com/build/building/best-practices/

---

## 6) HEALTHCHECK: basic “are you alive?” signals

A `HEALTHCHECK` lets Docker mark a container as:

- `healthy`
- `unhealthy`

This is useful when you run containers under an orchestrator (Compose, Swarm, Kubernetes, etc.) or you just want an at-a-glance signal.

A simple HTTP healthcheck:

```Dockerfile
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1
```

Notes:

- Your image needs the tool (`wget`/`curl`) installed, or use a tiny script.
- Keep the endpoint cheap and fast.
- Healthchecks don’t magically restart containers by themselves; they provide state that other systems can act on.

Source (official): `HEALTHCHECK` instruction: https://docs.docker.com/reference/dockerfile/#healthcheck

---

## 7) A few sharp edges to avoid

### Don’t bake secrets into images

Common mistakes:

- `COPY . .` includes `.env` (fix with `.dockerignore`)
- `ARG API_KEY=...` then `RUN echo $API_KEY` (that becomes part of image history)

Rule of thumb:

- **build-time**: you shouldn’t need secrets for most builds
- **run-time**: pass secrets via env vars, files, or secret managers

(We’ll go deeper in Part 7: Security basics.)

### Don’t use `latest` in production

Pin versions so rebuilds are predictable:

```Dockerfile
FROM node:22.11.0-alpine
```

Or at least pin major versions.

### Prefer exec-form `CMD`

Use JSON array form so signals and args behave correctly:

```Dockerfile
CMD ["node", "dist/server.js"]
```

Source (official): Dockerfile `CMD`: https://docs.docker.com/reference/dockerfile/#cmd

---

## A “good Dockerfile” checklist

Use this as your quick review:

- [ ] `.dockerignore` exists and excludes `.git/`, deps, build artifacts, and `.env`
- [ ] dependency install happens before copying the whole repo
- [ ] multi-stage build used when there’s a build step or dev tooling
- [ ] runtime image only contains what you need to run
- [ ] container runs as a non-root user
- [ ] healthcheck is present (when it makes sense)
- [ ] base image versions are pinned (at least major)

---

## What’s next (Part 3)

Now that you can build one good image, the next pain point is running a *stack*:

- app + database + cache
- networks
- environment variables
- and the infamous `depends_on` trap

That’s Part 3: **[Docker Compose for sane local stacks](/posts/2026-02-18-docker-mastery-part-3-docker-compose-for-sane-local-stacks/)**.

## Links

- Dockerfile best practices: https://docs.docker.com/build/building/best-practices/
- `.dockerignore` docs: https://docs.docker.com/build/building/context/#dockerignore-files
- Multi-stage builds: https://docs.docker.com/build/building/multi-stage/
- Dockerfile `HEALTHCHECK`: https://docs.docker.com/reference/dockerfile/#healthcheck
- Dockerfile `CMD`: https://docs.docker.com/reference/dockerfile/#cmd
