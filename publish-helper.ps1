Param(
  [string]$Publisher,
  [string]$Repo,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$packagePath = Join-Path $scriptDir 'package.json'

if (-not (Test-Path $packagePath)) {
  throw "未找到 package.json: $packagePath"
}

if ([string]::IsNullOrWhiteSpace($Publisher)) {
  $Publisher = Read-Host '请输入 Marketplace Publisher ID (例如 mypublisher)'
}

if ([string]::IsNullOrWhiteSpace($Repo)) {
  $Repo = Read-Host '请输入 GitHub 仓库 (格式 owner/repo)'
}

if ($Repo -notmatch '^[^/\s]+/[^/\s]+$') {
  throw 'GitHub 仓库格式错误，应为 owner/repo'
}

$ownerRepo = $Repo.Trim()
$repoUrl = "https://github.com/$ownerRepo"

$package = Get-Content $packagePath -Raw -Encoding UTF8 | ConvertFrom-Json

$package.publisher = $Publisher.Trim()
$package.homepage = $repoUrl
$package.bugs = @{ url = "$repoUrl/issues" }
$package.repository = @{ type = 'git'; url = "$repoUrl.git" }

# 每次准备发布时自动补丁递增，避免 publish 因版本重复失败。
$parts = $package.version.Split('.')
if ($parts.Count -ne 3) {
  throw "版本号格式异常: $($package.version)，期望 x.y.z"
}
$parts[2] = ([int]$parts[2] + 1).ToString()
$package.version = ($parts -join '.')

if (-not $DryRun) {
  $package | ConvertTo-Json -Depth 100 | Set-Content -Path $packagePath -Encoding UTF8
  Write-Host "已更新 package.json" -ForegroundColor Green
} else {
  Write-Host "DryRun: 未写入 package.json" -ForegroundColor Yellow
}
Write-Host "publisher: $($package.publisher)"
Write-Host "version:   $($package.version)"
Write-Host "homepage:  $($package.homepage)"
Write-Host ''
Write-Host '下一步命令:' -ForegroundColor Cyan
Write-Host "1) npx @vscode/vsce login $($package.publisher)"
Write-Host '2) npx @vscode/vsce package'
Write-Host '3) npx @vscode/vsce publish'
