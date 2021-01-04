---
type: page
title: Readings
date: 2020-01-04
---

# Readings

A sync of my [Goodreads](https://www.goodreads.com/yiksanchan) profile.

---

## Learning Apache Cassandra

[Review](https://www.goodreads.com/review/show/3712606601) ⭑⭑⭑⭑

The book is great if you want to learn Cassandra by getting your hand dirty.

The book walks through some useful fundamentals of Cassandra in a clear structure - partition key, clustering key, column family, clustering, java driver. They are OK explanation, not so different from what's covered in DataStax docs.

However, the handy code example is where it shines.

The book introduces these concepts by setting up and completing "my_status" - A simplified Twitter backend app. It stores data in Cassandra, and different data are stored differently. As the book walkthroughs the data model design process combining the need of the app and the features of Cassandra, readers can sense what makes Cassandra different from SQL, from a very practical perspective. Another good thing is, it focuses on the data storage layer, leaving the application layer untouched, as that will be less relevant to Cassandra.

## Designing Data-Intensive Applications

[Review](https://www.goodreads.com/review/show/3713136943) ⭑⭑⭑⭑⭑

Highly recommend.

Background: I work as a software engineer with around 3 years of experience and limited computer science educational background. I read the book because I want to excel in my technical interview.

From the first-pass, I grasp some solid understanding of how DB stores data on memory and disk, how distributed systems coordinate, etc. The reading consolidated my computer science foundations and helped with technical interviews by a lot, considering I didn't learn much about systems when I was in school.

More importantly, it now becomes a map. Whenever I find a scary word (such as Paxos) somewhere in work, I will look it up in the book and use that as a starting point. It is not the most complete and up-to-date material (and it is not meant to), but it is the best-written and easiest-to-understand. It helps me fight against my fear to learn :)
