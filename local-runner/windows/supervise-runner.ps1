[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$runnerDirectory = Split-Path -Parent $PSScriptRoot
$runnerPath = Join-Path $runnerDirectory 'runner.cjs'
$logDirectory = Join-Path $runnerDirectory 'logs'
$localAppData = if ($env:LOCALAPPDATA) { $env:LOCALAPPDATA } else { Join-Path $env:USERPROFILE 'AppData\Local' }
$stateDirectory = Join-Path $localAppData 'Maryam'
$pidPath = Join-Path $stateDirectory 'local-runner.pid'
$mutex = [Threading.Mutex]::new($false, 'Local\MaryamLocalRunnerSupervisor')
$hasMutex = $false

function Redact-MaryamLogText {
  param([AllowNull()][string]$Text)
  if ($null -eq $Text) { return '' }
  $value = $Text
  $value = $value -replace '(?i)(MARYAM_RUNNER_TOKEN|MARYAM_RUNNER_SECRET|RUNNER_TOKEN|LOCAL_RUNNER_AUTH_TOKEN|pairingSecret|pairing_secret|api[_-]?key|authorization|cookie|set-cookie)\s*([:=])\s*([^\s,;"'']+)', '$1$2[REDACTED]'
  $value = $value -replace '(?i)([?&](?:token|secret|api[_-]?key|key|session|cookie)=)[^&\s]+', '$1[REDACTED]'
  $value = $value -replace '\b(?:AIza[\w-]{20,}|sk-[\w-]{16,}|ghp_[\w]{20,})\b', '[REDACTED]'
  return $value
}

function Write-MaryamSupervisorLog {
  param([string]$Level, [string]$Message)
  $stamp = (Get-Date).ToString('o')
  $line = "[$stamp] [$Level] $(Redact-MaryamLogText $Message)"
  Add-Content -LiteralPath (Join-Path $logDirectory 'supervisor.log') -Value $line -Encoding utf8
}

function Sanitize-MaryamLogFile {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) { return }
  try {
    $safe = Redact-MaryamLogText (Get-Content -LiteralPath $Path -Raw)
    [System.IO.File]::WriteAllText($Path, $safe, [System.Text.UTF8Encoding]::new($false))
  } catch {
    Write-MaryamSupervisorLog 'WARN' "Could not sanitize runner output '$Path': $($_.Exception.Message)"
  }
}

function Test-MaryamRunnerHealthy {
  param([switch]$LogFailure)
  try {
    $response = Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 -Uri 'http://127.0.0.1:48123/health'
    $health = $response.Content | ConvertFrom-Json
    return $response.StatusCode -eq 200 -and $health.service -eq 'maryam-local-runner'
  } catch {
    if ($LogFailure) {
      Write-MaryamSupervisorLog 'WARN' "Health check failed: $($_.Exception.Message)"
    }
    return $false
  }
}

