---
title: "Building a CTA Live Tracker (CLI + Real‑Time Map) with Zero Dependencies"
pubDate: 2026-02-08
description: "A small Python toolkit + Leaflet web app that tracks CTA buses live, shows routes/stops, and pulls arrival predictions—built fast with Claude, but designed to run anywhere."
---

I wanted a **fast way to answer a simple Chicago question**:

> “Where is my bus right now—and when is it actually going to show up?”

So I built a little suite of tools around the **CTA Bus Tracker API**:

- a **Python CLI** for routes, stops, arrivals, live vehicle positions, and service bulletins
- a **browser-based live map** that shows *every active bus*, route shapes, stops, and per-stop prediction panels
- a small **Python API layer** you can import into your own scripts

The fun part: I used **Claude** to help generate the first pass quickly, and then iterated on the real problems that show up when you try to make something feel “live”: caching, rate limits, UI responsiveness, and all the weird edge cases hiding in the CTA API.

If you’re curious, everything is in `~/Dev/CTA_scripts` on my machine.

---

## What we built

### 1) A zero-dependency Python CLI

The CLI is the “Swiss Army knife” layer. It’s designed to be:

- **quick to run** (`python cta.py ...`)
- **easy to compose** (pipe outputs, wrap in shell scripts, etc.)
- **dependency-free** (Python 3.10+ standard library only)

It supports:

- listing and searching routes
- route directions + stop lists
- upcoming arrivals by stop, route, or vehicle
- live vehicle tracking by route/vehicle
- service bulletins (alerts/detours)
- nearest stops to an address (via OpenStreetMap Nominatim)

### 2) A real-time web map for “city-scale situational awareness”

The web app is what I actually wanted day-to-day: a **live map** where I can:

- see every active bus (colored + labeled by route)
- filter down to a few routes
- zoom in to show route lines (patterns) and stops
- click a stop to pop open live predictions

It runs locally via a tiny server:

```bash
cd CTA_scripts
python server.py
```

Then open:

- **http://localhost:8080**

And yes, it’s intentionally “boring tech”: `http.server` + `urllib` + `threading` on the backend, and Leaflet/OpenStreetMap on the frontend.

---

## Screenshots (the fun part)

### City-wide overview

You get a live snapshot of what’s moving across the whole city.

![CTA Live Bus Map — city-wide overview](/images/cta-live-tracker/overview.png)

### Hover details on buses

Hover a bus marker to see vehicle ID, route name, destination, delayed status, and the last update timestamp.

![Bus markers with hover tooltip](/images/cta-live-tracker/bus-tooltip.png)

### Route lines at neighborhood zoom

Zoom in and route polylines appear (drawn from CTA pattern geometry).

![Route lines at neighborhood zoom](/images/cta-live-tracker/route-lines.png)

### Stops + stop tooltips

At street level, stops show up and tooltips list the routes that serve them.

![Stop markers with hover tooltip](/images/cta-live-tracker/stop-tooltip.png)

### Route filter sidebar

The filter panel is the control center: search, toggle, select all/deselect all.

![Route filter panel](/images/cta-live-tracker/filter-panel.png)

### Predictions panel

Click a stop and you get a predictions panel with ETAs and vehicle info.

![Predictions panel](/images/cta-live-tracker/predictions.png)

---

## How to use it

### Step 1: Get a CTA API key

Create an account and request an API key here:

- https://www.ctabustracker.com/home

CTA emails a 25-character key.

### Step 2: Configure the key

From the project directory:

```bash
cd CTA_scripts
cp .env.example .env
# edit .env and set CTA_API_KEY=...
```

The key resolution order is:

1. `--key` CLI flag
2. `CTA_API_KEY` environment variable
3. `.env` file

### Step 3: Use the CLI

A few commands I use constantly:

**List routes**

```bash
python cta.py routes
```

**Search routes by name/number**

```bash
python cta.py search madison
```

**Find arrivals at a stop**

```bash
python cta.py arrivals --stop 5029 --top 5
```

**Track vehicles on a route**

```bash
python cta.py track --route 22
```

**Find stops near an address (and optionally show arrivals)**

```bash
python cta.py nearest "Wrigley Field, Chicago" --routes 22 --show-arrivals
```

### Step 4: Run the live map

```bash
python server.py
```

Optional:

```bash
python server.py --port 9000
```

Then open the browser to the printed URL.

---

## Features (and why they matter)

### A) Phased loading so you see *something* immediately

Loading 130-ish routes of geometry takes time. If the first experience is “blank map + spinner,” people bounce.

So the app loads in phases:

1. **Immediate:** map + UI + route filter list
2. **Within seconds:** live bus markers appear
3. **Then:** route patterns and stop lists load in the background, with a progress overlay

That means the app feels live quickly—even while the heavier data is still warming up.

