---
title: "Open Source Tech of the Day: Argo CD"
pubDate: 2026-03-20
description: "A GitOps controller that keeps your Kubernetes clusters synced to what’s in Git—automatically and visibly."
---

If you’ve ever deployed to Kubernetes and thought “I *think* it’s running what I last applied…?” — Argo CD is the antidote.

Argo CD is an open-source **GitOps continuous delivery** tool for Kubernetes. You declare the desired state of your apps (Helm, Kustomize, plain YAML, etc.) in Git, and Argo CD continuously reconciles your cluster to match. Git becomes the source of truth, and Argo CD becomes the polite-but-firm hall monitor that makes reality line up.

## Quick tour

At a high level, Argo CD does three things really well:

1) **Sync**
- It watches your Git repo(s) for changes.
- It applies the corresponding manifests to your cluster.
- It can do this manually (click/CLI) or automatically (self-heal / auto-sync).

2) **Show you what’s actually happening**
- A web UI and CLI let you inspect apps, resources, and rollout status.
- You can see diffs between Git and the live cluster ("desired" vs "actual").

3) **Keep you out of YAML whack-a-mole**
- When someone (or something) changes resources directly in the cluster, Argo CD can flag drift—and optionally revert it.

The mental model is simple: **commit → Argo CD notices → cluster converges**.

## Why it’s cool

A few standout bits that make Argo CD more than “kubectl apply, but scheduled”:

- **Drift detection (and self-healing)**
  Argo CD continuously compares live resources against what Git says. If something changes out-of-band, it can warn you—or snap it back. This is huge for keeping production from becoming a snowflake.

- **Multi-environment workflows without losing your mind**
  It’s common to have separate folders, branches, or overlays for dev/staging/prod. Argo CD apps can point at different paths/revisions, and you can make promotion a Git operation instead of a "click the right thing at 2 AM" ritual.

- **First-class support for common packaging formats**
  Argo CD works with Helm, Kustomize, Jsonnet, and plain manifests. That means you can adopt it without rewriting everything from scratch.

- **Visibility that makes incidents faster**
  During an outage, one of the most valuable questions is: “What changed?” With GitOps, the answer is usually in Git history. With Argo CD, you also get a live view of what’s out of sync and what’s failing.

## Who it’s for

Argo CD shines for:

- **Teams running Kubernetes in production** who want deployments to be repeatable, auditable, and less dependent on “who remembers the magic command.”
- **Platform/DevOps folks** building a paved road: one way to deploy, with guardrails.
- **Anyone who’s been burned by configuration drift** (yes, that includes “we hotfixed it in the cluster and forgot”).

If you’re not on Kubernetes, Argo CD won’t be your daily driver—but if you *are* on Kubernetes, it’s one of those tools that can quietly make your weeks calmer.

## Getting started (smallest first step)

The smallest “try it and see the idea” step is to run Argo CD in a local cluster and sync a tiny sample app.

1) Create a local cluster (for example with kind):

```bash
kind create cluster
```

2) Install Argo CD into that cluster:

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
```

3) Forward the Argo CD API server so you can open the UI locally:

```bash
kubectl port-forward -n argocd svc/argocd-server 8080:443
```

Then point your browser at `http://localhost:8080` and follow the official “getting started” guide to:
- grab the initial admin password,
- add a Git repo,
- create your first Argo CD Application,
- and sync.

That’s it: one local cluster, one repo, one "ohhhh" moment when you see Git and the cluster converge.

## Links

- Official docs / homepage: https://argo-cd.readthedocs.io/
- GitHub repo: https://github.com/argoproj/argo-cd
- Extra: Argo CD Getting Started: https://argo-cd.readthedocs.io/en/stable/getting_started/
