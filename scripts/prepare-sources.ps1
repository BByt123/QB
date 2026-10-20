param([string]$ResourcePath = '', [switch]$SkipWord)
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if (-not $ResourcePath) {
    $ResourcePath = Join-Path $root 'resources'
    if (-not (Test-Path -LiteralPath $ResourcePath)) { $ResourcePath = Join-Path $root '../resources' }
}
$ResourcePath = [IO.Path]::GetFullPath($ResourcePath)
$sources = Join-Path $root 'bank/sources'
$temp = Join-Path $root 'tmp/extracted'
New-Item -ItemType Directory -Force -Path $sources,$temp | Out-Null
$seen = @{}
$catalog = [Collections.Generic.List[object]]::new()
Add-Type -AssemblyName System.IO.Compression.FileSystem
function Expand-BankZip([string]$file, [string]$destination, [int]$depth) {
    if ($depth -gt 4) { return }
    [IO.Compression.ZipFile]::ExtractToDirectory($file, $destination, $true)
    foreach ($nested in Get-ChildItem -LiteralPath $destination -Recurse -File -Filter '*.zip') {
        Expand-BankZip $nested.FullName ($nested.FullName + '_content') ($depth + 1)
    }
}
foreach ($archive in Get-ChildItem -LiteralPath $ResourcePath -Recurse -File -Filter '*.zip') {
    $hash = (Get-FileHash -LiteralPath $archive.FullName -Algorithm SHA256).Hash.Substring(0,12)
    $dest = Join-Path $temp $hash
    if (-not (Test-Path -LiteralPath $dest)) { Expand-BankZip $archive.FullName $dest 0 }
}
$files = @((Get-ChildItem -LiteralPath $ResourcePath -Recurse -File)) + @((Get-ChildItem -LiteralPath $temp -Recurse -File))
$word = $null
try {
    foreach ($file in $files | Where-Object { $_.Extension -in '.pdf','.doc','.docx' -and (-not $SkipWord -or $_.Extension -eq '.pdf') } | Sort-Object @{Expression={if ($_.Extension -eq '.pdf') {0} else {1}}},FullName) {
        $hash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLower()
        if ($seen.ContainsKey($hash)) { continue }
        $seen[$hash] = $true
        $id = $hash.Substring(0,16)
        $out = Join-Path $sources ($id + '.pdf')
        if (-not (Test-Path -LiteralPath $out)) {
            if ($file.Extension -eq '.pdf') { Copy-Item -LiteralPath $file.FullName -Destination $out }
            else {
                if ($null -eq $word) {
                    $word = New-Object -ComObject Word.Application
                    $word.Visible = $false
                    $word.DisplayAlerts = 0
                    $word.AutomationSecurity = 3
                }
                Write-Output "Converting $($file.Name)"
                $document = $null
                try {
                    $document = $word.Documents.Open($file.FullName, $false, $true, $false, '', '', $false, '', '', 0, 0, $false, $true, 0, $true)
                    $document.ExportAsFixedFormat($out, 17)
                } finally {
                    if ($null -ne $document) { $document.Close(0); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($document) }
                }
            }
        }
        $publisher = if ($file.FullName -match 'Oxford') { 'Oxford' } else { 'Aristo' }
        $catalog.Add([ordered]@{id=$id; name=$file.Name; original=[IO.Path]::GetRelativePath($root,$file.FullName).Replace('\','/'); publisher=$publisher; path="bank/sources/$id.pdf"})
        $catalog | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $root 'bank/sources.json') -Encoding utf8
    }
} finally {
    if ($null -ne $word) { $word.Quit(0); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($word) }
}
Write-Output "Prepared $($catalog.Count) unique sources"
