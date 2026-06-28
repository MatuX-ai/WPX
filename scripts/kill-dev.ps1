$ErrorActionPreference = 'SilentlyContinue'
Get-Process -Name node,electron -ErrorAction SilentlyContinue | ForEach-Object {
  $wmi = Get-CimInstance Win32_Process -Filter ("ProcessId=" + $_.Id) -ErrorAction SilentlyContinue
  $cmd = ''
  if ($wmi) { $cmd = $wmi.CommandLine }
  if ($_.ProcessName -eq 'electron' -or $cmd -match 'wpx-app|electron:|vite|run-dev|wait-on|concurrently') {
    Write-Host ("Killing PID=" + $_.Id + " " + $_.ProcessName)
    Stop-Process -Id $_.Id -Force
  }
}
Start-Sleep -Seconds 2
Write-Host '--- remaining ---'
Get-Process -Name node,electron -ErrorAction SilentlyContinue | Select-Object Id,ProcessName | Format-Table -AutoSize
