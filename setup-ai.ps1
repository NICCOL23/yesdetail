param([switch]$GeminiFree,[int]$Port=4173)
$ErrorActionPreference='Stop'
Set-Location -LiteralPath $PSScriptRoot
if($Port -lt 1024 -or $Port -gt 65535){throw 'Invalid local port'}
$env:YESDETAIL_PORT=[string]$Port
Write-Host 'YesDetail AI setup: keys stay in this server process only.'
Write-Host '1: Gemini FREE project (NO Cloud Billing account linked)'
Write-Host '2: OpenAI PAID mode'
Write-Host '3: Both (Gemini default; never automatic fallback)'
if($GeminiFree){$mode='1'}else{do {
 $mode=(Read-Host 'Choose 1, 2 or 3 (Enter = Gemini FREE)').Trim()
 if(!$mode){$mode='1'}
 if($mode -notin @('1','2','3')){Write-Host 'Please enter 1, 2 or 3. The window will stay open.'}
} until($mode -in @('1','2','3'))}
Remove-Item Env:GEMINI_API_KEY -ErrorAction SilentlyContinue
Remove-Item Env:OPENAI_API_KEY -ErrorAction SilentlyContinue
Remove-Item Env:YESDETAIL_GEMINI_FREE_CONFIRMED -ErrorAction SilentlyContinue
Remove-Item Env:YESDETAIL_OPENAI_PAID_ENABLED -ErrorAction SilentlyContinue
function Read-PrivateKey([string]$prompt){
 Add-Type -AssemblyName System.Windows.Forms
 Add-Type -AssemblyName System.Drawing
 $form=New-Object System.Windows.Forms.Form
 $form.Text='YesDetail - Flash-Lite key input'
 $form.Size=New-Object System.Drawing.Size(580,235)
 $form.StartPosition='CenterScreen'
 $form.TopMost=$true
 $label=New-Object System.Windows.Forms.Label
 $label.Text='Paste the full API key below. The key stays private and is not saved.'
 $label.Location=New-Object System.Drawing.Point(18,16)
 $label.Size=New-Object System.Drawing.Size(530,38)
 $box=New-Object System.Windows.Forms.TextBox
 $box.Location=New-Object System.Drawing.Point(18,61)
 $box.Size=New-Object System.Drawing.Size(525,26)
 $box.UseSystemPasswordChar=$true
 $box.MaxLength=5000
 $paste=New-Object System.Windows.Forms.Button
 $paste.Text='Paste key'
 $paste.Location=New-Object System.Drawing.Point(18,104)
 $paste.Size=New-Object System.Drawing.Size(115,34)
 $paste.Add_Click({$box.Text=[System.Windows.Forms.Clipboard]::GetText().Trim();$box.Focus()})
 $connect=New-Object System.Windows.Forms.Button
 $connect.Text='Connect'
 $connect.Location=New-Object System.Drawing.Point(145,104)
 $connect.Size=New-Object System.Drawing.Size(115,34)
 $connect.Add_Click({if($box.Text.Trim() -notmatch '^[\x21-\x7E]{20,5000}$'){[System.Windows.Forms.MessageBox]::Show('The API key was not pasted correctly. Copy the API key again, then click Paste key.','YesDetail') | Out-Null;return};$form.DialogResult=[System.Windows.Forms.DialogResult]::OK;$form.Close()})
 $cancel=New-Object System.Windows.Forms.Button
 $cancel.Text='Cancel'
 $cancel.DialogResult=[System.Windows.Forms.DialogResult]::Cancel
 $cancel.Location=New-Object System.Drawing.Point(275,104)
 $cancel.Size=New-Object System.Drawing.Size(100,34)
 $form.Controls.AddRange(@($label,$box,$paste,$connect,$cancel))
 $form.AcceptButton=$connect
 $form.CancelButton=$cancel
 try{if($form.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK){return ''};return $box.Text.Trim()}finally{$box.Clear();$form.Dispose()}
}
if($mode -in @('1','3')){
 Write-Host 'Use an API key from a project WITHOUT a billing account.'
 Write-Host 'A key alone cannot prove billing is disabled. Check AI Studio first.'
 if(!$GeminiFree){do {
  $check=(Read-Host 'Confirm Free tier: type free or FREE').Trim()
  if($check -ine 'FREE'){Write-Host 'Please type free and press Enter. The window will stay open.'}
 } until($check -ieq 'FREE')}
 $env:GEMINI_API_KEY=Read-PrivateKey 'Paste Gemini API key (hidden; not saved)'
 if(!$env:GEMINI_API_KEY){exit 1}
 $env:YESDETAIL_GEMINI_FREE_CONFIRMED='1'
}
if($mode -in @('2','3')){
 do {$checkPaid=(Read-Host 'OpenAI incurs API charges. Type PAID to enable manual paid requests').Trim()} until($checkPaid -ieq 'PAID')
 $env:OPENAI_API_KEY=Read-PrivateKey 'Paste OpenAI API key (hidden; not saved)'
 if(!$env:OPENAI_API_KEY){exit 1}
 $env:YESDETAIL_OPENAI_PAID_ENABLED='1'
}
Write-Host 'If port 4173 is in use: save your project, close its old server terminal, then run this file again.'
Write-Host 'No browser page will be refreshed automatically. Open http://127.0.0.1:4173/studio-next.html'
try{node --use-system-ca server.mjs}finally{
 Remove-Item Env:GEMINI_API_KEY -ErrorAction SilentlyContinue
 Remove-Item Env:OPENAI_API_KEY -ErrorAction SilentlyContinue
 Remove-Item Env:YESDETAIL_GEMINI_FREE_CONFIRMED -ErrorAction SilentlyContinue
 Remove-Item Env:YESDETAIL_OPENAI_PAID_ENABLED -ErrorAction SilentlyContinue
}

