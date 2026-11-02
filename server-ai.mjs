import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createAIService} from './ai-provider-server.mjs';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.json':'application/json','.woff2':'font/woff2'};
export function createApp({root,ai=null}={}){
 root=path.resolve(root);ai=ai||createAIService({budgetPath:path.join(root,'.yesdetail-ai-budget.json')});
 const token=randomUUID();
 const json=(res,code,body)=>res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}).end(JSON.stringify(body));
 return http.createServer(async(req,res)=>{
  try{
   const host=req.headers.host||'';if(!/^(127\.0\.0\.1|localhost):\d+$/.test(host)){json(res,403,{error:'로컬 접속만 지원합니다.'});return}
   const pathname=decodeURIComponent(new URL(req.url,'http://'+host).pathname);
   if(pathname.startsWith('/api/')){
    if(req.headers.origin&&req.headers.origin!=='http://'+host){json(res,403,{error:'다른 사이트의 요청을 차단했습니다.'});return}
    if(req.headers['sec-fetch-site']==='cross-site'){json(res,403,{error:'외부 요청을 차단했습니다.'});return}
    if(pathname==='/api/ai/status'&&req.method==='GET'){json(res,200,{...ai.status(),token});return}
    if(pathname!=='/api/ai/generate'||req.method!=='POST'){json(res,404,{error:'지원하지 않는 요청입니다.'});return}
    if(req.headers['x-yesdetail-token']!==token||!(req.headers['content-type']||'').startsWith('application/json')){json(res,403,{error:'화면을 저장한 뒤 다시 열어 주세요.'});return}
    let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>8000000){json(res,413,{error:'분석 사진 크기가 너무 큽니다.'});return}chunks.push(chunk)}
    let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{json(res,400,{error:'요청 형식을 확인하세요.'});return}
    const abort=new AbortController();res.on('close',()=>{if(!res.writableEnded)abort.abort()});
    const result=await ai.generate(body,abort.signal);if(!res.destroyed)json(res,200,result);return;
   }
   if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return}
   const parts=pathname.split('/');if(parts.some(p=>p.startsWith('.')&&p.length>1)||/\.(env|ps1|cmd|log|bak)$/i.test(pathname)||/^\/(server|ai-provider-server)/.test(pathname)){res.writeHead(403).end();return}
   const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
   const content=await readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}).end(req.method==='HEAD'?undefined:content);
  }catch(error){if(!res.destroyed)json(res,error.status||500,{error:error.status?error.message:'요청 처리에 실패했습니다. 원본 작업은 유지됩니다.'})}
 });
}
