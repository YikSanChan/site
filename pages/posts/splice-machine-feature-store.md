---
title: A single-store feature store from Splice Machine
date: 2021/10/01
description: One HTAP to rule them all.
tag: ml-sys
author: Yik San Chan
---

# A single-store feature store from Splice Machine

Dual-store architecture is not the only viable option for feature store. You may rely on an HTAP to rull them all.

## Introduction

A [feature store](https://www.tecton.ai/blog/what-is-a-feature-store/) consists of at least two parts, an online store that serves the low-latency online serving purpose, and an offline store that serves the large-scale offline training or inference goal.

Usually, the online/offline stores are in different data systems. But Splice Machine presents a new option - one HTAP database to rule them all.

## The popular dual-store architecture

Most feature stores today share a similar dual-store architecture: a KV store as the online store, and a data warehouse or data lake as the offline store, as shown below. For example, [Uber](https://eng.uber.com/michelangelo-machine-learning-platform/) picks Cassandra and Hive; [Tecton](https://docs.tecton.ai/v2/architecture_overview.html) picks DynamoDB and Delta Lake; Feast defines the online/offline store [protocol](https://docs.feast.dev/getting-started/architecture-and-components/provider) and allows users to choose/implement whatever store they want.

![dual-store architecture](/images/splice-machine-feature-store/dual-store.svg)

Dual-store architecture is good because both stores are good in their way. However, keeping data in sync between the two very different stores is challenging. In Uber's case, batch features added in Hive are copied to Cassandra; real-time features added to Cassandra are ETL-ed to Hive. They all happen automatically thanks to the great though tough software engineering.

Even if your team manages to get it right, you now have a 3x more complex infrastructure to maintain, as you need a compute engine (such as Spark) to move data and a workflow orchestrator (such as Airflow) to schedule the data moving jobs.

Even worse, data governance in the system becomes very hard given so many moving parts.

## Splice Machine's single-store architecture

Given the downside of the dual-store architecture, Splice Machine goes a different path - have a single store rather than two, as shown below.

![single-store architecture](/images/splice-machine-feature-store/single-store.svg)

While it eliminates the need to sync data, the team runs into a new challenge: how to build a store that serves both low-latency lookups and OLAP queries?

The Splice Machine team just knows, as they have provided HTAP (Hybrid Transactional/Analytical Processing) capabilities in their [DB product](https://doc.splicemachine.com/) (also named Splice Machine) to customers since 2017. Now in 2021, they build a feature store highly based on the HTAP DB. Below are some design highlights.

### Cost-based optimizer

There exists a cost-based optimizer sitting between SQL queries and execution backends. The optimizer chooses the execution backend based on the query workload. If it is a key-based lookup, HBase is used; otherwise, if it is a OLAP query, Spark is used.

### Feature set table and feature set history table

There are two types of table supporting the feature store - feature set and feature set history.

A feature set table stores the latest values of a feature set, and it serves online features retrieval. Schema:

```
primary_key, last_update_ts, feature_1, feature_2, ...
```

Instead, a feature set history table stores historical values of a feature set, and it serves offline training and inference. Schema:

```
primary_key, asof_ts, until_ts, feature_1, feature_2, ...
```

A feature set history table is a CDC (Change Data Capture) table of the corresponding feature set table. Every time there is an INSERT or UPDATE to the feature set table, a DB trigger is triggered to INSERT a record to the feature set history table, where asof_ts = feature_set.last_update_ts and until_ts = NOW().

### Prediction table

The most innovative part of the feature store is how it runs prediction. Here is a typical prediction workflow:

1. A program (could be a Spark job, or just a piece of Python code) gets features from a feature store.
2. Feed the feature vector into a model served somewhere, which could be the program memory or a dedicated k8s pod in the case of [Seldon Core](https://docs.seldon.io/projects/seldon-core/en/stable).
3. Wait for the prediction results.
4. Save the (primary_key, feature_vector, prediction) tuple in another store.

Splice Machine does it diffferently leveraging prediction tables. Schema:

```
model_id, primary_key, feature_1, feature_2, ..., prediction NULLABLE
```

Whenever there are predictions to be made, whether a point or batch prediction, it simply inserts the (model_id, primary key, feature_vector) into the table, triggers another DB trigger, and populates the prediction result.

According to the schema, each model in the table should expect the same set of features. Is it correct?

### Guaranteed governance with SQL queries

With both feature and prediction data in one store, feature and model governance have never been easier. Basically, you can answer below questions with simple SQL queries:

- Is a certain feature drifting? Just compare the statistics of the trained features vs. actual features.
- Is the model making reasonable prediction? Ditto.
- Given a feature, what models are using it? Check some metadata tables.
- Want to re-train the model? Training dataset has been collected as prediction tables if we backfill labels properly.

The list can go on. See [the post](https://medium.com/data-for-ai/data-lineage-doesnt-have-to-be-hard-da990d3b5a73) for more details.

### Other highlights

Splice Machine Feature Store also implements [time-travel query (aka point-in-time join)](https://towardsdatascience.com/point-in-time-correctness-in-real-time-machine-learning-32770f322fb1) and feature backfill.

## Final thoughts

I am very impressed by the simple architecture of the Splice Machine Feature Store.

The only concern I have is performance, especially when compared with its KV store competitors such as Redis, as machine learning can be very latency-sensitive in some scenarios. For example, in a recommendation system, it is common having to retrieve hundreds of candidates (= looking up the feature store with hundreds of primary keys) within milliseconds.

Besides the architecture itself, I am also curious about Splice Machine's HTAP implementation. Sadly it is closed-source and I have no further information about this.

## Acknowledgements

I want to thank [Monte Zweben](https://twitter.com/mzweben) and Jack Ploshnick for making the feature store presentation on the Data+AI Summit 2021, and [Jim Dowling](https://twitter.com/jim_dowling) for pointing me to Splice Machine when I ask about single-store architecture in the great [MLOps.community](http://MLOps.community) Slack workspace.

## References

[Presentation Video](https://databricks.com/session_na21/unified-mlops-feature-stores-model-deployment),
[Presentation Slides](https://www.slideshare.net/databricks/unified-mlops-feature-stores-model-deployment).

If you find it interesting, discuss at [Twitter](https://twitter.com/yiksanchan/status/1443781434850775048)!

---
