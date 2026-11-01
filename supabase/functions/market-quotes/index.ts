// MyPortefolio 9.4 — cotações diárias com cache e quotas globais.
// Requer executar supabase/MIGRACAO_COTACOES_9_4.sql ANTES de publicar.
// Secrets: TWELVEDATA_API_KEY, ALPHAVANTAGE_API_KEY, SUPABASE_SERVICE_ROLE_KEY.
// A service role é utilizada exclusivamente no servidor; nunca na app pública.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors={"Access-Control-Allow-Origin":"https://camendes1997.github.io","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8"};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:cors});
type Asset={ticker:string;symbol:string;exchange?:string;category:string;fallbackSymbol?:string;fallbackCurrency?:string};
type Quote={ticker:string;providerSymbol:string;category:string;exchange:string|null;currency:string;originalPrice:number;eurPrice:number;quoteDate:string;fxDate:string|null;provider:string;status?:string};
const valid=(s:string,re:RegExp,max:number)=>s.length>0&&s.length<=max&&re.test(s);
const utcDate=()=>new Date().toISOString().slice(0,10);
const dateOk=(date:string)=>{if(!/^\d{4}-\d{2}-\d{2}/.test(date))return false;const t=Date.parse(date.slice(0,10)+"T23:59:59Z");const days=(Date.now()-t)/86400000;return Number.isFinite(days)&&days>=-1&&days<=10};
function validate(a:Asset){
 if(!a||typeof a!=="object"||!["ETF","Ações"].includes(a.category))return "Categoria inválida";
 if(typeof a.ticker!=="string"||!a.ticker.trim()||a.ticker.length>100)return "Ticker interno inválido";
 if(typeof a.symbol!=="string"||!valid(a.symbol,/^[A-Za-z0-9_.:\/-]+$/,35))return "Símbolo Twelve Data inválido";
 if(a.exchange&&(!valid(a.exchange,/^[A-Za-z0-9 _.-]+$/,40)))return "Bolsa inválida";
 if(a.fallbackSymbol&&!valid(a.fallbackSymbol,/^[A-Za-z0-9_.-]+$/,35))return "Símbolo Alpha Vantage inválido";
 if(a.fallbackCurrency&&!/^[A-Z]{3}$/.test(a.fallbackCurrency))return "Moeda Alpha Vantage inválida";
 return null;
}
async function toEur(price:number,currency:string){
 if(currency==="EUR")return {eurPrice:price,fxDate:null};
 const r=await fetch("https://api.frankfurter.dev/v1/latest?base="+encodeURIComponent(currency)+"&symbols=EUR",{signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw Error("Câmbio indisponível");
 const d=await r.json(),rate=Number(d.rates?.EUR);
 if(!Number.isFinite(rate)||rate<=0||!/^\d{4}-\d{2}-\d{2}$/.test(String(d.date||"")))throw Error("Câmbio inválido");
 return {eurPrice:price*rate,fxDate:String(d.date)};
}
async function twelve(a:Asset,key:string):Promise<Quote>{
 const q=new URLSearchParams({symbol:a.symbol,apikey:key});if(a.exchange)q.set("exchange",a.exchange);
 const r=await fetch("https://api.twelvedata.com/quote?"+q,{signal:AbortSignal.timeout(10000)});
 const d=await r.json();
 if(!r.ok||d.status==="error"||d.code)throw Error(String(d.message||"Twelve Data indisponível").slice(0,180));
 const price=Number(d.close),currency=String(d.currency||"").toUpperCase(),symbol=String(d.symbol||"").toUpperCase(),quoteDate=String(d.datetime||"");
 if(!Number.isFinite(price)||price<=0||!/^[A-Z]{3}$/.test(currency))throw Error("Cotação ou moeda inválida na Twelve Data");
 if(!dateOk(quoteDate))throw Error("STALE_QUOTE: Twelve Data devolveu cotação antiga ou sem data ("+quoteDate+")");
 if(symbol&&symbol!==a.symbol.toUpperCase())throw Error("Twelve Data devolveu outro símbolo");
 return {ticker:a.ticker,providerSymbol:a.symbol,category:a.category,exchange:d.exchange||a.exchange||null,currency,originalPrice:price,...await toEur(price,currency),quoteDate,provider:"Twelve Data"};
}
async function alpha(a:Asset,key:string):Promise<Quote>{
 if(!a.fallbackSymbol||!a.fallbackCurrency)throw Error("Sem símbolo e moeda Alpha Vantage");
 const q=new URLSearchParams({function:"GLOBAL_QUOTE",symbol:a.fallbackSymbol,apikey:key});
 const r=await fetch("https://www.alphavantage.co/query?"+q,{signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw Error("Alpha Vantage HTTP "+r.status);
 const d=await r.json();
 if(d.Note||d.Information||d["Error Message"])throw Error(String(d.Note||d.Information||d["Error Message"]).slice(0,180));
 const qv=d["Global Quote"]||{},symbol=String(qv["01. symbol"]||"").toUpperCase(),price=Number(qv["05. price"]),quoteDate=String(qv["07. latest trading day"]||"");
 if(symbol!==a.fallbackSymbol.toUpperCase()||!Number.isFinite(price)||price<=0)throw Error("Alpha Vantage não devolveu preço válido para o símbolo");
 if(!dateOk(quoteDate))throw Error("STALE_QUOTE: Alpha Vantage devolveu cotação antiga ou sem data ("+quoteDate+")");
 const currency=a.fallbackCurrency;
 return {ticker:a.ticker,providerSymbol:a.fallbackSymbol,category:a.category,exchange:a.exchange||null,currency,originalPrice:price,...await toEur(price,currency),quoteDate,provider:"Alpha Vantage"};
}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="POST")return reply({error:"Método não permitido"},405);
 try{
  const jwt=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
  const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!jwt||!url||!anon||!service)return reply({error:"Autenticação ou configuração do servidor indisponível"},503);
  const authClient=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error}=await authClient.auth.getUser(jwt);
  if(error||!user)return reply({error:"Sessão inválida"},401);
  const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const td=Deno.env.get("TWELVEDATA_API_KEY")||"",av=Deno.env.get("ALPHAVANTAGE_API_KEY")||"";
  if(!td&&!av)return reply({error:"Nenhum fornecedor configurado"},503);
  const input=await req.json();
  if(!Array.isArray(input?.assets)||input.assets.length<1||input.assets.length>8)return reply({error:"Indica 1 a 8 ativos"},400);
  const results=[];
  for(const a of input.assets as Asset[]){
   const issue=validate(a);
   if(issue){results.push({ticker:String(a?.ticker||"?"),category:a?.category,status:"error",error:issue});continue}
   const providers:(["twelve"|"alpha",string])[]=[];
   if(td)providers.push(["twelve",td]);
   if(av&&a.fallbackSymbol&&a.fallbackCurrency)providers.push(["alpha",av]);
   let lastError="Sem fornecedor disponível",lastStatus="error",lastRetry=0,completed=false;
   for(const [provider,key] of providers){
    const token=provider==="twelve"?[a.symbol.toUpperCase(),(a.exchange||"").toUpperCase()].join("|"):[a.fallbackSymbol?.toUpperCase(),a.fallbackCurrency].join("|");
    const cacheKey=provider+"|"+token;
    const limits=provider==="twelve"?{minute:7,day:700}:{minute:1,day:20};
    const {data:claim,error:claimError}=await db.rpc("claim_market_quote",{p_cache_key:cacheKey,p_provider:provider,p_min_limit:limits.minute,p_day_limit:limits.day});
    if(claimError){lastError="Cache ou limites indisponíveis; executa a migração 9.4";lastStatus="error";break}
    if(claim?.status==="cached"){
     const quote=claim.quote as Quote & {unavailable?:boolean;error?:string};
     if(quote.unavailable){lastError=quote.error||"Sem cobertura no plano";lastStatus="unsupported";continue}
     results.push({...quote,ticker:a.ticker,category:a.category,status:"cached"});completed=true;break;
    }
    if(claim?.status!=="allowed"){
     lastStatus=claim?.status==="pending"?"pending":claim?.status==="daily_limit"?"daily_limit":"limited";
     lastRetry=Math.max(lastRetry,Number(claim?.retryAfter)||60);
     lastError=lastStatus==="daily_limit"?"Limite diário do fornecedor":"Consulta pendente ou limite por minuto";
     // Não gastar créditos de outro fornecedor só porque o limite temporário foi atingido.
     break;
    }
    try{
     const quote=provider==="twelve"?await twelve(a,key):await alpha(a,key);
     const today=utcDate();
     const {error:cacheError}=await db.from("market_quote_cache").upsert({
       cache_key:cacheKey,provider,quote,checked_on:today,checked_at:new Date().toISOString()
     },{onConflict:"cache_key"});
     if(cacheError)throw Error("Não foi possível guardar cotação na cache");
     results.push({...quote,status:"updated"});completed=true;break;
    }catch(e){
     lastError=e instanceof Error?e.message:"Cotação indisponível";
     lastStatus=/^STALE_QUOTE:/.test(lastError)?"stale":"error";
     // Falhas definitivas de cobertura/plano são memorizadas durante o dia para não
     // gastar repetidamente créditos a consultar o mesmo ativo noutras contas.
     if(/available starting|upgrade now|grow or venture|paid plan|subscription plan|premium data/i.test(lastError)){
       await db.from("market_quote_cache").upsert({
         cache_key:cacheKey,provider,quote:{unavailable:true,error:lastError},
         checked_on:utcDate(),checked_at:new Date().toISOString()
       },{onConflict:"cache_key"});
       lastStatus="unsupported";
       continue;
     }
     // Limites do fornecedor devem ter tratamento temporário; não insistir na mesma chamada.
     if(/minute|credit|rate limit|too many|quota|limit/i.test(lastError)&&!/plan|tier|upgrade|available starting/i.test(lastError)){
       lastStatus="limited";lastRetry=Math.max(lastRetry,70);break;
     }
    }
   }
   if(!completed)results.push({ticker:a.ticker,category:a.category,status:lastStatus,error:lastError,retryAfter:lastRetry||undefined});
  }
  return reply({results,checkedAt:new Date().toISOString()});
 }catch(e){return reply({error:e instanceof Error?e.message:"Erro ao processar pedido"},400)}
});
