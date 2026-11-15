const leaseMs = 45_000;
const tunnelPattern = /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/;
const sessionPattern = /^[a-f0-9]{32}$/;

function json(data,status = 200) {
  return Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
}

export default {
  async fetch(request,env) {
    const origin = request.headers.get('Origin');
    if (new URL(request.url).pathname !== '/host') return json({error:'Not found'},404);
    if (request.method !== 'GET') {
      if (!env.HOST_KEY || request.headers.get('Authorization') !== 'Bearer ' + env.HOST_KEY) {
        return json({error:'Invalid host key'},401);
      }
      if (!['PUT','DELETE'].includes(request.method)) return json({error:'Method not allowed'},405);
    }
    const response = await env.REGISTRY.get(env.REGISTRY.idFromName('active-host')).fetch(request);
    if (request.method !== 'GET' || origin !== env.TABLE_ORIGIN) return response;
    const headers = new Headers(response.headers);
    headers.set('Access-Control-Allow-Origin',origin);
    headers.set('Vary','Origin');
    return new Response(response.body,{status:response.status,headers});
  },
};

export class RoomRegistry {
  constructor(ctx) {
    this.sql = ctx.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS host (id INTEGER PRIMARY KEY CHECK (id = 1), session TEXT NOT NULL, origin TEXT NOT NULL, expires INTEGER NOT NULL)');
  }

  async fetch(request) {
    if (request.method === 'GET') {
      const [host] = this.sql.exec('SELECT origin FROM host WHERE expires > ?',Date.now());
      return json({origin:host?.origin ?? null});
    }

    let data;
    try { data = await request.json(); }
    catch { return json({error:'Invalid JSON'},400); }
    const {session,origin} = data || {};
    if (typeof session !== 'string' || !sessionPattern.test(session)) return json({error:'Invalid session'},400);
    if (request.method === 'DELETE') {
      this.sql.exec('DELETE FROM host WHERE session = ?',session);
      return json({ok:true});
    }
    if (typeof origin !== 'string' || !tunnelPattern.test(origin)) return json({error:'Invalid tunnel address'},400);
    const now = Date.now();
    const [active] = this.sql.exec('SELECT session FROM host WHERE expires > ?',now);
    if (active && active.session !== session) return json({error:'Another host is already online'},409);
    this.sql.exec('INSERT OR REPLACE INTO host (id, session, origin, expires) VALUES (1, ?, ?, ?)',session,origin,now + leaseMs);
    return json({ok:true});
  }
}
