import {createRooms} from './rooms.mjs';

export function roomApi({origin = process.env.TABLE_ORIGIN} = {}) {
  const rooms = createRooms();
  return async (req,res,path) => {
    const requestOrigin = req.headers.origin;
    const sameOrigin = requestOrigin === `http://${req.headers.host}` || requestOrigin === `https://${req.headers.host}`;
    const allowed = !requestOrigin || sameOrigin || requestOrigin === origin;
    const headers = {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin'};
    if (requestOrigin && allowed) headers['Access-Control-Allow-Origin'] = requestOrigin;
    function send(status,body) {
      res.writeHead(status,headers);
      res.end(JSON.stringify(body));
    }
    if (!allowed) return send(403,{error:'Доступ с этого сайта не настроен.'});
    if (req.method === 'OPTIONS') {
      res.writeHead(204,{...headers,'Access-Control-Allow-Methods':'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers':'Authorization, Content-Type'});
      return res.end();
    }
    let body = {};
    if (req.method === 'POST') {
      let input = '';
      try {
        for await (const chunk of req) {
          input += chunk;
          if (input.length > 2048) return send(413,{error:'Слишком большой запрос.'});
        }
        body = JSON.parse(input || '{}');
      } catch {
        return send(400,{error:'Некорректный запрос.'});
      }
    }
    const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : '';
    const response = rooms({method:req.method,path,token,body});
    return send(response.status,response.body);
  };
}
