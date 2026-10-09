// Complete-system comparison; separate from the shared decision-model benchmark.
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {Api} from '../dist/src/api.js';
import {Budget,BudgetExceeded} from '../dist/src/budget.js';
import {loadCredentials} from '../dist/src/security.js';
import {BrowserSession,observe} from '../dist/src/browser.js';
import {FixtureWorld} from '../dist/src/world.js';
import {goals,oracle} from '../dist/src/runner.js';
const root=resolve('.'),runtime=resolve(process.env.LUNA_RUNTIME??'.runtime/native-study');mkdirSync(runtime,{recursive:true,mode:0o700});
const credentials=loadCredentials(),source=resolve(process.env.JEV_BROWSER_SOURCE??'.runtime/baselines/jev-browser'),revision=execFileSync('git',['-C',source,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(revision!=='e04be30575de055e7d99b2505d35a228cf190722')throw Error('Unexpected original Jev revision');
const module=await import(pathToFileURL(join(source,'dist/library.js')).href),base=new Budget(process.env.LUNA_LEDGER??join(runtime,'budget.json')),baseline=base.totals();
class StudyBudget extends Budget{reserve(provider,stage,estimate){if(this.totals()[provider]+estimate>baseline[provider]+1)throw new BudgetExceeded('Native comparison allowance');return super.reserve(provider,stage,estimate);}}
const budget=new StudyBudget(base.path),world=await new FixtureWorld().start();
writeFileSync(join(runtime,'manifest.json'),JSON.stringify({sourceCommit:revision,repeats:3,maximumActions:30,maximumSeconds:120,typing:'gpt-6.1-sol low, 1024 output cap; package default cap raised; unsupported temperature removed',sourceHash:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()},null,2));
try{
for(let repetition=0;repetition<3;repetition++)for(const kind of ['contacts','rooms','support']){
 const worldId='original-jev-'+kind+'-'+repetition,url=world.newRun(worldId,kind);let predecessor=true;
 for(const goal of goals(kind,500+repetition)){
  const id=worldId+'-'+goal.operation,dir=join(runtime,'runs',id);mkdirSync(dir,{recursive:true,mode:0o700});
  if(existsSync(join(dir,'result.json')))throw Error('Use a fresh native-study runtime; do not replay with new state');
  if(!predecessor){writeFileSync(join(dir,'result.json'),JSON.stringify({id,kind,operation:goal.operation,status:'dependency_failed',success:false}));continue;}
  const api=new Api(credentials,budget,'extra'),before=budget.totals(),start=performance.now(),session=await BrowserSession.open(),fetchBefore=globalThis.fetch;
  const row={id,kind,operation:goal.operation,sourceCommit:revision,status:'failed',success:false};let native,requery;
  try{
   process.env.OPENAI_API_KEY=credentials.openai;process.env.JEV_BROWSER_TYPE_PROVIDER='openai';process.env.JEV_BROWSER_TYPE_MODEL='gpt-6.1-sol';process.env.JEV_BROWSER_MODEL='jev-1.13.0';
   globalThis.fetch=async(input,init)=>{
    const endpoint=String(input instanceof Request?input.url:input);if(!['https://api.openai.com/v1/responses','https://api.openai.com/v1/chat/completions'].includes(endpoint))throw Error('Unmetered typing request blocked');
    const body=JSON.parse(init?.body??'{}');body.model='gpt-6.1-sol';delete body.temperature;
    if(endpoint.endsWith('/responses')){body.reasoning={effort:'low'};body.max_output_tokens=1024;body.store=false;}else{body.reasoning_effort='low';body.max_completion_tokens=1024;delete body.max_tokens;}
    const data=await api.request('openai','assistant',body,endpoint,'typing');return new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}});
   };
   const transport={name:'typesafe',async ask(request){const d=await api.request('typesafe','jev',{model:'jev-1.13.0',state:JSON.stringify(request.state),questions:request.questions});return {answers:d.answers,usage:d.usage,model:d.model};}};
   await session.page.goto(url,{waitUntil:'domcontentloaded'});await session.startRecording(join(dir,'recording'));api.deadline=start+120000;
   native=await module.navigate({task:goal.goal+'\nExpected fields: '+JSON.stringify(goal.expected)+'\nExpected status: '+goal.status,page:session.page,transport,maxSteps:30,maxSeconds:120,allowTyping:true,screenshot:'none'});
   const used=native.steps?.length??30,remaining=120-(performance.now()-start)/1000;
   if(['done','goal_achieved'].includes(native.status)&&used<28&&remaining>1){
    await session.page.reload({waitUntil:'domcontentloaded'});
    requery=await module.navigate({task:'READ ONLY: locate and reopen the saved target. Do not edit, save or create anything. Inspect these expected fields: '+JSON.stringify(goal.expected)+' and status '+goal.status,page:session.page,transport,maxSteps:30-used,maxSeconds:Math.floor(remaining),allowTyping:false,screenshot:'none'});
    const obs=await observe(session.page,'dom');const visible=Object.values(goal.expected).concat(goal.status).every(v=>obs.text.toLowerCase().includes(v.toLowerCase()));
    if(visible&&oracle(world,worldId,goal)){row.status='success';row.success=true;}
   }
  }catch(e){row.status=e instanceof BudgetExceeded?'budget_exhausted':'blocked';row.failureClass=e.name;}
  finally{globalThis.fetch=fetchBefore;row.wallMs=performance.now()-start;row.nativeStatus=native?.status;row.requeryStatus=requery?.status;row.apiCalls=api.calls;row.apiMs=api.elapsedMs;row.apiStatistics=api.statistics;const after=budget.totals();row.costs={openai:after.openai-before.openai,typesafe:after.typesafe-before.typesafe};row.recording=await session.finishRecording();await session.close();writeFileSync(join(dir,'result.json'),JSON.stringify(row,null,2));console.log(JSON.stringify({id,status:row.status,nativeStatus:row.nativeStatus,costs:row.costs}));}
  predecessor=row.success;
 }
}
}finally{await world.close();}
