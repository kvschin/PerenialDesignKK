# Shrinks every photo in photos/ to <= $max px on the long edge and
# recompresses as JPEG, in place. Run after dropping full-size phone
# photos in:  powershell -ExecutionPolicy Bypass -File .\resize-photos.ps1
Add-Type -AssemblyName System.Drawing
$dir = Join-Path $PSScriptRoot 'photos'
$max = 1000
$quality = 82
$enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
$ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]$quality)
Get-ChildItem $dir -Include *.jpg,*.jpeg -File -Recurse | ForEach-Object {
  try {
    $srcImg = [System.Drawing.Image]::FromFile($_.FullName)
    $scale = [Math]::Min(1.0, $max / [Math]::Max($srcImg.Width, $srcImg.Height))
    $w = [int]([Math]::Round($srcImg.Width * $scale))
    $h = [int]([Math]::Round($srcImg.Height * $scale))
    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.DrawImage($srcImg, 0, 0, $w, $h)
    $g.Dispose(); $srcImg.Dispose()
    $bmp.Save($_.FullName, $enc, $ep); $bmp.Dispose()
    $kb = [Math]::Round((Get-Item $_.FullName).Length / 1KB, 1)
    Write-Output "$($_.Name) -> ${w}x${h}, ${kb} KB"
  } catch { Write-Output "$($_.Name): SKIPPED ($($_.Exception.Message))" }
}
