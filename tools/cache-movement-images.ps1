param(
  [int]$Limit = 12
)

$ErrorActionPreference = 'Stop'
$Root = Resolve-Path (Join-Path $PSScriptRoot '..')
$MovementDir = Join-Path $Root 'data\미술사조'
$ImageDir = Join-Path $MovementDir 'images'
$ManifestPath = Join-Path $ImageDir 'index.json'
New-Item -ItemType Directory -Force -Path $ImageDir | Out-Null

function Get-Manifest {
  if (Test-Path -LiteralPath $ManifestPath) {
    return Get-Content -Raw -LiteralPath $ManifestPath | ConvertFrom-Json
  }
  return [pscustomobject]@{ schema = 1; cachedAt = $null; images = [pscustomobject]@{}; failures = @() }
}

function Save-Manifest($Manifest) {
  $Manifest.cachedAt = (Get-Date).ToUniversalTime().ToString('o')
  $Manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $ManifestPath -Encoding utf8
}

function Get-Sha12([string]$Value) {
  $sha = [System.Security.Cryptography.SHA256]::Create()
  $bytes = [Text.Encoding]::UTF8.GetBytes($Value)
  -join ($sha.ComputeHash($bytes)[0..5] | ForEach-Object { $_.ToString('x2') })
}

function Get-SafeSlug([string]$Url) {
  $decoded = [Uri]::UnescapeDataString(($Url -replace '\?.*$', ''))
  $leaf = Split-Path ([Uri]$decoded).AbsolutePath -Leaf
  $leaf = $leaf -replace '\.[a-zA-Z0-9]{2,5}$', ''
  $slug = $leaf.Normalize([Text.NormalizationForm]::FormKD) -replace '[^a-zA-Z0-9가-힣]+', '-'
  $slug = $slug.Trim('-')
  if (-not $slug) { $slug = 'image' }
  if ($slug.Length -gt 70) { $slug = $slug.Substring(0, 70).Trim('-') }
  return $slug
}

function Get-DownloadUrl([string]$Url) {
  $builder = [UriBuilder]$Url
  if ($builder.Host -match '(^|\.)wikimedia\.org$|(^|\.)wikipedia\.org$' -and $builder.Path -match '/wiki/Special:FilePath/') {
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

$manifest = Get-Manifest
if (-not $manifest.images) { $manifest | Add-Member -NotePropertyName images -NotePropertyValue ([pscustomobject]@{}) }
$imageMap = @{}
$manifest.images.PSObject.Properties | ForEach-Object { $imageMap[$_.Name] = $_.Value }
$failureMap = @{}
@($manifest.failures) | ForEach-Object { if ($_.url) { $failureMap[$_.url] = $_.error } }

$urls = [System.Collections.Generic.List[string]]::new()
foreach ($file in Get-ChildItem -LiteralPath $MovementDir -Filter '*.html') {
  $html = Get-Content -Raw -LiteralPath $file.FullName
  foreach ($match in [regex]::Matches($html, '<img\b[^>]*\bsrc=["'']([^"'']+)["'']')) {
    $src = $match.Groups[1].Value
    if ($src -match '^https?://' -and -not $urls.Contains($src)) { $urls.Add($src) }
  }
}

foreach ($key in @($failureMap.Keys)) {
  if (-not $urls.Contains($key)) { $failureMap.Remove($key) }
}

$attempted = 0
$cached = 0
foreach ($url in $urls) {
  if ($imageMap.ContainsKey($url)) {
    $localPath = Join-Path $MovementDir ([string]$imageMap[$url].local)
    if (Test-Path -LiteralPath $localPath) { continue }
  }
  if (($failureMap[$url] -as [string]) -match 'HTTP 404') { continue }
  if ($Limit -gt 0 -and $attempted -ge $Limit) { break }
  $attempted++

  $downloadUrl = Get-DownloadUrl $url
  $temp = Join-Path $ImageDir ("download-" + [guid]::NewGuid().ToString('n') + ".tmp")
  try {
    $response = $null
    for ($try = 1; $try -le 4; $try++) {
      try {
        Start-Sleep -Seconds 4
        $response = Invoke-WebRequest -UseBasicParsing -Uri $downloadUrl -OutFile $temp -PassThru -MaximumRedirection 5 -TimeoutSec 60 -Headers @{'User-Agent'='ArtAtlasLocalImageCache/1.0'}
        break
      } catch {
        $status = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 }
        if ($status -ne 429 -or $try -eq 4) { throw }
        Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds (12 * $try)
      }
    }
    $ext = Get-Extension $response $downloadUrl
    $local = "images/$(Get-SafeSlug $url)-$(Get-Sha12 $url).$ext"
    $target = Join-Path $MovementDir $local
    Move-Item -Force -LiteralPath $temp -Destination $target
    $imageMap[$url] = [pscustomobject]@{
      local = $local
      source = $url
      downloadUrl = $downloadUrl
      finalUrl = [string]$response.BaseResponse.ResponseUri
      contentType = [string]($response.Headers['Content-Type'] | Select-Object -First 1)
      bytes = (Get-Item -LiteralPath $target).Length
      cachedAt = (Get-Date).ToUniversalTime().ToString('o')
    }
    $failureMap.Remove($url)
    $cached++
    Write-Output "cached $local"
  } catch {
    Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue
    $message = $_.Exception.Message
    if ($_.Exception.Response) { $message = "HTTP $([int]$_.Exception.Response.StatusCode): $message" }
    $failureMap[$url] = $message
    Write-Output "failed $url : $message"
  }

  $manifest.images = [pscustomobject]$imageMap
  $manifest.failures = @($failureMap.GetEnumerator() | Where-Object { $urls.Contains($_.Key) } | ForEach-Object { [pscustomobject]@{ url = $_.Key; error = $_.Value } })
  Save-Manifest $manifest
}

$manifest.images = [pscustomobject]$imageMap
$manifest.failures = @($failureMap.GetEnumerator() | Where-Object { $urls.Contains($_.Key) } | ForEach-Object { [pscustomobject]@{ url = $_.Key; error = $_.Value } })
Save-Manifest $manifest

$env:ART_ATLAS_REWRITE_ONLY = '1'
try {
  node (Join-Path $PSScriptRoot 'cache-movement-images.js') | Write-Output
} finally {
  Remove-Item Env:\ART_ATLAS_REWRITE_ONLY -ErrorAction SilentlyContinue
}

Write-Output (@{
  attempted = $attempted
  cached = $cached
  manifestImages = $imageMap.Count
  failures = $failureMap.Count
} | ConvertTo-Json -Compress)
