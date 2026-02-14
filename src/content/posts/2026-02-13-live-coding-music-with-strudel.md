---
title: "Live-coding music with Strudel (and embedding a playable beat in a blog post)"
pubDate: 2026-02-13T12:00:00-06:00
description: "Strudel brings TidalCycles-style pattern live coding to the browser. Here’s a quick intro, plus a tiny embedded demo you can hit Play on."
tags: ["music", "live-coding", "javascript", "strudel", "creative-coding"]
---

Strudel (https://strudel.cc) is a **browser-based live coding environment for music** — a JavaScript port of the TidalCycles pattern language.

If you’ve ever wanted to *write beats like code* and hear them update instantly, Strudel is that.

## A playable mini demo (embedded)

This page includes a tiny Strudel “instrument” embedded as an iframe.

- Hit **Play** to start audio.
- Hit **Stop** to stop.
- (Browsers require a click/tap before audio is allowed — that’s normal.)
- iPhone tip: if you don’t hear anything, make sure **Silent Mode is off** and your media volume is up.

The preset is a simple **house-ish groove** (kick + clap + hats + bass).

<iframe
  src="/demos/strudel-beat/"
  width="100%"
  height="320"
  loading="lazy"
  allow="autoplay"
  style="border:1px solid rgba(127,127,127,.35); border-radius: 12px;"
  title="Strudel beat demo"
></iframe>

## The core Strudel idea (in 60 seconds)

Strudel’s patterns describe **events over time** (a “cycle” is the basic unit). You build patterns and transform them live.

A couple of foundational workshop snippets:

- Play a sound pattern:

```js
sound("bd hh sd oh")
```

- Change tempo (cycles per minute):

```js
setcpm(90/4)
sound("<bd hh rim hh>*8")
```

- Add rests and sub-sequences:

```js
sound("bd hh - rim - bd [hh hh] rim")
```

## Learn Strudel quickly

If you want the shortest path from zero → “I’m making beats”:

- Strudel REPL: https://strudel.cc/
- Workshop (start here): https://strudel.cc/workshop/getting-started/
- First Sounds: https://strudel.cc/workshop/first-sounds/
- First Notes: https://strudel.cc/workshop/first-notes/

## How the embedded demo works

My blog is a static site (Astro on GitHub Pages). The demo is just an `index.html` file under `public/` so it gets served at:

- `/demos/strudel-beat/`

Inside that page, it loads Strudel from an **ES module CDN**, wires up WebAudio output, and starts/stops the Strudel scheduler.

If you want me to extend it next:

- a text box to edit the pattern live
- a couple of preset beats (house/techno/boombap)
- a BPM slider
- MIDI/OSC output so Strudel can drive external synths
