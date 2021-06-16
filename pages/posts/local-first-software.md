---
title: 本地优先软件
date: 2021/06/17
description: 什么是本地优先软件，它与纯网络应用和传统桌面软件相比，有什么优势？
tag: notes
author: 陈易生
---

# 本地优先软件

## 前言

我一直好奇 [CRDTs](https://en.wikipedia.org/wiki/Conflict-free_replicated_data_type) 的应用场景，恰好读到 [Designing Data-Intensive Applications (DDIA)](https://dataintensive.net/) 的作者 [Martin Kleppmann](https://martin.kleppmann.com/) 于 2019 年 4 月与 [Ink & Switch](https://www.inkandswitch.com/) 合作发布的文章 [Local-first software](https://www.inkandswitch.com/local-first.html)，即本地优先软件。文章指出，Google Docs 这样的纯网络应用存在离线无法使用、数据隐私难以保障的问题，使得用户缺少对数据的所有权。而 IDEs 这样的传统桌面应用缺乏协同支持。本地优先软件提供了一种数据所有权和协同支持兼备的解决方案，其依赖的基础技术正是 CRDTs。感兴趣的读者，可以去 [crdt.tech](https://crdt.tech/) 或者[这篇博客](./crdts-the-hard-parts-notes)了解 CRDTs 的基础知识。

原则上，本地优先软件将用户数据存储在本地，同时支持基于 CRDTs 的跨设备数据同步。基于这一原则，Ink & Switch 实现了三款本地优先软件原型，总结了一些经验教训。2020 年 8 月，公司推出 [Muse](https://museapp.com/)，开始商业化尝试。

原文的合著者牛人密集，除了 Martin 外，还有 [Heroku](https://www.crunchbase.com/organization/heroku) 的联合创始人兼 CTO [Adam Wiggins](https://adamwiggins.com/)。本文谨作抛砖引玉之用，建议大家阅读原文。

## 纯网络应用与传统桌面应用

大家熟知的软件大体分为两类：纯网络应用和传统桌面应用。

Google Docs 是纯网络应用的一个代表。它的突出优点在于支持多用户协同编辑，但同时也具有网络应用的一般缺点：用户的数据全部存储在 Google 的服务器上，因此用户并不真正拥有自己的数据，反之由 Google 完全拥有用户的数据，并选择性地向用户展示。如果 Google 选择关停该服务或者服务宕机，甚至仅仅因为用户无法访问互联网，用户都将暂时或永久地失去对自己数据的访问权。

IDEs（例如 Java 工程师常用的 IntelliJ IDEA）则是传统桌面应用的一个代表。与纯网络应用相反，用户的数据（包括代码和依赖缓存）全部存储在用户本地的文件系统上，因此用户完全拥有自己的数据，但缺点在于不支持多用户协同编辑。

## 常见软件的缺憾

常用的软件往往位于由纯网络应用和桌面应用作为两极所形成的光谱中。为了进一步区分光谱中的各种软件，原文将软件的特性进一步细分为七个维度：

- 快速访问（Fast）
- 多设备访问（Multi-device）
- 离线支持（Offline）
- 协同支持（Collaboration）
- 长寿（Longevity），指即使公司不再维护软件，关闭软件服务器，软件也能在用户的本地正常运行
- 隐私（Privacy）
- 用户控制（User control），指用户对自己数据的完全掌控

让我们从这七个维度重新审视几款在世界范围内被广泛使用的软件。

**[Google Docs](https://docs.google.com/)** - 作为纯网络应用的代表，Google Docs 有一个[瘦客户端](https://en.wikipedia.org/wiki/Thin_client)，客户端基本上只起到缓存的作用，对离线的支持很有限。但它对协同编辑有较好的支持。

**[Messenger App](https://www.messenger.com/desktop)** - 作为现代手机应用的代表，Messenger 有一个[胖客户端](https://en.wikipedia.org/wiki/Rich_client)，它使用 SQLite 数据库在客户端存储用户数据和渲染逻辑，提供缓存和事务支持，UI 仅仅作为数据库数据的直接反映。当然，服务器依然存在，但因为大量数据被存储在本地，因而它能离线地完成更多功能。Messenger 的架构可参考这篇[技术博客](https://engineering.fb.com/data-infrastructure/messenger/)。

**文件 + email 附件** - 文件存放在本地文件系统，通过 email 附件的方式进行共享，是一种古老但有效的软件形式，主要缺点在于完全不提供协同支持。

**[Dropbox](https://www.dropbox.com/)** - 作为云文件同步产品的代表，Dropbox 实时监测本地文件系统中某个文件夹的变化，一旦发现变化就会将其同步到云，进而同步到用户的其它设备。Dropbox 对协同的支持很弱，如果两个用户同时对一个文件进行互斥的修改，将会有一个修改后的文件被标记为冲突备份（conflicted copy）。

**[Firebase](https://firebase.google.com/)** - 它是一款被 Google 收购并发扬光大的实时数据库，流行于后端权重较小的全栈项目。它替开发者实现了本地数据库和云数据库之间的即时同步，从而使得开发者可以专注于使用 SDK 实现业务逻辑，而无需关注应用是否在线、本地数据和云端数据如何同步等问题。Firebase 提供多种冲突解决策略以及配套的 API：`set()` 和 `update()` 会遵循 last-write-wins 的策略，`push()` 能避免产生冲突，`transaction()` 会遵循 compare-and-set 的策略，在冲突时重试。参考 [Understanding conflict resolution in Firebase](https://stackoverflow.com/questions/48822264/understanding-conflict-resolution-in-firebase)。

**[Git](https://en.wikipedia.org/wiki/Git) + [GitHub](https://github.com/)** - 相比 [SVN](https://en.wikipedia.org/wiki/Apache_Subversion)，Git 的突出优点是可以完全离线。GitHub 通过提供 Git 的托管服务，支持协同和多设备访问。它满足了七个维度中的大部分，是当前最接近本地优先的常用软件，但仍有两点小缺憾：

- 冲突解决的过程需要较多人为介入（`git rebase`），而缺少自动化和实时性。
- 只针对文本做了高度的优化，而对其它格式的文件（例如图片）没办法做有效的编辑和合并。

下面是对六款软件在七个维度上表现的一个总结：

|                 | 快速访问 | 多设备访问 | 离线支持 | 协同支持 | 长寿 | 隐私 | 用户控制 |
| --------------- | -------- | ---------- | -------- | -------- | ---- | ---- | -------- |
| Google Docs     | —        | ✓          | —        | ✓        | —    | ✗    | —        |
| Messenger App   | ✓        | —          | ✓        | ✗        | —    | ✗    | ✗        |
| 文件 + email 附件 | ✓        | —          | ✓        | ✗        | ✓    | —    | ✓        |
| Dropbox         | ✓        | —          | —        | ✗        | ✓    | —    | ✓        |
| Firebase        | —        | ✓          | ✓        | —        | ✗    | ✗    | ✗        |
| Git + GitHub      | ✓        | —          | ✓        | —        | ✓    | —    | ✓        |

（✓ 代表好，— 代表普通，✗ 代表不好）

## 本地优先软件

Ink & Switch 提出本地优先软件的概念，希望软件能同时在以上七个维度做到最好。本地优先软件：

- 把数据存放在本地，因此容易满足快速访问、离线支持、长寿、隐私和用户控制这几个维度的需求。
- 使用 CRDTs 作为冲突解决的基础技术，实现去中心化的协同支持。
- 使用 p2p 网络技术解决多端的通信，满足多设备访问的需求。

然而，理论上可行的解决方案距离落地往往有不少的坑要踩。为了探索技术在实践中的适用性，Ink & Switch 实现了三款应用：类似 [Trello](https://trello.com/) 的项目管理看板应用 [Trellis](https://github.com/automerge/trellis)，略像 [Figma](https://www.figma.com/) 的协同像素画板 [PixelPusher](https://github.com/automerge/pixelpusher)，以及画板应用 [PushPin](https://github.com/automerge/pushpin)。在实践中，Ink & Switch 有几个有趣的发现：

- 冲突并不如想象中的那么严重。一方面，用户在协同编辑时，会有意避免冲突。另一方面，Ink & Switch 为搭建协同软件开发的 [automerge](https://github.com/automerge/automerge) 算法往往在冲突的自动解决上做得不错，名副其实。
- CRDTs 会记录非常巨大的历史编辑信息，造成性能问题。为什么问题难以解决呢？因为历史编辑信息不能随便地丢弃或合并，否则一个用户在离线六个月后重新上线时，将无法恢复到最新的数据。
- 网络通信有待进一步研究。尽管 CRDTs 不排斥将中央服务器用于通信，但使用去中心化的网络通信仍是本地优先场景下的长远目标，可惜目前并没有成熟的 p2p 网络解决方案。

## 总结

我小时候在电脑上玩单机版口袋妖怪（Pokémon），步入社会后在互联网公司给大型互联网公司拧螺丝，不可避免地觉得桌面 app 的时代就像我的口袋妖怪时光一样已经过去，纯网络应用才是现在和未来。而 Google 只给软件开发实习生发 Chromebook 而不发 MacBook，正是因为结合 Google 强大的基础设施，软件工程师使用 Chromebook 就可以无痛完成软件开发的全部环节，让我看到 ~~Google 的抠门~~ 万物上云的大势。

然而，Slack / Datadog 等应用，乃至于 AWS S3 / Fastly / Cloudflare 这样的互联网基础设施的不时宕机，让我渐渐体会到完备的离线支持的重要性。如果抛开服务本身的质量问题不谈，文章提到的数据隐私和用户控制问题就是纯网络应用完全没有激励去解决的问题，用户基本上只能靠着欧盟或极少数个人的不懈起诉，来维持所剩无几的体面，参考 [The Great Hack](https://www.netflix.com/title/80117542)。

本地优先软件或许真的是一个能同时解决数据隐私和数据协同问题的解决方案。

---
