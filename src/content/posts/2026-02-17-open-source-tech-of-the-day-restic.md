---
title: "Open Source Tech of the Day: restic"
pubDate: 2026-02-17
description: "A fast, encrypted, deduplicating backup tool that makes offsite backups boring (in the best way)."
---

If you self-host anything — a server, a NAS, a Raspberry Pi, even just “important folders” on your laptop — you eventually hit the same uncomfortable realization:

> If it isn’t backed up somewhere *else*, it’s not really stored. It’s just waiting to vanish.

Today’s pick is **restic**: a backup tool that’s open-source, scriptable, and built around a simple idea: **backups should be secure by default**.

## Quick tour

**restic** is a command-line backup program that:

- encrypts your backups client-side (before they leave your machine)
- deduplicates aggressively (so repeated files don’t explode your storage bill)
- is fast enough to use regularly
- stores backups in a “repository” that can live in lots of places (local disk, SFTP, many cloud/object stores)

It’s the opposite of “one weird rsync script you found in a gist.” It’s designed for long-term, repeatable use.

## Why it’s cool

### 1) Encryption isn’t a bolt-on

With restic, encryption is foundational. The repository is encrypted, and you need the password/key material to do anything useful with it.

That means:

- backing up to an untrusted location is normal (and safe)
- “offsite” doesn’t have to mean “someone else can read my files”

### 2) Deduplication makes frequent backups practical

A lot of backup pain comes from the “full backup vs incremental backup” dance.

restic largely sidesteps the drama by chunking data and deduplicating it. If 98% of your data is the same as yesterday, your new backup is mostly a metadata update plus a few changed chunks.

The practical result is you can back up more often without treating storage as a luxury item.

### 3) Snapshots you can actually reason about

restic organizes backups as **snapshots**: a point-in-time view of your data.

You can list snapshots, compare them, and restore from a specific one without needing a PhD in “how the backup set is structured.”

### 4) It’s boring automation-friendly software

That’s the highest compliment I can give.

restic is designed for:

- cron/systemd timers
- headless servers
- small scripts
- predictable exit codes
- readable output

In other words: it plays nice with the way real people run backups.

## Who it’s for

restic is a great fit if you’re:

- a self-hoster who wants offsite backups (VPS, NAS, homelab)
- a developer who wants to back up projects + dotfiles + docs with versioned snapshots
- anyone who wants a backup tool that doesn’t treat encryption as “enterprise optional”

If you strongly prefer a GUI-first workflow, restic can still work, but you may want a wrapper tool around it. The core is CLI.

## Getting started (smallest possible first step)

The safest way to start is to back up a single small directory to a local repository, just to learn the workflow.

1) Install restic (see the official install docs for your OS).

2) Initialize a repository (this creates the encrypted backup store):

```bash
restic init --repo /path/to/restic-repo
```

3) Run a first backup of a test folder:

```bash
restic -r /path/to/restic-repo backup ~/Documents/Important
```

4) List snapshots to confirm it worked:

```bash
restic -r /path/to/restic-repo snapshots
```

5) Practice a restore (do this early — restores are the whole point):

```bash
restic -r /path/to/restic-repo restore latest --target /tmp/restore-test
```

Once you’re comfortable, the next “real” step is pointing the repo at an offsite target (SFTP, object storage, another machine you control) and automating the backup schedule.

## Practical tips (learned the hard way)

- **Test restores periodically.** A backup you can’t restore is just expensive self-deception.
- **Keep your repo password somewhere safe.** If you lose it, encryption will do its job: you will not get the data back.
- **Decide your retention policy early.** restic supports pruning/forgetting snapshots — use it so your repo doesn’t grow forever.
- **Back up configurations too.** Photos are great, but your *service configs* and *infra notes* are what make recovery fast.

## Links

- Official site + docs: https://restic.net/
- GitHub repo: https://github.com/restic/restic
- A good starting point in the docs (quick start): https://restic.readthedocs.io/en/stable/020_installation.html
