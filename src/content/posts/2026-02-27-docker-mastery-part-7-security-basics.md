---
title: "Docker Mastery, Part 7: Security Basics (Without Paranoia)"
pubDate: 2026-02-27
description: "A practical container security checklist: trust your images, run as non-root, handle secrets correctly, and keep hosts patched."
tags:
  - docker
  - containers
  - devops
  - self-hosting
  - security
---

Docker security is a big topic. The good news: you don’t need a PhD in threat modeling to get **80% of the benefit**.

This post is a **practical baseline** you can apply to most personal projects and small production stacks.

We’ll cover:

- Choosing images you can trust
- Minimizing privileges (especially **not running as root**)
- Treating secrets like secrets
- Keeping your host and images patched
- A quick checklist you can re-use

## 1) Start with the supply chain: where do your images come from?

The easiest security wins are often upstream:

- Prefer **official images** and reputable publishers
- Pin versions (avoid floating tags like `latest` in production)
- Keep your dependency graph small

### 1.1 Prefer official images (or build your own)

Docker maintains “Official Images” that follow a set of standards and are widely used:

- Docker Official Images: https://docs.docker.com/docker-hub/official_images/

If you’re using a random image with 10 pulls and no documentation, you’re taking on risk you probably don’t need.

### 1.2 Pin tags (and understand what “pinning” means)

Bad:

```yaml
image: postgres:latest
```

Better:

```yaml
image: postgres:16
```

Best (most reproducible): pin a digest:

```yaml
image: postgres@sha256:...yourdigest...
```

Tag pinning (`:16`) gives you stability within a major version, but still allows updates. Digest pinning gives you exact reproducibility.

Docker image naming reference:

- Image names and tags: https://docs.docker.com/reference/cli/docker/image/tag/

### 1.3 Consider signing/verification when you’re ready

If you’re running anything sensitive, image signing and verification is worth learning.

A good entry point:

- Docker content trust (Notary): https://docs.docker.com/engine/security/trust/

Even if you don’t turn it on today, keep it on your radar.

## 2) Least privilege: containers should not be “little VMs”

A container is not a secure sandbox by default. It’s **process isolation** with guardrails. Your goal is to reduce what a compromised container can do.

Docker security overview:

- Docker Engine security: https://docs.docker.com/engine/security/

### 2.1 Run as a non-root user (in the image)

Inside a container, `root` is still root *inside the container*, and misconfigurations can turn that into real damage.

In your Dockerfile:

```dockerfile
# Create an unprivileged user
RUN addgroup -S app && adduser -S app -G app

USER app
```

Then make sure your app writes only to directories it owns.

If you need privileged ports (<1024), don’t “solve” that by running as root. Put a reverse proxy in front (Part 6) and keep your app on a high port.

### 2.2 Drop capabilities you don’t need

Linux capabilities are granular privileges. Many apps don’t need most of them.

In Compose:

```yaml
services:
  app:
    cap_drop:
      - ALL
    # Add back only what you actually need:
    # cap_add:
    #   - NET_BIND_SERVICE
```

Compose reference:

- `cap_drop` / `cap_add`: https://docs.docker.com/reference/compose-file/services/#cap_add

### 2.3 Make the filesystem read-only (when possible)

If your service is mostly stateless, lock it down:

```yaml
services:
  app:
    read_only: true
    tmpfs:
      - /tmp
```

Then mount specific writable paths as volumes only when necessary.

Compose reference:

- `read_only`: https://docs.docker.com/reference/compose-file/services/#read_only

### 2.4 Don’t mount the Docker socket unless you mean it

This is worth calling out:

- Mounting `/var/run/docker.sock` into a container effectively gives that container **root on the host**.

If you see:

```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock
```

…pause and reconsider. Sometimes it’s justified (CI runners, certain monitoring tools), but it is a *major* trust boundary.

## 3) Secrets: environment variables are not a safe long-term plan

