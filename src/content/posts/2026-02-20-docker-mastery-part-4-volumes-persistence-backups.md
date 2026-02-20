---
title: "Docker Mastery, Part 4: Volumes, Persistence, and Backups"
pubDate: 2026-02-20
description: "Make container data survive restarts, upgrades, and disasters—with a backup plan you’ll actually run."
tags:
  - docker
  - containers
  - devops
  - self-hosting
---

Containers are disposable; data isn’t.

In Parts 1–3, we treated containers like cattle: rebuildable and replaceable. Part 4 is where most self-hosted setups either become reliable… or become a horror story. We’ll cover **how Docker persists data**, when to use **volumes vs bind mounts**, and a couple of **backup patterns** that work on real machines.

## The mental model: images, containers, and writable layers

A running container is:

- **An image** (read-only layers)
- Plus a **writable container layer** (changes you make at runtime)

That writable layer is **not** a persistence strategy. It’s:

- Tied to that specific container
- Easy to accidentally discard (recreate, `docker rm`, `docker compose up --force-recreate`, etc.)
- Painful to backup consistently

If you care about the data, put it in:

- A **volume** (recommended most of the time), or
- A **bind mount** (sometimes useful, sometimes risky)

## Volumes vs bind mounts (and when to use each)

### Named volumes (recommended default)

A named volume is Docker-managed storage (usually somewhere under Docker’s data directory). You reference it by name and Docker takes care of the path.

Good for:

- Databases (Postgres, MySQL, Redis persistence)
- App state (`/var/lib/...`), uploads, caches you want to keep
- Setups you want to move between machines with minimal path fuss

### Bind mounts (use intentionally)

A bind mount maps an existing host path into the container.

Good for:

- Local development source code (hot reload)
- Explicitly placing data on a particular disk or directory you manage
- When you want your backup tool to directly see files in a known host path

Risks/pitfalls:

- Permissions and ownership mismatches are common
- You can accidentally mask container directories (mounting over non-empty paths)
- Path portability is worse (another machine won’t have your exact folder layout)

### tmpfs mounts (for truly ephemeral data)

Some data should never hit disk (or should be short-lived). A `tmpfs` mount stores data in memory.

Good for:

- Sensitive temp files
- Very hot caches where persistence provides no value

Sources:

- Docker storage overview: https://docs.docker.com/engine/storage/
- Volumes: https://docs.docker.com/engine/storage/volumes/
- Bind mounts: https://docs.docker.com/engine/storage/bind-mounts/

## A quick tour of volume operations

List volumes:

```bash
docker volume ls
```

Inspect a volume (where it lives, what uses it):

```bash
docker volume inspect mydata
```

Remove unused volumes (be careful):

```bash
docker volume prune
```

A good rule:

- `prune` is fine on dev machines if you know what you’re doing
- On servers, prune intentionally and ideally with a list of what you’re removing

## Docker Compose: declaring volumes cleanly

Here’s a simple Compose example with a Postgres database and an app:

```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: "change-me"
      POSTGRES_DB: app
    volumes:
      - pgdata:/var/lib/postgresql/data

  app:
    image: myapp:latest
    depends_on:
      - db
    environment:
      DATABASE_URL: "postgres://postgres:change-me@db:5432/app"

volumes:
  pgdata:
```

Notes:

- `pgdata` is a **named volume** declared once at the bottom.
- Compose will create it if it doesn’t exist.
- Your data survives `docker compose down` (unless you add `-v`).

Compose volumes reference:

- https://docs.docker.com/reference/compose-file/volumes/

## Permissions: why “it works on my machine” fails on servers

Containers often run as a non-root user (and they should; we’ll go deeper in Part 7). Persistence introduces a practical problem:

- The process inside the container needs permission to read/write the mounted directory.

### Named volumes are usually easier

Docker creates the storage area for the volume. Many official images also initialize permissions on first run.

### Bind mounts require you to be explicit

If you bind mount `./data:/data`, the host directory ownership/permissions matter.

