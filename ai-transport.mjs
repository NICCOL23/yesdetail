import{schema,instruction,validateDraft}from'./ai-draft-contract.mjs';
const fault=(message,status=502,code='AI_ERROR')=>Object.assign(Error(message),{status,code});
export function guardUnconfirmedSpecs(draft,product){
 const supplied=JSON.stringify(product).toUpperCase();
 const unsupported=text=>(text.match(/\b(?:SATA|SAS|NVMe|SCSI|\d{3,5}\s*RPM)\b/gi)||[]).filter(term=>!supplied.includes(term.toUpperCase()));
 const seen=new Set();const strip=text=>text.replace(/싱싱한|신선한|신선함을 그대로 담은|엄선하여 준비한|깔끔하게 준비된/g,term=>{if(JSON.stringify(product).includes(term))return term;seen.add(term);return ''}).split(/(?<=[.!?。])\s+|\n+/u).filter(sentence=>{const terms=unsupported(sentence);terms.forEach(t=>seen.add(t));return !terms.length}).join(' ');
 const result={...draft,title:unsupported(draft.title).length?product.name:draft.title,lead:strip(draft.lead),heading:strip(draft.heading),body:strip(draft.body),sections:draft.sections.map(s=>({title:strip(s.title),body:strip(s.body)})).filter(s=>s.title&&s.body),review:[...draft.review]};
 if(!result.body)result.body=product.details||'제품 사진과 제공된 상품 정보를 확인해 주세요.';
 if(!result.heading)result.heading='상품 안내';
 if(seen.size)result.review.push('AI가 언급한 '+[...seen].join(', ')+' 규격은 입력 정보에 없어 출력에서 제외했습니다. 실제 상품 정보 확인 후 입력해 주세요.');
 return result;
}
export async function callProvider({data,model,credential,fetcher,signal}){
 const google=data.provider==='gemini';
 const prompt=instruction+'\n사진에는 공개 검색 참고 이미지가 포함될 수 있다. 사진만으로 실제 판매 제품의 모델, 외관 상태, 원산지, 검수 내역을 확정하지 않는다. 사용자 입력에 없는 해당 정보는 review로 안내한다. '+'\n신선함, 싱싱함, 엄선, 손질 완료, 세척 완료, 검수 완료를 입력 근거 없이 주장하지 않는다. 참고 사진을 실제 판매품으로 표현하지 않는다. 본문은 150~350자, 추가 설명은 최대 2개, 각 100~200자 이내로 간결하게 작성한다.\n사용자 제공 사실(JSON): '+JSON.stringify(data.product);
 const url=google?'https://generativelanguage.googleapis.com/v1beta/models/'+model+':generateContent':'https://api.openai.com/v1/responses';
 const body=google?{contents:[{role:'user',parts:[{text:prompt},...data.photos.map(photo=>({inline_data:{mime_type:photo.src.slice(5,photo.src.indexOf(';')),data:photo.src.split(',')[1]}}))]}],generationConfig:{maxOutputTokens:4096,responseFormat:{text:{mimeType:'APPLICATION_JSON',schema}}}}:{model,store:false,reasoning:{effort:'low'},max_output_tokens:5000,input:[{role:'user',content:[{type:'input_text',text:prompt},...data.photos.map(photo=>({type:'input_image',image_url:photo.src,detail:'auto'}))]}],text:{format:{type:'json_schema',name:'product_page',strict:true,schema}}};
 let response;
 try{response=await fetcher(url,{method:'POST',headers:{'Content-Type':'application/json',...(google?{'x-goog-api-key':credential}:{Authorization:'Bearer '+credential})},body:JSON.stringify(body),signal:AbortSignal.any([AbortSignal.timeout(75000),...(signal?[signal]:[])])})}
 catch(error){if(error.name==='AbortError'||error.name==='TimeoutError')throw fault('AI 응답 대기 시간이 초과되었거나 취소되었습니다. 자동 재시도하지 않습니다.',408,'TIMEOUT');if(['UNABLE_TO_VERIFY_LEAF_SIGNATURE','SELF_SIGNED_CERT_IN_CHAIN'].includes(error.cause?.code))throw fault('인증서를 신뢰하지 못했습니다. Gemini 무료 연결.cmd로 다시 실행하세요.',502,'CERTIFICATE');throw fault('AI 서버에 연결하지 못했습니다. 키는 노출하지 않았고 자동 재시도하지 않습니다.',502,'NETWORK')}
 let payload;try{payload=await response.json()}catch{throw fault('AI 서버 응답 형식이 JSON이 아닙니다.',502,'INVALID_RESPONSE')}
 if(!response.ok){
  if([429,402].includes(response.status))throw fault('무료 사용 한도 또는 요금 제한에 도달했습니다. 오늘은 중지하며 다른 모델·유료 AI로 자동 전환하지 않습니다.',429,'QUOTA');
  if(response.status===503)throw fault('Google AI 서버가 일시적으로 요청을 처리하지 못했습니다(503). 2분간 요청을 막으며 자동 전환하지 않습니다.',503,'UNAVAILABLE');
  if([401,403].includes(response.status))throw fault('API 키 또는 프로젝트 권한이 거부되었습니다. 무료 프로젝트의 키인지 확인하세요.',403,'AUTH');
  if(response.status===404)throw fault('선택한 모델을 이 API에서 사용할 수 없습니다. 무료 모델 설정을 확인하세요.',502,'MODEL_NOT_FOUND');
  if(response.status===400){const invalid=JSON.stringify(payload.error||{}).includes('API_KEY_INVALID')||/API key not valid/i.test(payload.error?.message||'');throw fault(invalid?'API 키가 Google에서 유효하지 않다고 확인됐습니다. 키 전체를 다시 복사하세요.':'Google이 요청 형식을 거부했습니다(400). 모델과 입력 형식을 점검해야 합니다.',400,invalid?'INVALID_KEY':'INVALID_REQUEST')}
  throw fault('AI 서버가 요청을 처리하지 못했습니다 ('+response.status+').',502,'UPSTREAM_ERROR');
 }
 const text=google?(payload.candidates?.[0]?.content?.parts||[]).filter(x=>typeof x.text==='string'&&!x.thought).map(x=>x.text).join(''):(payload.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('');
 if(google&&payload.candidates?.[0]?.finishReason!=='STOP')throw fault('AI 응답이 끝나지 않았거나 차단됐습니다. 미완성 결과는 적용하지 않습니다.',502,'INCOMPLETE');
 if(!google&&payload.status!=='completed')throw fault('AI 응답이 완료되지 않았습니다.',502,'INCOMPLETE');
 let parsed;try{parsed=JSON.parse(text)}catch{throw fault('AI 문구를 구조화된 결과로 읽지 못했습니다. 원본은 유지됩니다.',502,'INVALID_JSON')}
 try{return{draft:guardUnconfirmedSpecs(validateDraft(parsed),data.product),usage:payload.usageMetadata||payload.usage||null}}catch{throw fault('AI 응답의 필수 항목이나 문구 길이가 맞지 않습니다. 원본은 유지됩니다.',502,'INVALID_DRAFT')}
}
