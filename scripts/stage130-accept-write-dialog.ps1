# Stage 130 smoke helper: accept Safe Scaffold Write MessageBox ["Cancel","Create Files"].
param(
  [string]$StatusPath = ""
)

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms
Add-Type -TypeDefinition @"
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public class Native130 {
  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc lpEnumFunc, IntPtr lParam);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
  public static IntPtr FindScaffoldDialog() {
    IntPtr found = IntPtr.Zero;
    EnumWindows((h, l) => {
      if (!IsWindowVisible(h)) return true;
      var title = new StringBuilder(512);
      GetWindowText(h, title, title.Capacity);
      var t = title.ToString();
      if (t.IndexOf("Safe Scaffold Write", StringComparison.OrdinalIgnoreCase) < 0) return true;
      var cls = new StringBuilder(256);
      GetClassName(h, cls, cls.Capacity);
      if (cls.ToString() == "#32770" || t == "Safe Scaffold Write") {
        found = h;
        return false;
      }
      return true;
    }, IntPtr.Zero);
    if (found != IntPtr.Zero) return found;
    return FindWindow("#32770", "Safe Scaffold Write");
  }
  public static void ForceForeground(IntPtr hWnd) {
    uint pid;
    uint foreTid = GetWindowThreadProcessId(hWnd, out pid);
    uint curTid = GetCurrentThreadId();
    if (foreTid != curTid) AttachThreadInput(curTid, foreTid, true);
    ShowWindow(hWnd, 9);
    BringWindowToTop(hWnd);
    SetForegroundWindow(hWnd);
    if (foreTid != curTid) AttachThreadInput(curTid, foreTid, false);
  }
}
"@

if (-not $StatusPath) {
  $StatusPath = Join-Path $env:TEMP "nttc-stage130-accept-write.status.txt"
}

"waiting" | Out-File -FilePath $StatusPath -Encoding utf8

for ($i = 0; $i -lt 160; $i++) {
  Start-Sleep -Milliseconds 250
  $hwnd = [Native130]::FindScaffoldDialog()
  if ($hwnd -eq [IntPtr]::Zero) { continue }

  [Native130]::ForceForeground($hwnd)
  Start-Sleep -Milliseconds 250

  # Prefer Invoke/DoDefaultAction on Create Files; fall back to TAB+ENTER.
  $accepted = $false
  try {
    $dlg = [System.Windows.Automation.AutomationElement]::FromHandle($hwnd)
    $nameCond = New-Object System.Windows.Automation.PropertyCondition(
      [System.Windows.Automation.AutomationElement]::NameProperty,
      "Create Files"
    )
    $create = $dlg.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $nameCond)
    if ($create) {
      try {
        $inv = $create.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
        if ($inv) { $inv.Invoke(); $accepted = $true }
      } catch {}
      if (-not $accepted) {
        try {
          $legacy = $create.GetCurrentPattern([System.Windows.Automation.LegacyIAccessiblePattern]::Pattern)
          if ($legacy) { $legacy.DoDefaultAction(); $accepted = $true }
        } catch {}
      }
    }
  } catch {}

  if (-not $accepted) {
    [System.Windows.Forms.SendKeys]::SendWait("{TAB}{ENTER}")
  }

  Start-Sleep -Milliseconds 500
  if (-not [Native130]::IsWindow($hwnd)) {
    "accepted hwnd=$hwnd method=$(if($accepted){'invoke'}else{'tab-enter'})" | Out-File -FilePath $StatusPath -Encoding utf8
    exit 0
  }

  # Second attempt: TAB+ENTER only
  [Native130]::ForceForeground($hwnd)
  Start-Sleep -Milliseconds 200
  [System.Windows.Forms.SendKeys]::SendWait("{TAB}{ENTER}")
  Start-Sleep -Milliseconds 500
  if (-not [Native130]::IsWindow($hwnd)) {
    "accepted-tab-enter-retry hwnd=$hwnd" | Out-File -FilePath $StatusPath -Encoding utf8
    exit 0
  }

  "dialog-still-open hwnd=$hwnd" | Out-File -FilePath $StatusPath -Encoding utf8
  exit 1
}

"timeout-no-dialog" | Out-File -FilePath $StatusPath -Encoding utf8
exit 1
