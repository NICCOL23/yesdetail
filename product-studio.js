// Deterministic product layouts. The same operations paint preview and export.
export function productStudioPlan(s,index,state,photos,wrap){
 const W=860,P=60,C=W-2*P,m=state.style.mood||{},accent=state.style.accent||'#27865b';
 const paper=s.background||m.light||'#edf3f0';
 const isDark=(parseInt(paper.slice(1,3),16)*299+parseInt(paper.slice(3,5),16)*587+parseInt(paper.slice(5,7),16)*114)<125000;
 const ink=s.color||(isDark?'#f7faf8':'#192923'),muted=isDark?'#b9cbc0':'#57665e',card=isDark?'#263b31':'#ffffff';
 const ops=[],size=s.fontSize||state.style.fontSize||28,title=s.titleSize||68;let y=60;
 const rect=(x,yy,w,h,fill,r=0)=>ops.push({kind:'rect',x,y:yy,w,h,fill,r});
 const text=(v,x,yy,w=C,z=size,weight=400,fill=ink,lh=1.55,align=s.align||'left')=>{const lines=wrap(String(v||''),w,z,weight);ops.push({kind:'text',lines,x,y:yy,width:w,size:z,weight,fill,lineHeight:lh,align});return lines.length*z*lh;};
 const label=(v)=>{y+=text(v,P,y,C,18,700,isDark?(m.soft||'#b9cbc0'):accent,1.3);y+=24;};
 const heading=(v)=>{label(v);y+=text(s.title,P,y,C,fittedTitle(s.title,title),700,ink,1.18);y+=34;};
 const photo=(p,x,yy,w,h)=>ops.push({kind:'image',src:p.src,x,y:yy,w,h,original:p.kind!=='product',fit:s.imageFit||'contain',focusX:s.focusX??50,focusY:s.focusY??50});
 const imageHeight=s.imageHeight||480;
 const fittedTitle=(value,max)=>{let z=max;while(z>36&&wrap(value,C,z,700).length>3)z-=2;return z;};
 const photoHeight=(item,w=C)=>Math.min(imageHeight,Math.max(220,w/(item.kind==='product'&&item.renderAspect?item.renderAspect:(item.width||1)/(item.height||1))));
 const prose=(values)=>{for(const value of values){y+=text(value,P,y,C,size,400,ink,1.65);y+=18;}};
 const all=String(s.body||'').split('\n').map(v=>v.trim()).filter(Boolean);
 const noteIndex=all.findIndex(v=>/^(※|\[샘플|\*)/.test(v));
 const main=noteIndex<0?all:all.slice(0,noteIndex),notes=noteIndex<0?[]:all.slice(noteIndex);
 const foot=()=>{if(!notes.length)return;y+=24;rect(P,y,C,1,isDark?'#516256':'#d5dfd8');y+=22;y+=text(notes.join('\n'),P,y,C,22,400,muted,1.65);};
 const gallery=()=>{for(const p of photos){const h=photoHeight(p);photo(p,P,y,C,h);y+=h+20;}};
 const panel=(value,i)=>{const h=wrap(value,C-100,size).length*size*1.6+48;rect(P,y,C,h,card,12);text(String(i+1).padStart(2,'0'),P+22,y+24,50,22,700,accent);text(value,P+86,y+24,C-110,size,400,ink,1.6);y+=h+14;};
 rect(0,0,W,1,paper);
 if(s.presentation==='studioHero'){
  label(state.product?.category==='일반 상품'?'PRODUCT / STUDIO':'HARDWARE / COLLECTION');
  y+=text(s.title,P,y,C,fittedTitle(s.title,title),700,ink,1.14);y+=28;
  if(main[0]){y+=text(main[0],P,y,C,30,400,muted);y+=28;}
  if(photos.length){const h=Math.min(photoHeight(photos[0],C-32),380);rect(P,y,C,h+32,card,18);photo(photos[0],P+16,y+16,C-32,h);y+=h+56;}
  const facts=main.slice(1);for(let i=0;i<facts.length;i+=2){const values=facts.slice(i,i+2),w=(C-16)/2;const h=Math.max(...values.map(v=>wrap(v,w-40,24,700).length*24*1.5))+40;values.forEach((v,j)=>{rect(P+j*(w+16),y,w,h,card,10);rect(P+j*(w+16),y,4,h,accent);text(v,P+j*(w+16)+22,y+20,w-42,24,700,ink,1.5);});y+=h+16;}
  for(const p of photos.slice(1)){photo(p,P,y,C,imageHeight);y+=imageHeight+20;}
  foot();
 }else if(s.presentation==='studioOptions'){
  heading('SELECT / OPTIONS');
  main.forEach(panel);if(photos.length){y+=22;gallery();}foot();
 }else if(s.presentation==='studioDetail'){
  heading('DETAIL / CLOSE UP');
  for(const [i,p]of photos.entries()){const inset=i%2?80:0,h=photoHeight(p,C-inset);photo(p,P+inset,y,C-inset,h);y+=h+22;}
  prose(main);foot();
 }else if(s.presentation==='studioSpecs'){
  heading('SPECIFICATION / DATA');
  for(const row of all){const split=row.indexOf('|');if(split<0){y+=text(row,P,y,C,size);y+=20;continue;}
   const key=row.slice(0,split).trim(),value=row.slice(split+1).trim(),kw=230,vw=C-kw-48;
   const h=Math.max(wrap(key,kw-36,24,700).length*24*1.5,wrap(value,vw,26).length*26*1.6)+40;
   rect(P,y,C,h,card);rect(P,y,kw,h,isDark?'#304b3c':'#e2ebe5');text(key,P+18,y+20,kw-36,24,700,ink,1.5);text(value,P+kw+24,y+20,vw,26,400,value==='미확인'?muted:ink,1.6);y+=h+2;
  }if(photos.length){y+=32;gallery();}
 }else if(s.presentation==='studioFaq'){
  heading('QUESTIONS / ANSWERS');
  const groups=[];for(const line of all){if(/^Q[.．\s:]/i.test(line)||!groups.length)groups.push([line]);else groups[groups.length-1].push(line);}
  for(const group of groups){const q=group[0],a=group.slice(1).join('\n');const qh=wrap(q,C-40,28,700).length*28*1.5+36;rect(P,y,C,qh,card,12);text(q,P+20,y+18,C-40,28,700,ink,1.5);y+=qh+20;if(a)y+=text(a,P+22,y,C-44,26,400,muted,1.65);y+=30;}
  gallery();
 }else if(s.presentation==='studioFeatures'){
  heading('PRODUCT / ESSENTIALS');if(s.type==='shipping')prose(main);else main.forEach(panel);gallery();foot();
 }else{
  heading(s.type==='shipping'?'ORDER / DELIVERY':s.type==='usage'?'HOW TO / GUIDE':'CHECK / BEFORE YOU BUY');
  if(s.type==='shipping')prose(main);else main.forEach(panel);gallery();foot();
 }
 y+=60;ops[0].h=Math.ceil(y);return{s,index,ops,height:Math.ceil(y)};
}
