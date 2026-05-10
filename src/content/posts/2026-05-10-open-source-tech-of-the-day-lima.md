---
title: "Open Source Tech of the Day: Lima"
pubDate: 2026-05-10
description: "A delightfully practical way to run Linux virtual machines on macOS, with file sharing and port forwarding that feel almost suspiciously easy."
---

If you use a Mac but keep finding yourself wanting a real Linux environment, Lima is a very charming answer to that problem. The name stands for Linux Machines, and the pitch is simple: launch a Linux VM on macOS with sane defaults, automatic file sharing, and port forwarding that does not make you feel like you are negotiating with three different control panels.

It is a little bit “WSL2 energy, but for Mac,” and I mean that as a compliment.

## Quick tour

Lima is an open-source project for running Linux virtual machines, especially on macOS. Under the hood it uses virtualization tooling like QEMU or Apple’s Virtualization.framework, but the user experience is much friendlier than “please become a part-time VM admin.”

A few standout features:

- **Automatic file sharing** between your host and guest, so your project files are easy to reach.
- **Automatic port forwarding**, which is a huge quality-of-life win when you are running dev servers, containers, or databases.
- **Template-based VM setup**, with ready-made options for Ubuntu, Debian, Alpine, Fedora, Arch, and more.
- **Great container story**, including strong support for containerd and compatibility with tools built around local container workflows.
- **Multi-architecture flexibility**, which matters if you bounce between Intel and Apple Silicon worlds.

That combination makes Lima feel less like “I spun up a VM” and more like “I added a Linux lane to my laptop.”

## Why it's cool

Lima solves a very specific but very common developer annoyance: sometimes macOS is the nice everyday desktop, but Linux is still the place where certain tools, scripts, containers, and server-shaped habits feel most natural.

You could use a heavyweight desktop VM app. You could rent a remote box. You could keep muttering “it works in prod” under your breath. Or you could let Lima put a lightweight Linux environment right next to your normal Mac workflow.

What makes it especially cool is how much friction it removes. File sharing and networking are usually where VM setups start acting like they were designed by a committee of goblins. Lima turns those into defaults. That means less time fiddling with mounts and forwarded ports, and more time actually using the Linux environment for builds, containers, testing, or weird little experiments you probably started after reading one blog post too many.

It also sits in a sweet spot between power and approachability. You can absolutely go deeper, customize templates, and tune behavior, but the first experience is refreshingly uncluttered.

## Who it's for

Lima is a great fit for:

- Mac developers who want a local Linux environment without a giant VM stack,
- people working with containers who want a clean foundation under the hood,
- folks testing scripts or apps that behave better on Linux,
- tinkerers who like having a real Linux machine one command away.

If you already live happily inside remote dev boxes all day, Lima may be optional. If you want Linux on your Mac without turning setup into a side quest, it is very much your kind of tool.

## Getting started

Smallest possible first step: install Lima, then start the default VM.

On macOS with Homebrew:

```bash
brew install lima
limactl start
```

After the VM is ready, jump into it with:

```bash
lima
```

That is the magic moment. You go from “I am on my Mac” to “hello, Linux shell” with very little ceremony.

## Links

- [Official docs](https://lima-vm.io/docs/)
- [GitHub repo](https://github.com/lima-vm/lima)
- [Installation guide](https://lima-vm.io/docs/installation/)
