param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('Resolve', 'List', 'Add', 'Switch', 'Status')]
    [string]$Action,

    [string]$UserId,
    [string]$UserName,
    [string]$AgentId = 'agent-main',
    [string]$AgentName = 'Single Agent'
)

$ErrorActionPreference = 'Stop'
$coreRoot = Split-Path -Parent $PSScriptRoot
$usersRoot = Join-Path $coreRoot 'users'
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

function Assert-Id([string]$value, [string]$label) {
    if ($value -notmatch '^[a-z0-9]+(-[a-z0-9]+)*$') {
        throw "$label must use lowercase letters, digits, and internal hyphens."
    }
}

function Assert-Text([string]$value, [string]$label) {
    if ([string]::IsNullOrWhiteSpace($value)) { throw "$label is required." }
}

function Get-UserRoot([string]$id) {
    Assert-Id $id 'UserId'
    return (Join-Path $usersRoot $id)
}

function Get-AgentRoot([string]$userId, [string]$agentId) {
    Assert-Id $agentId 'AgentId'
    return (Join-Path (Get-UserRoot $userId) "agents/$agentId")
}

function New-AgentFiles([string]$userId, [string]$agentId) {
    $agentRoot = Get-AgentRoot $userId $agentId
    if (Test-Path -LiteralPath $agentRoot) { return }
    New-Item -ItemType Directory -Path $agentRoot -Force | Out-Null
    Write-Json (Join-Path $agentRoot 'identity.json') ([pscustomobject]@{ role = 'Single Agent'; style = '' })
    Write-Json (Join-Path $agentRoot 'memory.json') ([pscustomobject]@{
        summary = ''
        facts = @()
        preferences = @()
        decisions = @()
        questions = @()
        code_changes = @()
    })
    Write-Json (Join-Path $agentRoot 'session.json') ([pscustomobject]@{ summary = ''; updated_at = $null })
    Write-Json (Join-Path $agentRoot 'diary.json') ([pscustomobject]@{ entries = @() })
    Write-Json (Join-Path $agentRoot 'topics.json') ([pscustomobject]@{ topics = @() })
    Write-Json (Join-Path $agentRoot 'compaction.json') ([pscustomobject]@{
        policy = 'Summarize only when needed; preserve confirmed meaning and uncertainty.'
        snapshot = $null
        last_compacted_at = $null
    })
}

function New-UserFiles([string]$userId, [string]$agentId) {
    $userRoot = Get-UserRoot $userId
    if (Test-Path -LiteralPath $userRoot) { return }
    New-Item -ItemType Directory -Path $userRoot -Force | Out-Null
    Write-Json (Join-Path $userRoot 'profile.json') ([pscustomobject]@{
        id = $userId
        name = $UserName
        created_at = [DateTimeOffset]::UtcNow.ToString('o')
        facts = @()
        preferences = @()
        goals = @()
    })
    New-AgentFiles $userId $agentId
}

