import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const PORT=8787;
const __filename=fileURLToPath(import.meta.url);
const ROOT=path.dirname(__filename);
function send(res,status,body,type){res.writeHead(status,{'Content-Type':type||'text/plain'});res.end(body)}
function serve(req,res){let p=new URL(req.url,'http://localhost:'+PORT+'/').pathname;let f=path.join(ROOT,p);if(f.endsWith('/'))f=path.join(f,'index.html');if(!f.startsWith(ROOT))return send(res,403,'Forbidden');fs.stat(f,(e,st)=>{if(e||!st.isFile())return send(res,404,'Not Found');const ext=path.extname(f).toLowerCase();const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};fs.readFile(f,(err,data)=>{if(err)return send(res,500,'Error');send(res,200,data,types[ext]||'application/octet-stream')});});}
http.createServer(serve).listen(PORT,()=>{console.log('dev server on http://localhost:'+PORT+'/')});
