import{validateDraft}from'./ai-draft-contract.mjs';
export function setupAI({getState,applyDraft,page,tell,findPhotos}){
 const $=s=>document.querySelector(s);let service=null,pending=null,controller=null,busy=false;
 const provider=()=>$('#ai-provider').value;
 const name=p=>p==='openai'?'OpenAI · 유료':'Gemini · 무료 등급 전용';
 const errorText=async response=>{let body;try{body=await response.json()}catch{}throw Error(body?.error||'AI 서버를 사용할 수 없습니다. 작업을 저장한 뒤 AI 연결 실행.cmd를 실행하세요.')};
 async function refresh(){try{const res=await fetch('/api/ai/status',{cache:'no-store'});if(!res.ok)return await errorText(res);service=await res.json();showStatus()}catch{service=null;$('#ai-connection-status').textContent='AI 서버 미연결 · 작업을 저장한 뒤 소스 폴더의 AI 연결 실행.cmd를 실행하세요.'}}
 function showStatus(){const s=service?.[provider()];$('#ai-connection-status').textContent=!s?'AI 서버 미연결':s.stopped?'한도 도달 · 자동 전환 없이 중지':s.enabled?name(provider())+' 설정됨 · 오늘 안전 제한 '+(s.budget?.used??0)+'/'+(s.budget?.limit??6)+'회 · 자동 전환 없음':'API 키/실행 설정 필요 · AI 연결 실행.cmd';}
 $('#ai-provider').onchange=()=>{pending=null;$('#gemini-model-label').hidden=provider()!=='gemini';showStatus()};
 $('#ai-plan').onclick=()=>{$('#ai-dialog').showModal();refresh()};$('#close-ai-plan').onclick=()=>$('#ai-dialog').close();$('#refresh-ai').onclick=refresh;
 function selectedPhotos(){return[...$('#ai-photo-choices').querySelectorAll('input:checked')].map(input=>getState().photos[Number(input.value)])}
 async function resized(photo){const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('사진을 읽지 못했습니다.'));img.src=photo.src});const ratio=Math.min(1,1024/Math.max(img.naturalWidth,img.naturalHeight));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(img.naturalHeight*ratio));const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);return{src:canvas.toDataURL('image/jpeg',.86)}}
 function setBusy(value){busy=value;$('#send-ai').disabled=value;$('#ai-provider').disabled=value;$('#generate').disabled=value;$('#ai-photo-choices').querySelectorAll('input').forEach(x=>x.disabled=value);$('#ai-working').textContent=value?'사진과 제목을 분석하고 설명·디자인을 구성 중입니다…':'';}
 $('#generate').onclick=async()=>{
  const state=getState();if(!state.product.name.trim()){tell('상품명을 입력하세요.');return}if(!state.photos.length){await findPhotos?.();return}
  await refresh();$('#ai-selected-provider').textContent=name(provider())+(provider()==='gemini'?' · '+$('#gemini-model').value:'');$('#ai-request-error').textContent='';$('#ai-photo-choices').replaceChildren();
  state.photos.forEach((photo,index)=>{const label=document.createElement('label');label.className='ai-photo-choice';const box=document.createElement('input');box.type='checkbox';box.value=index;box.checked=index<3;box.setAttribute('aria-label',(index+1)+'번 사진 분석');const img=document.createElement('img');img.src=photo.src;img.alt='';const text=document.createElement('span');text.textContent=(index+1)+'. '+(photo.name||'사진');label.append(box,img,text);$('#ai-photo-choices').append(label)});
  $('#ai-paid-consent').checked=false;$('#ai-paid-row').hidden=provider()!=='openai';$('#ai-send-dialog').showModal();
 };
 $('#send-ai').onclick=async()=>{
  if(busy)return;const p=provider(),chosen=selectedPhotos();$('#ai-request-error').textContent='';
  if(chosen.length<1||chosen.length>3){$('#ai-request-error').textContent='분석할 사진을 1~3장 선택하세요.';return}
  if(p==='openai'&&!$('#ai-paid-consent').checked){$('#ai-request-error').textContent='OpenAI는 유료입니다. 이번 요청의 유료 사용을 확인하세요.';return}
  if(!service?.[p]?.enabled||service[p].stopped){$('#ai-request-error').textContent=service?.[p]?.stopped||'키를 설정해야 사용할 수 있습니다. AI 연결 실행.cmd를 실행하세요.';return}
  const original=JSON.stringify(getState());controller=new AbortController();setBusy(true);
  try{
   const images=await Promise.all(chosen.map(resized));if(controller.signal.aborted)return;
   const response=await fetch('/api/ai/generate',{method:'POST',headers:{'Content-Type':'application/json','X-YesDetail-Token':service.token},body:JSON.stringify({provider:p,model:p==='gemini'?$('#gemini-model').value:undefined,paidConsent:p==='openai'&&$('#ai-paid-consent').checked,product:getState().product,photos:images}),signal:controller.signal});
   if(!response.ok)return await errorText(response);const result=await response.json();validateDraft(result.draft);
   if(original!==JSON.stringify(getState()))throw Error('생성 중 상품이 바뀌었습니다. 오래된 결과를 적용하지 않았습니다.');
   pending={original,draft:result.draft};const previewState=JSON.parse(original);previewState.draft=result.draft;
   $('#ai-review-items').replaceChildren();for(const item of result.draft.review){const li=document.createElement('li');li.textContent=item;$('#ai-review-items').append(li)}
   if(!result.draft.review.length)$('#ai-review-items').textContent='추가 확인 후보가 없습니다. 생성 문구와 사진은 직접 검토하세요.';
   $('#ai-draft-preview').innerHTML=page(previewState);$('#ai-result-provider').textContent=name(p)+' · 원본은 적용 전까지 유지됩니다';$('#ai-send-dialog').close();$('#ai-result-dialog').showModal();
  }catch(e){$('#ai-request-error').textContent=e.name==='AbortError'?'생성을 취소했습니다. 기존 작업은 유지됩니다.':e.message;tell($('#ai-request-error').textContent)}finally{setBusy(false);controller=null;refresh()}
 };
 function cancelRequest(){controller?.abort();$('#ai-send-dialog').close();tell('생성을 취소했습니다. 기존 작업은 유지됩니다. 이미 전송된 요청은 사용량이 발생할 수 있습니다.')}
 $('#cancel-ai').onclick=cancelRequest;$('#ai-send-dialog').addEventListener('cancel',()=>controller?.abort());
 $('#discard-ai').onclick=()=>{pending=null;$('#ai-result-dialog').close();tell('AI 결과를 적용하지 않았습니다.')};$('#ai-result-dialog').addEventListener('cancel',()=>{pending=null});
 $('#apply-ai').onclick=()=>{if(!pending)return;if(pending.original!==JSON.stringify(getState())){tell('작업이 바뀌어 오래된 결과를 적용하지 않았습니다.');pending=null;$('#ai-result-dialog').close();return}applyDraft(pending.draft);pending=null;$('#ai-result-dialog').close();tell('AI 설명·디자인을 적용했습니다. 실행 취소 한 번으로 복원할 수 있습니다. 프로젝트로 저장하세요.')};
 refresh();
 return{open:()=>$('#generate').onclick()};
}
