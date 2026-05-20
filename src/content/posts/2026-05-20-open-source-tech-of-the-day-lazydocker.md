---
title: "Open Source Tech of the Day: Lazydocker"
pubDate: 2026-05-20
description: "A slick terminal UI for Docker and Docker Compose that turns container wrangling into a much calmer experience."
---

Docker is great right up until you have six containers running, three logs flying by, one restart loop happening somewhere mysterious, and a terminal history full of commands you swear you just used five minutes ago. Lazydocker exists for exactly that moment.

It is an open-source terminal UI for managing Docker and Docker Compose workloads. Instead of juggling `docker ps`, `docker logs`, `docker exec`, `docker compose up`, and a small personal library of container-related muscle memory, Lazydocker gives you one keyboard-friendly dashboard where the usual stuff is easy to see and even easier to do.

## Quick tour

Lazydocker opens into a compact interface that shows your containers, logs, stats, images, volumes, and more in one place. It feels a bit like giving Docker a control panel without leaving the terminal.

A few standout features make it immediately useful:

- **Live container view** so you can quickly spot what is running, stopped, or repeatedly face-planting
- **Log browsing** without bouncing between separate shell commands and windows
- **Common actions on hotkeys** like restart, stop, remove, attach, and inspect
- **Compose-aware workflow** so multi-container projects feel less like command trivia night
- **Custom commands** if you want to wire in your own shortcuts

The main charm here is speed. You are not replacing Docker. You are replacing friction.

## Why it’s cool

A lot of infrastructure tooling gets more powerful by becoming more complicated. Lazydocker pulls in the opposite direction. It takes a very normal developer headache, “I know Docker can do this, but I do not want to remember the exact incantation right now,” and makes the happy path obvious.

That matters whether you are debugging a local app, checking why a service restarted, or just trying to clean up old images without feeling like you are defusing a bomb with shell flags.

Also, it is one of those rare terminal tools that feels both practical and kind. Everything is still text-based, fast, and script-adjacent, but the interface reduces just enough cognitive load that you can spend more brainpower on the app you are actually working on.

## Who it’s for

Lazydocker is a great fit for:

- **Developers** running local multi-container apps
- **Platform and DevOps folks** who want a quick visual pass before reaching for heavier tooling
- **Homelab tinkerers** babysitting services on a mini server, NAS, or VPS
- **Docker beginners** who are still learning the command set and want a friendlier cockpit

If you live in Kubernetes all day, this may not be your main control plane. But for everyday Docker work, it is wonderfully punchy.

## Getting started

The smallest possible first step is to install it and launch it in any environment where Docker is already running.

On macOS with Homebrew:

```bash
brew install lazydocker
lazydocker
```

That is enough.

Open it, move around with the keyboard, select a container, and peek at the logs. You will know within about two minutes whether it deserves a permanent spot in your toolbox.

## Links

- Official site: <https://lazydocker.com/>
- GitHub repo: <https://github.com/jesseduffield/lazydocker>
- Demo video: <https://youtu.be/NICqQPxwJWw>
