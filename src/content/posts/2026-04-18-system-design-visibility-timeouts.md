---
title: "System Design Daily: Visibility Timeouts"
pubDate: 2026-04-18
description: "Why queue workers need leases, not blind trust, and how visibility timeouts shape retries, duplicates, and operational safety."
tags: ["system-design", "engineering", "distributed-systems", "queues", "reliability"]
---

If you run asynchronous jobs long enough, you eventually learn an annoying truth: pulling a message from a queue is not the same thing as finishing the work.

That gap is where systems get weird.

A worker can receive a job, start processing it, and then crash halfway through. The network can drop after the worker actually finished, but before the queue saw the acknowledgement. A dependency can slow down just enough that a "normally safe" timeout becomes a duplicate-work machine.

This is why serious queues have some version of a **visibility timeout**. The idea is simple: when a worker claims a message, the queue hides that message from other workers for a limited period. If the worker finishes in time, it acknowledges the message and the queue deletes it. If not, the message becomes visible again for retry.

That sounds like an implementation detail. It is not. Visibility timeouts are one of the core control knobs for reliable background processing.

## The problem it solves

Without a visibility timeout, a queue usually falls into one of two bad designs:

1. **Delete on receive**, which loses work if the worker dies mid-job.
2. **Never hide the job**, which lets multiple workers process the same message at once.

A visibility timeout gives you a middle path:

- the message is temporarily leased to one worker,
- other workers stay away for a while,
- unfinished work can still be retried later.

So the right mental model is not "the worker owns the message." It is **"the worker holds a lease on the message."**

That framing matters, because leases expire.

## Core concepts

### Receive, process, ack

Most queue systems reduce to this lifecycle:

```text
producer -> queue -> worker receives message
                    queue hides message for T seconds
                    worker does the work
                    worker acks before T expires
                    queue deletes message
```

If the worker does not ack before `T`, the queue assumes the lease is gone and makes the message available again.

### At-least-once delivery

Visibility timeouts are a big reason most production queues offer **at-least-once delivery**, not exactly-once processing.

The queue is choosing durability over elegance. If it is unsure whether work completed, it would rather retry than silently lose the job.

That means your workers must tolerate duplicates.

### Static vs dynamic visibility timeouts

A static timeout is easy: every job gets, say, 60 seconds.

That works only when job duration is tightly bounded. Real systems usually are not that polite.

A better pattern is:

- set an initial timeout based on expected job size,
- extend the timeout while the worker is still healthy,
- fail visibly if the worker stops renewing its lease.

This is basically a heartbeat-backed lease.

### Dead-lettering after repeated failures

A message that keeps timing out forever is not "still trying." It is a stuck operational problem.

After some retry threshold, move it to a DLQ or quarantine stream so humans or repair automation can inspect it.

## A small example

Imagine an image-processing service:

- average job: 8 seconds
- p95 job: 25 seconds
- rare large uploads: 90 seconds

If you set the visibility timeout to 10 seconds, you will create duplicate work for many healthy jobs.
If you set it to 5 minutes, crashed workers take too long to release their jobs for retry.

A better design is:

- initial visibility timeout: 30 seconds
- worker heartbeat every 10 seconds
- extend visibility by another 30 seconds on each heartbeat
- max total processing lease: 3 minutes
- send to DLQ after 5 delivery attempts

Pseudo-API:

```http
POST /jobs
{ "imageId": "img_123", "variant": "thumbnail" }
```

Worker logic:

```text
receive(job, visibility=30s)
start heartbeat to extend lease every 10s
process image
write result to object store
upsert job_result(imageId, variant)  # idempotency boundary
ack message
```

Notice the important part: the side effect is written through an **idempotent key**. If the job is retried, the second worker should not create a second conflicting result.

## Tradeoffs

Here is the design tension in one table:

