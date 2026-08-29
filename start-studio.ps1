param([string]$TargetFile)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($TargetFile)) {
    Add-Type -AssemblyName System.Windows.Forms
    $dialog = New-Object System.Windows.Forms.OpenFileDialog
    $dialog.Filter = 'HTML PPT (*.html)|*.html'
    $dialog.Title = '选择要编辑的 HTML PPT'
    if ($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { exit 0 }
    $TargetFile = $dialog.FileName
}

$source = (Resolve-Path -LiteralPath $TargetFile).Path
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$bundledNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
if ($nodeCommand) {
    $node = $nodeCommand.Source
} elseif (Test-Path -LiteralPath $bundledNode) {
    $node = $bundledNode
} else {
    Write-Host '未找到 Node.js。请先安装 Node.js，或在装有 Codex 桌面运行时的电脑上使用。' -ForegroundColor Red
    Read-Host '按回车关闭'
    exit 1
}

$server = Join-Path (Split-Path -Parent $PSCommandPath) 'studio\server.mjs'
Write-Host "正在打开：$source"
Write-Host '此窗口需要保持开启，关闭后源文件保存和 PDF/PPTX 导出将停止。'
Write-Host '编辑入口：课件画布右上角的橙色铅笔按钮。' -ForegroundColor Cyan
Write-Host ''
& $node $server '--file' $source
