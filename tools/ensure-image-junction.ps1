$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$junctionPath = Join-Path $projectRoot 'data\images'
$targetCandidates = @(
  'C:\Users\admin\OneDrive - UOU\AI-Programming\Art_through_Time\data\images',
  'C:\Users\jhlee\OneDrive - UOU\AI-Programming\Art_through_Time\data\images'
)

$item = Get-Item -LiteralPath $junctionPath -Force -ErrorAction SilentlyContinue
if ($null -ne $item) {
  if ($item.LinkType -eq 'Junction') {
    Write-Output "Image Junction: $junctionPath -> $($item.Target)"
    exit 0
  }
  throw "data\images exists but is not a Junction: $junctionPath"
}

$target = $targetCandidates | Where-Object { Test-Path -LiteralPath $_ -PathType Container } | Select-Object -First 1
if (-not $target) {
  throw "No OneDrive image folder was found. Checked: $($targetCandidates -join '; ')"
}

New-Item -ItemType Junction -Path $junctionPath -Target $target | Out-Null
Write-Output "Image Junction created: $junctionPath -> $target"
