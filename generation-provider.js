// Text and image providers are separate contracts. Future authenticated requests
// must go through a server; credentials must never enter browser state or JSON.
export function createTemplateProvider(template){return Object.freeze({mode:'template',connected:true,generateSection(type,product){return template(type,structuredClone(product));}});}
export function createImageProvider(){return Object.freeze({mode:'unconnected',connected:false,async generateImage(){throw Error('AI 이미지 생성은 아직 연결되지 않았습니다. 요청 문구와 레퍼런스만 저장할 수 있습니다.');}});}

// Safe preparation only: no network call, credentials, or provider billing.
export function prepareImageBrief({product={},section={},photos=[]}={}){
 const role=section.type==='hero'?'대표컷':section.type==='usage'?'사용·설치 장면':section.type==='photos'?'제품 확대컷':'섹션 보조컷';
 const selected=new Set(section.plan?.photoIds||section.photoIds||[]);
 const references=photos.filter(p=>selected.has(p.id)&&p.kind==='product').map(p=>({id:p.id,name:p.name}));
 return {version:1,status:'unconnected',role,product:{name:String(product.name||''),category:String(product.category||'')},references,request:String(section.plan?.prompt||''),requirements:['실제 상품의 형태·규격·라벨을 유지','생성 사진은 AI 연출로 표시','사용 장면은 정확한 제품의 설치 안내를 확인','가상의 후기·인증·성능을 만들지 않음'],billing:{enabled:false,service:null,estimatedCost:null,requiresConfiguration:true}};
}
