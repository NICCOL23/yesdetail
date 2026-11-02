const PREFIX='yesdetail-library:';
const el=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
function readState(value){try{return typeof value==='string'?JSON.parse(value):value;}catch{return null;}}
function kindOf(p){return p?.kind==='yesdetail-capture'?'capture':p?.product&&Array.isArray(p.sections)?'product':null;}
function titleOf(p){return p?.name||p?.product?.name||'이름 없는 작업';}
function thumbOf(p){const src=p?.captures?.[0]?.src||p?.photos?.[0]?.src;return typeof src==='string'&&(/^(data:image\/(png|jpeg|webp);base64,|assets\/)/.test(src))?src:null;}
export function mountProjectLibrary({host,store,kind,getState,loadState,status}){
 const openButton=el('button','프로젝트 목록');openButton.type='button';openButton.id='project-library-button';host.append(openButton);
 const dialog=el('dialog');dialog.id='project-library-dialog';dialog.setAttribute('aria-label','프로젝트와 백업 목록');dialog.style.cssText='width:min(900px,94vw);max-height:90vh;overflow:auto;padding:24px;font:16px/1.7 Pretendard,Malgun Gothic,sans-serif';document.body.append(dialog);
 async function saveRecord(type='project',suggested){
  const current=getState(),name=suggested??titleOf(current);
  const key=PREFIX+crypto.randomUUID(),now=Date.now();await store.set(key,{kind,type,name:String(name).trim().slice(0,100)||titleOf(current),updatedAt:now,thumbnail:thumbOf(current),state:current});return key;
 }
 async function draw(){
  dialog.replaceChildren();const head=el('h2','프로젝트와 백업'),hint=el('p','현재 작업을 이름으로 보관하거나 이전 프로젝트를 복원하세요. 복원 전 현재 작업도 자동 백업합니다.');hint.style.fontSize='14px';const nameLabel=el('label','프로젝트 이름'),nameInput=el('input');nameInput.value=titleOf(getState());nameInput.maxLength=100;nameInput.style.cssText='display:block;width:100%;padding:10px;margin:8px 0 16px;font:inherit';nameLabel.append(nameInput);const save=el('button','현재 작업을 새 이름으로 보관'),close=el('button','닫기'),list=el('div');
  save.type=close.type='button';close.onclick=()=>dialog.close();save.onclick=async()=>{try{const key=await saveRecord('project',nameInput.value);if(key){status('프로젝트 목록에 보관했습니다.');await draw();}}catch(e){status('프로젝트 보관 실패: '+e.message);}};dialog.append(head,hint,nameLabel,save,close,list);close.style.marginLeft='8px';
  const library=await store.list(PREFIX),legacy=await store.list(kind==='capture'?'yesdetail-capture-v1-backup-':'ddr3-studio-v1-backup-');
  const previousKey=kind==='capture'?'yesdetail-capture-v1-previous-product':'ddr3-studio-v1-previous-product',previous=readState(await store.get(previousKey));
  const records=library.filter(r=>r.value.kind===kind).map(r=>({...r,...r.value}));
  for(const row of legacy){const state=readState(row.value);if(kindOf(state)!==kind)continue;const stamp=String(row.key).match(/backup-(\d+)/)?.[1];records.push({key:row.key,name:titleOf(state),type:'backup',updatedAt:Number(stamp)||0,state,thumbnail:thumbOf(state)});}
  if(kindOf(previous)===kind)records.push({key:previousKey,name:'이전 작업 · '+titleOf(previous),type:'backup',updatedAt:0,state:previous,thumbnail:thumbOf(previous)});
  records.sort((a,b)=>b.updatedAt-a.updatedAt);if(!records.length)list.append(el('p','아직 보관한 프로젝트가 없습니다.'));
  for(const record of records){const row=el('article');row.style.cssText='display:flex;align-items:center;gap:14px;flex-wrap:wrap;border:1px solid #d8dce2;padding:14px;margin-top:14px;border-radius:8px';
   if(record.thumbnail){const img=el('img');img.src=record.thumbnail;img.alt='';img.width=64;img.height=72;img.style.objectFit='contain';row.append(img);}const info=el('div');info.style.cssText='flex:1;min-width:140px;overflow-wrap:anywhere';info.append(el('strong',record.name),el('div',(record.type==='backup'?'백업':'프로젝트')+' · '+(record.updatedAt?new Date(record.updatedAt).toLocaleString('ko-KR'):'이전 작업')));
   const open=el('button','열기'),remove=el('button','목록에서 삭제');open.type=remove.type='button';open.onclick=async()=>{try{await saveRecord('backup','복원 전 백업 · '+titleOf(getState()));await loadState(record.state);dialog.close();status('프로젝트를 열었습니다. 복원 전 작업도 목록에 백업했습니다.');}catch(e){status('프로젝트 복원 실패: '+e.message);}};
   remove.onclick=async()=>{if(remove.dataset.confirmed!=='yes'){remove.dataset.confirmed='yes';remove.textContent='삭제 확인 · 다시 누르기';return;}try{await store.remove(record.key);await draw();}catch(e){status('삭제 실패: '+e.message);}};row.append(info,open,remove);list.append(row);
  }
 }
 openButton.onclick=async()=>{try{await draw();dialog.showModal();}catch(e){status('프로젝트 목록을 열지 못했습니다: '+e.message);}};
 return {backup:()=>saveRecord('backup','자동 백업 · '+titleOf(getState())),open:openButton};
}
