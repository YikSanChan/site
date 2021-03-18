---
title: Implementing java.util.concurrent.ArrayBlockingQueue
date: 2021/01/19
description: Implementing an ArrayBlockingQueue from scratch.
tag: implement-to-understand, concurrency
author: Yik San Chan
---

# Implementing java.util.concurrent.ArrayBlockingQueue

`java.util.concurrent.ArrayBlockingQueue` (`j.u.c.ArrayBlockingQueue` from here on) provides an elegant solution to the classic [producer-consumer problem](https://en.wikipedia.org/wiki/Producer%E2%80%93consumer_problem). To understand its internals, the post implements the data structure from-scratch and step-by-step, using the concurrent primitives offered by JDK. At the end of the post, we will have a homegrown `ArrayBlockingQueue` which is quite close to the `j.u.c.ArrayBlockingQueue`.

Disclaimer: Most of the content is a reorg and rewrite of [Java Concurrency in Practice](https://jcip.net/), section 14.1 - 14.4.

## BlockingQueue

Unlike a normal queue, a blocking queue waits for the queue to become non-empty when retrieving an element (`take`) and waits for the queue to become non-full when storing an element (`put`). All blocking queues in the post will implement this interface:

```java
public interface BlockingQueue<E> {
    void put(E e) throws InterruptedException;
    E take() throws InterruptedException;
}
```

Source code can be found [here](https://github.com/YikSanChan/little-java-concurrency/blob/main/src/littlejava/util/concurrent/BlockingQueue.java).

## A simple implementation

Let's start with a simple implementation. The queue is based on an array:

```java
public class ArrayBlockingQueue<E> implements BlockingQueue<E> {

    private final Object[] items;
    private int takeIndex;
    private int putIndex;
    private int count;

    // TODO: put and take implementations
}
```

`put` is straightforward, it literally says "if the queue is full, I will wait until the array becomes non-full to enqueue". Here we meet `synchronized` and `wait`, and we will dive deeper soon.

```java highlight=2,4
@Override
public synchronized void put(E e) throws InterruptedException {
    while (count == items.length)
        wait();
    enqueue(e);
}
```

The `enqueue` assigns the element to the next available slot and move the pointer. Here we meet `notifyAll` and we will dive deeper soon.

```java highlight=5
private void enqueue(E e) {
    items[putIndex] = e;
    if (++putIndex == items.length) putIndex = 0;
    count++;
    notifyAll();
}
```

`take` looks very similar, it literally says "if the queue is empty, I will wait until the array becomes non-empty to dequeue".

```java highlight=2,4,14
@Override
public synchronized E take() throws InterruptedException {
    while (count == 0)
        wait();
    return dequeue();
}

private E dequeue() {
    @SuppressWarnings("unchecked")
    E e = (E) items[takeIndex];
    items[takeIndex] = null;
    if (++takeIndex == items.length) takeIndex = 0;
    count--;
    notifyAll();
    return e;
}
```

Source code can be found [here](https://github.com/YikSanChan/little-java-concurrency/blob/main/src/littlejava/util/concurrent/IntrinsicArrayBlockingQueue.java). Now it is time to explore the `wait` and `notifyAll` methods, as well as the `synchronized` identifier, to understand how they work together.

## Monologue of a thread

Let's re-visit the `put` workflow from a thread's point of view. Its name is T1.

```java
@Override
public synchronized void put(E e) throws InterruptedException {
    while (count == items.length)
        wait();
    enqueue(e);
}

private void enqueue(E e) {
    items[putIndex] = e;
    if (++putIndex == items.length) putIndex = 0;
    count++;
    notifyAll();
}
```

I am T1, a hard-working thread executing the line of code, where `q` is an `ArrayBlockingQueue` instance. Just a line of code, but it is actually the tip of the iceberg:

```java
q.put(1);
```

First, I try to acquire the object lock of `q` because `put` is a synchronized method.

- If the attempt does not succeed, I keep waiting.
- Otherwise, I manage to enter the `while (count == items.length)` test, check if the queue is full.

As I hold the lock, and both `put` and `take` are `synchronized`, no other threads could be executing either of the methods. That is to say, no other threads could potentially modify the object state. This is important because I want to make sure my test result reflects the very truth.

There are two possible test results:

- The queue is full. With `wait`, I release the lock so that other threads can acquire the lock and therefore modify the state, ask the OS to suspend myself (the current thread), and let the OS wake me up when the queue may turn non-full. Upon waking, I contend for the lock attempting to enter the `synchronized` block again. Note that once I manage to re-enter the `synchronized` block, the non-full condition predicate may be false because other threads may have acquired the lock and changed the object's state between when I was awakened and re-acquired the lock. Therefore I want to test `count == items.length` again and that's why the test has to be in a `while` loop rather than an `if`.
- The queue is not full. I enter the `enqueue` method.

Once I enter the `enqueue` method, I place the element on the underlying array. The operation is thread-safe because I still hold the lock. Besides, with `notifyAll`, I notify all waiting threads including threads waiting for the blocking queue to become non-empty.

Lastly, return the object lock and I have finally put an element to the queue. Phew, what a line of code!

## Intrinsic vs. explicit

The simple implementation leverages the intrinsic locking and condition queue mechanism built into the `Object` class.

Intrinsic locking uses the object itself as a lock. When a thread invokes a `synchronized` method, it automatically acquires the lock for the object and releases it when the method returns.

Intrinsic condition queue uses the object itself as a condition queue whose elements are threads. When a thread invokes `wait`, it puts itself in the condition queue. When a thread invokes `notifyAll`, it awakes all threads in the queue - they are waiting for the condition predicate of interest to become true.

Even though the intrinsic locking and condition queue are easy to use, they can be a little confusing when a condition queue is used with more than one condition predicate. In the case of `ArrayBlockingQueue`, `put` needs the condition predicate "the blocking queue is non-full" being true to proceed, and `take` needs the condition predicate "the blocking queue is non-empty" being true to proceed. When T1 is awakened because someone called `notifyAll`, that doesn't mean that the condition predicate "non-full" it was waiting for is now true. This is like having your toaster and coffee maker share a single bell; when it rings, you still have to look to see which device raised the signal.

Ideally, when T1 is awakened, it knows for sure that it is because the condition predicate "non-full" turned true recently. This is where explicit locking and condition variables come into play. Luckily, by leveraging `java.util.concurrent.locks.ReentrantLock` and `java.util.concurrent.locks.Condition`, we're able to achieve the goal by modifying only a few lines of code.

## A better implementation

The implementation explicitly define a lock and two conditions.

```java highlight=10,11,12
import java.util.concurrent.locks.Condition;
import java.util.concurrent.locks.ReentrantLock;

public class ArrayBlockingQueue<E> implements BlockingQueue<E> {

    private final Object[] items;
    private int takeIndex;
    private int putIndex;
    private int count;
    private final ReentrantLock lock;
    private final Condition notEmpty;
    private final Condition notFull;

    public ArrayBlockingQueue(int capacity) {
        if (capacity <= 0)
            throw new IllegalArgumentException();
        items = new Object[capacity];
        lock = new ReentrantLock();
        notEmpty = lock.newCondition();
        notFull = lock.newCondition();
    }

    // TODO: put and take implementations
}
```

`put` leverages the lock and the non-full condition. Compared to the previous implementation, there are three differences to note:

- Instead of acquiring the intrinsic lock when entering the `synchronized` method, it acquires the lock explicitly once it enters the method, and ensures releasing the lock on exit by calling `unlock` in the try-finally block.
- If the non-full condition is false, instead of calling `wait`, it calls `notFull.await()` to only wait for the non-full condition to become true.
- After it passes the non-full test, and places the element on the underlying array, instead of calling `notifyAll()`, it calls `notEmpty.signal()` to only notify threads waiting for the non-empty condition to become true.

```java highlight=3,6,17
@Override
public void put(E e) throws InterruptedException {
    lock.lock();
    try {
        while (count == items.length)
            notFull.await();
        enqueue(e);
    } finally {
        lock.unlock();
    }
}

private void enqueue(E e) {
    items[putIndex] = e;
    if (++putIndex == items.length) putIndex = 0;
    count++;
    notEmpty.signal();
}
```

Similarly, the `take`:

```java highlight=3,6,19
@Override
public E take() throws InterruptedException {
    lock.lock();
    try {
        while (count == 0)
            notEmpty.await();
        return dequeue();
    } finally {
        lock.unlock();
    }
}

private E dequeue() {
    @SuppressWarnings("unchecked")
    E e = (E) items[takeIndex];
    items[takeIndex] = null;
    if (++takeIndex == items.length) takeIndex = 0;
    count--;
    notFull.signal();
    return e;
}
```

`ReentrantLock` and `Condition` offer a more flexible alternative to intrinsic locks and condition queues. Rather than having to share the same condition queue object for the two condition predicates, we get two conditions explicitly with the explicit locking and the `Lock.newCondition` method, which allows finer-grained control over threads. When `notFull.signal()` is called, it won't annoyingly awake a thread that is waiting for the non-empty condition predicate to become true.

Source code can be found [here](https://github.com/YikSanChan/little-java-concurrency/blob/main/src/littlejava/util/concurrent/ArrayBlockingQueue.java).

## Towards j.u.c.ArrayBlockingQueue

Our `ArrayBlockingQueue` is very close to the actual `j.u.c.ArrayBlockingQueue`, except that in `j.u.c.ArrayBlockingQueue`:

**A. The constructor accepts an optional `ReentrantLock` fairness parameter.**

```java
lock = new ReentrantLock(fair);
```

According to the [Javadoc](https://docs.oracle.com/javase/8/docs/api/java/util/concurrent/locks/ReentrantLock.html), it allows developers to pick between higher throughput and smaller variance in time.

> When set true, under contention, locks favor granting access to the longest-waiting thread. Otherwise, this lock does not guarantee any particular access order. Programs using fair locks accessed by many threads may display lower overall throughput (i.e., are slower; often much slower) than those using the default setting, but have smaller variances in times to obtain locks and guarantee lack of starvation.

The unfair lock is used unless specified otherwise probably because higher throughput is preferred over smaller variance in time.

**B. To acquire the lock, it calls `lockInterruptibly` rather than `lock`.**

```java
lock.lockInterruptibly();
```

According to [the thread](https://stackoverflow.com/a/24154479/7550592), `lockInterruptibly` allows the program to immediately respond to the thread being interrupted before or during the acquisition of the lock, where `lock` does not. I am still not sure why this is necessary, and I will do more research and update later.

**C. It employs `final ReentrantLock lock = this.lock` in methods `put` and `take`.**

According to [the thread](http://mail.openjdk.java.net/pipermail/core-libs-dev/2010-May/004165.html), it is "an extreme optimization".

> It's a coding style made popular by Doug Lea. It's an extreme optimization that probably isn't necessary;
> you can expect the JIT to make the same optimizations. (you can try to check the machine code yourself!)
> Nevertheless, copying to locals produces the smallest bytecode, and for low-level code it's nice to write code that's a little closer to the machine.

**D. Missing methods.**

I choose not to implement methods such as `offer` and `poll` because they do not present the key challenges when people implement an `ArrayBlockingQueue`.

## Conclusion

As Richard Feynman once said, "What I cannot create, I do not understand". The process of reading through the great book with overwhelming knowledge, condensing my understanding into an evolving implementation of `ArrayBlockingQueue`, and organizing all I know about the topic into a blog post, is quite satisfying. I encourage you to try this approach on any technical topics that you find interesting.

---
