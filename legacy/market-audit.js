// MyPortefolio 9.7 — auditoria cambial e de cotações (não altera operações).
(function(){
const pct=(a,b)=>b>0?(a/b-1)*100:null;
function audit(){
 if(typeof tab==='undefined'||tab!=='Ações'||!document.getElementById('app'))return;
 if(document.getElementById('market-audit'))return;
 const ops=state.operations.filter(x=>x.category==='Ações');
 const groups=new Map();
 for(const o of ops){
  const ticker=String(o.ticker||'').trim().toUpperCase();
  if(!groups.has(ticker))groups.set(ticker,[]);
  groups.get(ticker).push(o);
 }
 const meta=state.marketQuotes?.['Ações']||{}, items=new Map((meta.items||[]).map(x=>[x.ticker,x]));
 const rows=[];let alerts=0;
 for(const [ticker,operations] of groups){
  const etoro=operations.filter(o=>String(o.broker||'').replace(/\s/g,'').toUpperCase()==='ETORO');
  const missing=etoro.filter(o=>String(o.currency||'EUR').toUpperCase()!=='USD'||!(Number(o.fxAtTrade)>0));
  const current=Number(state.prices?.[ticker]),currency=String(state.priceCurrencies?.[ticker]||'EUR').toUpperCase();
  const q=items.get(ticker),source=q?.provider||'Manual / sem metadados',date=q?.quoteDate||'—';
  const reference=Number(q?.originalPrice),eur=Number(q?.eurPrice);
  const mismatch=q&&eur>0&&Math.abs(current-eur)>Math.max(0.015,eur*0.0001);
  const badCurrency=q&&currency!=='EUR';
  const ratio=q&&reference>0&&eur>0?eur/reference:null;
  const suspiciousFx=q&&q.currency==='USD'&&ratio!==null&&(ratio<0.6||ratio>1.2);
  const badPrice=!(current>0);
  const messages=[];
  if(missing.length)messages.push(missing.length+' operações eToro sem câmbio histórico USD válido');
  if(mismatch)messages.push('preço guardado difere do último preço convertido recebido');
  if(badCurrency)messages.push('cotação da API não está marcada EUR');
  if(suspiciousFx)messages.push('conversão USD/EUR fora de intervalo de controlo');
  if(badPrice)messages.push('sem preço atual válido');
  if(q&&!(String(date).match(/^\d{4}-\d{2}-\d{2}/)))messages.push('data da cotação em falta');
  if(messages.length)alerts++;
  if(!etoro.length&&!messages.length)continue;
  rows.push({ticker,etoro:etoro.length,price:current,source,date,messages});
 }
 const panel=document.createElement('section');panel.className='panel';panel.id='market-audit';
 const h=document.createElement('h3');h.textContent='Auditoria cambial e de cotações — Ações';panel.append(h);
 const p=document.createElement('p');p.className='muted-note';p.textContent='Auditoria não altera posições. Compara a moeda das operações eToro com o câmbio histórico e verifica a coerência da última cotação guardada. '+alerts+' ativo(s) requerem revisão. A consistência não garante que o fornecedor tenha identificado a empresa correta.';panel.append(p);
 const table=document.createElement('table');const thead=document.createElement('thead');
 const tr=document.createElement('tr');['Ativo','Operações eToro','Preço guardado (EUR)','Fonte','Data cotação','Verificação'].forEach(x=>{const th=document.createElement('th');th.textContent=x;tr.append(th)});thead.append(tr);table.append(thead);
 const tbody=document.createElement('tbody');for(const x of rows){const tr=document.createElement('tr');[x.ticker,String(x.etoro),Number.isFinite(x.price)?x.price.toLocaleString('pt-PT',{maximumFractionDigits:2,minimumFractionDigits:2})+' €':'—',x.source,x.date,x.messages.join('; ')||'Sem divergências detetadas'].forEach(t=>{const td=document.createElement('td');td.textContent=t;tr.append(td)});tbody.append(tr)}table.append(tbody);panel.append(table);
 const refresh=document.createElement('button');refresh.textContent='Verificar novamente';refresh.type='button';refresh.onclick=()=>{panel.remove();audit()};panel.append(refresh);
 const pos=document.querySelector('#app section.panel');if(pos)pos.insertAdjacentElement('afterend',panel);else document.getElementById('app').prepend(panel);
}
const element=document.getElementById('app');
if(element){new MutationObserver(()=>{if(tab==='Ações'&&!document.getElementById('market-audit'))audit()}).observe(element,{childList:true});audit()}
})();