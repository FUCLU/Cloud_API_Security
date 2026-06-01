Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Push-Location $Root
try {
    python scripts\security_testing\run_sast.py @args
}
finally {
    Pop-Location
}
