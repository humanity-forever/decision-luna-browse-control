import { createServer, type Server } from "node:http";
export type AppKind = "contacts" | "rooms" | "support";
export interface RecordState {
  id: string;
  fields: Record<string, string>;
  status: string;
}
export interface WorldState {
  records: RecordState[];
  events: {
    operation: string;
    id: string;
    fields: Record<string, string>;
    status: string;
  }[];
}
const definitions = {
  contacts: {
    title: "Contact Studio",
    key: "Name",
    fields: ["Name", "Email", "Phone"],
    types: ["text", "email", "tel"],
    close: "Archive",
    closed: "Archived",
    open: "Active",
  },
  rooms: {
    title: "Room Planner",
    key: "Title",
    fields: ["Title", "Room", "Date", "Start time"],
    types: ["text", "select", "date", "time"],
    close: "Cancel booking",
    closed: "Cancelled",
    open: "Booked",
  },
  support: {
    title: "Support Desk",
    key: "Subject",
    fields: ["Subject", "Requester email", "Priority"],
    types: ["text", "email", "select"],
    close: "Resolve",
    closed: "Resolved",
    open: "Open",
  },
} as const;
export function definition(kind: AppKind) {
  return definitions[kind];
}
export class FixtureWorld {
  readonly states = new Map<string, WorldState>();
  server: Server;
  origin = "";
  constructor() {
    this.server = createServer(async (req, res) => {
      const url = new URL(req.url ?? "/", this.origin || "http://localhost"),
        parts = url.pathname.split("/").filter(Boolean);
      if (parts[0] === "api") {
        const id = parts[1],
          state = this.states.get(id);
        if (!state) {
          res.writeHead(404).end();
          return;
        }
        res.setHeader("content-type", "application/json");
        if (req.method === "GET") {
          res.end(JSON.stringify(state));
          return;
        }
        const chunks = [];
        for await (const x of req) chunks.push(x);
        let data: any;
        try {
          data = JSON.parse(Buffer.concat(chunks).toString());
        } catch {
          res.writeHead(400).end();
          return;
        }
        if (!["create", "update", "close"].includes(data.operation)) {
          res.writeHead(400).end();
          return;
        }
        let record = state.records.find((r) => r.id === data.id);
        if (data.operation === "create") {
          record = {
            id: "record-" + (state.records.length + 1),
            fields: data.fields,
            status: data.status,
          };
          state.records.push(record);
        } else if (!record) {
          res.writeHead(404).end();
          return;
        } else if (data.operation === "update") record.fields = data.fields;
        else record.status = data.status;
        state.events.push({
          operation: data.operation,
          id: record!.id,
          fields: { ...record!.fields },
          status: record!.status,
        });
        res.end(JSON.stringify(record));
        return;
      }
      const kind = parts[0] as AppKind,
        id = parts[1];
      if (!definitions[kind] || !this.states.has(id)) {
        res.writeHead(404).end();
        return;
      }
      res.setHeader("content-type", "text/html");
      if (kind === "rooms" && parts[2] !== "inner") {
        res.end(
          `<html><head><title>Room Planner</title></head><body style="margin:0"><iframe title="Room Planner" src="/${kind}/${id}/inner" style="border:0;width:100vw;height:900px"></iframe></body></html>`,
        );
        return;
      }
      const def = definitions[kind];
      res.end(`<!doctype html><html><head><title>${def.title}</title><style>body{font:18px system-ui;background:#edf3fb;color:#172033;margin:32px}main{max-width:1020px;margin:auto;background:white;padding:30px;border-radius:18px}h1{color:#2359af}button{font:inherit;padding:10px 18px;margin:8px;border:0;border-radius:8px;background:#245bb2;color:white;cursor:pointer}input,select{font:inherit;padding:10px;width:350px;display:block;margin:6px 0 18px}label{display:block}dt{color:#65758b;margin-top:16px}dd{margin:4px 0 16px}section{padding:12px;border-bottom:1px solid #dde5f0}dialog{border:0;border-radius:15px;padding:26px}button:disabled{background:#a5b6cf;cursor:wait}</style></head><body><main><h1>${def.title}</h1><div id="host"></div></main><script>
  const D=${JSON.stringify(def)},api='/api/${id}',kind=${JSON.stringify(kind)};const host=document.querySelector('#host');const root=kind==='contacts'?host.attachShadow({mode:'open'}):host;
  if(kind==='contacts'){const sheet=new CSSStyleSheet();sheet.replaceSync(document.querySelector('style').textContent);root.adoptedStyleSheets=[sheet];} let state,all=false,current=null;const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const get=async()=>{state=await(await fetch(api)).json();};
  const post=async data=>await(await fetch(api,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)})).json();
  async function list(){await get();current=null;root.innerHTML='<button id="new">New '+(kind==='contacts'?'contact':kind==='rooms'?'booking':'ticket')+'</button><button id="all">'+(all?'Show active records':'Show all records')+'</button><div id="records"></div>';root.querySelector('#new').onclick=()=>form();root.querySelector('#all').onclick=()=>{all=!all;list();};const records=state.records.filter(r=>all||r.status===D.open);root.querySelector('#records').innerHTML=records.length?records.map(r=>'<section><button data-open="'+r.id+'">Open '+esc(r.fields[D.key])+'</button> <span>'+esc(r.status)+'</span></section>').join(''):'<p>No matching records.</p>';root.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>detail(b.dataset.open));}
  async function detail(id){await get();current=state.records.find(r=>r.id===id);root.innerHTML='<button id="back">Back to list</button><h2>'+esc(current.fields[D.key])+'</h2><dl>'+D.fields.map(k=>'<dt>'+esc(k)+'</dt><dd>'+esc(current.fields[k])+'</dd>').join('')+'<dt>Status</dt><dd>'+esc(current.status)+'</dd></dl><button id="edit">Edit record</button><button id="close">'+D.close+'</button>';root.querySelector('#back').onclick=list;root.querySelector('#edit').onclick=()=>form(current);root.querySelector('#close').onclick=()=>{const dialog=document.createElement('dialog');dialog.innerHTML='<p>'+D.close+' '+esc(current.fields[D.key])+'?</p><button id="yes">Confirm '+D.close.toLowerCase()+'</button><button id="no">Go back</button>';root.append(dialog);dialog.showModal();dialog.querySelector('#no').onclick=()=>dialog.remove();dialog.querySelector('#yes').onclick=async()=>{dialog.querySelector('#yes').disabled=true;await post({operation:'close',id:current.id,status:D.closed});dialog.remove();await detail(current.id);};};}
  function form(record){root.innerHTML='<button id="back">Back to list</button><h2>'+(record?'Edit':'Create')+'</h2><form aria-busy="true">'+D.fields.map((k,i)=>{const options=k==='Room'?['Studio A','Studio B']:['Low','Normal','Urgent'];return '<label for="field'+i+'">'+k+'</label>'+(D.types[i]==='select'?'<select id="field'+i+'" required disabled><option value="">Choose...</option>'+options.map(o=>'<option>'+o+'</option>').join('')+'</select>':'<input id="field'+i+'" type="'+D.types[i]+'" required disabled>');}).join('')+'<button type="submit" disabled>Save record</button><p role="status">Preparing form...</p></form>';root.querySelector('#back').onclick=list;const form=root.querySelector('form');if(record)D.fields.forEach((k,i)=>{root.querySelector('#field'+i).value=record.fields[k];});setTimeout(()=>{form.setAttribute('aria-busy','false');form.querySelectorAll('input,select,button').forEach(e=>e.disabled=false);form.querySelector('[role=status]').textContent='Ready to edit.';},900);form.onsubmit=async e=>{e.preventDefault();if(form.getAttribute('aria-busy')==='true')return;form.setAttribute('aria-busy','true');form.querySelector('button').disabled=true;const fields=Object.fromEntries(D.fields.map((k,i)=>[k,root.querySelector('#field'+i).value]));const saved=await post({operation:record?'update':'create',id:record?.id,fields,status:D.open});setTimeout(()=>detail(saved.id),650);};}
  list();</script></body></html>`);
    });
  }
  async start() {
    await new Promise<void>((resolve) =>
      this.server.listen(0, "127.0.0.1", resolve),
    );
    const a = this.server.address();
    if (!a || typeof a === "string")
      throw Error("Fixture server address unavailable");
    this.origin = "http://127.0.0.1:" + a.port;
    return this;
  }
  newRun(id: string, kind: AppKind) {
    if (this.states.has(id)) throw Error("Run state already exists");
    this.states.set(id, { records: [], events: [] });
    return this.origin + "/" + kind + "/" + id;
  }
  async close() {
    await new Promise<void>((resolve, reject) =>
      this.server.close((e) => (e ? reject(e) : resolve())),
    );
  }
}
