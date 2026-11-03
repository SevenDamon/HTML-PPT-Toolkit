$ErrorActionPreference = 'Stop'
trap {
    Write-Host ''
    Write-Host ('运行失败：' + $_.Exception.Message) -ForegroundColor Red
    Read-Host '按回车关闭'
    exit 1
}

$toolkit = Split-Path -Parent $PSCommandPath
$portableNode = Join-Path (Split-Path -Parent $PSCommandPath) 'runtime\node\node.exe'
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$bundledNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
if (Test-Path -LiteralPath $portableNode) { $node = $portableNode }
elseif ($nodeCommand) { $node = $nodeCommand.Source }
elseif (Test-Path -LiteralPath $bundledNode) { $node = $bundledNode }
else { throw '未找到 Node.js。请先安装 Node.js 22 或更高版本（无需安装 Codex），然后重新打开工具箱。' }

& (Join-Path $toolkit 'scripts\build-launcher.ps1')
if ($LASTEXITCODE -ne 0) { throw '工具箱构建失败。' }

Write-Host '正在构建并同步 html-ppt-author Skill……'
& $node (Join-Path $toolkit 'scripts\build-skill.mjs') '--install'
if ($LASTEXITCODE -ne 0) { throw 'Skill 构建或同步失败。' }

Write-Host ''
Write-Host '完成：工具箱、Skill 构建包和已安装 Skill 已保持一致。' -ForegroundColor Green
Read-Host '按回车关闭'
