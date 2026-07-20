---
title: "System Design Daily: Replica Placement and Failure Domains"
pubDate: 2026-07-20
description: "Why three replicas are not enough if you put them in the wrong places, and how failure domains should shape your durability design."
tags: ["system-design", "engineering", "distributed-systems", "reliability", "storage", "operations"]
---

A lot of distributed systems diagrams lie by omission.

They show three replicas, a quorum, maybe a load balancer, and everyone nods because it looks redundant. But redundancy is not the same as resilience. If all three replicas share the same bad fate, you did not build fault tolerance, you just built synchronized disappointment.

That is why **replica placement** matters just as much as replica count.

The practical question is not “how many copies do we have?” It is **“what kinds of failures can take multiple copies out at once?”** Those shared blast radiuses are your **failure domains**.

If you remember one thing from this post, make it this: **replication only buys safety when replicas fail independently often enough to matter**.

## Problem framing

Imagine a service with a replication factor of 3.

On paper, that sounds healthy. Lose one node, still have two. Lose another, maybe you can limp along. Great.

Now imagine those three replicas are:

- all on the same rack
- all in the same availability zone
- all using the same power circuit
- all in the same Kubernetes node pool with the same bad rollout policy

You still have three replicas, but a single rack switch failure, AZ outage, or operator mistake can erase most of the benefit instantly.

This is the trap: engineers often reason about **node failures** while real incidents are often **correlated failures**.

Common correlated failure domains include:

- machine
- rack
- power feed
- top-of-rack switch
- availability zone
- cloud region
- storage subsystem
- deployment group
- control plane or operator action

System design gets better the moment you stop asking “what if one server dies?” and start asking “what if a whole class of things fails together?”

## Core concepts

### 1. A failure domain is a shared fate boundary

A failure domain is any boundary inside which failures are more correlated than you would like.

Hardware examples are obvious: one host, one rack, one AZ.

But software and operational examples matter too:

- all replicas running the same new binary
- all leaders assigned to one zone
- all storage nodes depending on the same metadata service
- all instances managed by the same autoscaling mistake

If one bad event can hurt multiple replicas together, that event defines a failure domain.

### 2. Replica count and placement solve different problems

Replica count helps with random loss. Placement helps with correlated loss.

A replication factor of 3 placed across 3 zones is materially different from a replication factor of 3 placed on 3 hosts in one zone.

Here is the simple version:

| Layout | Survives single host failure? | Survives rack failure? | Survives AZ failure? |
| --- | --- | --- | --- |
| 3 replicas in one rack | Yes | No | No |
| 3 replicas across 3 racks in one AZ | Yes | Yes | No |
| 3 replicas across 3 AZs | Yes | Yes | Often yes, if quorum still works |

Same replica count. Totally different risk profile.

### 3. Quorum math only makes sense relative to topology

Teams love saying “we use 3 replicas and quorum writes” as if that ends the conversation.

It does not.

If your write quorum is 2 of 3, then placement determines which failures still leave you with 2 reachable copies.

Example:

```text
Replica A -> zone-a
Replica B -> zone-b
Replica C -> zone-c
Write quorum = 2
Read quorum = 2
```

If zone-b disappears, zones a and c can still serve quorum traffic.

But if A and B were both in zone-a and C were in zone-b, then a single zone-a outage drops you to one replica immediately. Your quorum design did not save you because your placement undercut it.

### 4. Leaders should not all live in the same neighborhood

Even when replicas are spread out, load may not be.

Some systems accidentally place leadership, primaries, or hot partitions unevenly. Then one zone becomes the home of too much write traffic, too many consensus leaders, or too many cache owners. Everything looks redundant until that zone wobbles and the whole cluster spends five miserable minutes re-electing, rebalancing, and timing out.

Placement is not just about data copies. It is also about **where work concentrates**.

## A small example

Suppose you run an internal event store with:

- 12 partitions
- replication factor 3
- 3 availability zones
- each partition has 1 leader and 2 followers

A naive placement might accidentally put 8 of the 12 leaders in zone-a. That may happen because zone-a had slightly more spare capacity during earlier rebalances.

Everything is fine until zone-a has a network event.

Now you do not just lose one-third of capacity. You also trigger leader failover for most partitions at once. Write latency spikes, client retries pile up, and the surviving zones take a thundering herd of leadership transfers.

