---
title: "System Design Daily: The Claim Check Pattern for Large Messages"
pubDate: 2026-05-26
description: "How to keep queues healthy by sending pointers instead of giant payloads."
tags: ["system-design", "engineering", "distributed-systems", "messaging", "architecture"]
---

Queues and event buses are wonderful right up until somebody starts treating them like a file transfer protocol.

It usually happens for understandable reasons. A team has an image to process, a PDF to OCR, a big customer export to fan out, or an event with a lot of embedded context. Shoving the whole payload into the message feels convenient. The producer sends one thing, the consumer reads one thing, and everyone moves on.

Then the system gets older.

Now brokers are storing fat messages, retries are expensive, consumers spend time deserializing data they do not need, and a backlog that used to be manageable becomes painful because every message is heavy. Your queue is not just carrying work. It is carrying baggage.

This is where the claim check pattern helps.

The idea is simple: put the large payload somewhere built for blob storage, then send a small reference through the queue. The message carries a claim check, not the whole suitcase.

## The problem

Messaging systems are usually optimized for lots of reasonably small messages. Even when a broker technically allows big payloads, large messages create second-order problems:

- broker disk usage grows fast
- replication and cross-zone traffic get more expensive
- retries copy large blobs again and again
- consumer throughput drops because network and parsing costs dominate
- backlogs become harder to drain during incidents

A system that handles 10,000 messages per minute looks very different when the average message is 4 KB versus 4 MB.

At 4 KB, one minute of backlog is noise.

At 4 MB, one minute of backlog is roughly 40 GB of payload movement, not counting replication. That is how a normal retry storm turns into an infrastructure story.

## Core concepts

### 1) Separate control plane from data plane

I like this framing because it keeps the design honest.

The queue is the control plane. It says *what work should happen*.

Blob storage is the data plane. It stores *the large bytes needed to do that work*.

When you mix both responsibilities into the broker, you pay broker prices for storage and broker complexity for transport.

### 2) A claim check is just a durable pointer

A producer writes the large payload to object storage, gets back an identifier or URI, and publishes a small message like:

```json
{
  "jobId": "job_7812",
  "type": "ImageResizeRequested",
  "payloadRef": "s3://media-jobs/2026/05/26/job_7812/original.json",
  "checksum": "sha256:2d8...",
  "expiresAt": "2026-05-27T18:00:00Z"
}
```

The consumer fetches the referenced object, validates it if needed, does the work, and optionally writes its own output somewhere else.

That sounds boring, and boring is good here.

### 3) The pointer is now part of your consistency story

The pattern introduces an extra step, which means you need a clear answer to a basic question:

What happens if the object upload succeeds but the queue publish fails, or vice versa?

In practice, this is the same kind of reasoning you do for outbox patterns and asynchronous workflows. You need idempotent writes, cleanup of orphaned blobs, and some way to reconcile mismatches.

## A small example

Suppose a document-processing service receives uploads from users. Each PDF averages 12 MB. A naive design might publish this directly to a queue:

```txt
Upload API -> Queue -> OCR Worker -> Indexer
```

A healthier version looks like this:

```txt
Upload API -> Object Storage
           -> Queue(message with document_id + object_key)
Queue -> OCR Worker -> Object Storage(result text)
                   -> Queue(index request with result pointer)
```

Now imagine 500 uploads arrive in five minutes.

| Design | Avg message size | Approx queue payload for 500 jobs |
| --- | ---: | ---: |
| Full PDF in queue | 12 MB | 6 GB |
| Claim check message | 1 KB | 500 KB |

That table is almost unfair, but that is the point. The queue should coordinate work, not impersonate bulk storage.

## Tradeoffs

The claim check pattern is not free.

**What you gain:**

- much smaller queue payloads
- higher broker throughput
- easier retries because you are retrying references, not giant blobs
- better fit for payloads that are reused by multiple consumers
- clearer lifecycle management for large artifacts

**What you pay:**

- one more network hop for consumers
- more moving parts
- object storage permissions and retention become design concerns
- you need cleanup for orphaned or expired blobs
- producer logic gets slightly more complex

My opinionated take: if the payload is regularly large enough that message size is a topic in architecture review, you are probably already late.

