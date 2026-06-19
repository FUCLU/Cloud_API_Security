param(
    [string]$AppHost = "app.fmsec.shop",
    [string]$AuthHost = "auth.fmsec.shop",
    [string]$ApiHost = "api.fmsec.shop",
    [int]$ApiPort = 8443,
    [string]$ExpectedTailscaleIp = "100.76.197.61",
    [string]$ClientCert = ".\internal-certs\mtls\client.crt",
    [string]$ClientKey = ".\internal-certs\mtls\client.key",
    [string]$OutputDir = ".\EVIDENCE\protocol_security",
    [string]$SshTarget = ""
)

$ErrorActionPreference = "Stop"

function New-TestResult {
    param(
        [string]$Name,
        [string]$Status,
        [string]$Details
    )

    [PSCustomObject]@{
        time    = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
        name    = $Name
        status  = $Status
        details = $Details
    }
}

function Write-Result {
    param([object]$Result)

    $color = "White"
    if ($Result.status -eq "PASS") { $color = "Green" }
    elseif ($Result.status -eq "FAIL") { $color = "Red" }
    elseif ($Result.status -eq "SKIP") { $color = "Yellow" }

    Write-Host ("[{0}] {1}" -f $Result.status, $Result.name) -ForegroundColor $color
    if ($Result.details) {
        Write-Host ("    {0}" -f $Result.details)
    }
}

function Test-CommandExists {
    param([string]$CommandName)
    return $null -ne (Get-Command $CommandName -ErrorAction SilentlyContinue)
}

function Invoke-CurlText {
    param([string[]]$Arguments)

    $fullArgs = @("--silent", "--show-error") + $Arguments
    $output = & curl.exe @fullArgs 2>&1 | Out-String
    $exitCode = $LASTEXITCODE

    [PSCustomObject]@{
        exitCode = $exitCode
        output   = $output
    }
}

function Invoke-OpenSslText {
    param([string[]]$Arguments)

    $output = "Q" | & openssl @Arguments 2>&1 | Out-String
    $exitCode = $LASTEXITCODE

    [PSCustomObject]@{
        exitCode = $exitCode
        output   = $output
    }
}

function Test-ResolveHost {
    param(
        [string]$HostName,
        [string]$ExpectedIp
    )

    try {
        $addresses = @()
        try {
            $addresses = @(Resolve-DnsName $HostName -Type A -ErrorAction Stop | Where-Object { $_.IPAddress } | Select-Object -ExpandProperty IPAddress)
        }
        catch {
            $ping = Test-Connection $HostName -Count 1 -ErrorAction Stop
            $addresses = @($ping.IPV4Address.IPAddressToString)
        }

        if ($ExpectedIp -and ($addresses -contains $ExpectedIp)) {
            return New-TestResult "DNS/hosts: $HostName -> $ExpectedIp" "PASS" ("Resolved addresses: " + ($addresses -join ", "))
        }

        if (-not $ExpectedIp -and $addresses.Count -gt 0) {
            return New-TestResult "DNS/hosts: $HostName resolves" "PASS" ("Resolved addresses: " + ($addresses -join ", "))
        }

        return New-TestResult "DNS/hosts: $HostName" "FAIL" ("Expected $ExpectedIp but got: " + ($addresses -join ", "))
    }
    catch {
        return New-TestResult "DNS/hosts: $HostName" "FAIL" $_.Exception.Message
    }
}

function Test-HttpsEndpoint {
    param(
        [string]$Name,
        [string]$Url
    )

    try {
        $r = Invoke-CurlText @("-I", "--tlsv1.3", "--tls-max", "1.3", $Url)

        $httpLine = [regex]::Match($r.output, "HTTP/\S+\s+\d+").Value
        if ($r.exitCode -eq 0 -and $r.output -match "HTTP/\S+\s+(2\d\d|3\d\d)") {
            $hasHsts = $r.output -match "(?i)strict-transport-security"
            $detail = "$httpLine over TLS 1.3"
            if ($hasHsts) { $detail += "; HSTS header present" }
            else { $detail += "; HSTS header not found" }
            return New-TestResult $Name "PASS" $detail
        }

        return New-TestResult $Name "FAIL" ("curl exit=$($r.exitCode); HTTP=$httpLine; output: " + (($r.output -split "`n" | Where-Object { $_.Trim() } | Select-Object -First 8) -join " | "))
    }
    catch {
        return New-TestResult $Name "FAIL" $_.Exception.Message
    }
}

