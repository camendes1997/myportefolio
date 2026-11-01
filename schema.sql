-- Executar no SQL Editor do seu projeto Supabase.
-- Cada conta só pode aceder à sua própria carteira.
create table if not exists public.portfolios (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  revision bigint not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.portfolios enable row level security;
drop policy if exists "read own portfolio" on public.portfolios;
create policy "read own portfolio" on public.portfolios for select to authenticated using (auth.uid()=user_id);
-- escrita exclusivamente através da função atómica que verifica a revisão
revoke insert, update, delete on public.portfolios from anon, authenticated;
grant select on public.portfolios to authenticated;
create or replace function public.save_my_portfolio(expected_revision bigint, new_data jsonb)
returns bigint
language plpgsql security definer set search_path = public
as $$
declare new_revision bigint;
begin
  if auth.uid() is null then raise exception 'Não autenticado' using errcode='28000'; end if;
  if new_data is null or jsonb_typeof(new_data) <> 'object' then
    raise exception 'Os dados devem ser um objeto JSON';
  end if;
  if pg_column_size(new_data)>5000000 then raise exception 'Carteira demasiado grande'; end if;
  insert into public.portfolios(user_id,data,revision,updated_at)
  values(auth.uid(),new_data,1,now())
  on conflict (user_id) do update
  set data=excluded.data,revision=public.portfolios.revision+1,updated_at=now()
  where public.portfolios.revision=expected_revision
  returning revision into new_revision;
  if new_revision is null then
    raise exception 'Conflito: esta carteira foi alterada noutro dispositivo. Recarregue antes de guardar.' using errcode='40001';
  end if;
  return new_revision;
end $$;
revoke all on function public.save_my_portfolio(bigint,jsonb) from public, anon;
grant execute on function public.save_my_portfolio(bigint,jsonb) to authenticated;
