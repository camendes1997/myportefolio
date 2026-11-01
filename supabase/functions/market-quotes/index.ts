// MyPortefolio 9.3 — Twelve Data + Alpha Vantage (fallback gratuito).
// Deploy no Supabase Edge Functions com Verify JWT ativo.
// Secrets: TWELVEDATA_API_KEY, ALPHAVANTAGE_API_KEY (ambos opcionais, pelo menos um).
// Sem chaves no GitHub Pages.
import { createClient } from "npm:@supabase/supabase-js@2";

const ORIGIN="https://camendes1997.github.io";
const cors={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8"};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:cors});
type Asset={ticker:string;symbol:string;exchange?:string;category:string;fallbackSymbol?:string;fallbackCurrency?:string};
const valid=(s:string,re:RegExp,max:number)=>s.length>0&&s.length<=max&&re.test(s);
const dateOk=(date:string)=>{if(!/^\d{4}-\d{2}-\d{2}/.test(date))return false;const t=Date.parse(date.slice(0,10)+"T23:59:59Z");const days=(Date.now()-t)/86400000;return Number.isFinite(days)&&days>=-1&&days<=10};
async function toEur(price:number,currency:string){
 if(currency==="EUR")return {eurPrice:price,fxDate:null};
 const r=await fetch("https://api.frankfurter.dev/v1/latest?base="+encodeURIComponent(currency)+"&symbols=EUR",{signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw Error("Conversão cambial indisponível");
 const d=await r.json(),rate=Number(d.rates?.EUR);
 if(!Number.isFinite(rate)||rate<=0||!/^\d{4}-\d{2}-\d{2}$/.test(d.date||""))throw Error("Câmbio inválido");
 return {eurPrice:price*rate,fxDate:String(d.date)};
}
function validate(a:Asset){
 if(!a||typeof a!=="object"||!["ETF","Ações"].includes(a.category))return "Categoria inválida";
 if(typeof a.ticker!=="string"||!a.ticker.trim()||a.ticker.length>100)return "Ticker interno inválido";
 if(typeof a.symbol!=="string"||!valid(a.symbol,/^[A-Za-z0-9_.:\/-]+$/,35))return "Símbolo Twelve Data inválido";
 if(a.exchange&&(!valid(a.exchange,/^[A-Za-z0-9 _.-]+$/,40)))return "Bolsa inválida";
 if(a.fallbackSymbol&&(!valid(a.fallbackSymbol,/^[A-Za-z0-9_.-]+$/,35)))return "Símbolo Alpha Vantage inválido";
 if(a.fallbackCurrency&&!/^[A-Z]{3}$/.test(a.fallbackCurrency))return "Moeda Alpha Vantage inválida";
 return null;
}
async function twelve(a:Asset,key:string){
 const q=new URLSearchParams({symbol:a.symbol,apikey:key});if(a.exchange)q.set("exchange",a.exchange);
 const r=await fetch("https://api.twelvedata.com/quote?"+q,{signal:AbortSignal.timeout(10000)});
 const d=await r.json();
 if(!r.ok||d.status==="error"||d.code)throw Error(String(d.message||"Twelve Data indisponível").slice(0,180));
 const price=Number(d.close),currency=String(d.currency||"").toUpperCase(),symbol=String(d.symbol||"").toUpperCase(),quoteDate=String(d.datetime||"");
 if(!Number.isFinite(price)||price<=0||!/^[A-Z]{3}$/.test(currency)||!dateOk(quoteDate))throw Error("Cotação, moeda ou data inválidas na Twelve Data");
 if(symbol&&symbol!==a.symbol.toUpperCase())throw Error("Twelve Data devolveu outro símbolo");
 const conv=await toEur(price,currency);
 return {ticker:a.ticker,providerSymbol:a.symbol,category:a.category,exchange:d.exchange||a.exchange||null,currency,originalPrice:price,...conv,quoteDate,provider:"Twelve Data"};
}
async function alpha(a:Asset,key:string){
 // Alpha Vantage GLOBAL_QUOTE NÃO indica a moeda. Exigir confirmação explícita.
 if(!a.fallbackSymbol||!a.fallbackCurrency)throw Error("Configura símbolo e moeda Alpha Vantage neste ativo");
 const q=new URLSearchParams({function:"GLOBAL_QUOTE",symbol:a.fallbackSymbol,apikey:key});
 const r=await fetch("https://www.alphavantage.co/query?"+q,{signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw Error("Alpha Vantage HTTP "+r.status);
 const d=await r.json();
 if(d.Note||d.Information||d["Error Message"])throw Error(String(d.Note||d.Information||d["Error Message"]).slice(0,160));
 const quote=d["Global Quote"]||{},symbol=String(quote["01. symbol"]||"").toUpperCase(),price=Number(quote["05. price"]),quoteDate=String(quote["07. latest trading day"]||"");
 if(symbol!==a.fallbackSymbol.toUpperCase()||!Number.isFinite(price)||price<=0||!dateOk(quoteDate))
   throw Error("Alpha Vantage não devolveu uma cotação válida e recente para este símbolo");
 const currency=a.fallbackCurrency,conv=await toEur(price,currency);
 return {ticker:a.ticker,providerSymbol:a.fallbackSymbol,category:a.category,exchange:a.exchange||null,currency,originalPrice:price,...conv,quoteDate,provider:"Alpha Vantage"};
}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="POST")return reply({error:"Método não permitido"},405);
 try{
  const jwt=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
  const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_ANON_KEY");
  if(!jwt||!url||!key)return reply({error:"Sessão inválida"},401);
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error}=await db.auth.getUser(jwt);
  if(error||!user)return reply({error:"Sessão inválida"},401);
  const td=Deno.env.get("TWELVEDATA_API_KEY")||"",av=Deno.env.get("ALPHAVANTAGE_API_KEY")||"";
  if(!td&&!av)return reply({error:"Nenhum fornecedor configurado"},503);
  const body=await req.json();
  if(!Array.isArray(body?.assets)||body.assets.length<1||body.assets.length>8)return reply({error:"Indica 1 a 8 ativos"},400);
  const results=[];
  for(const a of body.assets as Asset[]){
   const issue=validate(a);
   if(issue){results.push({ticker:String(a?.ticker||"?"),category:a?.category,error:issue});continue}
   let primaryError="";
   if(td){try{results.push(await twelve(a,td));continue}catch(e){primaryError=e instanceof Error?e.message:"Twelve Data indisponível"}}
   if(av&&a.fallbackSymbol&&a.fallbackCurrency){
    try{results.push(await alpha(a,av));continue}catch(e){
      const fallbackError=e instanceof Error?e.message:"Alpha Vantage indisponível";
      results.push({ticker:a.ticker,category:a.category,error:(primaryError?primaryError+"; ":"")+fallbackError});continue;
    }
   }
   results.push({ticker:a.ticker,category:a.category,error:primaryError||"Sem configuração de símbolo/moeda Alpha Vantage"});
  }
  return reply({results,checkedAt:new Date().toISOString()});
 }catch(e){return reply({error:e instanceof Error?e.message:"Erro ao processar pedido"},400)}
});