function Test-ApiWithoutClientCert {
    param([string]$Url)

    try {
        $r = Invoke-CurlText @("-i", "--tlsv1.3", "--tls-max", "1.3", $Url)
        $blockedByMtls = $r.output -match "HTTP/\S+\s+400" -and $r.output -match "(?i)(required SSL certificate|certificate required|No required SSL certificate)"
        $tlsHandshakeBlocked = $r.output -match "(?i)(certificate required|tlsv13 alert|handshake failure)"

        if ($blockedByMtls -or $tlsHandshakeBlocked) {
            return New-TestResult "API mTLS negative test: no client cert" "PASS" "Request was rejected before backend because client certificate was missing."
        }

        return New-TestResult "API mTLS negative test: no client cert" "FAIL" ("Expected mTLS rejection but got: " + (($r.output -split "`n" | Where-Object { $_.Trim() } | Select-Object -First 8) -join " | "))
    }
    catch {
        return New-TestResult "API mTLS negative test: no client cert" "FAIL" $_.Exception.Message
    }
}

function Test-ApiWithClientCert {
    param(
        [string]$Url,
        [string]$CertPath,
        [string]$KeyPath
    )

    if (-not (Test-Path $CertPath) -or -not (Test-Path $KeyPath)) {
        return New-TestResult "API mTLS positive test: with client cert" "SKIP" "Missing client certificate or key on Windows. Copy internal-certs/mtls/client.crt and internal-certs/mtls/client.key first, or run this test on Ubuntu."
    }

    try {
        $r = Invoke-CurlText @("-i", "--tlsv1.3", "--tls-max", "1.3", "--cert", $CertPath, "--key", $KeyPath, $Url)

        if ($r.exitCode -eq 0 -and $r.output -match "HTTP/\S+\s+200") {
            return New-TestResult "API mTLS positive test: with client cert" "PASS" "Client certificate accepted and /health returned HTTP 200."
        }

        return New-TestResult "API mTLS positive test: with client cert" "FAIL" ("Expected HTTP 200 but got: " + (($r.output -split "`n" | Where-Object { $_.Trim() } | Select-Object -First 8) -join " | "))
    }
    catch {
        return New-TestResult "API mTLS positive test: with client cert" "FAIL" $_.Exception.Message
    }
}

function Test-OpenSslTls {
    param(
        [string]$Name,
        [string]$HostName,
        [int]$Port,
        [string]$CertPath = "",
        [string]$KeyPath = ""
    )

    if (-not (Test-CommandExists "openssl")) {
        return New-TestResult $Name "SKIP" "openssl was not found in PATH. curl tests still ran."
    }

    $args = @("s_client", "-connect", "$HostName`:$Port", "-servername", $HostName, "-tls1_3", "-verify_return_error")

    if ($CertPath -and $KeyPath) {
        if (-not (Test-Path $CertPath) -or -not (Test-Path $KeyPath)) {
            return New-TestResult $Name "SKIP" "Missing client certificate or key."
        }
        $args += @("-cert", $CertPath, "-key", $KeyPath)
    }

    try {
        $r = Invoke-OpenSslText $args
        $isTls13 = $r.output -match "TLSv1\.3"
        $verifyOk = $r.output -match "Verify return code:\s+0\s+\(ok\)" -or $r.output -match "Verification:\s+OK"
        $tempKey = [regex]::Match($r.output, "Server Temp Key:\s*(.+)").Groups[1].Value.Trim()
        $cipher = [regex]::Match($r.output, "(Cipher is|Ciphersuite:)\s*(.+)").Groups[2].Value.Trim()

        if ($isTls13 -and $verifyOk) {
            $detail = "TLS 1.3 verified"
            if ($cipher) { $detail += "; cipher=$cipher" }
            if ($tempKey) { $detail += "; key_agreement=$tempKey" }
            return New-TestResult $Name "PASS" $detail
        }

        return New-TestResult $Name "FAIL" ("openssl exit=$($r.exitCode); TLSv1.3=$isTls13; verifyOk=$verifyOk; output: " + (($r.output -split "`n" | Where-Object { $_.Trim() } | Select-Object -First 12) -join " | "))
    }
    catch {
        return New-TestResult $Name "FAIL" $_.Exception.Message
    }
}