A better placement policy aims for two kinds of balance:

1. **Replica spread** across independent failure domains
2. **Role spread** so leaders and hot shards are not over-concentrated

A simplified placement target could look like this:

```text
For each partition:
  place one replica per AZ
  avoid same-rack placement within an AZ when possible
  keep leader counts within +/- 1 per AZ
```

That is not mathematically perfect, but it is vastly better than hoping the scheduler will do something reasonable by accident.

## Tradeoffs

Replica placement is one of those topics where the right answer is annoyingly contextual.

### Wider placement improves resilience, but raises coordination cost

Placing replicas across AZs or regions usually improves fault tolerance. It also increases:

- write latency
- cross-zone network cost
- exposure to transient inter-zone network issues

This is why some systems choose synchronous replication across zones but asynchronous replication across regions. They are balancing failure tolerance against latency and cost.

### Too much locality is risky, too little locality is expensive

If you force every write to travel very far, your tail latency will remind you. If you keep everything close together, your blast radius will remind you.

There is no free lunch here. You are choosing which pain you can afford.

### Placement constraints can fight rebalancing and autoscaling

Strict anti-affinity rules are good for resilience, but they can make capacity management harder.

If one zone is short on room, the system may have to choose between:

- violating a placement rule
- delaying replication repair
- overloading healthy nodes

Good systems make that tradeoff explicit instead of hiding it.

## Common failure modes

### “Three replicas” all share one real dependency

Maybe they are on different hosts, but the same rack switch. Or different pods, same node pool. Or different AZs, same control plane bottleneck.

This is the most common design mistake: replicas look independent in inventory, but not in practice.

### Re-replication storms after a domain failure

A zone fails, and the system immediately starts copying huge amounts of data to restore full replica count. That sounds smart until it saturates the surviving cluster while it is already degraded.

Sometimes the right move is to run temporarily under-replicated, with guarded repair speed, until the failure is confirmed durable.

### Leader concentration causes secondary outages

Losing a zone should not also mean losing most of your leaders. If it does, your placement policy optimized for storage symmetry and forgot workload symmetry.

### Testing only host failures

Chaos tests that kill one instance are useful, but they are the tutorial level. Real confidence comes from testing rack, AZ, dependency, and rollout failures.

## How to test and observe this in production

You should be able to answer three questions at any time:

1. Where are my replicas?
2. What failure domains do they share?
3. What happens if I lose one of those domains right now?

### Useful production metrics

- replica distribution by zone, rack, and node pool
- number of under-replicated partitions
- leader distribution by failure domain
- cross-zone replication latency
- repair bandwidth and backlog
- percentage of partitions that would lose quorum if a specific zone failed

That last one is especially good. It turns topology from a pretty diagram into a real operational signal.

### Practical tests

- drain one rack or node pool and observe quorum behavior
- simulate one AZ becoming unreachable
- verify repair throttling after a large failure
- rebalance leaders deliberately and check whether latency stabilizes
- run placement audits after every major capacity change

A placement audit can be very simple:

```text
For every partition:
  count distinct AZs
  count distinct racks
  note leader location
  flag any shared-fate violations
```

You want this automated. Manual topology review is the kind of thing teams promise to do right after the incident retro and then forget for six months.

## Practical design advice

A few opinionated rules hold up surprisingly well:

- spread replicas across the highest-value failure domain first, usually AZ before rack
- separate data placement from leader placement, then balance both
- repair slowly enough that recovery does not become a second outage
- treat deployment groups and control planes as failure domains too
- audit placement continuously, not just at cluster creation time

The hidden lesson here is that **topology is part of correctness**.

We often talk about correctness like it lives in algorithms, quorum formulas, and protocol proofs. It does. But the physical or cloud layout underneath those algorithms matters just as much. A sound consensus protocol on bad placement is still a fragile system.

Replication is not only about copies. It is about **independence**.

That is the design bar worth holding.

## Further reading

- [Google Spanner: Becoming a SQL System](https://research.google/pubs/pub46103/)
- [Apache Cassandra docs: NetworkTopologyStrategy](https://cassandra.apache.org/doc/stable/cassandra/architecture/dynamo.html)
- [CockroachDB docs: Replication Zones](https://www.cockroachlabs.com/docs/stable/configure-replication-zones)
- [Google SRE Book: Handling Overload and Failure](https://sre.google/sre-book/)
