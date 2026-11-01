// MyPortefolio 9.2 — Servidor de cotações para Ações e ETF.
// Publicar como Supabase Edge Function "market-quotes" com JWT obrigatório.
// Definir TWELVEDATA_API_KEY em Supabase -> Edge Functions -> Secrets.
// Não colocar a chave no GitHub Pages ou no config.js.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "https://camendes1997.github.io",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};
const json = (body: unknown, code=200) => new Response(JSON.stringify(body), {status:code,headers:CORS});
type AssetRequest = {ticker:string,symbol:string,exchange?:string,category:string};
const allowedCategory = new Set(["ETF","Ações"]);
const safe = (s:string, regex:RegExp, max:number) => s.length>0 && s.length<=max && regex.test(s);
Deno.serve(async req => {
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:CORS});
  if(req.method!=="POST")return json({error:"Método não permitido"},405);
  try {
    const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
    const url=Deno.env.get("SUPABASE_URL"), anon=Deno.env.get("SUPABASE_ANON_KEY");
    if(!token||!url||!anon)return json({error:"Sessão inválida"},401);
    const db=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:{user},error}=await db.auth.getUser(token);
    if(error||!user)return json({error:"Sessão inválida"},401);
    const apiKey=Deno.env.get("TWELVEDATA_API_KEY");
    if(!apiKey)return json({error:"Fornecedor de mercado por configurar"},503);
    const input=await req.json();
    if(!Array.isArray(input?.assets)||input.assets.length<1||input.assets.length>8)return json({error:"Indica entre 1 e 8 ativos"},400);
    const assets:AssetRequest[]=input.assets;
    // ticker é um identificador local da carteira; não deve ser confundido com o símbolo do fornecedor.
    // Cada ativo inválido recebe um erro próprio em vez de bloquear todos os outros.
    const invalid = (a:AssetRequest):string|null => {
      if(!a||typeof a!=="object")return "Registo inválido";
      if(!allowedCategory.has(a.category))return "Categoria inválida";
      if(typeof a.ticker!=="string"||!a.ticker.trim()||a.ticker.length>100)return "Ticker interno inválido";
      if(typeof a.symbol!=="string"||!safe(a.symbol,/^[A-Za-z0-9_.:\\/-]+$/,35))return "Símbolo Twelve Data inválido: "+String(a.symbol);
      if(a.exchange!==undefined&&a.exchange!==""&&(typeof a.exchange!=="string"||!safe(a.exchange,/^[A-Za-z0-9 _.-]+$/,40)))
        return "Bolsa inválida: "+String(a.exchange);
      return null;
    };
    const results=[];
    // Uma solicitação por ticker; cada consulta poderá consumir créditos do fornecedor.
    for(const a of assets){
      const validationError=invalid(a);
      if(validationError){results.push({ticker:String(a?.ticker||"?"),category:a?.category,error:validationError});continue}
      try{
        const query=new URLSearchParams({symbol:a.symbol,apikey:apiKey});
        if(a.exchange)query.set("exchange",a.exchange);
        const response=await fetch("https://api.twelvedata.com/quote?"+query,{headers:{"Accept":"application/json"},signal:AbortSignal.timeout(10000)});
        const quote=await response.json();
        if(!response.ok||quote.status==="error"||quote.code)throw Error(String(quote.message||"Cotação indisponível"));
        const price=Number(quote.close),currency=String(quote.currency||"").toUpperCase();
        const actualSymbol=String(quote.symbol||"").toUpperCase();
        if(!Number.isFinite(price)||price<=0||!currency||!safe(currency,/^[A-Z]{3}$/,3))
          throw Error("Preço ou moeda não confirmados pelo fornecedor");
        if(actualSymbol&&actualSymbol!==a.symbol.toUpperCase())
          throw Error("O fornecedor devolveu um símbolo diferente: "+actualSymbol);
        const quotedAt=String(quote.datetime||"");
        if(!/^\d{4}-\d{2}-\d{2}/.test(quotedAt))throw Error("Data da cotação em falta");
        const ageDays=(Date.now()-Date.parse(quotedAt.slice(0,10)+"T23:59:59Z"))/86400000;
        if(!Number.isFinite(ageDays)||ageDays>10||ageDays< -1)throw Error("Cotação demasiado antiga ou inválida");
        let eurRate=1,fxDate:null|string=null;
        if(currency!=="EUR"){
          const fxResp=await fetch("https://api.frankfurter.dev/v1/latest?base="+encodeURIComponent(currency)+"&symbols=EUR",{signal:AbortSignal.timeout(10000)});
          if(!fxResp.ok)throw Error("Conversão cambial indisponível");
          const fx=await fxResp.json();eurRate=Number(fx.rates?.EUR);fxDate=String(fx.date||"");
          if(!Number.isFinite(eurRate)||eurRate<=0||!/^\d{4}-\d{2}-\d{2}$/.test(fxDate))throw Error("Câmbio inválido");
        }
        results.push({ticker:a.ticker,providerSymbol:a.symbol,category:a.category,exchange:quote.exchange||a.exchange||null,currency,
          originalPrice:price,eurPrice:price*eurRate,quoteDate:quotedAt,fxDate,provider:"Twelve Data"});
      }catch(e){results.push({ticker:a.ticker,category:a.category,error:e instanceof Error?e.message:"Cotação indisponível"})}
    }
    return json({results,checkedAt:new Date().toISOString()});
  }catch(e){return json({error:e instanceof Error?e.message:"Erro ao processar pedido"},400)}
});
