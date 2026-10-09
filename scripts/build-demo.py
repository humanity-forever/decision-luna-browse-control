"""Build a full original-speed recording from one verified synthetic workflow."""
import pathlib,json,subprocess,hashlib,sys
root=pathlib.Path(__file__).resolve().parents[1];case=sys.argv[1] if len(sys.argv)>1 else 'b0-rooms-luna-dom-solo-native';private=root/'.runtime/demo-build';private.mkdir(exist_ok=True)
segments=[];provenance=[];versions=set()
for i,operation in enumerate(['create','update','close']):
 p=root/'.runtime/study/runs'/(case+'-'+operation);result=json.loads((p/'result.json').read_text())
 if not result['success']:raise SystemExit('Demo requires three independently verified operations')
 versions.add(result['codeHash']);source=pathlib.Path(result['recording']);source.relative_to(root/'.runtime')
 output=private/(operation+'.mp4');caption=f'{i+1}/3 {operation.upper()} + saved-state requery | Luna DOM native | 1x | synthetic application'
 vf="drawbox=x=0:y=850:w=iw:h=50:color=0x111827:t=fill,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='"+caption+"':x=18:y=868:fontcolor=white:fontsize=19"
 subprocess.run(['ffmpeg','-y','-loglevel','error','-i',str(source),'-vf',vf,'-an','-c:v','libx264','-pix_fmt','yuv420p','-r','5',str(output)],check=True);segments.append(output)
 provenance.append({'runId':result['id'],'operation':operation,'rawSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'selection':'whole operation from initial browser observation through saved-state requery','speed':1,'agentWallMs':result['wallMs']})
if len(versions)!=1:raise SystemExit('Demo mixes controller revisions')
manifest=private/'concat.txt';manifest.write_text(''.join("file '"+str(p)+"'\n" for p in segments));output=root/'assets/demo.mp4'
subprocess.run(['ffmpeg','-y','-loglevel','error','-f','concat','-safe','0','-i',str(manifest),'-c','copy',str(output)],check=True)
subprocess.run(['ffmpeg','-y','-loglevel','error','-i',str(output),'-vf','fps=1/10,tile=3x2','-frames:v','1',str(private/'review.png')],check=True)
(root/'assets/demo-provenance.json').write_text(json.dumps({'case':case,'codeHash':versions.pop(),'speed':1,'edits':'Phase boundaries are joined; no within-phase navigation is omitted. A caption covers only the lower margin.','segments':provenance},indent=2));print('Built complete original-speed synthetic workflow recording.')
