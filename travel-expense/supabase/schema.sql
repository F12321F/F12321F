-- 旅行分帳本 Supabase schema
-- 在 Supabase Dashboard → SQL Editor 貼上整份執行即可；可重複執行。
--
-- 存取模式（不需登入）：
--   * 每個旅程有一組「分享碼」。知道分享碼的人可以讀取與編輯該旅程。
--   * 三張資料表都開啟 RLS 且沒有任何 policy，瀏覽器用 anon / publishable key 無法直接讀寫資料表。
--   * 所有讀寫都透過下方 security definer 函式（/rest/v1/rpc/...），函式內會檢查分享碼與資料格式。
--   * service_role / secret key 只能放在後端，絕不能放進 App 或網頁。

-- ---------- 資料表 ----------
create table if not exists public.trips (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[0-9A-F]{12}$'),
  name        text not null default '我的旅程' check (char_length(name) between 1 and 40),
  rates       jsonb not null default '{}'::jsonb check (jsonb_typeof(rates) = 'object'),
  version     bigint not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.trip_members (
  trip_id     uuid not null references public.trips(id) on delete cascade,
  id          text not null check (char_length(id) between 1 and 32),
  name        text not null check (char_length(name) between 1 and 16),
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  primary key (trip_id, id),
  unique (trip_id, name)
);

create table if not exists public.trip_expenses (
  trip_id     uuid not null references public.trips(id) on delete cascade,
  id          text not null check (char_length(id) between 1 and 32),
  spent_on    date not null,
  description text not null check (char_length(description) between 1 and 40),
  category    text not null check (category in ('餐飲', '交通', '住宿', '門票', '購物', '其他')),
  amount      numeric(16, 2) not null check (amount > 0),
  currency    text not null check (currency ~ '^[A-Z]{3}$'),
  rate        numeric(20, 8) not null check (rate > 0),
  payer_id    text not null,
  split_mode  text not null check (split_mode in ('equal', 'custom')),
  split       jsonb not null default '[]'::jsonb check (jsonb_typeof(split) = 'array'),
  custom      jsonb not null default '{}'::jsonb check (jsonb_typeof(custom) = 'object'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (trip_id, id),
  foreign key (trip_id, payer_id) references public.trip_members(trip_id, id)
);

create index if not exists trip_expenses_trip_date_idx on public.trip_expenses (trip_id, spent_on);

alter table public.trips         enable row level security;
alter table public.trip_members  enable row level security;
alter table public.trip_expenses enable row level security;

-- 沒有 policy = anon / authenticated 直接存取資料表一律拒絕；再撤銷資料表權限做雙重保險
revoke all on public.trips, public.trip_members, public.trip_expenses from anon, authenticated;

-- ---------- 內部輔助函式（不開放給 anon） ----------
create or replace function public._trip_id(p_code text)
returns uuid
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare v uuid;
begin
  select id into v from trips where code = upper(regexp_replace(coalesce(p_code, ''), '[^0-9A-Za-z]', '', 'g'));
  if v is null then raise exception 'TRIP_NOT_FOUND' using errcode = 'P0002'; end if;
  return v;
end $$;

create or replace function public._touch(p_trip uuid)
returns void
language sql security definer set search_path = public, pg_temp
as $$ update trips set version = version + 1, updated_at = now() where id = p_trip; $$;

create or replace function public._trip_json(p_trip uuid)
returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'code', t.code, 'name', t.name, 'rates', t.rates, 'version', t.version,
    'members', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name) order by m.position, m.created_at)
                         from trip_members m where m.trip_id = t.id), '[]'::jsonb),
    'expenses', coalesce((select jsonb_agg(jsonb_build_object(
                           'id', e.id, 'date', e.spent_on, 'desc', e.description, 'cat', e.category,
                           'amount', e.amount, 'cur', e.currency, 'rate', e.rate, 'payer', e.payer_id,
                           'mode', e.split_mode, 'split', e.split, 'custom', e.custom) order by e.spent_on, e.created_at)
                          from trip_expenses e where e.trip_id = t.id), '[]'::jsonb))
  from trips t where t.id = p_trip;
$$;

