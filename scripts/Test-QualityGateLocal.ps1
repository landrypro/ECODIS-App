[CmdletBinding()]
param(
    [switch]$SkipInstall,
    [switch]$SkipE2E,
    [switch]$SkipBackend,
    [switch]$RunLocalDatabaseChecks,
    [string]$WslDistribution,
    [switch]$Plan
)

<#
.SYNOPSIS
    Exécute le verrou technique local P4.2.2-E et P4.3-MC-F depuis PowerShell.

.DESCRIPTION
    Le mode standard vérifie le frontend, le lockfile, l'audit de production,
    les tests backend Deno sous WSL et les E2E. Les contrôles Supabase locaux
    sont opt-in car ils réinitialisent les données locales. En plus du replay,
    du lint et de l'historique des migrations, ils exécutent les preuves P4.3 :
    intégrité/concurrence PostgreSQL MC-C et HTTP/RPC réel MC-D.

    Usage complet :
      .\scripts\Test-QualityGateLocal.ps1 -RunLocalDatabaseChecks

    Si plusieurs distributions Linux sont installées, le script privilégie
    Ubuntu-24.04 et ignore les distributions Docker. Vous pouvez imposer une
    distribution avec -WslDistribution <nom>.

    Sans -RunLocalDatabaseChecks, ou avec une option Skip, le script retourne
    le code 2 : il s'agit d'une vérification intermédiaire, pas d'un verrou complet.
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$script:results = @()
$script:partialRun = $false
$script:nodeExecutable = (Get-Command node.exe -ErrorAction Stop).Source
$nodeDirectory = Split-Path $script:nodeExecutable -Parent
$bundledNpmCli = Join-Path $nodeDirectory 'node_modules\npm\bin\npm-cli.js'
$npmPrefixScript = Join-Path $nodeDirectory 'node_modules\npm\bin\npm-prefix.js'
$script:npmCli = $bundledNpmCli

if (Test-Path -LiteralPath $npmPrefixScript) {
    $npmPrefixOutput = @(& $script:nodeExecutable $npmPrefixScript)
    $npmPrefixExitCode = $LASTEXITCODE
    if ($npmPrefixExitCode -eq 0) {
        $npmPrefix = ($npmPrefixOutput -join "`n").Trim()
        $prefixedNpmCli = Join-Path $npmPrefix 'node_modules\npm\bin\npm-cli.js'
        if (Test-Path -LiteralPath $prefixedNpmCli) {
            $script:npmCli = $prefixedNpmCli
        }
    }
}

if (-not (Test-Path -LiteralPath $script:npmCli)) {
    throw "Le CLI npm est introuvable : $script:npmCli"
}

function Add-Result {
    param(
        [Parameter(Mandatory)] [string]$Name,
        [Parameter(Mandatory)] [ValidateSet('PASS', 'FAIL', 'SKIP')] [string]$Status,
        [Parameter(Mandatory)] [string]$Detail,
        [Parameter(Mandatory)] [TimeSpan]$Duration
    )

    $script:results += [pscustomobject]@{
        Name       = $Name
        Status     = $Status
        Detail     = $Detail
        Duration   = [Math]::Round($Duration.TotalSeconds, 1)
    }
}

function Invoke-QualityStep {
    param(
        [Parameter(Mandatory)] [string]$Name,
        [Parameter(Mandatory)] [scriptblock]$Action
    )

    Write-Host "`n==> $Name" -ForegroundColor Cyan
    $timer = [System.Diagnostics.Stopwatch]::StartNew()

    try {
        & $Action
        $timer.Stop()
        Add-Result -Name $Name -Status 'PASS' -Detail 'Terminé.' -Duration $timer.Elapsed
        Write-Host "PASS ($([Math]::Round($timer.Elapsed.TotalSeconds, 1)) s)" -ForegroundColor Green
    }
    catch {
        $timer.Stop()
        $message = $_.Exception.Message -replace '[\r\n]+', ' '
        Add-Result -Name $Name -Status 'FAIL' -Detail $message -Duration $timer.Elapsed
        Write-Host "FAIL ($([Math]::Round($timer.Elapsed.TotalSeconds, 1)) s) : $message" -ForegroundColor Red
        Write-Verbose $_.ScriptStackTrace
    }
}

function Add-SkippedStep {
    param(
        [Parameter(Mandatory)] [string]$Name,
        [Parameter(Mandatory)] [string]$Reason
    )

    $script:partialRun = $true
    Add-Result -Name $Name -Status 'SKIP' -Detail $Reason -Duration ([TimeSpan]::Zero)
    Write-Host "SKIP : $Name — $Reason" -ForegroundColor Yellow
}

function Invoke-Npm {
    param([Parameter(Mandatory)] [string[]]$NpmArguments)

    # npm.ps1 de npm 11.12.x échoue lorsqu'il est appelé depuis un scriptblock.
    # L'appel direct conserve le comportement du CLI npm sans dépendre des
    # lanceurs PowerShell ou cmd.
    & $script:nodeExecutable $script:npmCli @NpmArguments
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw "npm $($NpmArguments -join ' ') a retourné le code $exitCode."
    }
}