| Choice | Good for | Bad for |
| --- | --- | --- |
| Short visibility timeout | Faster recovery from worker crashes | More duplicate processing during slow jobs |
| Long visibility timeout | Fewer accidental retries | Slower recovery, more work stranded behind dead workers |
| Automatic lease extension | Handles long-running jobs gracefully | More complexity, heartbeat bugs, harder debugging |
| Aggressive redelivery | Throughput and resilience | Can amplify broken dependencies or poison messages |

My opinion: teams often make visibility timeouts too long because duplicates feel scary. That usually hides deeper design problems.

Duplicate processing is not the disease. **Non-idempotent workers** are the disease.

## Common failure modes

### 1. Timeout shorter than real work

This is the classic one. A healthy worker is still processing when the lease expires, so another worker picks up the same message.

Symptoms:

- duplicate writes
- repeated emails or notifications
- "why did this charge happen twice?" incidents

### 2. Acking before durable side effects

A worker finishes "logically," sends the ack, then crashes before the database write or external API call actually becomes durable.

Now the queue thinks the job is done, but the world does not.

Ack should happen **after** your durable side effects, not before.

### 3. Lease extension without health checks

Some workers blindly renew visibility while they are hung on a deadlock or stuck dependency. The message stays invisible forever even though no progress is happening.

Renewals should be tied to actual forward progress or at least a healthy event loop.

### 4. Retry storms

If a downstream service slows down, workers miss their timeouts, messages reappear, more workers pick them up, and load multiplies right when the dependency is weakest.

Visibility timeouts interact directly with backpressure and concurrency limits. If you do not connect those systems, you can turn retries into self-harm.

### 5. No per-job sizing

A 200 ms email-send job and a 20-minute video-transcode job should not share the same lease policy.

Long-tail jobs need either separate queues or explicit timeout classes.

## How to test it

Do not trust queue semantics you have not abused on purpose.

In staging or a controlled production canary, test these cases:

1. **Worker crash after receive, before ack**  
   Verify message becomes visible again within the expected window.

2. **Worker crash after side effect, before ack**  
   Verify duplicate delivery does not duplicate the business outcome.

3. **Slow dependency causing lease expiry**  
   Verify duplicate rate rises, but system stays safe and alerts fire.

4. **Heartbeat stopped mid-job**  
   Verify lease eventually expires and another worker can recover the work.

5. **Poison message loop**  
   Verify max-attempt logic routes the message to a DLQ.

A useful chaos test is to kill a percentage of workers randomly during job execution. If the system becomes financially or operationally dangerous, the queue is not the real issue, your job handler is.

## How to observe it in production

At minimum, monitor:

- queue depth
- message age / oldest unprocessed message
- ack latency
- visibility extensions per message
- redelivery count
- DLQ rate
- duplicate-detection rate at the idempotency layer
- worker crash rate and timeout rate

Two especially useful derived metrics:

- **redeliveries / completed jobs**: rising means your leases are too short or your workers are unhealthy
- **messages exceeding expected processing class**: rising means your workload profile changed before your configs did

And please log a stable message or job ID on every receive, renew, ack, and failure. Queue debugging without correlation IDs is misery.

## The practical takeaway

Visibility timeouts are not just a queue setting. They are part of your correctness model.

A good setup treats each message like leased work:

- lease it for a realistic window,
- renew only while healthy,
- make side effects idempotent,
- ack only after durable success,
- stop infinite retries with DLQs,
- observe duplicate and timeout behavior like first-class signals.

If you do that, retries become boring. And in distributed systems, boring is usually the win.

Further reading:

- [Amazon SQS visibility timeout docs](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-visibility-timeout.html)
- [Google Cloud Pub/Sub lease management](https://cloud.google.com/pubsub/docs/lease-management)
- [RabbitMQ consumer acknowledgements](https://www.rabbitmq.com/docs/confirms)
- [Designing Data-Intensive Applications by Martin Kleppmann](https://dataintensive.net/)
