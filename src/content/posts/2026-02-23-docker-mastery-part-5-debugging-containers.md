---
title: "Docker Mastery, Part 5: Debugging Containers (Fast)"
pubDate: 2026-02-23
description: "A practical checklist for figuring out why a container is down, unhealthy, slow, or can’t talk to anything."
tags:
  - docker
  - containers
  - devops
  - self-hosting
---

When a container breaks, the temptation is to “just rebuild it” or “just restart it.” Sometimes that works. Often it hides the real issue and guarantees it’ll bite you again.

This part is a **repeatable debugging workflow** you can run in a few minutes:

- Confirm what’s running (and what’s restarting)
- Read the logs (correctly)
- Inspect configuration and runtime state
- Prove networking and DNS from *inside* the container network
- Use a minimal toolbox container when the target image is too slim

## Step 0: Know what you’re debugging

First question:

- Is the **container not starting** (crash-loop)?
- Is it **running but unhealthy**?
- Is it **running but broken** (timeouts, 500s, can’t reach DB)?
- Is it **slow** or **resource-starved**?

Different symptoms point to different tools.

## Step 1: What’s running? What’s restarting?

See containers and their status:

```bash
docker ps
```

Include stopped containers to catch “exited immediately” situations:

```bash
docker ps -a
```

If you’re using Docker Compose (recommended for stacks), use:

```bash
docker compose ps
```

What to look for:

- **Restarting (x seconds ago)** → crash-loop; go straight to logs
- **Exited (1)** or other non-zero exit code → logs + inspect command/entrypoint
- **(unhealthy)** → healthcheck failing; inspect health output + test endpoint

## Step 2: Read the logs (and don’t stop at the last line)

Basic logs:

```bash
docker logs <container>
```

Follow logs live:

```bash
docker logs -f <container>
```

Get the last N lines plus timestamps:

```bash
docker logs --tail 200 --timestamps <container>
```

Compose logs for a service:

```bash
docker compose logs --tail 200 -f <service>
```

Common log patterns and what they usually mean:

- **“address already in use”** → port conflict inside container (or multiple processes)
- **“connection refused”** → target service not listening, wrong host/port, or not ready
- **“no such host”** → DNS/service name problem in the Docker network
- **Permission denied** → volume/bind mount ownership mismatch or running as non-root

Docker docs:

- `docker logs`: https://docs.docker.com/reference/cli/docker/container/logs/
- Compose logs: https://docs.docker.com/reference/cli/docker/compose/logs/

## Step 3: Inspect the container’s config and runtime state

### 3.1 Inspect the effective command, env, mounts, ports

```bash
docker inspect <container>
```

When you’re trying to answer one specific question, format helps:

```bash
docker inspect --format '{{json .Config.Cmd}}' <container>
docker inspect --format '{{json .Config.Env}}' <container>
docker inspect --format '{{json .Mounts}}' <container>
docker inspect --format '{{json .NetworkSettings.Ports}}' <container>
```

Useful “sanity checks”:

- Is the container using the image tag you think it is?
- Did your environment variables actually make it in?
- Are the volume mounts pointing where you expect?
- Are published ports correct?

Docs:

- `docker inspect`: https://docs.docker.com/reference/cli/docker/inspect/

### 3.2 Check exit code and last failure reason

If it’s exiting immediately:

```bash
docker ps -a --no-trunc
```

Then:

```bash
docker inspect --format 'Status={{.State.Status}} ExitCode={{.State.ExitCode}} Error={{.State.Error}}' <container>
```

### 3.3 Healthchecks: read the health output

If the status is `(unhealthy)`:

```bash
docker inspect --format '{{json .State.Health}}' <container>
```

Healthchecks are only as good as their signal. If your healthcheck curls `localhost`, validate that endpoint manually from inside the container (next section).

Healthcheck docs:

- https://docs.docker.com/reference/dockerfile/#healthcheck

## Step 4: Get a shell inside (when possible)

If the container includes a shell:

```bash
docker exec -it <container> sh
```

Or:

```bash
docker exec -it <container> bash
```

From inside, verify:

- The process is running
- The app is listening on the port you expect
- DNS resolves service names
- The app can reach dependencies