function ConvertTo-BashLiteral {
    param([Parameter(Mandatory)] [string]$Value)

    $singleQuote = [string][char]39
    $doubleQuote = [string][char]34
    $escapedValue = $Value.Replace(
        $singleQuote,
        $singleQuote + $doubleQuote + $singleQuote + $doubleQuote + $singleQuote
    )
    return $singleQuote + $escapedValue + $singleQuote
}

function Resolve-WslDistribution {
    if ($script:wslDistribution) {
        return $script:wslDistribution
    }

    if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) {
        throw 'WSL est introuvable. Installez ou activez WSL avant le contrôle backend.'
    }

    $distributionOutput = @(& wsl.exe --list --quiet 2>&1)
    $distributionExitCode = $LASTEXITCODE
    if ($distributionExitCode -ne 0) {
        throw "Impossible de lister les distributions WSL (code $distributionExitCode)."
    }

    $nullCharacter = [string][char]0
    $linuxDistributions = @(
        $distributionOutput |
            ForEach-Object { $_.ToString().Replace($nullCharacter, '').Trim() } |
            Where-Object { $_ -and $_ -notmatch '^docker-' }
    )

    if ($linuxDistributions -contains 'Ubuntu-24.04') {
        $script:wslDistribution = 'Ubuntu-24.04'
    }
    elseif ($linuxDistributions.Count -eq 1) {
        $script:wslDistribution = $linuxDistributions[0]
    }
    else {
        $available = if ($linuxDistributions.Count -gt 0) {
            $linuxDistributions -join ', '
        }
        else {
            'aucune distribution Linux non-Docker'
        }
        throw "Distribution WSL ambiguë ou absente ($available). Relancez avec -WslDistribution <nom>."
    }

    Write-Host "WSL : distribution sélectionnée : $script:wslDistribution" -ForegroundColor DarkGray
    return $script:wslDistribution
}

function Invoke-WslBash {
    param(
        [Parameter(Mandatory)] [string]$Command,
        [switch]$SuppressOutput
    )

    $distribution = Resolve-WslDistribution

    $wslProjectOutput = @(& wsl.exe --distribution $distribution --exec wslpath -a $projectRoot 2>&1)
    $wslPathExitCode = $LASTEXITCODE
    if ($wslPathExitCode -ne 0) {
        $wslDetail = (($wslProjectOutput -join ' ') -replace '[\r\n]+', ' ').Trim()
        if ($wslDetail.Length -gt 240) {
            $wslDetail = $wslDetail.Substring(0, 240) + '…'
        }
        throw "Impossible de convertir le chemin du projet pour WSL (code $wslPathExitCode) : $wslDetail"
    }
    $wslProjectRoot = ($wslProjectOutput -join "`n").Trim()
    if ([string]::IsNullOrWhiteSpace($wslProjectRoot)) {
        throw 'La conversion du chemin du projet pour WSL a retourné une valeur vide.'
    }

    $bashProjectRoot = ConvertTo-BashLiteral -Value $wslProjectRoot
    $bashCommand = "cd $bashProjectRoot && $Command"

    # Deno et Supabase écrivent leurs messages de progression sur stderr. Ne
    # les redirigeons pas vers le flux d'erreur PowerShell : avec
    # $ErrorActionPreference='Stop', un simple « Check … » ou « Starting
    # database… » serait alors interprété à tort comme une exception.
    if ($SuppressOutput) {
        & wsl.exe --distribution $distribution --exec bash -lc $bashCommand *> $null
    }
    else {
        & wsl.exe --distribution $distribution --exec bash -lc $bashCommand
    }
    $exitCode = $LASTEXITCODE

    if ($exitCode -ne 0) {
        throw "La commande WSL a retourné le code $exitCode. Consultez la sortie affichée juste avant ce résumé."
    }
}

function Test-NodeAndNpmVersions {
    $nodeVersion = (& node --version).Trim()
    $npmVersion = (& $script:nodeExecutable $script:npmCli --version).Trim()

    Write-Host "Node $nodeVersion ; npm $npmVersion"

    if ($nodeVersion -notmatch '^v22\.18\.') {
        throw "Node $nodeVersion détecté ; la version attendue est 22.18.x."
    }
    if ($npmVersion -notmatch '^11\.12\.') {
        throw "npm $npmVersion détecté ; la version attendue est 11.12.x."
    }
}

function Write-Summary {
    Write-Host "`n========== Résumé du verrou qualité ==========" -ForegroundColor Cyan
    $script:results | Format-Table Name, Status, Duration, Detail -AutoSize | Out-Host

    $failed = @($script:results | Where-Object Status -eq 'FAIL')
    $skipped = @($script:results | Where-Object Status -eq 'SKIP')

    if ($failed.Count -gt 0) {
        Write-Host "VERROU ROUGE : $($failed.Count) contrôle(s) en échec." -ForegroundColor Red
        return 1
    }
    if ($skipped.Count -gt 0) {
        Write-Host "VERROU INCOMPLET : $($skipped.Count) contrôle(s) ignoré(s)." -ForegroundColor Yellow
        return 2
    }

    Write-Host 'VERROU VERT : tous les contrôles exécutés sont réussis.' -ForegroundColor Green
    return 0
}

