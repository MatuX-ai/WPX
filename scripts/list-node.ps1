Get-Process -Name node -ErrorAction SilentlyContinue |
  ForEach-Object {
    $cmd = $_.CommandLine
    if ([string]::IsNullOrEmpty($cmd)) { $cmd = "(no cmdline)" }
    $display = $cmd.Substring(0, [Math]::Min(160, $cmd.Length))
    Write-Output ("PID={0} Start={1} CMD={2}" -f $_.Id, $_.StartTime, $display)
  }
