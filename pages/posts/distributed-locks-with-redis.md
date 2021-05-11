---
title: 用 Redis 实现分布式锁
date: 2020/10/26
description: Redis 分布式锁相关文档的梳理。
tag: notes, dist-sys
author: 陈易生
---

# 用 Redis 实现分布式锁

## 分布式锁

在多线程共享内存数据的场景下，一个线程为了获得对数据的排他（exclusive）访问，通常先获取（acquire）锁，随后进行对数据的操作，最后释放（release）锁。而在多客户端（clients）共享数据的场景下，一个客户端为了获得对数据的排他访问，需要进行类似的操作。由于在第二个场景中，客户端之间、客户端和数据之间都可能位于通过网络进行通信的不同节点上，具有分布式的性质，因此在该场景下进行的锁机制被称为分布式锁。

Redis 作者认为分布式锁应该同时保证 safety 和 liveness。

1. Safety：互斥。在任一时点，只有一个客户端可以持有限制访问某一资源的锁。
2. Liveness A：无死锁。即便持有锁的客户端宕机或发生网络分区（network partition），客户端最终（eventually）仍有可能获取锁。
3. Liveness B：容错。只要 Redis 集群中的大多数节点仍在线，客户端就可以获取和释放锁。

[Redis 文档](https://redis.io/topics/distlock)探讨了两种分布式锁的实现，两种方案都需要客户端和服务器端 Redis 集群进行配合。

## 基于复制的实现

在服务器端，维护多个 Redis 节点，其中一个节点为主（leader）节点，其余为从（follower）节点。主节点接收写，并异步地将写复制到从节点上。主节点下线后，任命其中一个仍在线的从节点作为新的主节点，继续接收写。

在客户端，通过在 Redis 主节点上新建一个 key，并设置失效时间来获取锁，即 `SET resource-name any-value EX 100`，其中锁的名字为 resource-name，锁的时限（lock validity time）为 100 秒。持有锁的客户端通过删除该 key 来释放锁，即 `DEL resource-name`。

正确性上，容易证明这个实现满足两个 liveness 特性。对于无死锁特性，如果一个客户端在获取锁后下线，Redis 上的 key 在指定时限过后会失效，此后客户端仍然可以成功获取该锁。对于容错，由于所有写都发生在主节点上，因此只要主节点仍在线，客户端就可以获取和释放锁。

但是，该实现在以下场景无法保证 safety。

1. 客户端 1 获取锁。
2. 主节点上的写还没来得及异步传输到从节点上，就下线了。
3. 从节点被任命为主节点。
4. 客户端 2 获取同一把锁。此时客户端 1 和客户端 2 都持有锁。

该实现存在两个漏洞。其一，客户端 2 可以轻易地获取与客户端 1 相同的锁。为了避免客户端 2 获取客户端 1 的锁，可以使用 `SET` 命令的 `NX` 参数，即 `SET resource-name any-value NX EX 100`。参数 `NX` 保证 `SET` 命令只在 key 不存在时生效。因此，客户端 2 在试图获取同一个锁时，如果客户端 1 获得的锁还没有失效，则 `SET` 命令无效，获取锁失败。演示如下，可见客户端 2 无法获取客户端 1 正持有的锁。

```
client1> SET resource-name any-value NX EX 100
OK

client2> SET resource-name any-value NX EX 100
(nil)
```

该实现的第二个漏洞在于，客户端 2 为了获取同一个锁，可能先释放客户端 1 获得的锁，然后再获取该锁。为了防止客户端 2 释放客户端 1 持有的锁，可以要求客户端在获取锁时，传入一个 token 作为 value，即 `SET resource-name token NX EX 100` 。在释放锁时，客户端传入 token 以示身份，Redis 首先确认传入的 token 与 Redis 记载的 token 相同，才会删除 key，即 `if redis.call("get",KEYS[1]) == ARGV[1] then return redis.call("del",KEYS[1]) else return 0 end`。因此，只要客户端 2 猜不出客户端 1 的 token，客户端 2 就无法释放客户端 1 持有的锁。演示如下，可见客户端 2 在客户端 1 释放锁之前，无法获取客户端 1 持有的锁。

```
client1> SET resource-name token1 NX EX 100
OK

client2> eval 'if redis.call("get",KEYS[1]) == ARGV[1] then return redis.call("del",KEYS[1]) else return 0 end' 1 resource-name token2
(integer) 0

client1> eval 'if redis.call("get",KEYS[1]) == ARGV[1] then return redis.call("del",KEYS[1]) else return 0 end' 1 resource-name token1
(integer) 1

client2> SET resource-name token2 NX EX 100
OK
```

## Redlock

在服务器端，维护 N 个 Redis 主节点。每个节点互相独立，且均不设副本。

在客户端，获取锁的步骤如下：

1. 获得当前时间戳。
2. 使用同样的 resource-name 和 token，逐个向 N 个 Redis 节点申请锁，并为单个锁的申请设置时限，称之为“锁申请时限”。如果锁的时限是 10 秒，则锁申请时限可以设置为 5 至 50 毫秒。这一设定确保了，如果客户端向某个节点申请锁的过程中，该节点下线，客户端不会一直等待。当锁申请时限已至，如果客户端没能成功地从某个节点获取锁，客户端就会跳过该节点。
3. 在遍历完成后，客户端计算从开始向第一个 Redis 节点申请锁至今花费了多少时间。如果客户端获取了超过 N/2+1 个锁，且耗时小于锁的时限，则称客户端成功获取锁。
4. 如果客户端获取锁失败，则客户端向全部 N 个 Redis 节点要求释放锁。

如果上述步骤结束，客户端未能获取锁，则可以在一个随机延时后进行重试，防止多个客户端同时重试。

客户端获取锁的过程很简单，只需向全部 N 个 Redis 节点要求释放锁即可。

文档并没有对算法的正确性给出形式化的证明，因此我只能尝试做个非形式化的证明。

- Safety：如果名为 resource-name 的锁已被客户端 1 持有，则至少 N/2+1 个 Redis 节点上存在 `resource-name=token1` 这个键值对。根据获取锁的步骤 3，客户端 2 至多可能在 N/2-1 个 Redis 节点上获取名为 resource-name 的锁。由于 `N/2-1 < N/2+1`，根据步骤 3 的规定，客户端 2 无法获取 resource-name 这个锁。
- Liveness A：无死锁是较为显然的结果。对于某个 key，由于它有时限，因此在足够长的时间后，所有节点上的这个 key 都会失效，该 key 对应的锁可以被重新获取。
- Liveness B：容错也是较为显然的结果。

## 总结

Redis 作者认为 Redlock 比基于复制的分布式锁实现更安全，但我有些疑惑，因为我并没有看出这一点。[Martin Kleppmann](https://martin.kleppmann.com/) 撰文 [How to do distributed locking](https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html) 认为 Redlock 其实并不安全，部分回答了我的疑惑，推荐大家阅读。

## 参考文献

- Redis 分布式锁文档：[https://redis.io/topics/distlock](https://redis.io/topics/distlock)
- Redis SET 命令文档：[https://redis.io/commands/set#patterns](https://redis.io/commands/set#patterns)
- Redis ebook 分布式锁章节：[https://redislabs.com/ebook/part-2-core-concepts/chapter-6-application-components-in-redis/6-2-distributed-locking/](https://redislabs.com/ebook/part-2-core-concepts/chapter-6-application-components-in-redis/6-2-distributed-locking/)
- Martin 对 Redlock 的评论：[https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html](https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html)

---