Push-Location $projectRoot
try {
    if ($Plan) {
        Write-Host "Plan du verrou qualité (aucune commande n’est exécutée) :" -ForegroundColor Cyan
        Write-Host '1. Version Node/npm'
        Write-Host '2. npm ci'
        Write-Host '3. TypeScript, ESLint, tests unitaires et intégration'
        Write-Host '4. Build, E2E, audit production et arbre ciblé npm'
        Write-Host '5. Deno check/tests sous WSL (Ubuntu-24.04 automatiquement, ou -WslDistribution)'
        Write-Host '6. Avec -RunLocalDatabaseChecks : cycle PostgreSQL Supabase sous WSL (db start, attente Docker healthy, reset, lint, migrations, stop)'
        Write-Host '7. Avec -RunLocalDatabaseChecks : intégrité PostgreSQL MC-C et HTTP/RPC Supabase local MC-D'
        exit 0
    }

    Invoke-QualityStep -Name 'Versions Node et npm' -Action { Test-NodeAndNpmVersions }

    if ($SkipInstall) {
        Add-SkippedStep -Name 'Installation propre depuis le lockfile' -Reason 'Option -SkipInstall demandée.'
    }
    else {
        # L'audit exécuté implicitement par npm ci dépend du registre et répète
        # le contrôle de production explicite ci-dessous. L'installation reste
        # strictement déterminée par le lockfile ; l'audit production demeure
        # obligatoire à l'étape dédiée du verrou.
        Invoke-QualityStep -Name 'Installation propre depuis le lockfile' -Action { Invoke-Npm -NpmArguments @('ci', '--no-audit', '--fund=false') }
    }

    Invoke-QualityStep -Name 'TypeScript' -Action { Invoke-Npm -NpmArguments @('run', 'typecheck') }
    Invoke-QualityStep -Name 'ESLint' -Action { Invoke-Npm -NpmArguments @('run', 'lint') }
    Invoke-QualityStep -Name 'Tests unitaires' -Action { Invoke-Npm -NpmArguments @('run', 'test:unit') }
    Invoke-QualityStep -Name 'Tests d''intégration' -Action { Invoke-Npm -NpmArguments @('run', 'test:integration') }
    Invoke-QualityStep -Name 'Build de production' -Action { Invoke-Npm -NpmArguments @('run', 'build') }

    if ($SkipE2E) {
        Add-SkippedStep -Name 'Tests E2E Playwright' -Reason 'Option -SkipE2E demandée.'
    }
    else {
        Invoke-QualityStep -Name 'Tests E2E Playwright' -Action { Invoke-Npm -NpmArguments @('run', 'test:e2e') }
    }

    Invoke-QualityStep -Name 'Audit npm de production' -Action { Invoke-Npm -NpmArguments @('audit', '--omit=dev', '--audit-level=high') }
    Invoke-QualityStep -Name 'Arbre npm ciblé' -Action { Invoke-Npm -NpmArguments @('ls', 'hono', 'react-router', 'lodash', 'ws', '--all') }

    if ($SkipBackend) {
        Add-SkippedStep -Name 'Backend Deno sous WSL' -Reason 'Option -SkipBackend demandée.'
    }
    else {
        Invoke-QualityStep -Name 'Backend Deno sous WSL' -Action {
            Invoke-WslBash -Command 'bash scripts/test-backend-wsl.sh'
        }
    }

    if ($RunLocalDatabaseChecks) {
        Invoke-QualityStep -Name 'Cycle Supabase local' -Action {
            # Le cycle doit rester dans une unique session WSL : sur ce poste,
            # deux invocations successives peuvent faire perdre au reset le
            # démarrage Docker déclenché par la première.
            Invoke-WslBash -Command 'bash scripts/test-supabase-local-wsl.sh'
        }
        Invoke-QualityStep -Name 'Intégrité PostgreSQL MC-C' -Action {
            Invoke-WslBash -Command 'bash scripts/test-moderation-integrity-wsl.sh'
        }
        Invoke-QualityStep -Name 'API HTTP/RPC Supabase local MC-D' -Action {
            # Ce scénario recrée exclusivement la pile Supabase locale du projet
            # et ne cible jamais le projet distant ou un environnement staging.
            Invoke-WslBash -Command 'MC_D_CONFIRM_LOCAL_RESET=yes bash scripts/test-moderation-api-local-wsl.sh'
        }
    }
    else {
        Add-SkippedStep -Name "Contrôles Supabase locaux" -Reason "Exécutez avec -RunLocalDatabaseChecks : db reset --local réinitialise les données locales."
    }

    $resultCode = Write-Summary
    exit $resultCode
}
finally {
    Pop-Location
}
