<#
    setup-firebase.ps1 — provisions the whole Firebase backend for the Star quest.

    Run this ONCE, after `firebase login`. It will:
      1. create a new Firebase project
      2. create the Realtime Database instance
      3. enable Anonymous sign-in
      4. register a web app and write its config into firebase-config.js
      5. add your GitHub Pages domain to the authorized-domain list
      6. deploy database.rules.json

    Every step reports OK or FAILED. If a step fails, the exact console
    click-path is printed so you can finish that one by hand — the script
    does not pretend a step worked.

    Usage:
      .\tools\setup-firebase.ps1
      .\tools\setup-firebase.ps1 -ProjectId my-existing-project   # reuse
      .\tools\setup-firebase.ps1 -PagesDomain grammarmetric.github.io
#>

[CmdletBinding()]
param(
  [string]$ProjectId  = '',
  [string]$Location   = 'asia-southeast1',
  [string]$PagesDomain = 'grammarmetric.github.io',
  [string]$DisplayName = 'Lily Star Quest'
)

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
$firebase = "$env:APPDATA\npm\firebase.cmd"
if (-not (Test-Path $firebase)) { $firebase = 'firebase' }

$script:failures = @()
function Step($n) { Write-Host "`n[$n]" -ForegroundColor Cyan }
function OK($m)   { Write-Host "  OK    $m" -ForegroundColor Green }
function Bad($m, $fix) {
  Write-Host "  FAILED  $m" -ForegroundColor Red
  Write-Host "          do this by hand: $fix" -ForegroundColor Yellow
  $script:failures += "$m  ->  $fix"
}

# ---------------------------------------------------------------- login check
Step 'Checking login'
$who = & $firebase login:list 2>&1 | Out-String
if ($who -match 'No authorized accounts') {
  Write-Host "  You are not logged in. Run this first, then re-run me:" -ForegroundColor Yellow
  Write-Host "      firebase login" -ForegroundColor White
  exit 1
}
OK ($who.Trim() -replace '\s+', ' ')

# ------------------------------------------------- OAuth token for REST calls
# firebase-tools has no CLI command for enabling Anonymous auth or editing the
# authorized-domain list, so those two steps go straight to the Identity
# Toolkit admin API using the token the CLI already holds for you.
function Get-AccessToken {
  $store = "$env:APPDATA\configstore\firebase-tools.json"
  if (-not (Test-Path $store)) { return $null }
  $j = Get-Content $store -Raw | ConvertFrom-Json
  $t = $j.tokens
  if (-not $t) { return $null }
  $stillValid = $t.expires_at -and ([double]$t.expires_at -gt ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() + 60000))
  if ($stillValid -and $t.access_token) { return $t.access_token }
  if (-not $t.refresh_token) { return $null }
  try {
    # public client credentials embedded in the open-source firebase-tools CLI
    $body = @{
      client_id     = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com'
      client_secret = 'j9iVZfS8kkCEFUPaAeJV0sAi'
      refresh_token = $t.refresh_token
      grant_type    = 'refresh_token'
    }
    $r = Invoke-RestMethod -Method Post -Uri 'https://oauth2.googleapis.com/token' -Body $body -UseBasicParsing
    return $r.access_token
  } catch { return $null }
}

$token = Get-AccessToken
if ($token) { OK 'got an API access token' } else { Write-Host '  note  no API token; steps 3 and 5 will need the console' -ForegroundColor Yellow }

function Api($method, $uri, $bodyObj) {
  if (-not $token) { throw 'no access token' }
  $h = @{ Authorization = "Bearer $token"; 'Content-Type' = 'application/json' }
  $args = @{ Method = $method; Uri = $uri; Headers = $h; UseBasicParsing = $true }
  if ($bodyObj) { $args.Body = ($bodyObj | ConvertTo-Json -Depth 10 -Compress) }
  return Invoke-RestMethod @args
}

