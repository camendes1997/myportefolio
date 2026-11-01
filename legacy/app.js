'use strict';
const userId=new URLSearchParams(location.search).get('uid');
if(!/^[0-9a-f-]{36}$/i.test(userId||''))throw Error('É necessário iniciar sessão.');
const KEY='myportefolio-v9:'+userId;let state;try{state=JSON.parse(localStorage.getItem(KEY)||'null')||structuredClone(INITIAL)}catch{state=structuredClone(INITIAL)};if(!Array.isArray(state.history))state.history=structuredClone(INITIAL.history)
state={...structuredClone(INITIAL),...state};if(!Array.isArray(state.certificates))state.certificates=structuredClone(INITIAL.certificates);if(!Number.isFinite(Number(state.cashAmount))||Number(state.cashAmount)<0)state.cashAmount=0;if(!Array.isArray(state.cashflows))state.cashflows=[];if(!state.fxRates||typeof state.fxRates!=='object')state.fxRates={};if(!state.priceCurrencies||typeof state.priceCurrencies!=='object')state.priceCurrencies={};if(!Array.isArray(state.dividends))state.dividends=[];state.dividends=state.dividends.filter(d=>['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'].includes(d.month));for(const r of state.summary){let v=INITIAL.summary.find(x=>x.name===r.name);if(v&&r.net===undefined)r.net=v.net}let tab='Dashboard',period='Tudo',chartCategory='Global',divYear=2026,chartDetail='all',selectedAsset=null,editingCaId=null;
const tabs=['Dashboard','ETF','Ações','Criptomoedas','Dividendos','Poupanças','Certificados de Aforro','PPR','Importar/exportar'];
const categories=['ETF','Ações','Criptomoedas','Certificados de Aforro','Depósitos a prazo','PPR'];
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=x=>Number(String(x??0).replace(',','.'))||0;
const money=x=>Number(x||0).toLocaleString('pt-PT',{style:'currency',currency:'EUR'});
const moneyDetail=x=>Number(x||0).toLocaleString('pt-PT',{style:'currency',currency:'EUR',minimumFractionDigits:2,maximumFractionDigits:2});
const moneyUnit=x=>Number(x||0).toLocaleString('pt-PT',{style:'currency',currency:'EUR',minimumFractionDigits:2,maximumFractionDigits:2});
const fmt=x=>Number(x||0).toLocaleString('pt-PT',{maximumFractionDigits:2});
const pct=x=>(Number.isFinite(x)?x.toLocaleString('pt-PT',{minimumFractionDigits:2,maximumFractionDigits:2})+' %':'—');
const sum=(a,k)=>a.reduce((s,x)=>s+num(x[k]),0);const sign=x=>x>=0?'positive':'negative';
const uid=()=>globalThis.crypto?.randomUUID?.()||'new-'+Date.now()+'-'+Math.random().toString(36).slice(2);
function save(){localStorage.setItem(KEY,JSON.stringify(state));parent.postMessage({type:'MYPORT_SAVED',uid:userId,portfolio:structuredClone(state)},location.origin)}

const supportedCurrencies=['EUR','USD','GBP','CHF','JPY','CAD','AUD','BRL'];
const currencyOf=o=>String(o.currency||'EUR').trim().toUpperCase();
const fxTrade=o=>currencyOf(o)==='EUR'?1:Number(o.fxAtTrade);
const unitEur=o=>num(o.price)*fxTrade(o);
const quoteCurrency=t=>String((state.priceCurrencies||{})[t]||'EUR').toUpperCase();
const fxNow=c=>c==='EUR'?1:Number(state.fxRates?.[c]?.eurPerUnit);
function quoteInfo(t,raw){const currency=quoteCurrency(t);const fx=fxNow(currency);const value=Number.isFinite(fx)&&fx>0?raw*fx:null;return {currency,fx,value,updated:state.fxRates?.[currency]?.date||null,stale:currency!=='EUR'&&(!state.fxRates?.[currency]?.checkedOn||state.fxRates[currency].checkedOn!==new Date().toISOString().slice(0,10))}}
async function refreshFx(force=false){
 const needed=[...new Set([...state.operations.map(currencyOf),...Object.values(state.priceCurrencies||{})].filter(c=>c&&c!=='EUR'))];
 if(!needed.length)return;
 const today=new Date().toISOString().slice(0,10);
 if(!force&&needed.every(c=>state.fxRates[c]?.checkedOn===today))return;
 try{
  const response=await fetch('https://api.frankfurter.dev/v1/latest?base=EUR&symbols='+encodeURIComponent(needed.join(',')),{cache:'no-store'});
  if(!response.ok)throw Error('HTTP '+response.status);
  const data=await response.json();
  for(const c of needed){const rate=Number(data.rates?.[c]);if(Number.isFinite(rate)&&rate>0)state.fxRates[c]={eurPerUnit:1/rate,date:data.date,checkedOn:today};}
  save();render();
 }catch(error){console.warn('Sem atualização cambial:',error);const status=document.getElementById('fx-status');if(status)status.textContent='Câmbio: atualização indisponível. Taxas anteriores identificadas como tal.';}
}


const cryptoIds={
 BTC:'bitcoin',ETH:'ethereum',SOL:'solana',ADA:'cardano',XRP:'ripple',
 DOGE:'dogecoin',DOT:'polkadot',LINK:'chainlink',LTC:'litecoin',
 AVAX:'avalanche-2',BNB:'binancecoin',ATOM:'cosmos',XLM:'stellar',
 UNI:'uniswap',BCH:'bitcoin-cash',TRX:'tron',SHIB:'shiba-inu',
 AAVE:'aave',NEAR:'near',ENJ:'enjincoin',VET:'vechain',SAND:'the-sandbox',
 MANA:'decentraland',MATIC:'matic-network',CRO:'crypto-com-chain'
};
// Normaliza pares como BTC/EUR e ADA/USD sem alterar os tickers originais.
const cryptoBase=t=>String(t||'').trim().toUpperCase().split(/[\\/:-]/)[0];
const cryptoTickerSet=()=>[...new Set(state.operations.filter(o=>o.category==='Criptomoedas').map(o=>String(o.ticker||'').trim().toUpperCase()))];
if(!state.marketQuotes||typeof state.marketQuotes!=='object')state.marketQuotes={};
if(state.autoCryptoQuotes===undefined)state.autoCryptoQuotes=true;
let cryptoBusy=false;
function cryptoPanel(){
 const m=state.marketQuotes.crypto||{},tickers=cryptoTickerSet(),supported=tickers.filter(t=>cryptoIds[cryptoBase(t)]),missing=tickers.filter(t=>!cryptoIds[cryptoBase(t)]);
 const last=m.at?new Date(m.at).toLocaleString('pt-PT'):'nunca';
 return '<section class="panel"><h3>Cotações de criptomoedas</h3><div class="actions"><button type="button" id="update-crypto">Atualizar preços agora</button><label class="pill"><input type="checkbox" id="auto-crypto" style="width:auto" '+(state.autoCryptoQuotes?'checked':'')+'> Atualização diária</label></div><p class="muted-note">Fonte: CoinGecko · valores de mercado em EUR · última atualização: '+esc(last)+'. Ativos reconhecidos: '+supported.length+'/'+tickers.length+'. '+(missing.length?'Sem correspondência automática: '+esc(missing.join(', '))+'. ':'')+'Os preços são indicativos e podem ter atraso. Nos pares USD, o preço de mercado é convertido para EUR; o registo original não é modificado.</p><p id="crypto-message" class="muted-note" aria-live="polite"></p></section>';
}
async function updateCrypto(force=false){
 if(cryptoBusy||(!force&&!state.autoCryptoQuotes))return;
 const day=new Date().toISOString().slice(0,10);
 if(!force&&state.marketQuotes.crypto?.checkedOn===day)return;
 const tickers=cryptoTickerSet().filter(t=>cryptoIds[cryptoBase(t)]);
 if(!tickers.length){const msg=document.getElementById('crypto-message');if(msg)msg.textContent='Não há ativos reconhecidos para atualizar.';return}
 cryptoBusy=true;const message=document.getElementById('crypto-message');if(message)message.textContent='A consultar preços de '+tickers.length+' ativo(s)…';
 try{
  const qs=new URLSearchParams({ids:[...new Set(tickers.map(t=>cryptoIds[cryptoBase(t)]))].join(','),vs_currencies:'eur',include_last_updated_at:'true'});
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
  let response;try{response=await fetch('https://api.coingecko.com/api/v3/simple/price?'+qs,{cache:'no-store',signal:controller.signal})}finally{clearTimeout(timeout)}
  if(!response.ok){
    if(response.status===401||response.status===403)throw Error('API exige autenticação; será necessário configurar uma chave Demo num serviço seguro');
    if(response.status===429)throw Error('limite de pedidos da API atingido; tenta mais tarde');
    throw Error('HTTP '+response.status);
  }
  const data=await response.json(),received=[],missingPrices=[];
  for(const ticker of tickers){const item=data[cryptoIds[cryptoBase(ticker)]],price=Number(item?.eur);
   if(Number.isFinite(price)&&price>0)received.push({ticker,price});
   else missingPrices.push(ticker);
  }
  if(!received.length)throw Error('A API não devolveu preços válidos para estes ativos');
  // Preços de avaliação atuais por ticker; não mexer nas operações históricas.
  for(const q of received){state.prices[q.ticker]=q.price;state.priceCurrencies[q.ticker]='EUR';}
  state.marketQuotes.crypto={at:new Date().toISOString(),checkedOn:day,provider:'CoinGecko',symbols:received.map(q=>q.ticker)};
  save();render();
  const m=document.getElementById('crypto-message');
  if(m)m.textContent=received.length+' preço(s) atualizados.'+(missingPrices.length?' Sem preço: '+missingPrices.join(', ')+'.':'');
 }catch(e){console.warn('Cotação indisponível',e);const m=document.getElementById('crypto-message');if(m)m.textContent='Atualização não concluída: '+e.message+'. Preços anteriores mantidos.'}
 finally{cryptoBusy=false}
}


