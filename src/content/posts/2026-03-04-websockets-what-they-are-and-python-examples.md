---
title: "WebSockets, Explained: Real-Time Connections Without the Mystery (Plus Python Examples)"
pubDate: 2026-03-04
description: "What WebSockets are, how the handshake upgrades HTTP, what to watch out for in production, and a few practical Python patterns."
tags: ["web", "networking", "python", "backend", "system-design"]
---

WebSockets are one of those technologies that feel obvious once you’ve used them… and confusing right up until that point.

You already know the problem they solve:

- You have a web app.
- Something changes on the server.
- You want the UI to update **now**, not “whenever the client polls again.”

So you start with polling:

- `GET /notifications` every 5 seconds.

And eventually you realize you’ve built a machine that:

- wastes bandwidth
- introduces latency (up to your poll interval)
- melts your servers at scale (lots of mostly-empty requests)

WebSockets are the “okay, let’s do this properly” upgrade.

This post covers:

- what WebSockets are
- how they work (handshake, frames, ping/pong)
- what they’re used for
- production gotchas (proxies, scaling, auth, backpressure)
- practical Python examples (server + client)

## What is a WebSocket?

A **WebSocket** is a long-lived, two-way (“full duplex”) connection between a client and a server.

Once it’s established:

- the client can send messages to the server at any time
- the server can push messages to the client at any time
- you don’t need a new HTTP request for each message

In other words: it’s a persistent pipe.

### The mental model

- **HTTP** is mostly “request → response → done.”
- **WebSockets** are “connect → keep talking.”

This is why WebSockets are popular for real-time UX:

- chat
- multiplayer games
- collaborative editing
- live dashboards
- stock tickers / telemetry
- “job progress” streaming (builds, uploads, background tasks)

## How WebSockets work (the upgrade handshake)

WebSockets start life as an HTTP request.

The client makes an HTTP request with headers that say, basically:

> “Hey server, can we upgrade this connection to WebSocket?”

If the server agrees, it returns an HTTP response indicating an upgrade, and from that point on the connection speaks the WebSocket protocol.

Key points:

- The handshake happens over HTTP (usually HTTP/1.1).
- After upgrade, messages are sent as **WebSocket frames**.
- The connection stays open until one side closes it.

If you’ve ever seen a request like this in your logs, that’s the handshake:

- `Connection: Upgrade`
- `Upgrade: websocket`

### Why the “upgrade” design matters

Because the initial request is HTTP, WebSockets fit into existing web infrastructure:

