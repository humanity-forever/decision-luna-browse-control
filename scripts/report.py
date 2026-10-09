"""Export only measured synthetic browser results; no credentials or raw traces."""
import pathlib,json,collections,statistics,math
root=pathlib.Path(__file__).resolve().parents[1];rows=[]
for p in (root/'.runtime/runs').glob('*/result.json'):
 d=json.loads(p.read_text());rows.append({k:v for k,v in d.items() if k not in ['recording']})
rows.sort(key=lambda r:r['id']);groups=collections.defaultdict(list)
for r in rows:groups[r['id'].rsplit('-',1)[0]].append(r)
flows=[]
for name,rs in sorted(groups.items()):
 c=rs[0]['condition'];success=len(rs)==3 and {r['operation'] for r in rs}=={'create','update','close'} and all(r['success'] for r in rs);supported=all(r['status']!='unsupported' for r in rs)
 flows.append({'id':name,'kind':rs[0]['kind'],'condition':c,'codeHash':rs[0].get('codeHash'),'supported':supported,'success':success,'wallMs':sum(r.get('wallMs',0) for r in rs),'apiCalls':sum(r.get('apiCalls',0) for r in rs),'actions':sum(r.get('actions',0) for r in rs),'helperCalls':sum(r.get('helperCalls',0) for r in rs),'cacheHits':sum(r.get('batchCacheHits',0) for r in rs),'costs':{p:sum(r.get('costs',{}).get(p,0) for r in rs) for p in ['openai','typesafe']},'statuses':dict(collections.Counter(r['status'] for r in rs))})
def label(c):return c['model']+'-'+c['mode']+'-'+('guided' if c['assisted'] else 'solo')+'-'+('native' if c.get('settle') else 'poll')+('-batch' if c.get('planCadence') else '')
def ci(k,n):
 if not n:return None
 z=1.95996398454;den=1+z*z/n;mid=(k/n+z*z/(2*n))/den;err=z*math.sqrt(k/n*(1-k/n)/n+z*z/(4*n*n))/den;return [max(0,mid-err),min(1,mid+err)]
cells=collections.defaultdict(list)
for f in flows:cells[(f['kind'],label(f['condition']))].append(f)
summary=[]
for (kind,condition),xs in sorted(cells.items()):
 tested=[x for x in xs if x['supported']];ok=[x for x in tested if x['success']];summary.append({'kind':kind,'condition':condition,'n':len(tested),'successes':len(ok),'wilson95':ci(len(ok),len(tested)),'unsupported':len(xs)-len(tested),'medianAttemptSeconds':statistics.median(x['wallMs']/1000 for x in tested) if tested else None,'medianSuccessfulSeconds':statistics.median(x['wallMs']/1000 for x in ok) if ok else None,'totalEstimatedCostUsd':sum(sum(x['costs'].values()) for x in tested),'medianHelperCalls':statistics.median(x['helperCalls'] for x in tested) if tested else None})
folder=root/'results';folder.mkdir(exist_ok=True);(folder/'measurements.json').write_text(json.dumps(rows,indent=2));(folder/'workflows.json').write_text(json.dumps(flows,indent=2));(folder/'summary.json').write_text(json.dumps(summary,indent=2))
md='# Measured browser workflows\n\nThese are synthetic, server-backed local web applications operated through real Chromium. Model completion must pass fresh saved-state navigation, visible expected fields and an independent stored-state oracle. They are not measurements of live commercial websites. Failed predecessors are recorded separately from downstream tasks that did not start.\n\n| Example | Condition | Successful flows | Wilson 95% interval | Median successful time | Estimated total cost |\n|---|---|---:|---|---:|---:|\n'
for r in summary:
 interval='—' if not r['wilson95'] else f"{r['wilson95'][0]*100:.1f}%–{r['wilson95'][1]*100:.1f}%";time='—' if r['medianSuccessfulSeconds'] is None else f"{r['medianSuccessfulSeconds']:.1f}s";md+=f"| {r['kind']} | {r['condition']} | {r['successes']}/{r['n']} | {interval} | {time} | ${r['totalEstimatedCostUsd']:.5f} |\n"
md+='\nCosts use uncached token-rate estimates and conservative unknown-response reservations, not provider invoices. Confidence scores from different models are not treated as comparable. Conditions with fewer successful flows are not described as faster successful automation. Small samples, known fixture distributions and one local VM limit generalization. No native Computer Use skill was simulated when its runtime was unavailable.\n'
(folder/'RESULTS.md').write_text(md);print(f'Exported {len(rows)} task outcomes / {len(flows)} workflows.')