if(!state.marketMappings||typeof state.marketMappings!=='object')state.marketMappings={};
if(state.autoMarketQuotes===undefined)state.autoMarketQuotes=false;
if(!state.marketQuotes||typeof state.marketQuotes!=='object')state.marketQuotes={};
let marketBusy=false;const pendingMarket=new Map();
window.addEventListener('message',event=>{
 if(event.origin!==location.origin||event.source!==parent||event.data?.type!=='MYPORT_MARKET_RESPONSE'||event.data.uid!==userId)return;
 const p=pendingMarket.get(event.data.requestId);if(!p)return;
 pendingMarket.delete(event.data.requestId);clearTimeout(p.timer);
 event.data.error?p.reject(Error(event.data.error)):p.resolve(event.data.data);
});
function fetchMarketQuotes(assets){
 return new Promise((resolve,reject)=>{
  const id=uid();const timer=setTimeout(()=>{pendingMarket.delete(id);reject(Error('Tempo de resposta excedido'))},40000);
  pendingMarket.set(id,{resolve,reject,timer});
  parent.postMessage({type:'MYPORT_MARKET_REQUEST',uid:userId,requestId:id,assets},location.origin);
 });
}
function marketPanel(cat){
 const assets=[...new Set(state.operations.filter(o=>o.category===cat).map(o=>String(o.ticker||'').trim().toUpperCase()))].sort();
 const configured=assets.filter(t=>state.marketMappings[cat+'|'+t]?.symbol);
 const meta=state.marketQuotes?.stocks||{};
 const rows=assets.map(t=>{const m=state.marketMappings[cat+'|'+t]||{};
  return '<tr><td>'+esc(t)+'</td><td>'+esc(m.symbol||'Por configurar')+'</td><td>'+esc(m.exchange||'—')+'</td><td><button data-market-map="'+encodeURIComponent(JSON.stringify({cat,ticker:t}))+'">Configurar</button></td></tr>'});
 return '<section class="panel"><h3>Cotações de '+esc(cat)+'</h3><div class="actions"><button type="button" id="market-refresh">Atualizar preços agora</button><label class="pill"><input type="checkbox" id="market-auto" style="width:auto" '+(state.autoMarketQuotes?'checked':'')+'> Atualização diária</label></div>'+
 '<div class="muted-note">Fonte: Twelve Data através do Supabase · '+configured.length+'/'+assets.length+' símbolos configurados. Última consulta: '+esc(meta.at?new Date(meta.at).toLocaleString('pt-PT'):'nunca')+'. Confirma a bolsa de cada ativo antes de atualizar. Necessita da Edge Function e da chave de fornecedor no Supabase; a aplicação não expõe a chave.</div>'+
 '<p id="market-status" class="muted-note" aria-live="polite"></p>'+table(['Ativo','Símbolo do fornecedor','Bolsa','Ação'],rows)+'</section>';
}
async function updateMarketQuotes(cat,force=false){
 if(marketBusy||!['ETF','Ações'].includes(cat)||(!force&&!state.autoMarketQuotes))return;
 const day=new Date().toISOString().slice(0,10);
 const mappings=[...new Set(state.operations.filter(o=>o.category===cat).map(o=>String(o.ticker||'').trim().toUpperCase()))].map(t=>{
   const m=state.marketMappings[cat+'|'+t];return m?.symbol?{ticker:t,symbol:m.symbol,exchange:m.exchange||undefined,category:cat}:null;
 }).filter(Boolean);
 if(!mappings.length){const el=document.getElementById('market-status');if(el)el.textContent='Configura primeiro os símbolos dos ativos.';return}
 if(!force&&state.marketQuotes.stocks?.checkedOn===day&&state.marketQuotes.stocks?.category===cat)return;
 if(mappings.length>24){const el=document.getElementById('market-status');if(el)el.textContent='Há mais de 24 ativos. Atualiza apenas depois de reduzir a seleção para evitar consumo excessivo de créditos.';return}
 marketBusy=true;
 const el=document.getElementById('market-status');if(el)el.textContent='A consultar cotações…';
 try{
  const results=[];for(let i=0;i<mappings.length;i+=8){
   const out=await fetchMarketQuotes(mappings.slice(i,i+8));
   if(!Array.isArray(out?.results))throw Error('Resposta inválida da função de cotações');
   results.push(...out.results);
  }
  const success=results.filter(x=>Number.isFinite(Number(x.eurPrice))&&Number(x.eurPrice)>0),errors=results.filter(x=>x.error);
  for(const x of success){state.prices[x.ticker]=Number(x.eurPrice);state.priceCurrencies[x.ticker]='EUR';}
  if(success.length){
   state.marketQuotes.stocks={at:new Date().toISOString(),checkedOn:day,category:cat,provider:'Twelve Data',items:success.map(x=>({ticker:x.ticker,quoteDate:x.quoteDate,currency:x.currency,exchange:x.exchange}))};
   save();render();
  }
  const msg=document.getElementById('market-status');
  if(msg)msg.textContent=success.length+' cotação(ões) atualizada(s).'+(errors.length?' Sem atualização: '+errors.map(x=>x.ticker+' ('+x.error+')').join('; '):'');
 }catch(e){const msg=document.getElementById('market-status');if(msg)msg.textContent='Não foi possível atualizar: '+e.message+'. Valores anteriores mantidos.'}
 finally{marketBusy=false}
}

function currencyNotice(){const all=[...new Set([...state.operations.map(currencyOf),...Object.values(state.priceCurrencies||{})].filter(x=>x!=='EUR'))];if(!all.length)return '';
return `<div class="muted-note" id="fx-status">Câmbio diário: ${all.map(c=>{const r=state.fxRates?.[c];return `${esc(c)} ${r?`1 ${esc(c)} = ${money(r.eurPerUnit)} (${esc(r.date||'sem data')}${r.checkedOn!==new Date().toISOString().slice(0,10)?', atualização pendente':''})`:'sem taxa disponível'}`}).join(' · ')}. O câmbio altera a avaliação atual, não o custo histórico das compras. <button id="refresh-fx" type="button">Atualizar câmbios</button></div>`}

function table(head,rows){return `<table><thead><tr>${head.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.join('')||`<tr><td colspan="${head.length}" class="muted">Sem registos.</td></tr>`}</tbody></table>`}
function card(label,value,cls='',sub=''){return `<div class="card"><small>${esc(label)}</small><div class="value ${cls}">${value}</div>${sub?`<small>${sub}</small>`:''}</div>`}
function nav(){document.getElementById('nav').innerHTML=tabs.map(t=>`<button class="${t===tab?'active':''}" data-tab="${esc(t)}">${esc(t)}</button>`).join('');document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;selectedAsset=null;render()})}
// Fonte unica: operacoes, certificados, PPR e saldos locais; todos os montantes em EUR.
function keyFor(o){return [o.category,o.broker,o.ticker].join('|')}
function taxRate(date,category){let days=(Date.now()-new Date(date+'T00:00:00Z').getTime())/86400000;if(!Number.isFinite(days)||days<0)days=0;if(category==='Criptomoedas')return days<365?.28:0;return days<730?.28:days<1826?.252:days<2922?.224:.196}
// Livro-razão único. Uma compra cria um lote; uma venda consome lotes FIFO.
// As linhas do histórico refletem apenas a quantidade ainda detida de cada compra.
function ledger(cat){
 const groups=new Map(), entries=new Map(), errors=[];
 const sorted=state.operations.map((o,index)=>({...o,_source:index})).filter(o=>o.category===cat)
   .sort((a,b)=>String(a.date).localeCompare(String(b.date))||a._source-b._source);
 for(const o of sorted){
  const k=keyFor(o), ticker=String(o.ticker??'').trim().toUpperCase(), broker=String(o.broker??'').trim();
  const g=groups.get(k)||{category:cat,ticker:o.ticker,broker:o.broker,lots:[],realized:0,warning:[],last:0};
  const q=num(o.qty),pr=unitEur(o),fee=num(o.fees),buy=o.side==='Compra';
  const entry={source:o._source,side:o.side,qty:q,price:pr,fees:fee,operationValue:q*pr,
   remainingQty:0,remainingCost:0,remainingCurrent:0,remainingNet:0,remainingGrossGain:0,
   remainingNetGain:0,basisSold:0,realized:0,valid:true};
  entries.set(o._source,entry);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(o.date))||!ticker||!broker||q<=0||pr<0||fee<0||!Number.isFinite(q*pr)||!Number.isFinite(pr)||pr<0||!['Compra','Venda'].includes(o.side)){
    entry.valid=false;g.warning.push('Operação inválida na linha '+(o._source+1));errors.push(`${cat}: operação inválida ${o.date} / ${ticker}`);
    groups.set(k,g);continue;
  }
  if(buy){
    const lot={date:o.date,qty:q,cost:q*pr+fee,source:o._source};
    g.lots.push(lot);
  }else{
    const available=g.lots.reduce((n,l)=>n+l.qty,0);
    if(q>available+1e-8){
      entry.valid=false;g.warning.push('Venda sem quantidade suficiente em '+o.date);
      errors.push(`${cat}: venda de ${ticker} em ${o.date} excede posição`);
      groups.set(k,g);continue;
    }
    let left=q,basis=0;
    for(const l of g.lots){
      if(left<=1e-9)break;
      const take=Math.min(left,l.qty),part=l.cost*take/l.qty;
      l.qty-=take;l.cost-=part;left-=take;basis+=part;
    }
    g.lots=g.lots.filter(l=>l.qty>1e-9);
    entry.basisSold=basis;entry.realized=q*pr-fee-basis;g.realized+=entry.realized;
  }
  if(num(o.last)>0)g.last=num(o.last);
  groups.set(k,g);
 }
 const positions=[];
 for(const g of groups.values()){
  const qty=g.lots.reduce((n,l)=>n+l.qty,0),cost=g.lots.reduce((n,l)=>n+l.cost,0);
  const explicit=Object.prototype.hasOwnProperty.call(state.prices||{},g.ticker);
  const quoted=explicit?quoteInfo(g.ticker,num(state.prices[g.ticker])):null;
  const quote=explicit?quoted.value:g.last;
  const hasPrice=Number.isFinite(quote)&&quote>0;
  const current=hasPrice?qty*quote:cost;
  let tax=0;
  for(const l of g.lots){
    const e=entries.get(l.source);
    const lotCurrent=hasPrice?l.qty*quote:l.cost;
    const lotTax=Math.max(0,lotCurrent-l.cost)*taxRate(l.date,cat);
    tax+=lotTax;
    e.remainingQty=l.qty;e.remainingCost=l.cost;e.remainingCurrent=lotCurrent;
    e.remainingNet=lotCurrent-lotTax;e.remainingGrossGain=lotCurrent-l.cost;e.remainingNetGain=e.remainingGrossGain-lotTax;
  }
  if(qty>1e-9)positions.push({...g,qty,cost,last:quote,current,gain:current-cost,tax,
    net:current-tax,netGain:current-tax-cost,hasPrice});
 }
 return {positions,entries,errors};
}
function positions(cat){return ledger(cat).positions}


