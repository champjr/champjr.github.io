---
title: "Docker Mastery, Part 3: Docker Compose for Sane Local Stacks (Networks, Env, and the depends_on Trap)"
pubDate: 2026-02-18
description: "Use Docker Compose to run multi-service dev stacks predictably—without brittle startup hacks."
tags: ["docker", "devops", "containers", "self-hosting", "tutorial"]
---

Most apps don’t run alone.

Even in “simple” projects, you quickly end up with:

- an API
- a database
- maybe Redis
- maybe a queue worker
- maybe an admin UI

Docker Compose is the tool that turns that chaos into a single, repeatable command:

```sh
docker compose up
```

In this part, we’ll build a Compose setup that’s boring (in a good way): clear networks, explicit environment configuration, and a realistic approach to startup ordering.

Sources (official):

- Compose overview: https://docs.docker.com/compose/
- Compose file reference: https://docs.docker.com/reference/compose-file/
- Compose specification: https://github.com/compose-spec/compose-spec

---

## Compose mental model: services + networks + volumes

A Compose file describes **services** (containers) and the **resources** they share:

- **networks**: how containers talk to each other
- **volumes**: persistent storage

By default, Compose:

- creates a private network for the project
- adds each service to that network
- provides automatic DNS so services can reach each other by service name

Meaning: if your service is named `db`, other containers can connect to `db:5432`.

---

## Start with a clean `compose.yaml`

Compose now prefers `compose.yaml` at the repo root.

Here’s a minimal but realistic stack: a Node API + Postgres.

```yaml
# compose.yaml
services:
  api:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: "postgres://app:app@db:5432/app"
    depends_on:
      - db

  db:
    image: postgres:16
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
      POSTGRES_DB: app
    ports:
      - "5432:5432"
```

Run it:

```sh
docker compose up --build
```

Stop it:

```sh
docker compose down
```

Tip: add `-v` to remove volumes too (careful):

```sh
docker compose down -v
```

---

## Networking: the “service name is the hostname” rule

Inside the Compose network:

- `db` resolves to the Postgres container
- `localhost` resolves to the current container

So inside `api`, your database host should be `db`, not `localhost`.

### Don’t publish ports unless you need them

In the example above, `db` maps `5432:5432` so you can connect from your laptop.

If you don’t need that, remove it. The API can still reach the database over the internal network.

Compose default networking already isolates your stack from the rest of your machine.

Source (official): Networking in Compose: https://docs.docker.com/compose/how-tos/networking/

---

## Environment variables: pick one approach and stick to it

There are two common patterns:

1) **Inline `environment:` for non-sensitive values**
2) **Use an `.env` file for developer-specific overrides**

### Pattern A: inline `environment:` (simple + explicit)

This is great for values that are okay to commit:

- ports
- service hostnames
- feature flags with safe defaults

### Pattern B: `.env` file (developer-specific)

Compose automatically reads a file named `.env` in the same directory as `compose.yaml`.

Example `.env`:

```dotenv
# .env (do not commit if it contains secrets)
POSTGRES_PASSWORD=app
API_PORT=3000
```

Then reference it in Compose:

```yaml
services:
  api:
    ports:
      - "${API_PORT:-3000}:3000"
  db:
    environment:
      POSTGRES_PASSWORD: "${POSTGRES_PASSWORD}"
```

A few important notes:

- Compose variable substitution happens in the **Compose file**, not inside your container.
- `.env` is not the same as `env_file:`.

Source (official): Environment variables in Compose: https://docs.docker.com/compose/how-tos/environment-variables/

---

## The `depends_on` trap: it doesn’t mean “ready”

This is the biggest Compose footgun.

`depends_on` means:

- start container A before container B

It does **not** mean:

- “wait for Postgres to accept connections”
- “wait for migrations to finish”

So this is common:

- `api` starts
- immediately tries to connect to Postgres
- Postgres is still initializing
- your app crashes or loops

Source (official): `depends_on` semantics: https://docs.docker.com/reference/compose-file/services/#depends_on

