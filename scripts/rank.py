"""Select the best measured configuration by verified flows, then successful time/cost."""
import pathlib,json,collections,statistics
root=pathlib.Path(__file__).resolve().parents[1];flows=json.loads((root/'results/workflows.json').read_text());groups=collections.defaultdict(list)
for r in flows:
 if not r.get('supported') or not r.get('available',True):continue
 c=r['condition'];label=c['model']+'-'+c['mode']+'-'+('guided' if c['assisted'] else 'solo')+'-'+('native' if c.get('settle') else 'poll')+('-batch' if c.get('planCadence') else '');groups[label].append(r)
rows=[]
for label,rs in groups.items():
 ok=[r for r in rs if r['success']];rows.append({'condition':label,'verifiedFlows':len(ok),'attemptedFlows':len(rs),'successFraction':len(ok)/len(rs),'successfulMedianSeconds':statistics.median(r['wallMs']/1000 for r in ok) if ok else None,'successfulMedianEstimatedUsd':statistics.median(sum(r['costs'].values()) for r in ok) if ok else None,'totalEstimatedUsd':sum(sum(r['costs'].values()) for r in rs)})
rows.sort(key=lambda r:(-r['successFraction'],r['successfulMedianSeconds'] if r['successfulMedianSeconds'] is not None else float('inf'),r['successfulMedianEstimatedUsd'] if r['successfulMedianEstimatedUsd'] is not None else float('inf')))
(root/'results/ranking.json').write_text(json.dumps({'criterion':'Verified complete workflow fraction first; median successful time and estimated cost break ties. Known synthetic fixtures and small samples limit generalization.','rows':rows},indent=2));print(rows[0] if rows else 'No available attempted workflows')