# ------------------------------------------------------------- 1. the project
Step '1. Firebase project'
if (-not $ProjectId) {
  $suffix = -join ((1..6) | ForEach-Object { 'abcdefghijklmnopqrstuvwxyz0123456789'[(Get-Random -Max 36)] })
  $ProjectId = "lily-quest-$suffix"
  Write-Host "  creating $ProjectId ..."
  $out = & $firebase projects:create $ProjectId --display-name "$DisplayName" 2>&1 | Out-String
  if ($LASTEXITCODE -eq 0) { OK "project $ProjectId created" }
  else {
    Bad "could not create project ($($out.Trim() -split "`n" | Select-Object -Last 1))" `
        "console.firebase.google.com -> Add project, then re-run with -ProjectId <id>"
    exit 1
  }
} else {
  OK "reusing $ProjectId"
}

# --------------------------------------------------------- 2. realtime database
Step '2. Realtime Database'
$dbId = "$ProjectId-default-rtdb"
$out = & $firebase database:instances:create $dbId --location $Location --project $ProjectId 2>&1 | Out-String
if ($LASTEXITCODE -eq 0 -or $out -match 'already exists') {
  OK "database $dbId in $Location"
} else {
  # REST fallback — the API needs enabling on brand-new projects
  $done = $false
  if ($token) {
    try {
      Api POST "https://serviceusage.googleapis.com/v1/projects/$ProjectId/services/firebasedatabase.googleapis.com:enable" @{} | Out-Null
      Start-Sleep -Seconds 8
      Api POST "https://firebasedatabase.googleapis.com/v1beta/projects/$ProjectId/locations/$Location/instances?databaseId=$dbId" @{ type = 'DEFAULT_DATABASE' } | Out-Null
      OK "database $dbId created via API"
      $done = $true
    } catch { }
  }
  if (-not $done) {
    Bad 'could not create the Realtime Database' `
        "console.firebase.google.com/project/$ProjectId/database -> Create Database -> $Location -> locked mode"
  }
}

# ------------------------------------------------------ 3. anonymous sign-in
Step '3. Anonymous sign-in'
$anonFix = "console.firebase.google.com/project/$ProjectId/authentication/providers -> Anonymous -> Enable"
if ($token) {
  try {
    try {
      Api POST "https://serviceusage.googleapis.com/v1/projects/$ProjectId/services/identitytoolkit.googleapis.com:enable" @{} | Out-Null
      Start-Sleep -Seconds 6
    } catch { }
    Api POST "https://identitytoolkit.googleapis.com/v2/projects/$ProjectId/identityPlatform:initializeAuth" @{} | Out-Null
  } catch { }
  try {
    Api PATCH "https://identitytoolkit.googleapis.com/admin/v2/projects/$ProjectId/config?updateMask=signIn.anonymous.enabled" `
        @{ signIn = @{ anonymous = @{ enabled = $true } } } | Out-Null
    OK 'anonymous sign-in enabled'
  } catch {
    Bad "could not enable anonymous sign-in ($($_.Exception.Message))" $anonFix
  }
} else {
  Bad 'no API token' $anonFix
}

# --------------------------------------------------------------- 4. web app
Step '4. Web app + config'
$appId = ''
$list = & $firebase apps:list WEB --project $ProjectId 2>&1 | Out-String
if ($list -match '(1:\d+:web:[0-9a-f]+)') { $appId = $Matches[1]; OK "reusing web app $appId" }
if (-not $appId) {
  $out = & $firebase apps:create WEB "Star quest" --project $ProjectId 2>&1 | Out-String
  if ($out -match '(1:\d+:web:[0-9a-f]+)') { $appId = $Matches[1]; OK "web app $appId created" }
  else { Bad 'could not create the web app' "console.firebase.google.com/project/$ProjectId/settings/general -> Your apps -> Web" }
}