### Better option 1: retry in the application

The most reliable fix is in your app:

- retry database connection for (say) 10–30 seconds
- backoff a bit
- log clearly

It’s boring, but it’s the most production-realistic behavior too.

### Better option 2: healthchecks + conditional depends_on (when supported)

Compose supports healthchecks on services (and some Compose implementations support using them for ordering).

Add a healthcheck to Postgres:

```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
      POSTGRES_DB: app
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app -d app"]
      interval: 5s
      timeout: 3s
      retries: 20
```

Then (if your Compose supports it) you can do:

```yaml
services:
  api:
    depends_on:
      db:
        condition: service_healthy
```

If your setup ignores `condition:`, don’t panic—your healthcheck is still useful for visibility.

Source (official-ish): Compose healthcheck: https://docs.docker.com/reference/compose-file/services/#healthcheck

### Avoid “wait-for-it” scripts as your first instinct

They can work, but they often become:

- brittle
- poorly logged
- mismatched with how your app behaves in real deployments

If you do use one, keep it simple and treat it as a temporary dev convenience.

---

## Make your stack maintainable with named volumes (preview of Part 4)

Right now, our Postgres data disappears when the container is removed.

Fix that with a named volume:

```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
      POSTGRES_DB: app
    volumes:
      - db-data:/var/lib/postgresql/data

volumes:
  db-data:
```

Now your data persists across `docker compose down`.

(We’ll go deep on volumes, persistence, and backups in Part 4.)

Source (official): Volumes in Compose: https://docs.docker.com/compose/how-tos/volumes/

---

## A few Compose patterns that keep you sane

### Use `docker compose up -d` for “run in background”

```sh
docker compose up -d --build
```

Then:

```sh
docker compose logs -f api
```

### Prefer `docker compose` (plugin) over `docker-compose` (legacy)

Modern Docker installs use:

```sh
docker compose ...
```

If you see docs using `docker-compose`, they’re often older.

### Add a one-off “migrate” service

Instead of running migrations manually inside `api`, add a dedicated service:

```yaml
services:
  migrate:
    build: .
    command: ["npm", "run", "migrate"]
    environment:
      DATABASE_URL: "postgres://app:app@db:5432/app"
    depends_on:
      - db
```

Then run:

```sh
docker compose run --rm migrate
```

This keeps your main `api` container focused on “run the app.”

### Use profiles for optional tooling

Example: only run an admin UI when you ask for it.

```yaml
services:
  adminer:
    image: adminer:4
    profiles: ["tools"]
    ports:
      - "8080:8080"
```

Run normally:

```sh
docker compose up -d
```

Run with tools:

```sh
docker compose --profile tools up -d
```

Source (official): Profiles: https://docs.docker.com/compose/profiles/

---

## Quick checklist

When your Compose stack feels “flaky,” ask:

- [ ] Are services connecting to `db`, `redis`, etc. (service names), not `localhost`?
- [ ] Did you accidentally publish ports you don’t need?
- [ ] Are env vars managed consistently (`environment:` vs `.env`)?
- [ ] Are you relying on `depends_on` as a readiness check?
- [ ] Do critical services have healthchecks?
- [ ] Do you persist stateful data with a named volume?

---

## What’s next (Part 4)

Now that you can run a stack, the next question is: **what happens to your data?**

Part 4 is all about:

- volumes
- persistence
- backup/restore basics

## Links

- Docker Compose overview: https://docs.docker.com/compose/
- Compose file reference: https://docs.docker.com/reference/compose-file/
- Compose networking: https://docs.docker.com/compose/how-tos/networking/
- Compose environment variables: https://docs.docker.com/compose/how-tos/environment-variables/
- `depends_on`: https://docs.docker.com/reference/compose-file/services/#depends_on
- `healthcheck`: https://docs.docker.com/reference/compose-file/services/#healthcheck
- Compose volumes: https://docs.docker.com/compose/how-tos/volumes/
- Compose profiles: https://docs.docker.com/compose/profiles/
