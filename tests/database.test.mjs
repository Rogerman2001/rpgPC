import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {freshState} from '../js/save.js';
import {encodeCloud,totalPower} from '../js/cloud-data.js';
const db=new PGlite(),a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002';
await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create table auth.identities(user_id uuid references auth.users(id),provider text);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;insert into auth.users values('${a}'),('${b}');insert into auth.identities values('${a}','google'),('${b}','google');`);
const sql=await readFile('supabase/migrations/202610180001_accounts.sql','utf8');await db.exec(sql);await db.exec(sql);
async function asUser(uid,query,args=[]){await db.exec('set role '+(uid?'authenticated':'anon'));await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid||'']);try{return await db.query(query,args);}finally{await db.exec('reset role');}}
const rpc=(uid,name,args)=>{if(name==='register_player')args=[...args,uid];return asUser(uid,`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as result`,args).then(r=>r.rows[0].result);};
let count=0;
await assert.rejects(rpc(null,'register_player',['Nobody']));count++;
const nongoogle='00000000-0000-0000-0000-000000000003';await db.query('insert into auth.users values($1)',[nongoogle]);await assert.rejects(rpc(nongoogle,'register_player',['NoGoogle']),e=>e.code==='42501');count++;
assert.equal(await rpc(a,'register_player',['BURX_Master']),'BURX_Master');count++;
await assert.rejects(rpc(b,'register_player',['burx_master']));await assert.rejects(rpc(b,'register_player',['Admin']));await assert.rejects(rpc(b,'register_player',[' x ']));count+=3;
await rpc(b,'register_player',['Other_Player']);assert.equal(await rpc(a,'register_player',['NewName']),'BURX_Master');count++;
const s=freshState(),doc=encodeCloud(s);
assert.equal(await rpc(a,'read_player_save',[]),null);count++;
assert.deepEqual(await rpc(a,'commit_player_save',[doc,'0',a]),{revision:'1'});count++;
await assert.rejects(rpc(a,'commit_player_save',[doc,'0',a]),e=>e.code==='40001');count++;
await assert.rejects(rpc(b,'commit_player_save',[doc,'1',a]),e=>e.code==='42501');count++;
assert.equal((await asUser(b,'select * from public.player_saves')).rows.length,0);count++;
assert.equal((await asUser(b,'select * from public.player_profiles')).rows.length,1);count++;
await assert.rejects(asUser(b,'update public.player_profiles set username=$1 where user_id=$2',['Hack',a]));count++;
await assert.rejects(asUser(a,'update public.player_saves set power_log=9999'));count++;
await assert.rejects(rpc(a,'commit_player_save',[{format:1,payload:'{}'},'1',a]));count++;
const invalid=JSON.parse(doc.payload);invalid.bosses.attack.highest=10;await assert.rejects(rpc(a,'commit_player_save',[{...doc,payload:JSON.stringify(invalid)},'1',a]));count++;
const row=await rpc(a,'read_player_save',[]);assert.equal(row.revision,'1');assert.equal(row.data.payload,doc.payload);count++;
await rpc(b,'commit_player_save',[doc,'0',b]);let rank=await rpc(b,'leaderboard_page',[0]);assert.deepEqual(rank.map(r=>r.username),['BURX_Master','Other_Player']);assert.equal(rank[1].position,'2');assert.equal((await rpc(b,'my_rank',[])).position,'2');assert.ok(!JSON.stringify(rank).includes('user_id'));assert.ok(rank.every(r=>!r.verified));count+=4;
assert.ok(Math.abs(Number(rank[0].power_log)-totalPower(s).log)<1e-12);count++;
s.levels.attack=100000;await rpc(b,'commit_player_save',[encodeCloud(s),'1',b]);rank=await rpc(a,'leaderboard_page',[0]);assert.equal(rank[0].username,'Other_Player');assert.ok(Number(rank[0].power_log)>5000);count++;
assert.equal((await rpc(a,'leaderboard_page',[100])).length,0);await assert.rejects(rpc(a,'leaderboard_page',[-1]));await assert.rejects(rpc(null,'leaderboard_page',[0]));count+=3;
// Two devices sharing a revision: first accepted, second explicitly rejected.
await rpc(a,'commit_player_save',[doc,'1',a]);await assert.rejects(rpc(a,'commit_player_save',[doc,'1',a]),e=>e.code==='40001');count++;
await assert.rejects(asUser(null,'select * from public.player_saves'));count++;
await db.query('update public.player_saves set revision=9007199254740993 where user_id=$1',[a]);
assert.equal((await rpc(a,'read_player_save',[])).revision,'9007199254740993');
assert.equal((await rpc(a,'commit_player_save',[doc,'9007199254740993',a])).revision,'9007199254740994');count+=2;
for(let i=10;i<260;i++){
 const id='00000000-0000-0000-0000-'+String(i).padStart(12,'0');
 await db.query('insert into auth.users values($1)',[id]);await db.query("insert into auth.identities values($1,'google')",[id]);await rpc(id,'register_player',['Tester_'+i]);await rpc(id,'commit_player_save',[doc,'0',id]);
}
// 252 players, ties on every page and a stronger player ordered first.
const pages=[0,100,200];
const all=[];
for(const offset of pages){
 const page=await rpc(a,'leaderboard_page',[offset]);
 assert.equal(page.length,offset===200?52:100);
 assert.deepEqual(page.map(r=>r.position),Array.from({length:page.length},(_,i)=>String(offset+i+1)));
 all.push(...page); count++;
}
assert.equal(new Set(all.map(r=>r.username)).size,252);
assert.ok(all.every(r=>r.verified===false));
assert.equal((await rpc('00000000-0000-0000-0000-000000000259','my_rank',[])).position,'252');
assert.deepEqual(await rpc(a,'leaderboard_page',[300]),[]);
await assert.rejects(rpc(a,'leaderboard_page',[null]));count+=5;
// Missing envelope fields must fail closed, including SQL NULL.
for(const field of ['format','numeric_encoding','payload']){
 const malformed={...doc};delete malformed[field];
 await assert.rejects(rpc(a,'commit_player_save',[malformed,'9007199254740994',a]));count++;
}
await assert.rejects(rpc(a,'commit_player_save',[null,'9007199254740994',a]));count++;
// No helper is callable through RPC, regardless of arguments or JWT presence.
for(const uid of [null,a]){
 for(const expression of ["is_google_player()","valid_game_integer('0'::jsonb,0)","validate_game_save('{}'::jsonb)","game_power_log('{}'::jsonb)"]){
  await assert.rejects(asUser(uid,'select public.'+expression),e=>e.code==='42501');count++;
 }
 for(const table of ['player_profiles','player_saves']){
  for(const privilege of ['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']){
   const result=await db.query('select has_table_privilege($1,$2,$3) allowed',[uid?'authenticated':'anon','public.'+table,privilege]);
   assert.equal(result.rows[0].allowed,false);count++;
  }
 }
}
const functions=(await db.query(`select p.proname, r.rolname owner,p.prosecdef,p.proconfig,
 has_function_privilege('anon',p.oid,'EXECUTE') anon,
 has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_roles r on r.oid=p.proowner
 where n.nspname='public' and p.proname=any($1::text[])`,[['is_google_player','valid_game_integer','validate_game_save','game_power_log','register_player','commit_player_save','read_player_save','leaderboard_page','my_rank']])).rows;
assert.equal(functions.length,9);
for(const f of functions){
 assert.equal(f.owner,'postgres');assert.equal(f.anon,false);
 assert.ok(f.proconfig.includes('search_path=""'));
 const exposed=['register_player','commit_player_save','read_player_save','leaderboard_page','my_rank'].includes(f.proname);
 assert.equal(f.authenticated,exposed);
 assert.equal(f.prosecdef,exposed||f.proname==='is_google_player');count++;
}
for(const role of ['anon','authenticated']){
 assert.equal((await db.query("select pg_has_role($1,'postgres','MEMBER') member",[role])).rows[0].member,false);count++;
}
await assert.rejects(db.exec('update public.player_saves set verified=true'),e=>e.code==='23514');count++;
// Even an authenticated role without a JWT subject must fail every exposed RPC.
await db.exec('set role authenticated');
await db.query("select set_config('request.jwt.claim.sub','',false)");
try{
 for(const expression of ["register_player('Nobody',null)","commit_player_save(null,'0',null)","read_player_save()","leaderboard_page(0)","my_rank()"]){
  await assert.rejects(db.query('select public.'+expression),e=>e.code==='42501');count++;
 }
}finally{await db.exec('reset role');}
// Exact numeric boundary: do not silently accept JS-rounded levels.
assert.equal((await db.query("select public.valid_game_integer('9007199254740991'::jsonb) ok")).rows[0].ok,true);
assert.equal((await db.query("select public.valid_game_integer('9007199254740992'::jsonb) ok")).rows[0].ok,false);count+=2;
// Capability check for the v3 DESIGN; the v2 validator intentionally rejects it.
const futureCounter='9'.repeat(256);
assert.equal((await db.query('select ($1::numeric+1)::text value',[futureCounter])).rows[0].value,'1'+'0'.repeat(256));count++;
// Rerunning with populated tables preserves both saves and ranking.
await db.exec(sql);
assert.equal((await db.query('select count(*)::int n from public.player_saves')).rows[0].n,252);
assert.equal((await rpc(a,'read_player_save',[])).data.payload,doc.payload);
assert.deepEqual(await rpc(a,'leaderboard_page',[100]),all.slice(100,200));count+=3;
console.log(`PostgreSQL/PGlite: ${count} checks passed; 252 players, absolute ranks, fresh/populated migration, owners, grants, RLS, CAS, malformed envelopes and unverified scores. Auth is a fixture; hosted OAuth/PostgREST not tested.`);
await db.close();
