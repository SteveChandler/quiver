#!/usr/bin/env python3
"""Robustness cuts for the hybrid replay: per-week consistency, station subsets, cap-bound beaches."""
import runpy, sys, statistics as st
from collections import defaultdict
sys.argv = ["x"]
import io, contextlib
buf = io.StringIO()
with contextlib.redirect_stdout(buf):
    g = runpy.run_path("scripts/hybrid-replay-analyze.py")
scored, PRED, mae, k_all, by_beach = g["scored"], g["PRED"], g["mae"], g["k_all"], g["by_beach"]
names = {m["id"]: m["name"] for m in g["meta"].values()}
BINS = ["0-24h", "1-3d", "5-7d"]
M = ["prod", "refit", "refit-unheld215", "hybrid", "hybrid-RSSbasis"]
def table(title, rows):
    print(title)
    for big in (False, True):
        line = "  >=4ft" if big else "  all  "
        for b in BINS:
            rr = [r for r in rows if r["bin"] == b and (r["truth"] >= 4 or not big)]
            line += "  %s n=%5d " % (b, len(rr)) + " ".join("%s %.2f" % (m[:6], mae(rr, PRED[m])) for m in M)
        print(line)
print("Per valid week (all rows):")
for w in sorted({r["wk"] for r in scored}):
    print(" ", w, "  ".join("%s n=%d prod %.2f hyb %.2f" % (b, len(rr), mae(rr, PRED["prod"]), mae(rr, PRED["hybrid"]))
                          for b in BINS for rr in [[r for r in scored if r["wk"] == w and r["bin"] == b]] if rr))
bound = {b for b, k in k_all.items() if k["uncal"] in (1.6, 2.5, 0.8) or k["hyb"] in (1.6, 2.5, 0.8)}
table("\nExcluding station 215 (k held at 1.6):", [r for r in scored if r["stn"] != "215"])
table("\nExcluding every beach whose k (refit or hybrid) sits on a bound (0.8, 1.6 hold, 2.5): %d beaches excluded" % len(bound),
      [r for r in scored if r["b"] not in bound])
for stn in sorted({r["stn"] for r in scored}):
    table("\nstation %s (%d beaches)" % (stn, len({r['b'] for r in scored if r['stn'] == stn})), [r for r in scored if r["stn"] == stn])
# median per-beach change
for b in BINS:
    d = []
    for bid, rows in by_beach.items():
        rr = [r for r in rows if r["bin"] == b and "p_refit" in r]
        if len(rr) >= 30: d.append(mae(rr, PRED["hybrid"]) - mae(rr, PRED["prod"]))
    d.sort(); print("\n%s per-beach hybrid minus prod MAE: median %+.3f  p10 %+.3f  p90 %+.3f  worst %+.3f" % (b, st.median(d), d[len(d)//10], d[9*len(d)//10], d[-1]), end="")
print()
print("\nRSS-basis hybrid per valid week:")
for w in sorted({r["wk"] for r in scored}):
    print(" ", w, "  ".join("%s prod %.2f rss %.2f" % (b, mae(rr, PRED["prod"]), mae(rr, PRED["hybrid-RSSbasis"]))
                          for b in BINS for rr in [[r for r in scored if r["wk"] == w and r["bin"] == b]] if rr))
rs = sorted(r["rRss"] for r in scored if r["rRss"] is not None)
print("r (RSS basis) p5 %.2f median %.2f p95 %.2f max %.2f" % (rs[len(rs)//20], rs[len(rs)//2], rs[19*len(rs)//20], rs[-1]))
print("\nRSS-basis wins vs prod / vs refit, by bin (beaches >=30 rows):")
lose = defaultdict(list)
for b in BINS:
    wp = wr = tot = 0
    for bid, rows in by_beach.items():
        rr = [r for r in rows if r["bin"] == b and "p_refit" in r]
        if len(rr) < 30: continue
        tot += 1; h = mae(rr, PRED["hybrid-RSSbasis"]); p = mae(rr, PRED["prod"])
        wp += h < p; wr += h < mae(rr, PRED["refit"])
        if h - p > 0.03: lose[names[bid]].append("%s %+.2f" % (b, h - p))
    print("  %s: beaches %d  rss<prod %d  rss<refit %d" % (b, tot, wp, wr))
print("Beaches where RSS-basis hybrid loses to prod by > 0.03 ft:")
for n, v in sorted(lose.items()): print("  ", n, ", ".join(v))
print("\nW45 by station, 1-3d: prod vs hybrid vs rss")
for stn in sorted({r["stn"] for r in scored}):
    rr = [r for r in scored if r["wk"] == "2026-W45" and r["bin"] == "1-3d" and r["stn"] == stn]
    if rr: print("  %s n=%d prod %.2f hyb %.2f rss %.2f bias prod %+.2f rss %+.2f" % (stn, len(rr), mae(rr, PRED["prod"]), mae(rr, PRED["hybrid"]), mae(rr, PRED["hybrid-RSSbasis"]), g["bias"](rr, PRED["prod"]), g["bias"](rr, PRED["hybrid-RSSbasis"])))
print("\nW45 station 215 by lead: prod / refit-unheld / hybrid / rss (bias)")
for b in BINS:
    rr = [r for r in scored if r["wk"] == "2026-W45" and r["bin"] == b and r["stn"] == "215"]
    if rr: print("  %s n=%d " % (b, len(rr)) + "  ".join("%s %.2f (%+.2f)" % (m, mae(rr, PRED[m]), g["bias"](rr, PRED[m])) for m in ["prod", "refit-unheld215", "hybrid", "hybrid-RSSbasis"]))
print("\nRSS k (all weeks) at RSS losers:")
for bid, k in k_all.items():
    if names[bid] in ("Rockpile", "Crystal Cove", "San Elijo State Beach", "Newport 56th St", "HB Cliffs", "The Wedge", "Latigo Point", "Point Dume", "Corona del Mar"):
        rows = [r for r in by_beach[bid] if r["bin"] == "0-24h" and r["hybRss"] > 0]
        print("  %-24s k_uncal %.2f k_rss %.2f  raw median truth/rss %.2f  median rRss %.2f" % (names[bid], k["uncal"], k["hybRss"], st.median(r["truth"] / r["hybRss"] for r in rows), st.median(r["rRss"] for r in rows if r["rRss"])))
stw = defaultdict(lambda: [0, 0])
for b in BINS:
    for stn in sorted({r["stn"] for r in scored}):
        rr = [r for r in scored if r["bin"] == b and r["stn"] == stn]
        stw[b][0] += mae(rr, PRED["hybrid-RSSbasis"]) < mae(rr, PRED["prod"]); stw[b][1] += mae(rr, PRED["hybrid"]) < mae(rr, PRED["prod"])
print("\nstation wins of 10 (rss<prod, hyb<prod):", dict(stw))
