"""Accepted actions and request counts from independently measured waiting cases."""
import collections,json,pathlib,statistics
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
root=pathlib.Path(__file__).resolve().parents[1];rows=json.loads((root/'results/components.json').read_text());groups=collections.defaultdict(list)
for r in rows:
 if r['suite']=='waiting' and r['scenario']!='validation_blocker':groups[r['method']].append(r)
methods=['domcontentloaded','load','visible','networkidle','dom_settle','autowait','model_dom_luna','model_dom_jev','model_pixels_luna','hybrid_dom_luna'];methods=[x for x in methods if x in groups]
fig,axs=plt.subplots(1,2,figsize=(11,5.6),layout='constrained',gridspec_kw={'width_ratios':[1.3,1]})
labels=[m+f" ({sum(x['success'] for x in groups[m])}/{len(groups[m])})" for m in methods];rates=[sum(x['success'] for x in groups[m])/len(groups[m]) for m in methods];colors=['#2563eb' if 'model' in m or 'hybrid' in m else '#14b8a6' for m in methods]
axs[0].barh(labels,rates,color=colors);axs[0].invert_yaxis();axs[0].set_xlim(0,1);axs[0].set_xlabel('Application accepted the requested action')
axs[1].barh(methods,[statistics.median(x['apiCalls'] for x in groups[m]) for m in methods],color=colors);axs[1].invert_yaxis();axs[1].set_xlabel('Median API calls per transient-readiness case')
for ax in axs:ax.spines[['top','right']].set_visible(False)
fig.suptitle('Five controlled transient-loading scenarios · three delays per method\nPermanent blockers are reported separately',fontsize=11)
out=root/'results/figures';out.mkdir(exist_ok=True);fig.savefig(out/'waiting-methods.svg');fig.savefig(out/'waiting-methods.pdf')
