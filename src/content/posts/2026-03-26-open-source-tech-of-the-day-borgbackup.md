---
title: "Open Source Tech of the Day: BorgBackup"
pubDate: 2026-03-26
description: "A fast, deduplicating backup tool that makes versioned backups feel boring—in the best way."
---

Backups are one of those “future me will thank present me” projects… right up until they get fiddly, slow, or expensive enough that you quietly stop doing them.

**BorgBackup** (usually just **Borg**) is an open-source backup tool that’s built to keep backups **fast**, **space-efficient**, and **verifiable**—whether you’re backing up to an external drive, a NAS, or a remote server over SSH.

## Quick tour (what it is)

Borg is a command-line backup program that creates **encrypted, compressed, deduplicated, versioned archives**.

In plain English:

- **Versioned:** You can restore your data as it existed yesterday, last week, or last month.
- **Deduplicated:** If you back up the same large folder every day, Borg only stores the differences. (This is the secret sauce that keeps storage sane.)
- **Encrypted:** Backups can be encrypted end-to-end so your repo is safe even if the destination is not.
- **Remote-friendly:** Back up to another machine over SSH with no special server daemon.

If you’ve ever thought “I want Time Machine vibes, but cross-platform, scriptable, and remote-capable,” Borg is worth a look.

## Why it’s cool

A few standout features that make Borg feel like a power tool rather than a chore:

1) **Content-defined chunking (dedup that actually works well)**

Borg chunks files in a way that’s resilient to shifts in data. That means if a big file changes slightly (or gets a header inserted), Borg can often still deduplicate huge portions instead of treating it like “new file, who dis?”. The end result: **dramatically smaller long-term storage**.

2) **Integrity checks you can (and should) run**

Backups aren’t real until you can trust them. Borg stores cryptographic hashes and provides commands like `borg check` to verify repository integrity. It’s not just “we copied some bytes somewhere.” It’s “we can prove they’re still the same bytes.”

3) **Pruning policies that match how humans think**

Borg’s prune flags make it easy to keep a sensible retention set (e.g., 7 daily, 4 weekly, 12 monthly) without you having to micromanage archive names.

4) **Encryption without drama**

You can encrypt at rest with a repo key or a key stored with the repo (depending on your threat model). The important bit: you can back up to untrusted storage while keeping your data private.

## Who it’s for

Borg is a great fit if you’re:

- A developer or sysadmin who wants **scriptable, automated** backups
- A homelab person with a NAS/server and an SSH-accessible box
- Someone who wants **space-efficient** versioned backups (laptops, photo libraries, big repos)
- The kind of person who enjoys the sentence: “my backups are encrypted and deduplicated”

If you need a GUI-first experience, Borg may feel a bit terminal-heavy—but it’s also the engine behind some friendlier frontends (and there are wrappers like Vorta on desktop).

## Getting started (smallest possible first step)

The tiniest “try it and see” is to create a local repo and make one backup.

### 1) Install Borg

On macOS (Homebrew):

```bash
brew install borgbackup
```

On Debian/Ubuntu:

```bash
sudo apt install borgbackup
```

(Other platforms are covered in the docs.)

### 2) Initialize a repository

Pick a destination folder for the repo:

```bash
mkdir -p ~/Backups/borg-repo
borg init --encryption=repokey ~/Backups/borg-repo
```

Borg will prompt for a passphrase. Save it somewhere safe.

### 3) Create your first archive

Back up something small first (a single folder):

```bash
borg create --stats \
  ~/Backups/borg-repo::first-backup-$(date +%Y-%m-%d) \
  ~/Documents
```

That’s it—you now have a versioned, encrypted archive.

### 4) List archives (sanity check)

```bash
borg list ~/Backups/borg-repo
```

From here you can explore `borg extract` (restore), `borg mount` (browse as a mounted filesystem), and `borg prune` (retention policy).

## Practical tips (the “make it stick” edition)

- **Start with one directory** (Documents, a repo folder, photos) before going full “backup everything.”
- **Automate early:** a simple daily cron/launchd/systemd timer beats a perfect backup plan that you never run.
- **Do a test restore** once, right away. It’s the backup equivalent of checking the parachute.
- **Remote backups are straightforward:** your repo path can be something like `user@server:/path/to/repo` over SSH.

## Links

- Docs / homepage: https://www.borgbackup.org/
- GitHub: https://github.com/borgbackup/borg
- Extra reading (great overview + best practices): https://borgbackup.readthedocs.io/en/stable/quickstart.html
