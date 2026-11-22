# Switch the NixieClock window to the next display.
# Bound to hotkey Ctrl+Alt+M via desktop shortcut (toggles back and forth).
$ErrorActionPreference = 'SilentlyContinue'

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public struct RECT { public int L, T, R, B; }
public static class Win {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int cx, int cy, uint f);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
}
"@
[Win]::SetProcessDPIAware() | Out-Null

# Locate the clock window (main window handle of NixieClock process)
$p = Get-Process -Name NixieClock -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if (-not $p) { Write-Output 'NixieClock not running'; exit }

Add-Type -AssemblyName System.Windows.Forms
$screens = [System.Windows.Forms.Screen]::AllScreens
if ($screens.Count -lt 2) { Write-Output 'only one display'; exit }

# Which display holds the window center?
$r = New-Object RECT
[Win]::GetWindowRect([IntPtr]$p.MainWindowHandle, [ref]$r) | Out-Null
$cx = ($r.L + $r.R) / 2
$cy = ($r.T + $r.B) / 2
$cur = 0
for ($i = 0; $i -lt $screens.Count; $i++) {
  $b = $screens[$i].Bounds
  if ($cx -ge $b.X -and $cx -lt ($b.X + $b.Width) -and $cy -ge $b.Y -and $cy -lt ($b.Y + $b.Height)) { $cur = $i; break }
}
$next = $screens[($cur + 1) % $screens.Count].Bounds

# Restore (undo maximize/fullscreen) -> move+resize onto next display -> maximize there
$h = [IntPtr]$p.MainWindowHandle
[Win]::ShowWindow($h, 9) | Out-Null
[Win]::SetWindowPos($h, [IntPtr]::Zero, $next.X, $next.Y, $next.Width, $next.Height, 0x0004) | Out-Null
[Win]::ShowWindow($h, 3) | Out-Null

Write-Output ("moved to display {0} ({1}x{2} at {3},{4})" -f (($cur + 1) % $screens.Count + 1), $next.Width, $next.Height, $next.X, $next.Y)
