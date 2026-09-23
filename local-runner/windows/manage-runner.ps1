[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('install', 'start', 'stop', 'status', 'uninstall')]
  [string]$Command
)

$ErrorActionPreference = 'Stop'
$runnerDirectory = Split-Path -Parent $PSScriptRoot
$runnerPath = Join-Path $runnerDirectory 'runner.cjs'
$supervisorPath = Join-Path $PSScriptRoot 'supervise-runner.ps1'
$taskName = 'MaryamLocalRunner'
$runKey = 'HKCU\Software\Microsoft\Windows\CurrentVersion\Run'
$runValueName = 'MaryamLocalRunner'
$startupFolder = [Environment]::GetFolderPath('Startup')
$startupVbsPath = Join-Path $startupFolder 'MaryamLocalRunner.vbs'
$localAppData = if ($env:LOCALAPPDATA) { $env:LOCALAPPDATA } else { Join-Path $env:USERPROFILE 'AppData\Local' }
$stateDirectory = Join-Path $localAppData 'Maryam'
$pidPath = Join-Path $stateDirectory 'local-runner.pid'

function Get-MaryamRunnerProcesses {
  $escapedPath = [regex]::Escape($runnerPath)
  @(Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object {
    $_.CommandLine -and $_.CommandLine -match $escapedPath
  })
}

function Get-MaryamSupervisorProcesses {
  $escapedPath = [regex]::Escape($supervisorPath)
  @(Get-CimInstance Win32_Process | Where-Object {
    $_.Name -match '^powershell(\.exe)?$' -and $_.CommandLine -and $_.CommandLine -match $escapedPath
  })
}

function Test-MaryamRunnerHealthy {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 -Uri 'http://127.0.0.1:48123/health'
    $health = $response.Content | ConvertFrom-Json
    return $response.StatusCode -eq 200 -and $health.service -eq 'maryam-local-runner'
  } catch { return $false }
}

function Start-MaryamSupervisor {
  if (Test-MaryamRunnerHealthy) { Write-Output 'Maryam Local Runner is already healthy.'; return }
  Start-Process -FilePath 'powershell.exe' -ArgumentList @(
    '-NoLogo', '-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden',
    '-ExecutionPolicy', 'Bypass', '-File', $supervisorPath
  ) -WindowStyle Hidden | Out-Null
  Write-Output 'Maryam Local Runner supervisor started.'
}

switch ($Command) {
  'install' {
    $taskCommand = "powershell.exe -NoLogo -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"`"$supervisorPath`"`""

    # 1. Always install per-user HKCU Run key for instantaneous logon startup
    & reg.exe add $runKey /v $runValueName /t REG_SZ /d $taskCommand /f | Out-Null
    if ($LASTEXITCODE -eq 0) {
      Write-Output 'Installed per-user HKCU Run auto-start entry.'
    }

    # 2. Always ensure per-user Startup folder VBS fallback
    try {
      $vbsContent = "' Maryam per-user startup fallback. Runs canonical supervisor hidden.`r`nCreateObject(`"WScript.Shell`").Run `"powershell.exe -NoLogo -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"`"$supervisorPath`"`"`", 0, False`r`n"
      Set-Content -LiteralPath $startupVbsPath -Value $vbsContent -Encoding ascii
      Write-Output "Installed per-user Startup fallback: $startupVbsPath"
    } catch {
      Write-Warning "Could not write Startup fallback VBS: $($_.Exception.Message)"
    }

    # 3. Best-effort Task Scheduler entry (non-admin environments may deny this)
    try {
      & schtasks.exe /Create /TN $taskName /SC ONLOGON /RL LIMITED /TR $taskCommand /F 2>$null | Out-Null
      if ($LASTEXITCODE -eq 0) {
        Write-Output "Installed per-user Task Scheduler entry: $taskName"
      }
    } catch {}

    Start-MaryamSupervisor
  }
  'start' { Start-MaryamSupervisor }
  'stop' {
    # Stop the exact supervisor first so it does not interpret this intentional
    # stop as a crash. It never targets unrelated PowerShell or Node processes.
    foreach ($supervisor in Get-MaryamSupervisorProcesses) {
      Stop-Process -Id $supervisor.ProcessId -ErrorAction Stop
      Write-Output "Stopped canonical Maryam supervisor PID $($supervisor.ProcessId)."
    }
    $processes = Get-MaryamRunnerProcesses
    if ($processes.Count -eq 0) { Write-Output 'No canonical Maryam Local Runner process was found.'; break }
    foreach ($process in $processes) {
      Stop-Process -Id $process.ProcessId -ErrorAction Stop
      Write-Output "Stopped canonical Maryam Local Runner PID $($process.ProcessId)."
    }
  }
  'status' {
    $health = Test-MaryamRunnerHealthy
    $processes = Get-MaryamRunnerProcesses
    $taskInstalled = $false
    try {
      $task = & schtasks.exe /Query /TN $taskName /FO LIST 2>$null
      $taskInstalled = $LASTEXITCODE -eq 0
    } catch {
      # A missing task is an expected status condition, not a management error.
      $taskInstalled = $false
    }
    $runKeyInstalled = $false
    try {
      & reg.exe query $runKey /v $runValueName 2>$null | Out-Null
      $runKeyInstalled = $LASTEXITCODE -eq 0
    } catch { $runKeyInstalled = $false }
    $startupVbsInstalled = Test-Path -LiteralPath $startupVbsPath
    [pscustomobject]@{
      runnerPath = $runnerPath
      health = if ($health) { 'healthy' } else { 'unhealthy' }
      canonicalRunnerProcessCount = @($processes).Count
      canonicalRunnerPids = @($processes | ForEach-Object ProcessId)
      scheduledTaskInstalled = $taskInstalled
      runKeyInstalled = $runKeyInstalled
      startupVbsInstalled = $startupVbsInstalled
    } | ConvertTo-Json -Compress
  }
  'uninstall' {
    try {
      & schtasks.exe /Delete /TN $taskName /F 2>$null | Out-Null
      if ($LASTEXITCODE -eq 0) { Write-Output "Removed Task Scheduler entry: $taskName" }
    } catch {}
    try {
      & reg.exe delete $runKey /v $runValueName /f 2>$null | Out-Null
      if ($LASTEXITCODE -eq 0) { Write-Output 'Removed per-user HKCU Run auto-start entry.' }
    } catch {}
    try {
      if (Test-Path -LiteralPath $startupVbsPath) {
        Remove-Item -LiteralPath $startupVbsPath -Force
        Write-Output 'Removed per-user Startup fallback VBS.'
      }
    } catch {}
  }
}
