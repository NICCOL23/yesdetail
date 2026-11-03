// 사진 원본 좌표로 사진 자리를 관리합니다. 출력에도 같은 계산을 사용합니다.
export function cleanPhotoFrame(v){
 if(v==null)return null;if(typeof v!=='object')throw Error('사진 자리 형식을 확인하세요.');const r={};
 for(const k of ['x','y','w','h','imageWidth','imageHeight']){if(!Number.isInteger(v[k]))throw Error('사진 자리는 원본 픽셀 정수로 지정하세요.');r[k]=v[k]}
 if(r.imageWidth<1||r.imageHeight<1||r.imageWidth>65535||r.imageHeight>65535||r.x<0||r.y<0||r.w<8||r.h<8||r.x+r.w>r.imageWidth||r.y+r.h>r.imageHeight)throw Error('사진 원본 안에서 8px 이상의 사진 자리를 지정하세요.');
 if(!['contain','cover'].includes(v.fit))throw Error('사진 맞춤 방식을 확인하세요.');r.fit=v.fit;return r;
}
export function framePercent(f){return{x:f.x/f.imageWidth*100,y:f.y/f.imageHeight*100,w:f.w/f.imageWidth*100,h:f.h/f.imageHeight*100}}
export function fitPhotoInFrame(f,iw,ih,visible){
 f=cleanPhotoFrame(f);const b=visible||{x:0,y:0,w:iw,h:ih};if(![iw,ih,b.w,b.h].every(n=>Number.isFinite(n)&&n>0))throw Error('사진 크기를 확인하세요.');
 const scale=(f.fit==='cover'?Math.max:Math.min)(f.w/b.w,f.h/b.h),w=iw*scale,h=ih*scale;
 if(Math.max(w,h)>65535)throw Error('사진 비율 차이가 너무 큽니다. 더 비슷한 사진 자리나 상품 전체 보이기를 사용하세요.');
 return{x:(f.x+(f.w-b.w*scale)/2-b.x*scale)/f.imageWidth*100,y:(f.y+(f.h-b.h*scale)/2-b.y*scale)/f.imageHeight*100,w:w/f.imageWidth*100,h:h/f.imageHeight*100};
}
export function clampFramedPhoto(p,f,ratio,visible){
 const iw=f.imageWidth,ih=f.imageHeight,r=framePercent(f),maxW=Math.min(65535/iw*100,65535*ratio/iw*100);p.w=Math.max(.001,Math.min(maxW,p.w));p.h=p.w*iw/ratio/ih;
 if(f.fit==='cover'){
  const b=visible?.imageWidth?visible:{x:0,y:0,w:ratio,h:1,imageWidth:ratio,imageHeight:1},fx=b.x/b.imageWidth,fy=b.y/b.imageHeight,fw=b.w/b.imageWidth,fh=b.h/b.imageHeight;
  p.w=Math.max(p.w,r.w/fw,r.h*ih*ratio/iw/fh);p.h=p.w*iw/ratio/ih;
  p.x=Math.max(r.x+r.w-(fx+fw)*p.w,Math.min(r.x-fx*p.w,p.x));p.y=Math.max(r.y+r.h-(fy+fh)*p.h,Math.min(r.y-fy*p.h,p.y));
 }else{p.x=Math.max(r.x-p.w+.001,Math.min(r.x+r.w-.001,p.x));p.y=Math.max(r.y-p.h+.001,Math.min(r.y+r.h-.001,p.y))}return p;
}
export function framedPhotoHTML(p,escape){
 const f=cleanPhotoFrame(p.frame),r=framePercent(f),inner={x:(p.x-r.x)/r.w*100,y:(p.y-r.y)/r.h*100,w:p.w/r.w*100,h:p.h/r.h*100};
 return '<div class="product-photo-slot" style="position:absolute;overflow:hidden;pointer-events:none;z-index:0;left:'+r.x+'%;top:'+r.y+'%;width:'+r.w+'%;height:'+r.h+'%"><img src="'+escape(p.src)+'" alt="'+escape(p.name)+'" style="position:absolute;display:block;max-width:none;max-height:none;left:'+inner.x+'%;top:'+inner.y+'%;width:'+inner.w+'%;height:'+inner.h+'%;object-fit:contain"></div>';
}
export function visiblePhotoBounds(im){
 const scale=Math.min(1,512/Math.max(im.naturalWidth,im.naturalHeight)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(im.naturalWidth*scale));c.height=Math.max(1,Math.round(im.naturalHeight*scale));const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(im,0,0,c.width,c.height);const d=ctx.getImageData(0,0,c.width,c.height).data;let l=c.width,t=c.height,r=-1,b=-1;
 for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(d[(y*c.width+x)*4+3]>8){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y)}
 if(r<l)return{x:0,y:0,w:im.naturalWidth,h:im.naturalHeight,imageWidth:im.naturalWidth,imageHeight:im.naturalHeight};
 return{x:l/c.width*im.naturalWidth,y:t/c.height*im.naturalHeight,w:(r-l+1)/c.width*im.naturalWidth,h:(b-t+1)/c.height*im.naturalHeight,imageWidth:im.naturalWidth,imageHeight:im.naturalHeight};
}
