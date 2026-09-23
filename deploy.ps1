# Atualiza data.json a partir da planilha e publica o site no Netlify.
# Uso manual:      powershell -File deploy.ps1
# Uso agendado:    configurado via Agendador de Tarefas do Windows (ver README.md)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
Set-Location $root

$logFile = Join-Path $root "deploy.log"
function Log($msg) {
    $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $msg
    Write-Output $line
    Add-Content -Path $logFile -Value $line
}

# Carrega o token do Netlify de .env (arquivo local, fora do controle de versao)
$envFile = Join-Path $root ".env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#=]+)=(.*)$') {
            [System.Environment]::SetEnvironmentVariable($Matches[1].Trim(), $Matches[2].Trim(), "Process")
        }
    }
}

try {
    Log "Gerando data.json a partir da planilha (somente leitura)..."
    node scripts\generate_data.js
    if ($LASTEXITCODE -ne 0) { throw "generate_data.js falhou (exit $LASTEXITCODE)" }

    Log "Gerando dashboard.html e dashboard-site.zip autonomos..."
    node scripts\build_standalone.js
    if ($LASTEXITCODE -ne 0) { throw "build_standalone.js falhou (exit $LASTEXITCODE)" }
    if (Test-Path "dist\dashboard-site.zip") { Remove-Item "dist\dashboard-site.zip" -Force }
    Compress-Archive -Path "site\*" -DestinationPath "dist\dashboard-site.zip"

    # dashboard.html e dashboard-site.zip ja estao atualizados neste ponto,
    # independente do que acontecer com a publicacao abaixo.

    # Caminho principal: git push -> Netlify publica sozinho via integracao
    # com o repositorio (nao passa pela API que esta bloqueada na conta).
    if ($env:GITHUB_TOKEN -and $env:GITHUB_REPO) {
        Log "Enviando atualizacao para o GitHub..."
        $prevEAP = $ErrorActionPreference
        $ErrorActionPreference = "Continue"

        git add site/data.json | Out-Null
        $hasChanges = git status --porcelain -- site/data.json
        if ($hasChanges) {
            git commit -m "Atualizacao automatica $(Get-Date -Format 'yyyy-MM-dd HH:mm')" *> "$root\git-last.log"
            $authenticatedUrl = $env:GITHUB_REPO -replace '^https://', "https://$($env:GITHUB_TOKEN)@"
            git push $authenticatedUrl main *>> "$root\git-last.log"
            $pushExit = $LASTEXITCODE
            if ($pushExit -eq 0) {
                Log "Enviado ao GitHub com sucesso - Netlify deve publicar sozinho em instantes."
            }
            else {
                Log "AVISO: falha ao enviar para o GitHub (exit $pushExit). Detalhe em git-last.log."
            }
        }
        else {
            Log "Sem mudancas nos dados desde o ultimo envio - nada para publicar."
        }
        $ErrorActionPreference = $prevEAP
    }
    else {
        Log "GITHUB_TOKEN/GITHUB_REPO nao configurados em .env - pulando publicacao automatica."
    }

    Log "Rotina concluida - arquivos locais atualizados."
}
catch {
    Log "ERRO: $_"
    exit 1
}
