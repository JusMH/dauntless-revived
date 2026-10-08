[CmdletBinding()]
param(
    [string]$Root = 'C:\DauntlessGermany',
    [string]$SourceHost,
    [string]$SourceRoot = 'C:\DauntlessRevived',
    [string]$IdentityFile
)
$ErrorActionPreference = 'Stop'
if (!$SourceHost -or !$IdentityFile) { throw 'SourceHost and IdentityFile are required' }
$dest = Join-Path $Root 'backups'
New-Item -ItemType Directory -Force $dest | Out-Null
$lock = [IO.File]::Open((Join-Path $dest 'weekly.lock'),'OpenOrCreate','ReadWrite','None')
try {
    $source = $SourceRoot.Replace("'","''")
    $script = @"
`$ErrorActionPreference='Stop';`$ProgressPreference='SilentlyContinue'
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File '$source/bin/Backup-DauntlessServer.ps1' -Root '$source' | Out-Null
if(`$LASTEXITCODE){throw 'Source backup failed'}
`$db=Get-ChildItem '$source/backups' -Directory | Where-Object {`$_.Name -match '^\d{4}-\d{2}-\d{2}_\d{6}$'} | Sort-Object Name -Descending | ForEach-Object {Get-Item (Join-Path `$_.FullName 'undaunted.db') -ErrorAction SilentlyContinue} | Where-Object {`$_.Length -gt 0 -and `$_.LastWriteTimeUtc -gt [DateTime]::UtcNow.AddHours(-2)} | Select-Object -First 1
if(!`$db){throw 'No fresh database backup'}
@{path=`$db.FullName.Replace('\','/');hash=(Get-FileHash `$db.FullName -Algorithm SHA256).Hash} | ConvertTo-Json -Compress
"@
    $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($script))
    $knownHosts = Join-Path $Root 'keys/known_hosts'
    $result = & ssh.exe -o BatchMode=yes -o ServerAliveInterval=15 -o ServerAliveCountMax=3 -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$knownHosts" -o ConnectTimeout=15 -i $IdentityFile "Administrator@$SourceHost" powershell -NoProfile -EncodedCommand $encoded
    if ($LASTEXITCODE) { throw 'Source backup request failed' }
    $info = ($result -join "`n") | ConvertFrom-Json
    if ($info.hash -notmatch '^[A-Fa-f0-9]{64}$' -or $info.path -notmatch '/backups/\d{4}-\d{2}-\d{2}_\d{6}/undaunted\.db$') { throw 'Invalid source backup metadata' }
    $name = 'undaunted-' + [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss') + '.db'
    $partial = Join-Path $dest ($name+'.partial')
    & scp.exe -q -o BatchMode=yes -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$knownHosts" -o ConnectTimeout=15 -i $IdentityFile "Administrator@${SourceHost}:$($info.path)" $partial
    if ($LASTEXITCODE) { throw 'Database transfer failed' }
    if ((Get-FileHash $partial -Algorithm SHA256).Hash -ne $info.hash) { throw 'Transferred database hash mismatch' }
    $verifier = Join-Path $Root 'Verify-Backup.mjs'
    'import {DatabaseSync} from "node:sqlite"; const d=new DatabaseSync(process.argv[2],{readOnly:true});if(d.prepare("PRAGMA quick_check").get().quick_check!=="ok")throw Error("Database check failed");d.close();' | Set-Content $verifier -Encoding ascii
    & 'C:\Program Files\nodejs\node.exe' $verifier $partial
    if ($LASTEXITCODE) { throw 'Transferred database integrity check failed' }
    Move-Item -LiteralPath $partial -Destination (Join-Path $dest $name)
    @{at=[DateTime]::UtcNow.ToString('o');file=$name;sha256=$info.hash;verified=$true} | ConvertTo-Json | Set-Content (Join-Path $dest 'last-success.json')
    Write-Output "Verified weekly database backup: $name"
} finally { $lock.Dispose() }