// Em cripto, mostra uma unica linha por ticker, sem alterar a contabilidade FIFO por corretora.
function visiblePositions(cat){
 const original=positions(cat);
 if(cat!=='Criptomoedas')return original;
 const byTicker=new Map();
 for(const p of original){
  const key=String(p.ticker).trim().toUpperCase();
  if(!byTicker.has(key))byTicker.set(key,{...p,ticker:key,brokers:[p.broker]});
  else {const v=byTicker.get(key);for(const field of ['qty','cost','current','gain','tax','net','netGain','realized'])v[field]+=num(p[field]);v.hasPrice=v.hasPrice&&p.hasPrice;v.warning.push(...p.warning);if(!v.brokers.includes(p.broker))v.brokers.push(p.broker)}
 }
 return [...byTicker.values()].map(p=>({...p,broker:p.brokers.length===1?p.brokers[0]:'Várias ('+p.brokers.length+')',last:p.qty?p.current/p.qty:0}));
}
function reference(cat){return null} // compatibilidade de antigos backups; nunca usado nos totais
function depositsValue(){let a=recordedHistory().filter(h=>h['Depósitos a prazo']!==null&&h['Depósitos a prazo']!==undefined);return a.length?num(a[a.length-1]['Depósitos a prazo']):sum(state.savings.filter(x=>!String(x.type).includes('Certificados')),'current')}
function savingsValue(){return depositsValue()+num(state.cashAmount)}
function savingsInvested(){return savingsValue()} // Depósitos: capital investido igual ao saldo atual
function totals(){let out={};for(let c of categories){if(['ETF','Ações','Criptomoedas'].includes(c)){let ps=positions(c);out[c]={invested:ps.reduce((n,x)=>n+x.cost,0),current:ps.reduce((n,x)=>n+x.current,0),net:ps.reduce((n,x)=>n+x.net,0)}}else if(c==='Certificados de Aforro')out[c]={invested:sum(state.certificates,'invested'),current:sum(state.certificates,'current'),net:sum(state.certificates,'current')};else if(c==='PPR')out[c]={invested:sum(state.ppr,'invested'),current:sum(state.ppr,'current'),net:sum(state.ppr,'current')};else out[c]={invested:savingsInvested(),current:savingsValue(),net:savingsValue()}}return out}
function reconciliation(){
 const t=totals(), issues=[],details=[];
 for(const cat of ['ETF','Ações','Criptomoedas']){
  const book=ledger(cat),p=book.positions;
  const bought=[...book.entries.values()].filter(e=>e.valid&&e.side==='Compra');
  const sold=[...book.entries.values()].filter(e=>e.valid&&e.side==='Venda');
  const investedByRows=bought.reduce((s,e)=>s+e.remainingCost,0);
  const currentByRows=bought.reduce((s,e)=>s+e.remainingCurrent,0);
  const netByRows=bought.reduce((s,e)=>s+e.remainingNet,0);
  const historicalBuys=bought.reduce((s,e)=>s+e.operationValue+e.fees,0);
  const soldBasis=sold.reduce((s,e)=>s+e.basisSold,0);
  const item=t[cat];
  for(const [label,expected,actual] of [['capital aberto',item.invested,investedByRows],
    ['valor bruto',item.current,currentByRows],['valor líquido',item.net,netByRows],
    ['compras menos custo vendido',item.invested,historicalBuys-soldBasis]]){
    if(Math.abs(expected-actual)>0.005)issues.push(`${cat}: ${label} não coincide (${money(actual)} vs ${money(expected)})`);
  }
  issues.push(...book.errors);
  details.push({cat,invested:item.invested,current:item.current,net:item.net,buys:historicalBuys,soldBasis});
 }
 for(const cat of ['Certificados de Aforro','PPR']){
  const rows=cat==='PPR'?state.ppr:state.certificates;
  const item=t[cat];
  if(Math.abs(item.invested-sum(rows,'invested'))>0.005||Math.abs(item.current-sum(rows,'current'))>0.005)
    issues.push(`${cat}: posições e Dashboard não coincidem`);
 }
 if(Math.abs(t['Depósitos a prazo'].current-depositsValue()-num(state.cashAmount))>0.005)issues.push('Poupanças: depósitos e numerário não coincidem');
 if(Math.abs(t['Depósitos a prazo'].invested-t['Depósitos a prazo'].current)>0.005)
   issues.push('Depósitos: capital e saldo devem coincidir');
 const a=allTotals();
 for(const k of ['invested','current','net'])if(Math.abs(a[k]-Object.values(t).reduce((s,p)=>s+p[k],0))>0.005)
   issues.push(`Dashboard: total de ${k} não coincide com as categorias`);
 return {issues,details,ok:!issues.length};
}
function recordedHistory(){
 const map=new Map();
 const rows=(state.history||[]).filter(h=>/^\d{4}-\d{2}-\d{2}$/.test(h.date))
   .slice().sort((a,b)=>a.date.localeCompare(b.date)||Number(!!a.manual)-Number(!!b.manual));
 for(const h of rows){
  const prior=map.get(h.date)||{date:h.date};
  for(const c of categories)if(h[c]!==null&&h[c]!==undefined&&h[c]!=='')prior[c]=num(h[c]);
  if(h.manual)prior.manual=true;
  map.set(h.date,prior);
 }
 let prior={};return [...map.values()].map(h=>{
   let row={...h};for(const c of categories){if(row[c]===undefined&&prior[c]!==undefined)row[c]=prior[c];
     if(row[c]!==undefined)prior[c]=row[c]}
   return row;
 });
}

function latestSnapshot(cat){let a=recordedHistory().filter(h=>h[cat]!==null&&Number.isFinite(Number(h[cat])));return a.length?num(a[a.length-1][cat]):null}
function savingsHistoryPanel(cat){let a=recordedHistory().filter(h=>h[cat]!==null),current=depositsValue(),prior=a.length>1?num(a[a.length-2][cat]):null,delta=prior===null?0:current-prior,dates=a.map(h=>({date:h.date,amount:num(h[cat])}));return `<div class="cards">${card('Último saldo registado',current===null?'—':money(current))}${card('Variação face ao registo anterior',prior===null?'—':money(delta),sign(delta))}${card('Registos históricos',a.length)}</div><section class="panel"><h3>Evolução real dos saldos registados</h3>${chartSvg('savchart',a.map(h=>({date:h.date,[cat]:num(h[cat])})),[cat])}<div class="muted-note">Fonte: histórico guardado na aplicação e registos manuais. Cada linha é uma fotografia do saldo nessa data, não um novo investimento a somar.</div></section><section class="panel"><h3>Registar saldo no fim do mês</h3><form id="snapform"><input type="hidden" name="cat" value="${esc(cat)}"><label>Data do registo<input type="date" name="date" required value="${new Date().toISOString().slice(0,10)}"></label><label>Saldo atual (€)<input type="number" min="0" step="0.01" name="amount" value="${current??''}" required></label><button class="primary">Guardar saldo mensal</button></form></section><section class="panel"><h3>Histórico mensal</h3>${table(['Data','Saldo','Variação desde anterior','Variação %',''],a.slice().reverse().map((h,idx)=>{let i=a.indexOf(h),prev=i?num(a[i-1][cat]):null,diff=prev===null?null:num(h[cat])-prev;return `<tr><td>${h.date}</td><td>${money(h[cat])}</td><td class="${sign(diff??0)}">${diff===null?'—':money(diff)}</td><td>${diff===null||!prev?'—':pct(100*diff/prev)}</td><td>${h.manual?`<button class="danger" data-histdel="${encodeURIComponent(h.date+'|'+cat)}">Eliminar</button>`:'<small>Histórico inicial</small>'}</td></tr>`}))}</section>`}

