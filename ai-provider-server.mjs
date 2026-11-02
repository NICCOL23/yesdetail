import{MODELS,validateInput}from'./ai-draft-contract.mjs';
import{createBudget}from'./ai-budget.mjs';
import{stat}from'node:fs/promises';
export const FREE_MODELS=Object.freeze(['gemini-3.5-flash-lite','gemini-3.8-flash']);
export function createAIService({env=process.env,fetcher=fetch,now=Date.now,budgetPath=null,budgetLimit=6,budgetInterval=60000}={}){
 let busy=false,lastFailure=null;const budget=createBudget({file:budgetPath,now,limit:budgetLimit,interval:budgetInterval});
 const credential=p=>env[p==='gemini'?'GEMINI_API_KEY':'OPENAI_API_KEY']||'';
 const allowed=p=>p==='gemini'?env.YESDETAIL_GEMINI_FREE_CONFIRMED==='1':env.YESDETAIL_OPENAI_PAID_ENABLED==='1';
 function status(){const result={models:MODELS,freeModels:FREE_MODELS,busy,lastFailure,automaticFallback:false,version:2};for(const p of ['gemini','openai']){let limits;try{limits=budget.view(p,credential(p))}catch{limits={quota:true}}result[p]={configured:!!credential(p),enabled:!!credential(p)&&allowed(p),stopped:limits.quota?'무료 한도 도달 · 오늘은 중지':'',budget:limits}}return result}
 async function generate(raw,signal){
  const data=validateInput(raw),p=data.provider,model=p==='gemini'?(raw.model||MODELS.gemini):MODELS.openai;
  if(p==='gemini'&&!FREE_MODELS.includes(model))throw Object.assign(Error('허용된 무료 모델만 사용할 수 있습니다.'),{status:400});
  if(p==='openai'&&raw.paidConsent!==true)throw Object.assign(Error('이번 OpenAI 유료 요청 확인이 필요합니다.'),{status:403});
  if(!credential(p))throw Object.assign(Error('API 키를 설정하세요.'),{status:503});
  if(!allowed(p))throw Object.assign(Error('무료 프로젝트 확인 또는 유료 모드 명시 허용이 필요합니다.'),{status:403});
  if(!/^[\x21-\x7E]{20,5000}$/.test(credential(p)))throw Object.assign(Error('API 키 전체가 입력되지 않았습니다. Paste key로 다시 입력하세요.'),{status:400});
  if(busy)throw Object.assign(Error('이미 생성 중입니다.'),{status:409});
  if(JSON.stringify(data.product).length>12000)throw Object.assign(Error('상품 정보를 12,000자 이내로 줄여주세요.'),{status:400});
  budget.reserve(p,credential(p));busy=true;
  try{
   const transportURL=new URL('./ai-transport.mjs',import.meta.url);transportURL.searchParams.set('v',String((await stat(new URL('./ai-transport.mjs',import.meta.url))).mtimeMs));
   const{callProvider}=await import(transportURL.href);
   const result=await callProvider({data,model,credential:credential(p),fetcher,signal});lastFailure=null;
   return{...result,draft:{...result.draft,source:p,model,inputTitle:data.product.name,createdAt:new Date(now()).toISOString()}};
  }catch(error){lastFailure={provider:p,model,code:error.code||'INTERNAL',at:new Date(now()).toISOString()};budget.mark(p,credential(p),error.code);if(error.status)throw error;throw Object.assign(Error('AI 내부 처리에 실패했습니다. 원본은 유지됩니다.'),{status:502})}finally{busy=false}
 }
 return{status,generate};
}
