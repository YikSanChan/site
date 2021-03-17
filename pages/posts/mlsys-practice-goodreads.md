---
title: MLSys Practice Goodreads
date: 2021/03/17
description: Goodreads on practical ML systems, and comments.
tag: notes, ml-sys
author: Yik San Chan
---

# MLSys Practice Goodreads

## Feature Store

---

[Tecton: What is a Feature Store](https://www.tecton.ai/blog/what-is-a-feature-store/), 2020/10, by Mike Del Balso (who founded [Tecton](https://tecton.ai) and built [Uber Michelangelo](https://eng.uber.com/michelangelo-machine-learning-platform/)) and Willem Pienaar (who built [Feast](https://feast.dev/)).

![general-feature-store-architecture](/images/mlsys-practice-goodreads/general-feature-store-architecture.png)

A coherent conceptual framework to understand what make a feature store. I will use it as a starting point and refer it as Feast-architecture from here on, so please **READ THIS FIRST**.

---

[Tubi: Rethinking Feature Stores](https://medium.com/data-for-ai/rethinking-feature-stores-74963c2596f0), 2019/07, by Chang She.

Ask a good question (quoted below). Luckily it is partially answered in the Tecton post.

> I've found it difficult to think about these existing systems coherently. In general the focus has been "well we needed to satisfy requirement X so we implemented Y in this way" (e.g., Ziplines backfilling, Michelangelo's online store, etc). But I haven't really seen a conceptual framework that truly helps us think about how all of these different pieces fit together. Without a coherent conceptual framework, the result seems to be that depending on what use case you decide to add or remove, the architecture to serve these use cases may look drastically different. For anyone trying to select or design a feature store, this is not very encouraging.

---

[Lyft: ML Feature Serving Infrastructure at Lyft](https://eng.lyft.com/ml-feature-serving-infrastructure-at-lyft-d30bf2d3c32a), 2021/03, by Vinay Kakade and Shiraz Zaman.

![lyft feature service architecture](/images/mlsys-practice-goodreads/lyft-feature-service-architecture.png)

The overall architecture is very similar to Feast's, with two minor differences:
- Ingestion: Offline feature store (Hive) is the downstream of the online feature store (DynamoDB), connected via Dynamo Streams (maybe cdc).
- Storage: Elasticsearch feature store is in place for advanced queries.

Comments:
- Ingestion: How does the offline store -> online store flow compare to Feast's?
- Storage: What are the advanced queries that ML practitioners do?

---

[Chang She: The Feature Store for AI](https://medium.com/swlh/the-feature-store-for-ai-45dea7922063), 2020/12, by Chang She.

Ask a good question: ML Tooling for **unstructured** data (images, videos, etc) has not caught up.

Comments:
- [ActiveLoop](https://github.com/activeloopai/hub) may help. It allows users to read unstructured data just as a `pandas.DataFrame`, from multiple sources (s3 etc). Chang and friends are also working on something called [rikai](https://github.com/eto-ai/rikai).

---