function Test-RemoteBackendTls {
    param([string]$Target)

    if (-not $Target) {
        return New-TestResult "Internal TLS: Kong verifies backend cert" "SKIP" "No -SshTarget provided. Example: -SshTarget cloudapi@100.76.197.61"
    }

    if (-not (Test-CommandExists "ssh")) {
        return New-TestResult "Internal TLS: Kong verifies backend cert" "SKIP" "ssh was not found in PATH."
    }

    try {
        $remoteCommand = "cd ~/Cloud_Api_Security && echo Q | docker compose exec -T kong sh -lc 'openssl s_client -connect api-backend:9000 -servername api-backend -CAfile /run/secrets/internal_ca_cert -verify_return_error'"
        $output = & ssh $Target $remoteCommand 2>&1 | Out-String
        $exitCode = $LASTEXITCODE

        $isTls13 = $output -match "TLSv1\.3"
        $verifyOk = $output -match "Verify return code:\s+0\s+\(ok\)" -or $output -match "Verification:\s+OK"
        $tempKey = [regex]::Match($output, "Server Temp Key:\s*(.+)").Groups[1].Value.Trim()

        if ($exitCode -eq 0 -and $isTls13 -and $verifyOk) {
            $detail = "Kong verified api-backend certificate over TLS 1.3"
            if ($tempKey) { $detail += "; key_agreement=$tempKey" }
            return New-TestResult "Internal TLS: Kong verifies backend cert" "PASS" $detail
        }

        return New-TestResult "Internal TLS: Kong verifies backend cert" "FAIL" ("ssh exit=$exitCode; TLSv1.3=$isTls13; verifyOk=$verifyOk; output: " + (($output -split "`n" | Where-Object { $_.Trim() } | Select-Object -First 12) -join " | "))
    }
    catch {
        return New-TestResult "Internal TLS: Kong verifies backend cert" "FAIL" $_.Exception.Message
    }
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$results = New-Object System.Collections.Generic.List[object]

if (-not (Test-CommandExists "curl.exe")) {
    $result = New-TestResult "Prerequisite: curl.exe" "FAIL" "curl.exe was not found in PATH."
    Write-Result $result
    exit 1
}

$appUrl = "https://$AppHost/login"
$authUrl = "https://$AuthHost/realms/cloudapi"
$apiHealthUrl = "https://$ApiHost`:$ApiPort/health"

$tests = @(
    (Test-ResolveHost $AppHost $ExpectedTailscaleIp),
    (Test-ResolveHost $AuthHost $ExpectedTailscaleIp),
    (Test-ResolveHost $ApiHost $ExpectedTailscaleIp),
    (Test-HttpsEndpoint "HTTPS/TLS 1.3: app endpoint" $appUrl),
    (Test-HttpsEndpoint "HTTPS/TLS 1.3: auth endpoint" $authUrl),
    (Test-ApiWithoutClientCert $apiHealthUrl),
    (Test-ApiWithClientCert $apiHealthUrl $ClientCert $ClientKey),
    (Test-OpenSslTls "OpenSSL: app TLS/key agreement" $AppHost 443),
    (Test-OpenSslTls "OpenSSL: auth TLS/key agreement" $AuthHost 443),
    (Test-OpenSslTls "OpenSSL: api mTLS TLS/key agreement" $ApiHost $ApiPort $ClientCert $ClientKey),
    (Test-RemoteBackendTls $SshTarget)
)

foreach ($test in $tests) {
    $results.Add($test)
    Write-Result $test
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$jsonPath = Join-Path $OutputDir "secure-protocol-test-$timestamp.json"
$mdPath = Join-Path $OutputDir "secure-protocol-test-$timestamp.md"

$results | ConvertTo-Json -Depth 5 | Set-Content -Path $jsonPath -Encoding UTF8

$md = New-Object System.Collections.Generic.List[string]
$md.Add("# Secure Protocol Test Report")
$md.Add("")
$md.Add("- Time: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")")
$md.Add("- App: https://$AppHost")
$md.Add("- Auth: https://$AuthHost")
$md.Add("- API: https://$ApiHost`:$ApiPort")
$md.Add("- Expected Tailscale IP: $ExpectedTailscaleIp")
$md.Add("")
$md.Add("| Status | Test | Details |")
$md.Add("|---|---|---|")
foreach ($r in $results) {
    $safeDetails = ($r.details -replace "\|", "/" -replace "`r?`n", " ")
    $md.Add("| $($r.status) | $($r.name) | $safeDetails |")
}

$md | Set-Content -Path $mdPath -Encoding UTF8

$failCount = @($results | Where-Object { $_.status -eq "FAIL" }).Count
$skipCount = @($results | Where-Object { $_.status -eq "SKIP" }).Count
$passCount = @($results | Where-Object { $_.status -eq "PASS" }).Count

Write-Host ""
Write-Host "Summary: PASS=$passCount FAIL=$failCount SKIP=$skipCount"
Write-Host "JSON report: $jsonPath"
Write-Host "Markdown report: $mdPath"

if ($failCount -gt 0) {
    exit 1
}

exit 0
