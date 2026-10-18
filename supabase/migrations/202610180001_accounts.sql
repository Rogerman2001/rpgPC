-- Run once through Supabase SQL Editor. No existing game/local data is deleted.
begin;
create table if not exists public.player_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 username text not null check (username ~ '^[A-Za-z0-9_]{3,20}$'),
 created_at timestamptz not null default now(),
 constraint reserved_username check(lower(username) not in ('admin','administrator','moderator','support','cavernaburx'))
);
create unique index if not exists player_username_unique on public.player_profiles(lower(username));
create table if not exists public.player_saves (
 user_id uuid primary key references public.player_profiles(user_id) on delete cascade,
 save_data jsonb not null, save_version integer not null default 2 check(save_version=2),
 revision bigint not null default 1 check(revision>0),
 power_log numeric not null, verified boolean not null default false check(verified=false),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists player_power_order on public.player_saves(power_log desc,user_id);
alter table public.player_profiles enable row level security;
alter table public.player_saves enable row level security;
drop policy if exists own_profile on public.player_profiles;
create policy own_profile on public.player_profiles for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists own_save on public.player_saves;
create policy own_save on public.player_saves for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.player_profiles,public.player_saves from public,anon,authenticated;
grant select on public.player_profiles,public.player_saves to authenticated;

-- All writes go through guarded RPCs. No arbitrary UID or score argument exists.
create or replace function public.is_google_player() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.identities where user_id=auth.uid() and provider='google')
$$;
create or replace function public.register_player(p_username text,p_owner uuid) returns text
language plpgsql security definer set search_path='' as $$
declare existing text;
begin
 if auth.uid() is null or not public.is_google_player() or p_owner is distinct from auth.uid() then raise exception 'Account changed' using errcode='42501'; end if;
 select username into existing from public.player_profiles where user_id=auth.uid();
 if found then return existing; end if;
 insert into public.player_profiles(user_id,username) values(auth.uid(),p_username);
 return p_username;
end $$;

-- v2 uses JS safe integers. Do not raise this bound until the v3 engine migration (NUMERIC_MIGRATION.md).
create or replace function public.valid_game_integer(v jsonb,minimum numeric default 0) returns boolean
language sql immutable set search_path='' as $$
 select case when jsonb_typeof(v)='number' then (v::text)::numeric between minimum and 9007199254740991 and trunc((v::text)::numeric)=(v::text)::numeric else false end
$$;

