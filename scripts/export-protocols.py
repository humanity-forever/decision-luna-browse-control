"""Publish reproducibility metadata without private shared-ledger history."""
import json,pathlib
root=pathlib.Path(__file__).resolve().parents[1]
allowed={'codeHash','sourceHash','sourceCommit','experimentScriptHash','seed','repeats','selectedApps','selectedConditionIds','studyAllowance','scriptHash','createdAt','maximumActions','maximumSeconds','typing','controllerScope','scope','paid'}
data={}
for study in ['study','helper-study','native-study','architecture-study','timing-recheck']:
 p=root/'.runtime'/study/'manifest.json'
 if p.exists():
  manifest=json.loads(p.read_text());data[study]={k:v for k,v in manifest.items() if k in allowed}
data['environment']={'vm':'ARM64 Ubuntu 24.04 / KVM','vcpus':4,'ramGiB':8,'viewport':[1440,900],'browserTimezone':'America/New_York','execution':'Serial local VM; no paid external worker'}
(root/'results/protocol-manifests.json').write_text(json.dumps(data,indent=2))
print('Exported',len(data)-1,'sanitized study manifests.')
