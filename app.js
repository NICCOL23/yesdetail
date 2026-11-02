import {mountProjectLibrary} from './project-library.js';
import {beginNewWorkspace,emptyWorkspace} from './workspace-start.js';
// A shared layout plan drives both the preview and full/split PNG exports.
function resizeCapturePhotos(plan,section,photos){
 if(section.presentation==='split')return plan;
 for(const id of section.photoIds||[]){
  if(section.photoSizing?.[id]!=='auto')continue;
  const photo=photos.find(p=>p.id===id);if(!photo?.width||!photo?.height)continue;
  for(const image of plan.ops.filter(op=>op.kind==='image'&&op.src===photo.src)){
   const oldBottom=image.y+image.h,nextHeight=image.w*photo.height/photo.width,delta=nextHeight-image.h;
   for(const op of plan.ops){if(op===image)continue;
    if(op.kind==='rect'&&op.y<=image.y&&op.y+op.h>=oldBottom&&op.x<=image.x&&op.x+op.w>=image.x+image.w)op.h+=delta;
    else if(op.y>=oldBottom-.01)op.y+=delta;
   }
   image.h=nextHeight;image.fit='contain';image.original=true;plan.height=Math.ceil(plan.height+delta);
  }
 }
 return plan;
}
function createSalesRenderer({getState,imageFor,sectionTypes,imageAspect=()=>null}) {
  const W=860,P=60,CW=W-P*2;
  const palette={navy:'#1c1c1b',ink:'#252522',muted:'#77756f',line:'#e2dfd8',paper:'#f7f6f2'};
  const scratch=document.createElement('canvas').getContext('2d');
  const family='"Malgun Gothic", "Segoe UI", sans-serif';
  function setFont(ctx,size,weight=400){ctx.font=`${weight} ${size}px ${family}`;ctx.textBaseline='top';}
  function lines(text,width,size,weight=400){
    setFont(scratch,size,weight);const result=[];
    for(const para of String(text??'').split('\n')){
      if(!para.trim()){result.push('');continue;}
      let line='';for(const word of para.trim().split(/\s+/)){
        const next=line?line+' '+word:word;
        if(scratch.measureText(next).width<=width){line=next;continue;}
        if(line){result.push(line);line='';}
        if(scratch.measureText(word).width<=width){line=word;continue;}
        for(const char of word){if(scratch.measureText(line+char).width>width&&line){result.push(line);line=char;}else line+=char;}
      }if(line)result.push(line);
    }return result;
  }
  const textVal=(p,k)=>String(p[k]??'').trim()||'미확인';
  function measure(s,index=0){
    const state=getState(),p=state.product,accent=state.style.accent,fs=s.fontSize||state.style.fontSize;
    const mood=state.style.mood||{},bg=s.background||'#ffffff',dark=parseInt(bg.slice(1,3),16)*.299+parseInt(bg.slice(3,5),16)*.587+parseInt(bg.slice(5,7),16)*.114<125;const color=s.color||(dark?'#ffffff':palette.ink),ops=[];let y=0;
    const rect=(x,yy,w,h,fill,r=0,stroke)=>ops.push({kind:'rect',x,y:yy,w,h,fill,r,stroke});
    const line=(x,yy,w,fill=palette.line)=>rect(x,yy,w,1,fill);
    function text(str,x,yy,{width=CW,size=fs,weight=400,fill=color,lineHeight=1.65}={}){
      const wrapped=lines(str,width,size,weight);ops.push({kind:'text',lines:wrapped,x,y:yy,size,weight,fill,lineHeight,align:s.align||'left',width});return wrapped.length*size*lineHeight;
    }
    const label=sectionTypes.find(([t])=>t===s.type)?.[1]||'추가 안내';
    function heading(subtitle){
      y=64;rect(P,y+2,5,20,accent,2);text(`${String(index+1).padStart(2,'0')}  ${subtitle||label}`,P+18,y,{size:19,weight:700,fill:accent});y+=48;
      y+=text(s.title,P,y,{size:s.titleSize||42,weight:700,lineHeight:1.35});y+=28;
    }
    function body(str=s.body,fill=color){y+=text(str,P,y,{fill});}
    function photo(p,x,yy,w,h){h=s.imageHeight||h;rect(x,yy,w,h,'#ffffff',16,'#e3e9f1');ops.push({kind:'image',src:p?.src,x:x+20,y:yy+20,w:w-40,h:h-40,original:true,fit:s.imageFit||'contain',focusX:s.focusX??50,focusY:s.focusY??50});return h;}
    function badge(value,x,yy,w,dark=false){rect(x,yy,w,48,dark?'#243d5d':'#eef3ff',7);text(value,x+16,yy+12,{size:19,weight:700,fill:dark?'#dce9ff':accent,width:w-32,lineHeight:1.2});}
    const photos=(s.photoIds||[]).map(id=>state.photos.find(p=>p.id===id&&!['reference','info'].includes(p.kind))).filter(Boolean);

    if(s.presentation?.startsWith('studio'))return productStudioPlan(s,index,state,photos.map(p=>({...p,renderAspect:imageAspect(p.src)})),lines);
    if(s.presentation?.startsWith('food'))return foodEditorialPlan(s,index,state,photos,lines);
    if(s.presentation&&s.presentation!=='standard'){
      rect(0,0,W,1,s.background||'#ffffff');const h=s.imageHeight||520;
      const place=(item,x,yy,w,hh,fit=s.imageFit||'contain')=>ops.push({kind:'image',src:item.src,x,y:yy,w,h:hh,original:true,fit,focusX:s.focusX??50,focusY:s.focusY??50});
      const imageBlock=()=>{for(const item of photos){const hh=s.presentation==='imageOnly'&&item.width&&item.height?W*item.height/item.width:h;place(item,0,y,W,hh,s.presentation==='imageOnly'?'contain':s.imageFit||'contain');y+=hh;}};
      const headingBlock=()=>{y+=72;text(String(index+1).padStart(2,'0')+' / '+label,P,y,{size:18,weight:700,fill:dark?(mood.soft||'#d4baa5'):accent});y+=46;y+=text(s.title,P,y,{size:s.titleSize||54,weight:700,lineHeight:1.3});y+=30;};
      if(s.presentation==='imageOnly'){imageBlock();if(!photos.length){y=300;text('이미지를 지정해 주세요',P,100,{size:32});}}
      else if(s.presentation==='split'){
        headingBlock();y+=text(s.body,P,y,{size:fs,lineHeight:1.8});y+=40;for(let i=0;i<photos.length;i+=2){const items=photos.slice(i,i+2),w=(CW-20)/2;items.forEach((item,j)=>place(item,P+j*(w+20),y,w,h));y+=h+20;}y+=52;
      }else if(['points','steps'].includes(s.presentation)){
        headingBlock();for(const [i,value]of s.body.split('\n').filter(v=>v.trim()).entries()){const hh=lines(value,CW-110,fs).length*fs*1.7+44;rect(P,y,CW,hh,dark?'#33312d':mood.light||'#f4f1eb',8);text(String(i+1).padStart(2,'0'),P+20,y+22,{size:22,fill:dark?'#e1c7a5':accent,width:50});text(value,P+83,y+22,{size:fs,width:CW-108});y+=hh+16;}y+=32;imageBlock();y+=55;
      }else{if(s.presentation==='photoFirst')imageBlock();headingBlock();y+=text(s.body,P,y,{size:fs,lineHeight:1.8});y+=64;if(s.presentation==='editorial')imageBlock();y+=64;}
      ops[0].h=y;return {s,index,ops,height:Math.ceil(y)};
    }
    if(s.type==='hero'){
      rect(0,0,W,900,s.background||mood.dark||palette.navy);rect(0,0,W,8,accent);y=58;
      text(p.category&&p.category!=='메모리'?p.category+' / PRODUCT DETAIL':'DESKTOP MEMORY',P,y,{size:19,weight:700,fill:'#a9c5ed'});y+=60;
      y+=text(s.title,P,y,{size:s.titleSize||64,weight:700,fill:s.color||'#ffffff',lineHeight:1.28});y+=25;
      y+=text(s.body,P,y,{size:fs,fill:s.color||'#c5d3e5',lineHeight:1.6});y+=30;
      if(!p.category||p.category==='메모리'){badge('DDR3',P,y,120,true);badge(textVal(p,'capacity'),P+134,y,120,true);badge('데스크톱용',P+268,y,170,true);}else badge(p.category,P,y,220,true);y+=78;
      const first=photos[0];
      y+=photo(first,P,y,CW,370)+28;for(const extra of photos.slice(1)){y+=photo(extra,P,y,CW,370)+28;}
      text('선택한 규격',P,y,{size:18,fill:'#93abcd'});
      text(p.category&&p.category!=='메모리'?textVal(p,p.category==='식품'?'weight':'spec'):`${textVal(p,'spec')}  ·  ${textVal(p,'side')}`,P,y+30,{size:26,weight:700,fill:'#ffffff'});y+=100;
      // The first background tracks the measured content rather than a fixed height.
      ops[0].h=y;return {s,index,ops,height:Math.ceil(y)};
    }
    rect(0,0,W,1,bg);heading();
    if(s.type==='options'&&!s.custom&&(!p.category||p.category==='메모리')){
      y+=text('규격과 칩 배치를 각각 선택해 주세요.',P,y,{size:fs,fill:palette.muted});y+=30;
      const gap=18,cardW=(CW-gap)/2,cardH=170;
      for(let row=0;row<2;row++)for(let col=0;col<2;col++){
        const spec=row?'PC3-12800U':'PC3-10600 계열',side=col?'양면':'단면',x=P+col*(cardW+gap),yy=y+row*(cardH+gap),active=p.spec===spec&&p.side===side;
        rect(x,yy,cardW,cardH,active?'#edf3ff':'#f6f8fb',12,active?accent:'#e1e7f0');
        text(spec,x+24,yy+25,{size:25,weight:700,fill:active?accent:palette.ink,width:cardW-48});
        text(side,x+24,yy+78,{size:35,weight:700});text(active?'현재 선택':'선택 가능',x+24,yy+132,{size:17,fill:active?accent:palette.muted});
      }y+=2*(cardH+gap)+16;
      y+=text(s.body,P,y,{size:24,fill:palette.muted});
    }else if(s.type==='specs'){
      for(const row of s.body.split('\n')){
        if(!row.includes('|')){y+=text(row,P,y,{size:fs});y+=10;continue;}
        const [key,...rest]=row.split('|'),value=rest.join('|').trim();const kh=lines(key.trim(),180,fs,700).length*fs*1.55,vh=lines(value,480,fs).length*fs*1.55,h=Math.max(kh,vh)+36;
        rect(P,y,220,h,'#f1f5fa');text(key.trim(),P+22,y+18,{size:fs,weight:700,width:176});text(value,P+246,y+18,{size:fs,width:470,fill:value==='미확인'?'#8b96a5':color});line(P,y+h,CW);y+=h;
      }
    }else if(['benefits','recommend','usage'].includes(s.type)){
      for(const [row,value]of s.body.split('\n').filter(x=>x.trim()).entries()){const h=lines(value,CW-100,fs).length*fs*1.65+40;rect(P,y,CW,h,'#f4f7fc',10);text(s.type==='usage'?String(row+1).padStart(2,'0'):'•',P+20,y+20,{size:fs,weight:700,fill:accent,width:50});text(value,P+75,y+20,{size:fs,width:CW-100});y+=h+14;}
    }else if(s.type==='faq'){
      for(const group of s.body.split(/\n\s*\n/).filter(x=>x.trim())){const h=lines(group,CW-48,fs).length*fs*1.75+48;rect(P,y,CW,h,'#f3f7ff',10);text(group,P+24,y+24,{size:fs,width:CW-48,lineHeight:1.75});y+=h+16;}
    }else if(s.type==='compare'){
      for(const [row,lineText]of s.body.split('\n').filter(x=>x.trim()).entries()){const cells=lineText.split('|').map(v=>v.trim()),w=CW/cells.length;const h=Math.max(...cells.map(v=>lines(v,w-32,fs,row===0?700:400).length))*fs*1.6+36;cells.forEach((v,col)=>{rect(P+col*w,y,w,h,row===0?'#e9f0ff':row%2?'#f7f9fc':'#ffffff');text(v,P+col*w+16,y+18,{width:w-32,size:fs,weight:row===0?700:400});});y+=h;line(P,y,CW);}
    }else if(s.type==='photos'){

      body(s.body,palette.muted);y+=30;
      if(!photos.length){rect(P,y,CW,180,'#f2f5fa',12);text('제품 사진을 추가해 주세요',P+30,y+65,{size:28,fill:palette.muted});y+=180;}
      for(let i=0;i<photos.length;i++){
        y+=photo(photos[i],P,y,CW,390)+20;
        y+=text(`사진 ${String(i+1).padStart(2,'0')}  ·  ${photos[i].name.replace(/ 샘플$/,'')}`,P+4,y,{size:20,fill:palette.muted});y+=30;
      }
    }else if(s.type==='condition'||s.type==='test'){
      const status=s.type==='test'?textVal(p,'tested'):'중고 상품';
      badge(status,P,y,Math.max(160,Math.min(300,status.length*26+40)));y+=77;
      const th=lines(s.body,CW-56,fs).length*fs*1.75+56;rect(P,y,CW,th,'#f4f7fb',12);text(s.body,P+28,y+28,{width:CW-56,size:fs,lineHeight:1.75});y+=th;
      if(s.type==='test')for(const item of photos){y+=28;y+=photo(item,P,y,CW,390)+20;}
    }else if(s.type==='compat'){
      const h=lines(s.body,CW-64,fs).length*fs*1.8+64;rect(P,y,CW,h,'#edf3ff',12);rect(P,y,5,h,accent,2);text(s.body,P+32,y+32,{width:CW-64,size:fs,lineHeight:1.8});y+=h;
    }else if(s.type==='shipping'){
      const groups=s.body.split(/\n\s*\n/);for(const group of groups){const h=lines(group,CW-48,fs).length*fs*1.7+48;rect(P,y,CW,h,'#f6f8fb',10);text(group,P+24,y+24,{width:CW-48,size:fs,lineHeight:1.7});y+=h+18;}
    }else body();
    if(!['photos','test'].includes(s.type))for(const item of photos){y+=28;y+=photo(item,P,y,CW,390)+20;}
    y+=60;line(P,y,CW);y+=1;
    ops[0].h=Math.ceil(y);if(dark){for(const op of ops){if(op.kind==='rect'&&op!==ops[0]&&op.fill!=='#ffffff')op.fill='#29332f';if(op.kind==='text'&&!s.color)op.fill=op.fill===accent?(mood.soft||'#a9dbc0'):'#f1f5f2';}}return {s,index,ops,height:Math.ceil(y)};
  }
  async function paint(canvas,plans){
    const height=plans.reduce((sum,p)=>sum+p.height,0)||300;if(!Number.isFinite(height)||height>30000)throw Error('페이지가 너무 깁니다. 섹션별 PNG를 사용하거나 긴 섹션을 나눠 주세요.');canvas.width=W;canvas.height=height;const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,W,canvas.height);let offset=0;
    for(const plan of plans){ctx.save();ctx.translate(0,offset);
      for(const original of plan.ops){
        const op={...original},mood=getState().style.mood;
        if(mood){const lightFills=['#eef3ff','#edf3ff','#f1f5fa','#f4f7fc','#f3f7ff','#f2f5fa','#f4f7fb','#f6f8fb','#f7f9fc','#e9f0ff','#edf3ff','#edf3ff','#edf3ff'];if(op.kind==='rect'&&lightFills.includes(op.fill))op.fill=mood.light;if(op.kind==='rect'&&op.fill==='#243d5d')op.fill=mood.dark;if(op.kind==='text'&&['#a9c5ed','#dce9ff','#93abcd'].includes(op.fill))op.fill=mood.soft;}

        if(op.kind==='rect'){ctx.beginPath();ctx.roundRect(op.x,op.y,op.w,op.h,op.r);ctx.fillStyle=op.fill;ctx.fill();if(op.stroke){ctx.strokeStyle=op.stroke;ctx.lineWidth=1;ctx.stroke();}}
        else if(op.kind==='text'){setFont(ctx,op.size,op.weight);ctx.fillStyle=op.fill;ctx.textAlign=op.align||'left';const tx=op.align==='center'?op.x+op.width/2:op.align==='right'?op.x+op.width:op.x;op.lines.forEach((line,i)=>ctx.fillText(line,tx,op.y+i*op.size*op.lineHeight));ctx.textAlign='left';}
        else if(op.kind==='image'){
          const img=op.src?await imageFor(op.src):null;
          if(img){
 let box=imageContentBox(img);
 if(op.original)box={x:0,y:0,w:img.width,h:img.height};
 if(op.fit==='cover'){const r=Math.max(op.w/box.w,op.h/box.h),sw=op.w/r,sh=op.h/r,sx=box.x+(box.w-sw)*(op.focusX??50)/100,sy=box.y+(box.h-sh)*(op.focusY??50)/100;ctx.drawImage(img,sx,sy,sw,sh,op.x,op.y,op.w,op.h);}else{const r=Math.min(op.w/box.w,op.h/box.h);ctx.drawImage(img,box.x,box.y,box.w,box.h,op.x+(op.w-box.w*r)/2,op.y+(op.h-box.h*r)/2,box.w*r,box.h*r);}
}
          else{setFont(ctx,24);ctx.fillStyle=palette.muted;ctx.fillText('제품 사진을 추가해 주세요',op.x+20,op.y+op.h/2);}
        }
      }ctx.restore();offset+=plan.height;
    }return canvas;
  }
  return {measure:(s,index=0)=>resizeCapturePhotos(measure(s,index),s,getState().photos),paint};
}

