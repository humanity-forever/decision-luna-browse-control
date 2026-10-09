"""Role accounting from recorded calls, kept separate for every study."""
import collections,json,pathlib,statistics
root=pathlib.Path(__file__).resolve().parents[1]
groups=collections.defaultdict(list)
for study in ['study','helper-study','native-study','timing-recheck','architecture-study','guarded-release-check']:
 paths=list((root/'.runtime'/study/'runs').glob('*/result.json'))
 rows=[json.loads(p.read_text()) for p in paths]
 component=root/'.runtime'/study/'rows.jsonl'
 if component.exists():rows.extend(json.loads(x) for x in component.read_text().splitlines() if x)
 for r in rows:
  for key,s in r.get('apiStatistics',{}).items():groups[(study,s['provider'],s['model'],s['purpose'])].append(s)
summary=[]
for (study,provider,model,purpose),ss in sorted(groups.items()):
 transport=[v for s in ss for v in s.get('transportLatenciesMs',[])];logical=[v for s in ss for v in s.get('logicalRequestLatenciesMs',[])]
 summary.append({'study':study,'provider':provider,'model':model,'purpose':purpose,
                 **{k:sum(s.get(k,0) for s in ss) for k in ['calls','retries','inputTokens','outputTokens','failedRequests','pendingRequests','estimatedOrReservedUsd']},
                 'medianTransportMs':statistics.median(transport) if transport else None,
                 'medianLogicalRequestMs':statistics.median(logical) if logical else None})
(root/'results/api-roles.json').write_text(json.dumps(summary,indent=2))
md='# Recorded API roles\n\nEvery paid call is metered, including planning, typing, retries and uncertain requests. Transport latency measures the network request; logical latency also includes local accounting and retries. Costs are conservative token-rate estimates with unresolved reservations, not invoiced charges. Study rows are separate; the original contact block and isolated recheck are both shown here for accounting, rather than counted twice in primary accuracy comparisons.\n\n| Study | Provider / model | Purpose | Calls | Retries | Input / output tokens | Median transport | Median logical request | Estimated / reserved cost |\n|---|---|---|---:|---:|---:|---:|---:|---:|\n'
for r in summary:
 t='—' if r['medianTransportMs'] is None else f"{r['medianTransportMs']:.0f}ms";l='—' if r['medianLogicalRequestMs'] is None else f"{r['medianLogicalRequestMs']:.0f}ms"
 md+=f"| {r['study']} | {r['provider']} / {r['model']} | {r['purpose']} | {r['calls']} | {r['retries']} | {r['inputTokens']} / {r['outputTokens']} | {t} | {l} | ${r['estimatedOrReservedUsd']:.5f} |\n"
md+='\nThese are sums of recorded experiment rows. Interrupted work with no completed row remains in the persistent project ledger and is not claimed to be included in this per-study table.\n'
(root/'results/API_ROLES.md').write_text(md)
print('Exported',len(summary),'study/model/role groups.')
