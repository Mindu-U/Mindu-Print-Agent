const $=id=>document.getElementById(id);
let lang='en',busy=false,signature='',lastState,refreshing=false;
const tx=key=>window.words[lang]?.[key]||key;
function message(text,error=false){$('message').textContent=text;$('message').classList.toggle('error',error);}
function translate(){document.documentElement.lang=lang;for(const el of document.querySelectorAll('[data-t]'))el.textContent=tx(el.dataset.t);$('language-flag').src='flags/'+lang+'.svg';$('language').setAttribute('aria-label',tx('Language'));window.paintTheme(tx);}
function lock(value){busy=value;document.querySelectorAll('button').forEach(b=>b.disabled=value);}
async function action(fn){if(busy)return;lock(true);message('');try{await fn();await refresh();}catch(e){message(e.message,true);}finally{lock(false);}}
function renderRoutes(state){
 const key=JSON.stringify([state.stations,state.printers,lang]);
 if(signature===key)return;signature=key;
 $('routes').replaceChildren();
 for(const station of state.stations){
  const route=state.routes.find(r=>r.station===station._id);
  const row=document.createElement('div');row.className='route';row.dataset.station=station._id;
  const name=document.createElement('strong');name.textContent=station._id==='$bill'?tx('Bill'):station.name;
  const stationName=document.createElement('div');stationName.className='station-name';stationName.append(window.icon(station._id==='$bill'?'ReceiptText':'Printer'),name);
  const label=document.createElement('label'),caption=document.createElement('span');caption.textContent=tx('Printer');
  const select=document.createElement('select');select.className='printer';select.setAttribute('aria-label',tx('Printer')+' · '+name.textContent);
  select.add(new Option(tx('Not assigned'),''));
  if(route && !state.printers.some(p=>p.name===route.printer)){const option=new Option(route.printer+' · '+tx('Unavailable'),route.printer);option.disabled=true;select.add(option);}
  for(const printer of state.printers)select.add(new Option(printer.displayName,printer.name));
  select.value=route?.printer||'';label.append(caption,select);
  const widthLabel=document.createElement('label'),widthCaption=document.createElement('span');widthCaption.textContent=tx('Paper');
  const width=document.createElement('select');width.className='width';width.setAttribute('aria-label',tx('Paper')+' · '+name.textContent);width.add(new Option('80 mm','80'));width.add(new Option('58 mm','58'));width.value=route?.width||80;widthLabel.append(widthCaption,width);
  const modeLabel=document.createElement('label'),modeCaption=document.createElement('span');modeCaption.textContent=tx('Print mode');
  const mode=document.createElement('select');mode.className='mode';mode.setAttribute('aria-label',tx('Print mode')+' · '+name.textContent);mode.add(new Option(tx('Windows driver'),'windows'));mode.add(new Option(tx('ESC/POS receipt'),'escpos'));mode.value=route?.mode||'windows';modeLabel.append(modeCaption,mode);
  const test=document.createElement('button');test.type='button';test.className='secondary';test.append(window.icon('Printer'),document.createTextNode(tx('Test')));test.setAttribute('aria-label',tx('Test')+' · '+name.textContent);test.onclick=()=>action(async()=>{await window.mindu.test({printer:select.value,width:Number(width.value),mode:mode.value});message(tx('Sent to Windows. Check the receipt.'));});
  row.append(stationName,label,widthLabel,modeLabel,test);$('routes').append(row);
 }
}
function renderJobs(jobs){
 $('jobs').replaceChildren();
 if(!jobs.length){const empty=document.createElement('p');empty.className='empty';empty.append(window.icon('ReceiptText'),document.createTextNode(tx('Print a ticket from Mindu to see it here.')));$('jobs').append(empty);return;}
 for(const job of jobs){const row=document.createElement('div');row.className='job';const title=document.createElement('strong');title.textContent=job.title;const status=document.createElement('span');status.className='job-state'+(['failed','unknown'].includes(job.status)?' attention':'');status.append(window.icon(['failed','unknown'].includes(job.status)?'CircleAlert':job.status==='processing'?'Clock3':'CircleCheck'),document.createTextNode(tx(job.status)));const detail=document.createElement('small');detail.textContent=job.printer+' · '+new Date(job.time).toLocaleTimeString(lang);row.append(title,status,detail);if(job.status==='unknown'){const note=document.createElement('small');note.textContent=tx('Check the printer before reprinting.');row.append(note);}$('jobs').append(row);}
}
async function refresh(){
 if(refreshing)return;refreshing=true;
 try{
  const state=await window.mindu.status();lastState=state;
  if(lang!==state.lang){lang=state.lang;$('language').value=lang;translate();}
  $('pairing').hidden=state.connected;$('connected').hidden=!state.connected;
  $('connection-title').textContent=state.connected?state.name:tx('Connect to Mindu');
  $('connection-detail').textContent=state.connected?state.server:tx('A quiet connection between Mindu and your printers.');
  $('connection-badge').replaceChildren(window.icon(state.online?'CircleCheck':state.connected?'RefreshCw':'Link'),document.createTextNode(tx(state.online?'Connected':state.connected?'Reconnecting':'Not connected')));$('connection-badge').classList.toggle('online',state.online);
  if(!$('name').value)$('name').value=state.name;
  $('startup').disabled=!state.canAutoStart;$('startup').checked=state.autoStart;$('startup-note').textContent=state.canAutoStart?'':tx('Windows startup is available in the installed app.');
  renderRoutes(state);renderJobs(state.jobs);
  if(state.error)message(state.error,true);
 }finally{refreshing=false;}
}
$('code').addEventListener('input',async()=>{try{$('server-preview').textContent=await window.mindu.inspect($('code').value);}catch{$('server-preview').textContent='';}});
$('pair-form').onsubmit=e=>{e.preventDefault();action(async()=>{await window.mindu.pair($('code').value,$('name').value);$('code').value='';signature='';message(tx('Connected'));});};
$('routes-form').onsubmit=e=>{e.preventDefault();action(async()=>{
 const rows=[...document.querySelectorAll('.route')].map(row=>({station:row.dataset.station,printer:row.querySelector('.printer').value,width:Number(row.querySelector('.width').value),mode:row.querySelector('.mode').value})).filter(r=>r.printer);
 await window.mindu.routes(rows);message(tx('Assignments saved'));
});};
$('refresh').onclick=()=>action(async()=>{signature='';await refresh();});
$('disconnect').onclick=()=>action(async()=>{await window.mindu.disconnect();signature='';});
$('language').onchange=()=>action(async()=>{await window.mindu.language($('language').value);signature='';});
$('startup').onchange=()=>action(()=>window.mindu.startup($('startup').checked));
translate();refresh().catch(e=>message(e.message,true));
setInterval(()=>{if(!busy)refresh().catch(e=>message(e.message,true));},4000);