#!/usr/bin/env python3
"""Prepare a disposable PostgreSQL replay and summarize its predictions."""

import json
import statistics
import sys
from collections import defaultdict
from pathlib import Path


SCHEMA = r"""
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), 'service_role')
$$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
CREATE TABLE public.profiles (id uuid PRIMARY KEY, experience_level text);
CREATE TABLE public.beaches (
  id uuid PRIMARY KEY, break_type text, wind_offshore_deg numeric,
  preferred_tide_ft_min numeric, preferred_tide_ft_max numeric
);
CREATE TABLE public.boards (id uuid PRIMARY KEY, board_type text, name text, dimensions text);
CREATE TABLE public.sessions (
  id uuid PRIMARY KEY, user_id uuid, beach_id uuid, board_id uuid,
  board_snapshot jsonb, rating integer, status text, arrival_time timestamptz,
  deleted_at timestamptz, session_decomposition jsonb
);
CREATE TABLE public.session_forecast_snapshots (session_id uuid PRIMARY KEY, forecast_snapshot jsonb);
CREATE TABLE import (data jsonb);
COPY import(data) FROM STDIN;
"""

LOAD = r"""
INSERT INTO public.profiles SELECT x.* FROM import i,
  jsonb_to_recordset(i.data->'profiles') AS x(id uuid, experience_level text);
INSERT INTO public.beaches SELECT x.* FROM import i,
  jsonb_to_recordset(i.data->'beaches') AS x(id uuid, break_type text, wind_offshore_deg numeric,
    preferred_tide_ft_min numeric, preferred_tide_ft_max numeric);
INSERT INTO public.boards SELECT x.* FROM import i,
  jsonb_to_recordset(i.data->'boards') AS x(id uuid, board_type text, name text, dimensions text);
INSERT INTO public.sessions
SELECT x.id,x.user_id,x.beach_id,x.board_id,x.board_snapshot,x.rating,'completed',x.arrival_time,
  NULL,CASE WHEN x.session_skill_fit IS NOT NULL OR x.session_board_fit IS NOT NULL
    THEN jsonb_build_object('version',1,'skill_fit',x.session_skill_fit,'board_fit',x.session_board_fit)
    ELSE NULL END
  FROM import i, jsonb_to_recordset(i.data->'sessions') AS x(
    id uuid,user_id uuid,beach_id uuid,board_id uuid,board_snapshot jsonb,rating integer,
    arrival_time timestamptz,session_skill_fit text,session_board_fit text);
INSERT INTO public.session_forecast_snapshots
SELECT x.id,x.forecast_snapshot FROM import i,
  jsonb_to_recordset(i.data->'sessions') AS x(id uuid,forecast_snapshot jsonb);
CREATE TABLE heldouts AS
SELECT s.id,s.user_id,s.beach_id,s.arrival_time,s.rating,f.forecast_snapshot
FROM (SELECT *,row_number() OVER (PARTITION BY user_id ORDER BY arrival_time,id) AS ordinal
  FROM public.sessions) s
JOIN public.session_forecast_snapshots f ON f.session_id=s.id WHERE s.ordinal>=6;
CREATE TABLE predictions (
  candidate text,user_id uuid,session_id uuid,rating integer,score numeric
);
"""

VERIFY_FIT = r"""
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM import i,
      jsonb_to_recordset(i.data->'sessions') AS x(
        id uuid,session_skill_fit text,session_board_fit text)
    JOIN public.sessions s ON s.id=x.id
    WHERE s.session_skill_fit IS DISTINCT FROM x.session_skill_fit
      OR s.session_board_fit IS DISTINCT FROM x.session_board_fit
  ) THEN RAISE EXCEPTION 'Exported fit flags changed during replay load'; END IF;
END $$;
"""

REPLAY = r"""
DO $replay$
DECLARE held record; answer jsonb;
BEGIN
  FOR held IN SELECT * FROM heldouts ORDER BY user_id,arrival_time,id LOOP
    UPDATE public.sessions SET status='hidden'
      WHERE user_id=held.user_id AND arrival_time>=held.arrival_time;
    SELECT m.result INTO answer FROM public.compute_user_match_scores(
      held.user_id, ARRAY[held.beach_id], jsonb_build_array(jsonb_build_object(
        'beach_id',held.beach_id,'wave_height',held.forecast_snapshot->>'wave_height',
        'wave_period',held.forecast_snapshot->>'wave_period',
        'wind_speed',held.forecast_snapshot->>'wind_speed',
        'wind_direction',held.forecast_snapshot->>'wind_direction_deg',
        'tide_height',held.forecast_snapshot->>'tide_height'))) m;
    INSERT INTO predictions VALUES ('CANDIDATE',held.user_id,held.id,held.rating,(answer->>'score')::numeric);
    EXTRA
    UPDATE public.sessions SET status='completed' WHERE user_id=held.user_id AND status='hidden';
  END LOOP;
END $replay$;
"""