import {createTemplateProvider,createImageProvider,prepareImageBrief} from './generation-provider.js';
import {renderReactEditor} from './assets/react-editor.js';
import {projectStore} from './project-storage.js';
import {productStudioPlan} from './product-studio.js';
import {foodEditorialPlan} from './food-editorial.js';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const KEY='ddr3-studio-v1', clone=o=>JSON.parse(JSON.stringify(o)), uid=()=>crypto.randomUUID();
const fields=[
 ['기본 상품 정보',[['name','상품명','삼성 DDR3 4GB 데스크톱 메모리','text','wide'],['maker','제조사','삼성'],['capacity','개당 용량','4GB'],['spec','규격',['PC3-10600 계열','PC3-12800U']],['side','외형',['미확인','단면','양면']],['quantity','판매 수량','1','number'],['price','판매 가격 (원)','','number'],['model','정확한 모델명','','text','wide'],['label','제품 라벨 표기','','text','wide'],['rank','랭크 표기','','text','wide']]],
 ['상태 및 테스트',[['condition','외관 상태','','textarea','wide'],['defects','확인된 하자','','textarea','wide'],['tested','테스트 여부',['미확인','테스트 미실시','테스트 완료']],['testDate','테스트 날짜','','date'],['testMethod','테스트 방법','','textarea','wide'],['testResult','테스트 결과','','textarea','wide']]],
 ['구성품 및 판매 조건',[['included','구성품','','textarea','wide'],['shippingFee','배송비 (원)','','number'],['shipping','배송 안내','','textarea','wide'],['warranty','보증 조건','','textarea','wide'],['returns','교환·반품 안내','','textarea','wide']]]
];

const categories=['메모리','CPU','그래픽카드','메인보드','저장장치','파워·기타 부품','식품','일반 상품'];
function productFields(){const cat=state.product.category||'메모리';if(cat==='메모리')return fields;const basic=[['category','상품 종류',categories],['name','상품명','','text','wide'],['maker',cat==='식품'?'생산자·판매원':'제조사·브랜드',''],['model',cat==='식품'?'식품 유형':'모델명','','text','wide'],['quantity','판매 수량','1','number'],['price','판매 가격 (원)','','number'],['details','주요 특징·사양','','textarea','wide']];if(cat==='식품')basic.push(['weight','내용량','','text','wide'],['origin','원산지','','text','wide'],['ingredients','원재료·알레르기 정보','','textarea','wide'],['storage','보관 방법','','textarea','wide'],['expiry','소비기한 안내','','textarea','wide'],['cooking','조리 방법','','textarea','wide']);else basic.push(['capacity','용량·크기','','text','wide'],['spec','규격·호환 정보','','text','wide']);return [['기본 상품 정보',basic],...(cat==='식품'?[]:[fields[1]]),fields[2]];}
function genericTemplate(type,p){const food=p.category==='식품';const rows=food?[['내용량','weight'],['원산지','origin'],['원재료·알레르기','ingredients'],['보관 방법','storage'],['소비기한','expiry']]:[['모델명','model'],['용량·크기','capacity'],['규격','spec'],['주요 특징','details']];switch(type){case 'hero':return {title:val(p,'name'),body:val(p,'details')};case 'options':return {title:'판매 구성 안내',body:'판매 수량: '+val(p,'quantity')+'\n구성품: '+val(p,'included')};case 'specs':return {title:food?'식품 정보':'제품 주요 정보',body:rows.map(([n,k])=>n+' | '+val(p,k)).join('\n')};case 'photos':return {title:'사진으로 자세히 확인하세요',body:'등록한 상품 사진을 확인해 주세요.'};case 'compat':return {title:food?'보관·섭취 전 확인':'구매 전 확인',body:food?'보관 방법: '+val(p,'storage')+'\n원재료·알레르기: '+val(p,'ingredients'):'규격·호환 정보: '+val(p,'spec')};case 'usage':return {title:food?'조리 방법':'사용 방법',body:food?val(p,'cooking'):''};case 'benefits':return {title:'상품의 특징',body:val(p,'details')};default:return null;}}

fields[0][1].unshift(['category','상품 종류',categories]);
const defaults=Object.fromEntries(fields.flatMap(([,fs])=>fs.map(([k,,v])=>[k,Array.isArray(v)?v[0]:v])));
Object.assign(defaults,{details:'',weight:'',origin:'',ingredients:'',storage:'',expiry:'',cooking:''});
const initial=()=>({version:1,product:{...defaults},photos:[{id:uid(),src:'assets/pc3-10600.jpg',name:'PC3-10600U 샘플',kind:'product'},{id:uid(),src:'assets/pc3-12800.jpg',name:'PC3-12800U 샘플',kind:'product'}],sections:[],style:{accent:'#2459e0',fontSize:28}});
function val(p,k){return String(p[k]??'').trim()||'미확인';}
const sectionTypes=[['hero','상품 소개'],['options','옵션 안내'],['specs','주요 사양'],['photos','제품 사진'],['condition','중고 상태 안내'],['test','테스트 결과'],['compat','구매 전 확인'],['shipping','구성품 및 판매 조건'],['benefits','핵심 특징'],['recommend','추천 대상'],['compare','비교'],['faq','FAQ'],['usage','사용·장착 안내'],['custom','자유 섹션']];
function template(type,p){if(p.category&&p.category!=='메모리'){const result=genericTemplate(type,p);if(result)return result;}const spec=val(p,'spec'),side=val(p,'side');switch(type){
 case 'hero':return {title:val(p,'name'),body:`${val(p,'maker')} · DDR3 · 개당 ${val(p,'capacity')}\n판매 수량 ${val(p,'quantity')}개${p.price?` · ${Number(p.price).toLocaleString('ko-KR')}원`:''}`};
 case 'options':return {title:'내 PC에 맞는 규격을 확인하세요',body:`선택 규격: ${spec}\n외형: ${side}\n지원 옵션: PC3-10600 계열 / PC3-12800U · 단면 / 양면\n사진 속 개수와 관계없이 판매 수량은 ${val(p,'quantity')}개입니다.`};
 case 'specs':return {title:'제품 주요 사양',body:[['제조사','maker'],['모델명','model'],['라벨 표기','label'],['개당 용량','capacity'],['규격','spec'],['단면·양면','side'],['랭크','rank'],['판매 수량','quantity']].map(([n,k])=>`${n}  |  ${val(p,k)}${k==='quantity'?'개':''}`).join('\n')};
 case 'photos':return {title:'제품을 자세히 확인하세요',body:'제품 라벨과 메모리 칩, 접점 상태를 사진으로 확인해 주세요.\n판매 수량은 상품 정보에 기재된 수량을 기준으로 합니다.'};
 case 'condition':return {title:'중고 제품 상태 안내',body:`외관 상태\n${val(p,'condition')}\n\n확인된 하자\n${val(p,'defects')}`};
 case 'test':return {title:'테스트 확인 내역',body:`테스트 여부: ${val(p,'tested')}\n테스트 날짜: ${val(p,'testDate')}\n테스트 방법: ${val(p,'testMethod')}\n테스트 결과: ${val(p,'testResult')}`};
 case 'compat':return {title:'구매 전, 꼭 확인해 주세요',body:'데스크톱용 DDR3 메모리입니다.\n메인보드와 CPU의 지원 규격·용량 및 정확한 제품 모델을 확인해 주세요.\n단면·양면과 랭크는 서로 다른 구분입니다.\n개별 PC의 호환 여부는 확인이 필요합니다.'};
 case 'shipping':return {title:'구성품 · 배송 및 판매 조건',body:`구성품: ${val(p,'included')}\n배송비: ${p.shippingFee!==''?Number(p.shippingFee).toLocaleString('ko-KR')+'원':'미확인'}\n배송 안내: ${val(p,'shipping')}\n\n보증 조건\n${val(p,'warranty')}\n\n교환·반품 안내\n${val(p,'returns')}`};
 case 'benefits':return {title:'상품의 핵심 특징',body:''};
 case 'recommend':return {title:'이런 분께 추천합니다',body:''};
 case 'compare':return {title:'제품 비교',body:''};
 case 'faq':return {title:'자주 묻는 질문',body:''};
 case 'usage':return {title:'사용·장착 안내',body:''};
 default:return {title:'새로운 섹션',body:''};
}}
const contentProvider=createTemplateProvider(template);
const imageProvider=createImageProvider();
function makeSections(p){return sectionTypes.slice(0,8).map(([type])=>({id:uid(),type,...contentProvider.generateSection(type,p),visible:true,custom:false,fontSize:null,color:null}));}
let state=initial(),selected='',step=1,zoom=.65,history=[],future=[],lastSaved='',saveTimer,renderVersion=0,bounds=[],toastTimer;
let hadStored=false,storageReadFailed=false;
try{const stored=await projectStore.get(KEY);const raw=stored??localStorage.getItem(KEY);if(raw){state=validate(JSON.parse(raw));hadStored=true;lastSaved=raw;if(stored==null)await projectStore.set(KEY,raw);}}catch{storageReadFailed=true;notify('자동 저장 내용을 읽지 못했습니다. 기존 저장은 보호됩니다. 프로젝트 파일을 불러와 주세요.');}

if(!state.sections.length&&!hadStored)state.sections=makeSections(state.product);selected=state.sections[0]?.id||'';
function validate(data){return migrateV2(data);}
function notify(msg){clearTimeout(toastTimer);$('#toast').textContent=msg;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,4000);}
function checkpoint(){const raw=JSON.stringify(state);if(history.at(-1)!==raw){history.push(raw);if(history.length>50)history.shift();}future=[];}
let saveRevision=0,savedRevision=0;
async function flushSave(){
 clearTimeout(saveTimer);if(storageReadFailed){$('#save-status').textContent='저장 복구 필요 · 파일 불러오기';return;}const revision=saveRevision,raw=JSON.stringify(state);
 try{await projectStore.set(KEY,raw);lastSaved=raw;savedRevision=Math.max(savedRevision,revision);if(revision===saveRevision)$('#save-status').textContent='✓ 자동 저장됨';}
 catch(error){if(revision!==saveRevision)return;$('#save-status').textContent='자동 저장 실패 · 파일 저장 필요';notify(error?.name==='ProjectConflictError'?error.message:error?.name==='QuotaExceededError'?'브라우저 저장 한도에 도달했습니다. 위쪽 프로젝트 저장 버튼으로 파일을 보관해 주세요.':'자동 저장을 완료하지 못했습니다. 위쪽 프로젝트 저장 버튼으로 파일을 보관해 주세요.');}
}
function persist(){clearTimeout(saveTimer);saveRevision++;$('#save-status').textContent='저장 중…';saveTimer=setTimeout(flushSave,300);}

function changed({editor=false,form=false}={}){if(form)renderForm();if(editor)renderEditor();renderSections();renderPlan();renderPhotos();renderCanvas();renderSyncStatus();persist();$('#undo').disabled=!history.length;$('#redo').disabled=!future.length;}
function syncTemplates(markSource=false,changedKey='category'){const dependencies={hero:['name','maker','details','capacity','quantity','price'],options:['quantity','included','spec','side'],specs:['maker','model','label','capacity','spec','side','rank','quantity','weight','origin','ingredients','storage','expiry','details'],compat:['spec','storage','ingredients'],usage:['cooking'],benefits:['details'],condition:['condition','defects'],test:['tested','testDate','testMethod','testResult'],shipping:['included','shippingFee','shipping','warranty','returns']};for(const s of state.sections){if(!s.plan||s.type==='custom'||(markSource&&changedKey!=='category'&&!(dependencies[s.type]||[]).includes(changedKey)))continue;if(s.plan.edited){if(markSource)s.plan.sourcePending=true;}else{Object.assign(s.plan,contentProvider.generateSection(s.type,state.product));s.plan.sourcePending=false;}}}
function renderForm(){const form=$('#product-form');form.replaceChildren();productFields().forEach(([title,fs],i)=>{const details=document.createElement('details');details.className='field-group';details.open=i===0;const sum=document.createElement('summary');sum.textContent=title;details.append(sum);const grid=document.createElement('div');grid.className='form-grid';for(const [key,label,values,type,wide] of fs){const wrap=document.createElement('label');wrap.textContent=label;wrap.className=wide||'';wrap.dataset.field=key;let el;if(Array.isArray(values)){el=document.createElement('select');for(const text of values){const op=document.createElement('option');op.value=text;op.textContent=text;el.append(op);}}else{el=document.createElement(type==='textarea'?'textarea':'input');if(type!=='textarea')el.type=type||'text';else el.rows=2;if(type==='number'){el.min=key==='quantity'?'1':'0';el.max=key==='quantity'?'9999':'999999999';}el.placeholder='미확인 / 입력해 주세요';}el.name=key;el.value=state.product[key];el.addEventListener('focus',()=>el.dataset.before=el.value);el.addEventListener('input',()=>{if(el.value===state.product[key])return;if(el.dataset.tracked!=='yes'){checkpoint();el.dataset.tracked='yes';}state.product[key]=el.type==='number'&&el.value!==''?String(Math.max(key==='quantity'?1:0,Math.min(Number(el.max),Number(el.value)||0))):el.value;syncTemplates(true,key);changed({editor:true});if(key==='category')renderForm();});el.addEventListener('blur',()=>delete el.dataset.tracked);wrap.append(el);grid.append(wrap);}details.append(grid);form.append(details);});}
function pick(id){selected=id;renderSections();renderEditor();drawSelection();showInspector('properties');}
function moveSection(id,dir){const i=state.sections.findIndex(s=>s.id===id),j=i+dir;if(j<0||j>=state.sections.length)return;checkpoint();[state.sections[i],state.sections[j]]=[state.sections[j],state.sections[i]];changed();}
function button(text,action,title){const b=document.createElement('button');b.type='button';b.textContent=text;if(title)b.title=title;b.onclick=action;return b;}
function showInspector(mode){
 const properties=mode==='properties';
 for(const [id,on] of [['sections-tab',!properties],['properties-tab',properties]]){const tab=document.getElementById(id);if(tab){tab.setAttribute('aria-selected',String(on));tab.tabIndex=on?0:-1;}}
 const navigation=document.getElementById('section-navigation'),panel=document.getElementById('section-properties');
 if(navigation)navigation.hidden=properties;if(panel)panel.hidden=!properties;
 $('#edit-panel').scrollTop=0;
}
function renderSections(){const list=$('#section-list');list.replaceChildren();designSections().forEach((s,i)=>{
 const row=document.createElement('div');row.className='section-item'+(s.id===selected?' active':'')+(!s.visible?' muted':'');row.dataset.section=s.id;
 const select=button('',()=>{pick(s.id);jumpToSection(s.id);},'이 섹션 편집');select.className='section-select';select.setAttribute('aria-label',String(i+1)+'번 '+(s.title||'제목 없음')+' 편집');if(s.id===selected)select.setAttribute('aria-current','true');
 const idx=document.createElement('span');idx.className='index';idx.textContent=String(i+1).padStart(2,'0');
 const name=document.createElement('span');name.className='section-name';name.textContent=s.title||'제목 없음';name.title=name.textContent;
 const thumb=document.createElement('img');thumb.className='page-thumb';thumb.alt='';const first=state.photos.find(p=>(s.photoIds||[]).includes(p.id)&&!['reference','info'].includes(p.kind));if(first)thumb.src=first.src;else thumb.hidden=true;
 select.append(thumb,idx,name);row.append(select);
 const controls=document.createElement('div');controls.className='section-controls';
 const visibility=button(s.visible?'표시':'숨김',()=>{checkpoint();s.visible=!s.visible;changed({editor:true});},'섹션 표시 / 숨기기');visibility.setAttribute('aria-pressed',String(s.visible));
 const up=button('↑',()=>moveSection(s.id,-1),'위로 이동'),down=button('↓',()=>moveSection(s.id,1),'아래로 이동');up.setAttribute('aria-label',String(i+1)+'번 섹션 위로 이동');down.setAttribute('aria-label',String(i+1)+'번 섹션 아래로 이동');up.disabled=i===0;down.disabled=i===designSections().length-1;
 controls.append(visibility,up,down);row.append(controls);list.append(row);
 });}

