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
async function withPage(html,render){
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
  if(!height)throw Error('저장할 페이지 높이를 확인하세요.');
  return await render({tool,node,doc,height,fontCSS});
 }finally{frame.remove()}
}

export async function savePagePNG(html){return withPage(html,async({tool,node,height,fontCSS})=>{
 if(height>16000)throw Error('페이지 높이가 PNG 안전 한도 16,000px를 넘습니다. 분할 PNG ZIP 저장을 사용하세요. 원본은 변경하지 않았습니다.');
 const blob=await timeout(tool.toBlob(node,{width:860,height,pixelRatio:1,backgroundColor:'#ffffff',fontEmbedCSS:fontCSS}), 'PNG 생성 시간이 초과됐습니다. 분할 PNG ZIP 또는 HTML로 저장하세요.');
 if(!blob||!blob.size)throw Error('PNG 이미지를 만들지 못했습니다.');return{blob,height,width:860};
})}
export function pngSlices(height,step=8000){if(!Number.isSafeInteger(height)||height<1||height>128000||!Number.isSafeInteger(step)||step<1||step>8000)throw Error('분할 PNG 안전 한도는 전체 높이 128,000px, 장당 8,000px입니다. 페이지를 나누어 저장하세요.');const result=[];for(let y=0;y<height;y+=step)result.push({y,height:Math.min(step,height-y)});return result}
function crc32(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0)}return(c^0xffffffff)>>>0}
export function pngZip(files){const enc=new TextEncoder(),parts=[],central=[];let offset=0,total=0;for(const file of files){const name=enc.encode(file.name),data=file.data;total+=data.length;if(total>256000000)throw Error('분할 PNG 전체 용량이 256MB를 넘습니다. 사진 수를 나누어 저장하세요.');const crc=crc32(data),local=new Uint8Array(30+name.length),lv=new DataView(local.buffer);lv.setUint32(0,0x04034b50,true);lv.setUint16(4,20,true);lv.setUint32(14,crc,true);lv.setUint32(18,data.length,true);lv.setUint32(22,data.length,true);lv.setUint16(26,name.length,true);local.set(name,30);parts.push(local,data);const dir=new Uint8Array(46+name.length),dv=new DataView(dir.buffer);dv.setUint32(0,0x02014b50,true);dv.setUint16(4,20,true);dv.setUint16(6,20,true);dv.setUint32(16,crc,true);dv.setUint32(20,data.length,true);dv.setUint32(24,data.length,true);dv.setUint16(28,name.length,true);dv.setUint32(42,offset,true);dir.set(name,46);central.push(dir);offset+=local.length+data.length}const size=central.reduce((n,v)=>n+v.length,0),end=new Uint8Array(22),ev=new DataView(end.buffer);ev.setUint32(0,0x06054b50,true);ev.setUint16(8,files.length,true);ev.setUint16(10,files.length,true);ev.setUint32(12,size,true);ev.setUint32(16,offset,true);return new Blob([...parts,...central,end],{type:'application/zip'})}
export async function savePageSplitPNG(html,onProgress=()=>{}){return withPage(html,async({tool,node,doc,height,fontCSS})=>{
 const slices=pngSlices(height),viewport=doc.createElement('div');viewport.style.cssText='position:relative;width:860px;overflow:hidden;background:white';node.before(viewport);viewport.append(node);const files=[];let totalBytes=0;
 for(let i=0;i<slices.length;i++){const slice=slices[i];onProgress({current:i+1,total:slices.length});viewport.style.height=slice.height+'px';node.style.transform='translateY(-'+slice.y+'px)';node.style.transformOrigin='top left';const blob=await timeout(tool.toBlob(viewport,{width:860,height:slice.height,pixelRatio:1,backgroundColor:'#ffffff',fontEmbedCSS:fontCSS}), '분할 PNG 생성 시간이 초과됐습니다. 원본은 유지됩니다.');if(!blob||!blob.size)throw Error('분할 PNG를 만들지 못했습니다.');totalBytes+=blob.size;if(totalBytes>256000000)throw Error('분할 PNG 전체 용량이 256MB를 넘습니다. 사진 수를 나누어 저장하세요.');files.push({name:'YesDetail-'+String(i+1).padStart(3,'0')+'.png',data:new Uint8Array(await blob.arrayBuffer())});}
 return{blob:pngZip(files),height,width:860,parts:files.length,slices};
})}