A common mistake is to treat `environment:` as a secrets manager.

Reality:

- Environment variables can leak via logs, crash dumps, diagnostics, and misconfigured tooling
- They’re easy to accidentally commit in `.env`

### 3.1 Minimum viable discipline

For small stacks, “good enough” often looks like:

- Store secrets outside Git
- Restrict file permissions
- Pass them at runtime via a file rather than inline in Compose

Example pattern:

```yaml
services:
  app:
    env_file:
      - .env
```

Then:

- Add `.env` to `.gitignore`
- Ensure it’s readable only by the user deploying

Compose `env_file` reference:

- https://docs.docker.com/reference/compose-file/services/#env_file

### 3.2 Docker secrets (know the limitations)

Docker secrets are designed for Swarm, and Compose support varies by mode and environment. Still, it’s helpful to understand the concept and plan for a future migration to a real secrets system.

Start here:

- Docker secrets: https://docs.docker.com/engine/swarm/secrets/

If you end up running multiple servers, consider a dedicated secrets manager (Vault, SSM, etc.) rather than inventing your own.

## 4) Patch rhythm: keep the host and the images updated

Security is not just configuration. It’s **ongoing maintenance**.

### 4.1 Patch the host OS

Your containers share the host kernel. If the host is unpatched, containers don’t save you.

Minimum baseline:

- Enable unattended security updates (or patch weekly)
- Keep SSH hardened (keys, disable password auth if possible)

Docker’s firewall/iptables notes are also worth reading if you depend on host firewalls:

- Packet filtering and firewalls: https://docs.docker.com/engine/network/packet-filtering-firewalls/

### 4.2 Rebuild images regularly

Even if your app code doesn’t change, base images get security fixes.

Two simple habits:

- Prefer **versioned base images** (e.g., `node:22-alpine`), and update them intentionally
- Rebuild and redeploy on a schedule (weekly/biweekly) for long-lived services

### 4.3 Scan images for known vulnerabilities

Scanning isn’t magic, but it’s a useful signal.

Docker provides built-in scanning via Docker Scout:

- Docker Scout overview: https://docs.docker.com/scout/

Treat scan results like a backlog:

- Fix “easy” criticals quickly
- Understand false positives
- Don’t ignore the basics (patching, least privilege) because scanning exists

## 5) Network exposure: only publish what must be public

A lot of compromises happen because:

- A database was published to the internet
- Admin panels were exposed without auth

Practical baseline:

- Only publish `80`/`443` on the host
- Keep everything else on an internal Docker network

Compose networks are your friend:

- Compose networking: https://docs.docker.com/compose/how-tos/networking/

If a service doesn’t need to be reachable from the internet, it should not have a host `ports:` mapping.

## 6) A container security checklist you can copy/paste

When you’re about to ship something (or review an existing stack), ask:

- **Images**
  - Are images from a trusted source (official, reputable, or self-built)?
  - Are tags pinned (not `latest`)?
- **Privileges**
  - Does the container run as a non-root user?
  - Are unnecessary Linux capabilities dropped?
  - Is the filesystem read-only where possible?
  - Are you avoiding mounting the Docker socket?
- **Secrets**
  - Are secrets kept out of Git?
  - Are secrets stored outside the image and injected at runtime?
- **Exposure**
  - Are only required ports published?
  - Are databases/internal services private?
- **Updates**
  - Is the host patched regularly?
  - Do you rebuild/redeploy to pick up base image fixes?
  - Do you scan images and act on critical findings?

If you do *just* those things, you’ll be ahead of most hobby deployments.

## Closing thought: security is a gradient

Security isn’t a switch you flip; it’s a set of tradeoffs.

The goal for most self-hosted stacks is:

- reduce blast radius
- make compromise harder
- make updates routine

If you want to go further after this series, the next “serious” steps are:

- a proper secrets manager
- image signing/verification
- centralized logging/monitoring
- a structured patch + rebuild schedule
