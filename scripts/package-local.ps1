param([string]$OutputName = ('Class_Clash_0.2_Local_' + (Get-Date -Format 'yyyyMMdd_HHmmss') + '.zip'))
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if ([IO.Path]::GetFileName($OutputName) -ne $OutputName -or -not $OutputName.EndsWith('.zip')) { throw 'OutputName must be a ZIP filename in the project root.' }
$outputPath = Join-Path $projectRoot $OutputName
if (Test-Path -LiteralPath $outputPath) { throw 'Refusing to overwrite an existing preservation archive.' }
$listed = @(& git -c core.quotepath=false -C $projectRoot ls-files -c -o --exclude-standard)
if ($LASTEXITCODE -ne 0) { throw 'Git file inventory failed.' }
$videoRoot = Join-Path $projectRoot 'artifacts/v02'
if (Test-Path -LiteralPath $videoRoot) { $listed += @(Get-ChildItem -LiteralPath $videoRoot -Recurse -File | Where-Object { $_.Extension -in '.webm','.mp4' } | ForEach-Object { [IO.Path]::GetRelativePath($projectRoot,$_.FullName).Replace('\','/') }) }
$files = @($listed | Sort-Object -Unique | Where-Object { $_ -notmatch '^(data|node_modules|\.tools|\.git|\.local-asset-backups|deploy/secrets)/' -and $_ -notmatch '\.(sqlite(?:-wal|-shm)?|db|pem|key|bundle|zip)$' -and ($_ -notmatch '(^|/)\.env' -or $_ -eq '.env.example') -and (Test-Path -LiteralPath (Join-Path $projectRoot $_) -PathType Leaf) })
Add-Type -AssemblyName System.IO.Compression
$stream = [IO.File]::Open($outputPath,[IO.FileMode]::CreateNew)
$zip = [IO.Compression.ZipArchive]::new($stream,[IO.Compression.ZipArchiveMode]::Create)
try {
 foreach ($relative in $files) { $absolute = Join-Path $projectRoot $relative; $entry = $zip.CreateEntry($relative.Replace('\','/'),[IO.Compression.CompressionLevel]::Optimal); $dest = $entry.Open(); $input = [IO.File]::OpenRead($absolute); try { $input.CopyTo($dest) } finally { $input.Dispose(); $dest.Dispose() } }
} finally { $zip.Dispose(); $stream.Dispose() }
$hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $outputPath).Hash.ToLowerInvariant()
$result = [ordered]@{ path=$outputPath; files=$files.Count; bytes=(Get-Item -LiteralPath $outputPath).Length; sha256=$hash; purpose='Private school-use full source/assets and local evidence; no database, secrets or dependencies'; }
$result | ConvertTo-Json | Set-Content -Encoding utf8 (Join-Path $projectRoot ($OutputName + '.json'))
$result | ConvertTo-Json
