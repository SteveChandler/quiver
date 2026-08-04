"""Build and execute the recommendation satisfaction cross-check notebook."""

from __future__ import annotations

from pathlib import Path

import nbformat
from nbclient import NotebookClient


OUTPUT_PATH = Path(__file__).with_name(
    "2026-08-03-recommendation-satisfaction-cross-check.ipynb"
)


def markdown(source: str) -> nbformat.NotebookNode:
    return nbformat.v4.new_markdown_cell(source)


def code(source: str) -> nbformat.NotebookNode:
    return nbformat.v4.new_code_cell(source)


cells = [
    markdown(
        """# Recommendation satisfaction cross-check

## TL;DR

Official recommendation-attributed satisfaction is not measurable because the durable impression and session attribution tables contain zero production rows. Across all 16 beaches with real rated sessions, 15 of 33 sessions were satisfied. Fifteen beaches can be crossed with the Quiver-versus-Surfline benchmark; Rockview cannot.
"""
    ),
    markdown(
        """## Context & methods

Window: 2026-07-09 00:00 UTC through 2026-08-04 00:00 UTC.

Population: real, non-mock users with saved sessions and non-null 1–5 ratings. Satisfaction is rating >=4. PostHog recommendation exposure uses `surf_window_impression`. The correct attribution join is Supabase `recommendation_impressions` to `sessions` on `(user_id, recommendation_id)`; that path currently has no rows.

The notebook uses frozen, reviewed aggregate results from PostHog HogQL and read-only Supabase queries. It contains no user identifiers. Query definitions are preserved below for reproducibility.
"""
    ),
    code(
        """from math import sqrt
import pandas as pd

def wilson_interval(successes: int, trials: int, z: float = 1.96) -> tuple[float, float]:
    if trials == 0:
        return (float('nan'), float('nan'))
    p = successes / trials
    denominator = 1 + z**2 / trials
    center = (p + z**2 / (2 * trials)) / denominator
    half_width = z * sqrt(p * (1 - p) / trials + z**2 / (4 * trials**2)) / denominator
    return center - half_width, center + half_width
"""
    ),
    markdown("## Data"),
    code(
        """measurement_funnel = pd.DataFrame([
    {'stage': 'PostHog surf-window impression events', 'count': 242, 'people': 43},
    {'stage': 'Impressions with authenticated user ID', 'count': 97, 'people': 6},
    {'stage': 'Durable recommendation impression rows', 'count': 0, 'people': 0},
    {'stage': 'Saved sessions with recommendation_id', 'count': 0, 'people': 0},
])

evidence = pd.DataFrame([
    {'evidence': 'Official recommendation_id attribution', 'eligible_sessions': 0, 'satisfied_sessions': 0},
    {'evidence': 'Sessions at exposed spots', 'eligible_sessions': 18, 'satisfied_sessions': 11},
    {'evidence': 'All real rated sessions', 'eligible_sessions': 33, 'satisfied_sessions': 15},
])
evidence['satisfaction_rate'] = evidence.apply(
    lambda row: row.satisfied_sessions / row.eligible_sessions if row.eligible_sessions else float('nan'),
    axis=1,
)

spot_cross = pd.DataFrame([
    {'spot': 'Del Mar', 'impressions': 8, 'rated_sessions': 9, 'satisfied': 6, 'avg_rating': 3.78, 'guarded_quiver_mae_ft': 0.80, 'surfline_mae_ft': 0.83},
    {'spot': 'Ala Moana Bowls', 'impressions': 3, 'rated_sessions': 3, 'satisfied': 3, 'avg_rating': 5.00, 'guarded_quiver_mae_ft': 0.47, 'surfline_mae_ft': 0.17},
    {'spot': 'C Street / Ventura Point', 'impressions': 0, 'rated_sessions': 3, 'satisfied': 1, 'avg_rating': 3.00, 'guarded_quiver_mae_ft': 0.95, 'surfline_mae_ft': 0.83},
    {'spot': 'Capitola Beach', 'impressions': 0, 'rated_sessions': 2, 'satisfied': 0, 'avg_rating': 3.00, 'guarded_quiver_mae_ft': 1.00, 'surfline_mae_ft': 1.50},
    {'spot': 'HB Cliffs', 'impressions': 0, 'rated_sessions': 2, 'satisfied': 1, 'avg_rating': 3.50, 'guarded_quiver_mae_ft': 0.77, 'surfline_mae_ft': 1.17},
    {'spot': 'Laniakea', 'impressions': 0, 'rated_sessions': 2, 'satisfied': 1, 'avg_rating': 3.50, 'guarded_quiver_mae_ft': 0.47, 'surfline_mae_ft': 0.50},
    {'spot': 'Ocean Beach Pier', 'impressions': 7, 'rated_sessions': 2, 'satisfied': 0, 'avg_rating': 2.00, 'guarded_quiver_mae_ft': 0.13, 'surfline_mae_ft': 1.00},
    {'spot': 'Pleasure Point', 'impressions': 1, 'rated_sessions': 2, 'satisfied': 1, 'avg_rating': 3.50, 'guarded_quiver_mae_ft': 2.91, 'surfline_mae_ft': 2.50},
    {'spot': 'Huntington Beach Pier Northside', 'impressions': 0, 'rated_sessions': 1, 'satisfied': 0, 'avg_rating': 3.00, 'guarded_quiver_mae_ft': 1.46, 'surfline_mae_ft': 2.50},
    {'spot': 'Malibu First Point', 'impressions': 27, 'rated_sessions': 1, 'satisfied': 1, 'avg_rating': 4.00, 'guarded_quiver_mae_ft': 0.30, 'surfline_mae_ft': 0.50},
    {'spot': 'Pipes', 'impressions': 0, 'rated_sessions': 1, 'satisfied': 0, 'avg_rating': 2.00, 'guarded_quiver_mae_ft': 0.28, 'surfline_mae_ft': 1.50},
    {'spot': 'Ponto', 'impressions': 1, 'rated_sessions': 1, 'satisfied': 0, 'avg_rating': 3.00, 'guarded_quiver_mae_ft': 0.12, 'surfline_mae_ft': 2.00},
    {'spot': 'Rockview', 'impressions': 0, 'rated_sessions': 1, 'satisfied': 0, 'avg_rating': 2.00, 'guarded_quiver_mae_ft': None, 'surfline_mae_ft': None},
    {'spot': 'Seal Beach Pier', 'impressions': 0, 'rated_sessions': 1, 'satisfied': 0, 'avg_rating': 3.00, 'guarded_quiver_mae_ft': 0.52, 'surfline_mae_ft': 0.50},
    {'spot': 'Seaside Reef', 'impressions': 0, 'rated_sessions': 1, 'satisfied': 0, 'avg_rating': 3.00, 'guarded_quiver_mae_ft': 2.18, 'surfline_mae_ft': 2.50},
    {'spot': 'Terramar Point', 'impressions': 0, 'rated_sessions': 1, 'satisfied': 1, 'avg_rating': 4.00, 'guarded_quiver_mae_ft': 1.30, 'surfline_mae_ft': 0.50},
])
spot_cross['satisfaction_rate'] = spot_cross['satisfied'] / spot_cross['rated_sessions']

assert measurement_funnel.loc[2:, 'count'].sum() == 0
assert int(evidence.loc[evidence.evidence == 'All real rated sessions', 'eligible_sessions'].iloc[0]) == int(spot_cross.rated_sessions.sum()) == 33
assert int(evidence.loc[evidence.evidence == 'All real rated sessions', 'satisfied_sessions'].iloc[0]) == int(spot_cross.satisfied.sum()) == 15
assert len(spot_cross) == 16
assert spot_cross.guarded_quiver_mae_ft.notna().sum() == 15

measurement_funnel
"""
    ),
    markdown(
        """### Reviewed query references

The PostHog queries time-bound `events` to the analysis window, filter `event = 'surf_window_impression'`, and join only pre-aggregated warehouse sessions after excluding `profiles.is_mock = true`. The official Supabase checks are read-only counts against `recommendation_impressions`, `recommendation_session_contexts`, `sessions.recommendation_id`, and `recommendation_feedback_summary`.

The spot proxy joins distinct exposed `beach_id` values to real rated sessions on `beach_id`. It does not substitute for deterministic `recommendation_id` attribution.
"""
    ),
    markdown("## Results"),
    code(
        """display_evidence = evidence.copy()
display_evidence['rate_display'] = display_evidence['satisfaction_rate'].map(
    lambda value: 'Not measurable' if pd.isna(value) else f'{value:.1%}'
)
display_evidence['wilson_95'] = display_evidence.apply(
    lambda row: 'n/a' if row.eligible_sessions == 0 else '{:.1%}–{:.1%}'.format(*wilson_interval(int(row.satisfied_sessions), int(row.eligible_sessions))),
    axis=1,
)
display_evidence[['evidence', 'eligible_sessions', 'satisfied_sessions', 'rate_display', 'wilson_95']]
"""
    ),
    code(
        """spot_summary = spot_cross.assign(
    satisfaction_rate_pct=(spot_cross.satisfaction_rate * 100).round(1),
    lower_height_mae=spot_cross.apply(
        lambda row: (
            'Not benchmarked'
            if pd.isna(row.guarded_quiver_mae_ft) or pd.isna(row.surfline_mae_ft)
            else 'Quiver'
            if row.guarded_quiver_mae_ft < row.surfline_mae_ft
            else 'Surfline'
        ),
        axis=1,
    ),
)
benchmark_rows = spot_summary[spot_summary.lower_height_mae != 'Not benchmarked'].copy()
winner_summary = benchmark_rows.groupby('lower_height_mae').agg(
    beaches=('spot', 'count'),
    rated_sessions=('rated_sessions', 'sum'),
    satisfied_sessions=('satisfied', 'sum'),
)
winner_summary['satisfaction_rate'] = winner_summary.satisfied_sessions / winner_summary.rated_sessions

assert winner_summary.loc['Quiver', 'beaches'] == 10
assert winner_summary.loc['Quiver', 'rated_sessions'] == 22
assert winner_summary.loc['Quiver', 'satisfied_sessions'] == 9
assert winner_summary.loc['Surfline', 'beaches'] == 5
assert winner_summary.loc['Surfline', 'rated_sessions'] == 10
assert winner_summary.loc['Surfline', 'satisfied_sessions'] == 6

spot_summary[['spot', 'impressions', 'rated_sessions', 'satisfaction_rate_pct', 'guarded_quiver_mae_ft', 'surfline_mae_ft', 'lower_height_mae']]
"""
    ),
    code("""winner_summary"""),
    markdown(
        """## Takeaways

1. The official metric is unavailable because the durable exposure-to-session join is empty.
2. The 61.1% spot-overlap rate is a baseline-quality signal, not evidence that recommendations caused satisfaction.
3. Fifteen of 16 rated beaches have a forecast benchmark. Rockview is the only gap.
4. Satisfaction is 40.9% at beaches where guarded Quiver has lower height MAE and 60.0% where Surfline has lower height MAE. The samples are too small for a product winner claim, but they confirm height accuracy is not satisfaction.
5. Ala Moana is the strongest seed for a scrappy proof campaign: 3 of 3 sessions are satisfied. Malibu and Terramar are 1 of 1; Del Mar is 6 of 9.
6. If a prospective cohort is perfect, the headline can be “100% satisfied after following Quiver,” with the exact denominator and rating definition in the substantiation line.
"""
    ),
]

notebook = nbformat.v4.new_notebook(cells=cells)
notebook.metadata.kernelspec = {
    "display_name": "Python 3",
    "language": "python",
    "name": "python3",
}
notebook.metadata.language_info = {"name": "python", "version": "3"}

client = NotebookClient(notebook, timeout=120, kernel_name="python3")
client.execute()
nbformat.write(notebook, OUTPUT_PATH)
print(OUTPUT_PATH)
