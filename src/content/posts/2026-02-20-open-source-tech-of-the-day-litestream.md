---
title: "Open Source Tech of the Day: Litestream"
pubDate: 2026-02-20
description: "Stream SQLite changes to object storage so your tiny app can have real backups (and quick restores)."
---

SQLite is the ultimate “small app” database: one file, zero servers, absurdly reliable. The catch is also the charm: it’s *a file*. If you deploy on a single VM, a Raspberry Pi, or a tiny container and that disk goes sideways, your “database” goes with it.

**Litestream** is a delightfully pragmatic open-source tool that solves this exact problem:

- it watches your SQLite database,
- streams changes as they happen,
- and continuously replicates them to object storage (S3, Google Cloud Storage, Azure Blob, etc.).

So you get the simplicity of SQLite *plus* the safety net of off-machine, point-in-time backups.

## Quick tour

At a high level, Litestream sits next to your app and treats your SQLite DB like a write-ahead log pipeline.

- Your app writes to SQLite as usual.
- Litestream tails the SQLite WAL (write-ahead log).
- It uploads segments to your chosen replica destination.
- When you need to recover, you can restore the latest snapshot + replay WAL segments up to a specific point.

This isn’t trying to turn SQLite into a distributed database. It’s making “one-file DB” deployments survivable in the real world.

### Standout features

**1) Continuous replication without changing your app**

No code changes, no “use our library,” no special API. If you can point Litestream at a SQLite file, you’re in business.

**2) Realistic disaster recovery for small deployments**

Accidentally `rm`’d a volume? Bad host? Corrupt disk? Restore from object storage and you’re back. For a lot of solo devs and internal tools, this is the difference between “oops” and “oh no.”

**3) Point-in-time restore (aka: rewind the oops)**

Because Litestream is capturing WAL segments, you can often restore to a specific time (depending on your retention and how you manage snapshots).

**4) Object storage as the backup brain**

Instead of running a backup server, you lean on the boring reliability of S3/GCS/Azure. It’s not flashy, but it’s exactly the kind of boring you want on backup day.

## Why it’s cool

There’s a whole category of apps that are “too important to lose” and yet not important enough to justify running Postgres + replicas + managed backups + a weekend learning curve.

Litestream hits the sweet spot:

- You keep shipping a simple app.
- You don’t introduce a database fleet.
- You still get off-site backups and fast restores.

It’s the kind of tool that makes you feel like you leveled up your reliability… without turning your hobby project into a part-time SRE job.

## Who it’s for

- **Indie makers** shipping small SaaS or prototypes on a single VM
- **Homelab folks** running “one box” services where the data matters
- **Internal tools teams** who picked SQLite on purpose (and want to keep it)
- **Edge / on-device** setups where SQLite is perfect but disks are imperfect

If you already run a managed Postgres with automated PITR and multi-AZ replicas, Litestream might be redundant. But if you’re in the SQLite sweet spot, it’s a power-up.

## Getting started (smallest first step)

The tiniest “try it” is:

1) Install Litestream
2) Point it at a local SQLite DB
3) Replicate to an object storage bucket

A minimal run usually looks like:

```bash
# (Example) Run replication with a config file
litestream replicate -config /path/to/litestream.yml
```

Your `litestream.yml` defines the database path and your replica destination (for example, an S3 bucket URL). Start replication, then make a few writes to your SQLite DB and confirm objects are appearing in your bucket.

When you want to test recovery, Litestream also provides restore commands so you can practice the “oh no” workflow *before* you need it.

Tip: do a dry-run recovery on a fresh machine/container. Backups you’ve never restored are just hopeful vibes.

## Links

- Official homepage/docs: https://litestream.io/
- GitHub repo: https://github.com/benbjohnson/litestream
- Extra (guide): https://litestream.io/guides/s3/
