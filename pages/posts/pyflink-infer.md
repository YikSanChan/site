---
title: Run ML batch inference with PyFlink
date: 2021/07/31
description:
tag: flink
author: Yik San Chan
---

# Run ML batch inference with PyFlink

## Flink and PyFlink

Flink is a stream-native big data engine, a competitor to Spark. PyFlink is little more than a Python wrapper to Flink. It allows you to execute Python UDFs in real Python VMs. This makes it native to use Python libraries including TensorFlow, PyTorch, LightGBM and Scikit Learn in your Flink jobs!

So, let's get started! After this reading, you will leverage the power of PyFlink to generate large number of predictions provided a ML model and a test dataset.

Note: All code can be found in [this repo](https://github.com/YikSanChan/pyflink-lightgbm-batch-inference).

## Install Flink locally

Follow [this](https://ci.apache.org/projects/flink/flink-docs-release-1.13/docs/try-flink/local_installation/#step-1-download). I customize a bit and install Flink 1.13.0 under `~/softwares/flink-1.13.0/`. Once this is done, verify the installation. Note that it takes a few seconds to get the output on my Macbook.

```sh
$ ~/softwares/flink-1.13.0/bin/flink --version
Version: 1.13.0, Commit ID: f06faf1
```

## Set up a Python environment for both training and inference

Since we will train the model and run inference both with Python, let's first set up a Python environment.

Step 1. Ensure you have Anaconda installed. See [guide](https://docs.anaconda.com/anaconda/install/).

Step 2. Prepare a Python environment for both model training and inference, and save it as `environment.yaml`.

```yaml
name: pyflink-lightgbm
channels:
  - defaults
  - conda-forge
dependencies:
  - python=3.7
  - lightgbm=3.2.1
  - pandas==1.1.5
  - pip
  - pip:
      - apache-flink==1.13.0
```

Step 3. Create a conda environment.

```sh
$ conda env create -f environment.yaml
```

Step 4. Activate the environment.

```sh
$ conda activate pyflink-lightgbm
```

## Train a LightGBM model

LightGBM is a popular open-source framework for tree-based machine learning. Let's follow the steps to train a LightGBM model. This is almost a copy-and-paste from the [LightGBM example](https://github.com/microsoft/LightGBM/blob/master/examples/python-guide/simple_example.py).

Step 1. Download the train and test datasets, and save to data/ directory.

```sh
$ mkdir data
$ wget -O data/regression.train https://raw.githubusercontent.com/microsoft/LightGBM/master/examples/regression/regression.train
$ wget -O data/regression.test https://raw.githubusercontent.com/microsoft/LightGBM/master/examples/regression/regression.test
```

Now take a look at the data.

```sh
$ head data/regression.train
```

Each row starts with a label followed by 28 numeric features.

Step 2. Create a `utils.py` file and implement a helper method to load data.

```python
from pathlib import Path
import pandas as pd

def load_data():
    print('Loading data...')
    # load or create your dataset
    regression_example_dir = Path.cwd() / 'data'
    df_train = pd.read_csv(str(regression_example_dir / 'regression.train'), header=None, sep='\t')
    df_test = pd.read_csv(str(regression_example_dir / 'regression.test'), header=None, sep='\t')

    y_train = df_train[0]
    y_test = df_test[0]
    X_train = df_train.drop(0, axis=1)
    X_test = df_test.drop(0, axis=1)

    return (X_train, y_train), (X_test, y_test)
```

Step 3. Create a `train.py` file and implement the training logic. Run `python train.py`, and it will save the trained model as `model.txt`.

```python
import lightgbm as lgb
from utils import load_data

def train_model():
    (X_train, y_train), (X_test, y_test) = load_data()

    # create dataset for lightgbm
    lgb_train = lgb.Dataset(X_train, y_train)
    lgb_eval = lgb.Dataset(X_test, y_test, reference=lgb_train)

    # specify your configurations as a dict
    params = {
        'boosting_type': 'gbdt',
        'objective': 'regression',
        'metric': {'l2', 'l1'},
        'num_leaves': 31,
        'learning_rate': 0.05,
        'feature_fraction': 0.9,
        'bagging_fraction': 0.8,
        'bagging_freq': 5,
        'verbose': 0
    }

    print('Starting training...')
    # train
    gbm = lgb.train(params,
                    lgb_train,
                    num_boost_round=20,
                    valid_sets=lgb_eval,
                    early_stopping_rounds=5)

    print('Saving model...')
    # save model to file
    gbm.save_model('model.txt')

if __name__ == "__main__":
    train_model()
```

Step 4. Create a `vanilla_infer.py` file and implement the inference logic with vanilla Python. Run `python vanilla_infer.py` and verify that the model is ready for use.

```python
import lightgbm as lgb
from utils import load_data
from sklearn.metrics import mean_squared_error

if __name__ == "__main__":
    gbm = lgb.Booster(model_file="model.txt")

    print('Starting predicting...')
    _, (X_test, y_test) = load_data()
    # predict
    y_pred = gbm.predict(X_test, num_iteration=gbm.best_iteration)
    # eval
    rmse_test = mean_squared_error(y_test, y_pred) ** 0.5
    print(f'The RMSE of prediction is: {rmse_test}')
```

## Infer with PyFlink

A PyFlink script usually comes with the following boilerplate to initiate a table environment, that will execute Flink SQL commands of choice. Create a `pyflink_infer.py` file and blindly type it out.

```python
env_settings = EnvironmentSettings.new_instance().in_streaming_mode().use_blink_planner().build()
t_env = TableEnvironment.create(env_settings)

SOURCE = """
TODO
"""

SINK = """
TODO
"""

TRANSFORM = """
TODO
"""

t_env.execute_sql(SOURCE)
t_env.execute_sql(SINK)
t_env.execute_sql(TRANSFORM)
```

Let's fill the blanks.

Step 1. Fill the source. Note that:

- The DDL mirrors the data structure in the `data/regression.test` file.
- We use an absolute filepath. **Remember to replace it with your absolute path**.

```sql
CREATE TABLE source (
    label INT,
    f1 DOUBLE,
    f2 DOUBLE,
    f3 DOUBLE,
    f4 DOUBLE,
    f5 DOUBLE,
    f6 DOUBLE,
    f7 DOUBLE,
    f8 DOUBLE,
    f9 DOUBLE,
    f10 DOUBLE,
    f11 DOUBLE,
    f12 DOUBLE,
    f13 DOUBLE,
    f14 DOUBLE,
    f15 DOUBLE,
    f16 DOUBLE,
    f17 DOUBLE,
    f18 DOUBLE,
    f19 DOUBLE,
    f20 DOUBLE,
    f21 DOUBLE,
    f22 DOUBLE,
    f23 DOUBLE,
    f24 DOUBLE,
    f25 DOUBLE,
    f26 DOUBLE,
    f27 DOUBLE,
    f28 DOUBLE
) WITH (
    'connector' = 'filesystem',
    'format' = 'csv',
    'csv.field-delimiter' = '\t',
    'path' = '/Users/chenyisheng/source/yiksanchan/pyflink-lightgbm-batch-inference/data/regression.test'
)
```

Step 2. Fill the sink. To make it simple, let's simply prints all predictions.

```sql
CREATE TABLE sink (
    prediction DOUBLE
) WITH (
    'connector' = 'print'
)
```

Step 3. Fill the transformation logic.

```sql
INSERT INTO sink
SELECT PREDICT(
    f1, f2, f3, f4, f5, f6, f7, f8, f9, f10, f11, f12, f13, f14, f15, f16, f17, f18, f19, f20, f21, f22, f23, f24, f25, f26, f27, f28
) FROM source
```

We need a `PREDICT` function that calls `model.predict(X)` under the hood. This is where [Python UDFs](https://ci.apache.org/projects/flink/flink-docs-release-1.13/docs/dev/python/table/udfs/overview/) come into play.

Step 4. Implement the `PREDICT` UDF. In the `Predict` class, the `open` method loads the model from `archive.zip/model.txt` (explain soon!), and the `eval` method calls `model.predict(X)` to run inference.

```python
class Predict(ScalarFunction):
    def open(self, function_context):
        import lightgbm as lgb

        logging.info("Loading model...")
        self.model = lgb.Booster(model_file="archive.zip/model.txt")

    def eval(self, f1, f2, f3, f4, f5, f6, f7, f8, f9, f10, f11, f12, f13, f14, f15, f16, f17, f18, f19, f20, f21, f22, f23, f24, f25, f26, f27, f28):
        import pandas as pd

        logging.info("Predicting, batch size=%d...", len(f1))
        df = pd.concat([f1, f2, f3, f4, f5, f6, f7, f8, f9, f10, f11, f12, f13, f14, f15, f16, f17, f18, f19, f20, f21, f22, f23, f24, f25, f26, f27, f28], axis=1)
        return pd.Series(self.model.predict(df))


predict = udf(Predict(), result_type=DataTypes.DOUBLE(), func_type="pandas")
# register
t_env.create_temporary_function("predict", predict)
```

Step 5. Spin up a local Flink cluster. If it goes well, you should be able to browse the Flink Web UI at http://localhost:8081/.

```sh
$ ~/softwares/flink-1.13.0/bin/start-cluster.sh
```

Step 6. Prepare resources to run on a Flink cluster. To run our batch inference job on the cluster (whether local or remote), we need two more `ZIP`s beside the `pyflink_infer.py` script:

- A Python environment on which your UDFs execute, and
- An archive that packages all resources you would like to access in your UDFs.

Let's first zip the Python environment. We could reuse the local `pyflink-lightgbm` conda env, since it has all we need.

```sh
$ (cd /usr/local/anaconda3/envs/pyflink-lightgbm && zip -r - .) > pyenv.zip
```

Then, let's zip the model file.

```sh
$ zip archive.zip model.txt
```

Step 7. Submit the job. Note we pass the zips via `-pyarch`, the PyFlink job via `-py`, and an executable via `-pyexec`. To learn more about these configurations, see [docs](https://ci.apache.org/projects/flink/flink-docs-release-1.13/docs/dev/python/python_config/). If you read Chinese, [this post](https://flink-learning.org.cn/article/detail/4cec607976040b67e30d2ce7e4c4f369) by [Dian Fu](https://github.com/dianfu) (Flink PMC) explains their use well.

```sh
$ ~/softwares/flink-1.13.0/bin/flink run -d \
-pyexec pyflink-lightgbm/bin/python \
-pyarch archive.zip,pyenv.zip#pyflink-lightgbm \
-py pyflink_infer.py
```

Once it prints `Job has been submitted with JobID xxx`, go to the Web UI http://localhost:8081/ and you should find a running job. Check the Task Manager Logs, and you should be able to find a log like this:

```text
2021-07-31 15:59:57,973 INFO  org.apache.flink.python.env.beam.ProcessPythonEnvironmentManager [] - Python working dir of python worker: /var/folders/mv/cqj767rd5631xfy3hhrl8lcm0000gn/T/python-dist-f34c0570-ccb6-495e-bedf-72ebaf9690ea/python-archives
```

Since the Python archives only exist while the job is running, let's move fast. What's inside the python-archives directory?

```sh
$ ls /var/folders/mv/cqj767rd5631xfy3hhrl8lcm0000gn/T/python-dist-f34c0570-ccb6-495e-bedf-72ebaf9690ea/python-archives
archive.zip           pyflink-lightgbm
```

Ah! They are unzipped `archive.zip` and the `pyflink-lightgbm` conda env. This explains why the Python UDF loads model from `archive.zip/model.txt`.

Check out Task Manager Stdout, you should be able to find the predictions!

```text
+I[0.7182363191106926]
+I[0.6764137145521492]
+I[0.45047591809992166]
+I[0.6949404724810613]
...
```

## Summary

Great! We manage to run ML batch inference with PyFlink. I hope this is helpful.

---
