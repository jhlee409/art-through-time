param(
  [int]$Limit = 30
)

$ErrorActionPreference = 'Stop'
$Root = Resolve-Path (Join-Path $PSScriptRoot '..')
$ArtistsPath = Join-Path $Root 'data\artists.json'
$ThumbnailRoot = Join-Path $Root 'data\thumbnails'
$Artists = Get-Content -Raw -LiteralPath $ArtistsPath | ConvertFrom-Json

function Test-External([string]$Value) {
  return $Value -match '^https?://'
}

function Get-DownloadUrl([string]$Url) {
  $builder = [UriBuilder]($Url -replace '^http://', 'https://')
  if ($builder.Host -match '(^|\.)wikimedia\.org$|(^|\.)wikipedia\.org$' -and $builder.Path -match '/wiki/Special:FilePath/' -and -not $builder.Query.Contains('width=')) {
    $query = [System.Web.HttpUtility]::ParseQueryString($builder.Query)
    $query.Set('width', '640')
    $builder.Query = $query.ToString()
  }
  return $builder.Uri.AbsoluteUri
}

function Get-Extension($Response, [string]$Url) {
  $contentType = [string]($Response.Headers['Content-Type'] | Select-Object -First 1)
  if ($contentType -match 'image/jpeg|image/jpg') { return 'jpg' }
  if ($contentType -match 'image/png') { return 'png' }
  if ($contentType -match 'image/webp') { return 'webp' }
  if ($contentType -match 'image/gif') { return 'gif' }
  $path = ([Uri]$Url).AbsolutePath
  if ($path -match '\.([a-zA-Z0-9]{2,5})$') { return $matches[1].ToLower().Replace('jpeg', 'jpg') }
  return 'jpg'
}

function Find-Existing([string]$Folder, [string]$WorkId) {
  foreach ($ext in @('jpg','jpeg','png','webp','gif')) {
    $file = Join-Path $Folder "$WorkId.$ext"
    if (Test-Path -LiteralPath $file) { return $file }
  }
  return ''
}

$attempted = 0
$cached = 0
$failed = 0

foreach ($artist in @($Artists.artists)) {
  $artistId = [string]$artist.id
  if (-not $artistId) { continue }
  $folder = Join-Path $ThumbnailRoot $artistId
  New-Item -ItemType Directory -Force -Path $folder | Out-Null

  foreach ($work in @($artist.works)) {
    $thumb = [string]$work.thumbnail
    if ($thumb -and -not (Test-External $thumb)) { continue }
    if (Find-Existing $folder ([string]$work.id)) { continue }

    $source = ''
    if (Test-External $thumb) { $source = $thumb }
    elseif (Test-External ([string]$work.image)) { $source = [string]$work.image }
    if (-not $source) { continue }
    if ($Limit -gt 0 -and $attempted -ge $Limit) { break }
    $attempted++

    $downloadUrl = Get-DownloadUrl $source
    $temp = Join-Path $folder ("download-" + [guid]::NewGuid().ToString('n') + ".tmp")
    try {
      Start-Sleep -Seconds 4
      $response = Invoke-WebRequest -UseBasicParsing -Uri $downloadUrl -OutFile $temp -PassThru -MaximumRedirection 5 -TimeoutSec 60 -Headers @{'User-Agent'='ArtAtlasLocal/1.0 (offline thumbnail cache)'}
      $ext = Get-Extension $response $downloadUrl
      $target = Join-Path $folder "$($work.id).$ext"
      Move-Item -Force -LiteralPath $temp -Destination $target
      $cached++
      Write-Output "cached $target"
    } catch {
      Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue
      $failed++
      $message = $_.Exception.Message
      if ($_.Exception.Response) { $message = "HTTP $([int]$_.Exception.Response.StatusCode): $message" }
      Write-Output "failed $artistId/$($work.id): $message"
    }
  }
  if ($Limit -gt 0 -and $attempted -ge $Limit) { break }
}

Write-Output (@{attempted=$attempted; cached=$cached; failed=$failed} | ConvertTo-Json -Compress)