create or replace function public.validate_game_save(doc jsonb) returns jsonb
language plpgsql set search_path='' as $$
declare s jsonb; k text; b jsonb; m jsonb; n jsonb; previous numeric; h numeric;
begin
 if doc->'format' is distinct from '1'::jsonb or doc->>'numeric_encoding' is distinct from 'log10-binary64-v1' or jsonb_typeof(doc->'payload') is distinct from 'string' or octet_length(doc->>'payload')>20971520 then raise exception 'Invalid cloud envelope'; end if;
 s:=(doc->>'payload')::jsonb;
 if (s->>'version') is distinct from '2' or (s->>'rulesVersion') is distinct from '1' or s->>'style' is null or not (s->>'style'=any(array['balanced','aggressive','defensive'])) then raise exception 'Unsupported save'; end if;
 if jsonb_typeof(s->'gold') not in ('number','null') or s->'gold' is null then raise exception 'Invalid gold'; end if;
 if jsonb_typeof(s->'gold')='number' and abs((s->>'gold')::numeric)>1.7976931348623157e308 then raise exception 'Invalid gold'; end if;
 if jsonb_typeof(s->'levels') is distinct from 'object' or jsonb_typeof(s->'legacyBonuses') is distinct from 'object' or jsonb_typeof(s->'items') is distinct from 'object' or jsonb_typeof(s->'bosses') is distinct from 'object' or jsonb_typeof(s->'milestones') is distinct from 'object' then raise exception 'Missing progress'; end if;
 foreach k in array array['attack','health','defense'] loop
  if not public.valid_game_integer(s->'levels'->k) or jsonb_typeof(s->'legacyBonuses'->k) is distinct from 'number' then raise exception 'Invalid upgrades'; end if;
  if (s->'legacyBonuses'->>k)::numeric not between 0 and 1.7976931348623157e308 then raise exception 'Invalid legacy'; end if;
 end loop;
 if (select count(*) from jsonb_object_keys(s->'bosses'))<>6 or (select count(*) from jsonb_object_keys(s->'milestones'))<>6 or exists(select 1 from jsonb_object_keys(s->'items') x where x<>all(array['attack','health','defense','critical','penetration','vampirism'])) then raise exception 'Invalid guardians'; end if;
 foreach k in array array['attack','health','defense','critical','penetration','vampirism'] loop
  b:=s->'bosses'->k; m:=s->'milestones'->k;
  if not public.valid_game_integer(b->'highest') or not public.valid_game_integer(b->'next',1) or not public.valid_game_integer(b->'wins') or not public.valid_game_integer(b->'repeats') or jsonb_typeof(b->'unlocked') is distinct from 'boolean' then raise exception 'Invalid boss'; end if;
  h:=(b->>'highest')::numeric;
  if (b->>'next')::numeric<>h+1 or (b->>'wins')::numeric<>h+(b->>'repeats')::numeric then raise exception 'Inconsistent boss'; end if;
  if h>0 and (b->>'unlocked'<>'true' or not public.valid_game_integer(s->'items'->k->'level',1) or (s->'items'->k->>'level')::numeric<>h) then raise exception 'Inconsistent relic'; end if;
  if h=0 and s->'items' ? k then raise exception 'Relic without victory'; end if;
  if k=any(array['attack','health','defense']) and b->>'unlocked'<>'true' then raise exception 'Locked initial guardian'; end if;
  if not public.valid_game_integer(m->'legacyThrough') or (m->>'legacyThrough')::numeric>h or jsonb_typeof(m->'claimed') is distinct from 'array' then raise exception 'Invalid milestones'; end if;
  previous:=(m->>'legacyThrough')::numeric;
  for n in select value from jsonb_array_elements(m->'claimed') loop
   if not public.valid_game_integer(n,1) or n::text::numeric<=previous or n::text::numeric>h then raise exception 'Invalid milestone history'; end if;
   previous:=n::text::numeric;
  end loop;
 end loop;
 if s->>'selectedBoss' is null or not(s->>'selectedBoss'=any(array['attack','health','defense','critical','penetration','vampirism'])) or not public.valid_game_integer(s->'combatSeq') then raise exception 'Invalid selection'; end if;
 if jsonb_typeof(s->'afk'->'active') is distinct from 'boolean' or jsonb_typeof(s->'afk'->'unlocked') is distinct from 'boolean' or s->'afk'->>'mode' is null or not(s->'afk'->>'mode'=any(array['progress','repeat'])) or s->'afk'->>'bossId' is null or not(s->'bosses' ? (s->'afk'->>'bossId')) then raise exception 'Invalid AFK'; end if;
 if s->'afk'->>'active'='true' and (s->'afk'->>'unlocked'<>'true' or s->'bosses'->(s->'afk'->>'bossId')->>'unlocked'<>'true') then raise exception 'Invalid active AFK'; end if;
 if s->'migration' is null or (s->'migration'<>'null'::jsonb and (s->'migration'->>'from' is distinct from '1' or jsonb_typeof(s->'migration'->'source') is distinct from 'string')) then raise exception 'Invalid migration'; end if;
 if s->'pending' is null then raise exception 'Missing encounter state'; end if;
 if s->'pending'<>'null'::jsonb then
  b:=s->'pending';
  if b->'token' is distinct from s->'combatSeq' or b->>'id' is null or not(s->'bosses' ? (b->>'id')) or b->>'mode' is null or not(b->>'mode'=any(array['progress','repeat'])) or jsonb_typeof(b->'automatic') is distinct from 'boolean' or b->'level' is distinct from s->'bosses'->(b->>'id')->(case when b->>'mode'='repeat' then 'highest' else 'next' end) then raise exception 'Invalid pending encounter'; end if;
 end if;
 return s;
end $$;

-- Same existing rule: 10*styled attack + styled health + 10*styled defense.
-- Logarithmic arithmetic avoids materializing 10^(very large exponent).
create or replace function public.game_power_log(s jsonb) returns numeric
language plpgsql immutable set search_path='' as $$
declare logs numeric[]:='{}'; k text; base numeric; factor numeric; v numeric; hi numeric; total numeric:=0;
begin
 foreach k in array array['attack','health','defense'] loop
  base:=case k when 'attack' then 120 when 'health' then 110 else 30 end;
  factor:=case s->>'style' when 'aggressive' then case k when 'attack' then 1.25 when 'health' then .85 else .8 end when 'defensive' then case k when 'attack' then .85 when 'health' then 1.2 else 1.35 end else 1 end;
  v:=log(base)+log(1.15::numeric)*(s->'levels'->>k)::numeric+log(1+.025*coalesce((s->'items'->k->>'level')::numeric,0))+(s->'legacyBonuses'->>k)::numeric+log(factor);
  logs:=array_append(logs,v);
 end loop;
 select max(x) into hi from unnest(logs) x;
 foreach v in array logs loop if v-hi>=-40 then total:=total+power(10::numeric,v-hi); end if; end loop;
 return hi+log(total);
