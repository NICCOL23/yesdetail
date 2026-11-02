// html-to-image 1.11.13 is vendored; PNG generation never sends product data externally.
let library;
function renderer(){
 if(!library)library=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src=new URL('./assets/html-to-image.js',import.meta.url).href;
  script.onload=()=>globalThis.htmlToImage?resolve(globalThis.htmlToImage):reject(Error('PNG 도구를 읽지 못했습니다.'));
  script.onerror=()=>{library=null;script.remove();reject(Error('PNG 도구를 불러오지 못했습니다. 다시 시도하세요.'))};document.head.append(script);
 });return library;
}
function timeout(promise,message){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(message)),25000)})]).finally(()=>clearTimeout(timer))}
function dataURL(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('폰트 파일을 읽지 못했습니다.'));r.readAsDataURL(blob)})}
export async function savePagePNG(html){
 const [tool,cssResponse,fontResponse]=await Promise.all([renderer(),fetch(new URL('./studio-next.css',import.meta.url)),fetch(new URL('./assets/fonts/PretendardVariable.woff2',import.meta.url))]);
 if(!cssResponse.ok||!fontResponse.ok)throw Error('스타일 또는 폰트를 불러오지 못했습니다.');
 const font=await dataURL(await fontResponse.blob()),css=(await cssResponse.text()).replace("url('assets/fonts/PretendardVariable.woff2')",`url('${font}')`);
 const fontCSS=`@font-face{font-family:Pretendard;src:url('${font}') format('woff2');font-weight:100 900}`;
 const frame=document.createElement('iframe');frame.setAttribute('aria-hidden','true');frame.tabIndex=-1;frame.style.cssText='position:fixed;left:-10000px;top:0;width:860px;height:900px;border:0;pointer-events:none';
 document.body.append(frame);
 try{
  const doc=frame.contentDocument;doc.open();doc.write('<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>'+css+'body{margin:0;background:white}#page-mount{width:860px;max-width:none;margin:0}.sales-page{width:860px;max-width:none;margin:0}[data-edit]:hover{outline:none}</style></head><body><div id="page-mount">'+html+'</div></body></html>');doc.close();
  const node=doc.querySelector('.sales-page');if(!node)throw Error('저장할 상세페이지가 없습니다.');
  await timeout(Promise.all([...doc.images].map(img=>img.decode())), '사진 로딩 시간이 초과됐습니다.');
  await timeout(Promise.all([doc.fonts.load('400 18px Pretendard'),doc.fonts.load('750 42px Pretendard'),doc.fonts.ready]),'폰트 로딩 시간이 초과됐습니다.');
  if(!doc.fonts.check('400 18px Pretendard'))throw Error('출력 폰트가 준비되지 않았습니다.');
  const height=Math.ceil(node.getBoundingClientRect().height);
  if(!height||height>16000)throw Error('페이지 높이가 PNG 안전 한도 16,000px를 넘습니다. HTML로 저장하거나 사진을 나눈 프로젝트에서 각각 PNG로 저장하세요. 원본은 변경하지 않았습니다.');
  const blob=await timeout(tool.toBlob(node,{width:860,height,pixelRatio:1,backgroundColor:'#ffffff',fontEmbedCSS:fontCSS}), 'PNG 생성 시간이 초과됐습니다. HTML 또는 프로젝트로 저장하세요.');
  if(!blob||!blob.size)throw Error('PNG 이미지를 만들지 못했습니다.');
  return{blob,height,width:860};
 }finally{frame.remove()}
}
