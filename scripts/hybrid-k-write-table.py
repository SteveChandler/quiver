#!/usr/bin/env python3
"""Writes ECMWF_HYBRID_K_FACTORS in lib/utils/ecmwf-hybrid-k-factors.ts from scripts/hybrid-k-eligible.json.

Replaces only the table body, ECMWF_HYBRID_FIT_DATE and the "Fit <date> at commit <sha> over <n> days" header
line; the rest of the header is hand-written. Run: python3 scripts/hybrid-k-write-table.py <days> <commit>
"""
import datetime as dt, json, re, sys

TABLE = "lib/utils/ecmwf-hybrid-k-factors.ts"
days, commit = sys.argv[1], sys.argv[2]
today = dt.date.today().isoformat()
elig = json.load(open("scripts/hybrid-k-eligible.json"))["beaches"]
body = "\n".join('  "%s": %.2f, // %s (CDIP %s)' % (e["id"], e["k_hybrid_rss"], e["name"], e["stn"])
                 for e in sorted(elig, key=lambda e: e["name"]))
src = open(TABLE).read()
src, n1 = re.subn(r'(ECMWF_HYBRID_K_FACTORS: Readonly<Record<string, number>> = \{\n).*?(\n\};)',
                  lambda m: m.group(1) + body + m.group(2), src, flags=re.S)
src, n2 = re.subn(r'ECMWF_HYBRID_FIT_DATE = "[0-9-]+"', f'ECMWF_HYBRID_FIT_DATE = "{today}"', src)
src, n3 = re.subn(r'\* Fit \d{4}-\d{2}-\d{2} at commit \w+ over \d+ days',
                  f"* Fit {today} at commit {commit} over {days} days", src)
if (n1, n2, n3) != (1, 1, 1):
    sys.exit(f"{TABLE}: expected one table, one fit date and one fit line, got {(n1, n2, n3)}")
open(TABLE, "w").write(src)
print(f"wrote {len(elig)} hybrid k entries to {TABLE}")
