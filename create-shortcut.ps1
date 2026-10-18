$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [System.Environment]::GetFolderPath('Desktop')
$ShortcutPath = Join-Path $DesktopPath 'LC Correction Generator.lnk'
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = 'C:\Users\PC\.gemini\antigravity\scratch\lc-correction-generator\start-app.bat'
$Shortcut.WorkingDirectory = 'C:\Users\PC\.gemini\antigravity\scratch\lc-correction-generator'
$Shortcut.IconLocation = 'shell32.dll,13'
$Shortcut.Description = 'LC Correction Generator - Textile Commercial Tool'
$Shortcut.WindowStyle = 1
$Shortcut.Save()
Write-Host "Shortcut created at: $ShortcutPath"
