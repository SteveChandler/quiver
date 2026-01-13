---
description: How to train and manage the ML Bias Layer models
---

# ML Bias Layer Workflow

This workflow describes how to set up the environment, train the bias model, and use it for inference.

## 1. Environment Setup

One-time setup to create the Python virtual environment.

```bash
# Create virtual environment
python3 -m venv venv

# Activate (Mac/Linux)
source venv/bin/activate

# Install dependencies
pip install -r ml/requirements.txt
```

## 2. Model Training

Run the training pipeline. This script generates synthetic data for demonstration, trains an XGBoost model, and saves it.

```bash
# // turbo
# Activate and run
source venv/bin/activate
python3 ml/train.py
```

## 3. Inference Integration

The model is saved as `beach_bias_model_v1.json`.
In production, you would load this JSON file and feed it the real-time forecast features.

```python
from ml.model import QuiverBiasModel

# Load
model = QuiverBiasModel()
model.load("beach_bias_model_v1.json")

# Predict
correction = model.predict(features, physics_forecast)
final_forecast = physics_forecast + correction
```