function renderEditor(){const s=state.sections.find(x=>x.id===selected);renderReactEditor($('#section-editor'),{section:s?{...s}:null,fontSize:state.style.fontSize,photos:state.photos,onPhotoSizing:id=>reviewPhotoSizing(s,id),onBegin:checkpoint,onEdit:(key,value)=>{if(!s)return;s[key]=value;s.custom=true;changed({editor:true});},onRegenerate:()=>{checkpoint();Object.assign(s.plan,contentProvider.generateSection(s.type,state.product));s.plan.edited=false;s.plan.sourcePending=false;changed();openApplyDialog([s.id]);},onDelete:()=>{checkpoint();state.sections=state.sections.filter(x=>x.id!==s.id);selected=state.sections[0]?.id||'';changed({editor:true});},planPending:!!s&&draftChanged(s),sourcePending:!!s?.plan?.sourcePending,onReviewSource:()=>reviewSourceChanges([s.id]),onApplyDraft:()=>openApplyDialog([s.id]),onPreset:applyStudioPreset});}
function renderPlan(){const list=$('#plan-list');list.replaceChildren();state.sections.forEach((s,i)=>{const card=document.createElement('div');card.className='plan-card';const n=document.createElement('span');n.className='number';n.textContent=String(i+1).padStart(2,'0');const body=document.createElement('div');const input=document.createElement('input');input.value=s.title;input.onchange=()=>{checkpoint();s.title=input.value;s.custom=true;changed({editor:true});};const p=document.createElement('p');p.textContent=s.body.slice(0,150);const tools=document.createElement('div');tools.append(button(s.visible?'표시 중':'숨김',()=>{checkpoint();s.visible=!s.visible;changed();}),button('↑',()=>moveSection(s.id,-1)),button('↓',()=>moveSection(s.id,1)));body.append(input,p,tools);card.append(n,body);list.append(card);});}
function renderPhotos(){const list=$('#photo-list');list.replaceChildren();$('#photo-count').textContent=state.photos.length;state.photos.forEach((p,i)=>{const row=document.createElement('div');row.className='photo-row';const img=document.createElement('img');img.src=p.src;img.alt=p.name;const info=document.createElement('div');info.className='photo-info';const name=document.createElement('small');name.textContent=p.name;const select=document.createElement('select');select.style.cssText='font-size:10px;padding:3px;margin:0';select.innerHTML='<option value="product">제품 사진</option><option value="ai">AI 연출 이미지</option><option value="info">상품정보 참고</option><option value="test">테스트 증빙</option><option value="reference">참고 레퍼런스</option>';select.value=p.kind;select.onchange=()=>{checkpoint();p.kind=select.value;changed();};info.append(name,select);const controls=document.createElement('div');controls.append(button('↑',()=>{if(!i)return;checkpoint();[state.photos[i-1],state.photos[i]]=[p,state.photos[i-1]];changed();},'사진 위로 이동'),button('↓',()=>{if(i===state.photos.length-1)return;checkpoint();[state.photos[i+1],state.photos[i]]=[p,state.photos[i+1]];changed();},'사진 아래로 이동'));controls.append(button('교체',()=>{const file=document.createElement('input');file.type='file';file.accept='image/*';file.onchange=async()=>{if(!file.files[0])return;try{const src=await readPhoto(file.files[0]);checkpoint();p.src=src;p.name=file.files[0].name;p.width=0;p.height=0;changed();}catch(e){notify(e.message);}};file.click();}));controls.append(button('×',()=>{checkpoint();state.photos.splice(i,1);for(const section of state.sections){section.photoIds=section.photoIds.filter(id=>id!==p.id);section.plan.photoIds=section.plan.photoIds.filter(id=>id!==p.id);section.plan.referenceIds=section.plan.referenceIds.filter(id=>id!==p.id);}imageCache.delete(p.src);changed();},'사진 삭제'));row.append(img,info,controls);list.append(row);});}
const imageCache=new Map(),imageAspectCache=new Map();
function imageContentBox(img){let box=img.yesDetailContentBox;
 if(!box){
  box={x:0,y:0,w:img.width,h:img.height};
  try{const probe=document.createElement('canvas');const ratio=Math.min(1,600/img.width);probe.width=Math.ceil(img.width*ratio);probe.height=Math.ceil(img.height*ratio);const pc=probe.getContext('2d',{willReadFrequently:true});pc.drawImage(img,0,0,probe.width,probe.height);const pixels=pc.getImageData(0,0,probe.width,probe.height).data;let minX=probe.width,minY=probe.height,maxX=-1,maxY=-1;for(let yy=0;yy<probe.height;yy++)for(let xx=0;xx<probe.width;xx++){const j=(yy*probe.width+xx)*4;if(pixels[j+3]>100&&Math.min(pixels[j],pixels[j+1],pixels[j+2])<240){minX=Math.min(minX,xx);maxX=Math.max(maxX,xx);minY=Math.min(minY,yy);maxY=Math.max(maxY,yy);}}if(maxX>=minX&&maxY>=minY){const pad=12;const x=Math.max(0,minX-pad),y=Math.max(0,minY-pad),right=Math.min(probe.width,maxX+pad+1),bottom=Math.min(probe.height,maxY+pad+1);box={x:x/ratio,y:y/ratio,w:(right-x)/ratio,h:(bottom-y)/ratio};}}catch{}
  img.yesDetailContentBox=box;
 }
return box;}
async function imageFor(src){if(imageCache.has(src))return imageCache.get(src);const promise=new Promise(resolve=>{const img=new Image();img.onload=()=>{const box=imageContentBox(img);imageAspectCache.set(src,box.w/box.h);resolve(img);};img.onerror=()=>resolve(null);img.src=src;});imageCache.set(src,promise);return promise;}
async function readPhoto(file){if(file.size>25*1024*1024)throw Error('사진은 25MB 이하로 올려 주세요.');const url=URL.createObjectURL(file);try{const img=await imageFor(url);if(!img)throw Error('사진을 읽을 수 없습니다. JPG 또는 PNG를 사용해 주세요.');const c=document.createElement('canvas');const r=Math.min(1,1600/img.width,16000/img.height,Math.sqrt(24000000/(img.width*img.height)));c.width=Math.round(img.width*r);c.height=Math.round(img.height*r);c.getContext('2d').drawImage(img,0,0,c.width,c.height);return c.toDataURL('image/png');}finally{URL.revokeObjectURL(url);imageCache.delete(url);}}
function wrap(ctx,text,width){const output=[];for(const para of String(text).split('\n')){if(!para){output.push('');continue;}let line='';for(const char of para){if(ctx.measureText(line+char).width>width&&line){output.push(line);line=char;}else line+=char;}output.push(line);}return output;}
function font(ctx,size,bold=false){ctx.font=`${bold?700:400} ${size}px "Malgun Gothic", "Segoe UI", sans-serif`;ctx.textBaseline='top';}
const salesRenderer=createSalesRenderer({getState:()=>state,imageFor,sectionTypes,imageAspect:src=>imageAspectCache.get(src)});
function measureSection(s,index=0){return salesRenderer.measure(s,index);}
async function paint(canvas,plans){return salesRenderer.paint(canvas,plans);}
let renderPromise=Promise.resolve();
function renderCanvas(){const version=++renderVersion;renderPromise=(async()=>{await Promise.all(state.photos.map(async p=>{const img=await imageFor(p.src);if(img){p.width=img.width;p.height=img.height;}}));if(version!==renderVersion)return;const sections=designSections().filter(s=>s.visible).map((s,index)=>measureSection(s,index));const off=document.createElement('canvas');await paint(off,sections);if(version!==renderVersion)return;const canvas=$('#preview');canvas.width=off.width;canvas.height=off.height;canvas.getContext('2d').drawImage(off,0,0);let y=0;bounds=sections.map(d=>{const b={id:d.s.id,y,height:d.height};y+=d.height;return b;});applyZoom();drawSelection();updatePageThumbnails();$('#dimensions').textContent=`860 × ${canvas.height.toLocaleString()}px`;return true;})().catch(error=>{$('#dimensions').textContent='미리보기 한도 초과 · 섹션별 PNG 사용';notify(error.message);return false;});return renderPromise;}
function applyZoom(){const available=$('#preview-scroll').clientWidth-48;const effective=Math.min(zoom,Math.max(.2,available/860));$('#canvas-wrap').style.width=860*effective+'px';$('#zoom').textContent=Math.round(effective*100)+'%';drawSelection();}
function drawSelection(){const b=bounds.find(x=>x.id===selected);const box=$('#selection-box');box.hidden=!b;if(b){const scale=$('#preview').getBoundingClientRect().width/860;box.style.top=b.y*scale+'px';box.style.height=b.height*scale+'px';}}
function setStep(n){step=n;$$('[data-step]').forEach(b=>b.classList.toggle('active',+b.dataset.step===n));$('#plan-view').hidden=n!==2;$('#preview-scroll').hidden=n===2;$('#preview-title').textContent=n===2?'기획안 검토':'상세페이지 미리보기';if(n===2)renderPlan();else renderCanvas();showPanel(n===1?'input-panel':'preview-panel');}
function showPanel(id){$$('main>.panel,main>.preview-panel').forEach(e=>e.classList.toggle('panel-visible',e.id===id));$$('[data-panel]').forEach(e=>e.classList.toggle('active',e.dataset.panel===id));if(id==='preview-panel')setTimeout(applyZoom,0);}
function downloadFallback(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
function toBlob(c){return new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('이미지를 생성하지 못했습니다.')),'image/png'));}
async function exportFull(){
 const control=$('#export');if(control.disabled)return;control.disabled=true;
 try{
  let handle=null,name=safeProductName()+'-상세페이지.png';
  // Open while the click still has user activation, before asynchronous rendering.
  if(window.showSaveFilePicker){
   handle=await window.showSaveFilePicker({id:'yesdetail-png',suggestedName:name,types:[{description:'PNG 이미지',accept:{'image/png':['.png']}}]});
  }else{
   const entered=window.prompt('PNG 파일 이름을 입력하세요. 저장 위치는 브라우저 다운로드 설정을 따릅니다.',name);
   if(entered===null)return;
   name=entered.trim().replace(/[\\/:*?"<>|\x00-\x1f]/g,'-');
   if(!name)return notify('파일 이름을 입력해 주세요.');
   if(!name.toLowerCase().endsWith('.png'))name+='.png';
  }
  if(!await renderCanvas())throw Error('전체 PNG를 생성하지 못했습니다. 섹션별 PNG를 사용해 주세요.');
  const canvas=document.createElement('canvas');
  await paint(canvas,designSections().filter(s=>s.visible).map((s,index)=>measureSection(s,index)));
  if(canvas.height>30000)throw Error('페이지가 너무 깁니다. 섹션별 PNG를 사용해 주세요.');
  const blob=await toBlob(canvas);
  if(handle){
   const writer=await handle.createWritable();
   try{await writer.write(blob);await writer.close();}catch(error){try{await writer.abort();}catch{}throw error;}
   notify('860px PNG를 저장했습니다: '+handle.name);
  }else{downloadFallback(blob,name);notify('PNG 다운로드를 요청했습니다. 이 브라우저는 저장 위치 선택을 지원하지 않습니다.');}
 }catch(error){if(error.name!=='AbortError')notify('PNG 저장에 실패했습니다: '+error.message);}
 finally{control.disabled=false;}
}
async function exportSplit(){if($('#split').disabled)return;$('#split').disabled=true;try{await Promise.all(state.photos.map(async p=>{const image=await imageFor(p.src);if(image){p.width=image.width;p.height=image.height;}}));const sections=designSections().filter(s=>s.visible).map((s,index)=>measureSection(s,index));if(!sections.length)return notify('표시할 섹션이 없습니다.');const files=[];for(let i=0;i<sections.length;i++){const c=document.createElement('canvas');await paint(c,[sections[i]]);files.push({name:`${String(i+1).padStart(2,'0')}-section.png`,bytes:new Uint8Array(await (await toBlob(c)).arrayBuffer())});}await saveLocalFile(zipStore(files),safeProductName()+'-섹션별.zip');notify('섹션별 PNG를 ZIP으로 저장했습니다.');}catch(e){notify(e.message);}finally{$('#split').disabled=false;}}
// Uncompressed ZIP keeps split export dependency-free and avoids multiple-download prompts.
function crc32(bytes){let c=-1;for(const b of bytes){c^=b;for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^-1)>>>0;}
function zipStore(files){const chunks=[],central=[];let offset=0,centralSize=0;const enc=new TextEncoder();for(const f of files){const name=enc.encode(f.name),crc=crc32(f.bytes),size=f.bytes.length;const local=new Uint8Array(30+name.length),v=new DataView(local.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,crc,true);v.setUint32(18,size,true);v.setUint32(22,size,true);v.setUint16(26,name.length,true);local.set(name,30);chunks.push(local,f.bytes);const cen=new Uint8Array(46+name.length),cv=new DataView(cen.buffer);cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x800,true);cv.setUint32(16,crc,true);cv.setUint32(20,size,true);cv.setUint32(24,size,true);cv.setUint16(28,name.length,true);cv.setUint32(42,offset,true);cen.set(name,46);central.push(cen);offset+=local.length+size;centralSize+=cen.length;}const end=new Uint8Array(22),ev=new DataView(end.buffer);ev.setUint32(0,0x06054b50,true);ev.setUint16(8,files.length,true);ev.setUint16(10,files.length,true);ev.setUint32(12,centralSize,true);ev.setUint32(16,offset,true);return new Blob([...chunks,...central,end],{type:'application/zip'});}
function restore(raw){state=JSON.parse(raw);selected=state.sections.some(s=>s.id===selected)?selected:state.sections[0]?.id||'';$('#accent').value=state.style.accent;$('#font-size').value=state.style.fontSize;$('#font-value').textContent=state.style.fontSize+'px';changed({editor:true,form:true});}
$('#undo').onclick=()=>{if(!history.length)return;future.push(JSON.stringify(state));restore(history.pop());};$('#redo').onclick=()=>{if(!future.length)return;history.push(JSON.stringify(state));restore(future.pop());};
$('#plan').onclick=()=>setStep(2);$('#generate').onclick=()=>{setStep(3);notify('입력 정보로 디자인을 구성했습니다. 문구를 두 번 클릭해 수정하세요.');};$$('[data-step]').forEach(b=>b.onclick=()=>setStep(+b.dataset.step));$$('[data-panel]').forEach(b=>b.onclick=()=>showPanel(b.dataset.panel));
$('#add-section').onclick=()=>{if(state.sections.length>=50)return notify('섹션은 50개까지 추가할 수 있습니다.');checkpoint();const s={id:uid(),type:'custom',...contentProvider.generateSection('custom',state.product),visible:true,custom:true,fontSize:null,color:null};state.sections.push(s);selected=s.id;changed({editor:true});};
$('#photos').onchange=async e=>{const files=[...e.target.files];if(files.length+state.photos.length>30)return notify('사진은 30장까지 추가할 수 있습니다.');try{const result=[];for(const f of files)result.push({id:uid(),src:await readPhoto(f),name:f.name,kind:'product'});checkpoint();state.photos.push(...result);changed();}catch(e){notify(e.message);}e.target.value='';};
$('#accent').onchange=e=>{checkpoint();state.style.accent=e.target.value;changed();};$('#font-size').onchange=e=>{checkpoint();state.style.fontSize=+e.target.value;$('#font-value').textContent=e.target.value+'px';changed();};
$('#preview').onclick=e=>{const rect=e.currentTarget.getBoundingClientRect(),y=(e.clientY-rect.top)*860/rect.width,b=bounds.find(b=>y>=b.y&&y<b.y+b.height);if(b)pick(b.id);};
$('#preview').ondblclick=()=>{const s=state.sections.find(s=>s.id===selected);if(!s)return;$('#direct-title').value=s.title;$('#direct-body').value=s.body;$('#text-dialog').showModal();};
$('#direct-apply').onclick=()=>{const s=state.sections.find(s=>s.id===selected);if(!s)return;checkpoint();s.title=$('#direct-title').value;s.body=$('#direct-body').value;s.custom=true;changed({editor:true});};
$('#zoom-in').onclick=()=>{zoom=Math.min(1,zoom+.1);applyZoom();};$('#zoom-out').onclick=()=>{zoom=Math.max(.25,zoom-.1);applyZoom();};window.addEventListener('resize',applyZoom);
async function saveProjectAs(){
 const control=$('#save-file');
 if(control.disabled)return;
 control.disabled=true;
 const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
 const suggestedName=safeProductName()+'-프로젝트.json';
 try{
  if(window.showSaveFilePicker){
   const handle=await window.showSaveFilePicker({id:'yesdetail-project',suggestedName,types:[{description:'YesDetail 프로젝트',accept:{'application/json':['.json']}}]});
   const writer=await handle.createWritable();
   try{await writer.write(blob);await writer.close();}catch(error){try{await writer.abort();}catch{}throw error;}
   notify('프로젝트를 저장했습니다: '+handle.name);
  }else{
   const entered=window.prompt('프로젝트 파일 이름을 입력하세요. 저장 위치는 브라우저 다운로드 설정을 따릅니다.',suggestedName);
   if(entered===null)return;
   let name=entered.trim().replace(/[\\/:*?"<>|\x00-\x1f]/g,'-');
   if(!name)return notify('파일 이름을 입력해 주세요.');
   if(!name.toLowerCase().endsWith('.json'))name+='.json';
   downloadFallback(blob,name);
   notify('프로젝트 다운로드를 요청했습니다. 이 브라우저는 저장 위치 선택을 지원하지 않습니다.');
  }
 }catch(error){if(error.name!=='AbortError')notify('프로젝트 저장에 실패했습니다. 다시 저장해 주세요: '+error.message);}
 finally{control.disabled=false;}
}
$('#save-file').onclick=saveProjectAs;
$('#load-file').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>80*1024*1024)throw Error('프로젝트 파일이 너무 큽니다.');const data=validate(JSON.parse(await f.text()));checkpoint();storageReadFailed=false;state=data;selected=state.sections[0]?.id||'';restore(JSON.stringify(state));notify('프로젝트를 불러왔습니다.');}catch(e){notify('불러오기 실패: '+e.message);}e.target.value='';};
$('#export').onclick=exportFull;$('#split').onclick=exportSplit;
window.addEventListener('beforeunload',e=>{if(savedRevision<saveRevision){void flushSave();e.preventDefault();e.returnValue='';}});
document.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();$(e.shiftKey?'#redo':'#undo').click();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();$('#save-file').click();}});
// Version 2: editable planning drafts are separate from the applied design.
function migrateV2(data){
 if(!data||![1,2].includes(data.version)||!data.product||!Array.isArray(data.sections)||!Array.isArray(data.photos)||!data.style)throw Error('지원하지 않는 프로젝트 파일입니다.');
 if(data.sections.length>50||data.photos.length>120)throw Error('섹션은 50개, 사진·레퍼런스는 120개까지 지원합니다.');
 const clean=(v,n=15000)=>String(v??'').slice(0,n),hex=v=>/^#[0-9a-f]{6}$/i.test(v)?v:null,used=new Set();
 const id=v=>typeof v==='string'&&v.length<100&&!used.has(v)?(used.add(v),v):(used.add(v=uid()),v);
 const photos=data.photos.map(p=>{if(!/^(data:image\/(png|jpeg|webp|gif|avif);base64,|assets\/[a-z0-9-]+\.jpg$)/i.test(p.src))throw Error('지원하지 않는 이미지 경로입니다.');return {id:id(p.id),src:p.src,name:clean(p.name||'사진',150),width:Math.max(0,Number(p.width)||0),height:Math.max(0,Number(p.height)||0),kind:['product','ai','info','test','reference'].includes(p.kind)?p.kind:'product'};});
 const media=(ids,ref=false)=>[...new Set(Array.isArray(ids)?ids:[])].filter(v=>photos.some(p=>p.id===v&&(ref?['reference','info'].includes(p.kind):!['reference','info'].includes(p.kind))));
 const product=Object.fromEntries(Object.keys(defaults).map(k=>[k,clean(data.product[k]??defaults[k],10000)]));
 const sections=data.sections.map(raw=>{
  const type=sectionTypes.some(([t])=>t===raw.type)?raw.type:'custom',legacy=data.version===1;
  let photoIds=media(raw.photoIds);
  if(legacy){const productPhotos=photos.filter(p=>p.kind==='product');photoIds=type==='hero'?(productPhotos.find(p=>p.name.includes(product.spec.includes('12800')?'12800':'10600'))||productPhotos[0])?.id: type==='photos'?productPhotos.map(p=>p.id):type==='test'?photos.filter(p=>p.kind==='test').map(p=>p.id):[];if(typeof photoIds==='string')photoIds=[photoIds];photoIds=photoIds||[];}
  const plan=raw.plan||raw;
  return {id:id(raw.id),type,title:clean(raw.title,2000),body:clean(raw.body),visible:raw.visible!==false,custom:!!raw.custom,fontSize:raw.fontSize?Math.min(42,Math.max(20,Number(raw.fontSize)||28)):null,color:hex(raw.color),background:hex(raw.background),align:['left','center','right'].includes(raw.align)?raw.align:'left',imageFit:raw.imageFit==='cover'?'cover':'contain',focusX:Math.max(0,Math.min(100,Number.isFinite(Number(raw.focusX))&&raw.focusX!=null?Number(raw.focusX):50)),focusY:Math.max(0,Math.min(100,Number.isFinite(Number(raw.focusY))&&raw.focusY!=null?Number(raw.focusY):50)),presentation:['editorial','photoFirst','imageOnly','split','points','steps','foodHero','foodBundle','foodTexture','foodSpecs','foodGuide','foodShipping','foodFeatures','studioHero','studioOptions','studioDetail','studioSpecs','studioFaq','studioFeatures','studioGuide'].includes(raw.presentation)?raw.presentation:'standard',imageHeight:Math.min(1100,Math.max(240,Number(raw.imageHeight)||520)),titleSize:Math.min(80,Math.max(30,Number(raw.titleSize)||54)),photoIds,photoSizing:Object.fromEntries(photoIds.filter(id=>raw.photoSizing?.[id]==='auto').map(id=>[id,'auto'])),layout:clean(raw.layout,2000),plan:{title:clean(plan.title,2000),body:clean(plan.body),visible:plan.visible!==false,photoIds:legacy?[...photoIds]:media(plan.photoIds),referenceIds:media(plan.referenceIds,true),layout:clean(plan.layout,2000),prompt:clean(plan.prompt,4000),edited:legacy?!!raw.custom:!!plan.edited,collapsed:!!plan.collapsed,sourcePending:!!plan.sourcePending}};
 });
 const existing=new Set(sections.map(s=>s.id));const designOrder=[...new Set(Array.isArray(data.designOrder)?data.designOrder:[])].filter(id=>existing.has(id));for(const s of sections)if(!designOrder.includes(s.id))designOrder.push(s.id);
 return {version:2,product,photos,sections,designOrder,style:{mood:data.style.mood?{light:hex(data.style.mood.light)||'#e9f1ea',dark:hex(data.style.mood.dark)||'#191e1b',soft:hex(data.style.mood.soft)||'#6ac88a'}:null,accent:hex(data.style.accent)||'#2459e0',fontSize:Math.min(38,Math.max(22,Number(data.style.fontSize)||28))}};
}
function designSections(){const positions=new Map((state.designOrder||[]).map((id,i)=>[id,i]));return [...state.sections].sort((a,b)=>(positions.get(a.id)??999)-(positions.get(b.id)??999));}
function draftChanged(s){return ['title','body','visible','layout'].some(k=>(s.plan[k]??'')!==(s[k]??''))||JSON.stringify(s.photoIds)!==JSON.stringify(s.plan.photoIds);}
function sectionName(s){return sectionTypes.find(([t])=>t===s.type)?.[1]||'추가 안내';}
function planChanged(s){s.plan.edited=true;persist();renderOutline();refreshPlanningMeta();$('#undo').disabled=!history.length;$('#redo').disabled=!future.length;}
function element(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;}
function planField(label,value,oninput,{area=false,placeholder='',rows=3}={}){
 const wrap=element('label','plan-field',label),input=element(area?'textarea':'input');input.value=value;input.placeholder=placeholder;if(area)input.rows=rows;let tracked=false;input.onfocus=()=>tracked=false;input.oninput=()=>{if(!tracked){checkpoint();tracked=true;}oninput(input.value);};wrap.append(input);return wrap;
}
function selectCard(id,scroll=true){selected=id;renderSections();renderEditor();renderOutline();$$('.planning-card').forEach(c=>c.classList.toggle('selected',c.dataset.id===id));if(scroll)document.getElementById('card-'+id)?.scrollIntoView({behavior:'smooth',block:'start'});}
function renderOutline(){
 const list=$('#outline-list');if(!list)return;list.replaceChildren();state.sections.forEach((s,i)=>{const b=button('',()=>{selectCard(s.id);showPanel('preview-panel');});b.className='outline-item'+(selected===s.id?' selected':'')+(!s.plan.visible?' is-hidden':'');b.append(element('span','outline-number',String(i+1).padStart(2,'0')));const info=element('span','outline-info');info.append(element('small','',sectionName(s)),element('strong','',s.plan.title||'제목 없음'));b.append(info);if(draftChanged(s))b.append(element('span','pending-dot','●'));b.setAttribute('aria-label',`${i+1} ${sectionName(s)}: ${s.plan.title}`);list.append(b);});
}
function refreshPlanningMeta(){
 const visible=state.sections.filter(s=>s.plan.visible),length=visible.reduce((sum,s,i)=>sum+measureSection({...s,...s.plan},i).height,0),pending=state.sections.filter(draftChanged).length;
 $('#plan-count').textContent=`표시 ${visible.length} / 전체 ${state.sections.length}개`;
 $('#plan-length').textContent=`예상 860 × ${length.toLocaleString()}px`;
 const orderPending=JSON.stringify(state.sections.map(s=>s.id))!==JSON.stringify(state.designOrder);$('#plan-pending').textContent=pending||orderPending?`${pending}개 섹션 변경 대기${orderPending?' · 순서 변경 대기':''}`:'기획과 디자인이 일치합니다';
}
function duplicateSection(id){if(state.sections.length>=50)return notify('섹션은 50개까지 지원합니다.');const i=state.sections.findIndex(s=>s.id===id);if(i<0)return;checkpoint();const copy=clone(state.sections[i]);copy.id=uid();copy.plan.title+=' (복사)';copy.plan.collapsed=false;copy.visible=false;copy.custom=false;state.sections.splice(i+1,0,copy);state.designOrder.push(copy.id);selected=copy.id;changed({editor:true});selectCard(copy.id);}
function deleteSection(id){checkpoint();state.sections=state.sections.filter(s=>s.id!==id);state.designOrder=state.designOrder.filter(x=>x!==id);selected=state.sections[0]?.id||'';changed({editor:true});}
function movePlanTo(id,target){const from=state.sections.findIndex(s=>s.id===id),to=state.sections.findIndex(s=>s.id===target);if(from<0||to<0||from===to)return;checkpoint();const [moved]=state.sections.splice(from,1);state.sections.splice(to,0,moved);selected=id;changed({editor:true});selectCard(id,false);document.querySelector(`[data-id="${id}"] .drag-handle`)?.focus();}
function movePlanBy(id,dir){const i=state.sections.findIndex(s=>s.id===id),j=i+dir;if(j<0||j>=state.sections.length)return;movePlanTo(id,state.sections[j].id);}
async function uploadPlanMedia(s,kind,replaceAt=null){
 const input=document.createElement('input');input.type='file';input.accept='image/*';input.multiple=replaceAt===null;input.hidden=true;document.body.append(input);input.oncancel=()=>input.remove();
 input.onchange=async()=>{const files=[...input.files];input.remove();if(!files.length)return;if(state.photos.length+files.length>120)return notify('프로젝트 사진은 120개까지 지원합니다.');try{const additions=[];for(const f of files)additions.push({id:uid(),src:await readPhoto(f),name:f.name,kind:replaceAt!==null?(state.photos.find(p=>p.id===s.plan[kind==='reference'?'referenceIds':'photoIds'][replaceAt])?.kind||(kind==='reference'?'reference':'product')):(kind==='reference'?'reference':'product')});checkpoint();state.photos.push(...additions);const key=kind==='reference'?'referenceIds':'photoIds';if(replaceAt===null)s.plan[key].push(...additions.map(p=>p.id));else s.plan[key].splice(replaceAt,1,additions[0].id);s.plan.edited=true;changed({editor:true});}catch(e){notify(e.message);}};input.click();
}

