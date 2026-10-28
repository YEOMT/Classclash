param([Parameter(Mandatory=$true)][string]$Archive)
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$archivePath = (Resolve-Path -LiteralPath $Archive).Path
Add-Type -AssemblyName System.IO.Compression
$stream = [IO.File]::OpenRead($archivePath)
$zip = [IO.Compression.ZipArchive]::new($stream,[IO.Compression.ZipArchiveMode]::Read)
try {
 $names = @($zip.Entries | ForEach-Object { $_.FullName })
 $unsafe = @($names | Where-Object { $_ -match '^(data|node_modules|\.tools|\.git|deploy/secrets)/' -or $_ -match '\.(sqlite(?:-wal|-shm)?|db|pem|key)$' -or ($_ -match '(^|/)\.env' -and $_ -ne '.env.example') })
 if ($unsafe.Count) { throw ('Excluded private/runtime paths in ZIP: ' + ($unsafe -join ', ')) }
 $sourceLock = Get-Content -Raw -LiteralPath (Join-Path $projectRoot 'assets/art-source/source-lock.json') | ConvertFrom-Json
 $checked = 0
 foreach ($property in $sourceLock.files.PSObject.Properties) {
  $entry = $zip.GetEntry($property.Name)
  if ($null -eq $entry) { throw ('Missing preserved source: ' + $property.Name) }
  $entryStream = $entry.Open(); $sha = [Security.Cryptography.SHA256]::Create()
  try { $digest = [Convert]::ToHexString($sha.ComputeHash($entryStream)).ToLowerInvariant() } finally { $entryStream.Dispose(); $sha.Dispose() }
  if ($digest -ne $property.Value) { throw ('Source hash mismatch: ' + $property.Name) }
  $checked++
 }
 foreach ($required in @('package-lock.json','README.md','TEST_REPORT.md','PROGRESS.md','src/server/index.ts','src/client/main.ts','DEPLOYMENT_REPORT.json','docs/class-clash-0.2/tests/ACCEPTANCE.results.csv')) { if ($null -eq $zip.GetEntry($required)) { throw ('Missing project file: ' + $required) } }
 $result = [ordered]@{ status='PASS'; archive=$archivePath; sha256=(Get-FileHash -Algorithm SHA256 -LiteralPath $archivePath).Hash.ToLowerInvariant(); entries=$names.Count; originalSourceHashesChecked=$checked; excludedFilesFound=$unsafe.Count; videos=@($names | Where-Object { $_ -match '^artifacts/v02/.*\.(webm|mp4)$' }); checkedAt=[DateTime]::UtcNow.ToString('o') }
 $result | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 (Join-Path $projectRoot 'artifacts/v02/local-package-audit.json')
 $result | ConvertTo-Json -Depth 5
} finally { $zip.Dispose(); $stream.Dispose() }
