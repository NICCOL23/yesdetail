// Classic entry: file URLs connect to the running localhost server.
(()=>{
 if(location.protocol!=='file:')return;
 const file=decodeURIComponent(location.pathname.split('/').pop()||'index.html');
 if(!/^[\w-]+\.html$/.test(file))return;
 const target='http://127.0.0.1:4173/'+file+location.search+location.hash;
 function start(){
  const panel=document.createElement('main');panel.style.cssText='position:fixed;inset:0;z-index:2147483647;overflow:auto;background:#f7f5f1;padding:clamp(24px,7vw,90px);font:16px/1.8 system-ui,sans-serif;color:#292723';
  panel.innerHTML='<div style="max-width:620px;margin:5vh auto"><p>YesDetail · 예스디테일</p><h1>정상 실행 화면으로 연결 중입니다…</h1><p>파일을 직접 열어도 로컬 프로그램으로 자동 연결합니다.</p><p><a id="local-open" style="display:inline-block;background:#264638;color:white;padding:12px 22px;border-radius:6px">정상 실행 화면 열기</a></p><p id="local-help"></p><button id="local-retry" hidden>연결 다시 확인</button><p>기존 프로젝트와 사진 원본은 변경하지 않습니다.</p></div>';
  panel.querySelector('#local-open').href=target;document.body.append(panel);let probe,timer;
  function connect(){clearTimeout(timer);if(probe){probe.onload=null;probe.onerror=null}const help=panel.querySelector('#local-help'),retry=panel.querySelector('#local-retry');help.textContent='로컬 서버를 확인하고 있습니다…';retry.hidden=true;
   function fail(){clearTimeout(timer);probe.onload=null;probe.onerror=null;panel.querySelector('h1').textContent='로컬 서버를 먼저 실행해 주세요';help.textContent='같은 소스 폴더의 「Gemini 무료 연결.cmd」를 실행하세요. 서버 실행 후 「연결 다시 확인」을 누르면 자동으로 열립니다. AI 없이 편집만 할 때는 「실행.cmd」를 사용할 수 있습니다.';retry.hidden=false}
   probe=new Image();probe.onload=()=>{clearTimeout(timer);location.replace(target)};probe.onerror=fail;timer=setTimeout(fail,6000);probe.src='http://127.0.0.1:4173/assets/pc3-12800.jpg?entry='+Date.now();
  }
  panel.querySelector('#local-retry').onclick=connect;connect();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
