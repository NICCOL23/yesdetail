$ErrorActionPreference='Stop'
Set-Location -LiteralPath $PSScriptRoot
$url='http://127.0.0.1:4173/studio-next.html'
function Test-Running {
 try {$status=Invoke-RestMethod -Uri 'http://127.0.0.1:4173/api/ai/status' -TimeoutSec 2;return ($null -ne $status.token)}catch{return $false}
}
if(Test-Running){Start-Process $url;exit 0}
# Key input stays in the existing local private GUI, not a saved file.
$aiProcess=Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',('"'+(Join-Path $PSScriptRoot 'setup-ai.ps1')+'"'),'-GeminiFree') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -PassThru
$ready=$false
for($attempt=0;$attempt -lt 180;$attempt++){
 if(Test-Running){$ready=$true;break}
 if($aiProcess.HasExited){break}
 Start-Sleep -Seconds 1
}
if($ready){Start-Process $url}else{
 Add-Type -AssemblyName System.Windows.Forms
 [System.Windows.Forms.MessageBox]::Show('서버 연결을 완료하지 못했습니다. 같은 폴더의 Gemini 무료 연결.cmd를 실행하고 키를 입력한 뒤 예스디테일 바로 실행.cmd를 다시 눌러 주세요. 기존 서버는 자동 종료하지 않습니다.','YesDetail 실행 안내')|Out-Null
}
