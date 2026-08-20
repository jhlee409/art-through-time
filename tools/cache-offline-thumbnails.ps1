param(
  [string]$Server = 'http://127.0.0.1:4173',
  [switch]$OnlyWithOriginalImage,
  [switch]$ExternalOnly,
  [int]$DelaySeconds = 0
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$artistsPath = Join-Path $root 'data\artists.json'
$thumbnailRoot = Join-Path $root 'data\thumbnails'
$logPath = Join-Path $root 'logs\offline-thumbnail-cache.out.log'
Start-Transcript -LiteralPath $logPath -Append | Out-Null

function Get-LocalThumbnailPath($artist, $work) {
  $indexPath = Join-Path (Join-Path $thumbnailRoot $artist.id) 'index.json'
  if (-not (Test-Path -LiteralPath $indexPath)) { return '' }
  try {
    $index = Get-Content -LiteralPath $indexPath -Raw | ConvertFrom-Json
    $entry = $index.PSObject.Properties[[string]$work.id].Value
    $relative = [string]$entry.thumbnail
    if ($relative -and -not ($relative -match '^https?://') -and (Test-Path -LiteralPath (Join-Path $root $relative))) {
      return $relative
    }
    return ''
  } catch {
    return ''
  }
}

function Save-Catalogue($catalogue) {
  $temporaryPath = "$artistsPath.$PID.tmp"
  $json = $catalogue | ConvertTo-Json -Depth 32
  [System.IO.File]::WriteAllText($temporaryPath, $json + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))
  Move-Item -LiteralPath $temporaryPath -Destination $artistsPath -Force
}

$completed = 0
$failed = 0
try {
  $catalogue = Get-Content -LiteralPath $artistsPath -Raw | ConvertFrom-Json
  $pending = foreach ($artist in $catalogue.artists) {
    foreach ($work in $artist.works) {
      if ($OnlyWithOriginalImage -and -not $work.image) { continue }
      $existing = Get-LocalThumbnailPath $artist $work
      if ($existing) {
        if ([string]$work.thumbnail -ne $existing) {
          $work.thumbnail = $existing
          $work.thumbnailValidation = 2
        }
        continue
      }
      if ($ExternalOnly -and -not ([string]$work.thumbnail -match '^https?://')) { continue }
      [pscustomobject]@{ Artist = $artist; Work = $work }
    }
  }

  Save-Catalogue $catalogue

  Write-Output "Offline thumbnail cache started: $($pending.Count) item(s)."
  foreach ($item in $pending) {
    $completed++
    $title = [string]$item.Work.title.ko
    if (-not $title) { $title = [string]$item.Work.title.en }
    if (-not $title) { $title = [string]$item.Work.id }
    try {
      $body = @{ artist = $item.Artist; work = $item.Work } | ConvertTo-Json -Depth 24 -Compress
      $response = Invoke-RestMethod -Uri "$Server/api/thumbnail" -Method Post -ContentType 'application/json; charset=utf-8' -Body $body -TimeoutSec 90
      if (-not $response.thumbnail) { throw 'No local thumbnail path returned' }
      $item.Work.thumbnail = [string]$response.thumbnail
      $item.Work.thumbnailValidation = 2
      Save-Catalogue $catalogue
      Write-Output "[$completed/$($pending.Count)] saved: $title"
    } catch {
      $failed++
      Write-Output "[$completed/$($pending.Count)] failed: $title :: $($_.Exception.Message)"
    }
    if ($DelaySeconds -gt 0 -and $completed -lt $pending.Count) { Start-Sleep -Seconds $DelaySeconds }
  }
  Write-Output "Offline thumbnail cache finished: saved=$($completed - $failed), failed=$failed."
} finally {
  Stop-Transcript | Out-Null
}