// Esta serie nasce exclusivamente da tabela de subscrições. Os valores atuais de cada
// subscrição são projetados nos marcos de subscrição; não são cotações históricas.
function certificateSeries(){
 const rows=(state.certificates||[]).filter(r=>/^\d{4}-\d{2}-\d{2}$/.test(String(r.date)))
  .slice().sort((a,b)=>a.date.localeCompare(b.date));
 const dates=[...new Set(rows.map(r=>r.date))];
 return dates.map(date=>({date,'Certificados de Aforro':rows.filter(r=>r.date<=date).reduce((v,r)=>v+num(r.current),0)}));
}
// Historico reconstruido A PARTIR das tabelas de operacoes, subscricoes e saldos.
// As posicoes de datas antigas sao avaliadas aos precos disponiveis HOJE;
// nao se apresentam estes dados como valor real de mercado historico.
function derivedSeries(){
 const today=new Date().toISOString().slice(0,10);
 const valid=d=>/^\d{4}-\d{2}-\d{2}$/.test(String(d))&&d<=today;
 const operations=state.operations;
 const certs=state.certificates||[];
 const depRows=recordedHistory().filter(h=>h['Depósitos a prazo']!=null&&valid(h.date));
 const dates=new Set([...operations.map(o=>o.date),...certs.map(c=>c.date),...depRows.map(h=>h.date)].filter(valid).map(d=>d.slice(0,7)));
 const months=[...dates].sort();
 let output=[];
 for(const month of months){
  const end=month+'-31';
  const cutoff=end>today?today:end;
  // ledger() e a rotina de cotacoes continuam a ser a mesma fonte usada nas abas.
  state.operations=operations.filter(o=>valid(o.date)&&o.date<=cutoff);
  let row={date:month};
  try{
   for(const category of ['ETF','Ações','Criptomoedas'])row[category]=positions(category).reduce((v,x)=>v+x.current,0);
  }finally{state.operations=operations}
  row['Certificados de Aforro']=certs.filter(c=>valid(c.date)&&c.date<=cutoff).reduce((v,c)=>v+num(c.current),0);
  const past=depRows.filter(h=>h.date<=cutoff);
  row['Depósitos a prazo']=past.length?num(past[past.length-1]['Depósitos a prazo']):0;
  row.PPR=0; // Os PPR sem data de registo nao permitem reconstruir o passado.
  row.Global=categories.reduce((v,c)=>v+num(row[c]),0);
  output.push(row);
 }
 const t=totals(),live={date:'Atual'};
 for(const c of categories)live[c]=t[c].current;
 live.Global=categories.reduce((v,c)=>v+num(live[c]),0);
 return [...output,live];
}
function allTotals(){let t=Object.values(totals());return {invested:t.reduce((s,x)=>s+x.invested,0),current:t.reduce((s,x)=>s+x.current,0),net:t.reduce((s,x)=>s+x.net,0)}}
// Histórico de saldos registados por data (inclui movimentos de capital).
function series(){return derivedSeries()}
const colors={'Global':'#69dfb6','ETF':'#6da9ff','Ações':'#c19dff','Criptomoedas':'#f3ba64','Certificados de Aforro':'#61d5d4','Depósitos a prazo':'#ff8e9e','PPR':'#e4d77c'};
function filteredSeries(){let s=series();if(period==='Tudo')return s;let n={'1A':12,'3A':36,'5A':60}[period]||s.length;return s.slice(-n)}
function chartSvg(id,items,keys){if(!items.length)return '<div class="muted">Sem dados para mostrar.</div>';let W=1000,H=340,L=145,R=145,T=65,B=68;let vals=items.flatMap(d=>keys.map(k=>num(d[k])));let lo=Math.min(...vals),hi=Math.max(...vals);let spread=hi-lo||Math.max(1,Math.abs(hi)*.1);let min=Math.max(0,lo-spread*.16),max=hi+spread*.22;if(max<=min)max=min+1;let x=i=>L+(W-L-R)*(items.length===1?.5:i/(items.length-1));let y=v=>T+(H-T-B)*(1-(v-min)/(max-min));let grid=[0,.25,.5,.75,1].map(f=>{let v=min+(max-min)*f,Y=y(v);return `<line x1="${L}" x2="${W-R}" y1="${Y}" y2="${Y}" stroke="#35465b" stroke-dasharray="4 5"/><text x="${L-10}" y="${Y+4}" text-anchor="end" font-size="12" fill="#b6cbe2">${Math.round(v).toLocaleString('pt-PT')}</text>`}).join('');let lines=keys.map(k=>`<polyline points="${items.map((d,i)=>`${x(i)},${y(num(d[k]))}`).join(' ')}" stroke="${colors[k]}" stroke-width="2.8" stroke-linejoin="round" fill="none"/>`).join('');let ticks=[0,Math.floor((items.length-1)/2),items.length-1].filter((v,i,a)=>a.indexOf(v)===i).map((i,j)=>`<text x="${x(i)}" y="${H-12}" text-anchor="${i===0?'start':i===items.length-1?'end':'middle'}" font-size="12" fill="#b6cbe2">${esc(items[i].date)}</text>`).join('');let markers=keys.length<=2?keys.map(k=>items.map((d,i)=>`<circle cx="${x(i)}" cy="${y(num(d[k]))}" r="${i===0||i===items.length-1?4:2.6}" fill="${colors[k]}"/>`).join('')).join(''):'';return `<div class="chartbox" id="${id}"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolução dos investimentos">${grid}${lines}${markers}${ticks}<line id="${id}-cursor" y1="${T}" y2="${H-B}" stroke="#e4ecf7" stroke-dasharray="3 4" style="display:none"/><rect x="0" y="0" width="${W}" height="${H}" fill="transparent" data-chart="${id}"/></svg><div class="tooltip" id="${id}-tip"></div></div><div class="legend">${keys.map(k=>`<span><i class="dot" style="background:${colors[k]}"></i>${esc(k==='Depósitos a prazo'?'Poupanças (DP e Cash)':k)}</span>`).join('')}</div>`}
function attachChart(id,items,keys){let root=document.getElementById(id);if(!root||!items.length)return;let rect=root.querySelector('[data-chart]'),tip=root.querySelector('.tooltip'),cursor=document.getElementById(id+'-cursor');if(!rect)return;let svg=root.querySelector('svg');const move=e=>{let box=svg.getBoundingClientRect(),fx=Math.max(0,Math.min(1,(e.clientX-box.left)/box.width)),plotLeft=145,plotWidth=710,idx=Math.max(0,Math.min(items.length-1,Math.round((fx*1000-plotLeft)/plotWidth*(items.length-1))));let d=items[idx],cx=plotLeft+plotWidth*(items.length===1?.5:idx/(items.length-1));cursor.setAttribute('x1',cx);cursor.setAttribute('x2',cx);cursor.style.display='block';tip.style.display='block';tip.innerHTML=`<b>${esc(d.date)}</b>${keys.map(k=>`<div style="color:${colors[k]}">${esc(k)}: ${money(d[k])}</div>`).join('')}`;let targetX=cx/1000*box.width,tipWidth=Math.min(tip.offsetWidth,box.width-12);tip.style.left=Math.max(6,Math.min(box.width-tipWidth-6,targetX-tipWidth/2))+'px';tip.style.top='8px'};rect.addEventListener('pointermove',move);rect.addEventListener('pointerdown',move);rect.addEventListener('pointerleave',()=>{tip.style.display='none';cursor.style.display='none'})}

function historyTable(s,keys){
 const visible=s.slice().reverse().slice(0,60);
 return table(['Data',...keys.map(k=>esc(k==='Depósitos a prazo'?'Poupanças (DP e Cash)':k)),'Total','Variação global desde anterior'],visible.map(d=>{
  const idx=s.indexOf(d),prev=idx>0?s[idx-1]:null;
  const total=categories.reduce((acc,c)=>acc+num(d[c]),0);
  const previousTotal=prev?categories.reduce((acc,c)=>acc+num(prev[c]),0):null;
  return `<tr><td>${esc(d.date)}</td>${keys.map(k=>`<td>${money(d[k])}</td>`).join('')}<td><b>${money(total)}</b></td><td class="${sign(total-(previousTotal??total))}">${prev?money(total-previousTotal):'—'}</td></tr>`;
 }));
}

function dataNotice(){
 const missing=[],warnings=[];
 for(const c of ['ETF','Ações','Criptomoedas'])for(const x of positions(c)){
  if(!x.hasPrice)missing.push(x.ticker);
  warnings.push(...x.warning.map(w=>x.ticker+': '+w));
 }
 const audit=reconciliation();
 const message=[];
 if(missing.length)message.push(missing.length+' posições sem preço atual; foi usado provisoriamente o custo de aquisição');
 if(warnings.length)message.push(warnings.length+' operações que necessitam de revisão');
 if(audit.issues.length)message.push(audit.issues.length+' alertas de consistência. Consulta a secção de auditoria abaixo.');
 return message.length?'<div class="notice">'+esc(message.join('. '))+'</div>':'';
}

