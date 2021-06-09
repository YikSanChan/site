---
title: 美团机器学习平台实践
date: 2021/06/10
description: 美团机器学习平台「图灵」和 Uber Michelangelo 异曲同工。
tag: ml-sys, notes
author: 陈易生
---

# 美团机器学习平台实践

## 前言

本文是[「算法工程化实践选读」](/posts/mlsys-we-love)系列的第 5 篇，选读来自美团在 2020 年 1 月发布的技术博客 [一站式机器学习平台建设实践](https://tech.meituan.com/2020/01/23/meituan-delivery-machine-learning.html) [1]。它介绍了美团的机器学习平台「图灵」的总体架构和各个模块的设计。

## 架构

图灵的架构与 [Uber Michelangelo](/posts/uber-michelangelo-overview) 十分接近，都是围绕「数据管理、模型训练、模型评估、模型部署、做出预测、预测监控」的 ML 全流程进行搭建的，如下面两张图所示。

![meituan ml workflow](/images/meituan-turing-overview/meituan-ml-workflow.png)

（图注：图灵架构）

![uber ml workflow](/images/meituan-turing-overview/uber-ml-workflow.png)

（图注：Michelangelo 架构）

基于 [Don't repeat yourself](https://en.wikipedia.org/wiki/Don%27t_repeat_yourself) 原则，我接下来将简略介绍图灵和 Michelangelo 的相似之处，突出图灵的创新之处。

## 数据管理

由「离线特征平台」和「在线特征平台」负责。它们消费数据源，生产实时和离线特征，推送到基于 Redis 的在线特征库，供线上服务使用。

在细节上，图灵提出了「特征组」的概念，将同一维度的特征聚合成一个大的 KV，减少 Redis 中 key 的数量，提高特征读写的性能。

## 模型训练

由「离线训练平台」负责。它支持分类、回归、聚类、深度学习等多种模型，并支持自定义Loss损失函数。

相比 Michelangelo，它在降低使用门槛的道路上走得更远，让模型训练任务的搭建可以全部在浏览器内通过 UI 完成。

在细节上，图灵在产出模型时，除了产出模型文件之外，还产出了一个 MLDL（Machine Learning Definition Language）文件，里面包含模型训练的所有预处理逻辑。在模型服务做出预测之前，MLDL 中的预处理逻辑会被自动执行，避免 [training-serving skew](https://developers.google.com/machine-learning/guides/rules-of-ml#training-serving_skew)。

## 模型评估

接入「AB 实验平台」，通过科学的分流和评估方法（AUC、MSE、MAE、F1 等），更快更好地验证模型的效果。

## 模型部署

由「版本管理平台」负责。它管理算法的版本以及算法版本所用的模型、特征和参数。

## 做出预测

由「模型管理平台」负责。它支持本地和远程两种部署模式

文章没有介绍离线预测。

## 预测监控

文章没有介绍预测监控。

## 总结

## 参考文献

[1] 美团一站式机器学习平台实践. https://tech.meituan.com/2020/01/23/meituan-delivery-machine-learning.html