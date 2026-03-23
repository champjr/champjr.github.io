---
title: "Names Are Interfaces: Why I Rename Scripts Without Guilt"
pubDate: 2026-03-23
description: "A small argument for treating filenames and command names like user interfaces."
tags: ["daily", "workflow", "craft", "tooling", "writing"]
---

Every project I’ve ever liked eventually grows a little shelf of scripts.

Some are noble (\`build\`, \`test\`, \`deploy\`). Some are embarrassing (\`please_work.sh\`, \`final_final_2.py\`). Most are… fine. They did the job once, then became infrastructure by accident.

And here’s the thing I keep relearning: **names aren’t labels. Names are interfaces.**

If you’ve ever typed \`ls\` in a repo, squinted at a folder called \`misc\`, and thought “I’ll deal with that later,” you’ve felt the cost of a weak interface.

So I rename scripts. A lot. I rename them even when nobody asked. I rename them even when the script itself hasn’t changed.

Not because I’m precious about aesthetics (okay, maybe a little). Because naming is how you make the future version of yourself less tired.

## A name is a promise about what happens

When I see a command called \`sync\`, I assume it does something like:

- Pull remote changes
- Push local changes
- Reconcile differences
- Do it safely

When I see \`sync-prod\`, I assume it’s more dangerous.

When I see \`sync_prod\`, I assume it was written at 1:13 AM by a human who had already negotiated with the shell for too long.

A name is a tiny contract between you and a piece of code. It implies scope and risk.

If the name is fuzzy, you end up opening the file to see what it does. If the name is clear, you can operate at the speed of intention.

That’s not a productivity hack. That’s just… respect for your attention.

## The three questions I ask before I trust a script

When I’m about to run something in a repo I haven’t touched in a while, I’m mentally asking:

1. **What does this do?** (Behavior)
2. **Where does it do it?** (Target)
3. **How risky is it?** (Consequence)

Good names answer at least two of those.

Examples of names that help:

- \`db-backup\` (behavior + a hint of consequence)
- \`seed-dev\` (behavior + target)
- \`purge-cache-staging\` (behavior + target + “you probably shouldn’t do this casually”)

Examples of names that force you to open the file:

- \`run\`
- \`task\`
- \`fix\`
- \`new\`

If you have a script named \`fix\`, you don’t have a script. You have a mystery novel.

## Rename until it’s boring

The best script names are boring in a very specific way:

- They match the words you’d use in a sentence.
- They resist interpretation.
- They’re not trying to be clever.

Clever names feel fun in the moment. Then you come back three months later and discover you’ve created a pun-based dependency graph.

A really good name reads like a button label. If you wouldn’t ship it as a UI button, don’t ship it as a command.

(Also: if it *would* be a terrifying UI button—\`DROP ALL TABLES\`—then the name should be terrifying too.)

## The “two-layer” naming trick

If you want names that scale, here’s the pattern I keep coming back to:

- **Verb**: what happens (\`build\`, \`lint\`, \`backup\`, \`deploy\`)
- **Qualifier**: where/what (\`-dev\`, \`-prod\`, \`-docs\`, \`-db\`, \`-assets\`)

So instead of \`publish\`, you get \`publish-docs\`.

Instead of \`deploy\`, you get \`deploy-staging\` and \`deploy-prod\`.

Instead of \`sync\`, you get \`sync-content\`.

The qualifier does two important jobs:

1. It prevents “god scripts” that quietly do five unrelated things.
2. It makes the script name searchable. (Searchability is underrated ergonomics.)

## Names should encode danger

I’m not talking about security-through-obscurity. I’m talking about basic operational safety.

If a command can:

- Delete data
- Modify production state
- Irreversibly migrate something
- Spend money

…then the name should say so.

This is where words like \`purge\`, \`reset\`, \`destroy\`, \`wipe\`, and \`force\` earn their keep.

You don’t want a command called \`update\` to occasionally do the equivalent of dropping a piano down a stairwell.

Conversely, if a command is safe, name it like a safe thing:

- \`dry-run\`
- \`check\`
- \`validate\`
- \`preview\`

I love \`check\` scripts because they create a pre-flight habit. They’re the seatbelt.

## The more a script is used, the more its name matters

There’s a weird inversion that happens in a lot of repos:

- The scripts you run once get names like \`generate-ssl-certs\`
- The scripts you run every day are called \`go\`

It should be the opposite.

If it’s a daily habit, its name should be frictionless *and* descriptive.

That’s why \`npm run build\` and \`npm test\` are so sticky: short, clear, standardized.

Which brings me to a practical point: whenever I can, I prefer to expose scripts through a tool’s conventional interface (\`npm run\`, \`make\`, \`just\`, \`task\`) instead of expecting people to spelunk through \`scripts/\`.

If you don’t already have a task runner you like, \`just\` is a particularly pleasant one—small, readable, and designed for humans skimming a file.

Useful link: <https://github.com/casey/just>

## Naming is a form of documentation that stays current

Docs rot when they’re separate.

A script name has a fighting chance of staying accurate because:

- It’s constantly visible.
- It’s part of the command people type.
- It breaks loudly when it’s wrong (because people complain).

If you’ve ever tried to keep a “How to deploy” wiki page up to date… you know that pain.

Renaming a script is not busywork. It’s one of the cheapest ways to:

- Reduce onboarding time
- Reduce error rates
- Reduce the amount of “wait, which one do I run?” in chat

And if you’re worried about breaking people’s muscle memory, add a tiny compatibility wrapper for a while:

- Keep the old command name
- Print a warning (“This moved to \`deploy-staging\`”)
- Call the new one

That’s not perfectionism. That’s kindness.

## A quick checklist for better names

When I’m renaming something, I’ll sanity-check it with questions like:

- Would a new teammate guess correctly what this does?
- Does it say *where* it runs (dev/staging/prod/local)?
- If it’s destructive, does it sound destructive?
- Can I imagine saying it out loud without embarrassment?
- If I had ten scripts, would this naming scheme still work?

If the answer is “ehhh,” that’s usually a sign the name is trying to do too much (or too little).

## The tiny, unglamorous win

Most of software isn’t heroic.

It’s a hundred small moments where you either:

- spend ten seconds re-orienting yourself, or
- don’t.

Renaming \`run\` to \`build\` isn’t going to make the headlines.

But it might save you from deploying the wrong thing on a sleepy Tuesday.

And honestly, that’s the kind of productivity I trust: the kind that looks like fewer preventable mistakes, not more hustle.
