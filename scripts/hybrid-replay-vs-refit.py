#!/usr/bin/env python3
"""RSS hybrid (r clamped 0.5-2.0) vs refit (both held out by week), four beach cuts, plus the eligible hybrid-k set.

Eligibility (header of lib/utils/ecmwf-hybrid-k-factors.ts): live CDIP truth, an ECMWF cell, not station 215,
and neither the refit k nor the hybrid k on a bound. A beach that is not in the current table also needs the
entry gate: held out by week, its 0-24 h hybrid MAE <= its production-factor MAE and |0-24 h bias| <= 0.2 ft.
The hybrid must beat both the shipped production factor and the production factor that
replay-model-swell-calibration.ts fits on the same rows in this run, so a stale shipped factor cannot let a beach in.
The gate is printed for every beach; for beaches already in the table it is report-only.
Run: python3 scripts/hybrid-replay-vs-refit.py [--out path] [--require-prod-rows]   (normally through scripts/refit-model-swell-tables.sh)
"""
import runpy, io, contextlib, sys, json, os, re
# load() below rewrites sys.argv, so read the flags first
REQUIRE_PROD_ROWS = "--require-prod-rows" in sys.argv
OUT = sys.argv[sys.argv.index("--out") + 1] if "--out" in sys.argv else "scripts/hybrid-k-eligible.json"
def load(path):
    sys.argv = ["x"] + ([path] if path else [])
    with contextlib.redirect_stdout(io.StringIO()):
        return runpy.run_path("scripts/hybrid-replay-analyze.py")