try {
  $hasMutex = $mutex.WaitOne(0)
  if (-not $hasMutex) { exit 0 }
  if (-not (Test-Path -LiteralPath $runnerPath)) { throw "Canonical runner was not found: $runnerPath" }
  New-Item -ItemType Directory -Force -Path $stateDirectory, $logDirectory | Out-Null
  Write-MaryamSupervisorLog 'INFO' "Supervisor started. Canonical runner path: $runnerPath"
  if (Test-MaryamRunnerHealthy -LogFailure) {
    $adoptedPid = if (Test-Path -LiteralPath $pidPath) { (Get-Content -LiteralPath $pidPath -Raw).Trim() } else { '' }
    $adoptedChild = if ($adoptedPid -match '^\d+$') { Get-Process -Id ([int]$adoptedPid) -ErrorAction SilentlyContinue } else { $null }
    if (-not $adoptedChild) {
      Write-MaryamSupervisorLog 'WARN' 'A healthy runner exists without a canonical PID record; supervisor will not start a duplicate.'
      exit 0
    }
    Write-MaryamSupervisorLog 'INFO' "Adopting healthy canonical runner PID=$adoptedPid for exit monitoring; no duplicate runner will be started."
    $adoptedStartedAt = Get-Date
    try {
      $adoptedChild.WaitForExit()
      $adoptedExitAt = Get-Date
      $adoptedExitCode = $adoptedChild.ExitCode
      Write-MaryamSupervisorLog 'ERROR' "Adopted runner exited. PID=$adoptedPid; exitTimestamp=$($adoptedExitAt.ToString('o')); exitCode=$adoptedExitCode; signal=unavailable_on_windows; stdout=not_captured_by_pre-observability-supervisor; stderr=not_captured_by-pre-observability-supervisor"
    } catch {
      Write-MaryamSupervisorLog 'ERROR' "Failed while monitoring adopted runner PID=${adoptedPid}: $($_.Exception.Message)"
    }
  }

  $node = Get-Command node.exe -ErrorAction Stop
  $failures = 0

  while ($true) {
    # A runner may have recovered while this supervisor was waiting to retry.
    if (Test-MaryamRunnerHealthy -LogFailure) {
      Write-MaryamSupervisorLog 'INFO' 'Runner health check succeeded before restart; supervisor will exit without starting a duplicate.'
      exit 0
    }

    $startedAt = Get-Date
    $attemptId = $startedAt.ToString('yyyyMMddTHHmmssfff')
    $stdoutPath = Join-Path $logDirectory "runner-$attemptId.stdout.log"
    $stderrPath = Join-Path $logDirectory "runner-$attemptId.stderr.log"
    try {
      Write-MaryamSupervisorLog 'INFO' "Restart attempt $attemptId starting node '$($node.Source)' with canonical runner '$runnerPath'."
      $child = Start-Process -FilePath $node.Source -ArgumentList @($runnerPath) `
        -WorkingDirectory $runnerDirectory -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath
      Set-Content -LiteralPath $pidPath -Value $child.Id -Encoding ascii
      Write-MaryamSupervisorLog 'INFO' "Runner started. PID=$($child.Id); stdout=$stdoutPath; stderr=$stderrPath"
      $child.WaitForExit()
      $exitAt = Get-Date
      $exitCode = $child.ExitCode
      Sanitize-MaryamLogFile $stdoutPath
      Sanitize-MaryamLogFile $stderrPath
      Write-MaryamSupervisorLog 'ERROR' "Runner exited. PID=$($child.Id); exitTimestamp=$($exitAt.ToString('o')); exitCode=$exitCode; signal=unavailable_on_windows; stdout=$stdoutPath; stderr=$stderrPath"
    } catch {
      $exitAt = Get-Date
      $exitCode = 'start_failed'
      Write-MaryamSupervisorLog 'ERROR' "Supervisor restart attempt $attemptId failed at $($exitAt.ToString('o')): $($_.Exception.Message)"
    }

    if ($child -and (Test-Path -LiteralPath $pidPath) -and (Get-Content -LiteralPath $pidPath -Raw).Trim() -eq "$($child.Id)") {
      Remove-Item -LiteralPath $pidPath -Force
    }

    $runtimeSeconds = ((Get-Date) - $startedAt).TotalSeconds
    if ($runtimeSeconds -ge 300) { $failures = 0 } else { $failures++ }
    # Bounded exponential recovery: after repeated fast crashes, pause five
    # minutes before retrying, avoiding a tight restart loop.
    $delaySeconds = switch ($failures) {
      1 { 2 }
      2 { 5 }
      3 { 10 }
      4 { 30 }
      default { 300 }
    }
    Write-MaryamSupervisorLog 'WARN' "Supervisor retry state: consecutiveFastFailures=$failures; runtimeSeconds=$([Math]::Round($runtimeSeconds, 3)); nextRestartDelaySeconds=$delaySeconds"
    Start-Sleep -Seconds $delaySeconds
  }
} catch {
  if (Test-Path -LiteralPath $logDirectory) {
    Write-MaryamSupervisorLog 'ERROR' "Unexpected supervisor exception: $($_.Exception.Message)"
  }
} finally {
  if ($hasMutex) { $mutex.ReleaseMutex() }
  $mutex.Dispose()
}