function openExistingPhotoPicker(sectionId,reference=false){
 const section=state.sections.find(s=>s.id===sectionId);if(!section)return;
 const key=reference?'referenceIds':'photoIds';
 const available=state.photos.filter(p=>(reference?['reference','info'].includes(p.kind):!['reference','info'].includes(p.kind))&&!section.plan[key].includes(p.id));
 const dialog=element('dialog','existing-photo-dialog');
 const heading=element('h2','','기존 사진에서 선택');heading.id='existing-photo-heading';dialog.setAttribute('aria-labelledby',heading.id);
 const hint=element('p','','사진과 파일 이름을 확인하고 추가할 사진을 선택하세요. 여러 장을 선택할 수 있습니다.');
 const grid=element('div','existing-photo-grid'),chosen=new Set();
 const confirm=button('선택한 사진 추가 (0)',()=>{
  const current=state.sections.find(s=>s.id===sectionId);if(!current)return dialog.close();
  const ids=available.filter(p=>chosen.has(p.id)&&state.photos.some(v=>v.id===p.id)&&!current.plan[key].includes(p.id)).map(p=>p.id);
  if(!ids.length)return;
  checkpoint();current.plan[key].push(...ids);current.plan.edited=true;dialog.close();changed();
 });confirm.classList.add('primary');confirm.disabled=true;
 for(const photo of available){
  const label=element('label','existing-photo-option'),check=element('input');check.type='checkbox';check.setAttribute('aria-label',photo.name+' 선택');
  const img=element('img');img.src=photo.src;img.alt=photo.name;img.loading='lazy';
  check.onchange=()=>{if(check.checked)chosen.add(photo.id);else chosen.delete(photo.id);label.classList.toggle('is-selected',check.checked);confirm.textContent='선택한 사진 추가 ('+chosen.size+')';confirm.disabled=!chosen.size;};
  label.append(check,img,element('span','',photo.name));grid.append(label);
 }
 const actions=element('div','dialog-actions');actions.append(button('취소',()=>dialog.close()),confirm);
 dialog.append(heading,hint,grid,actions);dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();
}