function dashboard(){let t=totals(),a=allTotals(),gain=a.current-a.invested,s=filteredSeries(),selected=chartCategory==='Global'?categories:[chartCategory];let audit=reconciliation();let columns=categories.map(c=>{let x=t[c],g=x.current-x.invested,gn=x.net-x.invested;return `<tr><td>${esc(c==='Depósitos a prazo'?'Poupanças (DP e Cash)':c)}</td><td>${money(x.invested)}</td><td>${money(x.current)}</td><td class="${sign(g)}">${money(g)}</td><td>${money(x.net)}</td><td class="${sign(gn)}">${money(gn)}</td><td class="${sign(gn)}">${pct(x.invested?gn/x.invested*100:0)}</td><td>${pct(a.net?x.net/a.net*100:0)}</td></tr>`});columns.push(`<tr class="totalrow"><td>TOTAL</td><td>${money(a.invested)}</td><td>${money(a.current)}</td><td class="${sign(gain)}">${money(gain)}</td><td>${money(a.net)}</td><td class="${sign(a.net-a.invested)}">${money(a.net-a.invested)}</td><td>${pct(a.invested?(a.net-a.invested)/a.invested*100:0)}</td><td>${pct(a.net?100:0)}</td></tr>`);return `<h2>Dashboard</h2>${dataNotice()}<div class="cards">${card('Capital investido',money(a.invested))}${card('Valor atual (bruto)',money(a.current))}${card('Valor atual líquido ',money(a.net))}${card('Ganho / perda bruta',money(gain),sign(gain))}${card('Ganho / perda líquida ',money(a.net-a.invested),sign(a.net-a.invested))}${card('Rentabilidade líquida',pct(a.invested?(a.net-a.invested)/a.invested*100:0),sign(a.net-a.invested))}</div><section class="panel"><h3>Resumo por categoria</h3>${table(['Categoria','Capital investido','Valor atual (bruto)','Ganho / perda bruta','Valor líquido ','Ganho líquido ','Rentabilidade líquida','Peso no valor líquido'],columns)}<div class="muted-note">${audit.ok?'✓ Totais conciliados com as posições e o histórico de operações.':'⚠ Divergências detetadas: '+esc(audit.issues.join(' | '))}</div></section><section class="panel"><div class="chart-title"><h3>Evolução do património</h3><div class="filters"><label>Período <select id="period">${['1A','3A','5A','Tudo'].map(p=>`<option ${p===period?'selected':''}>${p}</option>`).join('')}</select></label></div></div>${chartSvg('globalchart',s,['Global'])}<div class="muted-note">Evolução reconstruída a partir das operações, subscrições e saldos guardados. Datas anteriores usam os preços atuais disponíveis; não são cotações históricas. O PPR e o numerário sem histórico datado só entram no ponto Atual.</div></section><section class="panel"><div class="chart-title"><h3>Evolução por categoria</h3><div class="filters"><label>Categoria <select id="catfilter">${['Global',...categories].map(c=>`<option value="${esc(c)}" ${c===chartCategory?'selected':''}>${esc(c==='Depósitos a prazo'?'Poupanças (DP e Cash)':c)}</option>`).join('')}</select></label></div></div>${chartSvg('catchart',s,selected)}<div class="muted-note">Os gráficos mostram os saldos históricos registados e, no último ponto («Atual»), o património calculado pelas abas. A variação entre saldos pode incluir reforços e movimentos de mercado; não corresponde necessariamente à rentabilidade.</div></section><section class="panel"><h3>Detalhe dos registos históricos</h3><div class="muted-note">Histórico de saldos por data e categoria, incluindo variações entre registos. A linha «Atual» é calculada diretamente a partir das abas, não é um registo mensal guardado.</div>${historyTable(s,categories)}</section>`} 
function operationForm(cat){return `<section class="panel"><h3>Nova operação · ${esc(cat)}</h3><form id="opform"><label>Data<input name="date" type="date" required value="${new Date().toISOString().slice(0,10)}"></label><label>Operação<select name="side"><option>Compra</option><option>Venda</option></select></label><label>Ativo / ticker<input name="ticker" required placeholder="Ex.: ${cat==='Ações'?'AAPL':cat==='Criptomoedas'?'BTC':'VWCE.DE'}"></label><label>Corretora<input name="broker" required value="XTB"></label><label>Quantidade<input name="qty" type="number" step="any" min="0.00000001" required></label><label>Moeda<select name="currency" id="opcurrency">${supportedCurrencies.map(c=>`<option value="${c}">${c}</option>`).join('')}</select></label><label>Preço unitário (na moeda indicada)<input name="price" type="number" step="any" min="0" required></label><label>Câmbio na data (1 unidade da moeda = EUR)<input name="fxAtTrade" id="opfx" type="number" step="any" min="0.000000001" value="1" required></label><label>Comissão (EUR)<input name="fees" type="number" step="any" min="0" value="0"></label><button class="primary">Guardar operação</button></form></section>`}
function assets(cat){
 const book=ledger(cat),p=visiblePositions(cat),ops=state.operations.map((o,i)=>({...o,_source:i})).filter(o=>o.category===cat);
 const shownOps=selectedAsset?ops.filter(o=>o.ticker===selectedAsset.ticker&&(cat==='Criptomoedas'||o.broker===selectedAsset.broker)):ops;
 const cost=p.reduce((n,x)=>n+x.cost,0),current=p.reduce((n,x)=>n+x.current,0),net=p.reduce((n,x)=>n+x.net,0);
 const shownEntries=shownOps.map(o=>book.entries.get(o._source)).filter(Boolean);
 const openCost=shownEntries.reduce((s,e)=>s+e.remainingCost,0);
 const openCurrent=shownEntries.reduce((s,e)=>s+e.remainingCurrent,0);
 const openNet=shownEntries.reduce((s,e)=>s+e.remainingNet,0);
 const buys=shownEntries.filter(e=>e.valid&&e.side==='Compra').reduce((s,e)=>s+e.operationValue+e.fees,0);
 const soldCost=shownEntries.filter(e=>e.valid&&e.side==='Venda').reduce((s,e)=>s+e.basisSold,0);
 const isFiltered=!!selectedAsset;
 const expectedCost=isFiltered?p.filter(x=>x.ticker===selectedAsset.ticker&&(cat==='Criptomoedas'||x.broker===selectedAsset.broker)).reduce((s,x)=>s+x.cost,0):cost;
 const expectedCurrent=isFiltered?p.filter(x=>x.ticker===selectedAsset.ticker&&(cat==='Criptomoedas'||x.broker===selectedAsset.broker)).reduce((s,x)=>s+x.current,0):current;
 const expectedNet=isFiltered?p.filter(x=>x.ticker===selectedAsset.ticker&&(cat==='Criptomoedas'||x.broker===selectedAsset.broker)).reduce((s,x)=>s+x.net,0):net;
 const verified=Math.abs(openCost-expectedCost)<0.005&&Math.abs(openCurrent-expectedCurrent)<0.005&&Math.abs(openNet-expectedNet)<0.005&&Math.abs(openCost-(buys-soldCost))<0.005;
 const positionsRows=p.map(x=>`<tr class="asset-row ${selectedAsset?.ticker===x.ticker&&(cat==='Criptomoedas'||selectedAsset?.broker===x.broker)?'selected':''}" data-asset="${encodeURIComponent(JSON.stringify({ticker:x.ticker,broker:x.broker}))}" tabindex="0" role="button"><td>${esc(x.ticker)}</td><td>${esc(x.broker)}</td><td>${fmt(x.qty)}</td><td>${moneyUnit(x.qty?x.cost/x.qty:0)}</td><td>${moneyDetail(x.cost)}</td><td>${x.hasPrice?moneyUnit(x.last):quoteCurrency(x.ticker)!=='EUR'?'Câmbio indisponível':'Sem cotação'}</td><td>${moneyDetail(x.current)}</td><td>${moneyDetail(x.net)}</td><td class="${sign(x.gain)}">${moneyDetail(x.gain)}</td><td class="${sign(x.netGain)}">${moneyDetail(x.netGain)}</td><td>${pct(x.cost?x.gain/x.cost*100:0)}</td><td><button data-price="${encodeURIComponent(x.ticker)}">Editar preço</button></td></tr>`);
 positionsRows.push(`<tr class="totalrow"><td>TOTAL</td><td></td><td>${fmt(p.reduce((s,x)=>s+x.qty,0))}</td><td>—</td><td>${money(cost)}</td><td>—</td><td>${money(current)}</td><td>${money(net)}</td><td>${money(current-cost)}</td><td>${money(net-cost)}</td><td>${pct(cost?(current-cost)/cost*100:0)}</td><td></td></tr>`);
 const historyRows=shownOps.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(o=>{
  const e=book.entries.get(o._source),buy=o.side==='Compra';
  const q=num(o.qty),v=q*num(o.price),c=currencyOf(o),fx=fxTrade(o);
  const quote=quoteInfo(o.ticker,num(state.prices?.[o.ticker]));
  const currentPrice=Object.prototype.hasOwnProperty.call(state.prices||{},o.ticker)&&Number.isFinite(quote.value)?quote.value:(e?.remainingQty?e.remainingCurrent/e.remainingQty:0);
  // A avaliação numa linha de compra refere-se apenas às unidades que ainda existem.
  const openValue=buy?e?.remainingCurrent||0:0;
  const gain=buy?e?.remainingGrossGain||0:0;
  const netGain=buy?e?.remainingNetGain||0:0;
  return `<tr><td>${esc(o.date)}</td><td>${esc(o.ticker)}</td><td>${esc(o.broker)}</td><td>${esc(o.side)}</td><td>${esc(c)}</td><td>${fmt(q)}</td><td>${fmt(o.price)} ${esc(c)}</td><td>${moneyDetail(v*fx)}</td><td>${moneyDetail(o.fees)}</td><td>${buy&&e?.remainingQty>0&&Number.isFinite(quote.value)?`${moneyUnit(currentPrice)}${quote.currency!=='EUR'?` <small>(${esc(quote.currency)} ${esc(quote.updated||'sem taxa')}${quote.stale?', não atualizado':''})</small>`:''}`:buy&&e?.remainingQty>0?moneyUnit(currentPrice):'—'}</td><td>${buy?moneyDetail(openValue):'—'}</td><td class="${sign(gain)}">${buy?moneyDetail(gain):'—'}</td><td class="${sign(netGain)}">${buy?moneyDetail(netGain):'—'}</td><td><button data-edit="${encodeURIComponent(o.id)}">Editar</button> <button class="danger" data-delete="${encodeURIComponent(o.id)}">Eliminar</button></td></tr>`;
 });
 // A linha TOTAL soma apenas os valores apresentados nas linhas visíveis (respeita o filtro por ativo).
 // Valor da operação inclui compras e vendas como montantes positivos; não representa o capital investido.
 const historyOperationTotal=shownOps.reduce((s,o)=>s+num(o.qty)*num(o.price)*fxTrade(o),0);
 const historyCurrentTotal=shownOps.reduce((s,o)=>s+(o.side==='Compra'?(book.entries.get(o._source)?.remainingCurrent||0):0),0);
 const historyGrossTotal=shownOps.reduce((s,o)=>s+(o.side==='Compra'?(book.entries.get(o._source)?.remainingGrossGain||0):0),0);
 const historyNetTotal=shownOps.reduce((s,o)=>s+(o.side==='Compra'?(book.entries.get(o._source)?.remainingNetGain||0):0),0);
 historyRows.push(`<tr class="totalrow"><td><strong>TOTAL</strong></td><td colspan="6"></td><td>${money(historyOperationTotal)}</td><td>—</td><td>—</td><td>${money(historyCurrentTotal)}</td><td class="${sign(historyGrossTotal)}">${money(historyGrossTotal)}</td><td class="${sign(historyNetTotal)}">${money(historyNetTotal)}</td><td></td></tr>`);
 // As compras e vendas históricas têm outros significados contabilísticos. Não somar avaliações de vendas.

 const errorRows=book.errors.length?`<div class="notice">${esc(book.errors.join(' | '))}. Estas operações não foram incluídas nos cálculos; corrige ou elimina as linhas inválidas.</div>`:'';
 return `<h2>${esc(cat)}</h2>${operationForm(cat)}${cat==='Criptomoedas'?cryptoPanel():marketPanel(cat)}<div class="cards" style="margin-top:17px">${card('Posições abertas',p.length)}${card('Capital investido',money(cost))}${card('Valor atual bruto',money(current))}${card('Valor atual líquido',money(net))}${card('Ganho não realizado bruto',money(current-cost),sign(current-cost))}${card('Ganho não realizado líquido',money(net-cost),sign(net-cost))}</div>${errorRows}
 <section class="panel"><h3>Resumo das posições por ativo</h3><div class="muted-note">Clica numa posição para filtrar o histórico do ativo. Os preços e comissões são tratados em EUR. O ganho líquido considera apenas as posições abertas.</div>${table(['Ativo','Corretora','Quantidade','Preço médio (€)','Capital investido','Último preço (€)','Valor atual bruto','Valor atual líquido','Ganho bruto','Ganho líquido','Rentabilidade',''],positionsRows)}</section>
 <section class="panel"><h3>Histórico detalhado de operações ${selectedAsset?`— ${esc(selectedAsset.ticker)} ${cat==='Criptomoedas'?'':`(${esc(selectedAsset.broker)})`}`:''}</h3>${selectedAsset?'<button id="clearasset" class="primary" style="margin-bottom:12px">Mostrar todas as operações</button>':''}<div class="muted-note">O valor da operação corresponde à transação na data, convertido para EUR pelo câmbio histórico registado. O valor atual e os ganhos numa linha de compra referem-se às unidades ainda em carteira; vendas não são valorizadas novamente. As comissões são em EUR. Para operações antigas, a moeda assumida é EUR.</div>${currencyNotice()}
 <div class="cards" style="margin-top:12px">${card('Compras incluindo comissões',money(buys))}${card('Custo de posições vendidas',money(soldCost))}${card('Capital em carteira',money(openCost))}${card('Valor atual em carteira',money(openCurrent))}</div>
 <div class="muted-note" style="margin:14px 0;color:${verified?'#64e1b3':'#ff8d99'}">${verified?'✓ Reconciliação OK: compras − custo vendido = capital em carteira; histórico = resumo de posições = Dashboard.':'⚠ Diferença na reconciliação: verifica operações inválidas ou incompletas.'}</div>
 ${table(['Data','Ativo','Corretora','Operação','Moeda','Quantidade','Preço unitário','Valor da operação (€)','Comissões (€)','Preço atual (€)','Valor atual (€)','Ganho bruto (€)','Ganho líquido (€)','Ações'],historyRows)}</section>`;

}

