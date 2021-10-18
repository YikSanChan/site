---
title: "Fixing models by fixing datasets: A note from Feature Store Summit 2021"
date: 2021/10/18
description: Atindriyo at Galileo introduced why data quality challenges are critical to solve in Feature Store Summit 2021.
tag: notes, mlsys
author: Yik San Chan
---

# Fixing models by fixing datasets: A note from Feature Store Summit 2021

This article is a curation of a talk given by Atindriyo Sanyal on Feature Store Summit 2021. Atindriyo is the co-founder and president of [Galileo](https://www.rungalileo.io/). He was previously leading Machine Learning Data Quality and Observability efforts for Uber and is the co-architect of the world’s first Feature Store - Michelangelo Palette.

## Introduction

ML has a simple equation: `prediction = model(data)`. To get better predictions, we need both better models as well as better data. While model architectures are maturing quickly, tools to ensure better data quality, however, hasn't been in place yet. In Atindriyo's talk, he introduced common data quality challenges and how to tackle them.

## Data quality challenges

Here are the data quality challenges faced across the data lifecycle.

### Find and curate datasets

The goal here is to find and curate data that are high value, representative, and get us a maximum lift with minimum data.

To find such datasets, we could filter by feature redundancy and relevance to labels, see [Uber's practice](https://eng.uber.com/optimal-feature-discovery-ml/).

To curate the datasets, there are at least 2 ways.

- The first approach is called active learning. Basically, it identifies sparse regions of our datasets by leveraging embeddings from pre-trained layers of our models. This helps pick a diverse dataset. See [this paper](https://arxiv.org/pdf/1708.00489.pdf).
- The second approach is to identify decision boundaries and pick data around them. This helps pick datasets that make the model more robust.

### Identify problems in datasets

Once we get the datasets, we want to identify problems in them. In this part, Atindriyo didn't define each problem, and I have little context about the topic, so honestly what I am doing here is just transcribing what he said.

Dataset problems include regions of model underperformance, robustness across sub-populations, similar and dissimilar examples, noisy data and labels. What we can do to eliminate these problems?

- Segregate noisy data from good data through looking at confidence margin and confidence correlation to the uncertainty of the model across different features. This helps to identify regions of model underperformance and figure out what data to augment to our dataset. See [this paper](https://arxiv.org/pdf/1911.00068.pdf).
- Inspect joint distribution between noisy and clean labels, along with observing fractions of samples that are misclassified. This can help detect errors in ground truth labels.
- Leverage SHAP value.

### Detect data quality problems in production

Problems include train-serve skew, feature and label drift, etc.

## My take

Data quality in ML is not discussed enough given how fundamental it is to make a model really useful. I cannot wait to see the launch of Galileo, and if you know any other startups working on this problem, please kindly let me know!

---
