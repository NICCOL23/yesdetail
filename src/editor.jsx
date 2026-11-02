import React, {useRef} from 'react';
import {createRoot} from 'react-dom/client';
const roots=new WeakMap();
export function renderReactEditor(node,props){let root=roots.get(node);if(!root){root=createRoot(node);roots.set(node,root);}root.render(<Editor key={props.section?.id||'none'} {...props}/>);}
function Editor({section:s,fontSize,photos=[],onPhotoSizing,onBegin,onEdit,onRegenerate,onDelete,onPreset,planPending,sourcePending,onReviewSource,onApplyDraft}){
 const tracked=useRef(false);
 if(!s)return <p>섹션을 선택하세요.</p>;
 const edit=(key,value)=>{if(!tracked.current){onBegin();tracked.current=true;}onEdit(key,value);};
 const focus=()=>{tracked.current=false;};
 const range=(key,label,min,max,fallback)=><label key={key}>{label} <output>{s[key]??fallback}</output><input type="range" min={min} max={max} value={s[key]??fallback} onFocus={focus} onChange={e=>edit(key,+e.target.value)}/></label>;
 const choice=(key,label,options,fallback)=><label>{label}<select value={s[key]||fallback} onFocus={focus} onChange={e=>edit(key,e.target.value)}>{options.map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label>;
 return <div className="react-section-editor"><details className="studio-preset-options"><summary>전체 디자인 바꾸기</summary><div className="react-presets"><button onClick={()=>onPreset('food')}>식품 · 에디토리얼</button><button onClick={()=>onPreset('tech')}>컴퓨터 · 테크</button><button onClick={()=>onPreset('general')}>일반 상품 · 스튜디오</button></div><p className="hint">선택하면 전체 섹션의 배치와 색상을 적용합니다. 실행 취소로 복원할 수 있습니다.</p></details><h3>선택한 섹션 편집</h3><div className="draft-status"><p>{sourcePending?'기본 정보 변경 · 기획 검토 필요':planPending?'기획 변경 대기 · 현재 디자인은 유지됩니다.':'기획과 디자인이 일치합니다.'}</p>{sourcePending&&<button onClick={onReviewSource}>이 섹션 상품 정보 검토</button>}{planPending&&<button onClick={onApplyDraft}>이 섹션 기획 반영 검토</button>}</div><label>제목<input id="section-title" value={s.title} onFocus={focus} onChange={e=>edit('title',e.target.value)}/></label><label>본문<textarea id="section-body" rows={9} value={s.body} onFocus={focus} onChange={e=>edit('body',e.target.value)}/></label><div className="section-controls"><button onClick={onRegenerate}>템플릿 재생성</button><button onClick={onDelete}>삭제</button></div>
 {['color','background'].map((key)=><label key={key}>{key==='color'?'섹션 글자 색상':'페이지 배경 색상'}<input type="color" value={s[key]||(key==='color'?'#253047':'#ffffff')} onFocus={focus} onChange={e=>edit(key,e.target.value)}/></label>)}
 {range('fontSize','섹션 글자 크기',20,42,fontSize)}
 {choice('presentation','사진·문구 배치',[['standard','기본 정보형'],['editorial','큰 제목 → 본문 → 사진'],['photoFirst','사진 → 제목 → 본문'],['imageOnly','완성 이미지 전용'],['split','사진 2열'],['points','번호형 특징'],['steps','단계별 안내'],['foodHero','스튜디오 · 대표'],['foodBundle','스튜디오 · 판매 구성'],['foodTexture','스튜디오 · 디테일'],['foodSpecs','스튜디오 · 사양 표'],['foodGuide','스튜디오 · 구매 전 확인'],['foodShipping','스튜디오 · 배송 안내'],['foodFeatures','식품 · 특징 카드'],['studioHero','제품 · 대표 쇼케이스'],['studioOptions','제품 · 옵션 카드'],['studioDetail','제품 · 디테일 갤러리'],['studioSpecs','제품 · 사양 데이터'],['studioFeatures','제품 · 특징 요약'],['studioGuide','제품 · 구매·사용 안내'],['studioFaq','제품 · FAQ']],'standard')}
 <details><summary>사진별 표시 방식 · 높이 자동</summary>{(s.photoIds||[]).map(id=><button key={id} onClick={()=>onPhotoSizing(id)}>{photos.find(p=>p.id===id)?.name||'사진'} · {s.photoSizing?.[id]==='auto'?'높이 자동':'기존 영역'}</button>)}</details>
 {range('imageHeight','사진 영역 높이',240,1100,520)}{range('titleSize','큰 제목 최대 크기',30,80,54)}<p className="hint">긴 제목은 최대 크기 안에서 자동으로 줄여 표시합니다.</p>
 {choice('align','문구 정렬',[['left','왼쪽'],['center','가운데'],['right','오른쪽']],'left')}
 {choice('imageFit','사진 맞춤',[['contain','전체 보기 · 잘림 없음'],['cover','영역 채우기 · 일부 잘림']],'contain')}
 {range('focusX','자르기 중심 · 가로',0,100,50)}{range('focusY','자르기 중심 · 세로',0,100,50)}<p className="hint">사진 지정·교체는 02 기획 검토에서 합니다. AI 이미지 생성은 미연결 상태입니다. 외부 AI에서 만든 이미지는 AI 연출로 지정해 업로드할 수 있습니다.</p><button onClick={()=>edit('background',null)}>배경 기본값으로</button></div>;
}