ARCHIVE = "scripts/.hybrid-cache/archive-recs.jsonl"
log = load(None)
arc = load(ARCHIVE) if os.path.exists(ARCHIVE) else None
if arc is None: print(f"note: no {ARCHIVE}, so no 3-5 d bin (run scripts/hybrid-replay-archive.ts after the collect)")
names = {m["id"]: m["name"] for m in log["meta"].values()}
BOUNDS = (0.8, 1.6, 2.5)
HYB = "hybRssCap"  # production clamps r to ECMWF_HYBRID_R_MIN..MAX, so k is fit on clamped r
clamped = {b for b, k in log["k_all"].items() if k["uncal"] in BOUNDS or k[HYB] in BOUNDS}
noec = {b for b, rows in log["by_beach"].items() if all(r["rRss"] is None for r in rows)}
cuts = {
    "all": lambda r: True,
    "no 215": lambda r: r["stn"] != "215",
    "no clamped": lambda r: r["b"] not in clamped,
    "no 215, no clamped": lambda r: r["stn"] != "215" and r["b"] not in clamped,
}
mae = log["mae"]
H = lambda r: r["p_" + HYB]; R = lambda r: r["p_refit"]; P = lambda r: r["prod"]
bias = log["bias"]
out = []
for cname, keep in cuts.items():
    out.append(f"\n{cname}")
    for src, g, bins in (("log", log, ["0-24h", "1-3d", "5-7d"]),) + ((("archive", arc, ["3-5d"]),) if arc else ()):
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
# Same rows, same truth: the production fit (replay-model-swell-calibration.ts --dump-rows) and this k fit must
# agree on the 0-24 h rows they share, or the two tables are not on one ruler.
PROD_ROWS = "scripts/.hybrid-cache/prod-fit-rows.jsonl"
fresh_k = None
if os.path.exists(PROD_ROWS):
    prod_rows = {(d["b"], d["at"]): d for d in map(json.loads, filter(str.strip, open(PROD_ROWS)))}
    mine = [r for r in log["scored"] if r["bin"] == "0-24h"]
    joined = [(r, prod_rows[(r["b"], r["at"])]) for r in mine if (r["b"], r["at"]) in prod_rows]
    differs = lambda r, d: abs(r["truth"] - d["truth"]) > 0.05 or abs(r["uncal"] - d["uncal"]) > 0.05
    off = sum(differs(r, d) for r, d in joined)
    share = len(joined) / len(mine) if mine else 0
    mine_beaches = {r["b"] for r in mine}
    prod_in_mine = [k for k in prod_rows if k[0] in mine_beaches]
    mine_keys = {(r["b"], r["at"]) for r in mine}
    reverse = sum(k in mine_keys for k in prod_in_mine) / len(prod_in_mine) if prod_in_mine else 0
    print(f"\nsame rows: {len(joined)}/{len(mine)} hybrid 0-24 h rows are in the production fit ({share:.1%}); "
          f"{reverse:.1%} of the production rows at these beaches are in the hybrid set; "
          f"truth or uncalibrated face differs by > 0.05 ft on {off}")
    per_beach = {}
    for r, d in joined: per_beach.setdefault(r["b"], []).append(differs(r, d))
    bad = sorted(names[b] for b, xs in per_beach.items() if sum(xs) > 0.02 * len(xs))
    if bad: print("  beaches with > 2% differing rows:", ", ".join(bad))
    if share < 0.9 or off > 0.01 * len(joined) or bad:
        sys.exit("SAME-ROWS CHECK FAILED: the two fits do not use the same rows and truth")
    # Production factor as this run fits it (shippedFactor in replay-model-swell-calibration.ts).
    fresh_ratios = {}
    for (b, _), d in prod_rows.items(): fresh_ratios.setdefault(b, []).append(d["truth"] / d["uncal"])
    def shipped_factor(xs):
        if len(xs) < 100: return 1.0
        k = min(2.5, max(0.8, sorted(xs)[len(xs) // 2]))
        return round(k, 2) if abs(k - 1) >= 0.08 else 1.0
    fresh_k = {b: shipped_factor(xs) for b, xs in fresh_ratios.items()}
if fresh_k is None and REQUIRE_PROD_ROWS:
    sys.exit(f"{PROD_ROWS} missing; run replay-model-swell-calibration.ts --dump-rows first")
TABLE = "lib/utils/ecmwf-hybrid-k-factors.ts"
in_table = set(re.findall(r'^\s*"([0-9a-f-]{36})":', open(TABLE).read(), re.M))
GATE_MAX_BIAS = 0.2
gate = {}
out = ["\nEntry gate, 0-24 h held out by week (hybrid vs shipped / refit production factor); * = beach not in the table now"]
for b, rows in sorted(log["by_beach"].items(), key=lambda kv: names[kv[0]]):
    d1 = [r for r in rows if r["bin"] == "0-24h" and "p_refit" in r]
    if not d1: continue
    hm, pm, hb = mae(d1, H), mae(d1, P), bias(d1, H)
    fm = mae(d1, lambda r: r["uncal"] * fresh_k.get(b, 1.0)) if fresh_k is not None else pm
    gate[b] = hm <= min(pm, fm) and abs(hb) <= GATE_MAX_BIAS
    out.append("  %s%-32s %4s n=%5d  hybrid %.2f (%+.2f)  prod %.2f (%+.2f) / refit prod %.2f  k %.2f  %s" % (
        " " if b in in_table else "*", names[b][:32], rows[0]["stn"], len(d1), hm, hb, pm, bias(d1, P), fm,
        log["k_all"][b][HYB], "pass" if gate[b] else "FAIL"))
print("\n".join(out))
base = [b for b in sorted(log["by_beach"], key=lambda x: names[x])
        if b not in clamped and b not in noec and log["by_beach"][b][0]["stn"] != "215"]
elig = [{"id": b, "name": names[b], "stn": log["by_beach"][b][0]["stn"], "k_hybrid_rss": log["k_all"][b][HYB]}
        for b in base if b in in_table or gate.get(b)]
weeks = sorted({r["wk"] for r in log["scored"]})
json.dump({"note": f"RSS-basis hybrid per-beach k on clamped r (0.5-2.0), fit on 0-24 h rows {weeks[0]}..{weeks[-1]} (all weeks); "
           "excludes station 215, clamped k (0.8/1.6/2.5 on refit or hybrid), no ECMWF cell and no live CDIP truth; "
           "a beach not already in the table also passed the held-out entry gate (0-24 h MAE <= shipped and refit production factor, |bias| <= 0.2 ft)",
           "beaches": elig},
          open(OUT, "w"), indent=1)
print(f"\neligible {len(elig)}; clamped {len(clamped)}; no ECMWF {[names[b] for b in noec]}; k=1 entries {sum(e['k_hybrid_rss']==1 for e in elig)}")
print("left the table:", [names[b] for b in sorted(in_table - {e["id"] for e in elig}) if b in names] +
      [b for b in in_table if b not in names])
print("entered the table:", [e["name"] for e in elig if e["id"] not in in_table])
print("gated out (eligible but failed the entry gate):", [names[b] for b in base if b not in in_table and not gate.get(b)])
