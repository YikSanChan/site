---
title: 如何提问
date: 2021/05/11
description: 好好提问，是优秀工程师的基本素养。
tag: work-ethic
author: 陈易生
---

# 如何提问

我在工作中会遇到非常多的问题，其中一些无法通过已有的文档和搜索引擎自行解决，只能求助于负责有关项目的同事，或者是社区的热心网友。我本身很享受提问的过程，因为它不仅能帮助我更好地梳理遇到的问题，记录解决问题的过程，还能在未来持续地帮助到有同样疑问的人，见[我的 Stack Overflow 提问记录](https://stackoverflow.com/users/7550592/yik-san-chan?tab=questions)。

下面是我自己总结的一些提问的小技巧，它们或许也能帮你更好地提问，从而得到更好的解答。注意，此文与 [Stack Overflow - How to ask](https://stackoverflow.com/help/how-to-ask) 基本一致，因为我也是在 Stack Overflow 上被「关闭」和「建议修改」了好多问题后，才慢慢学会如何提问的。

## 我们认真提问，别人才会认真回答

提问首先需要遵循平等原则，即提问方和回答方是平等的。即使是在有明确权责关系的公司环境内，提问方不会因为发现了负责项目的同事写的 bug 而更高，也不会因为懂得比负责项目的同事少而更低。

基于平等原则，如果我们想得到认真的回答，就必须认真地提问。

## 一个认真的提问包含哪些内容

如何认真提问？

首先，态度要端正，尽力避免在问题描述中包含让人不想帮你的因素，包括：

- 错别字和格式不规整的代码。它们会严重影响读者的理解。
- 失效链接。它们会丢失重要信息，带来后续不必要的追问。
- 非必要贴图。读者往往需要浪费很多时间把贴图上的错误日志打下来，上网搜，或者把代码敲出来，去复现。

要做到态度端正，我们不妨在提问前问问自己：

- 如果回答我们问题的人，是个一小时收费 2000 块钱的律师，我们会不会这样提问？
- 如果我们是回答问题的人，看到这样的问题，愿不愿意去帮忙？

其次，逻辑要清晰，信息要完整。一个好的提问通常包括：

- 简短描述在做什么事情，大背景是什么。
- 简短描述期待的结果是什么。
- 详细描述参考了哪些文档，做了哪些尝试，分别遇到哪些阻碍。
- 如何快速地复现问题。

最后，表示感谢。

## 一次认真提问的实践

听上去合理，能不能举个 🌰？

下面我不要脸地用自己在 Flink 邮件列表中的[一次提问](http://apache-flink-user-mailing-list-archive.2336050.n4.nabble.com/PyFlink-called-already-closed-and-NullPointerException-td42997.html)作为例子，这个提问在 [Flink 中文社区：如何从 0 到 1 开发 PyFlink 作业](https://mp.weixin.qq.com/s/GyFTjQl6ch8jc733mpCP7Q)一文中被引用为好的提问示例，见文章引用链接的第 7 条。

第一步，标题。示例提问表明，这是 PyFlink 相关的问题，报错信息包括 "called already closed" 和 "NullPointerException" 这两个关键词。

> PyFlink: called already closed and NullPointerException

第二步，简短描述在做什么事情，大背景是什么。示例提问表明，同一个简单的 PyFlink 脚本，多跑几次，会出现 3 种不同的结果，很奇怪。

> I run into an issue where a PyFlink job may end up with 3 very different outcomes, given very slight difference in input. The PyFlink job is simple. It first reads from a csv file, then process the data a bit with a Python UDF that leverages `sklearn.preprocessing.LabelEncoder`.

第三步，做了哪些尝试，分别遇到哪些阻碍。以示例提问提到的第 3 种结果为例，除了完整的错误栈之外，它还展现出提问者参考了什么资料，但没能解决这个问题。

> The NullPointerException reminds me of [this question](https://stackoverflow.com/questions/67092978/pyflink-vectorized-udf-throws-nullpointerexception), but I have passed the `test_ml_udf.py` to ensure both the input and output types are `pandas.Series` with same length.

第四步，如何快速地复现问题。示例提问专门创建了一个 GitHub 仓库，让回答方可以快速复现问题，无需任何额外的猜测。

> I have included all necessary files for reproduction in the [GitHub repo](https://github.com/YikSanChan/pyflink-issue-call-already-closed).
> To reproduce:
>
> - `conda env create -f environment.yaml`
> - `conda activate pyflink-issue-call-already-closed-env`
> - `pytest` to verify the udf defined in `ml_udf` works fine
> - `python main.py` a few times, and you will see multiple outcomes

结果是，这个问题得到了社区方面明确和快速的帮助。

## 总结

好好提问是工程师的必备技能，能让我们得到同事和社区大佬的全力帮助。让我们一起努力，好好提问吧！

---