function renderMedia(s,reference=false){
 const key=reference?'referenceIds':'photoIds',block=element('div','media-block');block.append(element('h4','',reference?'디자인 레퍼런스':'출력할 제품 사진'));
 block.append(element('p','muted',reference?'참고용 자료입니다. 상세페이지와 PNG에 출력되지 않습니다.':'이 섹션에 지정한 사진만 출력합니다. 지정하지 않으면 다른 사진을 넣지 않습니다.'));
 const gallery=element('div','plan-gallery');s.plan[key].forEach((id,i)=>{const p=state.photos.find(x=>x.id===id);if(!p)return;const item=element('div','plan-photo');const img=element('img');img.src=p.src;img.alt=p.name;const name=element('span','media-name',p.name);const role=element('select');role.setAttribute('aria-label','이미지 역할: '+p.name);for(const [value,label]of [['product','실제 상품'],['ai','AI 연출'],['info','정보 참고 · 출력 제외'],['reference','디자인 참고 · 출력 제외'],['test','테스트 증빙']])role.append(new Option(label,value));role.value=p.kind;role.onchange=()=>{checkpoint();p.kind=role.value;state=migrateV2(state);changed({editor:true});};const tools=element('div','media-actions');img.onclick=()=>previewMedia(p);img.style.cursor='zoom-in';for(const dir of [-1,1]){const b=button(dir<0?'↑':'↓',()=>{const j=i+dir;if(j<0||j>=s.plan[key].length)return;checkpoint();[s.plan[key][i],s.plan[key][j]]=[s.plan[key][j],s.plan[key][i]];s.plan.edited=true;changed();},dir<0?'사진 위로 이동':'사진 아래로 이동');b.disabled=i+dir<0||i+dir>=s.plan[key].length;tools.append(b);}tools.append(button('교체',()=>uploadPlanMedia(s,reference?'reference':'product',i)),button('해제',()=>{checkpoint();s.plan[key].splice(i,1);s.plan.edited=true;changed();}));item.append(img,name,role,tools);gallery.append(item);});block.append(gallery);
 const actions=element('div','media-add');actions.append(button(reference?'+ 레퍼런스 업로드':'+ 제품 사진 업로드',()=>uploadPlanMedia(s,reference?'reference':'product')));
 const available=state.photos.filter(p=>(reference?['reference','info'].includes(p.kind):!['reference','info'].includes(p.kind))&&!s.plan[key].includes(p.id));if(available.length)actions.append(button('기존 사진에서 선택',()=>openExistingPhotoPicker(s.id,reference),reference?'기존 레퍼런스 선택':'기존 제품 사진 선택'));block.append(actions);return block;
}
const typeHints={benefits:'한 줄에 핵심 특징 하나씩 입력하세요. 확인되지 않은 성능 수치는 넣지 마세요.',recommend:'추천할 사용 목적과 대상을 한 줄에 하나씩 입력하세요.',compare:'항목 | 이 상품 | 비교 대상 형식으로 입력하세요. 확인된 사실만 비교하세요.',faq:'Q. 질문\nA. 답변 형식으로 작성하세요.',usage:'실제 제품에 맞는 사용·장착 순서를 작성하세요.',compat:'메인보드와 제품 사양을 기준으로 확인할 사항을 작성하세요.'};
function sectionHint(type){
 if(state.product.category==='식품')return type==='compat'?'제품 표시사항에 근거한 보관 방법과 원재료·알레르기 정보를 입력하세요.':type==='usage'?'판매자가 제공한 실제 조리 방법을 입력하세요.':typeHints[type];
 if(state.product.category&&state.product.category!=='메모리'&&type==='compat')return '실제 제품의 규격과 구매 전 확인할 사항을 입력하세요.';
 return typeHints[type];
}
function renderPlanCards(){
 const list=$('#plan-list');list.replaceChildren();state.sections.forEach((s,i)=>{
  const card=element('article','planning-card'+(selected===s.id?' selected':'')+(!s.plan.visible?' hidden-section':''));card.id='card-'+s.id;card.dataset.id=s.id;card.setAttribute('aria-label',`기획 카드 ${i+1}: ${s.plan.title}`);
  card.ondragover=e=>{if(e.dataTransfer.types.includes('text/plain')){e.preventDefault();card.classList.add('drop-target');}};card.ondragleave=()=>card.classList.remove('drop-target');card.ondrop=e=>{e.preventDefault();card.classList.remove('drop-target');movePlanTo(e.dataTransfer.getData('text/plain'),s.id);};
  const header=element('div','card-heading');const handle=button('⠿',()=>selectCard(s.id,false),'드래그 또는 Alt+위·아래 화살표로 순서 변경');handle.className='drag-handle';handle.draggable=true;handle.setAttribute('aria-label',`섹션 ${i+1} 순서 변경`);handle.ondragstart=e=>{e.dataTransfer.setData('text/plain',s.id);e.dataTransfer.effectAllowed='move';selectCard(s.id,false);};handle.onkeydown=e=>{if(e.altKey&&['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();movePlanBy(s.id,e.key==='ArrowUp'?-1:1);}};header.append(handle,element('span','card-order',String(i+1).padStart(2,'0')),element('span','type-tag',sectionName(s)));
  const flags=element('span','card-flags',!s.plan.visible?'숨김':draftChanged(s)?'변경 대기':s.custom?'직접 편집된 디자인':'디자인 반영됨');header.append(flags);
  const controls=element('div','card-actions');controls.append(button(s.plan.collapsed?'펼치기':'접기',()=>{s.plan.collapsed=!s.plan.collapsed;persist();renderPlanCards();}),button('↑',()=>movePlanBy(s.id,-1),'섹션 위로 이동'),button('↓',()=>movePlanBy(s.id,1),'섹션 아래로 이동'),button('복제',()=>duplicateSection(s.id)),button(s.plan.visible?'숨기기':'표시',()=>{checkpoint();s.plan.visible=!s.plan.visible;changed();}),button('삭제',()=>deleteSection(s.id)));header.append(controls);card.append(header);
  const body=element('div','card-content');body.hidden=s.plan.collapsed;body.addEventListener('focusin',()=>selectCard(s.id,false));
  body.append(planField('기획 제목',s.plan.title,v=>{s.plan.title=v;planChanged(s);}),planField('기획 본문',s.plan.body,v=>{s.plan.body=v;planChanged(s);},{area:true,rows:5,placeholder:sectionHint(s.type)||'확인된 상품 정보를 입력해 주세요.'}));
  if(sectionHint(s.type))body.append(element('p','format-hint',sectionHint(s.type)));
  if(s.type==='faq')body.append(button('+ 질문·답변 추가',()=>{checkpoint();s.plan.body+=(s.plan.body?'\n\n':'')+'Q. 질문을 입력하세요\nA. 확인된 답변을 입력하세요';s.plan.edited=true;changed();}));
  const media=element('div','card-media-columns');media.append(renderMedia(s),renderMedia(s,true));body.append(media);
  body.append(planField('이미지 배치 설명 · 작업 메모',s.plan.layout,v=>{s.plan.layout=v;planChanged(s);},{area:true,rows:2,placeholder:'예: 라벨을 읽을 수 있도록 제품을 크게 배치'}));
  body.append(planField('외부 AI 이미지 생성 프롬프트',s.plan.prompt,v=>{s.plan.prompt=v;planChanged(s);},{area:true,rows:2,placeholder:'외부 AI에 입력할 이미지 프롬프트를 적어 두세요.'}));
  const footer=element('div','card-footer');footer.append(button('본문 TXT 불러오기',()=>importBodyText(s.id)),element('span','muted','사진 순서는 여기서 정하고, 실제 배치는 디자인 편집에서 선택합니다.'),button('이 섹션만 디자인에 반영',()=>openApplyDialog([s.id])));body.append(footer);card.append(body);if(s.plan.collapsed)card.append(element('div','collapsed-title',s.plan.title||'제목 없음'));list.append(card);
 });renderOutline();refreshPlanningMeta();
}
function openApplyDialog(ids){
 const dialog=$('#apply-dialog'),list=$('#apply-list');list.replaceChildren();dialog.dataset.ids=JSON.stringify(ids);const scope=ids.length===1?'선택한 섹션':'전체 기획';$('#apply-heading').textContent=scope+' 디자인 반영';
 for(const id of ids){const s=state.sections.find(x=>x.id===id);if(!s)continue;const row=element('section','apply-row');const label=element('label','apply-check');const check=element('input');check.type='checkbox';check.value=id;check.checked=!s.custom;check.setAttribute('aria-label',`${s.plan.title} 적용`);label.append(check,element('strong','',s.plan.title||'제목 없음'));if(s.custom)label.append(element('span','manual-tag','직접 편집됨 · 기본 보존'));row.append(label);
 const columns=element('div','diff-columns');for(const [title,data] of [['현재 디자인',s],['반영할 기획',s.plan]]){const column=element('div');column.append(element('h4','',title),element('strong','',data.title),element('pre','',data.body));const names=(data.photoIds||[]).map(id=>state.photos.find(p=>p.id===id)?.name||'삭제된 사진');column.append(element('p','muted',`사진: ${names.join(', ')||'없음'} / ${data.visible?'표시':'숨김'}`));if(data.layout)column.append(element('p','muted','배치 메모: '+data.layout));columns.append(column);}row.append(columns);list.append(row);
 }dialog.showModal();
}
function commitPlan(){
 const checks=[...$('#apply-list').querySelectorAll('input:checked')],ids=new Set(checks.map(c=>c.value));if(!ids.size){notify('반영할 섹션을 선택해 주세요.');return;}
 checkpoint();for(const s of state.sections)if(ids.has(s.id)){Object.assign(s,{title:s.plan.title,body:s.plan.body,visible:s.plan.visible,photoIds:[...s.plan.photoIds],layout:s.plan.layout,custom:false});}
 // Move selected IDs to their planned positions; preserve unselected relative order.
 const previous=designSections().map(s=>s.id).filter(id=>!ids.has(id));state.sections.forEach((s,index)=>{if(ids.has(s.id))previous.splice(Math.min(index,previous.length),0,s.id);});state.designOrder=previous;
 $('#apply-dialog').close();changed({editor:true});setStep(3);notify(`${ids.size}개 섹션을 반영했습니다. 선택하지 않은 디자인은 유지했습니다.`);
}
function openAddDialog(){if(state.sections.length>=50)return notify('섹션은 50개까지 지원합니다.');$('#new-section-dialog').showModal();}
function addTypedSection(){const type=$('#new-section-type').value;checkpoint();const text=contentProvider.generateSection(type,state.product);const s={id:uid(),type,...text,visible:false,custom:false,fontSize:null,color:null,photoIds:[],layout:'',plan:{...text,visible:true,photoIds:[],referenceIds:[],layout:'',prompt:'',edited:false,collapsed:false}};state.sections.push(s);state.designOrder.push(s.id);selected=s.id;$('#new-section-dialog').close();changed({editor:true});setStep(2);selectCard(s.id);}
// Install the planning workspace after legacy UI bindings, before first render.
state=migrateV2(state);selected=state.sections[0]?.id||'';
const outline=element('div','outline-panel');outline.id='outline-panel';outline.append(element('small','eyebrow','PAGE OUTLINE'),element('h2','','페이지 구성'),element('p','muted','섹션을 선택하고 기획을 다듬으세요.'));const outlineList=element('div');outlineList.id='outline-list';outline.append(outlineList);const addOutline=button('+ 섹션 추가',openAddDialog);addOutline.className='primary full';outline.append(addOutline,element('p','hint','순서 변경: 드래그 또는 순서 버튼에서 Alt + ↑ / ↓'));$('#input-panel').prepend(outline);
const addType=$('#new-section-type');for(const [type,name]of sectionTypes)addType.append(new Option(name,type));
renderPlan=renderPlanCards;
moveSection=(id,dir)=>{
 const order=designSections().map(s=>s.id),from=order.indexOf(id),to=from+dir;
 if(from<0||to<0||to>=order.length)return;
 checkpoint();[order[from],order[to]]=[order[to],order[from]];
 state.designOrder=order;selected=id;changed({editor:true});jumpToSection(id);
};
const originalPick=pick;pick=id=>{originalPick(id);if(step===2)selectCard(id);};
const originalSetStep=setStep;setStep=n=>{originalSetStep(n);document.body.classList.toggle('plan-mode',n===2);$$('[data-panel]').forEach(b=>{b.textContent=b.dataset.panel==='input-panel'?(n===2?'페이지 구성':'상품 정보'):b.dataset.panel==='preview-panel'?(n===2?'기획 카드':'미리보기'):'디자인 편집';});if(n===2){showPanel('preview-panel');renderOutline();refreshPlanningMeta();}};
$('#add-section').onclick=openAddDialog;$('#outline-apply').onclick=()=>openApplyDialog([selected]);$('#generate').onclick=()=>openApplyDialog(state.sections.map(s=>s.id));$('#apply-confirm').onclick=commitPlan;$('#new-section-confirm').onclick=addTypedSection;
$$('[data-close-dialog]').forEach(b=>b.onclick=()=>document.getElementById(b.dataset.closeDialog).close());

function externalTextPrompt(){
 const p=state.product;
 const labels=Object.fromEntries(productFields().flatMap(([,items])=>items.map(([key,label])=>[key,label])));
 const facts=Object.entries(p).filter(([,v])=>String(v??'').trim()&&v!=='미확인').map(([key,value])=>`${labels[key]||key}: ${value}`).join('\n');
 return `당신은 온라인 쇼핑몰 상세페이지 기획자입니다. 아래 상품 정보만 사용해 한국어 상세페이지 문구를 작성해 주세요.\n\n[상품 정보]\n${facts}\n\n[작성 원칙]\n- 입력하지 않은 성능·인증·원산지·사용 이력·테스트 결과·보증·배송 조건은 만들어내지 마세요.\n- 실제로 제공하지 않은 고객 후기와 비교 수치를 만들지 마세요.\n- 가격과 판매 구성은 입력값을 따르고, 정보가 충돌하면 확인할 질문으로 분리하세요.\n- 과장 없이 읽기 쉬운 짧은 문장으로 작성하세요.\n- 호환성이나 식품의 보관·조리 조건은 확인된 정보만 사용하세요.\n\n[필요한 구성]\n${state.sections.map((s,i)=>`${i+1}. ${sectionName(s)}`).join('\n')}\n\n[출력 형식]\n각 섹션마다 아래 형식으로 구분해 주세요.\n섹션 종류:\n제목: (짧은 헤드라인)\n본문: (YesDetail 기획 카드에 그대로 붙여넣을 완성 문구)\n이미지 프롬프트: (외부 이미지 생성 AI에 입력할 장면·구도·배경 설명)\n\n상품 정보가 부족한 부분은 추측 대신 '판매자 확인 필요'로 표시하세요. 마지막에 추가 확인할 정보만 목록으로 정리해 주세요.`;
}
function externalImagePrompt(){
 const s=state.sections.find(x=>x.id===selected),name=state.product.name||'상품';
 return `첨부한 실제 상품 사진을 기준으로 온라인 쇼핑몰 상세페이지용 이미지를 만들어 주세요.\n\n상품: ${name}\n사용할 섹션: ${s?sectionName(s):'상품 소개'}\n장면과 구도: ${s?.plan?.prompt||'상품 전체가 잘 보이는 정면 중심 구도. 제품을 크게 배치하고 깨끗한 흰색 배경과 자연스러운 조명을 사용해 주세요.'}\n배치 참고: ${s?.plan?.layout||'제품을 자르지 말고 전체 형태가 보이게 해 주세요.'}\n\n제품의 형태·색상·구성품·라벨·로고는 원본과 일치하도록 유지하세요. 없는 구성품이나 인증 마크를 추가하지 마세요. 문구와 가격은 이미지에 넣지 마세요. 참고 사진만으로 실제 제품을 정확하게 재현하기 어렵다면 그 한계를 알려 주세요.\n식품이라면 실제 구성과 양을 과장하지 마세요.\n\n완성 이미지는 제가 다운로드한 뒤 YesDetail의 해당 기획 카드에서 '제품 사진 업로드'로 가져올 예정입니다.`;
}
function refreshExternalPrompt(){const box=$('#external-prompt-text');if(box)box.value=$('#external-prompt-kind').value==='image'?externalImagePrompt():externalTextPrompt();}
$('#external-prompt-kind').onchange=refreshExternalPrompt;
$('#refresh-external-prompt').onclick=refreshExternalPrompt;
$('#copy-external-prompt').onclick=async()=>{refreshExternalPrompt();try{await navigator.clipboard.writeText($('#external-prompt-text').value);notify('프롬프트를 복사했습니다. 외부 AI에 붙여넣으세요.');}catch{$('#external-prompt-text').focus();$('#external-prompt-text').select();notify('프롬프트를 선택했습니다. Ctrl+C로 복사하세요.');}};
$('#external-ai-guide').addEventListener('toggle',()=>{if($('#external-ai-guide').open)refreshExternalPrompt();});
const setStepBeforePrompt=setStep;setStep=n=>{setStepBeforePrompt(n);if(n===2)refreshExternalPrompt();};
const pickBeforePrompt=pick;pick=id=>{pickBeforePrompt(id);refreshExternalPrompt();};
refreshExternalPrompt();

let outputDirectory=null;
async function chooseOutputFolder(){
 if(!window.showDirectoryPicker){notify('이 브라우저에서는 폴더 선택을 지원하지 않습니다. 다운로드 후 원하는 폴더로 저장해 주세요.');return;}
 try{outputDirectory=await window.showDirectoryPicker({mode:'readwrite'});$('#folder-label').textContent='저장 폴더: '+outputDirectory.name;notify('선택한 폴더에 결과 파일을 저장합니다.');}catch(e){if(e.name!=='AbortError')notify('폴더를 선택하지 못했습니다. 기본 다운로드를 사용합니다.');}
}
async function saveLocalFile(blob,name){
 if(!outputDirectory){downloadFallback(blob,name);return;}
 try{let target=name;try{await outputDirectory.getFileHandle(target);const dot=name.lastIndexOf('.'),stamp=new Date().toISOString().replace(/[:.]/g,'-');target=dot<0?`${name}-${stamp}`:`${name.slice(0,dot)}-${stamp}${name.slice(dot)}`;}catch(e){if(e.name!=='NotFoundError')throw e;}
 const file=await outputDirectory.getFileHandle(target,{create:true}),writer=await file.createWritable();await writer.write(blob);await writer.close();notify('선택한 폴더에 저장했습니다: '+target);
 }catch(e){notify('폴더 저장에 실패해 기본 다운로드로 저장합니다.');downloadFallback(blob,name);}
}
function importBodyText(id){const s=state.sections.find(x=>x.id===id);if(!s)return;const input=document.createElement('input');input.type='file';input.accept='.txt,text/plain';input.hidden=true;document.body.append(input);input.oncancel=()=>input.remove();input.onchange=async()=>{const file=input.files[0];input.remove();if(!file)return;if(file.size>1000000)return notify('TXT 파일은 1MB 이하로 가져오세요.');const text=(await file.text()).replace(/^\uFEFF/,'').slice(0,15000);$('#txt-import-title').textContent=s.plan.title;$('#txt-import-before').textContent=s.plan.body;$('#txt-import-after').value=text;$('#txt-import-dialog').dataset.id=id;$('#txt-import-dialog').showModal();};input.click();}
$('#choose-output-folder').onclick=chooseOutputFolder;
$('#save-prompt-file').onclick=async()=>{refreshExternalPrompt();await saveLocalFile(new Blob(['\ufeff'+$('#external-prompt-text').value],{type:'text/plain;charset=utf-8'}),'YesDetail-외부AI-프롬프트.txt');};
$('#txt-import-confirm').onclick=()=>{const s=state.sections.find(x=>x.id===$('#txt-import-dialog').dataset.id);if(!s)return;checkpoint();s.plan.body=$('#txt-import-after').value;s.plan.edited=true;$('#txt-import-dialog').close();changed();notify('TXT 문구를 기획 본문으로 가져왔습니다. 디자인은 반영 전까지 유지됩니다.');};
$('#txt-import-cancel').onclick=()=>$('#txt-import-dialog').close();

syncTemplates();renderForm();$('#accent').value=state.style.accent;$('#font-size').value=state.style.fontSize;$('#font-value').textContent=state.style.fontSize+'px';changed({editor:true});

// Palette choices change design colors only; product facts and drafts remain intact.
function applyColorMood(name,accent,soft,light,dark){
 checkpoint();
 state.style.accent=accent;
 state.style.mood={soft,light,dark};
 for(const section of state.sections){
  const standard=!section.presentation||section.presentation==='standard';
  section.background=standard&&['hero','faq'].includes(section.type)?dark:light;
  section.color=null;
 }
 $('#accent').value=accent;
 changed({editor:true});
 notify(name+' 색상을 전체 섹션에 적용했습니다.');
}
function installMoodPanel(){
 const anchor=$('#accent').closest('label')||$('#accent').parentElement;
 const panel=document.createElement('details');panel.open=true;panel.style.cssText='margin:16px 0;padding:12px;border:1px solid #dce4ee;border-radius:12px';
 const summary=document.createElement('summary');summary.textContent='색상 무드 · 전체 디자인';panel.append(summary);
 panel.className='mood-panel';const note=document.createElement('p');note.textContent='선택하면 모든 섹션의 배경·글자·강조색이 바뀝니다. 사진과 문구는 유지됩니다.';note.style.cssText='font-size:12px;color:#68778b';panel.append(note);
 const tones=[['웜 아이보리','#7e292f','#b8a58a','#f4f1eb','#20201e'],['포레스트','#35975d','#6ac88a','#e9f1ea','#191e1b'],['모카 브라운','#775b43','#c7ac8e','#f1ece5','#241d18'],['오션 블루','#28718a','#84b5c5','#edf4f7','#132830'],['로즈 핑크','#bd747b','#e3adb2','#fbf0f1','#302024'],['미드나잇 네이비','#354763','#8799b4','#eff2f7','#151e2d'],['모노 그레이','#484848','#a5a5a5','#f1f1f1','#191919']];
 for(const [name,accent,soft,light,dark] of tones){const b=button(name,()=>{applyColorMood(name,accent,soft,light,dark);});b.className='mood-swatch';b.style.cssText='--tone:'+accent+';--soft:'+soft+';--paper:'+light+';--dark:'+dark;b.setAttribute('aria-label',name+' 색상 무드 적용');const swatch=document.createElement('span');swatch.className='mood-strip';b.prepend(swatch);panel.append(b);}
 anchor.after(panel);
}
installMoodPanel();

function addLayoutControls(box,s){
 const l=document.createElement('label');l.textContent='사진·문구 배치';const select=document.createElement('select');for(const [v,t]of [['standard','기본 정보형'],['editorial','큰 제목 → 본문 → 큰 사진'],['photoFirst','큰 사진 → 제목 → 본문'],['imageOnly','완성 이미지 전용 · 원본 비율'],['split','사진 2열 · 비교 갤러리'],['points','번호형 특징 카드'],['steps','단계별 사용·조리 카드'],['foodHero','에디토리얼 · 대표'],['foodBundle','에디토리얼 · 판매 구성'],['foodTexture','에디토리얼 · 식감'],['foodSpecs','에디토리얼 · 정보 표'],['foodGuide','에디토리얼 · 보관 안내'],['foodShipping','에디토리얼 · 배송'],['foodFeatures','에디토리얼 · 특징 카드']]){const o=document.createElement('option');o.value=v;o.textContent=t;select.append(o);}select.value=s.presentation||'standard';select.onchange=()=>{checkpoint();s.presentation=select.value;changed({editor:true});};l.append(select);box.append(l);
 for(const [key,label,min,max,value]of [['imageHeight','사진 영역 높이',240,1100,520],['titleSize','큰 제목 크기',30,80,54]]){const l=document.createElement('label');l.textContent=label;const input=document.createElement('input');input.type='range';input.min=min;input.max=max;input.value=s[key]||value;input.onchange=()=>{checkpoint();s[key]=+input.value;changed();};l.append(input);box.append(l);}
 for(const id of s.photoIds||[]){const item=state.photos.find(p=>p.id===id);if(!item)continue;box.append(button('사진 표시 방식 · '+item.name,()=>reviewPhotoSizing(s,id)));}
 extraImageControls(box,s);const note=document.createElement('p');note.textContent='사진 지정·교체는 02 기획 검토에서 합니다. 완성 이미지 전용은 외부 AI에서 만든 문구 포함 이미지를 그대로 배치합니다.';box.append(note);
}

const freshButton=button('새 상품 시작 · 현재 프로젝트 백업',()=>{const dialog=document.createElement('dialog');const title=document.createElement('h3');title.textContent='새 상품의 종류를 선택하세요';const select=document.createElement('select');select.setAttribute('aria-label','새 상품 종류');for(const name of categories){const o=document.createElement('option');o.textContent=name;select.append(o);}const start=button('백업 후 새 상품 시작',async()=>{try{const raw=JSON.stringify(state);await projectStore.set(KEY+'-backup-'+Date.now()+'-'+uid(),raw);await projectStore.set(KEY+'-previous-product',raw);}catch{notify('백업 공간이 부족합니다. 프로젝트 파일로 먼저 저장해 주세요.');return;}checkpoint();storageReadFailed=false;const product=Object.fromEntries(Object.keys(defaults).map(k=>[k,'']));product.category=select.value;product.quantity='1';state={version:2,product,photos:[],sections:[],designOrder:[],style:{accent:'#35975d',fontSize:28,mood:{soft:'#6ac88a',light:'#e9f1ea',dark:'#191e1b'}}};state.sections=makeSections(product).filter(s=>!['식품','일반 상품'].includes(product.category)||!['condition','test'].includes(s.type));state=validate(state);configureStudioPreset(product.category==='식품'?'food':product.category==='일반 상품'?'general':'tech');selected=state.sections[0]?.id||'';dialog.close();dialog.remove();changed({editor:true,form:true});notify('새 상품을 시작했습니다. 실행 취소로 이전 상품을 복원할 수 있습니다.');});dialog.append(title,select,start,button('취소',()=>{dialog.close();dialog.remove();}));document.body.append(dialog);dialog.showModal();});$('#product-form').before(freshButton);

function extraImageControls(box,s){
 const choice=(label,key,options,value)=>{const l=element('label','',label),input=element('select');for(const [v,t]of options)input.append(new Option(t,v));input.value=s[key]||value;input.onchange=()=>{checkpoint();s[key]=input.value;changed();};l.append(input);box.append(l);};
 choice('문구 정렬','align',[['left','왼쪽'],['center','가운데'],['right','오른쪽']],'left');
 choice('사진 맞춤','imageFit',[['contain','전체 보기 · 잘림 없음'],['cover','영역 채우기 · 일부 잘림']],'contain');
 for(const [key,label]of [['focusX','자르기 중심 · 가로'],['focusY','자르기 중심 · 세로']]){const l=element('label','',label),input=element('input');input.type='range';input.min=0;input.max=100;input.value=s[key]??50;input.onchange=()=>{checkpoint();s[key]=+input.value;changed();};l.append(input);box.append(l);}
 box.append(element('p','hint','영역 채우기는 미리보기와 PNG에서 같은 부분을 자릅니다. 완성 이미지 전용은 자르지 않고 원본 비율을 유지합니다.'));
}
function jumpToSection(id){const b=bounds.find(x=>x.id===id),scroll=$('#preview-scroll');if(b&&step!==2)scroll.scrollTo({top:b.y*$('#preview').getBoundingClientRect().width/860,behavior:'smooth'});}
function updatePageThumbnails(){const source=$('#preview');if(!source.width||!source.height)return;for(const row of $$('#section-list [data-section]')){const b=bounds.find(x=>x.id===row.dataset.section),img=row.querySelector('.page-thumb');if(!b||!img)continue;const c=document.createElement('canvas');c.width=60;c.height=76;const ctx=c.getContext('2d');ctx.fillStyle='#f4f1eb';ctx.fillRect(0,0,60,76);const sh=Math.min(b.height,1089);ctx.drawImage(source,0,b.y,860,sh,0,0,60,sh*60/860);img.src=c.toDataURL();img.hidden=false;}}
function previewMedia(p){const d=element('dialog','media-preview'),img=element('img');img.src=p.src;img.alt=p.name;d.append(element('h3','',p.name),img,element('p','hint','원본 비율 미리보기 · '+(p.width||'?')+' × '+(p.height||'?')+'px'),button('닫기',()=>{d.close();d.remove();}));document.body.append(d);d.showModal();}
function recommendedOutline(){const cat=state.product.category||'메모리';return cat==='식품'?[['hero','상품의 첫인상'],['custom','이런 식사에 어울립니다'],['benefits','이 상품의 특징'],['photos','사진으로 보는 상품'],['options','판매 구성 안내'],['usage','맛있게 준비하는 방법'],['custom','함께 즐기는 방법'],['compat','보관·섭취 전 확인'],['faq','주문 전 궁금한 점'],['shipping','배송과 판매 조건'],['specs','식품 상세 정보']]:cat==='메모리'?[['hero','상품 소개'],['options','선택 규격과 판매 구성'],['specs','제품 주요 사양'],['photos','라벨과 외관 확인'],['test','테스트 확인 내역'],['compat','구매 전 호환 확인'],['shipping','구성품과 판매 조건']]:[['hero','상품 소개'],['benefits','상품의 특징'],['photos','디테일 갤러리'],['options','판매 구성'],['usage','사용 안내'],['compat','구매 전 확인'],['faq','자주 묻는 질문'],['shipping','배송과 판매 조건'],['specs','제품 상세 정보']];}
function openOutlineBuilder(){const d=element('dialog','outline-builder');d.append(element('h2','','상품에 맞는 구성 추가'),element('p','hint','선택한 섹션을 기획에 추가합니다. 기존 문구와 디자인은 유지됩니다. 사진과 문구를 확인한 후 디자인에 반영하세요.'));const checks=[];for(const [type,title]of recommendedOutline()){const label=element('label','outline-check'),check=element('input');check.type='checkbox';check.checked=!state.sections.some(s=>s.type===type&&s.plan.title===title);label.append(check,document.createTextNode(title));d.append(label);checks.push({check,type,title});}d.append(button('선택한 구성 추가',()=>{const chosen=checks.filter(x=>x.check.checked);if(state.sections.length+chosen.length>50)return notify('섹션은 50개까지 지원합니다.');checkpoint();for(const {type,title}of chosen){const text=contentProvider.generateSection(type,state.product),s={id:uid(),type,title,body:text.body,visible:false,custom:false,fontSize:null,color:null,background:'#f8f6f1',presentation:type==='benefits'?'points':type==='usage'?'steps':type==='photos'?'photoFirst':'editorial',photoIds:[],plan:{title,body:text.body,visible:true,photoIds:[],referenceIds:[],layout:'',prompt:'',edited:true,collapsed:false}};state.sections.push(s);state.designOrder.push(s.id);}d.close();d.remove();changed({editor:true});setStep(2);notify(chosen.length+'개 섹션을 기획에 추가했습니다.');}),button('취소',()=>{d.close();d.remove();}));document.body.append(d);d.showModal();}
const outlineBuilderButton=button('상품별 추천 구성',openOutlineBuilder);outlineBuilderButton.className='full';$('#outline-panel').append(outlineBuilderButton);
const attachRule='첨부한 실제 상품 사진을 제품의 형태·포장·라벨·구성의 기준으로 삼고, 함께 첨부한 상세페이지 화면은 색상·레이아웃·사진 분위기만 참고해 주세요. 두 자료의 역할을 구분하고, 다른 상품이나 확인되지 않은 구성품을 추가하지 마세요. 상품 사진과 설명이 충돌하거나 자료가 부족하면 먼저 확인할 내용을 질문해 주세요.';
function attachedAssetList(s){const ids=s?[...(s.plan.photoIds||[]),...(s.plan.referenceIds||[])]:state.photos.map(p=>p.id);return [...new Set(ids)].map(id=>state.photos.find(p=>p.id===id)).filter(Boolean).map(p=>`- ${p.name}: ${{product:'실제 상품 기준',ai:'AI 연출 참고 · 사실 증거 아님',info:'상품정보 참고 · 내용 확인 필요',reference:'디자인 분위기 참고',test:'테스트 증빙'}[p.kind]}`).join('\n')||'등록한 이미지 없음 · 실제 상품 사진을 먼저 첨부하세요.';}
const previousTextPrompt=externalTextPrompt;
externalTextPrompt=()=>previousTextPrompt()+`\n\n[첨부 자료의 역할]\n${attachedAssetList()}\n${attachRule}\n\n[디자인 방향]\n까르띠에 공식 사이트에서 느껴지는 절제된 럭셔리 에디토리얼 분위기. 따뜻한 아이보리, 차콜, 소량의 버건디, 섬세한 샴페인 톤. 넓은 여백, 차분한 글자 위계, 사진의 소재감과 부드러운 빛을 중심으로 구성. 로고·사진·고유 문양은 복제하지 마세요. 식품의 먹음직스러운 실제 색은 유지하세요.\n\n[상품별 추천 흐름]\n${recommendedOutline().map(([,title],i)=>`${i+1}. ${title}`).join('\n')}\n\n각 섹션에 권장 배치(사진 먼저/문구 먼저/2열/특징 카드/조리 단계), 필요한 사진 파일명, 권장 비율을 함께 제안하세요. 30년 전통, 급냉 온도, 손질 공정 등 확인되지 않은 사실은 작성하지 마세요. 실제 고객 후기가 없으면 후기 섹션은 제외하세요.`;
externalImagePrompt=()=>{const s=state.sections.find(x=>x.id===selected),finished=$('#external-prompt-kind').value==='finished',index=state.sections.findIndex(x=>x.id===selected)+1;return `[작업]\n${finished?'문구가 포함된 완성형 상세페이지 섹션 이미지 한 장':'상세페이지에 넣을 고해상도 상품 연출 사진 한 장'}을 만들어 주세요.\n상품명: ${state.product.name||'판매자 입력 필요'}\n섹션: ${s?.plan.title||'상품 소개'}\n\n[상품정보]\n${productFields().flatMap(([,items])=>items).map(([k,label])=>state.product[k]?label+': '+state.product[k]:'').filter(Boolean).join('\n')}\n\n[함께 첨부할 파일]\n${attachedAssetList(s)}\n위 목록은 파일 이름 안내입니다. 이 프롬프트와 함께 실제 파일을 직접 첨부합니다. 파일이 없으면 이미지를 봤다고 가정하지 마세요.\n${attachRule}\n\n[아트 디렉션]\n까르띠에처럼 절제된 고급 에디토리얼: 따뜻한 아이보리 배경, 차콜 글자, 소량의 버건디 포인트와 샴페인 색감. 은은한 석재·리넨 소재, 부드러운 창가 조명, 섬세한 그림자와 자연스러운 질감. 번쩍이는 금색·과도한 장식·불필요한 뱃지는 피하세요. 실제 식품·제품의 색과 구조를 보존하세요. 브랜드 로고나 타사 이미지를 복제하지 마세요.\n\n[장면과 구도]\n${s?.plan.prompt||'주인공 상품을 크게 보여주는 단정한 구도. 선명한 디테일과 자연스러운 깊이감.'}\n배치 요청: ${s?.plan.layout||'피사체를 자르지 않고 여백을 충분히 확보'}\n${finished?'세로 비율 4:5를 기본으로, 제목·본문·사진의 위계를 설계하세요. 아래 문구만 정확하게 사용하세요.':'가로 4:3 비율, 긴 변 1600px 이상을 권장합니다. 문구를 올릴 여백 25%를 확보하되 이미지에는 글자를 넣지 마세요.'}\n${finished?'제목: '+(s?.plan.title||'')+'\n본문: '+(s?.plan.body||''):''}\n\n[금지사항]\n확인되지 않은 구성품·원산지·인증·제조공정·급냉온도·후기·효능을 만들지 마세요. 조리 예시의 추가 재료를 판매 구성품처럼 표현하지 마세요. 워터마크와 가짜 라벨을 추가하지 마세요.\n\n[전달]\n파일명: ${String(index).padStart(2,'0')}-${finished?'finished-section':'product-scene'}.png\n한 번에 한 장씩 제작하고, 다음 섹션도 같은 색감과 조명을 유지하세요. ${finished?'완성 후 한글 오탈자를 검수하세요. 예스디테일의 완성 이미지 전용 배치로 가져옵니다.':'예스디테일에서 제목과 본문을 별도로 편집할 예정입니다.'}`;};
$('#external-prompt-kind').append(new Option('완성 섹션 이미지 생성 프롬프트','finished'));
refreshExternalPrompt=()=>{$('#external-prompt-text').value=$('#external-prompt-kind').value==='text'?externalTextPrompt():externalImagePrompt();};
$('#external-prompt-kind').onchange=refreshExternalPrompt;$('#refresh-external-prompt').onclick=refreshExternalPrompt;
$('#external-ai-guide').append(button('전체 섹션 프롬프트 TXT 저장',async()=>{const previous=selected;let text=externalTextPrompt();for(const s of state.sections){selected=s.id;text+='\n\n================================\n'+externalImagePrompt();}selected=previous;refreshExternalPrompt();await saveLocalFile(new Blob(['\ufeff'+text],{type:'text/plain;charset=utf-8'}),'YesDetail-전체섹션-프롬프트.txt');}));
refreshExternalPrompt();
const focusButton=button('넓게 보기',()=>{document.body.classList.toggle('canvas-focus');focusButton.textContent=document.body.classList.contains('canvas-focus')?'패널 다시 열기':'넓게 보기';applyZoom();});$('#split').before(focusButton);
// Save synchronously when leaving so the 300ms debounce cannot lose the last edit.
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&savedRevision<saveRevision)void flushSave();});
window.addEventListener('pagehide',()=>{if(savedRevision<saveRevision)void flushSave();});
const foodMood=button('가스트로노미 · 버건디',()=>{applyColorMood('가스트로노미 · 버건디','#812b36','#d6bda2','#fffaf3','#26211e');});foodMood.className='mood-swatch';foodMood.style.cssText='--tone:#812b36;--soft:#d6bda2;--paper:#fffaf3;--dark:#26211e';const foodStrip=element('span','mood-strip');foodMood.prepend(foodStrip);$('.mood-panel').append(foodMood);

