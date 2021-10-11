---
title: "Feast: a feature store practitioner's perspective"
date: 2021/10/11
description: What is Feast, why it is great, and what it can do better.
tag: ml-sys
author: Yik San Chan
---

# Feast: a feature store practitioner's perspective

## Introduction

I am building a [feature store](https://feast.dev/blog/what-is-a-feature-store/) at PalFish (Series-C online education company based in China) since Feb 2021 (see [the blog](https://yiksanchan.com/posts/palfish-feature-store) for what we build!). As a feature store practitioner, I learn a lot from Feast. In this article, I will walk you through what is Feast, why it is great, and what it can do better.

## What is Feast?

[Feast](https://feast.dev/) is the most starred open-source feature store implementation. [Incubated in Gojek](https://www.gojek.io/blog/feast-bridging-ml-models-and-data) and later [joined Tecton](https://www.tecton.ai/blog/feast-announcement/), Feast is adopted by many teams besides Gojek and Tecton, including [Twitter](https://www.featurestoresummit.com/session/twitters-management-of-ml-features-in-dynamic-environments), [Salesforce](https://www.featurestoresummit.com/session/building-feature-store-for-multi-tenant-and-multi-app-in-salesforce), [Shopify](https://www.applyconf.com/agenda/how-we-contributed-to-scale-feast/), and [Robinhood](https://www.applyconf.com/agenda/how-robinhood-built-a-feature-store-using-feast/).

Feast keeps moving towards a feature-complete feature store implementation. As of version 0.14, it supports mainstream data sources, but it only supports batch features. The next major move will be to support streaming features, while feature transformation and feature quality monitoring are not planned yet.

## Why Feast is great?

There are 4 things I love about Feast.

**Feast clearly defines what a feature store is.** Prior to Feast, I look into multiple in-house feature stores by tech giants via blogs and presentations and I am discouraged to find that their architectures look drastically different as they focus on different problems - [Airbnb](https://www.youtube.com/watch?v=J0Kz5EY0xnM) emphasized feature backfilling; [Twitter](https://www.youtube.com/watch?v=UNailXoiIrY) focused on feature discovery and sharing; [Netflix](https://netflixtechblog.com/distributed-time-travel-for-feature-generation-389cccdd3907) was too coupled with Spark; Uber's [Michelangelo](https://eng.uber.com/michelangelo-machine-learning-platform/) gave the best picture, but there is no reference to deep dive and no author to ask. I need a conceptual framework that truly helps me to think about these systems coherently, and I am [not alone](https://medium.com/data-for-ai/rethinking-feature-stores-74963c2596f0). Luckily I meet Feast, which makes the concept extremely clear, with [articles](https://www.tecton.ai/blog/), [docs](https://docs.feast.dev/), [code](https://github.com/feast-dev/feast), and even a SaaS product [Tecton](https://www.tecton.ai/).

**Feast builds a community that helps people understand feature stores.** I started my feature store research by reading a lot of posts and presentations by Uber, Airbnb, Netflix, etc. When I ran into questions, it was difficult to reach the right person to ask. This is not the case with the Feast community. Any time I ask something about feature stores in Feast's Slack group, [Willem](https://twitter.com/willpienaar) and friends will help.

**Feast delivers what users want.** The team collects feedback from the community, prioritizes properly, and iterates fast to meet users' needs. Here are 2 examples.

- Feast was heavy - it runs on k8s only, and it has inbuilt Spark jobs and a Java server for feature retrieval - just too much infrastructure to maintain. With version 0.10, Feast becomes lightweight that allows users to run the whole feature store within a Python process.
- Feast was opinionated - it has preferred infrastructures of choice, which prevents users from integrating Feast with existing infrastructure. With version 0.10, Feast becomes compatible that allows users to choose inbuilt infrastructure or implement their own by extending the provider interface.

**Feast is neutral.** Despite being sponsored by Tecton, Feast never degrades its SaaS competitors using a table like below, which I find many others do 🤦.

|                   | Feast | Competitor A | Competitor B | Competitor C |
| ----------------- | ----- | ------------ | ------------ | ------------ |
| Awesome Feature 1 | ✅    | ✅           | ❌           | ❌           |
| Awesome Feature 2 | ✅    | ✅           | ❌           | ✅           |
| Awesome Feature 3 | ✅    | ❌           | ✅           | ❌           |
| Awesome Feature 4 | ✅    | ✅           | ✅           | ❌           |
| Awesome Feature 5 | ✅    | ❌           | ❌           | ❌           |

## Can Feast do better?

Feast is great, but it can do better.

**Feast can be done with a statically typed language rather than Python.** Feast is in Python because it was originated by the data science team at Gojek who knew Python better. Nowadays, however, feature stores are mostly developed and maintained by backend engineers. Also, there are many better choices than Python for this system-side (not ml-side) mission-critical software, and I know people who are working on Golang or JVM version of Feast.

## Conclusion

Many thanks to the Feast team for their endless effort to build the standard for feature stores, so that I have the luxury to judge. I hope Feast keeps moving the needle, and I highly suggest everyone who is interested in feature stores check out Feast. You will be sure to learn a lot no matter you decide to adopt, buy or build.

Any feedback? Comment on [Twitter](https://twitter.com/yiksanchan/status/1447583560508968970)!

---
