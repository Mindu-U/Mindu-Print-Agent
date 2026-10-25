window.ticketReady=window.ticketData().then(({width,document:ticket})=>{
 document.documentElement.lang=ticket.lang;
 document.documentElement.classList.toggle('narrow',width===58);
 const root=document.getElementById('ticket');
 for(const block of ticket.blocks){
  const el=document.createElement(block.type==='heading'?'h1':block.type==='rule'?'hr':'div');
  el.className=block.type+(block.center?' center':'')+(block.bold?' bold':'');
  if(block.type==='pair'){const left=document.createElement('span'),right=document.createElement('span');left.textContent=block.text;right.textContent=block.right;el.append(left,right);}
  else if(block.type!=='rule')el.textContent=block.text;
  root.append(el);
 }
});