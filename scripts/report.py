"""Export measured synthetic workflows; credentials and raw browser traces stay local."""
import collections
import json
import math
import os
import pathlib
import statistics

root = pathlib.Path(__file__).resolve().parents[1]
runtime = pathlib.Path(os.environ.get('LUNA_RUNTIME', str(root / '.runtime/study')))
if not runtime.is_absolute():
    runtime = root / runtime
rows = [json.loads(p.read_text()) for p in (runtime / 'runs').glob('*/result.json')]
rows = [{k: v for k, v in r.items() if k != 'recording'} for r in rows]
original = [r for r in rows if r['id'].startswith('b0-contacts-')]
replacement = [json.loads(p.read_text()) for p in (root / '.runtime/timing-recheck/runs').glob('*/result.json')]
replaced = bool(replacement) and {r['id'] for r in replacement} == {r['id'] for r in original}
if replaced:
    if any(r.get('codeHash') != original[0].get('codeHash') for r in replacement):
        raise SystemExit('Timing correction requires the same frozen source revision')
    rows = [r for r in rows if not r['id'].startswith('b0-contacts-')] + [
        {k: v for k, v in r.items() if k != 'recording'} | {'timingRecheck': True}
        for r in replacement
    ]
rows.sort(key=lambda r: r['id'])
groups = collections.defaultdict(list)
for r in rows:
    groups[r['id'].rsplit('-', 1)[0]].append(r)


def label(c):
    return '-'.join([c['model'], c['mode'], 'guided' if c['assisted'] else 'solo',
                     'native' if c.get('settle') else 'poll']) + ('-batch' if c.get('planCadence') else '')


def ci(k, n):
    if not n:
        return None
    z = 1.95996398454
    den = 1 + z*z/n
    mid = (k/n + z*z/(2*n))/den
    err = z*math.sqrt(k/n*(1-k/n)/n + z*z/(4*n*n))/den
    return [max(0, mid-err), min(1, mid+err)]


def median(xs):
    return statistics.median(xs) if xs else None


flows = []
for name, rs in sorted(groups.items()):
    one_version = len({r.get('codeHash') for r in rs}) == 1
    flows.append({
        'id': name, 'kind': rs[0]['kind'], 'condition': rs[0]['condition'],
        'codeHash': rs[0].get('codeHash') if one_version else None,
        'oneCodeVersion': one_version,
        'supported': all(r['status'] != 'unsupported' for r in rs),
        'available': not any(r.get('started') is False for r in rs),
        'success': one_version and len(rs) == 3 and
                   {r['operation'] for r in rs} == {'create', 'update', 'close'} and
                   all(r['success'] for r in rs),
        **{field: sum(r.get(field, 0) for r in rs) for field in
           ['wallMs', 'apiCalls', 'apiMs', 'actions', 'helperCalls', 'waitDecisions',
            'waitingMs', 'observationMs', 'executionMs']},
        'cacheHits': sum(r.get('batchCacheHits', 0) for r in rs),
        'costs': {p: sum(r.get('costs', {}).get(p, 0) for r in rs) for p in ['openai', 'typesafe']},
        'statuses': dict(collections.Counter(r['status'] for r in rs)),
    })

cells = collections.defaultdict(list)
for f in flows:
    cells[(f['kind'], label(f['condition']))].append(f)
summary = []
for (kind, condition), xs in sorted(cells.items()):
    tested = [x for x in xs if x['supported'] and x['available']]
    ok = [x for x in tested if x['success']]
    cost = sum(sum(x['costs'].values()) for x in tested)
    summary.append({
        'kind': kind, 'condition': condition, 'n': len(tested), 'successes': len(ok),
        'wilson95': ci(len(ok), len(tested)),
        'unsupported': sum(not x['supported'] for x in xs),
        'providerUnavailable': sum(x['supported'] and not x['available'] for x in xs),
        'medianAttemptSeconds': median([x['wallMs']/1000 for x in tested]),
        'medianSuccessfulSeconds': median([x['wallMs']/1000 for x in ok]),
        'totalEstimatedCostUsd': cost,
        'estimatedCostPerVerifiedFlowUsd': cost / len(ok) if ok else None,
        'medianHelperCalls': median([x['helperCalls'] for x in tested]),
        'medianActions': median([x['actions'] for x in tested]),
        'medianWaitDecisions': median([x['waitDecisions'] for x in tested]),
    })

