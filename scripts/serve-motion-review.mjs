// Local evidence viewer; only allowlisted art/output folders are readable.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd(),allowed=['artifacts/asset-motion','artifacts/asset-static','public/assets/heroes'].map(p=>path.resolve(root,p)+path.sep);
const mime={'.html':'text/html; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.gif':'image/gif','.webm':'video/webm'};
http.createServer((req,res)=>{
 if(req.url==='/'){res.writeHead(302,{Location:'/artifacts/asset-motion/review.html'});res.end();return;}
 try{
  const target=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname));
  if(!allowed.some(dir=>target.startsWith(dir))||!mime[path.extname(target)]){res.writeHead(403);res.end();return;}
  const size=fs.statSync(target).size;let start=0,end=size-1;const range=req.headers.range;
  if(range){const m=/^bytes=(\d+)-(\d*)$/.exec(range);if(!m)throw new Error('Invalid range');start=Number(m[1]);end=m[2]?Math.min(Number(m[2]),end):end;if(start>end){res.writeHead(416,{'Content-Range':`bytes */${size}`});res.end();return;}}
  res.writeHead(range?206:200,{'Content-Type':mime[path.extname(target)],'Content-Length':end-start+1,'Accept-Ranges':'bytes','Cache-Control':'no-store',...(range?{'Content-Range':`bytes ${start}-${end}/${size}`}:{})});
  fs.createReadStream(target,{start,end}).pipe(res);
 }catch{res.writeHead(404);res.end('Not found');}
}).listen(3125,'127.0.0.1',()=>console.log('Classclash motion review http://127.0.0.1:3125'));
