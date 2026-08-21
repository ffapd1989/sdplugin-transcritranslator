# Generates the plugin's static PNGs (the Stream Deck catalogue and the key's initial
# state).
#
# The key IN USE does not use these files — it is drawn as SVG at runtime
# (src/lib/icons.ts). These PNGs are what shows up BEFORE the plugin runs: the category
# icon, the action icon in the list and the key's initial image.
#
# The microphone drawing here is the same as the SVG's. When you touch the visuals, touch
# both.
#
# Run it with Windows PowerShell 5.1:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\render-images.ps1

Add-Type -AssemblyName System.Drawing

$root = Join-Path $PSScriptRoot "com.felipe.transcritranslator.sdPlugin\imgs"
function Ensure($d) { if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null } }
Ensure (Join-Path $root "states")
Ensure (Join-Path $root "action")
Ensure (Join-Path $root "plugin")

# A positive factor lightens, a negative one darkens. Always call it with the factor in
# parentheses: loose, the PowerShell parser reads "-0.42" as a parameter name.
function Mix-Channel([int]$c, [double]$f) {
    $v = if ($f -ge 0) { $c + (255 - $c) * $f } else { $c * (1 + $f) }
    [int][Math]::Max(0, [Math]::Min(255, [Math]::Round($v)))
}

function Get-Shade([string]$hex) {
    $r = [Convert]::ToInt32($hex.Substring(1,2),16)
    $g = [Convert]::ToInt32($hex.Substring(3,2),16)
    $b = [Convert]::ToInt32($hex.Substring(5,2),16)
    @{
        lite   = [System.Drawing.Color]::FromArgb((Mix-Channel $r (0.22)),  (Mix-Channel $g (0.22)),  (Mix-Channel $b (0.22)))
        base   = [System.Drawing.Color]::FromArgb($r, $g, $b)
        border = [System.Drawing.Color]::FromArgb((Mix-Channel $r (-0.42)), (Mix-Channel $g (-0.42)), (Mix-Channel $b (-0.42)))
    }
}

# A centred microphone, proportional to the image size (coordinates on a 72x72 grid).
function Add-Mic($g, [single]$s) {
    $k = $s / 72.0
    $white = [System.Drawing.Brushes]::White
    $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::White), ([single](3 * $k))
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap   = [System.Drawing.Drawing2D.LineCap]::Round

    # Capsule
    $capsule = New-Object System.Drawing.Drawing2D.GraphicsPath
    $r = 6 * $k
    $capsule.AddArc([single](30*$k), [single](12*$k), [single]($r*2), [single]($r*2), 180, 180)
    $capsule.AddArc([single](30*$k), [single](21*$k), [single]($r*2), [single]($r*2), 0, 180)
    $capsule.CloseFigure()
    $g.FillPath($white, $capsule)
    $capsule.Dispose()

    # Arc, stem and base
    $g.DrawArc($pen, [single](25*$k), [single](17*$k), [single](22*$k), [single](22*$k), 0, 180)
    $g.DrawLine($pen, [single](36*$k), [single](39*$k), [single](36*$k), [single](45*$k))
    $g.DrawLine($pen, [single](29*$k), [single](45*$k), [single](43*$k), [single](45*$k))
    $pen.Dispose()
}

function Save-Key([int]$size, [string]$hex, [string]$path) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode   = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    $c = Get-Shade $hex
    $k = $size / 72.0
    $inset = 2.5 * $k
    $side = $size - 2 * $inset
    $rad = 13 * $k

    $rect = New-Object System.Drawing.Drawing2D.GraphicsPath
    $rect.AddArc([single]$inset, [single]$inset, [single]($rad*2), [single]($rad*2), 180, 90)
    $rect.AddArc([single]($inset+$side-$rad*2), [single]$inset, [single]($rad*2), [single]($rad*2), 270, 90)
    $rect.AddArc([single]($inset+$side-$rad*2), [single]($inset+$side-$rad*2), [single]($rad*2), [single]($rad*2), 0, 90)
    $rect.AddArc([single]$inset, [single]($inset+$side-$rad*2), [single]($rad*2), [single]($rad*2), 90, 90)
    $rect.CloseFigure()

    $grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush (New-Object System.Drawing.Rectangle 0,0,$size,$size), $c.lite, $c.base, ([System.Drawing.Drawing2D.LinearGradientMode]::Vertical)
    $g.FillPath($grad, $rect)
    $pen = New-Object System.Drawing.Pen $c.border, ([single][Math]::Max(1.0, 2.5*$k))
    $g.DrawPath($pen, $rect)

    Add-Mic $g $size

    $g.Dispose(); $grad.Dispose(); $pen.Dispose(); $rect.Dispose()
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "  $path"
}

# The key's initial state (graphite grey, the same as the "idle" default).
Save-Key 72  '#404650' (Join-Path $root "states\idle.png")
Save-Key 144 '#404650' (Join-Path $root "states\idle@2x.png")

# Identity in the catalogue (blue, to stand out in the action list).
Save-Key 20  '#3B6FD4' (Join-Path $root "action\mic.png")
Save-Key 40  '#3B6FD4' (Join-Path $root "action\mic@2x.png")
Save-Key 28  '#3B6FD4' (Join-Path $root "plugin\category.png")
Save-Key 56  '#3B6FD4' (Join-Path $root "plugin\category@2x.png")
Save-Key 256 '#3B6FD4' (Join-Path $root "plugin\plugin.png")
Save-Key 512 '#3B6FD4' (Join-Path $root "plugin\plugin@2x.png")

Write-Host "Images generated." -ForegroundColor Green
