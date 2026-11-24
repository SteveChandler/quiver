# Usage: python3 reason-diff.py before.json after.json out.txt
import json, re, sys, difflib
b=json.load(open(sys.argv[1])); a=json.load(open(sys.argv[2]))
TEXT={'reasons','positives','takeaway','summary','message','reasonFacts','reasonCodes','positiveCodes','personalExplanation'}
VOLATILE={'generatedAt','generated_at','durationMs','timings','elapsedMs','processingTimeMs','queryTimeMs'}
OLD=[(r'^Below ideal range \(([\d.]+)ft < [\d.]+ft minimum\)$','size_below_ideal'),(r'^Good wave size \(([\d.]+)ft\)$','size_good'),
     (r'^Larger swell \(([\d.]+)ft\)$','size_larger'),(r'^Big swell \(([\d.]+)ft\)$','size_big'),
     (r'^Strong swell energy \(([\d.]+)s period\)$','period_strong'),(r'^Good swell energy$','period_good')]
NEW=[(r'^On the small side at \d+–\d+ ft\.$','size_below_ideal'),(r'^Good size at \d+–\d+ ft\.$','size_good'),
     (r'^Bigger surf at \d+–\d+ ft\.$','size_larger'),(r'^Big surf at \d+–\d+ ft\.$','size_big'),
     (r'^Long-period swell at \d+ s, so the sets have real push\.$','period_strong'),(r'^Solid swell period behind it\.$','period_good')]
def code(s,table):
    for rx,c in table:
        if re.match(rx,s): return '<'+c+'>'
    return s
def strip(o):
    if isinstance(o,dict): return {k:strip(v) for k,v in o.items() if k not in TEXT and k not in VOLATILE}
    if isinstance(o,list): return [strip(v) for v in o]
    return o
def codes(o,table,path=''):
    out=[]
    if isinstance(o,dict):
        for k,v in o.items():
            p=f'{path}.{k}'
            if k in ('reasons','positives') and isinstance(v,list): out.append((p,[code(x,table) if isinstance(x,str) else x for x in v]))
            elif k in ('takeaway','summary') and (isinstance(v,str) or v is None): out.append((p,code(v,table) if v else v))
            elif k not in VOLATILE: out+=codes(v,table,p)
    elif isinstance(o,list):
        for i,v in enumerate(o): out+=codes(v,table,f'{path}[{i}]')
    return out
lines=[]
lines.append(f"input rows: before={b['forecastRows']} after={a['forecastRows']}; input hash equal: {b['inputHash']==a['inputHash']} ({b['inputHash'][:16]})")
lines.append(f"clock pinned: {b['pin']} / {a['pin']}; beaches: {', '.join(b['beaches'])}")
lines.append(f"composites: {len(b['composites'])} rows x skill; surf windows per skill: {[len(v) for v in b['surfWindows'].values()]}; week scout days: {len(b['weekScout'].get('days',[]))}; discovery recs: {len(b['discovery'].get('recommendations',[]))}")
sb=json.dumps(strip(b),indent=1,sort_keys=True).splitlines(); sa=json.dumps(strip(a),indent=1,sort_keys=True).splitlines()
d=list(difflib.unified_diff(sb,sa,'before','after',lineterm='',n=1))
lines.append('')
lines.append('== 1. Scores, subscores, verdicts, labels, ranks, picks, ids, warnings, effects (text fields removed) ==')
lines.append('diff lines: %d' % len(d)); lines+=d[:200]
cb=dict(codes(b,OLD)); ca=dict(codes(a,NEW))
changed=[(k,cb.get(k),ca.get(k)) for k in sorted(set(cb)|set(ca)) if cb.get(k)!=ca.get(k)]
lines.append('')
lines.append('== 2. Reason lists with the six scorer strings mapped to their codes (before: old text, after: new sentences) ==')
lines.append('differences: %d' % len(changed))
for k,x,y in changed[:200]: lines.append(f'{k}\n  before: {x}\n  after:  {y}')
# examples of text change
ex=[]
for x,y in zip(b['composites'],a['composites']):
    if x['reasons']!=y['reasons'] and len(ex)<8: ex.append((x['beach'],x['at'],x['skill'],x['reasons'][:2],y['reasons'][:2],x['message'],y['message']))
lines.append('')
lines.append('== 3. Text samples (only the words change) ==')
for e in ex: lines.append(f'{e[0]} {e[1]} skill={e[2]}\n  before reasons: {e[3]}\n  after reasons:  {e[4]}\n  before message: {e[5]}\n  after message:  {e[6]}')
tk=[]
def walk(o,p=''):
    if isinstance(o,dict):
        for k,v in o.items():
            if k=='takeaway': tk.append((p,v))
            walk(v,p+'.'+k)
    elif isinstance(o,list):
        for i,v in enumerate(o): walk(v,f'{p}[{i}]')
walk(b['weekScout']); tb=tk; tk=[]; walk(a['weekScout']); ta=tk
lines.append('')
lines.append('== 4. Week Scout takeaways ==')
for (p,x),(_,y) in list(zip(tb,ta))[:12]: lines.append(f'{p}: {x!r} -> {y!r}')
lines.append('')
lines.append('== 5. Discovery messages ==')
for x,y in zip(b['discovery'].get('recommendations',[]),a['discovery'].get('recommendations',[])): lines.append(f"{x['beach']['name']}: {x.get('message')!r} -> {y.get('message')!r}")
open(sys.argv[3],'w').write('\n'.join(lines)+'\n')
print('\n'.join(lines[:12])); print('...'); print('struct diff', len(d), 'code diffs', len(changed))
