A very common type of feature transformation is a rolling time window aggregation.

For example, you may use the rolling 30-minute order count of a restaurant to predict the order preparation time of your favorite food delivery service.

However, serving this type of feature for real-time predictions in production poses a difficult problem: How can you efficiently serve such a feature that aggregates a lot of raw events (> 1000s), at a very high scale (> 1000s QPS), at low serving latency (<< 100ms), at high freshness (<< 1s), and with high feature accuracy (e.g. a guaranteed and not approximate time window length)?

A naive implementation to the problem posed above may be to simply query a transactional database (like MySQL) in production every time a real-time prediction is made.

A common next step to scale the architecture above is to precompute aggregations in real-time as new raw data becomes available, and to make the features available in a scalable KV-store that’s optimized for low latency serving (like Dynamo or Redis)

For large data volumes, this will quickly lead to OutOfMemoryExceptions if not configured properly.

...

Part 2


