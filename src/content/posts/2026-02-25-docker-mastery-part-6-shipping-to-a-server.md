---
title: "Docker Mastery, Part 6: Shipping to a Server (Without Regret)"
pubDate: 2026-02-25
description: "A simple, boring deployment flow for Docker Compose apps on a VPS: reverse proxy, TLS, updates, and rollbacks." 
tags:
  - docker
  - containers
  - devops
  - self-hosting
---

Local Docker is fun. Shipping is where things get real.

This post is a **practical, minimal workflow** for deploying a Docker Compose stack to a VPS (or any Linux server) without turning it into an unmaintainable science project.

We’ll cover:

- A sane “single-host” deployment layout
- Reverse proxy + TLS (the right way to expose services)
- Safe update patterns (and what “rollback” realistically looks like)
- A few guardrails that prevent 80% of self-hosting pain

If you’re running a complex fleet, you’ll eventually want orchestration (Kubernetes, Nomad, etc.). But for many apps, **one well-run Compose host is plenty**.

## The target: one host, one stack, one entrypoint

A simple architecture that scales surprisingly far:

- Your app services run in a **private Docker network**
- Only a **reverse proxy** publishes ports to the internet (80/443)
- The reverse proxy forwards to internal services by service name
- Data lives in Docker volumes
- Updates are done with `docker compose pull && docker compose up -d`

Keep it boring. Boring is reliable.

## Step 1: Prepare the server (minimum viable hardening)

Assume a fresh Ubuntu/Debian VPS. You’ll want:

1. SSH access
2. Docker Engine + Compose plugin
3. A firewall that only exposes what you intend

### 1.1 Install Docker (official method)

Use Docker’s official install docs for your distro:

- Engine install overview: https://docs.docker.com/engine/install/

Verify:

```bash
docker --version
docker compose version
```

### 1.2 Firewall: expose 22, 80, 443 (and nothing else)

If you’re using UFW:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

If you run databases on the same host (Postgres, Redis), **do not publish their ports** to the internet. Keep them internal-only on the Docker network.

Docker and UFW interactions can be subtle; if you’re relying on UFW for policy, read:

- Docker and iptables: https://docs.docker.com/engine/network/packet-filtering-firewalls/

## Step 2: Choose your deployment shape

There are two common “good” approaches for a single host.

### Option A (recommended): build images in CI, pull on the server

Flow:

- CI builds and pushes images to a registry (Docker Hub, GHCR, etc.)
- Server only pulls versioned images

Pros:

- Server stays clean (no build toolchain needed)
- Faster deploys and consistent builds
- Rollback is just “use the previous tag”

### Option B: build on the server

Flow:

- You `git pull` on the server
- `docker compose build`

Pros:

- Simple if you’re just starting

Cons:

- Slower
- More moving parts on the server

If you can, prefer **Option A**.

## Step 3: A Compose file that’s “server-ready”

A few principles:

- Put public traffic behind a reverse proxy
- Use an internal network for app-to-app
- Persist state in volumes
- Keep config in environment variables (or env files)

Here’s a skeleton pattern (not a full app):

```yaml
services:
  proxy:
    image: caddy:2
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - caddy_data:/data
      - caddy_config:/config
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
    networks:
      - public
      - internal
    restart: unless-stopped

  app:
    image: ghcr.io/you/your-app:2026-02-25
    environment:
      - NODE_ENV=production
      - PORT=3000
    expose:
      - "3000"
    networks:
      - internal
    restart: unless-stopped

networks:
  public:
  internal:
    internal: true

volumes:
  caddy_data:
  caddy_config:
```

Notes:

- `internal: true` prevents containers on that network from being directly reachable from outside Docker.
- `expose` documents the port for service-to-service traffic. It does **not** publish ports to the host.
- `restart: unless-stopped` is a sensible default for server services.

Compose reference:

- Compose file: https://docs.docker.com/reference/compose-file/

## Step 4: Reverse proxy + TLS (use Caddy or Nginx)