create or replace function public._upsert_member(p_trip uuid, p_id text, p_name text)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if (select count(*) from trip_members where trip_id = p_trip and id <> p_id) >= 50 then
    raise exception 'TOO_MANY_MEMBERS';
  end if;
  insert into trip_members (trip_id, id, name, position)
  values (p_trip, p_id, btrim(p_name), coalesce((select max(position) + 1 from trip_members where trip_id = p_trip), 0))
  on conflict (trip_id, id) do update set name = excluded.name;
exception
  when unique_violation then raise exception 'MEMBER_NAME_TAKEN';
  when check_violation or not_null_violation then raise exception 'INVALID_MEMBER';
end $$;

create or replace function public._upsert_expense(p_trip uuid, e jsonb)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_split  jsonb := coalesce(e->'split', '[]'::jsonb);
  v_custom jsonb := coalesce(e->'custom', '{}'::jsonb);
  v_mode   text  := coalesce(e->>'mode', 'equal');
  v_amount numeric;
  v_sum    numeric;
begin
  v_amount := (e->>'amount')::numeric;
  if (select count(*) from trip_expenses where trip_id = p_trip and id <> e->>'id') >= 3000 then
    raise exception 'TOO_MANY_EXPENSES';
  end if;
  if jsonb_typeof(v_split) <> 'array' or jsonb_typeof(v_custom) <> 'object' then
    raise exception 'INVALID_SPLIT';
  end if;
  -- 分攤對象必須都是此旅程的旅伴
  if exists (select 1 from jsonb_array_elements_text(v_split) s(id)
             where not exists (select 1 from trip_members m where m.trip_id = p_trip and m.id = s.id))
     or exists (select 1 from jsonb_object_keys(v_custom) k(id)
             where not exists (select 1 from trip_members m where m.trip_id = p_trip and m.id = k.id)) then
    raise exception 'UNKNOWN_MEMBER';
  end if;
  if v_mode = 'equal' and jsonb_array_length(v_split) = 0 then raise exception 'INVALID_SPLIT'; end if;
  if v_mode = 'custom' then
    select coalesce(sum(value::numeric), 0) into v_sum from jsonb_each_text(v_custom);
    if abs(v_sum - v_amount) > 0.01 then raise exception 'CUSTOM_SUM_MISMATCH'; end if;
    v_split := '[]'::jsonb;
  else
    v_custom := '{}'::jsonb;
  end if;

  insert into trip_expenses (trip_id, id, spent_on, description, category, amount, currency, rate, payer_id, split_mode, split, custom)
  values (p_trip, e->>'id', (e->>'date')::date, btrim(e->>'desc'), e->>'cat', v_amount, e->>'cur',
          (e->>'rate')::numeric, e->>'payer', v_mode, v_split, v_custom)
  on conflict (trip_id, id) do update set
    spent_on = excluded.spent_on, description = excluded.description, category = excluded.category,
    amount = excluded.amount, currency = excluded.currency, rate = excluded.rate, payer_id = excluded.payer_id,
    split_mode = excluded.split_mode, split = excluded.split, custom = excluded.custom, updated_at = now();
exception
  when foreign_key_violation then raise exception 'UNKNOWN_MEMBER';
  when check_violation or not_null_violation or invalid_text_representation or invalid_datetime_format
       or datetime_field_overflow or numeric_value_out_of_range or string_data_right_truncation
    then raise exception 'INVALID_EXPENSE';
end $$;

create or replace function public._replace_data(p_trip uuid, p_state jsonb)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare m jsonb; e jsonb;
begin
  delete from trip_expenses where trip_id = p_trip;
  delete from trip_members  where trip_id = p_trip;
  for m in select * from jsonb_array_elements(coalesce(p_state->'members', '[]'::jsonb)) loop
    perform _upsert_member(p_trip, m->>'id', m->>'name');
  end loop;
  for e in select * from jsonb_array_elements(coalesce(p_state->'expenses', '[]'::jsonb)) loop
    perform _upsert_expense(p_trip, e);
  end loop;
end $$;

-- ---------- 對外 API（anon 可呼叫，皆需分享碼） ----------

-- 建立新旅程（可帶入現有本機資料），回傳完整旅程與分享碼
create or replace function public.create_trip(p_state jsonb default '{}'::jsonb)
returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp
as $$
declare v_id uuid; v_code text;
begin
  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
    exit when not exists (select 1 from trips where code = v_code);
  end loop;
  insert into trips (code, name, rates)
  values (v_code, coalesce(nullif(btrim(left(p_state->>'tripName', 40)), ''), '我的旅程'),
          case when jsonb_typeof(p_state->'rates') = 'object' then p_state->'rates' else '{}'::jsonb end)
  returning id into v_id;
  perform _replace_data(v_id, p_state);
  return _trip_json(v_id);