function dividends(){const months=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];let annual=state.dividends.filter(d=>months.includes(d.month));let years=[...new Set([...annual.map(d=>num(d.year)),2026])].sort((a,b)=>b-a);if(!years.includes(divYear))divYear=years[0];let records=annual.filter(d=>num(d.year)===divYear),byMonth=months.map(month=>({month,amount:records.filter(d=>d.month===month).reduce((s,x)=>s+num(x.amount),0),entries:records.filter(d=>d.month===month).length})),yearTotal=byMonth.reduce((s,x)=>s+x.amount,0),grand=annual.reduce((s,x)=>s+num(x.amount),0);let tableRows=byMonth.map((m,i)=>`<tr><td>${esc(m.month)}</td><td>${money(m.amount)}</td><td>${m.entries}</td><td>${records.filter(d=>d.month===m.month).map(d=>`<button class="danger" data-divdel="${state.dividends.indexOf(d)}">Eliminar</button>`).join(' ')}</td></tr>`);tableRows.push(`<tr class="totalrow"><td>Total de ${divYear}</td><td>${money(yearTotal)}</td><td>${records.length}</td><td></td></tr>`);return `<h2>Dividendos</h2><section class="panel"><h3>Registar dividendo</h3><form id="divform"><label>Ano<input name="year" type="number" min="2000" max="2100" value="${divYear}" required></label><label>Mês<select name="month">${months.map(m=>`<option>${m}</option>`).join('')}</select></label><label>Valor recebido (€)<input name="amount" type="number" step="any" required></label><button class="primary">Guardar</button></form></section><section class="panel"><div class="chart-title"><h3>Dividendos recebidos — ${divYear}</h3><div class="filters"><label>Consultar ano <select id="divyear">${years.map(y=>`<option value="${y}" ${y===divYear?'selected':''}>${y}</option>`).join('')}</select></label></div></div><div class="cards" style="margin:12px 0">${card('Dividendos do ano',money(yearTotal))}${card('Média por mês do ano',money(yearTotal/12))}${card('Total histórico (meses reais)',money(grand))}</div><div class="divbars">${byMonth.map(m=>`<div class="divbaritem" title="${esc(m.month)}: ${money(m.amount)}"><div class="divbar" style="height:${Math.max(2,m.amount/Math.max(1,...byMonth.map(x=>x.amount))*145)}px"></div><small>${esc(m.month.slice(0,3))}</small></div>`).join('')}</div>${table(['Mês','Valor recebido','Registos',''],tableRows)}<section class="panel"><h3>Dividendos recebidos por ano</h3><div class="annualbars">${years.slice().sort((a,b)=>a-b).map(y=>{let val=annual.filter(d=>num(d.year)===y).reduce((a,d)=>a+num(d.amount),0);let max=Math.max(1,...years.map(yy=>annual.filter(d=>num(d.year)===yy).reduce((a,d)=>a+num(d.amount),0)));return `<button class="annualbar" data-yearpick="${y}" title="${y}: ${money(val)}"><span>${money(val)}</span><i style="height:${Math.max(4,val/max*155)}px"></i><b>${y}</b></button>`}).join('')}</div><div class="muted-note">Seleciona um ano na barra para consultar os 12 meses. Os totais são calculados apenas a partir dos dividendos mensais.</div></section><div class="muted-note">Total e média são calculados a partir dos 12 meses e não são somados novamente. Meses sem registo são apresentados com zero.</div></section>`}
function savings(){
 return `<h2>Poupanças</h2><div class="cards">${card('Depósitos a prazo',money(depositsValue()))}${card('Numerário (Cash)',money(state.cashAmount))}${card('Poupanças (DP e Cash)',money(savingsValue()))}</div><section class="panel"><h3>Atualizar numerário</h3><form id="cashform"><label>Numerário disponível (€)<input type="number" name="cashAmount" min="0" step="0.01" required value="${num(state.cashAmount)}"></label><button class="primary" type="submit">Guardar numerário</button></form><div class="muted-note">Introduz o saldo total em numerário, não um movimento adicional. O Dashboard soma este valor ao último saldo dos depósitos a prazo. O histórico abaixo representa apenas depósitos, sem incluir numerário nas datas passadas.</div></section>${savingsHistoryPanel('Depósitos a prazo')}<div class="muted-note">Os antigos registos auxiliares de contas continuam guardados na cópia JSON, mas não são somados novamente ao património.</div>`;
}

function certificates(){let a=state.certificates||[],invested=sum(a,'invested'),current=sum(a,'current'),gain=current-invested;return `<h2>Certificados de Aforro</h2><div class="cards">${card('Capital subscrito',money(invested))}${card('Valor atual líquido',money(current))}${card('Variação líquida',money(gain),sign(gain))}${card('Rentabilidade líquida',pct(invested?gain/invested*100:0),sign(gain))}</div><section class="panel"><h3>Adicionar subscrição</h3><form id="caform"><label>Data de subscrição<input name="date" type="date" required></label><label>Unidades<input name="units" type="number" step="0.000001" min="0.000001" required></label><label>Valor unitário (€)<input name="unitPrice" type="number" step="any" min="0" value="1" required></label><label>Valor atual líquido (€)<input name="current" type="number" step="0.01" min="0" required></label><button class="primary">Adicionar</button></form><div class="muted-note">Atualiza o valor individual de cada subscrição na tabela abaixo. Os valores indicados já são líquidos de imposto; não é aplicada qualquer dedução adicional.</div></section>${editingCaId?(()=>{const e=a.find(x=>String(x.id)===String(editingCaId));return e?`<section class="panel" id="ca-edit-panel"><h3>Editar subscrição</h3><form id="caeditform"><input type="hidden" name="id" value="${esc(e.id)}"><label>Data de subscrição<input type="date" name="date" required value="${esc(e.date)}"></label><label>Unidades<input name="units" type="number" step="any" min="0.000000001" required value="${num(e.units)}"></label><label>Valor unitário (€)<input name="unitPrice" type="number" step="any" min="0" required value="${num(e.unitPrice)}"></label><label>Total subscrito (€)<input name="invested" type="number" step="0.01" min="0" required value="${num(e.invested)}"></label><label>Valor atual = valor líquido (€)<input name="current" type="number" step="0.01" min="0" required value="${num(e.current)}"></label><button class="primary" type="submit">Guardar alterações</button><button type="button" id="cacancel">Cancelar</button></form><div class="muted-note">Ao alterar apenas unidades ou preço unitário, o total é recalculado. Se editares o total subscrito, esse valor prevalece e o valor unitário é ajustado. As variações são sempre calculadas automaticamente.</div></section>`:''})():''}<section class="panel"><h3>Subscrições</h3>${table(['Data de subscrição','Unidades','Valor unitário','Total subscrito','Valor atual','Variação líquida','Variação %','Valor líquido','Ações'],a.slice().sort((x,y)=>x.date.localeCompare(y.date)).map(x=>{let g=num(x.current)-num(x.invested);return `<tr><td>${esc(x.date)}</td><td>${fmt(x.units)}</td><td>${money(x.unitPrice)}</td><td>${money(x.invested)}</td><td>${money(x.current)}</td><td class="${sign(g)}">${money(g)}</td><td class="${sign(g)}">${pct(x.invested?100*g/x.invested:0)}</td><td>${money(x.current)}</td><td><div class="actions"><button data-caedit="${esc(x.id)}">Editar</button><button class="danger" data-cadel="${esc(x.id)}">Eliminar</button></div></td></tr>`})).replace('</tbody>',`<tr class="totalrow"><td>TOTAL</td><td>${fmt(sum(a,'units'))}</td><td>—</td><td>${money(invested)}</td><td>${money(current)}</td><td>${money(gain)}</td><td>${pct(invested?gain/invested*100:0)}</td><td>${money(current)}</td><td></td></tr></tbody>`)}</section><section class="panel"><h3>Evolução por subscrição</h3>${chartSvg('cahistory',certificateSeries(),['Certificados de Aforro'])}<div class="muted-note">Gráfico reconstruído a partir da tabela de subscrições. Cada marco inclui as subscrições existentes nessa data, valorizadas aos valores atualmente introduzidos. Não representa o valor de mercado que tinham nessa data.</div></section>`}

