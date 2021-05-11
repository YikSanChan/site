---
title: 浅谈 Flink
date: 2021/05/05
description: 使用 Flink 三个月以来的一些体会。
tag: flink
author: 陈易生
---

# 浅谈 Flink

我在三个月前加入伴鱼，开始搭建 ML 平台，[Flink](https://flink.apache.org/) 是其中的关键组件。期间，我花了大量时间使用 Flink，想趁此机会简单谈谈我对 Flink 的理解。

## 前言

Flink 是对标 [Spark](https://spark.apache.org/) 的一款大数据计算引擎，专注做好一件事情——把数据从 source 数据系统读出来，转换，写进 sink 数据系统。在伴鱼的 ML 平台，我们用 Flink 做以下的事情：

- 特征工程。从流或批数据源读取数据，转换为特征，写入离线特征存储，用于离线推理；写入在线特征存储，用于在线推理。
- 批量推理。从离线特征存储读取特征，利用载入的训练好的模型，进行离线的批量推理。

在三个月的使用过程中，我们总结出一些 Flink 面向用户表现出来的优缺点，其中优点居多。

## 活跃的社区

Flink 是个特别活跃的 Apache 开源项目。根据 [2020 Flink 社区年度总结](https://segmentfault.com/a/1190000039037343)，Flink 在 2020 年的 Apache 项目中：

- 用户和开发者邮件列表活跃度 Top1。
- Github 上代码提交次数 Top2。
- Github 上用户访问量 Top2。

添加一个数据点。最近三个月，我在 [Flink 邮件列表](http://apache-flink-user-mailing-list-archive.2336050.n4.nabble.com/)中问了超过 20 个问题，基本都得到了及时的帮助。这一点对我这个新手而言，意义重大。

## 丰富的 connector 支持

Flink 与数据系统交互的代码叫做 connector。Flink 支持的 connectors 包括 MongoDB / TiDB / Kafka / Hive 等（详情见 [DataStream connectors](https://ci.apache.org/projects/flink/flink-docs-stable/dev/connectors/) 和 [Table connectors](https://ci.apache.org/projects/flink/flink-docs-stable/dev/table/connectors/#supported-connectors)），能满足我们与各类已有数据系统交互的需求。

## 流批一体

Flink 对流处理的认识，比 [Spark](https://spark.apache.org/) 先进一些。Spark 认为，流是 micro 批，流是批的特例；Flink 认为，批是流的快照，批是流的特例。

这个理念差异反映在 API 上：Flink 用一套 API 覆盖了流和批的处理；而 Spark 是先实现了批 API，再在批 API 的基础上，单独开发了一个流 API 库。这对于 Flink 开发者特别友好——因为我们只用看一套文档，学一套 API，就能实现流和批任务了。

这个理念差异也反映在架构上，使得 Flink 有更简单的架构，能更高效地处理流数据。

## 分层 API

正如 [TensorFlow](https://www.tensorflow.org/) 同时提供了底层的 API 和抽象层次更高的 [Keras](https://keras.io/) API 一样，Flink 也同时提供底层的 [DataStream API](https://ci.apache.org/projects/flink/flink-docs-stable/dev/datastream_api.html) 和声明式的 [Table / SQL API](https://ci.apache.org/projects/flink/flink-docs-release-1.12/dev/table/)。

首先比较 Table API 和 SQL API：

- SQL API 基本没有额外的学习成本，大家都会写 SQL。
- Table API 表达能力略强，支持了一些在标准 SQL 中不支持的语义，包括以行为单位的 map 和 flatMap 操作，详情见[文档](https://ci.apache.org/projects/flink/flink-docs-release-1.13/docs/dev/python/table/operations/row_based_operations/)。

下面比较 DataStream API 和 Table / SQL API。前者的优势在于：

- 更强的表达能力。理论上，SQL API 的表达能力只是 DataStream API 的一个子集，因为 SQL API 调用在执行时会被转译为 DataStream API 调用。但随着 Flink 对 SQL 的支持越来越好，SQL 配合 [UDFs](https://ci.apache.org/projects/flink/flink-docs-stable/dev/table/functions/udfs.html) 的表达能力已经能在大部分情况下匹配 DataStream API 的表达能力。
- 更精细的控制。例如，[The Broadcast State Pattern](https://ci.apache.org/projects/flink/flink-docs-release-1.12/dev/stream/state/broadcast_state.html) 只能通过 DataStream API 实现。

Table / SQL API 的优势在于：

- 简单，不用学 Java / Scala。
- 更容易被执行引擎优化。

基于以上分析，我们初步决定优先选择 SQL API，其次是 Table API，最后是 DataStream API。

## Python 和 ML 支持

Python 是机器学习的法定编程语言 🐶。因此 [PyFlink](https://ci.apache.org/projects/flink/flink-docs-release-1.12/dev/python/) 的出现顺理成章，它主要包含两方面内容：

- 使用 Python 实现了大部分 DataStream API。
- 支持在 SQL 中使用 Python UDF。

第二点尤其吸引人，因为我们可以在 UDF 中使用任意 Python 库（scikit-learn / torch / tensorflow / numpy / pandas / etc），这比起用 Java / Scala 做数据处理和机器学习可香太多了。

不过，PyFlink 年纪尚小（比 [PySpark](https://spark.apache.org/docs/latest/api/python/index.html) 小两岁半），问题不少。好在，我们与阿里巴巴的 PyFlink 团队（钉钉群号：34004474）建立了联系，相关问题往往能得到团队的快速帮助。

除了 PyFlink 本身，Flink on ML 的进展也值得期待，包括：

- [Alink](https://github.com/alibaba/Alink)：基于 Flink 的 ML 算法库，对标 Spark ML。
- [Deep Learning on Flink](https://github.com/alibaba/flink-ai-extended/tree/master/deep-learning-on-flink)：在 Flink [算子](https://ci.apache.org/projects/flink/flink-docs-release-1.13/docs/dev/datastream/operators/overview/)中执行深度学习任务（包括 TensorFlow 和 PyTorch），让深度学习受益于 Flink 提供的强健的分布式计算环境。
- [Flink AI Flow](https://github.com/alibaba/flink-ai-extended/tree/master/flink-ai-flow)：基于 [Airflow](http://airflow.apache.org/)，用于调度基于 Flink 的 ML 作业。

目前，这些 ML 方面的进展主要发布在阿里巴巴自己的 GitHub 仓库下面，并在阿里内部使用。随着新家 [flink-ml](https://github.com/apache/flink-ml) 的建立，相信会有更多的工作成为 Apache Flink 的一部分。

## 美中不足

第一，Flink 的生态完整性还比较弱。以 Flink + Python 为例，如果拿 PyFlink 和 PySpark 对比，Stack Overflow 上 [pyflink 标签](https://stackoverflow.com/questions/tagged/pyflink)下的问题不足 100 个，而 [pyspark 标签](https://stackoverflow.com/questions/tagged/pyspark)下的问题有 27000 多个 😥 。再以 Flink + ML 为例，Flink ML 在 Apache 上刚刚有一个[家](https://github.com/apache/flink-ml)，跟 Spark ML 的成熟度暂时还不能比。

第二，Flink 的商业化程度比较低。这里定义的「商业化程度」是指——一家主导公司靠这个技术能赚多少钱。我们倾向于认为，一门技术的商业化程度越高，越不容易凉，想想 340 亿美元卖给 IBM 的 RedHat（Linux），市值 100 多亿美元的 Elastic（ElasticSearch），市值 180 多亿美元的 MongoDB，和估值 280 亿美元的 Databricks（Spark）。遗憾的是，虽然 Flink 的开源社区十分活跃，但背后的商业公司 Ververica 在[成为阿里巴巴的一部分](https://techcrunch.com/2019/01/08/alibaba-data-artisans/)后，远没有 Spark 背后的商业公司 Databricks 那样瞩目，Ververica co-founder [Fabian Hueske](https://github.com/fhueske) 也离开公司，加入市值 680 亿美元的 Snowflake 了 😂。（以上数据截至 2021 年 4 月 25 日）

## 总结

在伴鱼 ML 平台的早期探索中，Flink 很好地完成了特征工程和批量推理的任务。我们期待伴鱼的 ML 平台能与 Flink 共同演进，尽可能地提高效率。

---
