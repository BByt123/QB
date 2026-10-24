param(
    [string]$ResourcePath = '',
    [string]$OutputPath = ''
)

$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if (-not $ResourcePath) { $ResourcePath = Join-Path $root '../Econ resources/Pearson by topic' }
if (-not $OutputPath) { $OutputPath = Join-Path $root 'bank/economics/files' }
$ResourcePath = [IO.Path]::GetFullPath($ResourcePath)
$OutputPath = [IO.Path]::GetFullPath($OutputPath)
New-Item -ItemType Directory -Force -Path $OutputPath | Out-Null

$word = $null
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $word.AutomationSecurity = 3
    foreach ($file in Get-ChildItem -LiteralPath $ResourcePath -File -Filter '*.doc' | Sort-Object Name) {
        $target = Join-Path $OutputPath ($file.BaseName + '.docx')
        $document = $null
        try {
            Write-Output "Converting $($file.Name)"
            $document = $word.Documents.Open($file.FullName, $false, $true, $false, '', '', $false, '', '', 0, 0, $false, $true, 0, $true)
            $document.SaveAs2($target, 16)
        } finally {
            if ($null -ne $document) {
                $document.Close(0)
                [void][Runtime.InteropServices.Marshal]::ReleaseComObject($document)
            }
        }
        if (-not (Test-Path -LiteralPath $target)) { throw "Word did not create $target" }
    }
} catch {
    throw "Economics Word conversion requires an interactive Microsoft Word session. $($_.Exception.Message)"
} finally {
    if ($null -ne $word) {
        $word.Quit(0)
        [void][Runtime.InteropServices.Marshal]::ReleaseComObject($word)
    }
}
Write-Output "Converted Economics DOC files to DOCX in $OutputPath"
