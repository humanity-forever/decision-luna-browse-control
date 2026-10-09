"""Summarize observed synthetic failure mechanisms without publishing raw traces."""
import collections,json,pathlib
root=pathlib.Path(__file__).resolve().parents[1]
out=root/'results';rows=[]
for directory in ['study','helper-study','timing-recheck']:
 for p in (root/'.runtime'/directory/'runs').glob('*/result.json'):
  r=json.loads(p.read_text())
  if r['success'] or not r.get('apiCalls'):continue
  trace=p.parent/'trace.jsonl'
  actions=[json.loads(x) for x in trace.read_text().splitlines() if x] if trace.exists() else []
  handoff=any(x['action']['operation']=='done' and not x.get('readOnly') for x in actions)
  stopped=bool(actions) and actions[-1]['action']['operation']=='stop'
  persisted=r.get('verifiedStoredRecord',False)
  mechanism=('explicit_stop_before_verified_completion' if stopped else
             'completion_handoff_without_expected_stored_goal' if handoff and not persisted else
             'stored_goal_without_verified_requery' if persisted else
             'physical_action_limit' if r.get('actions',0)>=30 else
             'time_limit_or_transport_deadline' if r.get('wallMs',0)>=120000 else
             'other_unverified_outcome')
  rows.append({'study':directory,'id':r['id'],'kind':r['kind'],'operation':r['operation'],
               'status':r['status'],'codeHash':r.get('codeHash'),'mechanism':mechanism,
               'completionHandoff':handoff,'explicitStop':stopped,'expectedStoredState':persisted,
               'requeryActions':r.get('requeryActions',0),'actions':r.get('actions',0),
               'waitDecisions':r.get('waitDecisions',0),'wallSeconds':r['wallMs']/1000})
rows.sort(key=lambda r:(r['study'],r['id']))
(out/'failure-mechanisms.json').write_text(json.dumps(rows,indent=2))
md='# Observed failure mechanisms\n\nOnly failed or blocked active synthetic operations are listed. Dependent tasks and unsupported visual conditions are not independent failures. Mechanism labels describe recorded actions and the final independent receipt; they do not assign a speculative root cause. The original primary contact timing block remains archived, while its isolated rerun appears separately.\n\n| Study | Mechanism | Active unsuccessful operations |\n|---|---|---:|\n'
for (study,mechanism),n in sorted(collections.Counter((r['study'],r['mechanism']) for r in rows).items()):
 md+=f'| {study} | {mechanism} | {n} |\n'
md+='\nA saved expected state still fails the benchmark when the model stops before fresh visible requery. A completion handoff with a false receipt remains unsuccessful. Input planning, wait choice and stop semantics can dominate a short API transport latency; failed short attempts are not successful speedups. These known-fixture examples do not establish the corresponding failure rate on external websites. [Numeric cases](failure-mechanisms.json).\n'
(out/'FAILURES.md').write_text(md)
print('Exported',len(rows),'unsuccessful active operations across separate studies.')
