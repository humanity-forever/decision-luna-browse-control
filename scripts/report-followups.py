import pathlib,json,collections,statistics,math
root=pathlib.Path(__file__).resolve().parents[1];out=root/'results';out.mkdir(exist_ok=True)
for directory,label in [('pilot','PILOT'),('helper-study','HELPER_STUDY'),('native-study','NATIVE_JEV')]:
 rows=[]
 for p in (root/'.runtime'/directory/'runs').glob('*/result.json'):
  d=json.loads(p.read_text());rows.append({k:v for k,v in d.items() if k!='recording'})
 (out/(label.lower()+'.json')).write_text(json.dumps(rows,indent=2));groups=collections.defaultdict(list)
 for d in rows:groups[d['id'].rsplit('-',1)[0]].append(d)
 md='# '+label.replace('_',' ').title()+'\n\nThis study is separate from the frozen primary comparison. Pilot revisions and native system changes are not isolated model effects.\n\n| Workflow | All three verified | Recorded task time | Estimated cost | Statuses |\n|---|---|---:|---:|---|\n'
 for name,xs in sorted(groups.items()):
  ok=len(xs)==3 and {x['operation'] for x in xs}=={'create','update','close'} and all(x['success'] for x in xs);cost=sum(sum(x.get('costs',{}).values()) for x in xs);t=sum(x.get('wallMs',0) for x in xs)/1000;md+=f"| {name} | {ok} | {t:.1f}s | ${cost:.5f} | {dict(collections.Counter(x['status'] for x in xs))} |\n"
 if directory=='native-study':md+='\nOriginal package revision e04be30575de055e7d99b2505d35a228cf190722, metered typing gpt-6.1-sol low, 1024 output cap and unsupported temperature removed. The required native Computer Use runtime for wy-coliney/jev-browser-use is unavailable; it was not replaced by an improvised adapter.\n'
 (out/(label+'.md')).write_text(md)
components=root/'.runtime/architecture-study';rows=[]
for directory in ['architecture-study','architecture-helper-v2']:
 p=root/'.runtime'/directory/'rows.jsonl'
 if p.exists():rows += [json.loads(s) for s in p.read_text().splitlines()]
(out/'components.json').write_text(json.dumps(rows,indent=2));groups=collections.defaultdict(list)
for r in rows:groups[(r.get('suite'),r.get('scenario'),r.get('method',r.get('policy')),r.get('model'))].append(r)
md='# Architectural component experiments\n\nFresh synthetic fixtures measure mechanisms separately from complete workflows. Image readiness observations contain no DOM. Wrong-target and clock-change cases isolate execution freshness, not live-site safety. Mapping keeps the target fixed.\n\n| Suite / scenario / method / model | Successes | Samples | Median time | Median calls |\n|---|---:|---:|---:|---:|\n'
for k,xs in sorted(groups.items(),key=lambda p:str(p[0])):
 t=statistics.median(x.get('wallMs',0) for x in xs)/1000;calls=statistics.median(x.get('apiCalls',0) for x in xs);md+=f"| {k} | {sum(bool(x.get('success')) for x in xs)} | {len(xs)} | {t:.3f}s | {calls} |\n"
(out/'COMPONENTS.md').write_text(md);print('Exported separate pilot, mechanism, native and component reports.')