Common fixes:

- Create the directory and set ownership to the UID/GID the container runs as
- Prefer official images that document required permissions
- Avoid “just run it as root” as a permanent solution

If you’re unsure which user a container runs as:

```bash
docker inspect --format '{{.Config.User}}' <container>
```

Or check the image docs. Many official images document the expected UID/GID.

## Backups: the only plan that counts is one you tested

You don’t have backups because you *intend* to back up. You have backups when:

- They run automatically
- They are stored somewhere safe
- You have performed a restore successfully

### What should you back up?

At minimum, for most self-hosted services:

- Database volumes (or database dumps)
- Application uploads (user-generated content)
- Configuration you can’t easily recreate

Avoid backing up:

- Rebuildable images (you can pull/build again)
- Caches (unless rebuilding them is unusually expensive)

## Backup pattern #1: Database-native dumps (best for databases)

For Postgres, a logical backup via `pg_dump` is portable and generally safer than copying raw files.

Example (run from a one-off container in the same network):

```bash
docker compose exec -T db pg_dump -U postgres -d app > backup-$(date +%F).sql
```

To restore:

```bash
cat backup-2026-02-20.sql | docker compose exec -T db psql -U postgres -d app
```

This approach:

- Produces a file you can store anywhere (S3, Backblaze, another disk)
- Avoids filesystem-level consistency problems

Postgres backup docs:

- https://www.postgresql.org/docs/current/backup.html

## Backup pattern #2: Volume snapshot via a tarball (simple and widely applicable)

For non-database services (or for basic “copy the files” backups), you can archive a named volume by mounting it into a temporary container and tarring its contents.

Example:

```bash
VOLUME_NAME=pgdata
BACKUP_DIR=./backups
mkdir -p "$BACKUP_DIR"

docker run --rm \
  -v ${VOLUME_NAME}:/data:ro \
  -v $(pwd)/${BACKUP_DIR}:/backup \
  alpine:3.20 \
  sh -c "cd /data && tar -czf /backup/${VOLUME_NAME}-$(date +%F).tar.gz ."
```

A few important details:

- `:ro` (read-only) reduces risk of accidental writes.
- This is a filesystem-level backup. For databases, prefer dumps unless you’re sure the DB is stopped or you’re using a proper snapshot mechanism.

To restore a tarball back into a fresh volume:

```bash
VOLUME_NAME=pgdata
ARCHIVE=./backups/pgdata-2026-02-20.tar.gz

docker volume create ${VOLUME_NAME}

docker run --rm \
  -v ${VOLUME_NAME}:/data \
  -v $(pwd):/restore \
  alpine:3.20 \
  sh -c "cd /data && tar -xzf /restore/${ARCHIVE}"
```

## Consistency: don’t back up a moving target

If you copy files while a service is actively writing to them, you may capture an inconsistent state.

Safer options:

- Use database dumps (preferred)
- Stop the service briefly during backup (maintenance window)
- Use storage-layer snapshots (advanced: filesystem or volume-driver snapshots)

For self-hosting, a pragmatic approach is often:

- Nightly database dumps
- Nightly tar backups of uploads/config volumes
- Periodic restore tests

## Migration: moving volumes between machines

When migrating to a new host:

1. Capture backups (dump or tar)
2. Move the backup artifacts to the new machine
3. Recreate Compose stack
4. Restore data into new volumes

This is why named volumes + Compose files are a nice combo: your “infrastructure” is a small config, and your “data” is a set of backup artifacts.

## Checklist you can actually use

- Use **named volumes** for persistent service data by default.
- Use **bind mounts** intentionally (dev source code, explicit host placement).
- Back up **databases with dumps**.
- Back up **uploads/config as files**.
- Automate backups and **test restores**.
- Treat `docker volume prune` as a power tool.

Next up in Part 5: **debugging containers** (logs, `exec`, `inspect`, networking, and the fastest ways to figure out what’s actually wrong).
