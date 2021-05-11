---
title: Akka Actors 极简实现
date: 2020/11/05
description: 知其然，也知其所以然。
tag: akka, implement-to-understand
author: 陈易生
---

# Akka Actors 极简实现

## Little Akka 项目简介

作为 Akka 的使用者，我欣赏 Akka 的 API 之简单以及功能之强大，于是希望通过实现一个极简的 Akka，帮助自己了解 Akka 的实现，便有了 [Little Akka](https://github.com/YikSanChan/little-akka) 这个项目[[^1]]。

Akka 作为一个工业级的框架，在代码效率、错误处理、可配置性上都做了大量的工作。相比于 Akka，Little Akka 在实现上做了以下取舍：

- 追求正确性而非效率。追求效率的代码往往伴随着底层的操作（例如位运算和反射），降低了代码的可读性。
- 着重 happy path 而有意忽略 sad path。Happy path 是程序运行时以更大概率经过的路径，相比于较为琐碎的错误处理逻辑，包含了更多关于工作原理的信息，降低理解负担。
- 如非必要，不支持定制化配置。

除此之外，Little Akka 在实现上遵循以下原则：

- API 尽量与 Akka 保持一致。
- 在引入下一阶段特性之前，尽量不引入更复杂的概念和模块。

项目大量参考了 [Unmesh Joshi 的博客](https://medium.com/@unmeshvjoshi/how-akka-actors-work-b0301ec269d6) 以及 [Akka 源码](https://github.com/akka/akka) [[^2]][[^3]]。目前，Little Akka 可以支持以下简单场景。

```scala
import java.util.concurrent.TimeUnit

object Reply {

  private final case class StartPing(ponger: ActorRef)
  private final case object Ping
  private final case object Pong

  class Pinger extends Actor {

    override def receive: Receive = {
      case StartPing(ponger) =>
        println(s"[$self] Got StartPing from sender=${sender()}")
        ponger ! Ping
      case Pong =>
        println(s"[$self] Got Pong from sender=${sender()}")
    }
  }

  class Ponger extends Actor {

    override def receive: Receive = { case Ping =>
      println(s"[$self] Got Ping from sender=${sender()}")
      sender() ! Pong
    }
  }

  // [LocalActorRef(pinger1)] Got StartPing from sender=null
  // [LocalActorRef(pinger2)] Got StartPing from sender=null
  // [LocalActorRef(ponger)] Got Ping from sender=LocalActorRef(pinger2)
  // [LocalActorRef(ponger)] Got Ping from sender=LocalActorRef(pinger1)
  // [LocalActorRef(pinger2)] Got Pong from sender=LocalActorRef(ponger)
  // [LocalActorRef(pinger1)] Got Pong from sender=LocalActorRef(ponger)
  def main(args: Array[String]): Unit = {
    val system = new ActorSystem()
    val pinger1 = system.actorOf(classOf[Pinger], "pinger1")
    val pinger2 = system.actorOf(classOf[Pinger], "pinger2")
    val ponger = system.actorOf(classOf[Ponger], "ponger")
    pinger1 ! StartPing(ponger)
    pinger2 ! StartPing(ponger)
    system.awaitTermination(1, TimeUnit.SECONDS)
  }
}
```

## Akka Actor 心智模型

Actor 模型强制使用信息传递而非直接方法调用的方式进行沟通。因此，Actor 通过暴露 ActorRef 这一逻辑地址（即 `system.actorOf` 的返回类型），屏蔽了 Actor 的实体（即 ActorCell，在下一节会介绍），避免开发者直接对 Actor 的实体进行直接方法调用。

在接收到信息后，Dispatcher 会将信息放入专属于该 Actor 的 Mailbox。Dispatcher 还会从 Mailbox 抓取信息，根据开发者定义的 Actor 行为，对信息进行处理。整个过程是完全异步的。

这一过程可以用如下示意图概括，出自 [Improving Akka Dispatchers](https://scalac.io/improving-akka-dispatchers/) [[^4]]。

![Lifecycle of a message](/images/little-akka/lifecycle-of-a-message.png)

## Little Akka 代码解析

下面我们通过解析 Little Akka 的实现，加深对 Akka Actor 心智模型的理解。出于可读性的考虑，以下代码用于展示核心逻辑，并不保证能够编译。可执行的完整代码和详细的注释请参见 [GitHub](https://github.com/YikSanChan/little-akka)。

### Actor

封装 Actor 的状态和行为。允许开发者通过 `receive` 方法定义 `ActorCell`（即上面提到的 Actor 实体）在接收到来外界信息时的行为。

```scala
object Actor {
  type Receive = PartialFunction[Any, Unit]
}

trait Actor {
  type Receive = Actor.Receive

  def receive: Receive
}
```

### ActorRef

Actor 的逻辑地址。提供 `tell`（常表达为 `!`）方法，作为外界向 `ActorCell` 传递信息的唯一接口，并在 constructor 内创建 `ActorCell`，即 Actor 实体。`LocalActorRef` 是 ActorRef 的最简实现，如果 Little Akka 需要支持节点间通信，还需要实现 RemoteActorRef。

```scala
trait ActorRef {
  def !(message: Any)(implicit sender: ActorRef = Actor.noSender): Unit
}

class LocalActorRef(
    clazz: Class[_],
    val dispatcher: Dispatcher
) extends ActorRef {

  private val actorCell: ActorCell = new ActorCell(this, clazz, dispatcher)

  override def !(message: Any)(implicit
      sender: ActorRef = Actor.noSender
  ): Unit = actorCell.sendMessage(message, sender)
}
```

### Mailbox

存放信息，并定义任务行为。信息的存放通过 `ConcurrentLinkedQueue` 实现。同时，Mailbox 还是一个可以被 `ForkJoinPool` 执行的 `ForkJoinTask`，任务通过 `exec()` 方法进行定义，内容为：将信息出列，做批处理（ `processMailbox` 的参数 `left` 代表批大小），对当前批中的每一条信息调用 `ActorCell` 的 `invoke` 方法。

```scala
class UnboundedMessageQueue
    extends ConcurrentLinkedQueue[Envelope]
    with MessageQueue

class Mailbox(val messageQueue: MessageQueue)
    extends ForkJoinTask[Unit] {

  var actor: ActorCell = _

  def enqueue(msg: Envelope): Unit = {
    messageQueue.enqueue(msg)
  }

  def dequeue(): Envelope = messageQueue.dequeue()

  @tailrec private final def processMailbox(
      left: Int = dispatcher.throughput.max(1)
  ): Unit = {
    val next = dequeue()
    if (next ne null) {
      actor.invoke(next)
      if (left > 1)
        processMailbox(left - 1)
    }
  }

  final def run(): Unit = {
    processMailbox()
    dispatcher.registerForExecution(this)
  }

  override def exec(): Boolean = {
    run();
    false
  }
}
```

### Dispatcher

处理信息。持有一个 `ForkJoinPool`，用于执行 `Mailbox`。还提供了 `dispatch` 方法，供 `ActorCell` 调用。

```scala
class Dispatcher(val executorService: ForkJoinPool) {

  def dispatch(receiver: ActorCell, invocation: Envelope): Unit = {
    val mailbox = receiver.mailbox()
    mailbox.enqueue(invocation)
    registerForExecution(mailbox)
  }

  def registerForExecution(mailbox: Mailbox): Unit = {
    executorService.execute(mailbox)
  }
}
```

### ActorSystem

持有默认的 `Dispatcher`，并提供用于创建 `ActorRef`的工厂方法 `actorOf`。Little Akka 暂未实现 Akka 所具备的管理 Actor 阶层的特性。

```scala
class ActorSystem(
    val dispatcher: Dispatcher = new Dispatcher(
      new ForkJoinPool(Runtime.getRuntime.availableProcessors)
    )
) {
  def actorOf[T <: Actor: ClassTag](clazz: Class[T], name: String): ActorRef = {
    new LocalActorRef(clazz, name, dispatcher)
  }
}
```

### ActorCell

Actor 实体。持有 `Dispatcher` 和 `Mailbox`，根据 `receive` 定义的行为，对通过 `tell` 传入的信息进行处理。处理的过程为：

- 将信息入列 `Mailbox`
- 若 `Mailbox` 状态为空闲，标记为繁忙
- 由 `Dispatcher` 持有的 `ForkJoinPool`去执行 `Mailbox`， `Mailbox` 的工作内容在前面已有介绍
- 在 `Mailbox` 完成当前批后，标记状态为空闲

```scala
class ActorCell(val self: ActorRef, clazz: Class[_], val dispatcher: Dispatcher)
    extends ActorContext {

  private val _mailbox = new Mailbox(new UnboundedMessageQueue())

  private val actor: Actor =
    clazz.getDeclaredConstructor().newInstance().asInstanceOf[Actor]

  private val receive: Actor.Receive = actor.receive

  private def receiveMessage(messageHandle: Envelope): Unit = {
    receive(messageHandle.message)
  }

  def invoke(messageHandle: Envelope): Unit = {
    receiveMessage(messageHandle)
  }

  def sendMessage(message: Any, sender: ActorRef): Unit = {
    dispatcher.dispatch(this, Envelope(message, sender))
  }
}
```

## 其它 Actor 实现

我在学习过程中还发现了几个较好的 Actor 的 Scala 实现，包括 [Viktor Klang 的实现](https://github.com/plokhotnyuk/actors/blob/master/src/test/scala/com/github/gist/viktorklang/Actor.scala) 和 [Li Haoyi 的实现](https://github.com/lihaoyi/castor/blob/master/castor/src/Actors.scala) [[^5]][[^6]]。它们的代码量更小，但与 Akka 目前的 API 有较大的不同。

## 参考文献

[^1] Little Akka. [https://github.com/YikSanChan/little-akka](https://github.com/YikSanChan/little-akka)

[^2] Unmesh Joshi, How Akka Actors work. [https://github.com/akka/akka](https://github.com/akka/akka)

[^3] Akka. [https://github.com/akka/akka](https://github.com/akka/akka)

[^4] Zachari Dichev, Improving Akka Dispatchers. [https://scalac.io/improving-akka-dispatchers/](https://scalac.io/improving-akka-dispatchers/)

[^5] Viktor Klang, Actor. [https://github.com/plokhotnyuk/actors/blob/master/src/test/scala/com/github/gist/viktorklang/Actor.scala](https://github.com/plokhotnyuk/actors/blob/master/src/test/scala/com/github/gist/viktorklang/Actor.scala)

[^6] Li Haoyi, Actor. [https://github.com/lihaoyi/castor/blob/master/castor/src/Actors.scala](https://github.com/lihaoyi/castor/blob/master/castor/src/Actors.scala)

---
