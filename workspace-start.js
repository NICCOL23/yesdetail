// Keep a durable copy before replacing the current workspace.
export async function beginNewWorkspace({store,key,current,create,id}){
 const raw=JSON.stringify(current);
 await store.set(key+'-backup-'+id,raw);
 await store.set(key+'-previous-product',raw);
 return create();
}
export function emptyWorkspace(defaults,makeSections,category='일반 상품'){
 const product=Object.fromEntries(Object.keys(defaults).map(key=>[key,'']));
 product.category=category;product.quantity='1';
 return {version:2,product,photos:[],sections:makeSections(product).filter(s=>!['식품','일반 상품'].includes(category)||!['condition','test'].includes(s.type)),designOrder:[],style:{accent:'#35975d',fontSize:28,mood:{soft:'#6ac88a',light:'#e9f1ea',dark:'#191e1b'}}};
}
