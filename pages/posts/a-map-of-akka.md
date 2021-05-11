---
title: Akka 导图
date: 2020/06/12
description: A Map of Akka 译文。Akka 各模块之间究竟是个什么关系？
tag: translation, akka
author: 陈易生
---

# Akka 导图

**译者的话**

[A Map of Akka](https://blog.codecentric.de/en/2015/07/a-map-of-akka/)是[Heiko Seeberger](https://github.com/hseeberger)
于 2015 年写的一篇文章，简明扼要地介绍了 Akka 各模块间的内在逻辑联系。5 年后的今天，Akka 最核心的模块仍旧是这几个，内在逻辑也几乎没变。
我希望这篇文章能作为一张地图，让还没有使用过 Akka 的读者得以初识 Akka 全貌，也让正在使用 Akka 的读者不至于迷失在浩如烟海的官方文档中。

Heiko 是 Akka 的早期贡献者，也是 Scala 社区的重要贡献者。
我有幸与 Heiko 在[Tubi](https://tubitv.com/)短暂共事，得到了他的许多帮助。
即使在他回到 Lightbend 担任[Cloudstate](https://cloudstate.io/)项目的 Tech Lead 后，他仍会在 Github 上解答我的问题。
本文的翻译得到了 Heiko 的同意，我在此特意感谢他对我的帮助，祝他能带队把 Cloudstate 做成功。
翻译大幅借助于[DeepL Translate](https://www.deepl.com/en/translator)，感谢这个工具。

---

[actor 模型](https://en.wikipedia.org/wiki/Actor_model)已被证明能提供六个九(99.9999%)及以上的可用性。
Jonas Bonér(译者注：Lightbend 的创始人和 CTO)在 2009 年启动[Akka 项目](https://akka.io/)，想把 actor 模型带到 JVM。
Akka 是开源的，使用 Apache 2 许可，提供 Java 和 Scala 的 API。
如果你对 Akka 的历史感兴趣，可以看看[Akka 5 周年](https://www.lightbend.com/akka-five-year-anniversary)这一博文。

这些年，Akka 愈发成熟，被广泛使用，
最近还获得了 2015 年[JAX 最创新开源技术奖](https://www.lightbend.com/blog/akka-wins-2015-jax-award-for-most-innovative-open-technology)。
Akka 的成长可以容易地从[GitHub 上根项目](https://github.com/akka/akka)下的子项目数量看出。

为什么要考虑使用 Akka？它能提供什么？
本文从鸟瞰的角度来看看它最重要的模块以及它们的功能，以便让你对 Akka 的整体能力有一个大体了解。
我们计划(但不承诺)在后续文章中进行深入探讨。

## Akka Actors

akka-actor 模块是 Akka 的核心和灵魂，它是所有其它模块和功能的基础。
本质上，它实现了 actor 模型，而不涉及任何 remoting、cluster awareness、persistence 等概念。

有趣的是，Jonas Bonér 曾经告诉我，remoting 永远不会脱离[Akka actors](https://blog.codecentric.de/en/2015/08/introduction-to-akka-actors/)
而成为一个独立的模块，然而如你所见，事情是会改变的
(译者注：见[akka-remote](https://github.com/akka/akka/tree/master/akka-remote/src) 模块)。
不过，分布式的设计在 Akka actors 保留了下来。
在 Akka 中，所有的东西默认都是分布式的。
这种设计直面了网络的古怪之处。

akka-actor 将 actors 作为程序的基本构件，带来以下好处：

- 松散耦合(loose coupling)：得益于 share-nothing 和异步消息传递(asynchronous messaging)。
- 可恢复性(resilience)：得益于对故障的分类和授权处理。
- 弹性(elasticity)：得益于位置透明(location transparency)。

在进一步了解这些功能之前，建议阅读[《响应式宣言》](https://www.reactivemanifesto.org/)，
它描述了"现代"系统(例如高可用网站或其它运行重要任务的服务器)的典型要求和特征。
这篇文档不长，定义了一套条理清晰的用语来谈论当今 IT 领域的一些重要事情。

回到 Akka actors 的特点。
在 Akka 中，所有的东西都是一个 actor。根据 actor 模型的发明者 Carl Hewitt 的说法，"单独的 actor 不算是 actor"，它们总是以系统(译者注：ActorSystem)的形式出现。
Actors 之间不共享任何东西，也就是说，它们摒弃了"共享的可变状态"中的"共享"(从并发的角度看，"共享"是万恶之源)。
Actors 只通过异步消息进行通信，这个设计与 share-nothing 一起带来的松散耦合允许通信的另一方暂时不可用。
这与主流的命令式面向对象编程中常用的同步方法调用(synchronous method calls)形成鲜明对比。
在这种模式下，调用方会一直被阻塞，直至被调用方返回。Ouch!

在同步方法调用中处理异常(exceptions)也很烦人。
你知道别处出了问题，而你还得负责处理(即便这个问题本不是你的锅)。
举个例子。假设有一台自动售货机收了你的钱但没有弹出你要吃的零食，你会怎么做？
或者你会踢这台售货机，但你肯定不会去修它，那是别人的工作。
你大概率会在吃不到零食的情况下活下来，或者尝试去找其它能用的售货机。

使用 actors 这一模式，在(网络)故障(failure)的情况下，你最差不过收不到回信，就像没有得到你想要的零食一样。
对失败的处理会被委托给其它的 actor。
在 Akka 中，每个 actor 都有一个家长，它监督所有的子 actors。
监督者的职责是处理出问题的 actors，例如重启或停止。
因此，通信(发送消息并希望得到响应)与故障处理脱钩。这意味着故障仅限于出错的 actor 及其监督者，而不会向调用方扩散。
换句话说，故障只影响系统的一部分，而非整个系统。

最后，要与一个 actor 进行对话并不需要知道对方的物理位置，这就是所谓的位置透明。
这是因为每个 actor 都有一个逻辑地址用于与你通信，而隐藏了它的物理位置，将你和它解耦。
因此，即使一个 actor 实际位于一个远程节点上(这需要使用下面提到的 Akka Remoting)，
你仍可以向远程 actor 发送消息，而无需知道这个 actor 是否是本地 actor 系统的一部分。

综上所述，Akka actors 提供了很底层(low level)的工具，让你能够写出非常响应式(reactive)的系统。
当然，你需要分布式来实现真正具有弹性和可扩展性的系统，Akka actors 提供了所有需要的基础，剩下的由其它模块和功能负责。

## Akka Remoting

akka-remote 是一个极其重要的模块，因为它使得远程通信和真实位置的透明化成为可能。
听上去会比较复杂，但实际使用起来只需要配置一下。

```
akka {
  actor {
    // The default is "akka.actor.LocalActorRefProvider"
    provider = "akka.remote.RemoteActorRefProvider"
  }
  remote {
    netty.tcp {
      hostname = "127.0.0.1" // that's the default
      port     = 9001        // the default is 2552
    }
  }
}
```

你只需要配置 RemoteActorRefProvider(译者注：在最新版本的 Akka 中，只需设为`cluster`即可)。
这允许你在远程 actor 系统上部署 actor，(并对远程 actor 进行)远程死亡观察、故障检测等。
虽然这很棒，但大多数场景下它太底层了，因为它需要确切知道正在协作的 actor 系统的远程地址。

## Akka Cluster

[Akka Cluster](https://blog.codecentric.de/en/2016/01/getting-started-akka-cluster/)在 Akka Cluster 的基础上提供了更高层的控制。
它由 akka-cluster、akka-cluster-tools、akka-cluster-sharding 等模块构成。
它的核心功能在于提供会员(membership)服务，允许 actor 系统加入和/或离开一个集群。
任何 actor 都可以监听集群事件(cluster events，例如 MemberUp 或 MemberRemoved)，动态地了解潜在的远程通信方的情况。
一个分布式的故障检测器(failure detector)监控各个成员节点的健康，以提供当前集群状态的一致视图。
它可能宣布成员节点无法访问而触发 UnreachableMember 事件。

集群事件可以被直接使用，也可以通过更高层的特性被隐性地使用，例如：

- Cluster-aware routers：在远程成员节点上创建或查找 routees。
- Cluster Singleton：保证在集群中某个 actor 只存在一个实例。
- Cluster Sharding：可以将大量 actors 分布在成员节点上。
- Distributed Data：基于[CRDT](https://en.wikipedia.org/wiki/Conflict-free_replicated_data_type)的一致(consistent)数据复制，无需中央协调。

## Akka Persistence

Actor 被重启的原因有很多，例如，程序掷出异常、硬件或网络故障(远程节点不可用)。
由于 actor 完全隐藏了内部状态，因此要想在重启后将 actor 恢复到原先状态，唯一的办法是向它发送和以前一样的消息。

显然，这很适合[Event Sourcing](https://www.martinfowler.com/eaaDev/EventSourcing.html)。
Akka Persistence 正是通过 Event Sourcing 来恢复 actor 的状态。
Event Sourcing 区分了命令(commands)和事件(events)。
一个 persistent actor 收到一个命令后，可能会创建一个事件，并要求 Akka Persistence 的日志(日志后端可能基于 Cassandra 或 Kafka)将事件持久化。
一旦持久化被确认，它就将事件用于改变状态。
在复原过程中，所有的事件都会被重演，使得状态最终恢复如从前。
Akka Persistence 也支持快照，避免因事件过多而导致复原耗时过长。

## Akka Streams and Akka HTTP

Akka Streams 和 Akka HTTP 是实验性的模块，还不是"官方"Akka 发行版的一部分(译者注：现在这两个模块已经十分成熟，属于 Akka 官方发行版的一部分)。

Reactive Streams 约定如何通过非阻塞的 back pressure 来解决异步流处理中的问题。
Akka Streams、Reactor、RxJava、Slick 和 Vert.x 是[Reactive Streams](http://www.reactive-streams.org/)的不同实现。
和前述 Akka Cluster 等模块一样，Akka Streams 的实现也基于 actors。

Akka Streams 的一个完美用例是 Akka HTTP，它是由非常成功的[spray 项目](http://spray.io/)演化而来。
一个 HTTP 服务器接受一个 HTTP 请求流并产生一个 HTTP 响应流。
同时，HTTP entities 的 body 基本上是一个甚至多个数据块，可以很好地表达为字节流。

## Conclusion

我们概述了 Akka 的几个模块。
最底层的 Akka actors 仅仅实现了 actor 模型，为 Akka Cluster、Akka Persistence 和 Akka HTTP 这样的高层抽象打下基础。
因此，每一个模块都具备 actor 模型的好处：松散耦合、可恢复性和弹性。

前文提到，我们正计划写一些后续文章，更深入地介绍各个模块。期待您的问题和反馈。

---
