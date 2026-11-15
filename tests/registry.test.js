import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import worker,{RoomRegistry} from '../cloudflare/registry.mjs';

test('registry admits one authenticated host, expires it and ignores stale shutdowns', async t => {
  t.mock.timers.enable({apis:['Date'],now:0});
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  const sql = {exec:(query,...args) => db.prepare(query).all(...args)};
  const registry = new RoomRegistry({storage:{sql}});
  const site = 'https://verydeepwell.github.io';
  const key = 'test-only-host-key';
  const env = {TABLE_ORIGIN:site,HOST_KEY:key,REGISTRY:{idFromName:name => name,get:() => registry}};
  const first = {session:'a'.repeat(32),origin:'https://one.trycloudflare.com'};
  const second = {session:'b'.repeat(32),origin:'https://two.trycloudflare.com'};
  const request = (method,body,token) => worker.fetch(new Request('https://registry.example/host',{
    method,headers:{Origin:site,...token && {Authorization:'Bearer ' + token}},
    body:body && JSON.stringify(body),
  }),env);

  assert.equal((await request('PUT',first,'wrong')).status,401);
  assert.equal((await request('PUT',{...first,origin:'https://trycloudflare.com.evil.example'},key)).status,400);
  assert.equal((await request('PUT',first,key)).status,200);
  const lookup = await request('GET');
  assert.equal(lookup.headers.get('Access-Control-Allow-Origin'),site);
  assert.deepEqual(await lookup.json(),{origin:first.origin});
  assert.equal((await request('PUT',second,key)).status,409);
  t.mock.timers.tick(30_000);
  assert.equal((await request('PUT',first,key)).status,200);
  t.mock.timers.tick(30_000);
  assert.equal((await request('PUT',second,key)).status,409);
  t.mock.timers.tick(15_001);
  assert.deepEqual(await (await request('GET')).json(),{origin:null});
  assert.equal((await request('PUT',second,key)).status,200);
  assert.equal((await request('DELETE',first,key)).status,200);
  assert.deepEqual(await (await request('GET')).json(),{origin:second.origin});
  assert.equal((await request('DELETE',second,key)).status,200);
  assert.deepEqual(await (await request('GET')).json(),{origin:null});
});