end $$;

create or replace function public.commit_player_save(p_data jsonb,p_revision text,p_owner uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s jsonb; r bigint; score numeric;
begin
 if auth.uid() is null or not public.is_google_player() or p_owner is distinct from auth.uid() then raise exception 'Account changed' using errcode='42501'; end if;
 if p_revision is null or p_revision !~ '^[0-9]+$' then raise exception 'Invalid revision'; end if;
 s:=public.validate_game_save(p_data);score:=public.game_power_log(s);
 if p_revision='0' then
  insert into public.player_saves(user_id,save_data,power_log) values(auth.uid(),p_data,score) on conflict(user_id) do nothing returning revision into r;
 else
  update public.player_saves set save_data=p_data,power_log=score,revision=revision+1,updated_at=clock_timestamp() where user_id=auth.uid() and revision=p_revision::bigint returning revision into r;
 end if;
 if r is null then raise exception 'SAVE_CONFLICT' using errcode='40001'; end if;
 return jsonb_build_object('revision',r::text);
end $$;

create or replace function public.read_player_save() returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select jsonb_build_object('data',save_data,'revision',revision::text,'updated_at',updated_at) into result from public.player_saves where user_id=auth.uid();
 return result;
end $$;

-- Only these RPCs disclose public names/power, never private saves or auth IDs.
create or replace function public.leaderboard_page(p_offset integer default 0) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_offset is null or p_offset<0 or p_offset>10000 or p_offset%100<>0 then raise exception 'Invalid page'; end if;
 -- Window functions rank the full result BEFORE LIMIT/OFFSET. Never add the offset again.
 select coalesce(jsonb_agg(jsonb_build_object('position',x.position::text,'username',x.username,'power_log',x.power_log::text,'updated_at',x.updated_at,'is_self',x.user_id=auth.uid(),'verified',false) order by x.position),'[]') into result from (
  select row_number() over(order by s.power_log desc,s.user_id) position,s.user_id,p.username,s.power_log,s.updated_at from public.player_saves s join public.player_profiles p using(user_id) order by s.power_log desc,s.user_id limit 100 offset p_offset
 ) x;
 return result;
end $$;
create or replace function public.my_rank() returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select jsonb_build_object('position',(1+(select count(*) from public.player_saves b where b.power_log>s.power_log or (b.power_log=s.power_log and b.user_id<s.user_id)))::text,'username',p.username,'power_log',s.power_log::text,'updated_at',s.updated_at,'verified',false) into result from public.player_saves s join public.player_profiles p using(user_id) where s.user_id=auth.uid();
 return result;
end $$;
-- Trusted SQL Editor owner; clients must never own or inherit this role.
alter table public.player_profiles owner to postgres;
alter table public.player_saves owner to postgres;
alter function public.is_google_player() owner to postgres;
alter function public.register_player(text,uuid) owner to postgres;
alter function public.commit_player_save(jsonb,text,uuid) owner to postgres;
alter function public.read_player_save() owner to postgres;
alter function public.leaderboard_page(integer) owner to postgres;
alter function public.my_rank() owner to postgres;
alter function public.validate_game_save(jsonb) owner to postgres;
alter function public.valid_game_integer(jsonb,numeric) owner to postgres;
alter function public.game_power_log(jsonb) owner to postgres;
revoke all on function public.is_google_player(),public.register_player(text,uuid),public.commit_player_save(jsonb,text,uuid),public.read_player_save(),public.leaderboard_page(integer),public.my_rank(),public.validate_game_save(jsonb),public.valid_game_integer(jsonb,numeric),public.game_power_log(jsonb) from public,anon,authenticated;
grant execute on function public.register_player(text,uuid),public.commit_player_save(jsonb,text,uuid),public.read_player_save(),public.leaderboard_page(integer),public.my_rank() to authenticated;
commit;