active = [r for r in rows if r.get('apiCalls', 0) > 0]
operation_cells = collections.defaultdict(list)
for r in active:
    operation_cells[(r['kind'], label(r['condition']), r['operation'])].append(r)
operation_summary = [
    {'kind': k[0], 'condition': k[1], 'operation': k[2], 'attempted': len(rs),
     'successes': sum(r['success'] for r in rs),
     'wilson95': ci(sum(r['success'] for r in rs), len(rs)),
     'statuses': dict(collections.Counter(r['status'] for r in rs))}
    for k, rs in sorted(operation_cells.items())
]
quality = {
    'auditedOperations': sum('unrelatedRecordChanges' in r for r in active),
    'unrelatedRecordChanges': sum(r.get('unrelatedRecordChanges', 0) for r in active),
    'persistedExpectedStateWithoutVerifiedCompletion': sum(
        r.get('verifiedStoredRecord', False) and not r['success'] for r in active),
    'dispositions': dict(collections.Counter(r['status'] for r in rows)),
    'timingCorrectionComplete': replaced,
    'note': 'Persisted state alone is insufficient: completion also requires fresh visible requery. '
            'Fixture audits are limited to recorded synthetic distractors. '
            'Duplicate and false-completion rates are not inferred from unrelated-record counts.',
}
folder = root / 'results'
folder.mkdir(exist_ok=True)
for filename, data in [('original-contact-block.json', original), ('measurements.json', rows),
                       ('workflows.json', flows), ('summary.json', summary),
                       ('operation-summary.json', operation_summary), ('quality-audit.json', quality)]:
    (folder / filename).write_text(json.dumps(data, indent=2))
md = '''# Measured browser workflows

These are synthetic, server-backed local web applications operated through real Chromium. Model completion must pass fresh saved-state navigation, visible expected fields and an independent stored-state oracle. Failed predecessors remain separate from downstream tasks that did not start.

| Example | Condition | Successful flows | Unsupported / unavailable | Wilson 95% interval | Median successful time | Estimated total cost |
|---|---|---:|---:|---|---:|---:|
'''
for r in summary:
    interval = '—' if not r['wilson95'] else f"{r['wilson95'][0]*100:.1f}%–{r['wilson95'][1]*100:.1f}%"
    elapsed = '—' if r['medianSuccessfulSeconds'] is None else f"{r['medianSuccessfulSeconds']:.1f}s"
    md += f"| {r['kind']} | {r['condition']} | {r['successes']}/{r['n']} | {r['unsupported']} / {r['providerUnavailable']} | {interval} | {elapsed} | ${r['totalEstimatedCostUsd']:.5f} |\n"
md += '\n## Dispositions and independent checks\n\n'
md += f"Recorded task dispositions: `{quality['dispositions']}`. "
md += f"{quality['auditedOperations']} active operations were audited for changes to two unrelated synthetic records; {quality['unrelatedRecordChanges']} changes were recorded. "
md += f"{quality['persistedExpectedStateWithoutVerifiedCompletion']} operations had the expected persisted state but did not finish verified visible requery; they remain unsuccessful. "
md += 'These are fixture-specific observations, not a safety guarantee for external websites. [Per-operation denominators](operation-summary.json) · [Quality audit](quality-audit.json).\n\n'
md += ('The original contact block overlapped an offline test. Its full isolated rerun, using the same source, seed and values, replaces that block in this comparison. Original outcomes remain archived in [original-contact-block.json](original-contact-block.json).\n\n' if replaced else
       'The first contact block overlapped an offline test; an isolated same-source rerun is pending. Current timing summaries are provisional.\n\n')
md += 'Costs use uncached token-rate estimates and conservative unknown-response reservations, not provider invoices. Confidence scores from different models are not comparable. Failed workflows are not described as faster successful automation. Provider unavailability stays outside attempted-trial denominators. Small samples, known fixture distributions and one local VM limit generalization. The original Computer Use bridge remains unavailable when its required runtime is absent.\n'
(folder / 'RESULTS.md').write_text(md)
print(f'Exported {len(rows)} task outcomes / {len(flows)} workflows; isolated timing correction: {replaced}.')
