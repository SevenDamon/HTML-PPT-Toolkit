param([string]$TargetFile)

$ErrorActionPreference = 'Stop'
trap {
    Write-Host ''
    Write-Host ('运行失败：' + $_.Exception.Message) -ForegroundColor Red
    Read-Host '按回车关闭'
    exit 1
}

if ([string]::IsNullOrWhiteSpace($TargetFile)) {
    Write-Host '正在打开 HTML 文件选择窗口……'
    Add-Type -AssemblyName System.Windows.Forms
    $dialog = New-Object System.Windows.Forms.OpenFileDialog
    $dialog.Filter = 'HTML PPT (*.html)|*.html'
    $dialog.Title = '选择要快速接入 Lite 编辑器的 HTML'
    if ($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
        Write-Host '没有选择文件。'
        Read-Host '按回车关闭'
        exit 0
    }
    $TargetFile = $dialog.FileName
}

$source = (Resolve-Path -LiteralPath $TargetFile).Path
$directory = [System.IO.Path]::GetDirectoryName($source)
$baseName = [System.IO.Path]::GetFileNameWithoutExtension($source)
$outputName = if ($baseName -match '_通用编辑版$') { $baseName + '_升级版.html' } else { $baseName + '_通用编辑版.html' }
$output = Join-Path $directory $outputName

if (Test-Path -LiteralPath $output) {
    Write-Host "已存在：$output" -ForegroundColor Yellow
    if ((Read-Host '是否覆盖？输入 Y 后回车') -notmatch '^[Yy]$') { exit 0 }
}

$portableNode = Join-Path (Split-Path -Parent $PSCommandPath) 'runtime\node\node.exe'
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$bundledNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
if (Test-Path -LiteralPath $portableNode) { $node = $portableNode }
elseif ($nodeCommand) {
    $node = $nodeCommand.Source
} elseif (Test-Path -LiteralPath $bundledNode) {
    $node = $bundledNode
} else {
    Write-Host '未找到 Node.js。请先安装 Node.js 22 或更高版本（无需安装 Codex），然后重新打开工具箱。' -ForegroundColor Red
    Read-Host '按回车关闭'
    exit 1
}

$toolkit = Split-Path -Parent $PSCommandPath
$installer = Join-Path $toolkit 'scripts\install-editor.mjs'
$checker = Join-Path $toolkit 'scripts\check-deck.mjs'


Write-Host "原文件：$source"
Write-Host "新文件：$output"
Write-Host ''

& $node $installer $source $output '--profile' 'lite' '--strip-legacy'
if ($LASTEXITCODE -ne 0) {
    Write-Host '转换失败，原文件没有被修改。' -ForegroundColor Red
    Read-Host '按回车关闭'
    exit 1
}

Write-Host ''
& $node $checker $output '--profile' 'lite'
$checkCode = $LASTEXITCODE
if ($checkCode -eq 0) {
    Write-Host 'Lite 编辑器已接入；可以编辑并另存 HTML。检查通过不代表所有内容均已验证。' -ForegroundColor Green
} elseif ($checkCode -eq 3) {
    Write-Host '编辑器已经安装，但原网页存在结构兼容风险。' -ForegroundColor Yellow
    Write-Host '这不等于转换失败；请重点实测翻页、页面比例和逐页导出。' -ForegroundColor Yellow
} else {
    Write-Host '已生成通用编辑版，但页面结构未通过兼容性检查。' -ForegroundColor Yellow
    Write-Host '工具栏已经接入，部分编辑、翻页或导出功能可能需要进一步迁移。' -ForegroundColor Yellow
}

Write-Host ''
Write-Host '此为规则自动接入，不保证所有内容都可编辑；复杂网页请使用 Skill + Agent 适配结构。' -ForegroundColor Yellow
Write-Host '需要保存到源 HTML 或导出 PDF/PPTX 时，使用工具箱第二项打开生成的文件。'

Write-Host "生成位置：$output"
Read-Host '按回车关闭'