function ppr(){
 const invested=sum(state.ppr,'invested'),current=sum(state.ppr,'current'),gain=current-invested;
 const rows=state.ppr.map((x,i)=>{const g=num(x.current)-num(x.invested);return `<tr><td>${esc(x.name)}</td><td>${money(x.invested)}</td><td>${money(x.current)}</td><td class="${sign(g)}">${money(g)}</td><td>${pct(num(x.invested)?g/num(x.invested)*100:0)}</td><td><button class="danger" data-pprdel="${i}">Eliminar</button></td></tr>`});
 rows.push(`<tr class="totalrow"><td>TOTAL</td><td>${money(invested)}</td><td>${money(current)}</td><td>${money(gain)}</td><td>${pct(invested?gain/invested*100:0)}</td><td></td></tr>`);
 return `<h2>PPR</h2><section class="panel"><h3>Adicionar PPR</h3><form id="pprform"><label>Nome<input name="name" required></label><label>Capital investido (€)<input name="invested" type="number" min="0" step="any" required></label><label>Valor atual (€)<input name="current" type="number" min="0" step="any" required></label><button class="primary">Guardar</button></form></section><section class="panel"><h3>Posições PPR</h3>${table(['Nome','Investido','Valor atual','Ganho','Rentabilidade',''],rows)}</section>`;
}

function download(name,body,type){let u=URL.createObjectURL(new Blob([body],{type})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),3000)}
const cols=['date','category','broker','ticker','side','qty','price','fees','currency','fxAtTrade'];const requiredCols=['date','category','broker','ticker','side','qty','price','fees'];
function csvCell(v){let s=String(v??'');return /[;"\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s}
function io(){return `<h2>Importar/exportar</h2><div class="notice">A cópia JSON guarda toda a carteira. O CSV importa operações; não importa automaticamente ficheiros XLSX da XTB. Os preços e gráficos não são dados de mercado em tempo real.</div><section class="panel"><h3>Exportar</h3><div class="actions"><button class="primary" id="exportjson">Exportar JSON completo</button><button id="exportcsv">Exportar operações CSV</button><button id="template">Modelo CSV</button></div></section><section class="panel"><h3>Importar</h3><input id="upload" type="file" accept=".json,.csv"><div class="actions"><button class="primary" id="import">Importar ficheiro</button><button class="danger" id="reset">Repor dados originais</button></div></section>`}
function parseCSV(s){let lines=s.replace(/^\uFEFF/,'').trim().split(/\r?\n/);let sep=lines[0].includes(';')?';':',';function parseLine(line){let a=[],v='',quoted=false;for(let i=0;i<line.length;i++){let c=line[i];if(c==='"'){if(quoted&&line[i+1]==='"'){v+='"';i++}else quoted=!quoted}else if(c===sep&&!quoted){a.push(v);v=''}else v+=c}a.push(v);return a}let headers=parseLine(lines.shift()).map(x=>x.trim().toLowerCase());if(!requiredCols.every(x=>headers.includes(x)))throw Error('Cabeçalhos em falta: '+cols.join(';'));return lines.filter(x=>x.trim()).map((line,i)=>{let fields=parseLine(line),o={};headers.forEach((h,j)=>o[h]=fields[j]||'');for(let k of ['qty','price','fees'])o[k]=num(o[k]);o.currency=(o.currency||'EUR').trim().toUpperCase();o.fxAtTrade=o.currency==='EUR'?1:Number(String(o.fxAtTrade||'').replace(',','.'));if(!/^\d{4}-\d{2}-\d{2}$/.test(o.date)||!o.ticker||!['Compra','Venda'].includes(o.side)||!['ETF','Ações','Criptomoedas'].includes(o.category)||o.qty<=0||o.price<0||o.fees<0||!supportedCurrencies.includes(o.currency)||!Number.isFinite(o.fxAtTrade)||o.fxAtTrade<=0)throw Error('Linha '+(i+2)+' inválida');return {...o,id:uid(),last:0,total:o.qty*o.price}})}
async function importFile(){let f=document.getElementById('upload').files[0];if(!f)return alert('Seleciona um ficheiro.');try{let txt=await f.text();if(f.name.toLowerCase().endsWith('.json')){let data=JSON.parse(txt);if(!Array.isArray(data.operations)||!Array.isArray(data.summary)||!Array.isArray(data.dividends)||!Array.isArray(data.savings)||!Array.isArray(data.ppr))throw Error('JSON incompatível');if(!confirm('Substituir todos os dados pela cópia JSON?'))return;state={...structuredClone(INITIAL),...data};if(!Number.isFinite(Number(state.cashAmount))||Number(state.cashAmount)<0)state.cashAmount=0;if(!Array.isArray(state.certificates))state.certificates=structuredClone(INITIAL.certificates);if(!Number.isFinite(Number(state.cashAmount))||Number(state.cashAmount)<0)state.cashAmount=0;if(!Array.isArray(state.cashflows))state.cashflows=[]}else if(f.name.toLowerCase().endsWith('.csv')){
 let incoming=parseCSV(txt),keys=new Set(state.operations.map(o=>cols.map(k=>o[k]).join('|'))),added=0;
 const backup=state.operations.slice();
 const priorErrors=Object.fromEntries(['ETF','Ações','Criptomoedas'].map(c=>[c,ledger(c).errors.length]));
 for(let o of incoming){let k=cols.map(c=>o[c]).join('|');if(!keys.has(k)){state.operations.push(o);keys.add(k);added++}}
 if(['ETF','Ações','Criptomoedas'].some(c=>ledger(c).errors.length>priorErrors[c])){
   state.operations=backup;throw Error('CSV contém vendas incompatíveis com as posições. Nenhuma operação foi importada.');
 }
 alert(added+' operações importadas. '+(incoming.length-added)+' duplicados ignorados.');
}else throw Error('Apenas .json ou .csv');save();render()}catch(e){alert('Erro: '+e.message)}}
function bind(){
 const marketButton=document.getElementById('market-refresh');if(marketButton)marketButton.onclick=()=>updateMarketQuotes(tab,true);
 const marketAuto=document.getElementById('market-auto');if(marketAuto)marketAuto.onchange=e=>{state.autoMarketQuotes=e.target.checked;save();render();if(state.autoMarketQuotes)updateMarketQuotes(tab,false)};
 for(const b of document.querySelectorAll('[data-market-map]'))b.onclick=()=>{
  const a=JSON.parse(decodeURIComponent(b.dataset.marketMap)),old=state.marketMappings[a.cat+'|'+a.ticker]||{};
  const symbol=prompt('Símbolo exato no Twelve Data para '+a.ticker+' (ex.: AAPL ou VWCE):',old.symbol||'');
  if(symbol===null)return;const normalized=symbol.trim().toUpperCase();
  if(normalized&&!/^[A-Z0-9_.:\\/-]{1,35}$/.test(normalized))return alert('Símbolo inválido');
  if(!normalized){delete state.marketMappings[a.cat+'|'+a.ticker];save();render();return}
  const exchange=prompt('Bolsa do ativo (ex.: NASDAQ ou XETR). Deixa vazio somente se o símbolo for inequívoco:',old.exchange||'');
  if(exchange===null)return;
  if(exchange.trim()&&!/^[a-zA-Z0-9 _.-]{1,40}$/.test(exchange.trim()))return alert('Bolsa inválida');
  state.marketMappings[a.cat+'|'+a.ticker]={symbol:normalized,exchange:exchange.trim()};
  save();render();
 };
 const cryptoRefresh=document.getElementById('update-crypto');if(cryptoRefresh)cryptoRefresh.onclick=()=>updateCrypto(true);const auto=document.getElementById('auto-crypto');if(auto)auto.onchange=e=>{state.autoCryptoQuotes=e.target.checked;save();render();if(state.autoCryptoQuotes)updateCrypto(false)};let refresh=document.getElementById('refresh-fx');if(refresh)refresh.onclick=()=>refreshFx(true);let cur=document.getElementById('opcurrency');if(cur)cur.onchange=()=>{let fx=document.getElementById('opfx');if(fx){fx.value=cur.value==='EUR'?'1':state.fxRates?.[cur.value]?.eurPerUnit||'';fx.readOnly=cur.value==='EUR';}};for(const row of document.querySelectorAll('[data-asset]')){let select=()=>{let a=JSON.parse(decodeURIComponent(row.dataset.asset));selectedAsset=selectedAsset?.ticker===a.ticker&&(tab==='Criptomoedas'||selectedAsset?.broker===a.broker)?null:a;render()};row.addEventListener('click',e=>{if(e.target.closest('button'))return;select()});row.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select()}})}let clear=document.getElementById('clearasset');if(clear)clear.onclick=()=>{selectedAsset=null;render()};const form=(id,fn)=>{let f=document.getElementById(id);if(f)f.onsubmit=e=>{e.preventDefault();try{fn(Object.fromEntries(new FormData(f)));save();render()}catch(err){alert(err.message)}}};form('opform',o=>{let qty=num(o.qty),price=num(o.price),fees=num(o.fees);if(qty<=0||price<0||fees<0||!Number.isFinite(Number(o.fxAtTrade))||Number(o.fxAtTrade)<=0)throw Error('Valores inválidos');if(o.currency==='EUR')o.fxAtTrade=1;let ticker=o.ticker.trim().toUpperCase();if(o.side==='Venda'){let available=positions(tab).filter(x=>x.ticker===ticker&&x.broker===o.broker).reduce((s,x)=>s+x.qty,0);if(qty>available+1e-8)throw Error('Venda superior à quantidade disponível')}const fresh={...o,category:tab,ticker,qty,price,fees,id:uid(),last:(quoteInfo(ticker,num(state.prices?.[ticker])).value||0),total:qty*price};state.operations.push(fresh);if(ledger(tab).errors.length){state.operations.pop();throw Error('Operação incompatível com as quantidades existentes na respetiva data. Verifica a ordem cronológica e as vendas anteriores.')}});form('divform',o=>state.dividends.push({...o,year:num(o.year),amount:num(o.amount)}));form('saveform',o=>state.savings.push({...o,invested:num(o.invested),current:num(o.current)}));form('pprform',o=>state.ppr.push({...o,invested:num(o.invested),current:num(o.current)}));form('caform',o=>{let units=Number(o.units),unitPrice=Number(o.unitPrice),current=Number(o.current);if(!Number.isFinite(units)||units<=0||!Number.isFinite(unitPrice)||unitPrice<0||!Number.isFinite(current)||current<0)throw Error('Valores inválidos');state.certificates.push({id:uid(),date:o.date,units,unitPrice,invested:units*unitPrice,current,source:'Manual'})});form('snapform',o=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(o.date))throw Error('Data inválida');let val=Number(o.amount);if(!Number.isFinite(val)||val<0)throw Error('Saldo inválido');let original=state.history.find(h=>h.date===o.date&&!h.manual);if(original&&!confirm('Já existe um registo histórico para este dia. Substituir o saldo desta categoria?'))return;let h=state.history.find(h=>h.date===o.date&&h.manual);if(!h){h={date:o.date,manual:true};state.history.push(h)}h[o.cat]=val});