if ($appId) {
  $cfgRaw = & $firebase apps:sdkconfig WEB $appId --project $ProjectId 2>&1 | Out-String
  $m = [regex]::Match($cfgRaw, '\{[\s\S]*\}')
  if ($m.Success) {
    try {
      $wrap = $m.Value | ConvertFrom-Json
      $cfg = if ($wrap.sdkConfig) { $wrap.sdkConfig } else { $wrap }
      if (-not $cfg.databaseURL) {
        $cfg | Add-Member -NotePropertyName databaseURL -NotePropertyValue "https://$dbId.$Location.firebasedatabase.app" -Force
      }
      $lines = foreach ($p in $cfg.PSObject.Properties) { "  $($p.Name): '$($p.Value)'" }
      $js = @"
/* firebase-config.js — generated by tools/setup-firebase.ps1 on $(Get-Date -Format 'yyyy-MM-dd HH:mm').
   These values are not secrets: a Firebase web API key identifies the project,
   it does not authorise anything. Access is controlled by database.rules.json
   and by the authorized-domain list. */

window.FIREBASE_CONFIG = {
$($lines -join ",`n")
};
"@
      Set-Content -Path (Join-Path $root 'firebase-config.js') -Value $js -Encoding utf8
      OK "firebase-config.js written (databaseURL: $($cfg.databaseURL))"
    } catch {
      Bad "could not parse the SDK config ($($_.Exception.Message))" `
          "run: firebase apps:sdkconfig WEB $appId --project $ProjectId   and paste it into firebase-config.js"
    }
  } else {
    Bad 'sdkconfig returned nothing usable' "firebase apps:sdkconfig WEB $appId --project $ProjectId"
  }
}

# ------------------------------------------------------ 5. authorized domains
Step '5. Authorized domains'
$domFix = "console.firebase.google.com/project/$ProjectId/authentication/settings -> Authorized domains -> Add $PagesDomain"
if ($token) {
  try {
    $cur = Api GET "https://identitytoolkit.googleapis.com/admin/v2/projects/$ProjectId/config" $null
    $doms = @()
    if ($cur.authorizedDomains) { $doms = @($cur.authorizedDomains) }
    foreach ($d in @($PagesDomain, 'localhost')) { if ($doms -notcontains $d) { $doms += $d } }
    Api PATCH "https://identitytoolkit.googleapis.com/admin/v2/projects/$ProjectId/config?updateMask=authorizedDomains" `
        @{ authorizedDomains = $doms } | Out-Null
    OK "authorized: $($doms -join ', ')"
  } catch {
    Bad "could not update authorized domains ($($_.Exception.Message))" $domFix
  }
} else {
  Bad 'no API token' $domFix
}

# ------------------------------------------------------------- 6. deploy rules
Step '6. Database rules'
Push-Location $root
& $firebase use --add $ProjectId --alias default 2>&1 | Out-Null
$out = & $firebase deploy --only database --project $ProjectId --non-interactive 2>&1 | Out-String
Pop-Location
if ($LASTEXITCODE -eq 0) { OK 'database.rules.json deployed' }
else {
  Bad "rules deploy failed ($($out.Trim() -split "`n" | Select-Object -Last 1))" `
      "console.firebase.google.com/project/$ProjectId/database/$dbId/rules -> paste database.rules.json -> Publish"
}

# ----------------------------------------------------------------- summary
Write-Host "`n=================================================" -ForegroundColor Cyan
Write-Host " project    : $ProjectId"
Write-Host " database   : $dbId ($Location)"
Write-Host " console    : https://console.firebase.google.com/project/$ProjectId/overview"
if ($script:failures.Count -eq 0) {
  Write-Host "`n All steps completed. Commit the new firebase-config.js and push." -ForegroundColor Green
} else {
  Write-Host "`n $($script:failures.Count) step(s) need you:" -ForegroundColor Yellow
  $script:failures | ForEach-Object { Write-Host "   - $_" -ForegroundColor Yellow }
}
Write-Host "=================================================" -ForegroundColor Cyan
