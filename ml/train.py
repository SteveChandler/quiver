import pandas as pd
import numpy as np
from transformers import FeatureEngineer
from model import QuiverBiasModel
from datetime import datetime, timedelta

def generate_synthetic_data(n_samples=1000):
    """Generates synthetic wave data for demonstration."""
    print("Generating synthetic data...")
    dates = [datetime(2023, 1, 1) + timedelta(hours=3*i) for i in range(n_samples)]
    
    data = {
        'timestamp': dates,
        'wave_height_model': np.random.uniform(0.5, 4.0, n_samples),
        'wave_period': np.random.uniform(6.0, 18.0, n_samples),
        'wave_direction': np.random.uniform(0, 360, n_samples),
        'wind_speed': np.random.uniform(2.0, 15.0, n_samples),
        'wind_direction': np.random.uniform(0, 360, n_samples),
    }
    
    df = pd.DataFrame(data)
    
    # Simulate a systematic bias: Model under-predicts when period is low and wind is high
    # True Obs = Model + Bias
    # Bias = function(period, wind)
    # e.g., if period < 10, models miss local wind chop -> bias > 0
    bias = (12 - df['wave_period']).clip(lower=0) * 0.1 + (df['wind_speed'] * 0.05)
    noise = np.random.normal(0, 0.2, n_samples)
    
    df['wave_height_obs'] = df['wave_height_model'] + bias + noise
    
    # Enforce physical reality
    df['wave_height_obs'] = df['wave_height_obs'].clip(lower=0.1)
    
    return df

def main():
    # 1. Load Data
    df = generate_synthetic_data(2000) # 2000 samples (~8 months of 3-hourly data)
    
    print(f"Loaded {len(df)} samples.")
    print("Sample Data head:")
    print(df.head())
    
    # 2. Target Engineering (Residual)
    # y = Obs - Model
    y = df['wave_height_obs'] - df['wave_height_model']
    
    # 3. Feature Engineering
    fe = FeatureEngineer()
    X = fe.preprocess(df)
    
    # Drop non-feature columns for training
    features_to_drop = ['timestamp', 'wave_height_model', 'wave_height_obs']
    X_train = X.drop(columns=[c for c in features_to_drop if c in X.columns])
    
    print("\nTraining Features:")
    print(X_train.columns.tolist())
    
    # 4. Train Model
    model = QuiverBiasModel()
    metrics = model.train(X_train, y)
    
    print("\nTraining Complete.")
    print(f"CV RMSE: {metrics['mean_cv_rmse']:.4f} +/- {metrics['std_cv_rmse']:.4f} meters")
    
    # 5. Save Model
    model.save("beach_bias_model_v1.json")
    
    # 6. Inference Demo
    print("\n--- Inference Demo ---")
    sample = X_train.iloc[-5:].copy()
    physics_forecast = df['wave_height_model'].iloc[-5:].copy()
    
    corrected = model.predict(sample, physics_forecast)
    
    results = pd.DataFrame({
        'Original_Forecast': physics_forecast.values,
        'Corrected_Forecast': corrected.values,
        'Actual_Obs': df['wave_height_obs'].iloc[-5:].values
    })
    
    results['Improvement'] = np.abs(results['Original_Forecast'] - results['Actual_Obs']) - np.abs(results['Corrected_Forecast'] - results['Actual_Obs'])
    
    print(results)
    print(f"\nPositive improvement means error was reduced.")

if __name__ == "__main__":
    main()
