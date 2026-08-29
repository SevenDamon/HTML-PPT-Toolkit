$ErrorActionPreference = 'Stop'
$toolkit = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$source = Join-Path $toolkit 'launcher\HtmlPptToolkitLauncher.cs'
$output = Join-Path $toolkit 'HTML-PPT-Toolkit.exe'
$icon = Join-Path $toolkit 'launcher\html-ppt-toolkit.ico'
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $compiler)) {
    $compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe'
}
if (-not (Test-Path -LiteralPath $compiler)) { throw 'The .NET Framework C# compiler was not found.' }

Add-Type -AssemblyName System.Drawing
$bitmap = New-Object System.Drawing.Bitmap 64, 64
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([System.Drawing.Color]::Transparent)
$navy = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(23, 48, 71))
$cream = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(245, 239, 227))
$orange = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(215, 100, 50))
$teal = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(63, 133, 136))
$graphics.FillRectangle($navy, 3, 3, 58, 58)
$graphics.FillRectangle($cream, 12, 14, 40, 30)
$graphics.FillRectangle($orange, 12, 14, 40, 6)
$graphics.FillRectangle($navy, 18, 25, 21, 4)
$graphics.FillRectangle($navy, 18, 33, 27, 4)
$graphics.FillEllipse($teal, 39, 37, 16, 16)
$handle = $bitmap.GetHicon()
$appIcon = [System.Drawing.Icon]::FromHandle($handle)
$stream = [System.IO.File]::Create($icon)
$appIcon.Save($stream)
$stream.Dispose()
$graphics.Dispose()
$bitmap.Dispose()

& $compiler /nologo /target:winexe /optimize+ /win32icon:$icon /out:$output /reference:System.dll /reference:System.Drawing.dll /reference:System.Windows.Forms.dll $source
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $output)) { throw 'Failed to build HTML-PPT-Toolkit.exe.' }
Write-Host "Launcher built: $output"
