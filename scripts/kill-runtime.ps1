$port3006 = Get-NetTCPConnection -LocalPort 3006 -State Listen -ErrorAction SilentlyContinue
if ($port3006) {
  $procId = $port3006.OwningProcess
  Write-Output ("Killing PID={0} on port 3006" -f $procId)
  Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 1
}
Write-Output 'done'