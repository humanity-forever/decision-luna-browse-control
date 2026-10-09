"""Scan tracked files and every local commit without printing matched secrets."""
import pathlib,re,subprocess,sys,json,os
root=pathlib.Path(__file__).resolve().parents[1]
patterns=[re.compile(rb'sk-proj-[A-Za-z0-9_-]{25,}'),re.compile(rb'apikey_[A-Za-z0-9_-]{25,}'),re.compile(rb'gh[pousr]_[A-Za-z0-9_]{25,}'),re.compile(rb'-----BEGIN (?:OPENSSH|RSA|EC) PRIVATE KEY-----')]
credential_file=pathlib.Path(os.environ.get('LUNA_CREDENTIALS',str(pathlib.Path.home()/'.config/decision-luna-browse-control/credentials.json')))
if credential_file.exists():
 credentials=json.loads(credential_file.read_text())
 values=[credentials.get('openai'),credentials.get('typesafe')]+[s.get('password') for s in credentials.get('sandboxes',{}).values()]
 patterns.extend(re.compile(rb'(?<![A-Za-z0-9_-])'+re.escape(v.encode())+rb'(?![A-Za-z0-9_-])') for v in values if v and len(v)>=4)
try:files=subprocess.check_output(['git','ls-files','-z'],cwd=root).split(b'\0')
except subprocess.CalledProcessError:files=[]
bad=[]
for f in files:
 if f:
  p=root/f.decode()
  if p.is_file() and any(x.search(p.read_bytes()) for x in patterns):bad.append(f.decode())
history=subprocess.run(['git','log','-p','--all','--format='],cwd=root,capture_output=True).stdout
if any(p.search(history) for p in patterns):bad.append('[git history]')
if bad:print('Secret patterns detected in: '+', '.join(bad));sys.exit(1)
print('Tracked files and Git history passed secret-pattern scan.')
