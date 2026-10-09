import pathlib,json,math
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
r=pathlib.Path(__file__).resolve().parents[1];data=json.loads((r/'results/summary.json').read_text());data=[x for x in data if x['n']]
if not data:raise SystemExit('No measured results to plot')
labels=[x['kind']+' / '+x['condition']+' (n='+str(x['n'])+')' for x in data];rates=[x['successes']/x['n'] for x in data];lo=[p-x['wilson95'][0] for p,x in zip(rates,data)];hi=[x['wilson95'][1]-p for p,x in zip(rates,data)]
fig,ax=plt.subplots(figsize=(12,max(5,len(data)*.33)),layout='constrained');ax.barh(labels,rates,xerr=[lo,hi],capsize=3,color=['#2563eb' if x['condition'].startswith('luna') else '#14b8a6' for x in data]);ax.invert_yaxis();ax.set_xlim(0,1);ax.set_xlabel('Independently verified full-workflow success; Wilson 95% interval');ax.set_title('Three synthetic browser applications — exploratory samples');ax.spines[['top','right']].set_visible(False);(r/'results/figures').mkdir(exist_ok=True);fig.savefig(r/'results/figures/workflow-success.svg');fig.savefig(r/'results/figures/workflow-success.pdf')
