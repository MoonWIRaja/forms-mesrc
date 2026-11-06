param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('PreChange', 'PostChange')]
    [string]$Action,

    [Parameter(Mandatory = $true)]
    [string]$Task,

    [string]$TargetFolder,
    [string]$TargetFile,
    [string]$TargetFunction,
    [string]$TargetLines,
    [string]$ChangePlan,
    [string]$ReasonWhy,
    [string]$PersonaUsed = 'Analis',
    [string]$ChangesMade,
    [string]$FilesChanged,
    [string]$LinesBefore,
    [string]$LinesAfter,
    [string]$TestsRun,
    [string]$SecurityChecked,
    [string]$Status = 'completed',
    [string]$HandoffNotes
)

$ErrorActionPreference = 'Stop'
$coreRoot = Split-Path -Parent $PSScriptRoot
$simpleLoginPath = Join-Path $coreRoot '.simple-login.json'
$utf8 = New-Object System.Text.UTF8Encoding($false)

function Read-Json([string]$path) {
    if (-not (Test-Path -LiteralPath $path)) { return $null }
    return (Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json)
}

function Write-Json([string]$path, $data) {
    $temporary = "$path.tmp"
    $json = $data | ConvertTo-Json -Depth 100
    [System.IO.File]::WriteAllText($temporary, $json + [Environment]::NewLine, $utf8)
    Move-Item -LiteralPath $temporary -Destination $path -Force
}

function Get-CurrentUserAgent() {
    $receipt = Read-Json $simpleLoginPath
    if (-not $receipt) { throw 'No current user. Run Setup-SimpleUser.ps1 -Action Resolve first.' }
    $userRoot = Join-Path $coreRoot "users/$($receipt.user_id)"
    $agentRoot = Join-Path $userRoot "agents/$($receipt.agent_id)"
    return @{ userId = $receipt.user_id; agentId = $receipt.agent_id; userRoot = $userRoot; agentRoot = $agentRoot }
}

$ctx = Get-CurrentUserAgent
$memoryPath = Join-Path $ctx.agentRoot 'memory.json'
$diaryPath = Join-Path $ctx.agentRoot 'diary.json'
$memory = Read-Json $memoryPath
$diary = Read-Json $diaryPath

$eventId = 'cc-' + [DateTimeOffset]::UtcNow.ToString('yyyyMMddTHHmmssfff')

if ($Action -eq 'PreChange') {
    $entry = [pscustomobject]@{
        id = $eventId
        at = [DateTimeOffset]::Now.ToString('o')
        type = 'pre_change'
        task = $Task
        target_folder = $TargetFolder
        target_file = $TargetFile
        target_function = $TargetFunction
        target_lines = $TargetLines
        change_plan = $ChangePlan
        reason_why = $ReasonWhy
        persona_used = $PersonaUsed
        status = 'planning'
    }
    if (-not $memory.PSObject.Properties['code_changes']) { $memory | Add-Member -NotePropertyName code_changes -NotePropertyValue @() }
    $memory.code_changes = @($memory.code_changes) + @($entry)
    Write-Json $memoryPath $memory

    $diaryEntry = [pscustomobject]@{
        id = $eventId
        at = [DateTimeOffset]::Now.ToString('o')
        status = 'planning'
        provider = [string]$env:MCORE_PROVIDER
        instruction = "PRE-CHANGE: $Task"
        outcome = "Planned: $TargetFile | $TargetFunction | Lines: $TargetLines | Persona: $PersonaUsed | Reason: $ReasonWhy"
    }
    if (-not $diary.PSObject.Properties['entries']) { $diary | Add-Member -NotePropertyName entries -NotePropertyValue @() }
    $diary.entries = @($diary.entries) + @($diaryEntry)
    Write-Json $diaryPath $diary

    Write-Output "Pre-change log recorded: $eventId"
}
else {
    # PostChange - find matching pre_change entry
    $preEntry = $null
    if ($memory.code_changes) {
        $preEntry = $memory.code_changes | Where-Object { $_.target_file -eq $TargetFile -and $_.target_function -eq $TargetFunction } | Select-Object -Last 1
    }

    $entry = [pscustomobject]@{
        id = $eventId
        at = [DateTimeOffset]::Now.ToString('o')
        type = 'post_change'
        task = $Task
        target_folder = $TargetFolder
        target_file = $TargetFile
        target_function = $TargetFunction
        target_lines = $TargetLines
        changes_made = $ChangesMade
        files_changed = $FilesChanged
        lines_before = $LinesBefore
        lines_after = $LinesAfter
        tests_run = $TestsRun
        security_checked = $SecurityChecked
        status = $Status
        handoff_notes = $HandoffNotes
        persona_used = $PersonaUsed
        linked_pre_change = if ($preEntry) { $preEntry.id } else { $null }
    }
    if (-not $memory.PSObject.Properties['code_changes']) { $memory | Add-Member -NotePropertyName code_changes -NotePropertyValue @() }
    $memory.code_changes = @($memory.code_changes) + @($entry)
    # Keep only last 50 code changes
    if ($memory.code_changes.Count -gt 50) { $memory.code_changes = @($memory.code_changes | Select-Object -Last 50) }
    Write-Json $memoryPath $memory

    $diaryEntry = [pscustomobject]@{
        id = $eventId
        at = [DateTimeOffset]::Now.ToString('o')
        status = $Status
        provider = [string]$env:MCORE_PROVIDER
        instruction = "POST-CHANGE: $Task"
        outcome = "Changed: $TargetFile | $TargetFunction | Changes: $ChangesMade | Tests: $TestsRun | Security: $SecurityChecked | Handoff: $HandoffNotes"
    }
    if (-not $diary.PSObject.Properties['entries']) { $diary | Add-Member -NotePropertyName entries -NotePropertyValue @() }
    $diary.entries = @($diary.entries) + @($diaryEntry)
    Write-Json $diaryPath $diary

    Write-Output "Post-change log recorded: $eventId"
}