- same domain / same origin policy rules
- TLS termination (wss://) is normal
- authentication can be tied into your existing cookie/header story

But it also means you inherit some HTTP-ish pain:

- reverse proxies need to support upgrades
- load balancers need sane timeout settings

## WebSockets vs alternatives (quick comparison)

There’s no single “best” real-time tool. Here’s the practical split:

| Approach | Direction | Good for | Common downside |
|---|---|---|---|
| Polling | client → server | simple “check for updates” | wasteful + latency |
| Long polling | client → server (held open) | incremental improvement | still request-driven, trickier infra |
| Server-Sent Events (SSE) | server → client only | one-way streaming updates | client can’t send messages on the same channel |
| WebSockets | bidirectional | chat/collab/interactive real-time | stateful connections, scaling complexity |

SSE is underrated. If you only need server → client updates (think: “live feed”), SSE is often simpler.

But if you need real two-way interaction (chat, typing indicators, collaborative cursors), WebSockets shine.

## What does a WebSocket message look like?

At the protocol level, messages are frames. At the application level, you usually decide on a format like:

- JSON messages (common)
- protobuf (more efficient)
- plain text (fine for demos)

A typical JSON message pattern:

```json
{ "type": "chat.message", "room": "general", "text": "hi" }
```

A good practice is to include:

- a `type` field (so you can route/handle messages cleanly)
- an `id` (for tracing / idempotency / debugging)
- timestamps (server-side is best)

## Production gotchas (the stuff that bites later)

### 1) Proxies, load balancers, and timeouts

WebSockets are long-lived. Many HTTP infrastructures were built assuming requests are short.

Common failures:

- a proxy silently closes “idle” connections
- a load balancer has a low timeout
- a CDN doesn’t support WS on a route

Mitigations:

- use **ping/pong** keepalives
- configure idle timeouts appropriately
- test behind the *same* proxy/LB setup you’ll run in prod

### 2) Authentication: handshake time vs message time

You can authenticate:

- at handshake time (cookies, headers, tokens)
- and/or per message (attach a token in each message)

Handshake-time auth is common and efficient.

But be aware:

- if you use cookies, the browser will send them automatically (good and scary)
- if you use tokens in query params (e.g. `wss://.../ws?token=...`) you might leak tokens into logs

If you need strict control, consider:

- auth header during handshake (non-browser clients)
- short-lived tokens
- re-auth / refresh strategies

### 3) Backpressure: the server can’t always keep up

A WebSocket is a firehose if you let it be.

If you broadcast too fast or a client is slow:

- buffers grow
- memory spikes
- latency balloons
- eventually you start dropping connections or crashing

Good systems have:

- bounded queues
- drop strategies (drop oldest, drop newest, degrade)
- rate limits
- backpressure signaling (“slow down”) when possible

### 4) Horizontal scaling: where do you send messages?

If you run one server process, it’s easy:

- connections live in memory
- you push to them directly

If you run **10** server instances behind a load balancer, it gets interesting:

- user A might be connected to instance #3
- user B might be connected to instance #7

If you need to broadcast or send targeted messages, you need a shared coordination layer:

- Redis pub/sub
- a message broker (NATS, Kafka, RabbitMQ)
- a WS gateway layer

Also, if you need to guarantee ordering or “exactly once” delivery, you’re in distributed systems territory (and you should lower your expectations accordingly).

### 5) Delivery semantics: WebSockets are not a message queue

WebSockets are a transport, not a durable log.

If the connection drops:

- messages in flight can be lost

If you need durability:

- persist events server-side (DB or stream)
- on reconnect, let the client catch up (“give me events since cursor X”)

A robust pattern is:

- WS for low-latency updates
- HTTP endpoint for catch-up and reconciliation

## Python example: a simple WebSocket server

The modern, widely-used Python library is `websockets`.

Install:

```bash
pip install websockets
```

Here’s a tiny echo server with JSON handling:

```python
# server.py
import asyncio
import json
import websockets

async def handler(ws):
    # ws is a WebSocketServerProtocol
    print("client connected")

    try:
        async for message in ws:
            # message is a str (unless you send binary frames)
            try:
                data = json.loads(message)
            except json.JSONDecodeError:
                data = {"type": "text", "text": message}

            # Example: simple routing by type
            msg_type = data.get("type")
            if msg_type == "ping":
                await ws.send(json.dumps({"type": "pong"}))
            else:
                # echo back
                await ws.send(json.dumps({"type": "echo", "data": data}))

    except websockets.ConnectionClosed:
        print("client disconnected")

async def main():
    # Listen on localhost:8765
    async with websockets.serve(handler, "127.0.0.1", 8765):
        print("ws://127.0.0.1:8765")
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    asyncio.run(main())
```

Run it:

```bash
python server.py
```

### A note about frameworks

For real apps, you often want WebSockets integrated into a web framework:

- **FastAPI / Starlette** have native WebSocket routes
- **Django Channels** provides an ecosystem for websockets + background workers

The pure `websockets` library is great for learning and for dedicated WS services.

## Python example: a WebSocket client

Here’s a matching client:

```python
# client.py
import asyncio
import json
import websockets

async def main():
    uri = "ws://127.0.0.1:8765"

    async with websockets.connect(uri) as ws:
        await ws.send(json.dumps({"type": "ping"}))
        print("sent ping")

        reply = await ws.recv()
        print("got:", reply)

        await ws.send(json.dumps({"type": "chat.message", "room": "general", "text": "hello"}))
        print("sent chat.message")

        reply = await ws.recv()
        print("got:", reply)

if __name__ == "__main__":
    asyncio.run(main())
```

Run it in another terminal:

```bash
python client.py
```

## Example pattern: broadcasting updates to many clients

A common pattern is:

- keep a set of connected clients
- when an event happens, broadcast a message

Very rough sketch:

```python
import asyncio
import json
import websockets

clients = set()

async def handler(ws):
    clients.add(ws)
    try:
        async for _ in ws:
            pass  # ignore inbound for this demo
    finally:
        clients.remove(ws)

async def broadcaster():
    i = 0
    while True:
        i += 1
        msg = json.dumps({"type": "tick", "n": i})

        # broadcast to all connected clients
        if clients:
            await asyncio.gather(*(c.send(msg) for c in list(clients)), return_exceptions=True)

        await asyncio.sleep(1)

async def main():
    async with websockets.serve(handler, "127.0.0.1", 8765):
        await broadcaster()

asyncio.run(main())
```

In production you’d want:

- per-client send queues (bounded)
- try/except per send
- disconnect slow clients

This is where the “backpressure vs load shedding” conversation starts to matter.

## Debugging tips (practical)

- Use browser DevTools → Network → WS to inspect frames.
- Log message types + ids, not full payloads (avoid leaking sensitive data).
- Add tracing around broadcast fan-out (it’s a common latency hotspot).
- Track metrics:
  - active connections
  - messages/sec in/out
  - send queue size
  - reconnect rate
  - abnormal closes

## Links (good references)

- RFC 6455 (the WebSocket protocol): https://www.rfc-editor.org/rfc/rfc6455
- MDN WebSockets overview (excellent practical explanation): https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API
- Python `websockets` library docs: https://websockets.readthedocs.io/
- FastAPI WebSockets docs: https://fastapi.tiangolo.com/advanced/websockets/

---

If you tell me what you’re building (chat? dashboards? job progress?), I can sketch a concrete architecture: where WS sits, what the message schema should look like, and how to make reconnect + catch-up robust.
