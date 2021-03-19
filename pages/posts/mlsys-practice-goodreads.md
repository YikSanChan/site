---
title: MLSys Practice Goodreads
date: 2021/03/17
description: Goodreads on practical ML systems, and comments.
tag: notes, ml-sys
author: Yik San Chan
---

# MLSys Practice Goodreads

## Feature Store

### What is a Feature Store

[Link](https://www.tecton.ai/blog/what-is-a-feature-store/). By Mike Del Balso at [Tecton](https://tecton.ai) and Willem Pienaar at [Feast](https://feast.dev), 2020/10.

The post introduces a coherent conceptual framework to understand what make a feature store. I will use it as a starting point and refer to it as "Feast-architecture" or "Feast's" from here on, so please **READ THIS FIRST**.

![general-feature-store-architecture](/images/mlsys-practice-goodreads/general-feature-store-architecture.png)

### Rethinking Feature Stores

[Link](https://medium.com/data-for-ai/rethinking-feature-stores-74963c2596f0). By Chang She at Tubi, 2019/07.

The post asks a good question as quoted below. Luckily it is partially answered in the Tecton post.

> I've found it difficult to think about these existing systems coherently. In general the focus has been "well we needed to satisfy requirement X so we implemented Y in this way" (e.g., Ziplines backfilling, Michelangelo's online store, etc). But I haven't really seen a conceptual framework that truly helps us think about how all of these different pieces fit together. Without a coherent conceptual framework, the result seems to be that depending on what use case you decide to add or remove, the architecture to serve these use cases may look drastically different. For anyone trying to select or design a feature store, this is not very encouraging.

### Building Riviera: A Declarative Real-Time Feature Engineering Framework

[Link](https://doordash.engineering/2021/03/04/building-a-declarative-real-time-feature-engineering-framework/). By Allen Wang and Kunal Shah at DoorDash, 2021/03.

Riviera uses Flink SQL as DSL for feature engineering, because:

- It is a proven approach as shown by User's [Michelangelo](https://eng.uber.com/michelangelo-machine-learning-platform/) and Airbnb's [Zipline](https://databricks.com/session/zipline-airbnbs-machine-learning-data-management-platform).
- Flink SQL is mature enough with contributions from Uber, Alibaba, etc.

While Flink SQL is good at feature transformation logic, it is weird to define the underlying infrastructure with (think of the `WITH ('connector' = 'kafka', 'properties.bootstrap.servers' = '...')` section). YAML works great in this front (think of k8s). This is how users define the feature "total orders confirmed by a store in the last 30 minutes" in Riviera:

```yaml
source:
  - type: kafka
    kafka:
      cluster: ${ENVIRONMENT}
      topic: store_events
      schema:
        proto-class: "com.doordash.timeline_events.StoreEvent"

sinks:
  - name: feature-store-${ENVIRONMENT}
    redis-ttl: 1800

compute:
  sql: >-
    SELECT 
      store_id as st,
      COUNT(*) as saf_sp_p30mi_order_count_avg
    FROM store_events
    WHERE has_order_confirmation_data
    GROUP BY HOP(_time, INTERVAL '1' MINUTES, INTERVAL '30' MINUTES), store_id
```

Comments:

- The marriage of Flink SQL (for compute) and YAML (for infra) in beautiful.
- Everyone likes Protobuf, no? (Note the `proto-class` field above)

### ML Feature Serving Infrastructure at Lyft

[Link](https://eng.lyft.com/ml-feature-serving-infrastructure-at-lyft-d30bf2d3c32a). By Vinay Kakade and Shiraz Zaman at Lyft, 2021/03.

Introduce how Lyft build feature store. The architecture is very similar to Feast's, with two noticeable differences:

- Ingestion: Offline feature store (Hive) writes data to the online feature store (DynamoDB) through Dynamo Streams (maybe CDC).
- Storage: Elasticsearch feature store is in place for advanced queries.

![lyft feature service architecture](/images/mlsys-practice-goodreads/lyft-feature-service-architecture.png)

Comments:

- Ingestion: The CDC approach is very specific to the database in use.
- Storage: What are the advanced queries that ML practitioners do?

### The Feature Store for AI

[Link](https://medium.com/swlh/the-feature-store-for-ai-45dea7922063). By Chang She at Tubi, 2020/12.

Ask a good question: ML Tooling for **unstructured** data (images, videos, etc) has not caught up.

Comments:

- [Activeloop](https://github.com/activeloopai/hub) allows users to read unstructured data just as a `pandas.DataFrame`, from multiple sources (s3 etc). Chang and friends are also working on [rikai](https://github.com/eto-ai/rikai).

---