switch ($Action) {
    'Status' {
        $users = @()
        if (Test-Path -LiteralPath $usersRoot) {
            foreach ($dir in @(Get-ChildItem -LiteralPath $usersRoot -Directory)) {
                $profile = Read-Json (Join-Path $dir.FullName 'profile.json')
                if ($profile) { $users += $profile }
            }
        }
        $current = $null
        if (Test-Path -LiteralPath $simpleLoginPath) {
            $current = Read-Json $simpleLoginPath
        }
        [pscustomobject]@{
            mode = 'SimpleUser'
            users = $users
            current_user = $current
            vault_required = $false
            github_required = $false
        } | ConvertTo-Json -Depth 10
    }

    'List' {
        $users = @()
        if (Test-Path -LiteralPath $usersRoot) {
            foreach ($dir in @(Get-ChildItem -LiteralPath $usersRoot -Directory)) {
                $profile = Read-Json (Join-Path $dir.FullName 'profile.json')
                if ($profile) { $users += $profile }
            }
        }
        $users | ConvertTo-Json -Depth 10
    }

    'Add' {
        Assert-Id $UserId 'UserId'
        Assert-Text $UserName 'UserName'
        New-UserFiles $UserId $AgentId
        Write-Json $simpleLoginPath ([pscustomobject]@{
            user_id = $UserId
            agent_id = $AgentId
            at = [DateTimeOffset]::UtcNow.ToString('o')
            mode = 'SimpleUser'
        })
        Write-Output "User '$UserId' added and set as current."
    }

    'Switch' {
        Assert-Id $UserId 'UserId'
        $userRoot = Get-UserRoot $UserId
        if (-not (Test-Path -LiteralPath $userRoot)) { throw "User '$UserId' not found. Run Add first." }
        $profile = Read-Json (Join-Path $userRoot 'profile.json')
        $agentId = $AgentId
        if ($profile.PSObject.Properties['agent_id']) { $agentId = $profile.agent_id }
        Write-Json $simpleLoginPath ([pscustomobject]@{
            user_id = $UserId
            agent_id = $agentId
            at = [DateTimeOffset]::UtcNow.ToString('o')
            mode = 'SimpleUser'
        })
        Write-Output "Switched to user '$UserId'."
    }

    'Resolve' {
        if (Test-Path -LiteralPath $simpleLoginPath) {
            $receipt = Read-Json $simpleLoginPath
            if ($receipt) {
                $userId = $receipt.user_id
                $agentId = $receipt.agent_id
                $userRoot = Get-UserRoot $userId
                if (Test-Path -LiteralPath $userRoot) {
                    $profile = Read-Json (Join-Path $userRoot 'profile.json')
                    $agentRoot = Get-AgentRoot $userId $agentId
                    [pscustomobject]@{
                        user_id = $userId
                        user_name = $profile.name
                        agent_id = $agentId
                        agent_name = $AgentName
                        mode = 'SimpleUser'
                        profile = $profile
                        memory = if (Test-Path (Join-Path $agentRoot 'memory.json')) { Read-Json (Join-Path $agentRoot 'memory.json') } else { $null }
                        diary = if (Test-Path (Join-Path $agentRoot 'diary.json')) { Read-Json (Join-Path $agentRoot 'diary.json') } else { $null }
                        session = if (Test-Path (Join-Path $agentRoot 'session.json')) { Read-Json (Join-Path $agentRoot 'session.json') } else { $null }
                    } | ConvertTo-Json -Depth 10
                    exit
                }
            }
        }

        $defaultUserId = 'default'
        $defaultUserName = 'Default User'
        $userRoot = Get-UserRoot $defaultUserId
        if (-not (Test-Path -LiteralPath $userRoot)) {
            New-UserFiles $defaultUserId $AgentId
        }
        Write-Json $simpleLoginPath ([pscustomobject]@{
            user_id = $defaultUserId
            agent_id = $AgentId
            at = [DateTimeOffset]::UtcNow.ToString('o')
            mode = 'SimpleUser'
        })
        $profile = Read-Json (Join-Path $userRoot 'profile.json')
        $agentRoot = Get-AgentRoot $defaultUserId $AgentId
        [pscustomobject]@{
            user_id = $defaultUserId
            user_name = $defaultUserName
            agent_id = $AgentId
            agent_name = $AgentName
            mode = 'SimpleUser'
            profile = $profile
            memory = if (Test-Path (Join-Path $agentRoot 'memory.json')) { Read-Json (Join-Path $agentRoot 'memory.json') } else { $null }
            diary = if (Test-Path (Join-Path $agentRoot 'diary.json')) { Read-Json (Join-Path $agentRoot 'diary.json') } else { $null }
            session = if (Test-Path (Join-Path $agentRoot 'session.json')) { Read-Json (Join-Path $agentRoot 'session.json') } else { $null }
        } | ConvertTo-Json -Depth 10
    }
}