function safeProductName(){return (state.product.name||"YesDetail").replace(/[\\/:*?"<>|]/g,"-").slice(0,70);}

const oldImagePromptRealism=externalImagePrompt;externalImagePrompt=()=>oldImagePromptRealism()+(state.product.category==='식품'?'\n[식품 사진 현실감]\n실제 원물의 불규칙한 굵기와 표면 결을 유지하세요. 꼼장어라면 떡볶이·오징어로 변형하지 마세요. 45도 가까운 구도, 부드러운 측면 자연광, 얇고 자연스러운 소스 윤기, 약한 김과 현실적인 그림자를 사용하세요. 과도한 불꽃, 플라스틱 광택, 지나치게 균일한 모양은 피하세요. 대표컷 한 장을 먼저 완성하고 다음 컷의 색감 기준으로 함께 첨부하세요.':'');

const imagePromptBeforeQuality=externalImagePrompt;
externalImagePrompt=()=>imagePromptBeforeQuality()+`\n\n[제작 순서와 검수]\n지금은 선택한 섹션 한 장만 제작하세요. 여러 장을 한 장의 콜라주로 합치지 마세요. 실제 상품 사진을 우선 기준으로 삼고, 참고 화면의 사진 면적·시선 흐름·빛의 방향을 분석해 적용하세요.\n대표컷이 승인되면 그 이미지를 다음 요청에 함께 첨부하여 조명, 화이트밸런스, 식기와 배경을 일관되게 유지합니다. 상품 형태가 달라지면 장식을 더하지 말고 원본 형태부터 바로잡으세요. 포장·라벨을 정확하게 재현하기 어렵다면 임의로 다시 그리지 말고 원본 사진을 사용할 영역으로 남겨 주세요.\n검수 기준: 상품 동일성, 실제 구성과 양, 자연스러운 표면 질감, 물리적으로 타당한 그림자, 과도하지 않은 선명도, 문구용 여백. 부족한 부분을 수정한 뒤 한 장을 전달해 주세요. 해상도는 사용 가능한 생성 크기로 제공하고 단순 확대를 고해상도 원본이라고 표현하지 마세요.`;
refreshExternalPrompt();


// Explicit opt-in: opening legacy projects never applies the new layouts.
function applyFoodEditorial(){
 checkpoint();state.style.accent='#7e292f';state.style.mood={soft:'#b8a58a',light:'#f4f1eb',dark:'#23211e'};
 const layouts={hero:'foodHero',options:'foodBundle',photos:'foodTexture',specs:'foodSpecs',compat:'foodGuide',shipping:'foodShipping',benefits:'foodFeatures'};
 for(const section of state.sections){if(!layouts[section.type])continue;section.presentation=layouts[section.type];section.background=section.type==='photos'?'#23211e':'#f4f1eb';section.color=null;section.fontSize=28;section.align='left';section.titleSize=section.type==='hero'?80:['specs','compat','shipping'].includes(section.type)?52:72;section.imageHeight=section.type==='hero'||section.type==='photos'?645:549;section.imageFit='contain';}
 $('#accent').value=state.style.accent;changed({editor:true});setStep(3);notify('식품 에디토리얼을 적용했습니다. 실행 취소로 이전 디자인을 복원할 수 있습니다.');
}

function configureStudioPreset(kind){
 const palette=kind==='tech'?['#27865b','#91b9a5','#edf3f0','#17231e']:kind==='general'?['#36536d','#9fb4c5','#f2f4f6','#1e2933']:['#7e292f','#b8a58a','#f4f1eb','#23211e'];
 state.style.accent=palette[0];state.style.mood={soft:palette[1],light:palette[2],dark:palette[3]};$('#accent').value=state.style.accent;
 const layouts={hero:'foodHero',options:'foodBundle',photos:'foodTexture',specs:'foodSpecs',compat:'foodGuide',shipping:'foodShipping',benefits:'foodFeatures',usage:'foodGuide',faq:'foodGuide',custom:'foodFeatures',condition:'foodGuide',test:'foodSpecs'};
 const studio={hero:'studioHero',options:'studioOptions',photos:'studioDetail',specs:'studioSpecs',faq:'studioFaq',benefits:'studioFeatures',custom:'studioFeatures',usage:'studioGuide',compat:'studioGuide',condition:'studioGuide',test:'studioSpecs',shipping:'studioGuide'};
 for(const s of state.sections){s.presentation=kind==='food'?(layouts[s.type]||'foodFeatures'):(studio[s.type]||'studioFeatures');s.background=(kind==='food'?s.type==='photos':['photos','compat'].includes(s.type))?palette[3]:palette[2];s.color=null;s.titleSize=s.type==='hero'?80:['specs','compat','shipping'].includes(s.type)?52:68;s.fontSize=28;s.imageHeight=kind==='food'?645:480;s.imageFit='contain';}

}

function applyStudioPreset(kind){checkpoint();configureStudioPreset(kind);$('#accent').value=state.style.accent;changed({editor:true});setStep(3);notify('전체 스튜디오 디자인을 적용했습니다. 실행 취소로 복원할 수 있습니다.');}

function renderSyncStatus(){let box=document.getElementById('source-sync-status');if(!box){box=element('section','source-sync-status');box.id='source-sync-status';$('#product-form').after(box);}box.replaceChildren();const source=state.sections.filter(s=>s.plan?.sourcePending),draft=state.sections.filter(draftChanged);box.append(element('strong','','상품 정보 → 기획 초안 → 확정 디자인'));box.append(element('p','',source.length?'기본 정보 변경 · 직접 작성 기획 '+source.length+'개 검토 필요 / 기획 '+draft.length+'개 디자인 반영 대기':draft.length?'기획 변경 '+draft.length+'개가 디자인 반영 대기 중입니다.':'현재 기획과 디자인이 일치합니다.'));box.append(element('small','','기본 정보 수정은 확정 디자인을 덮어쓰지 않습니다.'));if(source.length)box.append(button('상품 정보 변경 검토',()=>reviewSourceChanges(source.map(s=>s.id))));if(draft.length)box.append(button('디자인 반영 검토',()=>openApplyDialog(draft.map(s=>s.id))));}
function reviewSourceChanges(ids){const dialog=element('dialog','source-review'),checks=[];dialog.append(element('h2','','상품 정보로 기획 갱신 검토'),element('p','','선택한 기획 초안만 갱신합니다. 직접 쓴 초안은 기본 선택하지 않습니다. 확정 디자인과 사진은 유지됩니다.'));for(const id of ids){const s=state.sections.find(v=>v.id===id);if(!s)continue;const next=contentProvider.generateSection(s.type,state.product),row=element('section','source-review-row'),label=element('label'),check=element('input');check.type='checkbox';check.checked=!s.plan.edited;check.setAttribute('aria-label',s.plan.title+' 기획 갱신');label.append(check,document.createTextNode(s.plan.title));row.append(label);const columns=element('div','diff-columns');for(const [title,data]of [['현재 기획',s.plan],['기본 정보로 만든 새 기획',next]]){const col=element('div');col.append(element('h4','',title),element('strong','',data.title),element('pre','',data.body));columns.append(col);}row.append(columns);dialog.append(row);checks.push({s,next,check});}dialog.append(button('선택한 기획만 갱신',()=>{const chosen=checks.filter(x=>x.check.checked);if(!chosen.length)return notify('갱신할 기획을 선택해 주세요.');checkpoint();for(const {s,next}of chosen){Object.assign(s.plan,next);s.plan.edited=false;s.plan.sourcePending=false;}dialog.close();dialog.remove();changed({editor:true});notify('기획을 갱신했습니다. 디자인 반영 검토에서 확정하세요.');}),button('취소',()=>{dialog.close();dialog.remove();}));document.body.append(dialog);dialog.showModal();}
renderSyncStatus();

const imagePromptBeforeBrief=externalImagePrompt;
externalImagePrompt=()=>{const s=state.sections.find(v=>v.id===selected),b=prepareImageBrief({product:state.product,section:s||{},photos:state.photos});return imagePromptBeforeBrief()+'\n\n[이번 컷의 목적] '+b.role+'\n실제 상품 참고 사진: '+(b.references.map(v=>v.name).join(', ')||'미지정 · 정확한 상품 사진을 먼저 첨부하세요.')+'\n사용 장면의 인물·배경은 연출이며 실제 고객 후기의 증거로 사용하지 마세요.';};
$('#external-ai-guide').append(button('선택 섹션 이미지 제작 요청 JSON 저장',async()=>{const section=state.sections.find(v=>v.id===selected);const brief=prepareImageBrief({product:state.product,section:section||{},photos:state.photos});await saveLocalFile(new Blob([JSON.stringify(brief,null,2)],{type:'application/json'}),'YesDetail-이미지-제작요청.json');}));refreshExternalPrompt();

// Explicit entry intent: create a new product, or resume the saved workspace.
const entryParams=new URLSearchParams(location.search);
const previousButton=button('이전 작업 복원',async()=>{
 try{const raw=await projectStore.get(KEY+'-previous-product');if(!raw){notify('복원할 이전 작업이 없습니다.');return;}const restored=validate(JSON.parse(raw));checkpoint();state=restored;storageReadFailed=false;selected=state.sections[0]?.id||'';$('#accent').value=state.style.accent;$('#font-size').value=state.style.fontSize;changed({editor:true,form:true});setStep(1);notify('이전 작업을 복원했습니다.');}catch{notify('이전 작업을 읽지 못했습니다. 프로젝트 파일을 불러와 주세요.');}
});freshButton.after(previousButton);
if(entryParams.get('new')==='1'){
 if(storageReadFailed){notify('기존 저장 내용을 확인할 수 없어 새 작업을 시작하지 않았습니다. 프로젝트 파일을 먼저 보관해 주세요.');}
 else try{const next=await beginNewWorkspace({store:projectStore,key:KEY,current:state,id:Date.now()+'-'+uid(),create:()=>validate(emptyWorkspace(defaults,makeSections))});checkpoint();state=next;selected=state.sections[0]?.id||'';configureStudioPreset('general');$('#font-size').value=state.style.fontSize;$('#font-value').textContent=state.style.fontSize+'px';changed({editor:true,form:true});setStep(1);showPanel('input-panel');refreshExternalPrompt();notify('새 작업을 시작했습니다. 기존 작업은 이전 작업 복원으로 열 수 있습니다.');}catch{notify('이전 작업 백업에 실패하여 새 작업을 시작하지 않았습니다. 프로젝트 파일로 먼저 저장해 주세요.');}
 const clean=new URL(location.href);clean.searchParams.delete('new');window.history.replaceState(null,'',clean.pathname+clean.search+clean.hash);
}

mountProjectLibrary({host:$('.header-actions'),store:projectStore,kind:'product',getState:()=>clone(state),loadState:async next=>{const restored=validate(clone(next));checkpoint();state=restored;selected=state.sections[0]?.id||'';storageReadFailed=false;$('#accent').value=state.style.accent;$('#font-size').value=state.style.fontSize;$('#font-value').textContent=state.style.fontSize+'px';changed({editor:true,form:true});setStep(1);refreshExternalPrompt();},status:notify});

// Inspector tabs change only the tools shown, never the project or artwork.
for(const [id,mode] of [['sections-tab','sections'],['properties-tab','properties']]){const tab=document.getElementById(id);if(tab){tab.addEventListener('click',()=>showInspector(mode));tab.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?'sections':e.key==='End'?'properties':mode==='sections'?'properties':'sections';showInspector(next);document.getElementById(next==='sections'?'sections-tab':'properties-tab').focus();}});}}
freshButton.classList.add('new-product-action');previousButton.classList.add('restore-product-action');


