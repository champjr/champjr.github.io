---
title: "Open Source Tech of the Day: SOPS"
pubDate: 2026-02-19
description: "Encrypt YAML/JSON/.env files without giving up diffability or your sanity."
---

Configuration files have a bad habit of slowly turning into **secret spaghetti**.

You start with harmless stuff (feature flags, ports). Then a database URL sneaks in. Then an API token shows up “just for dev.” Then you’re playing whack-a-mole with `.gitignore`, copy/paste, and “please don’t commit that” prayers.

Enter **SOPS** (Secrets OPerationS): an open-source tool for **encrypting files like YAML, JSON, and `.env`** while keeping them easy to work with in a real repo.

## Quick tour (what it is)

**SOPS is file-level encryption with developer ergonomics.**

Instead of hiding secrets in an external vault *only* (which is great, but not always enough), SOPS lets you keep encrypted config **in Git**, and decrypt it only when/where you need it.

The magic trick: SOPS can **encrypt just the values**, leaving the structure readable. That means:

- diffs stay meaningful (you can still see *what* changed, even if the sensitive values are encrypted)
- you don’t have to invent a bespoke “secrets file format”
- your app/tooling can keep using normal YAML/JSON

SOPS supports multiple key backends, including **age**, **GPG/PGP**, and various cloud KMS options.

## What problem it solves

Most teams get stuck between two uncomfortable choices:

1) **Plaintext config in the repo** (fast, dangerous), or
2) **Secrets entirely out-of-band** (secure, but sometimes awkward for local dev, bootstrapping, or GitOps flows).

SOPS gives you a pragmatic middle path:

- store encrypted config *in* the repo
- keep the file format friendly to humans and tools
- decrypt only in trusted environments (your machine, CI, a deployment pipeline)

It’s especially handy when you want a **single source of truth** for “the config that should exist,” without also storing the actual secret material in plaintext.

## Why it’s cool (standout features)

### 1) It’s Git-friendly by design

Because the file structure can remain readable, you can review PRs without staring at a single opaque blob. You’ll still see which keys were added/removed/renamed, which is *exactly* what code review needs.

### 2) It plays well with modern workflows (GitOps, Kubernetes, CI)

SOPS shows up all over the place in GitOps setups because it’s good at the boring stuff:

- encrypted YAML checked into a repo
- decrypted only during reconciliation/deploy
- consistent format across environments

If you’ve ever thought “I want Git history for my config, but not Git history for my secrets,” SOPS is basically that thought turned into a tool.

### 3) Flexible key management

You can use:

- **age** keys (simple, great for personal projects and small teams)
- **GPG/PGP** (works well if you already live in that world)
- **cloud KMS** (useful when you want centralized control + rotation)

You’re not locked into one security posture forever, which is a rare and underrated feature.

## Who it’s for

- **GitOps / platform folks** who want encrypted manifests in the repo without making everything miserable
- **Small teams** who need a lightweight secrets workflow that doesn’t require a full vault rollout on day one
- **Open-source maintainers** who need to share config templates safely across contributors
- **Anyone** who has ever accidentally pasted a token into the wrong terminal tab (no judgment; it happens)

If you’re already happy with a vault and you never need secrets represented in files, you might not need SOPS. But if “a file exists” is part of your workflow (and it usually is), SOPS is worth knowing.

## Getting started (smallest first step)

The quickest low-commitment trial is: **install SOPS, generate an age key, encrypt one tiny YAML file.**

### 1) Install

On macOS:

```bash
brew install sops age
```

(Other platforms: grab packages or binaries from the project docs.)

### 2) Create an age key (local test)

```bash
age-keygen -o key.txt
```

This prints a public key that starts with `age1...`. Copy that public key.

### 3) Encrypt a sample file

Create a tiny YAML file:

```bash
cat > demo.yaml <<'YAML'
apiKey: "REPLACE_ME"
region: "us-east-1"
YAML
```

Encrypt it using your **age public key**:

```bash
sops --encrypt --age <YOUR_AGE_PUBLIC_KEY> demo.yaml > demo.enc.yaml
```

Now open `demo.enc.yaml` and you’ll see the structure is still there, but the sensitive bits are encrypted.

That’s the “aha.” From there you can wire decryption into your runtime (locally) or deployment tooling (in CI/GitOps).

## Links

- Official homepage / docs: https://getsops.io/
- GitHub repo: https://github.com/getsops/sops
- Extra (Kubernetes + GitOps guide): https://fluxcd.io/flux/guides/mozilla-sops/

---

SOPS isn’t flashy. It’s *useful*. And in a world where the easiest mistake is a secret in the wrong place, “useful” is a superpower.
