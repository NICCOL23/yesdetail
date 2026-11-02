// Editorial layouts share the same drawing operations as preview and PNG export.
export function foodEditorialPlan(s,index,state,photos,wrap){
 const W=860,P=64,CW=W-P*2,mood=state.style.mood||{},accent=state.style.accent||'#7e292f';
 const paper=s.background||mood.light||'#f4f1eb',dark=mood.dark||'#23211e';
 const darkPage=parseInt(paper.slice(1,3),16)*.299+parseInt(paper.slice(3,5),16)*.587+parseInt(paper.slice(5,7),16)*.114<125;
 const ink=s.color||(darkPage?'#fffaf2':'#252522'),muted=darkPage?'#d3c6b6':'#716b62',card=darkPage?'#37332e':'#e8e0d4';
 const fs=s.fontSize||state.style.fontSize||28,title=s.titleSize||72,ops=[];let y=0;
 const rect=(x,yy,w,h,fill,r=0)=>ops.push({kind:'rect',x,y:yy,w,h,fill,r});
 const text=(value,x,yy,{width=CW,size=fs,weight=400,fill=ink,lineHeight=1.6,align=s.align||'left'}={})=>{const lines=wrap(String(value||''),width,size,weight);ops.push({kind:'text',lines,x,y:yy,width,size,weight,fill,lineHeight,align});return lines.length*size*lineHeight;};
 const rule=(yy,color='#d8cfc2')=>rect(P,yy,CW,1,color);
 const label=(value,yy,fill=darkPage?(mood.soft||'#d4baa5'):accent)=>text(value,P,yy,{size:18,weight:700,fill,lineHeight:1.3});
 const image=(item,x,yy,w,h)=>ops.push({kind:'image',src:item.src,x,y:yy,w,h,original:true,fit:s.imageFit||'contain',focusX:s.focusX??50,focusY:s.focusY??50});
 const photo=(x=P,w=CW)=>{if(!photos.length)return;for(const item of photos){const natural=w*(item.height||3)/(item.width||4);const h=s.imageFit==='cover'?(s.imageHeight||Math.min(800,natural)):Math.min(s.imageHeight||800,natural);image(item,x,y,w,h);y+=h+16;}};
 const all=String(s.body||'').split('\n').map(v=>v.trim()).filter(Boolean),noteStart=all.findIndex(v=>/^(※|\*|\[샘플)/.test(v));
 const main=noteStart<0?all:all.slice(0,noteStart),notes=noteStart<0?[]:all.slice(noteStart);
 const blocks=String(s.body||'').split(/\n\s*\n/).map(v=>v.trim()).filter(Boolean);
 rect(0,0,W,1,paper);
 function leadPackCount(values){return values.join(' ').match(/꼼장어\s*(\d+)\s*팩/)?.[1]||'';}
 function heading(kicker){y+=64;label(kicker,y);y+=42;y+=text(s.title,P,y,{size:title,weight:700,lineHeight:1.22});y+=36;}
 function note(values=notes){if(!values.length)return;y+=20;rule(y);y+=24;y+=text(values.join('\n'),P,y,{size:22,fill:muted,lineHeight:1.65});}
 if(s.presentation==='foodHero'){
  y=56;label(state.product?.category==='식품'?'THE TABLE COLLECTION':'PRODUCT COLLECTION',y);y+=52;
  let heroSize=title;while(heroSize>36&&wrap(s.title,CW,heroSize,700).length>3)heroSize-=2;
  const head=s.title.replace(/^(.+?)\s+(.+\s+세트)$/,'$1\n$2');
  y+=text(head,P,y,{size:heroSize,weight:700,lineHeight:1.12});y+=28;
  if(main[0]){y+=text(main[0],P,y,{size:30,fill:muted,lineHeight:1.5});y+=32;}
  photo(0,W);y+=20;
  const facts=main.slice(1);if(facts.length){const values=facts.join('\n');const h=wrap(values,CW-56,26).length*26*1.65+56;rect(P,y,CW,h,dark,0);text(values,P+28,y+28,{width:CW-56,size:26,fill:'#fffaf2',lineHeight:1.65});y+=h;}
  note();y+=58;
 }else if(s.presentation==='foodBundle'){
  heading('PRODUCT OPTIONS');
  const total=main.join(' ').match(/(?:꼼장어\s*)?총\s*(\d+)\s*팩/);
  if(total){const number=total[1];y+=8;const nh=text(number,P,y,{size:156,weight:700,fill:accent,lineHeight:1});text('팩 구성',P+Math.min(400,number.length*102)+22,y+88,{size:36,weight:700,width:CW-Math.min(400,number.length*102)-22});const sets=main.join(' ').match(/[×x]\s*(\d+)\s*세트/);if(sets){const perSet=leadPackCount(main);text((perSet?perSet+'팩씩\n':'')+sets[1]+'세트',P+440,y+28,{size:32,weight:700,width:280,fill:ink,lineHeight:1.6});}y+=nh+24;}
  const lead=main.filter(v=>!/(?:꼼장어\s*)?총\s*\d+\s*팩/.test(v));if(lead.length){y+=text(lead.join('\n'),P,y,{size:30,weight:700,lineHeight:1.6});y+=32;}
  rule(y);y+=30;photo();note();y+=64;
 }else if(s.presentation==='foodTexture'){
  y=0;photo(0,W);y+=28;
  label('02 / A CLOSER LOOK',y);y+=42;
  y+=text(s.title.replace(/,\s*/,',\n'),P,y,{size:title,weight:700,lineHeight:1.22});y+=30;
  if(main.length)y+=text(main.join('\n'),P,y,{size:30,lineHeight:1.7});
  note();y+=64;
 }else if(s.presentation==='foodSpecs'){
  heading('PRODUCT INFORMATION');
  for(const row of all){const [key,...rest]=row.split('|');if(!rest.length){y+=text(row,P,y,{size:26});y+=18;continue;}
   const value=rest.join('|').trim(),kw=242,vw=CW-kw-28;
   const h=Math.max(wrap(key.trim(),kw-36,24,700).length*24*1.6,wrap(value,vw-24,26).length*26*1.65)+44;
   rule(y);rect(P,y,kw,h,card,0);text(key.trim(),P+18,y+22,{width:kw-36,size:24,weight:700,lineHeight:1.6});text(value,P+kw+28,y+22,{width:vw-24,size:26,fill:value==='미확인'?muted:ink,lineHeight:1.65});y+=h;
  }rule(y);y+=64;
 }else if(s.presentation==='foodFeatures'){
  heading('THE ESSENTIALS');for(const [i,value]of all.entries()){const h=wrap(value,CW-112,30,700).length*30*1.6+52;rect(P,y,CW,h,card);text(String(i+1).padStart(2,'0'),P+22,y+26,{size:22,weight:700,fill:accent,width:55});text(value,P+90,y+26,{size:30,weight:700,width:CW-112,lineHeight:1.6});y+=h+18;}y+=48;
 }else{
  heading(s.presentation==='foodGuide'?'BEFORE YOU BUY':'ORDER & DELIVERY');
  const groups=s.presentation==='foodGuide'?all.filter(v=>!/^\[샘플 안내\]$/.test(v)):blocks;
  if(s.presentation==='foodGuide'&&all.some(v=>/^\[샘플 안내\]$/.test(v))){label('[샘플 안내]',y);y+=36;}
  for(const [i,value]of groups.entries()){
   if(s.presentation==='foodShipping'){const [first,...rest]=value.split('\n');y+=text(first,P,y,{size:28,weight:700,lineHeight:1.5});y+=16;if(rest.length)y+=text(rest.join('\n'),P,y,{size:26,lineHeight:1.75});y+=30;if(i<groups.length-1){rule(y);y+=30;}continue;}
   const h=wrap(value,CW-96,26).length*26*1.75+48;
   rect(P,y,CW,h,card);rect(P,y,4,h,accent);
   text(String(i+1).padStart(2,'0'),P+20,y+24,{size:18,weight:700,width:40,fill:accent});text(value,P+72,y+24,{width:CW-96,size:26,lineHeight:1.75});y+=h+16;
  }y+=48;
 }
 ops[0].h=Math.ceil(y);return {s,index,ops,height:Math.ceil(y)};
}
