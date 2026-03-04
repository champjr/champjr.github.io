---
title: "Open Source Tech of the Day: kind (Kubernetes in Docker)"
pubDate: 2026-03-04
description: "Spin up a real Kubernetes cluster locally in minutes using Docker containers as nodes."
---

If you’ve ever wanted to test “real Kubernetes behavior” without donating your entire laptop fan curve to the cause, meet **kind** — short for **Kubernetes in Docker**.

kind runs a Kubernetes cluster **inside Docker containers** (each “node” is just a container). That means you get something that behaves like a genuine multi-node cluster, but stays easy to create, destroy, and recreate. It started life as a tool for testing Kubernetes itself… and then developers everywhere quietly adopted it as the fastest way to get a dependable local cluster.

## Quick tour

At a high level, kind gives you:

- **A local Kubernetes cluster** that works with normal tooling (kubectl, Helm, etc.)
- **Repeatable environments** you can rebuild from scratch in minutes
- **Configurable topologies** (single-node, multi-node, custom networking, etc.)

The “magic trick” is that kind uses Docker as its VM layer. Instead of a heavyweight VM per node, it runs “node images” that contain the bits needed to act like Kubernetes nodes.

A typical workflow looks like:

1. Create a cluster (`kind create cluster`)
2. Point kubectl at it (kind configures your kubeconfig automatically)
3. Deploy your app or Helm chart
4. Break things safely
5. Delete the cluster and start fresh (`kind delete cluster`)

If your day job involves YAML, this is basically a washable whiteboard.

## Why it’s cool

**1) It’s disposable (in a good way).**

Local clusters have a habit of drifting into “works on my machine (from three weeks ago)” territory. kind’s sweet spot is making it painless to throw the whole cluster away and rebuild it clean.

**2) It’s great for CI and repeatable testing.**

Because it’s scriptable and relatively lightweight, kind is popular in CI pipelines for integration tests that need Kubernetes semantics (services, ingress, DNS, RBAC, controllers, the whole vibe).

**3) Multi-node locally, without ceremony.**

Need to reproduce a bug that only happens when you have multiple nodes? kind can do that with a small config file. This is where it starts feeling less like “local dev toy” and more like “serious test lab in a box.”

## Who it’s for

- **Backend / platform engineers** who need to validate Kubernetes manifests, Helm charts, operators, or controllers locally
- **App developers** who want to run their service plus dependencies (databases, queues, etc.) in a cluster-like environment
- **Teams building internal platforms** who want fast feedback before pushing to a shared dev cluster
- **CI maintainers** who need reproducible, container-based Kubernetes testing

If you’re *brand new* to Kubernetes, kind can still be a good learning sandbox — just know you’ll also want a gentle tutorial path (and a willingness to ask “what does this resource even do?” about 37 times, which is normal).

## Getting started (smallest first step)

### Option A: Homebrew (macOS)

```bash
brew install kind kubectl
kind create cluster
kubectl get nodes
```

That’s it: a Kubernetes cluster, locally, with a working kubeconfig.

When you’re done:

```bash
kind delete cluster
```

### Option B: Go install (cross-platform)

If you already have Go set up:

```bash
go install sigs.k8s.io/kind@latest
```

Then create a cluster:

```bash
kind create cluster
```

## A couple standout features to try next

- **Load a local image without a registry**
  - If you build a Docker image locally and want it inside your kind cluster, kind can load it directly (handy for tight dev loops).
- **Multi-node clusters**
  - Use a simple YAML config to create one control-plane node plus a couple workers and test scheduling behavior.
- **Known-good Kubernetes versions**
  - kind supports node images tied to Kubernetes versions, which helps when you need to test compatibility across versions.

## Links

- Homepage / docs: https://kind.sigs.k8s.io/
- GitHub: https://github.com/kubernetes-sigs/kind
- Extra guide (nice walkthrough): https://betterstack.com/community/guides/scaling-docker/kind/

---

If you try kind today, the best mindset is: **make the cluster easy to destroy**. The faster you can nuke-and-pave, the more fearless your experiments get — and that’s where the fun starts.
