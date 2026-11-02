// Existing database/keys remain compatible with older projects.
export function createProjectStore(indexedDB) {
 let opening,queue=Promise.resolve();const observed=new Map();
 const guarded=key=>key==='ddr3-studio-v1'||key==='yesdetail-capture-v1';
 const fingerprint=value=>JSON.stringify(value)??'undefined';
 function open(){
  if(!opening)opening=new Promise((resolve,reject)=>{
   const request=indexedDB.open('yesdetail-projects',1);
   request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('projects'))request.result.createObjectStore('projects');};
   request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();opening=undefined;};resolve(db);};
   request.onerror=()=>{opening=undefined;reject(request.error);};
   request.onblocked=()=>{opening=undefined;reject(new Error('다른 예스디테일 창에서 저장소를 사용 중입니다.'));};
  });return opening;
 }
 async function read(key){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction('projects','readonly'),request=tx.objectStore('projects').get(key);tx.oncomplete=()=>{if(guarded(key))observed.set(key,fingerprint(request.result));resolve(request.result);};tx.onabort=()=>reject(tx.error||request.error);tx.onerror=()=>{};});}
 async function write(key,value){const db=await open();return new Promise((resolve,reject)=>{
  const tx=db.transaction('projects','readwrite'),store=tx.objectStore('projects');let conflict;
  const put=()=>store.put(value,key);
  if(guarded(key)&&observed.has(key)){const current=store.get(key);current.onsuccess=()=>{const actual=fingerprint(current.result);if(actual!==observed.get(key)&&actual!==fingerprint(value)){conflict=new Error('다른 탭에서 이 작업을 변경했습니다. 덮어쓰지 않았습니다. 현재 작업을 프로젝트 파일 또는 프로젝트 목록에 저장한 뒤 다시 열어 주세요.');conflict.name='ProjectConflictError';tx.abort();}else put();};}else put();
  tx.oncomplete=()=>{if(guarded(key))observed.set(key,fingerprint(value));resolve();};tx.onabort=()=>reject(conflict||tx.error||new Error('저장 작업이 취소되었습니다.'));tx.onerror=()=>{};
 });}
 function enqueue(fn){const task=queue.then(fn);queue=task.catch(()=>{});return task;}
 return {get:read,set:(key,value)=>enqueue(()=>write(key,value)),
  async list(prefix=''){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction('projects','readonly'),store=tx.objectStore('projects'),keys=store.getAllKeys(),values=store.getAll();tx.oncomplete=()=>resolve(keys.result.map((key,i)=>({key,value:values.result[i]})).filter(row=>String(row.key).startsWith(prefix)));tx.onabort=()=>reject(tx.error);tx.onerror=()=>{};});},
  remove:key=>enqueue(async()=>{const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction('projects','readwrite');tx.objectStore('projects').delete(key);tx.oncomplete=()=>{observed.delete(key);resolve();};tx.onabort=()=>reject(tx.error);tx.onerror=()=>{};});})};
}
export const projectStore=createProjectStore(globalThis.indexedDB);
