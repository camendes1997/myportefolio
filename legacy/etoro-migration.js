// Migração assistida: valores originais das ações eToro foram registados em USD.
function etoroUsdPending(){return state.operations.map((o,i)=>({o,i})).filter(({o})=>o.category==='Ações'&&/^ETORO$/i.test(String(o.broker||'').replace(/\s/g,''))&&currencyOf(o)==='EUR')}
async function fixEtoroUsd(){
 const pending=etoroUsdPending();
 if(!pending.length)return alert('Não existem operações eToro por corrigir.');
 if(!confirm('Confirmas que os preços unitários das '+pending.length+' operações antigas de Ações na eToro estão em USD? Exporta primeiro um backup JSON.'))return;
 const rates=new Map();
 try{
  for(const date of new Set(pending.map(({o})=>o.date))){
   if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>new Date().toISOString().slice(0,10))throw Error('Data inválida: '+date);
   const res=await fetch('https://api.frankfurter.dev/v1/'+date+'?base=USD&symbols=EUR');
   if(!res.ok)throw Error('Sem câmbio para '+date);
   const data=await res.json(),rate=Number(data.rates?.EUR);
   if(!(rate>0)||data.date>date)throw Error('Câmbio inválido: '+date);
   rates.set(date,{rate,date:data.date});
  }
  const usd=pending.reduce((s,{o})=>s+num(o.qty)*num(o.price),0);
  const eur=pending.reduce((s,{o})=>s+num(o.qty)*num(o.price)*rates.get(o.date).rate,0);
  if(!confirm('Pré-visualização (compras e vendas): '+usd.toFixed(2)+' USD = '+eur.toFixed(2)+' EUR, ao câmbio de cada data. Comissões existentes ficam em EUR. Aplicar?'))return;
  const backup=structuredClone(state.operations),prior=ledger('Ações').errors.length;
  for(const {i,o} of pending){
   const rate=rates.get(o.date);
   state.operations[i]={...state.operations[i],currency:'USD',fxAtTrade:rate.rate,fxRateDate:rate.date,fxSource:'Frankfurter',last:0};
  }
  if(ledger('Ações').errors.length>prior||!reconciliation().ok){state.operations=backup;throw Error('Falha na reconciliação; operação revertida')}
  state.etoroUsdMigration={date:new Date().toISOString(),rows:pending.length};
  save();render();alert('Conversão concluída. Confirma os valores no Dashboard e exporta novo backup.');
 }catch(e){alert('Conversão não concluída: '+e.message)}
}

function showEtoroMigration(){
 const app=document.getElementById('app');
 if(!app||tab!=='Ações'||!etoroUsdPending().length||document.getElementById('etoro-usd-panel'))return;
 const panel=document.createElement('section');panel.className='panel';panel.id='etoro-usd-panel';
 const heading=document.createElement('h3');heading.textContent='Revisão cambial eToro (USD → EUR)';
 const description=document.createElement('p');description.className='muted-note';
 description.textContent=etoroUsdPending().length+' operações antigas eToro ainda estão identificadas como EUR. Exporta primeiro um backup JSON; confirma depois os valores em USD e a conversão histórica.';
 const button=document.createElement('button');button.type='button';button.textContent='Corrigir operações eToro';button.onclick=fixEtoroUsd;
 panel.append(heading,description,button);
 const form=app.querySelector('.panel');if(form)form.insertAdjacentElement('afterend',panel);else app.prepend(panel);
}
const appNode=document.getElementById('app');
if(appNode){new MutationObserver(showEtoroMigration).observe(appNode,{childList:true});showEtoroMigration()}
