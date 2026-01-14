# ml/check_model_health.py
"""Check model health metrics and alert if degraded."""
import os
import sys
from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

# Thresholds
MIN_IMPROVEMENT_RATE = 55.0  # percent
MIN_AVG_IMPROVEMENT = 0.0    # meters (model should not hurt)

def check_health():
    """
    Check model health metrics from the last 7 days.

    Returns:
        dict with status, metrics, and any alerts
    """
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    # Get weekly metrics
    result = supabase.rpc('get_ml_weekly_metrics').execute()

    if not result.data:
        return {
            "status": "no_data",
            "alert": True,
            "message": "No prediction data in the last 7 days"
        }

    metrics = result.data[0]
    alerts = []

    # Check if model is hurting (negative improvement)
    if metrics.get('avg_improvement_m') is not None and metrics['avg_improvement_m'] < MIN_AVG_IMPROVEMENT:
        alerts.append(
            f"MODEL HURTING: avg improvement {metrics['avg_improvement_m']:.3f}m (should be > 0)"
        )

    # Check improvement rate
    if metrics.get('pct_improved') is not None and metrics['pct_improved'] < MIN_IMPROVEMENT_RATE:
        alerts.append(
            f"LOW IMPROVEMENT: {metrics['pct_improved']:.1f}% (threshold: {MIN_IMPROVEMENT_RATE}%)"
        )

    # Check data volume
    if metrics.get('with_ground_truth', 0) < 100:
        alerts.append(
            f"LOW DATA: only {metrics['with_ground_truth']} predictions with ground truth"
        )

    status = "degraded" if alerts else "ok"

    return {
        "status": status,
        "alert": bool(alerts),
        "metrics": {
            "model_version": metrics.get('model_version'),
            "predictions": metrics.get('predictions'),
            "with_ground_truth": metrics.get('with_ground_truth'),
            "avg_raw_error_m": metrics.get('avg_raw_error_m'),
            "avg_corrected_error_m": metrics.get('avg_corrected_error_m'),
            "avg_improvement_m": metrics.get('avg_improvement_m'),
            "pct_improved": metrics.get('pct_improved')
        },
        "alerts": alerts
    }


def main():
    """Run health check and print results."""
    print("=" * 60)
    print("ML Model Health Check")
    print("=" * 60)

    result = check_health()

    print(f"\nStatus: {result['status'].upper()}")

    if result.get('metrics'):
        print("\nMetrics (last 7 days):")
        for key, value in result['metrics'].items():
            if value is not None:
                print(f"  {key}: {value}")

    if result['alerts']:
        print("\n⚠️  ALERTS:")
        for alert in result['alerts']:
            print(f"  - {alert}")
        sys.exit(1)
    else:
        print("\n✅ All metrics healthy")
        sys.exit(0)


if __name__ == "__main__":
    main()
