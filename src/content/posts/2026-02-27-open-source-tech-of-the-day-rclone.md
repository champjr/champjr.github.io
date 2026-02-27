---
title: "Open Source Tech of the Day: rclone"
pubDate: 2026-02-27
description: "A fast, scriptable Swiss-army knife for syncing and moving files across cloud storage providers."
---

If you’ve ever said “I just want my files *there* to also be *here*” (and you’d like that to keep working even when a vendor UI redesigns itself into a maze), today’s pick is **rclone**.

**rclone** is an open-source command-line tool that syncs, copies, moves, and mounts files between your machine and a huge list of cloud/object storage providers (Google Drive, S3, Backblaze B2, Dropbox, OneDrive, WebDAV, SFTP… the list goes on). It’s like `rsync`, but fluent in cloud.

## Quick tour

At its core, rclone gives you a consistent interface for lots of different “remotes.” Once you’ve configured a remote (say, an S3 bucket or a Google Drive), you can:

- **Sync** a folder up or down (with safety flags so you don’t nuke anything by accident)
- **Copy** data without deleting at the destination
- **Move** data (copy + delete source)
- **List** and **query** files on remote storage
- **Mount** supported remotes as a filesystem (handy for browsing)

A couple commands to get the vibe:

```bash
# See what remotes you have configured
rclone listremotes

# List files in a remote path
rclone ls myremote:some/path

# Copy a local folder up to cloud storage
rclone copy ./Photos myremote:backup/Photos

# Mirror local → remote (adds/updates, and can delete extras on the remote)
rclone sync ./Documents myremote:backup/Documents
```

## Why it’s cool

1) **One tool, many providers**

Cloud vendors love building slightly different “sync” experiences. rclone smooths that out: once you know the rclone verbs (`copy`, `sync`, `move`, `ls`), you can switch providers without re-learning the whole workflow.

2) **It’s built for automation**

rclone is happiest in scripts and cron jobs. It has flags for:

- **Dry runs** (`--dry-run`) so you can preview changes
- **Progress + stats** (`--progress`, `--stats`) so long transfers aren’t a black box
- **Bandwidth limiting** (`--bwlimit`) so backups don’t obliterate your Zoom call
- **Retries + checks** to survive flaky networks

3) **It scales from “tiny personal backup” to “serious data plumbing”**

You can use it to back up a single folder to B2… or to move terabytes between object stores with sensible concurrency controls.

(And yes: it’s the kind of tool where you feel 10% more competent just having it installed.)

## Who it’s for

- **Developers & sysadmins** who want repeatable, scriptable backups and transfers
- **Data folks** moving datasets between machines and buckets
- **Photographers/creators** who need a reliable “copy everything to cold storage” routine
- **Anyone migrating cloud providers** (or keeping multiple copies so you’re not locked in)

## Getting started (smallest first step)

Install rclone, then run the interactive config wizard to set up your first remote.

### macOS (Homebrew)

```bash
brew install rclone
rclone config
```

When `rclone config` asks what provider you want, pick the service you already use (S3/Drive/Dropbox/etc.), follow the auth prompts, then try:

```bash
rclone lsd myremote:
```

That command lists directories at the remote root—an easy “did I connect successfully?” check.

### Tiny safety tip

Before you run `sync` the first time, test with:

```bash
rclone sync ./SomeFolder myremote:backup/SomeFolder --dry-run
```

If the dry run output looks right, remove `--dry-run` and let it rip.

## Links

- Homepage / docs: https://rclone.org/
- GitHub: https://github.com/rclone/rclone
- Extra: https://rclone.org/commands/rclone_sync/
