---
title: "Open Source Tech of the Day: Caddy"
pubDate: 2026-02-17
description: "A modern web server that makes HTTPS and reverse proxying feel pleasantly boring."
---

If you’ve ever set up a web server and thought, “Why does this feel like assembling IKEA furniture… underwater?”, today’s pick is for you.

## Quick tour

**Caddy** is an open-source web server (and reverse proxy) that’s designed to be *the nice default* for modern web hosting. Its signature move is **automatic HTTPS**: point a domain at your server, tell Caddy what should be served, and it can obtain and renew TLS certificates for you (via ACME) with minimal fuss.

You can use Caddy as:

- a simple static file server
- a reverse proxy in front of your app (Node, Python, Go, Rails, you name it)
- an HTTPS terminator for multiple services
- a “glue layer” for local dev where you want real TLS without hand-rolling certs

Configuration is usually done with a **Caddyfile**, which is intentionally readable. Under the hood Caddy has a powerful JSON config model, but you can ignore that until you need the fancy stuff.

## What problem it solves

A lot of web server setup pain isn’t the server itself — it’s the *ecosystem chores*:

- getting HTTPS right
- managing certificates and renewals
- cleanly proxying to multiple upstream services
- avoiding config drift across environments

Caddy’s philosophy is: **make the secure thing the easy thing**. For many common setups, you can get to “works in production” with dramatically fewer knobs than you’d expect.

## Why it’s cool

Three standout bits that make Caddy feel like it’s from the future (or at least from a timeline where weekends are respected):

1) **Automatic HTTPS (really)**

Most web servers can do TLS. Caddy *owns* TLS. It will:

- obtain certificates automatically
- renew them automatically
- redirect HTTP → HTTPS by default
- handle modern defaults so you’re not spelunking cipher suites unless you want to

2) **Caddyfile ergonomics**

A lot of config formats are either “too magical” or “too verbose.” Caddyfile hits a sweet spot: it reads like a checklist.

Example: serve a site and proxy API calls:

```caddy
example.com {
  root * /var/www/site
  file_server

  reverse_proxy /api/* localhost:3000
}
```

3) **Extensibility without misery**

Caddy has a strong plugin ecosystem. If you need DNS-based certificate challenges (for wildcard certs), authentication middleware, metrics, or extra handlers, there’s a good chance you can add it cleanly.

(Translation: you can keep your config simple until you truly need more.)

## Who it’s for

- **Solo devs and small teams** who want the shortest path from “app runs” to “app is safely on the internet.”
- **Self-hosters and homelabbers** who are tired of babysitting TLS.
- **Platform folks** who need a pragmatic reverse proxy with sane defaults and a modern architecture.
- **Anyone** who has uttered the phrase: “Wait, why is my cert expiring again?”

## Getting started (smallest first step)

The tiniest “try it” is to run Caddy as a local file server.

### Option A: macOS (Homebrew)

```bash
brew install caddy
caddy file-server --listen :8080 --root .
```

Now open: `http://localhost:8080`

### Option B: Docker (works anywhere)

```bash
docker run --rm -p 8080:80 -v "$PWD:/usr/share/caddy" caddy:alpine
```

That will serve the current directory.

### Next tiny step: a one-file reverse proxy

Create a file named `Caddyfile`:

```caddy
:8080 {
  reverse_proxy localhost:3000
}
```

Then run:

```bash
caddy run
```

If you have an app on port 3000, you’ve now got a clean proxy in front of it. From here, adding a real domain is mostly a matter of updating the site address (e.g., `example.com { ... }`) and pointing DNS at your server.

## Practical links

If you want to go from “neat” to “shipping,” these are the best jumping-off points:

## Links

- Official site & docs: https://caddyserver.com/ 
- GitHub repo: https://github.com/caddyserver/caddy
- Extra (guide): https://blog.msar.me/caddy-a-powerful-web-server

---

Caddy is one of those projects that makes you feel slightly suspicious at first — like you’re forgetting a step — and then you realize: no, it’s just *pleasantly* engineered. Secure-by-default isn’t a slogan here; it’s the ergonomics.