SIMILARITY = r"""
    SELECT coalesce(sum(w.weight),0),coalesce(sum(w.weight*(s.rating-1)*2.5),0)
      INTO weight_sum,weighted_rating
    FROM public.sessions s
    JOIN public.session_forecast_snapshots f ON f.session_id=s.id
    LEFT JOIN public.beaches b ON b.id=s.beach_id
    LEFT JOIN public.beaches target ON target.id=held.beach_id
    CROSS JOIN LATERAL (SELECT public.session_condition_similarity(
      public.parse_wave_height_midpoint_ft(f.forecast_snapshot->>'wave_height'),
      CASE WHEN f.forecast_snapshot->>'wave_period' IS NOT NULL
        THEN public.parse_numeric_from_text(f.forecast_snapshot->>'wave_period') END,
      CASE WHEN f.forecast_snapshot->>'wind_speed' IS NOT NULL
        THEN public.parse_numeric_from_text(f.forecast_snapshot->>'wind_speed') END,
      CASE WHEN f.forecast_snapshot->>'wind_direction_deg' IS NOT NULL
        THEN public.parse_numeric_from_text(f.forecast_snapshot->>'wind_direction_deg') END,
      CASE WHEN f.forecast_snapshot->>'tide_height' IS NOT NULL
        THEN public.parse_numeric_from_text(f.forecast_snapshot->>'tide_height')-
          (b.preferred_tide_ft_min+b.preferred_tide_ft_max)/2 END,
      f.forecast_snapshot->>'tide_status',b.break_type,
      public.parse_wave_height_midpoint_ft(held.forecast_snapshot->>'wave_height'),
      public.parse_numeric_from_text(held.forecast_snapshot->>'wave_period'),
      public.parse_numeric_from_text(held.forecast_snapshot->>'wind_speed'),
      public.parse_numeric_from_text(held.forecast_snapshot->>'wind_direction_deg'),
      public.parse_numeric_from_text(held.forecast_snapshot->>'tide_height')-
        (target.preferred_tide_ft_min+target.preferred_tide_ft_max)/2,
      NULL,target.break_type) AS weight) w
    WHERE s.user_id=held.user_id AND s.status='completed';
    IF answer->>'state'='learned' THEN
      FOREACH shrink IN ARRAY ARRAY[1,2,3] LOOP
        INSERT INTO predictions VALUES (
          'C' || shrink,held.user_id,held.id,held.rating,
          round(greatest(0,least(10,
            (weighted_rating+shrink*(answer->>'prior_score_raw')::numeric)/(weight_sum+shrink)
            +(answer->>'fit_adjustment_raw')::numeric
            +(answer->>'board_adjustment_raw')::numeric)),1));
      END LOOP;
    ELSE
      INSERT INTO predictions SELECT 'C' || k,held.user_id,held.id,held.rating,NULL
        FROM generate_series(1,3) k;
    END IF;
"""


def prepare(data_path: Path, output: Path, repo: Path) -> None:
    data = json.loads(data_path.read_text())
    if len(data["sessions"]) == 0:
        raise ValueError("Empty cohort")
    output.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(data, separators=(",", ":")).replace("'", "''")
    (output / "setup.sql").write_text(
        SCHEMA.replace("COPY import(data) FROM STDIN;", f"INSERT INTO import VALUES ('{payload}'::jsonb);")
        + LOAD
    )
    (output / "verify-fit.sql").write_text(VERIFY_FIT)
    cutoff = data["cutoff"].replace("'", "''")
    anchor = "now() - interval '12 months'"
    for label, name in (
        ("A", "20260923040000_share_match_score_inputs.sql"),
        ("B", "20260927230000_board_model_merge_match_score.sql"),
    ):
        sql = (repo / "supabase/migrations" / name).read_text()
        assert anchor in sql
        sql = sql.replace(anchor, f"TIMESTAMPTZ '{cutoff}' - interval '12 months'")
        if label == "B":
            marker = "'base_score',round(base_score,2),'aversion_penalty'"
            assert sql.count(marker) == 1
            sql = sql.replace(marker,
                "'prior_score_raw',prior_score,'fit_adjustment_raw',fit_adjustment,"
                "'board_adjustment_raw',board_adjustment," + marker)
        (output / f"{label}.sql").write_text(sql)
    (output / "replay-A.sql").write_text(REPLAY.replace("CANDIDATE", "A").replace("EXTRA", ""))
    b = REPLAY.replace("CANDIDATE", "B").replace("EXTRA", SIMILARITY)
    b = b.replace("DECLARE held record; answer jsonb;",
                  "DECLARE held record; answer jsonb; weight_sum numeric; weighted_rating numeric; shrink integer;")
    (output / "replay-B.sql").write_text(b)


