import{projectStore}from'./project-storage.js';
const channelName='yesdetail-studio-capture-v1';
export async function sendToOpenStudio(key){
 if(!globalThis.BroadcastChannel)return false;
 const ch=new BroadcastChannel(channelName),request=crypto.randomUUID(),offers=[];
 ch.onmessage=e=>{const m=e.data;if(m?.type==='offer'&&m.request===request)offers.push(m)};
 ch.postMessage({type:'probe',request});await new Promise(r=>setTimeout(r,350));
 offers.sort((a,b)=>b.focusedAt-a.focusedAt);const target=offers[0];
 if(!target){ch.close();return false}
 const received=await new Promise(resolve=>{const timer=setTimeout(()=>resolve(false),1500);ch.onmessage=e=>{if(e.data?.type==='received'&&e.data.request===request){clearTimeout(timer);resolve(true)}};ch.postMessage({type:'deliver',request,target:target.id,key})});ch.close();return received;
}
export function setupStudioCaptureTransfer({getPhotos,addPhoto,tell}){
 const id=crypto.randomUUID();let focusedAt=Date.now(),busy=false;
 window.addEventListener('focus',()=>{focusedAt=Date.now()});
 const ch=globalThis.BroadcastChannel?new BroadcastChannel(channelName):null;
 async function receive(key){
  if(busy||!/^capture-transfer-[a-zA-Z0-9-]{1,100}$/.test(key||''))return false;
  busy=true;
  try{const p=await projectStore.get(key);if(!p||p.version!==1||p.id!==key||!Number.isFinite(p.createdAt)||Date.now()-p.createdAt>86400000||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(p.src)||p.src.length>16000000)throw Error('전송 데이터가 없거나 만료·용량 초과입니다. 캡처를 줄여 다시 보내세요.');
   const dialog=document.createElement('dialog');dialog.setAttribute('aria-label','상품 제작 화면에 캡처 추가');dialog.style.cssText='width:min(620px,92vw);max-height:90vh;overflow:auto;padding:24px;border:0;border-radius:12px';
   const h=document.createElement('h2');h.textContent=p.captureNumber+'번 캡처 한 장 추가';const name=document.createElement('p');name.textContent=p.name;const note=document.createElement('p');note.textContent='현재 상품의 정보와 사진을 유지하고, 선택한 캡처를 독립 이미지로 추가합니다. 사진 아래 문구 편집도 사용할 수 있습니다.';const img=document.createElement('img');img.src=p.src;img.alt='받은 캡처 한 장 미리보기';img.style.cssText='display:block;max-width:100%;max-height:300px;object-fit:contain;margin:12px auto';const status=document.createElement('p');status.setAttribute('role','status');const add=document.createElement('button');add.textContent='현재 상품에 캡처 추가';add.className='primary';const cancel=document.createElement('button');cancel.textContent='취소';const existing=getPhotos().some(photo=>photo.src===p.src);if(existing){status.textContent='같은 이미지가 이미 있습니다. 중복 추가하지 않습니다.';add.disabled=true}
   add.onclick=()=>{if(add.disabled)return;add.disabled=true;try{if(getPhotos().some(photo=>photo.src===p.src))throw Error('같은 이미지가 이미 있습니다.');addPhoto({id:crypto.randomUUID(),name:'캡처-'+p.name,src:p.src,kind:'product',fromCapture:true});tell('선택한 캡처 한 장을 추가했습니다. 실행 취소로 복원하고 프로젝트로 저장할 수 있습니다.');dialog.close()}catch(e){status.textContent=e.message;add.disabled=false}};
   cancel.onclick=()=>dialog.close();dialog.append(h,name,note,img,status,add,cancel);document.body.append(dialog);dialog.addEventListener('close',()=>{busy=false;dialog.remove();const u=new URL(location.href);if(u.searchParams.get('studioCapture')===key){u.searchParams.delete('studioCapture');history.replaceState(null,'',u.pathname+u.search+u.hash)}},{once:true});dialog.showModal();return true;
  }catch(e){busy=false;tell('캡처 받기 실패: '+e.message);return false}
 }
 if(ch)ch.onmessage=async e=>{const m=e.data;if(m?.type==='probe'&&!busy)ch.postMessage({type:'offer',request:m.request,id,focusedAt});if(m?.type==='deliver'&&m.target===id){const ok=await receive(m.key);if(ok)ch.postMessage({type:'received',request:m.request})}};
 const key=new URLSearchParams(location.search).get('studioCapture');if(key)receive(key);
}
