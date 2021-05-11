---
title: 浅谈特征平台 Feast
date: 2021/04/11
description: 什么是特征平台 Feast ？
tag: ml-sys, notes
author: 陈易生
---

# 浅谈特征平台 Feast

[Feast](https://feast.dev/) 是一款开源的特征平台。本文谈谈对 Feast 的了解。

## Feast 简史

Feast 孵化于东南亚网约车巨头 [GoJek](https://www.gojek.com/) 的数据科学团队，由 [Willem Pienaar](https://twitter.com/willpienaar) 带头，解决 GoJek 机器 ML 模型上线难的问题。2019 年 1 月，GoJek 与 Google Cloud Platform (GCP) 合作[开源 Feast](https://cloud.google.com/blog/products/ai-machine-learning/introducing-feast-an-open-source-feature-store-for-machine-learning)。在此后的发展中，Feast 逐渐与 GCP 解耦，并在 2020 年 11 月 接受 ML 基础架构创业公司 [Tecton](http://tecton.ai/) 的[资助](https://www.tecton.ai/blog/feast-announcement/)，Willem 也加入 Tecton 成为 Feast 项目负责人。多说一句，Tecton 由 Uber ML 平台 [Michelangelo](https://eng.uber.com/michelangelo-machine-learning-platform/) 的核心团队创建。目前，Feast 处在 0.9 版本，即将在 2021 年 4 月的 [applyconf](https://www.applyconf.com/) 前后发布着眼于易用性的 0.10 版本。Feast 的核心贡献者主要来自 GoJek 和 Tecton，也被两家公司用于生产环境中。

## Feast 能做什么

简单说完 Feast 的历史，让我们看看它具体能解决什么问题。简而言之，Feast 让用户可以轻松地访问特征。用户要做的，只是把特征按照指定规格生产给 Feast，由 Feast 将特征写入在线和离线特征存储，用户即可通过指定接口进行特征访问。下图是 Feast 的简要架构。

![Feast](/images/what-is-feast/feast.png)

先说特征生产。Feast 不生产特征，Feast 只是特征的搬运工，搬运的起点是特征源。用户负责用 Spark 或 Flink 等工具编写特征生成管道，将数据从批数据源和流数据源中抽取并转换成所需特征，写入批特征源和流特征源。目前，Feast 支持包括 S3/HDFS/BigQuery 在内的批特征源，支持 Kafka 为流特征源。对于用户关心的一组特征，用户需要为 Feast 指定批特征源和流特征源的地址。

在 Feast 与特征源对接上以后，一旦用户手动或通过工作流引擎下达特征注入指令，Feast 就会触发 Spark/Python 工作流，将特征从特征源中取出，写入基于 Redis/Cassandra/Firestore 的在线特征存储。在目前版本的 Feast 中，批特征源直接充当了离线特征存储的角色。

当特征在特征存储中落库后，基于存储提供特征访问服务便顺理成章。Feast 支持在线推理服务通过 gRPC 或基于 gRPC 的 SDK 访问在线特征存储，同时支持批量训练和批量预测等任务通过 Python SDK 访问离线特征存储。

## Feast 不能做什么

看完 Feast 能做什么，再让我们看看 Feast 不能做什么：

- 特征生成。用户所在的公司几乎一定有一套现成的 ETL 系统，可以用来实现特征生成。Feast 顺水推舟，把特征生成管道的编写及调度交给用户。
- 特征同步。用户需要自己编写流和批特征源之间的特征同步管道。
- 特征回填。完成特征回填需要掌握特征如何生成的信息，而 Feast 并不掌握这类信息。
- 特征监控。Feast 并不知道特征的分布理应如何，也不会为特征打快照来获取特征的实际分布。

## 专精、插件化和易用

不难看出，Feast 的宗旨是「专精」——把「访问特征」这一件很小但很基本和通用的事情做到极致。至于特征生成、同步、回填和监控等高级功能，就交由用户自建，或让 Tecton 的 SaaS 代劳。

除了「专精」，Feast 还开始关注注重「插件化」。对于上述几乎一切涉及专用技术栈的地方，Feast 社区都打算支持用户自定义插件，例如：

- 特征注入工作流。Feast 截至 0.9 的版本提供了基于 Spark 的实现，计划在 0.10 版本增加基于 Python 的实现，并在之后的版本支持自定义实现。
- 在线特征存储。Feast 截至 0.9 的版本提供了基于 Redis 的实现，计划在 0.10 版本增加基于 Firestore 的实现，并在之后的版本支持自定义实现。

「易用」也是 Feast 在努力改进的地方。在截至 0.9 的版本，Feast 只提供了 on Kubernetes 的部署选项，基础架构方面陡峭的学习曲线让很多小规模的数据科学团队难以快速上手。Feast 的 0.10 版本将目标定为 All you need is `pip install feast`，特征注入可以发生在一台安装了 Python 环境的服务器上，而无需在验证阶段或者项目早期去学习 Kubernetes/Spark/Redis 这一套数据科学家所陌生的技术栈。

## 总结

Feast 只做「访问特征」这一件很小但很基本的事情，并且做得很好。Feast 不支持的高级特性，都能通过自建或购买 Tecton 服务的方式满足。在 4 月 22 日由 Tecton 举办的 applyconf 上，Feast 将会发布 0.10 版本，该版本将大大提高 Feast 的插件化和易用程度，吸引更多的 ML 基础架构团队去调研和试用。让我们拭目以待！

---
