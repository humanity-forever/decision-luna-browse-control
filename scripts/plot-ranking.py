"""Actual model-condition results; failures have no successful timing bar."""
import json,pathlib,math
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
root=pathlib.Path(__file__).resolve().parents[1]
rows=json.loads((root/'results/ranking.json').read_text())['rows']
z=1.95996398454
intervals=[]
for r in rows:
 n=r['attemptedFlows'];k=r['verifiedFlows'];den=1+z*z/n;mid=(k/n+z*z/(2*n))/den;err=z*math.sqrt(k/n*(1-k/n)/n+z*z/(4*n*n))/den;intervals.append((max(0,mid-err),min(1,mid+err)))
labels=[r['condition']+f" ({r['verifiedFlows']}/{r['attemptedFlows']})" for r in rows]
rate=[r['successFraction'] for r in rows]
fig,axes=plt.subplots(1,2,figsize=(13,4.8),layout='constrained',gridspec_kw={'width_ratios':[1.15,1]})
colors=['#2563eb' if r['condition'].startswith('luna') else '#14b8a6' for r in rows]
axes[0].barh(labels,rate,xerr=[[x-lo for x,(lo,hi) in zip(rate,intervals)],[hi-x for x,(lo,hi) in zip(rate,intervals)]],color=colors,capsize=3)
axes[0].invert_yaxis();axes[0].set_xlim(0,1);axes[0].set_xlabel('Verified complete flows; Wilson 95% interval')
ok=[(r,c) for r,c in zip(rows,colors) if r['successfulMedianSeconds'] is not None]
axes[1].barh([r['condition'] for r,c in ok],[r['successfulMedianSeconds'] for r,c in ok],color=[c for r,c in ok]);axes[1].invert_yaxis();axes[1].set_xlabel('Median successful-flow seconds')
for ax in axes:ax.spines[['top','right']].set_visible(False)
fig.suptitle('Frozen direct-model comparison · three synthetic apps · three repetitions per app',fontsize=12)
out=root/'results/figures';out.mkdir(exist_ok=True)
fig.savefig(out/'condition-comparison.svg');fig.savefig(out/'condition-comparison.pdf')