// Explicit local capture transfer: the destination reviews before appending a photo.
function makeTransferredCaptureSection(packet){const title=String(packet.name||'받은 캡처').slice(0,150);return {id:uid(),type:'custom',title,body:'',visible:true,custom:true,presentation:'imageOnly',imageFit:'contain',align:'left',background:'#ffffff',photoIds:[packet.id],layout:'',plan:{title,body:'',visible:true,photoIds:[packet.id],referenceIds:[],layout:'',prompt:'',edited:true,collapsed:false,sourcePending:false}};}
function attachTransferredCapture(section,photoId){section.photoIds=[...new Set([...(section.photoIds||[]),photoId])];section.visible=true;if(section.plan){section.plan.photoIds=[...new Set([...(section.plan.photoIds||[]),photoId])];section.plan.visible=true;}return section;}
function photoSizingControl(section,photoId,photo){
 const label=document.createElement('label');label.textContent='캡처 표시 방식';const select=document.createElement('select');select.setAttribute('aria-label','캡처 표시 방식');
 for(const [value,title]of [['auto','폭 맞춤 · 높이 자동 (권장)'],['fixed','기존 사진 영역에 전체 보기']]){const option=document.createElement('option');option.value=value;option.textContent=title;select.append(option)}
 select.value=section?.photoSizing?.[photoId]==='auto'?'auto':'fixed';label.append(select);
 const note=document.createElement('p');note.setAttribute('role','status');const preview=document.createElement('canvas');preview.setAttribute('aria-label','적용 전 섹션 미리보기');preview.style.cssText='display:block;width:100%;height:auto;margin:8px 0';
 const update=()=>{if(select.value==='auto'&&section?.presentation==='split'){note.textContent='사진 2열 배치는 높이 자동을 지원하지 않습니다. 기존 영역에 전체 보기를 선택하거나 섹션 배치를 직접 변경하세요.';return false}
 const draft=section?{...section,photoIds:[...new Set([...(section.photoIds||[]),photoId])],photoSizing:{...section.photoSizing,[photoId]:select.value}}:makeTransferredCaptureSection({id:photoId,name:photo.name});
 const plan=resizeCapturePhotos(createSalesRenderer({getState:()=>({...state,photos:[...state.photos.filter(p=>p.id!==photoId),photo]}),imageFor,sectionTypes,imageAspect:src=>imageAspectCache.get(src)}).measure({...draft,photoSizing:{}},0),draft,[photo]);
 const image=plan.ops.find(op=>op.kind==='image'&&op.src===photo.src);note.textContent=image?'예상 사진 크기 '+Math.round(image.w)+' × '+Math.round(image.h)+'px · 섹션 높이 '+plan.height+'px. 원본 해상도는 변하지 않습니다.':'이 배치에는 사진 표시 영역이 없습니다. 사진을 지원하는 섹션을 선택하세요.';
 if(plan.height>30000){note.textContent+=' 섹션이 너무 깁니다. 캡처를 나눠 넣어 주세요.';return false}const renderer=createSalesRenderer({getState:()=>state,imageFor,sectionTypes});renderer.paint(preview,[plan]).catch(()=>{note.textContent='미리보기를 만들지 못했습니다. 이미지를 확인하세요.'});return !!image;};select.onchange=update;return{label,note,select,update,preview};
}
function reviewPhotoSizing(section,id){const photo=state.photos.find(p=>p.id===id);if(!photo)return;const dialog=document.createElement('dialog');dialog.setAttribute('aria-label','사진 표시 방식');const title=document.createElement('h2');title.textContent='사진 표시 방식';const controls=photoSizingControl(section,id,photo),img=document.createElement('img');img.src=photo.src;img.style.cssText='display:block;max-width:100%;max-height:240px;object-fit:contain;margin:auto';const apply=button('이 방식으로 적용',()=>{if(!controls.update())return;checkpoint();section.photoSizing={...section.photoSizing,[id]:controls.select.value};changed({editor:true});dialog.close()});dialog.append(title,controls.label,controls.note,controls.preview,apply,button('취소',()=>dialog.close()));dialog.style.cssText='width:min(92vw,560px);max-height:90dvh;overflow:auto';dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();controls.update();}
function replaceTransferredPhoto(section,oldId,newId){
 const swap=ids=>(ids||[]).map(id=>id===oldId?newId:id);
 section.photoIds=swap(section.photoIds);if(section.plan)section.plan.photoIds=swap(section.plan.photoIds);
 section.visible=true;if(section.plan)section.plan.visible=true;
 return section;
}
const transferPixelHashes=new Map();
async function transferPixelHash(src){if(transferPixelHashes.has(src))return transferPixelHashes.get(src);const task=(async()=>{const im=await imageFor(src);if(!im||im.width*im.height>24000000)return null;const cv=document.createElement('canvas');cv.width=im.width;cv.height=im.height;const cx=cv.getContext('2d',{willReadFrequently:true});cx.drawImage(im,0,0);const pixels=cx.getImageData(0,0,cv.width,cv.height).data;const digest=await crypto.subtle.digest('SHA-256',pixels);cv.width=cv.height=1;return im.width+'x'+im.height+':'+Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')})();transferPixelHashes.set(src,task);return task;}
async function reviewCaptureTransfer(){
 const key=new URLSearchParams(location.search).get('captureTransfer');if(!key)return;
 if(!/^capture-transfer-[a-zA-Z0-9-]{1,100}$/.test(key)){notify('지원하지 않는 캡처 전송 주소입니다.');return}
 try{const packet=await projectStore.get(key);if(!packet||packet.version!==1||packet.id!==key||!Number.isFinite(packet.createdAt)||Date.now()-packet.createdAt>86400000||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(packet.src)||packet.src.length>40000000)throw Error('전송 데이터가 없거나 만료되었습니다. 캡처 편집기에서 다시 보내세요.');
 const dialog=document.createElement('dialog');dialog.className='capture-receive';dialog.setAttribute('aria-label','받은 캡처 확인');const h=document.createElement('h2');h.textContent='캡처를 상세페이지에 바로 추가할까요?';const description=document.createElement('p');description.textContent='넣을 섹션을 선택하세요. 기존 문구와 사진을 유지하고 캡처를 추가합니다. 새 섹션으로 추가할 수도 있습니다. 캡처 속 글자는 개별 편집되지 않습니다.';const targetLabel=document.createElement('label');targetLabel.textContent='캡처를 넣을 위치';targetLabel.style.cssText='display:block;margin:12px 0;font-weight:700';const destination=document.createElement('select');destination.setAttribute('aria-label','캡처를 넣을 섹션');destination.style.cssText='display:block;width:100%;min-height:44px;margin-top:6px;font-size:16px';const newOption=document.createElement('option');newOption.value='__new__';newOption.textContent='＋ 맨 아래에 새 이미지 섹션';destination.append(newOption);for(const [index,section]of designSections().entries()){const option=document.createElement('option');option.value=section.id;option.textContent=String(index+1).padStart(2,'0')+' · '+(section.title||'제목 없음')+(section.visible?'':' (숨김 → 표시)');destination.append(option)}destination.value=state.sections.some(s=>s.id===selected)?selected:'__new__';targetLabel.append(destination);const img=document.createElement('img');img.src=packet.src;img.alt=packet.name;img.style.cssText='display:block;max-width:100%;max-height:100px;object-fit:contain;margin:8px auto';const message=document.createElement('p');message.setAttribute('role','status');const clean=()=>{const url=new URL(location.href);url.searchParams.delete('captureTransfer');window.history.replaceState(null,'',url.pathname+url.search+url.hash)};
 const incoming=await imageFor(packet.src);if(!incoming)throw Error('캡처를 읽을 수 없습니다.');packet.width=incoming.width;packet.height=incoming.height;
 const snapshot=JSON.stringify(state),matches=[];const hash=await transferPixelHash(packet.src);for(const photo of state.photos){if(photo.src===packet.src||(hash&&await transferPixelHash(photo.src)===hash))matches.push(photo)}
 const info=document.createElement('p');info.textContent=(packet.captureNumber?packet.captureNumber+'번 캡처 · ':'선택한 캡처 · ')+packet.name+' · '+packet.width+' × '+packet.height+'px · 한 장만 전송됨. 기존 상세페이지 섹션은 유지됩니다.';
 const methodLabel=document.createElement('label');methodLabel.textContent='넣는 방법';const method=document.createElement('select');method.setAttribute('aria-label','넣는 방법');for(const [value,title]of [['append','기존 사진 뒤에 추가'],['replace','선택한 사진 교체'],['new','새 이미지 섹션으로 추가']]){const opt=document.createElement('option');opt.value=value;opt.textContent=title;method.append(opt)}methodLabel.append(method);
 const replacements=document.createElement('fieldset');const legend=document.createElement('legend');legend.textContent='교체할 사진 선택 (원본은 사진 목록에 보존)';replacements.append(legend);let replacementId='';
 const duplicate=document.createElement('fieldset'),duplicateLegend=document.createElement('legend');duplicateLegend.textContent='같은 이미지가 이미 있습니다';duplicate.append(duplicateLegend);const compare=document.createElement('div');compare.style.cssText='display:flex;gap:12px;flex-wrap:wrap';for(const photo of [...matches,{...packet,name:'새 캡처 · '+packet.name}]){const figure=document.createElement('figure'),image=document.createElement('img'),caption=document.createElement('figcaption');figure.style.cssText='margin:0;max-width:140px';image.src=photo.src;image.alt=photo.name;image.style.cssText='width:100px;height:120px;object-fit:contain';caption.textContent=photo.name;figure.append(image,caption);compare.append(figure)}duplicate.append(compare);const acknowledgeLabel=document.createElement('label'),acknowledge=document.createElement('input');acknowledge.type='checkbox';acknowledgeLabel.append(acknowledge,'같은 이미지임을 확인하고 이 작업을 적용합니다');duplicate.append(acknowledgeLabel);duplicate.hidden=!matches.length;
 const sizingPhoto={id:packet.id,name:packet.name,src:packet.src,width:packet.width,height:packet.height};
 const chosenSection=()=>method.value==='new'?null:state.sections.find(s=>s.id===destination.value);
 const previewSection=()=>{const section=chosenSection();return section&&method.value==='replace'?{...section,photoIds:section.photoIds.map(id=>id===replacementId?packet.id:id)}:section};
 let sizing=photoSizingControl(previewSection(),packet.id,sizingPhoto);sizing.select.value='auto';
 const refreshSizing=()=>{const next=photoSizingControl(previewSection(),packet.id,sizingPhoto);next.select.value=sizing.select.value;sizing.label.replaceWith(next.label);sizing.note.replaceWith(next.note);sizing.preview.replaceWith(next.preview);sizing=next;sizing.update()};
 const refreshMethod=()=>{const section=chosenSection(),ids=section?.photoIds||[];replacements.replaceChildren(legend);replacements.hidden=method.value!=='replace';if(!ids.includes(replacementId))replacementId=ids[0]||'';for(const id of ids){const photo=state.photos.find(p=>p.id===id);if(!photo)continue;const label=document.createElement('label'),radio=document.createElement('input'),image=document.createElement('img');radio.type='radio';radio.name='capture-replacement';radio.value=id;radio.checked=id===replacementId;radio.setAttribute('aria-label','교체 대상 '+photo.name);radio.onchange=()=>{replacementId=id;refreshSizing()};image.src=photo.src;image.alt=photo.name;image.style.cssText='width:64px;height:80px;object-fit:contain;vertical-align:middle';label.append(radio,image,document.createTextNode(photo.name));replacements.append(label)}method.options[0].textContent=ids.length?'기존 사진 뒤에 추가':'이 섹션에 추가';refreshSizing()};
 destination.onchange=()=>{if(destination.value==='__new__')method.value='new';else if(method.value==='new')method.value='append';acknowledge.checked=false;refreshMethod()};method.onchange=()=>{if(method.value!=='new'&&destination.value==='__new__'){const first=designSections()[0];if(first)destination.value=first.id}acknowledge.checked=false;refreshMethod()};if(destination.value==='__new__')method.value='new';
 let busy=false;
 const add=button('선택한 방식으로 적용',async()=>{if(busy)return;message.textContent='';if(JSON.stringify(state)!==snapshot){message.textContent='작업이 변경되었습니다. 닫고 다시 보내세요.';return}if(matches.length&&!acknowledge.checked){message.textContent='같은 이미지 비교를 확인한 뒤 확인란을 선택하세요.';return}if(storageReadFailed){message.textContent='기존 작업을 읽지 못했습니다. 프로젝트 파일로 복구 후 다시 보내세요.';return}const target=chosenSection();if(method.value!=='new'&&!target){message.textContent='넣을 섹션을 선택하세요.';return}if(method.value==='replace'&&!target.photoIds.includes(replacementId)){message.textContent='교체할 사진을 선택하세요.';return}if(!sizing.update())return;const photoId=matches[0]?.id||packet.id;if(target?.photoIds.includes(photoId)&&(method.value!=='replace'||replacementId!==photoId)){message.textContent='이 섹션에 같은 이미지가 있습니다. 해당 사진 교체를 선택하거나 다른 섹션을 선택하세요.';return}if(method.value==='new'&&state.sections.length>=50){message.textContent='섹션은 최대 50개입니다.';return}if(!state.photos.some(p=>p.id===photoId)&&state.photos.length>=30){message.textContent='사진은 최대 30장입니다.';return}busy=true;add.disabled=true;try{await projectStore.set('capture-transfer-backup-'+Date.now()+'-'+uid(),JSON.stringify(state));if(!dialog.open)return;checkpoint();if(!state.photos.some(p=>p.id===photoId))state.photos.push({...sizingPhoto,id:photoId,kind:'product'});let section=target;if(!section){section=makeTransferredCaptureSection({...packet,id:photoId});state.sections.push(section);state.designOrder=[...designSections().filter(s=>s.id!==section.id).map(s=>s.id),section.id]}else if(method.value==='replace')replaceTransferredPhoto(section,replacementId,photoId);else attachTransferredCapture(section,photoId);section.photoSizing={...section.photoSizing,[photoId]:sizing.select.value};selected=section.id;changed({editor:true});setStep(3);await renderPromise;await flushSave();clean();dialog.close();const bound=bounds.find(b=>b.id===section.id),plan=measureSection(section),photo=state.photos.find(p=>p.id===photoId),image=plan.ops.find(op=>op.kind==='image'&&op.src===photo.src);if(bound)$('#preview-scroll').scrollTo({top:(bound.y+(image?.y||0))*$('#preview').getBoundingClientRect().width/860,behavior:'instant'});notify((method.value==='replace'?'선택한 사진을 교체했습니다. 원본은 사진 목록에 보존됩니다.':'선택한 캡처 한 장을 추가했습니다.')+' Ctrl+Z로 복원할 수 있습니다.')}catch(e){message.textContent='적용 실패: '+e.message}finally{busy=false;add.disabled=false}});add.classList.add('primary');const close=button('취소',()=>{if(busy)return;clean();dialog.close()});dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault()});const previewDetails=document.createElement('details'),previewSummary=document.createElement('summary');previewSummary.textContent='적용 전 섹션 미리보기';previewDetails.append(previewSummary,sizing.preview);previewDetails.style.cssText='max-height:320px;overflow:auto';dialog.append(h,description,info,img,targetLabel,methodLabel,replacements,duplicate,sizing.label,sizing.note,previewDetails,message,add,close);dialog.style.cssText='width:min(92vw,640px);max-height:90dvh;overflow:auto';dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();refreshMethod();

 }catch(e){notify(e.message)}
}
await reviewCaptureTransfer();