Your app should not be the thing doing TLS, certificate renewals, and HTTP/2 details.

A reverse proxy gives you:

- Automatic HTTPS
- A single place for domains + routing
- Consistent logs/timeouts
- The option to add auth / rate limits / headers later

### 4.1 Caddy (my favorite for small servers)

Caddy can automatically get and renew certificates.

Example `Caddyfile`:

```text
example.com {
  encode gzip

  reverse_proxy app:3000
}
```

Caddy docs:

- https://caddyserver.com/docs/

### 4.2 Nginx (classic, extremely common)

Nginx is great, but you’ll usually pair it with something for certificates (e.g., Certbot) unless you’re using a distro integration.

Nginx docs:

- https://nginx.org/en/docs/

Docker’s general “run a reverse proxy” guidance:

- https://docs.docker.com/config/containers/container-networking/

## Step 5: A deployment directory layout that won’t rot

On the server, create a stable directory for the stack:

```bash
sudo mkdir -p /opt/myapp
sudo chown -R $USER:$USER /opt/myapp
cd /opt/myapp
```

Keep these files there:

- `compose.yaml`
- Proxy config (e.g., `Caddyfile`)
- Optional: `.env` (be careful with secrets)

Then deploy with:

```bash
docker compose pull
docker compose up -d
```

View status:

```bash
docker compose ps
```

Follow logs:

```bash
docker compose logs -f --tail 200
```

## Step 6: Updates you can trust

A safe update loop:

1. Pull new images
2. Recreate containers
3. Verify health
4. If broken, roll back to the previous tag

### 6.1 The basic update

```bash
docker compose pull
docker compose up -d
```

If you want to remove old images occasionally:

```bash
docker image prune
```

Docs:

- `docker compose pull`: https://docs.docker.com/reference/cli/docker/compose/pull/
- `docker compose up`: https://docs.docker.com/reference/cli/docker/compose/up/

### 6.2 Healthchecks make deploys less scary

If your app supports a health endpoint, wire it into the image (or Compose) so Docker can tell you when it’s actually ready.

Dockerfile healthcheck reference:

- https://docs.docker.com/reference/dockerfile/#healthcheck

Then you can sanity check quickly:

```bash
docker compose ps
```

Look for `(healthy)`.

### 6.3 What “rollback” really means on a single host

On a single server, rollback is usually:

- Switch the image tag back
- Recreate the container

Example:

- Your Compose file uses `ghcr.io/you/app:2026-02-25`
- A deploy goes bad
- You edit it back to `ghcr.io/you/app:2026-02-20`

Then:

```bash
docker compose up -d
```

This is why **immutable, versioned image tags** are so valuable.

## Step 7: Don’t ship secrets in the repo

A few ground rules:

- Don’t commit `.env` files with real secrets
- Don’t bake secrets into images
- Don’t pass secrets on the command line (they’ll show up in shell history)

For a simple VPS, the “good enough” baseline is:

- Store secrets in a root-owned file readable only by the deploy user
- Use Compose `env_file:` or `environment:` pointing to non-committed values

When you’re ready for better, look at:

- Docker secrets (primarily designed for Swarm): https://docs.docker.com/engine/swarm/secrets/

Even without full secrets tooling, you can still be disciplined: keep secrets out of Git and out of images.

## Step 8: Backups and updates: the two real ops jobs

On a single host, your two recurring responsibilities are:

1. **Back up volumes** (Part 4 covers patterns)
2. **Patch the host OS** (security updates)

A containerized app running on an unpatched OS is still vulnerable.

## Step 9: A simple “deploy checklist”

When you want to be calm during deploys:

- Does DNS point to the server?
- Are ports 80/443 open?
- Does the proxy route to the correct internal service name + port?
- Are volumes mounted and writable?
- Do you have a healthcheck or at least a quick smoke test URL?
- Are you using immutable image tags?

If you can answer those, single-host Docker deployments become repeatable.

Next up in Part 7: **security basics** — image sources, least privilege, secrets, and patching without paranoia.
