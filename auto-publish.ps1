Param(
  [Parameter(Mandatory = $true)]
  [string]$Publisher,

  [Parameter(Mandatory = $true)]
  [string]$Repo,

  [switch]$SkipLogin
)

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $scriptDir

try {
  if (-not $env:VSCE_PAT -and -not $SkipLogin) {
    throw '未检测到 VSCE_PAT 环境变量。请先设置: $env:VSCE_PAT = "<your_pat>"'
  }

  Write-Host '步骤 1/4: 更新 package.json（publisher/repo/version）...' -ForegroundColor Cyan
  powershell -NoProfile -ExecutionPolicy Bypass -File .\publish-helper.ps1 -Publisher $Publisher -Repo $Repo

  Write-Host '步骤 2/4: 重新打包 VSIX...' -ForegroundColor Cyan
  npx @vscode/vsce package --allow-missing-repository --skip-license

  if (-not $SkipLogin) {
    Write-Host '步骤 3/4: 登录发布者...' -ForegroundColor Cyan
    $env:VSCE_PAT | npx @vscode/vsce login $Publisher
  } else {
    Write-Host '步骤 3/4: 已跳过登录（SkipLogin）...' -ForegroundColor Yellow
  }

  Write-Host '步骤 4/4: 发布到 Marketplace...' -ForegroundColor Cyan
  npx @vscode/vsce publish

  Write-Host '发布完成。' -ForegroundColor Green
}
finally {
  Pop-Location
}
