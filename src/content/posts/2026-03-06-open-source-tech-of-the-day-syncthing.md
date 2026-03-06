---
title: "Open Source Tech of the Day: Syncthing"
pubDate: 2026-03-06
description: "A private, peer-to-peer file sync tool that keeps your folders identical across devices—no cloud account required."
---

If you’ve ever wished Dropbox/Drive worked like a dumb, reliable cable between your devices (but over the internet, and on your terms), meet **Syncthing**.

Syncthing is an **open-source, peer-to-peer folder sync** tool. You pick one or more folders, decide which devices you trust, and Syncthing keeps everything in sync: your laptop ↔ desktop, home server ↔ phone, or a small cluster of machines that just need to agree on “the truth”.

No accounts. No “please upgrade your storage.” No mystery web UI you didn’t ask for. Just your devices, your data, and a sync engine that’s been battle-tested for years.

## Quick tour

At a high level, Syncthing is simple:

- **Devices**: Each Syncthing install is a device with a unique ID.
- **Folders**: You define folders you want synced (e.g., `~/Notes`, `~/Photos/Shared`, `~/Projects/Docs`).
- **Sharing**: You explicitly share folders with specific devices.
- **Discovery + transport**: Devices find each other (on LAN and/or via discovery services) and sync directly using encrypted connections.

You manage it through a friendly local web UI (usually at `http://localhost:8384`) where you can:

- add a device by scanning/copying its ID
- share a folder and set a path on each device
- see file changes, sync progress, and conflicts
- tune how aggressive it should be about bandwidth/CPU

Syncthing is not trying to be a “cloud drive.” It’s a **synchronization layer**. Think of it as a really smart, automated `rsync` that keeps running.

## Why it’s cool (a few standout features)

### 1) It’s private by design
Syncthing syncs **device-to-device**. Your files don’t have to live on someone else’s server. Connections are encrypted, and the trust model is explicit: devices you approve can talk; everything else can’t.

### 2) It’s fast on a home network, and surprisingly capable off-LAN
On the same LAN it’s often blazing. When you’re off-network, it can still sync (depending on your network situation) thanks to discovery and relay options.

### 3) It behaves like a tool, not a platform
This is one of my favorite vibes in open source: Syncthing feels like infrastructure you can rely on. It’s happy running quietly in the background on macOS, Linux, Windows, NAS boxes, and little servers.

### 4) It’s practical for real workflows
Some common “this is why I installed it” use cases:

- Keep a **“drop folder”** synced between work and personal machines.
- Sync a **second brain / notes** folder across devices without a proprietary format.
- Mirror a folder from a laptop to a **home server for backup-ish redundancy** (still do real backups, but this helps).
- Share a folder between two people or a small team when you want simple file sync without a hosted service.

## Who it’s for

Syncthing is a great fit if you:

- want **cloud-like sync without a cloud account**
- have multiple machines and want them to “just share files”
- run a **home lab** and like owning your data paths
- need a simple way to keep folders aligned across OSes

It’s *less* ideal if you specifically need:

- multi-user permissions, audit logs, and enterprise admin controls
- “share a link to a file with the public internet” workflows (that’s more a cloud drive thing)
- collaboration features like simultaneous document editing

## Getting started (smallest first step)

The smallest “try it and see” loop is: install Syncthing on two devices, sync one test folder.

### Option A: macOS (Homebrew)

1. Install:

```bash
brew install syncthing
```

2. Run it:

```bash
syncthing
```

3. Open the UI:

- Visit `http://localhost:8384`

Now do the same on a second device, then:

- On Device 1: **Add Remote Device** → paste Device 2’s ID
- On Device 2: accept the device
- Create a new folder on Device 1 (e.g., `Syncthing-Test`) and share it with Device 2

Drop a file in the folder and watch it show up on the other machine. That moment never gets old.

### Option B: Linux (package managers)

Most distros package Syncthing. The official docs have distro-specific instructions.

### A tiny tip
Start with a folder of **non-critical stuff** (like a small notes folder or a scratch directory). Once you like how it behaves, expand from there.

## Practical links

If you want to go deeper after the first sync, these are worth your time:

- How device discovery works, and what to do when devices can’t see each other.
- Folder types and conflict handling (Syncthing is careful, but it helps to know the model).
- Running Syncthing as a service (so it starts on boot) on your OS of choice.

## Links

- Homepage: https://syncthing.net/
- GitHub: https://github.com/syncthing/syncthing
- Getting Started guide: https://docs.syncthing.net/intro/getting-started.html
