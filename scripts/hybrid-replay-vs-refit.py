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
        if b not in clamped and b not in noec and log["by_beach"][b][0]["stn"] != "215"]
json.dump({"note": "RSS-basis hybrid per-beach k, fit Nov 6 2026 on 0-24 h rows Oct 7-Nov 6 (all weeks); excludes station 215, clamped k (0.8/1.6/2.5 on refit or hybrid), no ECMWF cell, no live CDIP truth", "beaches": elig},
          open("scripts/hybrid-k-eligible.json", "w"), indent=1)
print(f"\neligible {len(elig)}; clamped {len(clamped)}; no ECMWF {[names[b] for b in noec]}; k=1 entries {sum(e['k_hybrid_rss']==1 for e in elig)}")
