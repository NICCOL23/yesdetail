/* Local U2Netp inference. All assets are same-origin; image bytes never leave this worker. */
importScripts('./assets/background-removal/ort.wasm.min.js','./background-region.js?v=20261103-region1');
ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;ort.env.wasm.wasmPaths=new URL('./assets/background-removal/',self.location.href).href;
let session;
self.onmessage=async({data})=>{try{
 if(data.region){await removeRegion(data);return}

 const started=performance.now();postMessage({status:'사진을 읽고 있습니다…'});const bitmap=await createImageBitmap(data.blob);if(bitmap.width*bitmap.height>40000000){bitmap.close();throw Error('사진이 너무 큽니다. 4천만 화소 이하로 줄여 주세요.')}
 const scale=Math.min(1,2048/Math.max(bitmap.width,bitmap.height)),w=Math.max(1,Math.round(bitmap.width*scale)),h=Math.max(1,Math.round(bitmap.height*scale));const canvas=new OffscreenCanvas(w,h),ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0,w,h);bitmap.close();const original=ctx.getImageData(0,0,w,h),pixels=original.data;let border=0,transparent=0;for(let x=0;x<w;x++){border+=2;transparent+=(pixels[x*4+3]<8)+(pixels[((h-1)*w+x)*4+3]<8)}for(let y=1;y<h-1;y++){border+=2;transparent+=(pixels[y*w*4+3]<8)+(pixels[(y*w+w-1)*4+3]<8)}
 let alreadyTransparent=transparent/Math.max(1,border)>.95;
 if(!alreadyTransparent){
  const alpha=await inferMask(canvas,w,h);for(let i=0;i<w*h;i++)pixels[i*4+3]=Math.round(pixels[i*4+3]*alpha[i*4]/255);ctx.putImageData(original,0,0);
 }
 let left=w,top=h,right=-1,bottom=-1,visible=0;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(pixels[(y*w+x)*4+3]>8){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);visible++}
 if(right<left||visible<w*h*.001)throw Error('상품을 충분히 찾지 못했습니다. 원본은 유지됩니다.');left=Math.max(0,left-2);top=Math.max(0,top-2);right=Math.min(w-1,right+2);bottom=Math.min(h-1,bottom+2);const result=data.preserveCanvas?canvas:new OffscreenCanvas(right-left+1,bottom-top+1);if(!data.preserveCanvas)result.getContext('2d').drawImage(canvas,left,top,result.width,result.height,0,0,result.width,result.height);postMessage({blob:await result.convertToBlob({type:'image/png'}),width:result.width,height:result.height,seconds:(performance.now()-started)/1000,resized:scale<1,alreadyTransparent});
 }catch(e){postMessage({error:'배경 제거 실패: '+(e?.message||String(e))})}};


async function inferMask(canvas,w,h){
  if(!session){postMessage({status:'처음 실행: AI 도구 약 15.9MB 준비 중…'});const response=await fetch(new URL('./assets/background-removal/u2netp.onnx',self.location.href));if(!response.ok)throw Error('배경 제거 모델 다운로드 실패');session=await ort.InferenceSession.create(await response.arrayBuffer(),{executionProviders:['wasm'],graphOptimizationLevel:'all'});}
  postMessage({status:'이 기기에서 배경을 분석하고 있습니다…'});const tiny=new OffscreenCanvas(320,320),tc=tiny.getContext('2d',{willReadFrequently:true});tc.fillStyle='#ffffff';tc.fillRect(0,0,320,320);tc.drawImage(canvas,0,0,320,320);const rgba=tc.getImageData(0,0,320,320).data;let max=1;for(let i=0;i<rgba.length;i+=4)max=Math.max(max,rgba[i],rgba[i+1],rgba[i+2]);const plane=320*320,input=new Float32Array(plane*3),mean=[.485,.456,.406],std=[.229,.224,.225];for(let c=0;c<3;c++)for(let i=0;i<plane;i++)input[c*plane+i]=(rgba[i*4+c]/max-mean[c])/std[c];const tensor=new ort.Tensor('float32',input,[1,3,320,320]);const outputs=await session.run({[session.inputNames[0]]:tensor}),out=outputs[session.outputNames[0]].data;let lo=Infinity,hi=-Infinity;for(let i=0;i<plane;i++){lo=Math.min(lo,out[i]);hi=Math.max(hi,out[i])}if(!Number.isFinite(lo)||hi-lo<.00001)throw Error('상품을 구분하지 못했습니다. 다른 사진이나 투명 PNG를 사용하세요.');const maskData=tc.createImageData(320,320);for(let i=0;i<plane;i++){const v=Math.round((out[i]-lo)/(hi-lo)*255);maskData.data.set([v,v,v,255],i*4)}tc.putImageData(maskData,0,0);const mask=new OffscreenCanvas(w,h),mc=mask.getContext('2d',{willReadFrequently:true});mc.drawImage(tiny,0,0,w,h);const alpha=mc.getImageData(0,0,w,h).data;return alpha;
}

async function removeRegion(data){
 const started=performance.now();postMessage({status:'선택 영역을 읽고 있습니다…'});const bitmap=await createImageBitmap(data.blob);let region;try{region=YesDetailRegion.validateRegion(data.region,bitmap.width,bitmap.height)}catch(e){bitmap.close();throw e}const w=bitmap.width,h=bitmap.height,canvas=new OffscreenCanvas(w,h),ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0);bitmap.close();const original=ctx.getImageData(0,0,w,h),crop=new OffscreenCanvas(region.w,region.h);crop.getContext('2d').drawImage(canvas,region.x,region.y,region.w,region.h,0,0,region.w,region.h);const alpha=await inferMask(crop,region.w,region.h);YesDetailRegion.applyRegionAlpha(original.data,w,h,region,alpha);postMessage({status:'선택 영역 밖을 유지하며 PNG를 만들고 있습니다…'});const blob=await YesDetailRegion.encodePNG(original.data,w,h);postMessage({blob,width:w,height:h,seconds:(performance.now()-started)/1000,resized:false,partial:true,region,alreadyTransparent:false});
}