## Common failure modes

### 1) The blob disappears before the consumer gets there

This is the most obvious failure. Someone sets a short TTL, a lifecycle rule is too aggressive, or the consumer backlog lasts longer than expected.

Now the queue message is still valid, but the data it points to is gone.

The fix is operational discipline:

- align object retention with worst-case processing delay
- surface fetch failures separately from normal processing failures
- include expiration metadata in the message

### 2) Orphaned payloads pile up

Sometimes the upload succeeds and the publish fails. Sometimes a client retries and writes duplicates. Sometimes downstream processing is canceled but the object never gets deleted.

Without cleanup, object storage becomes the graveyard of every partial workflow your system has ever attempted.

Have a janitor job. Every serious claim check system eventually needs one.

### 3) Consumers trust the pointer too much

If a consumer blindly reads any referenced object, you can end up with wrong-bucket reads, stale versions, or security bugs.

At minimum, include enough metadata to validate:

- expected checksum
- expected content type
- expected tenant or namespace
- object version, if your store supports it

### 4) The claim check message is too small to be useful

Teams sometimes overcorrect and send only a random key. Then every consumer needs multiple extra lookups to figure out what the payload means.

Keep the message small, but not empty-headed. The message should still carry routing and operationally useful metadata, such as tenant ID, job type, schema version, and deadline.

### 5) Fetch-on-retry causes thundering-herd reads

If a large batch of workers keeps retrying the same broken job, they may hammer object storage fetching the same payload over and over.

This is where local caching, request coalescing, or bounded retry policies matter.

## How to test it before production

First, test the unhappy paths, not just the sunny path where upload and publish both succeed.

### Test 1: Publish failure after object write

Write the payload, fail the queue publish, and confirm you can either safely retry or reliably clean up the orphan.

### Test 2: Missing object

Inject a message whose object key does not exist. The worker should fail in a classified way, not with a generic mystery timeout.

### Test 3: Corrupt or mismatched blob

Serve content with the wrong checksum or wrong content type. Make sure the consumer refuses it loudly.

### Test 4: Backlog and retention test

Simulate a long consumer delay and verify that objects still exist when workers finally process the queue.

### Test 5: Multi-consumer load test

If several consumers read the same referenced payload, measure storage egress, fetch latency, and cache hit rates. Sometimes the queue problem you solved becomes a storage-read problem you created.

## What to observe in production

If you adopt this pattern, watch both message flow and blob lifecycle.

At minimum, instrument:

- queue depth and age
- average message size
- object fetch latency
- object fetch failure rate
- checksum mismatch count
- orphan cleanup count
- object age at time of processing
- storage egress and request rate

A particularly useful derived metric is **message age versus object expiration headroom**. If messages are routinely being processed close to the object TTL boundary, you are operating with less safety margin than you think.

I also like sampling end-to-end traces that show:

```txt
upload object -> publish message -> fetch object -> process -> write result
```

That makes it much easier to see whether latency lives in the broker, the storage layer, or the worker itself.

## When to use it, and when not to

Use the claim check pattern when:

- payloads are large or spiky
- multiple consumers may need the same artifact
- your broker is becoming a bottleneck because of message size
- payload retention and retrieval deserve explicit management

Do not bother when messages are already small, processing is simple, and the extra storage hop would add more complexity than value.

Not every system needs this. But systems that move documents, media, model inputs, exports, or bulky event snapshots often do.

## The real lesson

The claim check pattern is not really about shrinking messages. It is about assigning responsibilities to the right components.

Queues are good at coordination, ordering, fan-out, and backpressure.
Object stores are good at durable large-object storage.

When you let each layer do its real job, the whole system gets easier to scale, cheaper to retry, and less fragile during backlog recovery.

That is usually a good trade.

## Further reading

- [Enterprise Integration Patterns: Claim Check](https://www.enterpriseintegrationpatterns.com/patterns/messaging/StoreInLibrary.html)
- [Amazon SQS Extended Client Library for Java](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-s3-messages.html)
- [Google Cloud Architecture Framework: Design for Resilience](https://cloud.google.com/architecture/framework/reliability)
- [Designing Data-Intensive Applications](https://dataintensive.net/)