### B) Caching and batching to survive the 10,000/day rate limit

The CTA Bus Tracker API has a **10,000 requests/day** limit per key. If you naïvely request vehicle positions route-by-route every minute, you can burn that in a single afternoon.

The fix is straightforward but essential:

- cache “static-ish” data (routes/patterns/stops) for ~24 hours
- cache vehicles for ~55 seconds
- batch requests in groups of 10 routes per API call
- share the cache across all browser clients so extra tabs don’t multiply traffic

Result: about **~13 calls/min** for vehicle refresh (city-wide), and startup cost that’s noticeable but manageable.

### C) Zoom-based rendering so the map stays fast

Rendering **every stop** in the city all the time is… a lot.

So the app is intentionally stingy:

- bus markers: always visible
- route lines: appear at zoom ≥ 12
- stop markers: appear at zoom ≥ 15

You don’t need a forest of dots when you’re zoomed out far enough to see O’Hare.

### D) Route colors designed for humans

CTA provides a route color field, but many routes share the same colors. On a city-wide visualization that’s useless.

So the app assigns each route a color from a **20-color high-contrast palette**. It’s not “official,” but it’s legible.

### E) A predictions panel you can trust

Click a stop and the app fetches live predictions (on demand):

- route + destination + direction
- “DUE” vs minutes
- delayed status
- vehicle number

This is the moment where the app answers the real question: *when do I move my feet?*

---

## Using it as a Python library

The CLI is built on modules you can import directly.

Example: find the nearest stop to an address and print the next arrivals:

```python
from client import load_api_key
from nearest import nearest_stops_by_address
from predictions import get_predictions

API_KEY = load_api_key()

(lat, lon), stops = nearest_stops_by_address(
    API_KEY,
    "Wrigley Field, Chicago",
    routes=["22"],
)

stop_id = stops[0]["stpid"]
preds = get_predictions(API_KEY, stop_ids=[stop_id])

for p in preds:
    print(f"Route {p['rt']} to {p['des']} in {p['prdctdn']} min")
```

This is handy if you want to:

- build a personal “morning commute” script
- wire predictions into a home dashboard
- trigger notifications when a bus is within X minutes

---

## Development process: how Claude helped (and what still required humans)

I used Claude the way I *wish* IDEs worked:

- scaffold the modules quickly
- keep functions small and testable
- generate UI pieces (Leaflet map, panels, CSS)
- iterate on edge cases by pasting in logs and asking “why is this happening?”

That said, the “last mile” wasn’t prompting. It was the boring debugging reality.

### 1) Reliability: CTA API timeouts at startup

The web server loads route geometry for every route by calling `getpatterns`. During peak hours, some calls hang or slow down enough to stall the whole sequence.

Fixes:

- increased timeout (30s)
- retry w/ exponential backoff
- skip routes that fail after retries, but keep the app usable

This was the difference between a toy and a tool.

### 2) The weird Leaflet canvas click bug

For performance, the map uses canvas rendering (DOM markers for ~11k stops would be painful).

But Leaflet’s canvas hit-testing on small circle markers can be unreliable: hover tooltips worked, but clicks didn’t.

The workaround was surprisingly clean:

- don’t rely on per-marker click handlers
- listen for `map.on('click')`
- convert click to pixel coords and find the nearest stop within a tolerance radius

It’s a “do it yourself” hit test—but it works every time.

### 3) Rate limits: cache design is product design

Caching isn’t just a backend optimization. It changes the whole user experience:

- page loads faster after the first warm-up
- multiple clients don’t amplify API usage
- the app feels stable instead of fragile

Claude was great for scaffolding a cache, but tuning TTLs and request grouping was very much a “measure → adjust → repeat” loop.

### 4) UX: show progress, not silence

A minute of background loading feels fine if you can see progress. It feels broken if you can’t.

So I added:

- a loading overlay with route counts (“Loading route 49B (75/131)…")
- an immediate path that shows buses as soon as possible

The theme: **don’t make users wait for perfection before they get value.**

---

## What I’d improve next

A few obvious upgrades if I keep pushing this:

- **persist route colors** across sessions (so route 22 is always the same color)
- **favorites**: pin a few routes/stops and auto-load that filter
- **mobile-friendly layout**: the filter panel + predictions panel could be smarter on small screens
- **historical traces**: show where a bus was over the last 10 minutes
- **WebSockets**: push updates instead of polling (though polling is totally fine here)

---

## Closing thought

This project is one of my favorite kinds:

- useful immediately
- small enough to understand
- rich enough to teach real lessons

It’s also a good reminder that “AI-assisted coding” is best when you treat it like a fast collaborator: let it draft, then **force the result to earn trust** with careful handling of timeouts, limits, caching, and real-world UI behavior.

If you want to build your own version, start with the CLI, then bolt on the map once you trust your data layer. That sequence keeps the project fun.