Handy commands (availability varies by image):

```bash
ps aux
ss -lntp || netstat -lntp
printenv | sort
cat /etc/resolv.conf
```

Tip: many production images are intentionally minimal and don’t include `curl`, `dig`, or even a shell. That’s good for security, but it means you need a toolbox approach.

Exec docs:

- https://docs.docker.com/reference/cli/docker/container/exec/

## Step 5: Use a toolbox container (the “debug sidecar” pattern)

Instead of installing tools into your app image, run a temporary container in the **same network**.

### 5.1 Find the network

For Compose stacks, services usually share a default network. List networks:

```bash
docker network ls
```

Then inspect your Compose network name (often `<project>_default`):

```bash
docker network inspect <network>
```

Network docs:

- https://docs.docker.com/engine/network/

### 5.2 Run a toolbox on the same network

Using `nicolaka/netshoot` (popular for debugging):

```bash
docker run --rm -it --network <network> nicolaka/netshoot
```

Or using Alpine (smaller, but fewer tools by default):

```bash
docker run --rm -it --network <network> alpine:3.20 sh
```

Inside the toolbox, you can test connectivity to services by name:

```bash
# DNS / name resolution
nslookup db

# HTTP checks
curl -v http://app:3000/health

# TCP checks
nc -vz db 5432
```

Why this works:

- You’re testing from the same network namespace as peer containers
- You avoid “works on my host” confusion
- You keep your production images clean

## Step 6: Prove ports and publish rules (host vs container confusion)

Two different questions:

- “Is the app listening **inside** the container network?”
- “Is the port published and reachable **from the host**?”

### 6.1 Inside the Docker network

From a toolbox container:

```bash
curl -v http://app:3000/
```

If that works, the service-to-service path is fine.

### 6.2 From the host

Check published ports:

```bash
docker port <container>
```

Then curl the host port:

```bash
curl -v http://localhost:8080/
```

Common mistakes:

- Publishing the wrong port (`-p 8080:80` but app listens on 3000)
- Binding to `127.0.0.1` when you expected `0.0.0.0`
- Confusing `expose` (metadata) with `ports` (publishing)

Compose ports docs:

- https://docs.docker.com/reference/compose-file/services/#ports

## Step 7: Resource issues (slow, OOM, “it just dies”)

### 7.1 Watch CPU/memory live

```bash
docker stats
```

If memory spikes and the container disappears, suspect OOM (out-of-memory). Check recent logs and the container’s exit behavior.

### 7.2 Look for restart loops and policies

Restart loops can mask real failure output. Confirm restart policy:

```bash
docker inspect --format '{{.HostConfig.RestartPolicy.Name}}' <container>
```

Restart policy docs:

- https://docs.docker.com/engine/containers/start-containers-automatically/

## Step 8: When networking is weird

If services can’t talk:

- Confirm they’re on the same Docker network
- Confirm the service name matches what you’re using
- Confirm you’re using container ports for service-to-service calls (not published host ports)

Quick checks:

```bash
# See which networks a container is on
docker inspect --format '{{json .NetworkSettings.Networks}}' <container>

# Inspect network members
docker network inspect <network>
```

If you suspect DNS issues, test resolution from a toolbox container:

```bash
getent hosts db || nslookup db
```

## Step 9: A compact “first 5 minutes” checklist

When something is broken, run this sequence:

1. `docker compose ps` (or `docker ps -a`)
2. `docker compose logs --tail 200 <service>`
3. `docker inspect <container>` (look at env, mounts, ports, health)
4. `docker exec -it <container> sh` (if possible)
5. If no shell/tools: run a toolbox container on the same network
6. Test DNS + TCP + HTTP from inside the network
7. Check `docker stats` if it’s slow or dying

If you do those steps consistently, “Docker is broken” turns into a concrete answer like:

- “My container is healthy but the port isn’t published”
- “The app is listening on 3000 but I published 8080:80”
- “DNS can’t resolve `db` because the service is on a different network”
- “The process can’t write to the mounted directory due to UID/GID mismatch”

Next up in Part 6: **shipping to a server** (a simple VPS deployment workflow, reverse proxy basics, and safe updates).
