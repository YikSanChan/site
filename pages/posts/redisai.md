Redis AI

Challenges … We therefore propose a new AI inference engine architecture that aims to solve this problem by running the system in an in-memory database with built-in support for multiple data models, and uses a purpose-built, low-latency, in-database serverless platform to query, prepare, and then bring the data to AI inference engine.

RedisAI is designed to run where the data lives, decreasing latency and increasing simplicity. Benchmarks reveal that RedisAI increases speed by up to 81x compared to other model serving platforms, when the overall end-to-end time is not dominated by the inference itself.

3 data types: tensor, model and script
3 backends: TensorFlow, PyTorch, ONNXRuntime
devices: cpu, gpu
pre- and post- process data via TorchScript
benchmark: RedisAI vs TorchServe, TFServing, REST API serving

This initial benchmark shows that data locality makes a tremendous difference in the benchmark and in any real-life AI solution.

(In upcoming blogs we plan to focus on how you can deploy models with the support for ML-flow and how you can monitor your models in production.)

https://redislabs.com/blog/redisai-ai-serving-engine-for-real-time-applications/
https://redislabs.com/blog/the-challenges-in-building-an-ai-inference-engine-for-real-time-applications/
