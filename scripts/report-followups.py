"""Keep helper, pilot, original-system and component evidence separate."""
import collections
import json
import pathlib
import statistics

root = pathlib.Path(__file__).resolve().parents[1]
out = root / 'results'
out.mkdir(exist_ok=True)

def median(xs):
    return statistics.median(xs) if xs else None

def condition_name(c):
    return '-'.join([c['model'], c['mode'], 'guided' if c['assisted'] else 'solo',
                     'native' if c.get('settle') else 'poll']) + ('-batch' if c.get('planCadence') else '')

for directory, label in [('pilot','PILOT'), ('helper-study','HELPER_STUDY'), ('native-study','NATIVE_JEV'), ('guarded-release-check','GUARDED_RELEASE_CHECK')]:
    runtime = root / '.runtime' / directory
    rows = [{k:v for k,v in json.loads(p.read_text()).items() if k != 'recording'}
            for p in (runtime / 'runs').glob('*/result.json')]
    rows.sort(key=lambda r:r['id'])
    (out / (label.lower()+'.json')).write_text(json.dumps(rows,indent=2))
    groups = collections.defaultdict(list)
    for r in rows:
        groups[r['id'].rsplit('-',1)[0]].append(r)
    flows = []
    for name, rs in sorted(groups.items()):
        hashes={r.get('codeHash',r.get('sourceCommit')) for r in rs if r.get('codeHash',r.get('sourceCommit'))}
        complete = len(rs)==3 and {r['operation'] for r in rs}=={'create','update','close'}
        flows.append({'workflow':name, 'kind':rs[0]['kind'],
                      'condition': condition_name(rs[0]['condition']) if rs[0].get('condition') else 'original-jev-browser',
                      'completedDisposition':complete,
                      'success':complete and len(hashes)==1 and all(r['success'] for r in rs),
                      'codeVersions':sorted(hashes),
                      'wallSeconds':sum(r.get('wallMs',0) for r in rs)/1000,
                      'estimatedUsd':sum(sum(r.get('costs',{}).values()) for r in rs),
                      'apiCalls':sum(r.get('apiCalls',0) for r in rs),
                      'helperCalls':sum(r.get('helperCalls',0) for r in rs),
                      'cacheHits':sum(r.get('batchCacheHits',0) for r in rs),
                      'statuses':dict(collections.Counter(r['status'] for r in rs))})
    (out / (label.lower()+'-flows.json')).write_text(json.dumps(flows,indent=2))
    md = '# '+label.replace('_',' ').title()+'\n\n'
    md += 'This study stays separate from the frozen three-repetition direct-model comparison. The helper follow-up targets one repetition per application and condition; it must not be pooled with the primary study. Pilot amendments and native-system changes are not isolated model effects.\n\n'
    md += '| Workflow | All three verified | Recorded time | Estimated cost | API calls | Cache hits | Statuses |\n|---|---|---:|---:|---:|---:|---|\n'
    for f in flows:
        md += f"| {f['workflow']} | {f['success']} | {f['wallSeconds']:.1f}s | ${f['estimatedUsd']:.5f} | {f['apiCalls']} | {f['cacheHits']} | {f['statuses']} |\n"
    manifest = json.loads((runtime/'manifest.json').read_text()) if (runtime/'manifest.json').exists() else {}
    if directory=='guarded-release-check':
        md+='\nThis revised release check used controller `4334258`, one repetition per application, after the control/subject guards were added. Its three flows stay separate from historical source `a06ddd7`; no primary trial is reused.\n'
    if directory=='helper-study':
        scheduled = manifest.get('repeats',0)*len(manifest.get('selectedApps',[]))*len(manifest.get('selectedConditionIds',[]))
        md += f'\nRecorded disposition-complete workflows: {sum(f["completedDisposition"] for f in flows)}/{scheduled}. '
        md += 'Partial results are provisional until all scheduled conditions have dispositions.\n'
    if directory=='native-study':
        md += '\nPinned original revision: `e04be30575de055e7d99b2505d35a228cf190722`. Typing is metered through gpt-6.1-sol low with a 1024-token cap; unsupported temperature was removed. The required native Computer Use runtime for wy-coliney/jev-browser-use is unavailable and was not replaced with an improvised adapter.\n'
    (out/(label+'.md')).write_text(md)

rows=[]
for directory in ['architecture-study','architecture-helper-v2']:
    p=root/'.runtime'/directory/'rows.jsonl'
    if p.exists():
        rows.extend(json.loads(line) for line in p.read_text().splitlines() if line)
(out/'components.json').write_text(json.dumps(rows,indent=2))
groups=collections.defaultdict(list)
for r in rows:
    groups[(r.get('suite'),r.get('scenario','—'),r.get('method',r.get('policy','—')),r.get('model','—'))].append(r)
md='''# Architectural component experiments

Fresh synthetic fixtures measure mechanisms separately from complete workflows. Screenshot readiness observations contain no DOM, but the harness fixes the target and executes a DOM locator afterward; this is not a raster-only full browser workflow. Wrong-target and clock-change cases isolate execution freshness. Mapping keeps the target fixed. A permanent validation blocker must be recognized separately; successful interaction with that fixture is not expected.

| Suite | Scenario | Method | Model | Accepted / samples | Recognized blocker | Median time | Median API calls | Median helper calls |
|---|---|---|---|---:|---:|---:|---:|---:|
'''
summary=[]
for k,rs in sorted(groups.items(),key=lambda x:str(x[0])):
    d={'suite':k[0],'scenario':k[1],'method':k[2],'model':k[3],
       'n':len(rs),'successes':sum(bool(x.get('success')) for x in rs),
       'recognizedBlockers':sum(bool(x.get('correctlyRecognizedBlocker')) for x in rs),
       'medianSeconds':median([x.get('wallMs',0)/1000 for x in rs]),
       'medianApiCalls':median([x.get('apiCalls',0) for x in rs]),
       'medianHelperCalls':median([x.get('helperCalls',0) for x in rs]),
       'statuses':dict(collections.Counter(x.get('status','unknown') for x in rs))}
    summary.append(d)
    md+=f"| {k[0]} | {k[1]} | {k[2]} | {k[3]} | {d['successes']}/{d['n']} | {d['recognizedBlockers']} | {d['medianSeconds']:.3f}s | {d['medianApiCalls']} | {d['medianHelperCalls']} |\n"
md+='\nComponent costs and per-call observations are available in [components.json](components.json). Three repetitions with known fixture delays are exploratory; they do not establish application-wide reliability. Budget/runtime failures remain visible in the exported status counts.\n'
(out/'component-summary.json').write_text(json.dumps(summary,indent=2))
(out/'COMPONENTS.md').write_text(md)
print('Exported separate pilot, helper, native and component reports.')
