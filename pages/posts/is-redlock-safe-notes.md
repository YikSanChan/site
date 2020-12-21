---
title: Redlock 真的安全吗？
date: 2020/10/29
description: Martin Kleppmann 对 Redlock 安全性的质疑。
tag: notes, distributed systems
author: Yik San Chan
---

# Redlock 真的安全吗？

本文是对 [Martin Kleppmann](https://martin.kleppmann.com/) 所写的 [How to do distributed locking](https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html) 一文的梳理。

## 分布式锁

分布式锁的目的是确保，如果多个客户端都想做一个事情，在任一个时点上只有一个客户端能做成。在分布式系统中，锁可以提高效率，例如要求客户端在发送邮件前先获取锁，保证另一个客户端不会重复发邮件。除了提高效率，分布式锁更重要的作用在于，让持锁的客户端对资源进行排他访问，从而保证安全性。(注意，Martin 原文中使用 correctness 一词，等同于 Redis 文档中提到的安全性一词。)

Redis 是一款流行的内存数据库，常用于数据快速变化、能容忍数据丢失的场景，例如限流（rate limiting）。但 Redis 逐渐涉足对强一致性和持久性有要求的数据管理领域，例如分布式锁，其中 Redlock 是基于 Redis 的分布式锁实现。Martin 认为这并不是 Redis 擅长的场景。如果想提高效率，Redlock 太重量级了，不如[基于复制的实现](https://yiksanchan.com/distributed-locks-with-redis/#%E5%9F%BA%E4%BA%8E%E5%A4%8D%E5%88%B6%E7%9A%84%E5%AE%9E%E7%8E%B0)。更重要的是，Redlock 本身不安全。

## 为什么关于时间的假设是不可靠的？

考虑一段在分布式系统中运行的 read-modify-write 代码。它试图从锁服务获取锁，如果成功获取锁，则写存储，并最终释放锁。下面称有时限（timeout）的锁为租约（lease）。

```javascript
// THIS CODE IS BROKEN
function writeData(filename, data) {
  var lock = lockService.acquireLock(filename)
  if (!lock) {
    throw "Failed to acquire lock"
  }

  try {
    var file = storage.readFile(filename)
    var updated = updateContents(file, data)
    storage.writeFile(filename, updated)
  } finally {
    lock.release()
  }
}
```

如果客户端 1 和 2 同时执行这段代码，理想情况下，客户端 1 获得租约，随后写存储，并在租约过期前成功释放锁。在这期间，客户端 2 无法获得租约。然而，如下图所示，客户端 1 在获取租约后，可能恰好要经历一个漫长的 stop-the-world GC（垃圾回收）。GC 期间，租约过期，客户端 2 获取租约，此时客户端 1 和 2 同时持有同一把锁，违背了安全性原则。两个客户端持有同一把锁的可能后果是，客户端 1 在结束垃圾回收后，接着写存储，造成难以预期的数据错误。

![GC pause breaks safety](/images/is-redlock-safe-notes/gc-pause-breaks-safety.png)

值得注意的是，GC 远不是暂停进程的唯一方式，IO、网络、CPU 都可能暂停进程。因此，无论使用什么锁服务，上面的代码都是不安全的，其根源在于代码对时间做了隐含的假设：持有锁的客户端在租约过期前，应该已经完成它想做的事情了。而这种假设是可能被违反的。

## 为什么 Redlock 是不安全的？

对时间假设的不可靠性，是 Redlock 不安全的根源。Redlock 使用了多个有关时间的隐含假设，而 Martin 通过一个很巧妙的方法揭示了这些假设。如果能找到一个可能的事件序列，使得 Redlock 不安全，则该事件序列中一定存在某个事件，它的发生违反了某个隐含假设。

下面考虑一个场景，1 号和 2 号这两个客户端向 A、B、C、D、E 这 5 个 Redis 主节点申请锁。

1. 客户端 1 从节点 A、B、C 成功获取锁，而因为网络原因，从节点 D、E 获取锁失败。由于客户端 1 获得 3 把锁，超过 Redis 节点的半数，因此客户端 1 持有锁。
2. 节点 C 的时钟发生向前跳跃，使得本地时钟时间超过租约的过期时间。
3. 客户端 2 从节点 C、D、E 成功获取 3 把锁，超过 Redis 节点的半数，因此客户端 2 也持有锁。
4. 客户端 1 和 2 持有同一把锁。

将事件 2 的“时钟跳跃”替换为“进程暂停”，也能达到同样的效果。若客户端 1 的进程暂停，直到租约过期后才苏醒，此时客户端 2 已持有锁，而客户端 1 仍认为自己持有锁。

因此，事件 2 违反了以下假设：时钟误差、进程停时和网络延时都是有界的。只要锁的时限能够覆盖上述时间误差的上界，算法就是安全的。然而，它们并不是真的有界：

- Github 史上最糟的宕机之一源于一个延时了 90 秒的数据包。
- Martin 在 DDIA 的第八章花了整整一节介绍时钟误差可能有多严重。
- GC 则是更广为人知的问题。

尽管这些关于时间的假设在大部分时候是对的，这对于依赖 Redlock 提供安全性保证的用户而言是不够的。

## 如何保证安全性？

解决办法是，锁服务在返回租约的同时，还返回一个单调递增的 token。客户端在写存储时，需要将 token 交予存储进行检查。在下面的例子中，客户端 1 持有 token=33，客户端 2 持有 token=34。客户端写完存储后，存储会拒绝来自客户端 1 的写，因为客户端 1 的请求带有老的 token（因为 33 小于 34）。

![Fencing token ensures safety](/images/is-redlock-safe-notes/fencing-token-ensures-safety.png)

如果使用 ZooKeeper 作为锁服务，可以将 zxid 或者 znode version number 作为 token。然而，Redlock 没有生成这种 token 的机制，也很难给 Redlock 加上这个特性，因为 token 生成本身就需要共识算法的参与。

## 总结

Redlock 既不安全，也没法变得安全。安全的分布式锁服务需要共识算法的参与，例如[ZooKeeper](https://curator.apache.org/curator-recipes/index.html)。

还有一些感想。尽管算法的形式化证明往往冗长且充满技巧，但仍是非常必要的，因为它清楚地告知使用者，算法的正确性基于哪些假设，存在哪些局限性。这些在非形式化论证中被一笔带过的细节，往往是使用者困惑的根源。