end $$;

create or replace function public.get_trip(p_code text)
returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$ select _trip_json(_trip_id(p_code)); $$;

-- 只回傳版本號，用來輕量檢查別人是否有更新
create or replace function public.trip_version(p_code text)
returns bigint
language sql stable security definer set search_path = public, pg_temp
as $$ select version from trips where id = _trip_id(p_code); $$;

create or replace function public.update_trip(p_code text, p_name text default null, p_rates jsonb default null)
returns bigint
language plpgsql volatile security definer set search_path = public, pg_temp
as $$
declare v uuid := _trip_id(p_code);
begin
  if p_rates is not null and jsonb_typeof(p_rates) <> 'object' then raise exception 'INVALID_RATES'; end if;
  update trips set
    name  = coalesce(nullif(btrim(left(p_name, 40)), ''), name),
    rates = coalesce(p_rates, rates)
  where id = v;
  perform _touch(v);
  return (select version from trips where id = v);
end $$;

create or replace function public.upsert_member(p_code text, p_id text, p_name text)
returns bigint
language plpgsql volatile security definer set search_path = public, pg_temp
as $$
declare v uuid := _trip_id(p_code);
begin
  perform _upsert_member(v, p_id, p_name);
  perform _touch(v);
  return (select version from trips where id = v);
end $$;

create or replace function public.delete_member(p_code text, p_id text)
returns bigint
language plpgsql volatile security definer set search_path = public, pg_temp
as $$
declare v uuid := _trip_id(p_code);
begin
  if exists (select 1 from trip_expenses
             where trip_id = v and (payer_id = p_id or split ? p_id or custom ? p_id)) then
    raise exception 'MEMBER_IN_USE';
  end if;
  delete from trip_members where trip_id = v and id = p_id;
  perform _touch(v);
  return (select version from trips where id = v);
end $$;

create or replace function public.upsert_expense(p_code text, p_expense jsonb)
returns bigint
language plpgsql volatile security definer set search_path = public, pg_temp
as $$
declare v uuid := _trip_id(p_code);
begin
  perform _upsert_expense(v, p_expense);
  perform _touch(v);
  return (select version from trips where id = v);
end $$;

create or replace function public.delete_expense(p_code text, p_id text)
returns bigint
language plpgsql volatile security definer set search_path = public, pg_temp
as $$
declare v uuid := _trip_id(p_code);
begin
  delete from trip_expenses where trip_id = v and id = p_id;
  perform _touch(v);
  return (select version from trips where id = v);
end $$;

-- 用備份資料取代整個旅程的旅伴與支出
create or replace function public.replace_trip(p_code text, p_state jsonb)
returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp
as $$
declare v uuid := _trip_id(p_code);
begin
  update trips set
    name  = coalesce(nullif(btrim(left(p_state->>'tripName', 40)), ''), name),
    rates = case when jsonb_typeof(p_state->'rates') = 'object' then p_state->'rates' else rates end
  where id = v;
  perform _replace_data(v, p_state);
  perform _touch(v);
  return _trip_json(v);
end $$;

-- ---------- 權限 ----------
revoke execute on function
  public._trip_id(text), public._touch(uuid), public._trip_json(uuid),
  public._upsert_member(uuid, text, text), public._upsert_expense(uuid, jsonb), public._replace_data(uuid, jsonb),
  public.create_trip(jsonb), public.get_trip(text), public.trip_version(text), public.update_trip(text, text, jsonb),
  public.upsert_member(text, text, text), public.delete_member(text, text), public.upsert_expense(text, jsonb),
  public.delete_expense(text, text), public.replace_trip(text, jsonb)
from public, anon, authenticated;
grant execute on function
  public.create_trip(jsonb),
  public.get_trip(text),
  public.trip_version(text),
  public.update_trip(text, text, jsonb),
  public.upsert_member(text, text, text),
  public.delete_member(text, text),
  public.upsert_expense(text, jsonb),
  public.delete_expense(text, text),
  public.replace_trip(text, jsonb)
to anon, authenticated;
