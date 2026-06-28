$ErrorActionPreference = 'Continue'
$procs = Get-Process -Name node,electron -ErrorAction SilentlyContinue
foreach ($p in $procs) {
  $wmi = Get-CimInstance Win32_Process -Filter ("ProcessId=" + $p.Id) -ErrorAction SilentlyContinue
  Write-Host ("PID=" + $p.Id + " Name=" + $p.ProcessName + " Start=" + $p.StartTime + " Cmd=" + $wmi.CommandLine)
}