def ranks(values: list[float]) -> list[float]:
    ordered = sorted(range(len(values)), key=values.__getitem__)
    result = [0.0] * len(values)
    for start, index in enumerate(ordered):
        if result[index]:
            continue
        end = start
        while end + 1 < len(values) and values[ordered[end + 1]] == values[index]:
            end += 1
        for place in range(start, end + 1):
            result[ordered[place]] = (start + end) / 2 + 1
    return result


def spearman(rows: list[tuple[int, float]]) -> float | None:
    if len(rows) < 2:
        return None
    rating = ranks([r for r, _ in rows])
    score = ranks([s for _, s in rows])
    if len(set(rating)) < 2 or len(set(score)) < 2:
        return None
    return statistics.correlation(rating, score)


def metrics(rows: list[tuple[str, int, float | None]]) -> dict:
    per_user = defaultdict(list)
    for user, rating, score in rows:
        if score is not None:
            per_user[user].append((rating, score))
    concordances = []
    user_spearmans = []
    all_rows = []
    for user_rows in per_user.values():
        pairs = [0.5 if a[1] == b[1] else float((a[1] - b[1]) * (a[0] - b[0]) > 0)
                 for i, a in enumerate(user_rows) for b in user_rows[i + 1:] if a[0] != b[0]]
        if pairs:
            concordances.append(statistics.mean(pairs))
        correlation = spearman(user_rows)
        if correlation is not None:
            user_spearmans.append(correlation)
        all_rows.extend(user_rows)
    good = [score for rating, score in all_rows if rating >= 4]
    bad = [score for rating, score in all_rows if rating <= 2]
    return {
        "mean_within_user_concordance": statistics.mean(concordances) if concordances else None,
        "concordance_users": len(concordances),
        "pooled_spearman": spearman(all_rows),
        "mean_user_spearman": statistics.mean(user_spearmans) if user_spearmans else None,
        "spearman_users": len(user_spearmans),
        "good_day_recall": sum(score >= 7 for score in good) / len(good) if good else None,
        "good_days": len(good),
        "false_good_rate": sum(score >= 7 for score in bad) / len(bad) if bad else None,
        "bad_days": len(bad),
        "numeric_predictions": len(all_rows),
        "missing_predictions": len(rows) - len(all_rows),
    }


def summarize(predictions: Path, output: Path) -> None:
    by_candidate = defaultdict(list)
    users = set()
    heldouts = set()
    for line in predictions.read_text().splitlines():
        candidate, user, session, rating, score = line.split("\t")
        users.add(user)
        heldouts.add(session)
        by_candidate[candidate].append((user, int(rating), float(score) if score else None))
    report = {"users": len(users), "heldout_sessions": len(heldouts),
              "candidates": {key: metrics(rows) for key, rows in sorted(by_candidate.items())}}
    assert set(by_candidate) == {"A", "B", "C1", "C2", "C3"}
    assert all(len(rows) == len(heldouts) for rows in by_candidate.values())
    b, c = report["candidates"]["B"], report["candidates"]["C2"]
    report["adopt_C"] = (
        c["mean_within_user_concordance"] >= b["mean_within_user_concordance"] + .02
        and c["pooled_spearman"] >= b["pooled_spearman"] - .01
        and c["false_good_rate"] <= b["false_good_rate"]
    )
    output.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


def selftest() -> None:
    assert ranks([3, 3, 1]) == [2.5, 2.5, 1.0]
    assert spearman([(1, 3), (2, 2), (3, 1)]) == -1
    example = metrics([("one", 1, 7), ("one", 5, 7), ("one", 4, 9)])
    assert example["mean_within_user_concordance"] == .5
    assert example["false_good_rate"] == 1
    assert example["good_day_recall"] == 1


if __name__ == "__main__":
    if sys.argv[1] == "prepare":
        prepare(Path(sys.argv[2]), Path(sys.argv[3]), Path(sys.argv[4]))
    elif sys.argv[1] == "metrics":
        summarize(Path(sys.argv[2]), Path(sys.argv[3]))
    elif sys.argv[1] == "selftest":
        selftest()
    else:
        raise SystemExit("usage: backtest-match-score.py prepare DATA OUT REPO | metrics TSV OUT")
