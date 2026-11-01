"use strict";
const conf=window.MYPORT_CONFIG||{},url=String(conf.supabaseUrl||'').replace(/\/$/,''),anon=String(conf.supabaseAnonKey||'');
const $=id=>document.getElementById(id);
const validConfig=/^https:\/\/[\w-]+\.supabase\.co$/.test(url)&&anon.length>30;
const STORE='myportefolio-v9-auth';let auth=null, revision=0, activeData=null, timer=null, saving=false, conflict=false, dirty=false, lastSynced='';
const scopedKey=uid=>'myportefolio-v9:'+uid;
function feedback(t){$('authFeedback').textContent=t}
function status(t,warning=false){$('status').textContent=t;$('status').style.color=warning?'#ffb4be':'#8adcbc'}
async function request(path,method='GET',body=null,access=null){
 const headers={'apikey':anon,'Content-Type':'application/json'};
 if(access)headers.Authorization='Bearer '+access;
 const r=await fetch(url+path,{method,headers,body:body===null?undefined:JSON.stringify(body)});
 const txt=await r.text();let data;try{data=txt?JSON.parse(txt):null}catch{data=txt}
 if(!r.ok)throw Error(data?.message||data?.msg||data?.error_description||data?.error||('HTTP '+r.status));return data;
}
function saveAuth(){sessionStorage.setItem(STORE,JSON.stringify(auth))}
async function refreshSession(){if(!auth?.refresh_token)throw Error('Sessão expirada');const d=await request('/auth/v1/token?grant_type=refresh_token','POST',{refresh_token:auth.refresh_token});auth={...auth,...d,user:d.user||auth.user};saveAuth();}
async function authorized(path,method,body){if(!auth)throw Error('Inicia sessão');if((auth.expires_at||0)<Date.now()/1000+90)await refreshSession();try{return await request(path,method,body,auth.access_token)}catch(e){if(/jwt expired|invalid jwt/i.test(e.message)){await refreshSession();return request(path,method,body,auth.access_token)}throw e}}
function emptyPortfolio(){return {operations:[],summary:[],dividends:[],savings:[],ppr:[],prices:{},meta:{},history:[],certificates:[],cashAmount:0,cashflows:[],fxRates:{},priceCurrencies:{}}}
async function begin(token){auth={...token,expires_at:token.expires_at||(Math.floor(Date.now()/1000)+(token.expires_in||3600))};saveAuth();const user=await authorized('/auth/v1/user','GET');auth.user=user;saveAuth();
 // Server is source of truth; do not silently import an older user's local assets.
 const rows=await authorized('/rest/v1/portfolios?select=data,revision&user_id=eq.'+encodeURIComponent(user.id));
 revision=rows?.[0]?.revision||0;activeData=rows?.[0]?.data||emptyPortfolio();dirty=false;conflict=false;lastSynced=JSON.stringify(activeData);
 localStorage.setItem(scopedKey(user.id),JSON.stringify(activeData));
 $('entry').classList.add('hidden');$('workspace').classList.remove('hidden');$('account').classList.remove('hidden');$('identity').textContent=user.email||'Conta';$('owner').textContent='Carteira privada · '+(user.email||'');
 $('portfolio').src='legacy/index.html?v=9.1.1&uid='+encodeURIComponent(user.id);status('Sincronizado');
}
async function push(){if(!auth||saving||!dirty||conflict)return;
 saving=true;status('A sincronizar…');try{
   const snapshot=JSON.stringify(activeData);
   const result=await authorized('/rest/v1/rpc/save_my_portfolio','POST',{expected_revision:revision,new_data:activeData});
   revision=Number(result);lastSynced=snapshot;
   dirty=JSON.stringify(activeData)!==snapshot;status(dirty?'Alterações pendentes':'Sincronizado');
 }catch(e){if(/conflito|conflict|40001|outro dispositivo/i.test(e.message)){conflict=true;status('Conflito: exporta backup e recarrega',true)}else status('Falha de sincronização — tenta novamente',true);console.error(e)}finally{saving=false;if(dirty&&!conflict)clearTimeout(timer),timer=setTimeout(push,3500)}
}
function queueSave(data){activeData=data;dirty=true;status('Alterações por guardar');clearTimeout(timer);timer=setTimeout(push,800)}
window.addEventListener('message',async e=>{
 if(e.origin!==location.origin||e.source!==$('portfolio').contentWindow||!auth||e.data?.uid!==auth.user.id)return;
 if(e.data.type==='MYPORT_SAVED'){queueSave(e.data.portfolio);return}
 if(e.data.type==='MYPORT_MARKET_REQUEST'){
   const requestId=String(e.data.requestId||'');
   if(!/^[a-zA-Z0-9-]{1,80}$/.test(requestId))return;
   let reply;
   try{reply={type:'MYPORT_MARKET_RESPONSE',requestId,uid:auth.user.id,data:await authorized('/functions/v1/market-quotes','POST',{assets:e.data.assets})}}
   catch(err){reply={type:'MYPORT_MARKET_RESPONSE',requestId,uid:auth.user.id,error:String(err.message||err)}}
   if(auth?.user?.id===e.data.uid)$('portfolio').contentWindow?.postMessage(reply,location.origin);
 }
});
function exportJson(){if(!auth)return;const content=JSON.stringify(activeData,null,2);const link=document.createElement('a');link.download='myportefolio-'+auth.user.id.slice(0,8)+'-backup.json';const blob=URL.createObjectURL(new Blob([content],{type:'application/json'}));link.href=blob;link.click();setTimeout(()=>URL.revokeObjectURL(blob),10000)}
$('authForm').onsubmit=async e=>{e.preventDefault();if(!validConfig)return feedback('Configura primeiro config.js e Supabase.');feedback('A autenticar…');try{const d=await request('/auth/v1/token?grant_type=password','POST',{email:$('email').value.trim(),password:$('password').value});await begin(d);feedback('')}catch(err){feedback('Não foi possível iniciar sessão: '+err.message)}};
$('signup').onclick=async()=>{if(!validConfig)return feedback('Configura primeiro config.js e Supabase.');const email=$('email').value.trim(),password=$('password').value;if(!email||!$('email').checkValidity())return feedback('Introduz um endereço de email válido antes de criar conta.');if(!password||password.length<6)return feedback('Introduz uma palavra-passe com pelo menos 6 caracteres.');feedback('A criar conta…');try{await request('/auth/v1/signup','POST',{email,password});feedback('Pedido de registo enviado. Confirma o email, se exigido pelo Supabase, e depois inicia sessão.')}catch(e){feedback('Não foi possível criar conta: '+e.message)}};
$('sync').onclick=()=>push();$('backup').onclick=exportJson;
$('signout').onclick=async()=>{if(dirty){await push();if(dirty){alert('Há dados por sincronizar. Exporta um backup antes de sair.');return}}if(auth)try{await authorized('/auth/v1/logout','POST',{})}catch{}auth=null;sessionStorage.removeItem(STORE);location.reload()};
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});
if(!validConfig)$('setupHint').classList.remove('hidden');
else{try{const saved=JSON.parse(sessionStorage.getItem(STORE)||'null');if(saved?.access_token)begin(saved).catch(e=>{sessionStorage.removeItem(STORE);feedback('Inicia sessão novamente: '+e.message)})}catch{}}