form('cashform',o=>{const v=Number(o.cashAmount);if(!Number.isFinite(v)||v<0)throw Error('Numerário inválido');state.cashAmount=v});
form('caeditform',o=>{const row=state.certificates.find(x=>String(x.id)===String(o.id));if(!row)throw Error('Subscrição inexistente');const units=Number(o.units),unitPrice=Number(o.unitPrice),invested=Number(o.invested),current=Number(o.current);if(!/^\d{4}-\d{2}-\d{2}$/.test(o.date)||![units,unitPrice,invested,current].every(Number.isFinite)||units<=0||unitPrice<0||invested<0||current<0)throw Error('Dados da subscrição inválidos');const totalChanged=Math.abs(invested-num(row.invested))>0.005;const finalTotal=totalChanged?invested:units*unitPrice;row.date=o.date;row.units=units;row.invested=finalTotal;row.unitPrice=totalChanged?finalTotal/units:unitPrice;row.current=current;editingCaId=null;});
const cancelCa=document.getElementById('cacancel');if(cancelCa)cancelCa.onclick=()=>{editingCaId=null;render()};
for(let b of document.querySelectorAll('[data-caedit]'))b.onclick=()=>{editingCaId=b.dataset.caedit;render();document.getElementById('ca-edit-panel')?.scrollIntoView({block:'nearest',behavior:'smooth'})};
for(let b of document.querySelectorAll('[data-cadel]'))b.onclick=()=>{if(!confirm('Eliminar esta subscrição?'))return;state.certificates=state.certificates.filter(x=>x.id!==b.dataset.cadel);save();render()};for(let b of document.querySelectorAll('[data-histdel]'))b.onclick=()=>{let [date,cat]=decodeURIComponent(b.dataset.histdel).split('|');if(!confirm('Eliminar saldo mensal de '+date+'?'))return;let h=state.history.find(x=>x.date===date&&x.manual);if(h){delete h[cat];if(!categories.some(c=>h[c]!=null))state.history=state.history.filter(x=>x!==h);save();render()}};for(let b of document.querySelectorAll('[data-yearpick]'))b.onclick=()=>{divYear=Number(b.dataset.yearpick);render()};
for(let b of document.querySelectorAll('[data-edit]'))b.onclick=()=>{
 const id=decodeURIComponent(b.dataset.edit),idx=state.operations.findIndex(o=>o.id===id);if(idx<0)return;
 const prior=structuredClone(state.operations[idx]);
 const fields=[['date','Data (AAAA-MM-DD)'],['ticker','Ativo / ticker'],['broker','Corretora'],['side','Operação (Compra/Venda)'],['currency','Moeda (EUR, USD, GBP, ...)'],['qty','Quantidade'],['price','Preço unitário na moeda indicada'],['fxAtTrade','Câmbio histórico: 1 unidade = EUR'],['fees','Comissão (EUR)']];
 let updated={...prior};
 for(const [field,label] of fields){const old=field==='currency'?currencyOf(updated):field==='fxAtTrade'?(currencyOf(updated)==='EUR'?1:fxTrade(updated)):updated[field];const answer=prompt(label,String(old??''));if(answer===null)return;updated[field]=answer.trim();}
 updated.ticker=updated.ticker.toUpperCase();updated.currency=updated.currency.toUpperCase();
 for(const field of ['qty','price','fxAtTrade','fees'])updated[field]=Number(String(updated[field]).replace(',','.'));
 if(updated.currency==='EUR')updated.fxAtTrade=1;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(updated.date)||!updated.ticker||!updated.broker||!['Compra','Venda'].includes(updated.side)||!supportedCurrencies.includes(updated.currency)||![updated.qty,updated.price,updated.fxAtTrade,updated.fees].every(Number.isFinite)||updated.qty<=0||updated.price<0||updated.fxAtTrade<=0||updated.fees<0)return alert('Dados inválidos. Operação não alterada.');
 updated.total=updated.qty*updated.price;
 state.operations[idx]=updated;
 const issues=ledger(prior.category).errors;
 if(issues.length){state.operations[idx]=prior;return alert('Edição rejeitada: '+issues.join(' | '));}
 save();render();
};
for(let b of document.querySelectorAll('[data-delete]'))b.onclick=()=>{
 if(!confirm('Eliminar esta operação?'))return;
 const id=decodeURIComponent(b.dataset.delete),old=state.operations;
 const target=old.find(o=>o.id===id);if(!target)return;
 const before=ledger(target.category).errors.length;
 state.operations=old.filter(o=>o.id!==id);
 const after=ledger(target.category).errors.length;
 if(after>before){state.operations=old;alert('Não é possível eliminar esta compra: existem vendas posteriores que dependem da quantidade adquirida. Corrige primeiro essas vendas.');return}
 save();render();
};
for(let b of document.querySelectorAll('[data-price]'))b.onclick=()=>{
 let t=decodeURIComponent(b.dataset.price),v=prompt('Preço atual de '+t+' (na moeda de cotação):',state.prices?.[t]??'');if(v===null)return;
 const c=prompt('Moeda do preço atual de '+t+' (EUR, USD, GBP, etc.):',quoteCurrency(t));if(c===null)return;
 const currency=c.trim().toUpperCase();const price=Number(v.replace(',','.'));
 if(!supportedCurrencies.includes(currency)||!Number.isFinite(price)||price<0)return alert('Preço ou moeda inválidos');
 state.prices=state.prices||{};state.priceCurrencies=state.priceCurrencies||{};
 state.prices[t]=price;state.priceCurrencies[t]=currency;save();render();refreshFx();updateCrypto(false);if(['ETF','Ações'].includes(tab))updateMarketQuotes(tab,false);
};

for(let [attr,array] of [['divdel','dividends'],['savdel','savings'],['pprdel','ppr']])for(let b of document.querySelectorAll('[data-'+attr+']'))b.onclick=()=>{if(confirm('Eliminar este registo?')){state[array].splice(Number(b.dataset[attr]),1);save();render()}};
if(tab==='Dividendos'){document.getElementById('divyear').onchange=e=>{divYear=Number(e.target.value);render()}}
if(tab==='Certificados de Aforro'){attachChart('cahistory',certificateSeries(),['Certificados de Aforro'])}if(tab==='Poupanças'){let cat='Depósitos a prazo';attachChart('savchart',recordedHistory().filter(h=>h[cat]!=null).map(h=>({date:h.date,[cat]:num(h[cat])})),[cat])}if(tab==='Dashboard'){document.getElementById('period').onchange=e=>{period=e.target.value;render()};document.getElementById('catfilter').onchange=e=>{chartCategory=e.target.value;render()};let s=filteredSeries();attachChart('globalchart',s,['Global']);attachChart('catchart',s,chartCategory==='Global'?categories:[chartCategory])}
if(tab==='Importar/exportar'){document.getElementById('exportjson').onclick=()=>download('myportefolio-v9-backup.json',JSON.stringify(state,null,2),'application/json');document.getElementById('exportcsv').onclick=()=>download('myportefolio-operacoes.csv',cols.join(';')+'\n'+state.operations.map(o=>cols.map(k=>csvCell(o[k])).join(';')).join('\n'),'text/csv;charset=utf-8');document.getElementById('template').onclick=()=>download('modelo-operacoes.csv',cols.join(';')+'\n2026-10-31;ETF;XTB;VWCE.DE;Compra;2;130.50;0;EUR;1','text/csv;charset=utf-8');document.getElementById('import').onclick=importFile;document.getElementById('reset').onclick=()=>{if(confirm('Apagar alterações locais e repor os dados iniciais?')){state=structuredClone(INITIAL);save();render()}}}}
function render(){nav();document.getElementById('app').innerHTML=tab==='Dashboard'?dashboard():['ETF','Ações','Criptomoedas'].includes(tab)?assets(tab):tab==='Dividendos'?dividends():tab==='Poupanças'?savings():tab==='Certificados de Aforro'?certificates():tab==='PPR'?ppr():io();bind()}render();refreshFx();updateCrypto(false);
