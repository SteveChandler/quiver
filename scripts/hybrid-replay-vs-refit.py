#!/usr/bin/env python3
"""RSS hybrid vs refit (both held out by week), four beach cuts, plus the eligible hybrid-k set."""
import runpy, io, contextlib, sys, json
def load(path):
    sys.argv = ["x"] + ([path] if path else [])
    with contextlib.redirect_stdout(io.StringIO()):
        return runpy.run_path("scripts/hybrid-replay-analyze.py")
log, arc = load(None), load("scripts/.hybrid-cache/archive-recs.jsonl")
names = {m["id"]: m["name"] for m in log["meta"].values()}
BOUNDS = (0.8, 1.6, 2.5)
# Truth in the Nov 6 cache carried direction_shadow at these beaches; prod dropped the shadow later that day,
# so their k is on a ruler 0.63-0.74 x the current one. Delete this set after a fresh hybrid-replay-collect.ts run.
STALE_TRUTH = {
    "15c7337e-5258-4339-9dc3-c435c666926b",
    "34af0af5-b61c-4b86-9d9d-bf328f538a12",
    "63af8c07-1aed-44bd-b03b-9b20abdff56c",
    "65d177de-e75a-4ad8-aa0d-48a67c0851b0",
    "b939f928-2653-494a-831d-6394cb548190",
    "c02b4ede-69d9-440e-b8de-22ea4bde10ef",
    "c3b42f85-e650-445f-89b1-1debe661652e",
    "cdcf733b-a704-45ef-affc-d8152ffde1e4",
    "d305ba0d-47cd-4494-b790-f924dac7bf1f",
    "d920e1b9-9e23-4ba8-9f8e-776571435f6f",
}
clamped = {b for b, k in log["k_all"].items() if k["uncal"] in BOUNDS or k["hybRss"] in BOUNDS}
noec = {b for b, rows in log["by_beach"].items() if all(r["rRss"] is None for r in rows)}
cuts = {
    "all": lambda r: True,
    "no 215": lambda r: r["stn"] != "215",
    "no clamped": lambda r: r["b"] not in clamped,
    "no 215, no clamped": lambda r: r["stn"] != "215" and r["b"] not in clamped,
}
mae = log["mae"]
H = lambda r: r["p_hybRss"]; R = lambda r: r["p_refit"]
out = []
for cname, keep in cuts.items():
    out.append(f"\n{cname}")
    for src, g, bins in (("log", log, ["0-24h", "1-3d", "5-7d"]), ("archive", arc, ["3-5d"])):
        for b in bins:
            rows = [r for r in g["scored"] if r["bin"] == b and keep(r)]
            big = [r for r in rows if r["truth"] >= 4]
            wins = tot = 0
            for bid in {r["b"] for r in rows}:
                rr = [r for r in rows if r["b"] == bid]
                if len(rr) < 30: continue
                tot += 1; wins += mae(rr, H) < mae(rr, R)
            out.append("  %-6s %-7s n=%5d  refit %.2f hyb %.2f (%+.2f) | >=4ft n=%5d refit %.2f hyb %.2f (%+.2f) | beach wins %d/%d" % (
                b, src, len(rows), mae(rows, R), mae(rows, H), mae(rows, H) - mae(rows, R),
                len(big), mae(big, R), mae(big, H), mae(big, H) - mae(big, R), wins, tot))
print("\n".join(out))
elig = [{"id": b, "name": names[b], "stn": log["by_beach"][b][0]["stn"], "k_hybrid_rss": log["k_all"][b]["hybRss"]}
        for b in sorted(log["by_beach"], key=lambda x: names[x])
        if b not in clamped and b not in noec and b not in STALE_TRUTH and log["by_beach"][b][0]["stn"] != "215"]
json.dump({"note": "RSS-basis hybrid per-beach k, fit Nov 6 2026 on 0-24 h rows Oct 7-Nov 6 (all weeks); excludes station 215, clamped k (0.8/1.6/2.5 on refit or hybrid), no ECMWF cell, no live CDIP truth, and 10 Point Loma / Mission Beach spots whose truth still carried direction_shadow (STALE_TRUTH)", "beaches": elig},
          open("scripts/hybrid-k-eligible.json", "w"), indent=1)
print(f"\neligible {len(elig)}; clamped {len(clamped)}; no ECMWF {[names[b] for b in noec]}; k=1 entries {sum(e['k_hybrid_rss']==1 for e in elig)}")
