import fs from'node:fs';
import{createHash}from'node:crypto';
function day(now){const p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now));return['year','month','day'].map(t=>p.find(x=>x.type===t).value).join('-')}
export function createBudget({file=null,now=Date.now,limit=6,interval=60000}={}){
 let memory={};
 const id=(p,key)=>p+':'+createHash('sha256').update(key).digest('hex').slice(0,16);
 const read=()=>{if(!file)return memory;try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch(e){if(e.code==='ENOENT')return{};throw Error('AI 사용량 기록을 읽지 못해 요청을 중지했습니다.')}};
 function mutate(fn){let lock;try{if(file)lock=fs.openSync(file+'.lock','wx');const all=read(),result=fn(all);if(file){fs.writeFileSync(file+'.tmp',JSON.stringify(all));fs.renameSync(file+'.tmp',file)}else memory=all;return result}finally{if(lock!==undefined){fs.closeSync(lock);fs.unlinkSync(file+'.lock')}}}
 function record(all,p,key){const k=id(p,key),today=day(now());if(!all[k]||all[k].day!==today)all[k]={day:today,count:0,last:0,quota:false,cooldown:0};return all[k]}
 function view(p,key){const all=read(),r=record(all,p,key);return{used:r.count,limit,remaining:Math.max(0,limit-r.count),quota:r.quota,cooldownSeconds:Math.max(0,Math.ceil((Math.max(r.cooldown,r.last? r.last+interval:0)-now())/1000))}}
 function reserve(p,key){return mutate(all=>{const r=record(all,p,key);if(r.quota)throw Object.assign(Error('무료 한도 도달 기록이 있어 오늘은 요청을 중지합니다. 서버를 다시 실행해도 유지됩니다.'),{status:429,code:'QUOTA'});if(r.count>=limit)throw Object.assign(Error('일일 안전 제한 '+limit+'회에 도달했습니다. 실패 요청도 포함하며 유료 전환하지 않습니다.'),{status:429,code:'DAILY_LIMIT'});const wait=Math.ceil((Math.max(r.cooldown,r.last?r.last+interval:0)-now())/1000);if(wait>0)throw Object.assign(Error(wait+'초 뒤 직접 다시 시도할 수 있습니다. 자동 재시도는 하지 않습니다.'),{status:429,code:'COOLDOWN'});r.count++;r.last=now();return r.count})}
 function mark(p,key,code){return mutate(all=>{const r=record(all,p,key);if(code==='QUOTA')r.quota=true;if(code==='UNAVAILABLE'||code==='TIMEOUT')r.cooldown=now()+120000})}
 return{view,reserve,mark};
}
