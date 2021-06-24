---
title: 我们如何将 Flink 特征管道提速 7 倍
date: 2021/06/23
description: Flink 算子状态 + Redis Pipelining = 7 倍性能
tag: flink
author: 陈易生
---

# 我们如何将 Flink 特征管道提速 7 倍

## 前言

本文记录了[伴鱼 AI 平台团队](https://yiksanchan.com/posts/join-us)这周做的一件投入-产出比极高的小事：通过 [Flink 算子状态](https://ci.apache.org/projects/flink/flink-docs-release-1.13/docs/dev/datastream/fault-tolerance/state/#operator-state)和 [Redis Pipelining](https://redis.io/topics/pipelining) 的简单结合，把 [Flink](https://flink.apache.org/) 往 Redis 大规模写入的效率提高了 7 倍。

## 问题背景

在伴鱼，算法工程师处理好的离线特征存储在 [Hive](https://hive.apache.org/) 表中，伴鱼 AI 平台团队维护的 Flink 特征管道在 [DolphinScheduler](https://dolphinscheduler.apache.org/) 引擎的调度下，定期将 Hive 中的离线特征批量导入基于 [Redis](https://redis.io/) 的在线特征仓库，为在线 ModelServer 提供低延迟的特征访问。由于离线特征的数量非常大，我们希望能优化特征管道对 Redis 的大规模写入，缩短写入的耗时。

## 实现框架

明确问题的背景后，我们希望在一个易测量的框架内，进行优化。`BatchRedisSink` 就是这样一个简单的框架：

- 在 `open` 方法中完成对 Jedis 连接池的初始化，在 `close` 方法中销毁连接池。选择 [Jedis](https://github.com/redis/jedis) 而不是 [Lettuce](https://github.com/lettuce-io/lettuce-core) 等高级库作为 Redis 客户端的主要原因是简单。
- 在 `invoke` 方法中，从上游 Hive 表读入形如 `(key: String, featureKVs: String)` 的特征记录，转化为 `(key: String, featureHash: java.util.HashMap[String, String])` 的格式，最后调用 Redis 客户端的接口将特征写入 Redis。

代码如下。

```scala
class BatchRedisSink extends RichSinkFunction[(String, String)] {

  private var jedisPool: JedisPool = _

  override def invoke(
      value: (String, String),
      context: SinkFunction.Context
  ): Unit = {
    val (key, featureKVs) = value
    val featureHash = getHash(featureKVs)

    // write to redis
  }

  override def open(parameters: Configuration): Unit = {
    try {
      jedisPool = new JedisPool()
    } catch {
      // ...
    }
  }

  override def close(): Unit = {
    if (jedisPool != null) {
      jedisPool.close()
    }
  }
}
```

下面，我们将逐步优化 `write to redis` 的逻辑。在此之前，我们先简单说明一下我们的性能测试设置。我们选用的 Hive 上游表里有 300 万行，数据共 150 M，使用 Parquet 格式存储。写入 Redis 后，占用的内存在 2G。我们在测试中，会启动不同实现的 Flink 任务，以写入的耗时作为性能评判的标准。

注意，写入耗时的绝对数值不是我们关注的重点，因为我们可以优化的空间和方向非常多，包括调优 Flink 任务的并行度等。我们在这里只关注如何改写 Flink 写入 Redis 的逻辑进行提速。

## 逐条写入

首先实现逐条写入。它是一个最简单的基准。

```scala
// write to redis
var jedis: Jedis = null
try {
  jedis = jedisPool.getResource
  jedis.hmset(key, featureHash)
} catch {
  // ...
} finally {
  try {
    jedis.close()
  } catch {
    // ...
  }
}
```

<details>

<summary children="点击展开完整代码" />

```scala
import org.apache.flink.configuration.Configuration
import org.apache.flink.streaming.api.functions.sink.{
  RichSinkFunction,
  SinkFunction
}
import org.slf4j.LoggerFactory
import redis.clients.jedis.{Jedis, JedisPool}

class BatchRedisSink extends RichSinkFunction[(String, String)] {

  private final val LOG = LoggerFactory.getLogger(getClass)

  private var jedisPool: JedisPool = _

  override def invoke(
      value: (String, Timestamp, String),
      context: SinkFunction.Context
  ): Unit = {
    val (key, featureKVs) = value
    val featureHash = getHash(featureKVs)

    var jedis: Jedis = null
    try {
      jedis = jedisPool.getResource
      jedis.hmset(key, featureHash)
    } catch {
      case e: Throwable =>
        LOG.error(
          "Cannot HMSET key={} hash={} error message {}",
          key,
          featureHash,
          e.getMessage
        )
        throw e
    } finally {
      try {
        jedis.close()
      } catch {
        case e: Throwable =>
          LOG.error("Failed to close jedis instance", e)
      }
    }
  }

  override def open(parameters: Configuration): Unit = {
    try {
      jedisPool = new JedisPool()
    } catch {
      case e: Throwable =>
        LOG.error("Redis has not been properly initialized: ", e)
        throw e
    }
  }

  override def close(): Unit = {
    if (jedisPool != null) {
      jedisPool.close()
    }
  }
}
```

</details>

逐条写入的问题是显而易见的：对于每一条记录，都要进行一次 Redis 的远程调用，大大降低了吞吐。性能测试验证了这一点：300 万记录竟然需要 1400 秒才插入完成。根据 Redis 服务端的指标，写入 QPS 远远没有达到集群能承受的上限，不难判断瓶颈是在客户端。

提高的办法也很直观。Redis Pipelining 在客户端积攒多个命令，再批量发送给服务端，有效减少 Redis 远程调用的数量。

这个方法的前提是，Flink 可以积攒多个命令，即存储状态。

## BufferingSink

[Flink 文档](https://ci.apache.org/projects/flink/flink-docs-release-1.13/docs/dev/datastream/fault-tolerance/state/#checkpointedfunction)详细介绍了 `BufferingSink` 如何使用 Flink 算子存储状态（也就是记录），攒够一批记录后再向外界写。

首先看 `invoke` 方法的实现：每来一条记录 `value`，就存入 `bufferedElements`，这是存状态的地方。`bufferedElements` 在攒满一批状态后，就做一次批量处理，然后清空。

```scala
private val bufferedElements = ListBuffer[(String, Int)]()

override def invoke(value: (String, Int), context: Context): Unit = {
  bufferedElements += value
  if (bufferedElements.size == threshold) {
    for (element <- bufferedElements) {
      // send it to the sink
    }
    bufferedElements.clear()
  }
}
```

如果我们不关心故障恢复，那这个类可以到此为止了。但 `BufferingSink` 不是个随便的 Sink。`BufferingSink` 拓展了 `CheckpointedFunction`，通过 [checkpointing](https://ci.apache.org/projects/flink/flink-docs-release-1.13/docs/dev/datastream/fault-tolerance/checkpointing/) 机制会对算子状态进行持久化，确保算子状态能从故障中恢复。`CheckpointedFunction` 需要实现两个接口：`snapshotState` 和 `initializeState`。

`snapshotState` 方法对状态进行快照。具体地，它把原来的 `checkpointedState` 清空，然后把 `bufferedElements` 中的状态全部添加到 `checkpointedState` 中。

```scala
@transient
private var checkpointedState: ListState[(String, Int)] = _

override def snapshotState(context: FunctionSnapshotContext): Unit = {
  checkpointedState.clear()
  for (element <- bufferedElements) {
    checkpointedState.add(element)
  }
}
```

`initializeState` 方法初始化 `checkpointedState` 和 `bufferedElements`。

- 如果函数刚被创建，`checkpointedState` 会被初始化为空状态。
- 如果函数刚从上一个 checkpoint 恢复，`bufferedElements` 会被 `checkpointedState` 里面的状态回填。

```scala
override def initializeState(context: FunctionInitializationContext): Unit = {
  val descriptor = new ListStateDescriptor[(String, Int)](
    "buffered-elements",
    TypeInformation.of(new TypeHint[(String, Int)]() {})
  )

  checkpointedState = context.getOperatorStateStore.getListState(descriptor)

  if (context.isRestored) {
    for (element <- checkpointedState.get().asScala) {
      bufferedElements += element
    }
  }
}
```

<details>

<summary children="点击展开完整代码" />

```scala
class BufferingSink(threshold: Int = 0)
  extends SinkFunction[(String, Int)]
    with CheckpointedFunction {

  @transient
  private var checkpointedState: ListState[(String, Int)] = _

  private val bufferedElements = ListBuffer[(String, Int)]()

  override def invoke(value: (String, Int), context: Context): Unit = {
    bufferedElements += value
    if (bufferedElements.size == threshold) {
      for (element <- bufferedElements) {
        // send it to the sink
      }
      bufferedElements.clear()
    }
  }

  override def snapshotState(context: FunctionSnapshotContext): Unit = {
    checkpointedState.clear()
    for (element <- bufferedElements) {
      checkpointedState.add(element)
    }
  }

  override def initializeState(context: FunctionInitializationContext): Unit = {
    val descriptor = new ListStateDescriptor[(String, Int)](
      "buffered-elements",
      TypeInformation.of(new TypeHint[(String, Int)]() {})
    )

    checkpointedState = context.getOperatorStateStore.getListState(descriptor)

    if (context.isRestored) {
      for (element <- checkpointedState.get().asScala()) {
        bufferedElements += element
      }
    }
  }
}
```

</details>

不难看出，`BufferingSink` 可以很好地支持我们的需要：攒足一批命令，再发送给 Redis；如果任务因故障中断，恢复后可以确保已攒的 Redis 命令不会丢失。

下面我们看看如何改写 `BufferingSink`，为己所用。

## 批量写入

我们沿用了 `BufferingSink` 的整个框架，仅仅改变了两个地方：

- 所存储的状态类型从 `(String, Int)` 改为 `(String, java.util.HashMap[String, String])`。
- 每当 `bufferedElements` 积累了 `threshold` 个数的记录后，将它们写入同一个 Redis Pipeline 中，再发送给 Redis。

核心代码变化只是将这两行：

```scala
jedis = jedisPool.getResource
jedis.hmset(key, featureHash)
```

变为这几行

```scala
jedis = jedisPool.getResource
val pipeline = jedis.pipelined()
for ((key, hash) <- bufferedElements) {
  pipeline.hmset(key, hash)
}
pipeline.sync()
```

<details>

<summary children="点击展开完整代码" />

```scala
import org.apache.flink.api.common.state.{ListState, ListStateDescriptor}
import org.apache.flink.api.common.typeinfo.{TypeHint, TypeInformation}
import org.apache.flink.configuration.Configuration
import org.apache.flink.runtime.state.{
  FunctionInitializationContext,
  FunctionSnapshotContext
}
import org.apache.flink.streaming.api.checkpoint.CheckpointedFunction
import org.apache.flink.streaming.api.functions.sink.{
  RichSinkFunction,
  SinkFunction
}
import org.slf4j.LoggerFactory
import redis.clients.jedis.{Jedis, JedisPool}

import scala.collection.mutable.ListBuffer

class BatchRedisSink(
    threshold: Int
) extends RichSinkFunction[(String, String)]
    with CheckpointedFunction {

  private final val LOG = LoggerFactory.getLogger(getClass)

  @transient
  private var checkpointedState
      : ListState[(String, java.util.Map[String, String])] = _

  private val bufferedElements
      : ListBuffer[(String, java.util.Map[String, String])] =
    ListBuffer.empty[(String, java.util.Map[String, String])]

  private var jedisPool: JedisPool = _

  override def invoke(
      value: (String, String),
      context: SinkFunction.Context
  ): Unit = {
    val (key, featureKVs) = value
    val featureHash = getHash(featureKVs)

    bufferedElements += (key -> featureHash)

    if (bufferedElements.size == threshold) {
      var jedis: Jedis = null
      try {
        jedis = jedisPool.getResource
        val pipeline = jedis.pipelined()
        for ((key, hash) <- bufferedElements) {
          pipeline.hmset(key, hash)
        }
        pipeline.sync()
      } catch {
        case e: Throwable =>
          LOG.error(
            "Pipelining failed with error message {}",
            e.getMessage
          )
          throw e
      } finally {
        try {
          jedis.close()
        } catch {
          case e: Throwable =>
            LOG.error("Failed to close jedis instance", e)
        }
      }
      bufferedElements.clear()
    }
  }

  override def snapshotState(context: FunctionSnapshotContext): Unit = {
    checkpointedState.clear()
    for (element <- bufferedElements) {
      checkpointedState.add(element)
    }
  }

  override def initializeState(context: FunctionInitializationContext): Unit = {
    val descriptor =
      new ListStateDescriptor[(String, java.util.Map[String, String])](
        "buffered-elements",
        TypeInformation.of(
          new TypeHint[(String, java.util.Map[String, String])]() {}
        )
      )

    checkpointedState = context.getOperatorStateStore.getListState(descriptor)

    if (context.isRestored) {
      for (element <- checkpointedState.get().asScala) {
        bufferedElements += element
      }
    }
  }

  override def open(parameters: Configuration): Unit = {
    try {
      jedisPool = new JedisPool()
    } catch {
      case e: Throwable =>
        LOG.error("Redis has not been properly initialized: ", e)
        throw e
    }
  }

  override def close(): Unit = {
    if (jedisPool != null) {
      jedisPool.close()
    }
  }
}
```

</details>

经过这个很小的改变，测试耗时从 1400 秒变为 200 秒，我们几乎没费什么力气就加速了 7 倍，满足了目前我们对特征管道的性能需求。

## 总结

将 Flink 算子状态和 Redis Pipelining 像搭积木一样简单结合，就能获得如此大的性能提升，这就是软件工程的美妙之处。

如果后续我们对特征管道还有更高的性能要求，我们会考虑用异步的办法去进一步增大吞吐，包括使用 Flink [异步 I/O](https://ci.apache.org/projects/flink/flink-docs-release-1.13/docs/dev/datastream/operators/asyncio/)、使用 Lettuce 这样的 Redis 异步客户端等。那又将是一段美妙的搭积木之旅。

---
