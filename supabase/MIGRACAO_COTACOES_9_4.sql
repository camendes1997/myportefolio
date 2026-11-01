-- MyPortefolio 9.4: cache partilhada e limites globais das APIs.
-- Executar UMA VEZ no SQL Editor do Supabase (projeto myportefolio).
-- Os dados de investimentos em public.portfolios NÃO são modificados.
create table if not exists public.market_quote_cache (
 cache_key text primary key,
 provider text not null,
 quote jsonb not null,
 checked_on date not null,
 checked_at timestamptz not null default now()
);
create table if not exists public.market_api_requests (
 id bigint generated always as identity primary key,
 provider text not null,
 requested_at timestamptz not null default now()
);
create index if not exists market_api_requests_provider_time_idx
 on public.market_api_requests(provider,requested_at desc);
create table if not exists public.market_quote_reservations (
 cache_key text primary key,
 reserved_until timestamptz not null
);
alter table public.market_quote_cache enable row level security;
alter table public.market_api_requests enable row level security;
alter table public.market_quote_reservations enable row level security;
revoke all on public.market_quote_cache from public, anon, authenticated;
revoke all on public.market_api_requests from public, anon, authenticated;
revoke all on public.market_quote_reservations from public, anon, authenticated;

-- Reserva de crédito atómica e partilhada entre utilizadores.
-- Usar só pela Edge Function autenticada via service_role.
create or replace function public.claim_market_quote(
 p_cache_key text, p_provider text, p_min_limit integer, p_day_limit integer
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
 q jsonb;
 cached_date date;
 busy_until timestamptz;
 oldest_minute timestamptz;
 oldest_day timestamptz;
 used_minute integer;
 used_day integer;
 begin_at timestamptz := clock_timestamp();
begin
 if p_provider not in ('twelve','alpha') or length(p_cache_key)>180 or length(p_cache_key)<2
    or p_min_limit not between 1 and 8 or p_day_limit not between 1 and 800 then
   raise exception 'Parâmetros inválidos';
 end if;
 perform pg_advisory_xact_lock(hashtext('myport_market_'||p_provider));
 select quote,checked_on into q,cached_date from public.market_quote_cache where cache_key=p_cache_key;
 if cached_date=(begin_at at time zone 'UTC')::date then
   return jsonb_build_object('status','cached','quote',q);
 end if;
 select reserved_until into busy_until from public.market_quote_reservations where cache_key=p_cache_key;
 if busy_until>begin_at then
   return jsonb_build_object('status','pending','retryAfter',greatest(5,ceil(extract(epoch from (busy_until-begin_at)))::int));
 end if;
 select count(*),min(requested_at) into used_minute,oldest_minute
 from public.market_api_requests where provider=p_provider and requested_at>begin_at-interval '65 seconds';
 if used_minute>=p_min_limit then
   return jsonb_build_object('status','limited','retryAfter',greatest(10,ceil(extract(epoch from (oldest_minute+interval '66 seconds'-begin_at)))::int));
 end if;
 select count(*),min(requested_at) into used_day,oldest_day
 from public.market_api_requests where provider=p_provider and requested_at>begin_at-interval '24 hours';
 if used_day>=p_day_limit then
   return jsonb_build_object('status','daily_limit','retryAfter',greatest(60,ceil(extract(epoch from (oldest_day+interval '24 hours'-begin_at)))::int));
 end if;
 insert into public.market_api_requests(provider,requested_at) values(p_provider,begin_at);
 insert into public.market_quote_reservations(cache_key,reserved_until)
 values(p_cache_key,begin_at+interval '35 seconds')
 on conflict(cache_key) do update set reserved_until=excluded.reserved_until;
 return jsonb_build_object('status','allowed');
end $$;
revoke all on function public.claim_market_quote(text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.claim_market_quote(text,text,integer,integer) to service_role;
-- Supabase service_role tem bypassrls; não criar políticas de acesso público às tabelas.
