---
title: 伴鱼机器学习预测服务设计篇
date: 2021/08/23
description: 在伴鱼，我们如何设计机器学习预测服务？
tag: ml-sys
author: 陈易生
---

# 伴鱼机器学习预测服务设计篇

## 前言

在伴鱼，我们在多个在线场景使用机器学习提升用户的使用体验。例如，在伴鱼绘本中，我们根据用户的帖子浏览记录，为用户推荐他们感兴趣的帖子。

在线预测是机器学习模型发挥作用的临门一脚，重要性不言而喻。在伴鱼，我们搭建了机器学习预测服务（以下简称预测服务），统一地处理所有的预测请求。本文主要介绍预测服务的演进过程。

## 预测服务 V1

目前，各个算法团队都有一套组装预测服务的方式。它们的架构十分相似，可以用下图表达：
1. 业务服务从特征系统获取特征，从 AB 平台获取实验分组。　
2. 等待获取结果。
3. 业务服务将模型 ID 和特征向量发送给 ModelServer。
4. ModelServer 根据模型 ID 和特征向量完成推理，将推理结果返回。

![v1 architecture](/images/palfish-prediction-service-design/v1-architecture.svg)

其中，ModelServer 的实现有两种主流方式。其一，使用 TorchServe 或 TensorFlow Serving 这样和训练框架高度耦合的 serving 方案。其二，使用 Flask 搭建一个简单的 HTTP 服务，将模型加载至服务的内存，在收到预测请求时调用模型的预测接口进行预测。

这种方式存在几个问题：

- 性能与多框架支持难以兼得。使用 TorchServe 或 TensorFlow Serving 能保证性能，但不能提供多框架支持；而使用 Flask 搭建预测服务，尽管可以支持任意框架训练出来的模型，但服务性能偏差。其结果是，对于不同类型的模型（LightGBM vs PyTorch），架构非常不同（Flask vs TorchServe）。
- 上线模型需要工程同学的配合。每个需要 ML 能力的业务服务，都需要在算法和工程同学的紧密合作下，学习、实现和维护一套与多个 ML 系统（例如特征系统和 AB 平台）对接的逻辑。
- 不规范。不基于 Go 预测服务难以接入公司自建的服务治理体系和可观测性体系。

为了系统性地解决这几个问题，预测服务 V2 提出了几个设计目的：
- 高性能。预测服务用于线上场景，要满足低延迟和高吞吐的需求。
- 多框架支持。我们的模型包括树和神经网络，至少涉及 LightGBM / XGBoost 和 PyTorch / TensorFlow 这两类框架。预测服务需要支持多种框架的模型。
- 配置化。算法工程师通过配置文件声明预测的工作流，无需业务的工程同学额外配合。要想对接更多 ML 子系统，只需由 AI 平台实现一次，所有算法团队都能受益，无需不同业务线的工程同学反复实现对接逻辑。
- 合规范。可以接入公司成熟的服务治理和可观测性体系。

## 预测服务 V2

架构主要借鉴了 [Uber](/posts/uber-michelangelo-overview) 和 [DoorDash](/posts/doordash-prediction-service)：预测服务接受预测请求，根据请求的内容，进行获取特征、获取 AB 实验分组等操作，然后调用 ModelServer 进行推理，返回预测结果。详情见下图。

![v2 architecture](/images/palfish-prediction-service-design/v2-architecture.svg)

⓪ 表示在新的模型上线之前，算法工程师上传的预测配置文件会被载入预测服务，预测服务根据配置文件的内容实例化一个工作流。 

① 到 ⑥ 代表预测请求的整个生命周期：
1. 业务服务（例如推荐引擎）调用预测服务的接口，需要提供模型名字、预测主体的 key（例如用户 ID）、上下文（context）特征。
2. 预测服务根据模型名字，定位到该模型所对应的工作流并执行，包括调用特征系统、调用 AB 平台接口等。
3. 预测服务调用特征系统接口获取特征向量，从 AB 平台获取实体对应的模型 ID。
4. 预测服务根据模型 ID 和特征向量，调用 ModelServer。
5. 预测服务从 ModelServer 获取模型的预测值。
6. 返回预测值，并打日志。日志可用于构建训练数据集，也可以用于监控特征和预测的质量。

在这个架构下，算法工程师要上线一个模型，只需：
1. 离线完成模型训练，将模型上传至模型仓库。
2. 将模型部署至 ModelServer（选用 [Seldon Core](https://github.com/SeldonIO/seldon-core) 作为解决方案）。
3. 用[特征系统](/posts/palfish-feature-system)开发特征。
4. 用 AB 平台创建实验。
5. 将预测配置文件以 Merge Request 的形式，提交到指定的代码仓库。
6. 由业务方的工程同学协助，对接预测服务。

不难看出，编写预测配置文件是算法工程师工作流的核心。预测配置文件以 YAML 格式定义了一个完整的模型推理工作流所涉及的全部信息。

举一个具体的例子。假设我们有一个视频推荐系统 Toy Recsys，它结合用户的网络情况（network），和用户的短期观看历史（last_5_views），给用户推荐视频。模型的基本逻辑是：网络情况好，就结合用户口味，放一些用户最可能感兴趣的长视频；网络情况差，就结合用户口味，放一些短视频。

我们称 network 和 last_5_views 是 Toy Recsys 模型的两个特征。其中，网络情况会附带在请求中（这类特征被称为 context 特征），而短期观看历史存储在特征系统中。要让预测服务知道如何获取这两个特征，不需要工程同学进行额外的编码工作，而只需由算法工程师提交如下配置文件：

```yaml
model-name: toy_recsys
feature-system:
- features:
  - name: network
    source: context
    default-value: 4G
  - name: last_5_views
    source: store
    default-value: []
```

预测服务会根据算法工程师提交的预测配置文件，实例化一个获取特征的工作流，并开始处理该模型的请求。这个工作流会：
1. 从请求中获取 user_id 和 network 参数。
2. 使用请求中的 user_id，去调用特征系统的 RPC 接口，获取 last_5_views 的特征值。
3. 将 user_id, network 和 last_5_views 组装成一个特征向量，发送给 ModelServer 进行推理。

值得注意的是，预测配置文件极易拓展。如果预测服务要接入 AB 平台，我们只需要支持在配置文件中填写 AB 实验的信息即可。例如：

```yaml
model-name: toy_recsys
feature-system: ...
ab-experiment:
- experiment-key: TOY_RECSYS
```

## 总结

在完成预测服务的初步设计后，我们开始了预测服务的实现。我们期待在预测服务上线后，与大家分享预测服务的实现细节。

---
