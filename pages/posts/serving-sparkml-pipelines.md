---
title: Spark ML 管道在线推理实践
date: 2021/06/28
description: MLeap 和 Uber 如何提高 Spark ML 管道在线推理的效率？
tag: ml-sys, notes
author: 陈易生
---

# Spark ML 管道在线推理实践

## 前言

本文是[「算法工程化实践选读」](./mlsys-we-love)系列的第 5 篇，选读 Uber ML 平台团队在 2019 年 10 月发布的技术博客 [Evolving Michelangelo Model Representation for Flexibility at Scale](https://eng.uber.com/michelangelo-machine-learning-model-representation/)。Uber 尝试拓展 [Spark ML 管道](https://spark.apache.org/docs/latest/ml-pipeline.html)的能力，让管道可以更高效地进行模型的在线推理。作为比较，本文还详细介绍了 [MLeap](https://combust.github.io/mleap-docs/)，它尝试从不同的角度去解决同一个问题。

## 离线容易

Spark ML 管道让模型的离线训练和离线推理变得十分简单。我们通过下面这个[文档分类示例](https://spark.apache.org/docs/latest/ml-pipeline.html#example-pipeline)快速了解一下几个重要概念。

```scala
// Configure an ML pipeline, which consists of three stages:
// tokenizer, hashingTF, and lr.
val tokenizer = new Tokenizer()
  .setInputCol("text")
  .setOutputCol("words")
val hashingTF = new HashingTF()
  .setNumFeatures(1000)
  .setInputCol(tokenizer.getOutputCol)
  .setOutputCol("features")
val lr = new LogisticRegression()
  .setMaxIter(10)
  .setRegParam(0.001)
val pipeline = new Pipeline()
  .setStages(Array(tokenizer, hashingTF, lr))
```

`Tokenizer` 和 `HashingTF` 是 Transformer。Transformer 的 `transform` 方法定义了从输入 DataFrame 到输出 DataFrame 的数据转换逻辑。

`LogisticRegression` 是 Estimator。Estimator 的 `fit` 方法定义了从输入 DataFrame 到输出 Model 的模型训练逻辑。

Pipeline 是 Transformer 和 Estimator 的组合。

```scala
// Prepare training documents from a list of (id, text, label) tuples.
val training = ...
val model = pipeline.fit(training)
```

调用 Pipeline 的 `fit` 方法，可以得到 PipelineModel。不妨把 PipelineModel 理解为，完成拟合后的数据预处理-模型推理全流程。它提供了简单的 I/O API，用于将模型序列化为原生的格式。

```scala
model.write.overwrite().save("/tmp/spark-logistic-regression-model")
```

将此前序列化的模型反序列化，就可以复原 PipelineModel。

```scala
val model = PipelineModel.load("/tmp/spark-logistic-regression-model")
```

PipelineModel 同时也是个 Transformer。调用它的 `transform` 方法对测试数据集 DataFrame 执行数据预处理和批量推理，可以得到推理结果 DataFrame。

```scala
// Prepare test documents, which are unlabeled (id, text) tuples.
val test = ...
model.transform(test)
  .select("id", "text", "probability", "prediction")
  .collect()
  .foreach { case Row(id: Long, text: String, prob: Vector, prediction: Double) =>
    println(s"($id, $text) --> prob=$prob, prediction=$prediction")
  }
```

## 在线难

但是，将离线训练得到模型用于在线推理，就没那么容易了。在线推理要求低延迟和高吞吐，但运行 Spark 的额外开销很大。

根据[性能测试](https://github.com/combust/mleap-docs/blob/master/faq.md#why-not-use-a-sparkcontext-with-a-localrelation-dataframe-to-transform)的结果，一次依赖 [Spark Context](https://spark.apache.org/docs/latest/api/java/org/apache/spark/SparkContext.html) 的推理过程的耗时在 100 毫秒左右，距离在线推理通常要求 5 毫秒有很大的距离。Uber Michelangelo 团队在[一篇博客](https://eng.uber.com/michelangelo-machine-learning-model-representation/)中定位了 `PipelineModel` 不适合做在线推理的两个原因：

- 处理请求的速度太慢。Spark 在设计时并没有针对在线推理的场景做优化，而是着重于离线的批处理。
- 加载模型的速度太慢。Spark 的很多操作依赖于重量级、分布式的 Spark Context。

下文着重比较将 Spark ML 管道用于在线推理的两个尝试。

## MLeap

一个很直观的想法是，把管道所依赖的 Spark Transformer 在没有 Spark 依赖的环境下实现一遍，以避免 Spark Context 带来的额外开销。

开源的 MLeap 和 Databricks 闭源发布的 [dbml-local](https://docs.databricks.com/applications/machine-learning/model-export/model-import.html) 就是这么做的，在这里我们只讨论开源的 MLeap。一个标准的 MLeap 工作流是这样的：

1. 离线训练。在离线训练环境中，像上一节介绍的那样，用 Spark 实现并训练一个管道，得到 PipelineModel。
1. 序列化。将 PipelineModel 序列化为 [MLeap Bundle](https://combust.github.io/mleap-docs/core-concepts/mleap-bundles.html)。

```scala
import ml.combust.bundle.BundleFile
import ml.combust.mleap.spark.SparkSupport._
import org.apache.spark.ml.bundle.SparkBundleContext
import resource._
implicit val context = SparkBundleContext()
(for (
  modelFile <- managed(BundleFile("jar:file:/tmp/spark-logistic-regression-model.zip"))
) yield {
  model.writeBundle.save(modelFile)(context)
}).tried.get
```

1. 在线推理。在线上服务环境中，依赖 MLeap 运行时，运行这个序列化后的管道，进行低延迟的在线推理。注意，下面的代码不包含 Spark 依赖！

```scala
// NO SPARK DEPENDENCIES!
import ml.combust.bundle.BundleFile
import ml.combust.mleap.runtime.MleapSupport._
import resource._
val zipBundleM = (for (bundle <- managed(BundleFile("jar:file:/tmp/spark-logistic-regression-model.zip"))) yield {
  bundle.loadMleapBundle().get
}).opt.get
val mleapModel = zipBundleM.root
// Prepare test documents, which are unlabeled (id, text) tuples.
val test = ...
mleapModel.transform(test)
// ...
```

根据 MLeap 提供的 [benchmark](https://github.com/combust/mleap-docs/blob/master/faq.md#what-is-mleap-runtimes-inference-performance) 结果，在 MLeap 运行时中运行 ML 管道，相比 Spark 运行时，可以获得 10000 倍以上的提速。

MLeap 之所以能做到这一点，是因为：

- 实现了 MLeap Bundles。它基于 JSON 和 Protobuf，支持将任意基于 Spark Transformer 的 ML 管道序列化，并反序列化为一个 Leap Transformer（详情见下面）。
- 定义了 [LeapFrame](https://combust.github.io/mleap-docs/core-concepts/data-frames/) 和 [Leap Transformer](https://combust.github.io/mleap-docs/core-concepts/transformers/)，与 Spark 的 DataFrame 和 Transformer 一一对应。区别在于，LeapFrame 和 Leap Transformer 不依赖于 Spark 运行时。基于这组定义，MLeap 用 Leap Transformer 重写了大量 Spark Transformer。在线上服务环境中，我们只需构造 LeapFrame，把它提供给从 Spark 管道反序列化得到的 MLeap 管道，就能进行进行低延迟的推理。

但 MLeap 同时也存在比较明显的缺点：

- 滞后性。MLeap 社区需要手动保障 Leap Transformer 和 Spark Transformer 的一一对应。这是一场没有尽头的追赶游戏。在 MLeap 社区追赶上之前，算法工程师都无法使用 Spark 提供的新 Transformer。
- 不一致性。很难保证重写得到的 Leap Transformer 和 Spark Transformer 具有一模一样的行为，二者毕竟是完全不同的代码。
- 低成长性。MLeap 相比 Spark，在社区的成熟度和活跃度上差了几个量级，让用户对 MLeap 的持续成长性很难有乐观的估计。

## Spark OnlineTransformer

MLeap 这类解决方案引入的不一致性问题，给 Uber 造成过损失（见 [SPIP](https://issues.apache.org/jira/browse/SPARK-26247) 附件中的 [PDF](https://issues.apache.org/jira/secure/attachment/12950454/SPIPMlModelExtensionForOnlineServing.pdf)）。这促使 Uber ML 平台团队思考一种不依赖第三方（MLeap / [PMML](http://dmg.org/pmml/v4-1/GeneralStructure.html) / [PFA](http://dmg.org/pfa/) 等）模型格式转换的解决方案。

既然 Spark 原生的 PipelineModel 不适合在线的场景，能否直接修改 Spark 的代码，让它变得适合？[这篇博客](https://eng.uber.com/michelangelo-machine-learning-model-representation/)和[这场演讲](https://databricks.com/session/using-spark-mllib-models-in-a-production-training-and-serving-platform-experiences-and-extensions)介绍了 Uber ML 平台团队引入的 OnlineTransformer 类，解决了 Spark Transformer 在线推理效率低的缺点。

首先，Transformer 设计上没有考虑在线服务的场景，因此只有一个批推理 API `def scoreInstances(instances: List[Map[String, Any]]): List[Map[String, Any]]`。Uber 团队为 OnlineTransformer 加上了点推理 API `def scoreInstance(instance: Map[String, Any]): Map[String, Any]`。这是解决问题的第一步。

Uber 团队还发现，PipelineModel 对 Spark Context 的重度依赖，导致了在线服务中的模型加载过程缓慢。优化围绕 PipelineModel 的加载展开，思路是尽量用轻量的本地文件 I/O 代替依赖 Spark Context 的分布式 I/O，这些小优化累积起来，让模型加载速度提升了 4 到 15 倍。优化的地方包括：

- 在读取本地元数据文件时，使用 Java I/O 代替 `sc.textfile`，大幅降低元数据的读取时间。
- 在读取 Transformer 数据时，使用 `ParquetUtil.read` 代替 `sparkSession.read.parquet`，大幅降低 Transformer 数据的加载时间。
- 将树集成模型存储成大文件，使用 `ParquetUtil.read` 进行直接的读。大幅降低树集成模型读取数据的时间。

这个方案相比 MLeap 等方案，还有一个天然的优点：它被包括在 Spark 项目中，因此会随着 Spark 代码库一同迭代。

然而，[这个提案](https://issues.apache.org/jira/browse/SPARK-26247)并没有被 Spark 社区所接受。从有限的讨论中，我推测 Spark 社区希望让 MLeap / dbml-local / PMML 去负责这个针对在线推理的优化，它不应该成为 Spark 的包袱。

很有意思。Uber 希望能把这个优化合并到 Spark 的主干，让社区后续能把针对在线推理的优化迭代下去；而 Spark 社区认为这个事情应该由第三方的库去管。这大概就是——「Uber 之蜜糖，Spark 之砒霜」罢 😂

## 总结

在 Spark ML 管道看来：

- 模型推理和数据预处理无非是计算的不同形态，都可以用 Transformer 表达。
- Transformer 可组合，构成一个大的管道。

美中不足之处在于，这个管道依赖于 Spark 运行时，有很大的额外开销，对于在线推理的场景不适用。为了解决这个问题：

- MLeap 另起炉灶，将管道序列化-反序列化为一个不依赖于 Spark 运行时的管道，在 JVM 里执行。
- Uber ML 平台团队修改 Spark 源码，减少管道在运行中的额外开销。

衷心希望能看到更多这样的「八仙过海各显神通」。

---
