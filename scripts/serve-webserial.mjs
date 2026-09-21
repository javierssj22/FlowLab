// Static frontend only: no Python, serial proxy, commands or project storage.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
const root=fileURLToPath(new URL('../web/',import.meta.url));
const port=8766;
const mime={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
createServer(async(req,res)=>{
  const origin=`http://127.0.0.1:${port}`;
  if(req.headers.host!==`127.0.0.1:${port}`||req.headers.origin&&req.headers.origin!==origin){res.writeHead(403);res.end();return;}
  try{
    if(req.method!=='GET')throw Error('method');
    const pathname=decodeURIComponent(new URL(req.url,origin).pathname);
    const path=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!path.startsWith(resolve(root)+sep)||!mime[extname(path)])throw Error('path');
    const data=await readFile(path);
    res.writeHead(200,{'Content-Type':mime[extname(path)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'"});res.end(data);
  }catch{res.writeHead(404,{'Content-Type':'application/json'});res.end('{"error":"Static WebSerial mode: no backend API"}');}
}).listen(port,'127.0.0.1',()=>console.log(`FlowLab WebSerial: http://127.0.0.1:${port}\nAbre esta URL en Chrome o Edge. Ctrl+C para cerrar.`));
