---
title: Empowering data scientists with a feature store
date: 2021/10/06
description: How we build a feature store at PalFish that allows data scientists to productionize ML features in hours, not days.
tag: ml-sys, flink
author: Yik San Chan
---

# Empowering data scientists with a feature store

## Introduction

PalFish is a Series-C EdTech company based in China. In Feb 2021, I joined PalFish to bootstrap the ML infrastructure team. At the time, PalFish applied real-time machine learning in many cases, including ads personalization and leads scoring, but the infrastructure was still in its infancy.

I talked to many data scientists to figure out the lowest hanging fruits and ended up building a feature store. Back then, there already existed a Feature Store V1 that ships features to production for online inference use. What I found out, though, was the whole engineering team take too much effort to productionize a new feature. Data scientists who own the model are often blocked by both data and product engineering teams to get the features ready.

In the post, I will walk through what the V1 looks like, what are the problems it has, and how our V2 solves these problems.

## Feature Store V1

Feature Store V1 has three parts: feature engineering, online store, and online serving. The overall architecture can be found below.

![v1 architecture](/images/palfish-feature-store/v1-architecture.svg)

Data engineers develop feature engineering jobs with Spark and deploy them to YARN. They consume data sources (batch and stream), cook the data into features (aka feature engineering), and write features to the online store backed by Redis. We choose Redis because it is popular both inside PalFish and in the outside feature store world (see [DoorDash](https://doordash.engineering/2020/11/19/building-a-gigascale-ml-feature-store-with-redis/) and [Feast](https://docs.feast.dev/feast-on-kubernetes/concepts/stores#online-store)).

When data engineers are done, product engineers come. They build gRPC API on top of Redis that allows low-latency access to features data. An API call `GetFeatures(EntityName, FeatureNames)` is mapped to a Redis call `HMGET EntityName FeatureNames[0] ... FeatureNames[N-1]`. Simple.

Once the gRPC endpoint gets ready, product engineers call the endpoint from product services such as AdServer or LeadScorer to fetch features.

What's weird? While data scientists care most about launching features (so that their fancy models make real world impact), it is actually in data engineers and product engineers' hands to implement! 🤷 This mismatch leads to:

- Data engineers and product engineers get side tracked to help data scientists build ad-hoc pipelines and services whenever a new model is in development.
- Data scientists have a hard time orchestrating the delivery of a new model.
- Slower progress and more error-prone feature implementation due to cross-team communication.
- Feature engineering logic has to be simple to avoid further communication costs, as a result, major data transformation logic is delegated to the model, which greatly slows down model inference.

To address these issues, Feature Store V2 aims to:

- Let data scientists gain full control to iterate faster and less error-prone.
- Free data engineers and product engineers. What they build ad-hoc should be built once and iterated often by ML infra team (us).
- Hand over more feature engineering to the pipelines so that inference can do less and run faster.

## Feature Store V2

V2 further splits the broad term "feature engineering" into three parts: feature engineering, feature source, and feature ingestion. The overall architecture of Feature Store V2 is shown below.

![v2 architecture](/images/palfish-feature-store/v2-architecture.svg)

_Side Note: We switch from Spark to Flink in a company-wise move._

### Feature Engineering

A feature engineering pipeline consumes the data source, cooks it into features, and writes the features to a specified feature source. Again, there are 2 types of pipelines, stream and batch, depending on the type of data sources they consume.

What makes V2 stand out is that feature engineering logic is **solely written by data scientists**, using either PyFlink for streaming features or HiveQL for batch features. Specifically, to productionize a streaming feature, data scientists need to:

1. Declare the Flink data source (source.sql) and implement the feature engineering logic (transform.sql) using Flink SQL.
2. (Optionally) Implement UDFs in Python (udf_def.py) if needed.
3. Generate an executable PyFlink script (run.py) by running a custom codegen tool.
4. Debug your PyFlink script locally in a pre-packaged Docker environment and ensure it works fine.
5. Submit your script to a GitLab repo that hosts all feature pipelines code. Once it gets merged, CI/CD triggers the deployment.

![v2 codegen](/images/palfish-feature-store/v2-codegen.svg)

With the process:

- Data scientists can determine when a feature can be delivered.
- ML infra engineers ensure feature engineering code has high quality.
- ML infra engineers can refactor the code if necessary without involving data scientists.

### Feature Source

Feature sources store generated features in a fixed schema. It is a boundary that divides work between data scientists and ML infra engineers.

### Feature Ingestion

A feature injection pipeline is a Flink job that reads features from feature sources and writes them to the online store. Since Flink doesn't come with an inbuilt Redis sink, we rolled our own `StreamRedisSink` and `BatchRedisSink` by extending [RichSinkFunction](https://github.com/apache/flink/blob/master/flink-streaming-java/src/main/java/org/apache/flink/streaming/api/functions/sink/RichSinkFunction.java). It worths mentioning that `BatchRedisSink` leverages [Flink Operator State](https://ci.apache.org/projects/flink/flink-docs-release-1.13/docs/dev/datastream/fault-tolerance/state/#using-operator-state) and [Redis Pipelining](https://redis.io/topics/pipelining) to improve write throughput, you can find the code example below if interested.

<details>

<summary children="BatchRedisSink code example (Scala)" />

```scala
class BatchRedisSink(
    pipelineBatchSize: Int
) extends RichSinkFunction[(String, Timestamp, Map[String, String])]
    with CheckpointedFunction {

  @transient
  private var checkpointedState
      : ListState[(String, java.util.Map[String, String])] = _

  private val bufferedElements
      : ListBuffer[(String, java.util.Map[String, String])] =
    ListBuffer.empty[(String, java.util.Map[String, String])]

  private var jedisPool: JedisPool = _

  override def invoke(
      value: (String, Timestamp, Map[String, String]),
      context: SinkFunction.Context
  ): Unit = {
    import scala.collection.JavaConverters._

    val (key, _, featureKVs) = value
    bufferedElements += (key -> featureKVs.asJava)

    if (bufferedElements.size == pipelineBatchSize) {
      flush()
    }
  }

  private def flush(): Unit = {
    var jedis: Jedis = null
    try {
      jedis = jedisPool.getResource
      val pipeline = jedis.pipelined()
      for ((key, hash) <- bufferedElements) {
        pipeline.hmset(key, hash)
      }
      pipeline.sync()
    } catch { ... } finally { ... }
    bufferedElements.clear()
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

    import scala.collection.JavaConverters._

    if (context.isRestored) {
      for (element <- checkpointedState.get().asScala) {
        bufferedElements += element
      }
    }
  }

  override def open(parameters: Configuration): Unit = {
    try {
      jedisPool = new JedisPool(...)
    } catch { ... }
  }

  override def close(): Unit = {
    flush()
    if (jedisPool != null) {
      jedisPool.close()
    }
  }
}
```

</details>

### V2 Summary

Feature Store V2 meets our goals. Now, data scientists own their features end-to-end: design, implement (with SQL and Python), test (locally with Docker), and launch. It leads to less error-prone implementation, and much faster iteration - the process took days, if not weeks, and now it takes only a few hours.

Thanks to the improvement, PalFish is able to deliver models faster and apply ML to more use cases including customer churn.

## Lessons learned

These are what we learn from the upgrade.

**Give users the tools they want.** Since data scientists are most productive with Python and SQL, we should NOT let them do Java or Scala, or even delegate feature engineering work to data engineers. Instead, let them write Python and SQL, and they will do their awesome work.

**A platform should set the quality bar high.** Given the current scale, we ask data scientists to go through a full pull request process in order to productionize a feature, during which we watch closely how data scientists work, and data scientists learn best practices of implementing a feature through code reviews. This turns out to work great!

**Flink is awesome.** They exercise what I have just described - keep building the tools that users want, and set the quality bar high.

Any feedback? Comment on [Hacker News](https://news.ycombinator.com/item?id=28796152) or [Twitter](https://twitter.com/yiksanchan/status/1446350984859451395)!

---
