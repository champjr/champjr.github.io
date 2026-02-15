---
title: "Open Source Tech of the Day: Caddy"
pubDate: 2026-02-15
description: "A web server you can actually enjoy configuring: automatic HTTPS, sane defaults, and a one-file setup." 
---

If you’ve ever set up a hobby site and immediately got dragged into the swamp of:

- certificate requests
- renewals
- redirects
- “why is HTTP still open?”
- reverse proxy config sprawl

…today’s open-source pick is for you.

## Quick tour

**Caddy** is a modern web server and reverse proxy that’s famous for one killer feature:

**automatic HTTPS** (including certificate provisioning + renewal) with configuration that’s *shockingly* small.

A typical “I want HTTPS + a reverse proxy” setup can be as simple as a `Caddyfile` like:

```caddy
example.com {
  reverse_proxy localhost:3000
}
```

You point DNS at the box, run Caddy, and it handles the TLS plumbing.

## Why it’s cool

A few reasons Caddy has become the default “front door” for a lot of self-hosters:

1) **HTTPS by default**

Caddy’s opinionated stance is: secure should be the default, not an optional add-on.

2) **Reverse proxy ergonomics**

If you run multiple services (blog + home automation + dashboards + random side projects), a reverse proxy is the traffic controller. Caddy makes that controller *pleasant*.

3) **Great for small deployments**

For a single VPS, a homelab box, or a Mac mini sitting on your network, the setup is straightforward and the config stays readable.

4) **Modern features without the pain**

HTTP/2 and HTTP/3 support, sane defaults, clean logs, and a strong plugin story.

## Who it’s for

- People self-hosting: **Home Assistant**, **Plex/Jellyfin**, **Immich**, **Nextcloud**, dashboards, etc.
- Anyone deploying a small web app and wanting a clean HTTPS reverse proxy
- Folks who want something simpler than “hand-roll Nginx config for every service”

## Getting started (fast)

On macOS with Homebrew:

```sh
brew install caddy
caddy version
```

Run it with a config:

```sh
caddy run --config Caddyfile
```

(You’ll want a real domain + DNS pointing at your server to get the full auto-HTTPS magic.)

## Links

- Official site / docs: https://caddyserver.com/
- GitHub repo: https://github.com/caddyserver/caddy
- Caddyfile reference: https://caddyserver.com/docs/caddyfile
