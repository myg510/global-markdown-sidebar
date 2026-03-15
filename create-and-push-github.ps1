Param(
  [string]$RepoName = "global-markdown-sidebar",
  [ValidateSet("private", "public")]
  [string]$Visibility = "public",
  [switch]$ForceRemote
)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $scriptDir

try {
  $token = $env:GITHUB_TOKEN
  if (-not $token) { $token = $env:GH_TOKEN }
  if (-not $token) {
    throw "Missing GITHUB_TOKEN or GH_TOKEN in current PowerShell session."
  }

  $headers = @{
    Authorization = "Bearer $token"
    Accept = "application/vnd.github+json"
    "User-Agent" = "global-markdown-sidebar-publisher"
  }

  $me = Invoke-RestMethod -Method Get -Uri "https://api.github.com/user" -Headers $headers
  $owner = $me.login
  Write-Host "GitHub user: $owner" -ForegroundColor Cyan

  $repoApi = "https://api.github.com/repos/$owner/$RepoName"
  $repoExists = $false
  try {
    $null = Invoke-RestMethod -Method Get -Uri $repoApi -Headers $headers
    $repoExists = $true
  } catch {
    $repoExists = $false
  }

  if (-not $repoExists) {
    $body = @{
      name = $RepoName
      private = ($Visibility -eq "private")
      description = "VS Code extension: Global Markdown Sidebar"
      has_issues = $true
      has_wiki = $false
      auto_init = $false
    } | ConvertTo-Json

    $created = Invoke-RestMethod -Method Post -Uri "https://api.github.com/user/repos" -Headers $headers -Body $body
    Write-Host "Repository created: $($created.html_url)" -ForegroundColor Green
  } else {
    Write-Host "Repository exists: https://github.com/$owner/$RepoName" -ForegroundColor Yellow
  }

  $remoteUrl = "https://github.com/$owner/$RepoName.git"

  $hasOrigin = $false
  $originUrl = ""
  try {
    $originUrl = git remote get-url origin 2>$null
    if ($originUrl) { $hasOrigin = $true }
  } catch {
    $hasOrigin = $false
  }

  if ($hasOrigin) {
    if ($ForceRemote) {
      git remote set-url origin $remoteUrl
      Write-Host "Updated origin: $remoteUrl" -ForegroundColor Cyan
    } else {
      Write-Host "Origin already set: $originUrl" -ForegroundColor Yellow
      Write-Host "Use -ForceRemote to overwrite origin." -ForegroundColor Yellow
    }
  } else {
    git remote add origin $remoteUrl
    Write-Host "Added origin: $remoteUrl" -ForegroundColor Cyan
  }

  git push -u origin main
  Write-Host "Push completed: https://github.com/$owner/$RepoName" -ForegroundColor Green
}
finally {
  Pop-Location
}
